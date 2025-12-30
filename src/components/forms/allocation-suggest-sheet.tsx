'use client';

import { useState, useEffect } from 'react';
import { Loader2, Target, TrendingUp } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getGoals, updateGoal, getGoalProgress } from '@/lib/firebase/goals-service';
import { updateAccountBalance } from '@/lib/firebase/accounts-service';
import { updateUserSettings } from '@/lib/firebase/settings-service';
import { SavingsGoal, Account } from '@/types/firestore';

interface AllocationSuggestSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    incomeAmount: number;
    sourceAccountId: string; // Account that received the income
    onComplete: () => void;
}

interface GoalAllocation {
    goal: SavingsGoal;
    suggestedAmount: number;
    allocatedAmount: number;
    linkedAccount?: Account;
}

export function AllocationSuggestSheet({
    open,
    onOpenChange,
    userId,
    incomeAmount,
    sourceAccountId,
    onComplete,
}: AllocationSuggestSheetProps) {
    const [loading, setLoading] = useState(true);
    const [allocations, setAllocations] = useState<GoalAllocation[]>([]);
    const [isAllocating, setIsAllocating] = useState(false);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    useEffect(() => {
        if (!open) return;

        async function loadGoals() {
            setLoading(true);
            try {
                const goals = await getGoals(userId);

                // Filter to goals that aren't completed (no need for linkedAccountId anymore)
                const activeGoals = goals.filter(g =>
                    g.currentAmount < g.targetAmount
                );

                // Calculate suggested amounts based on priority and remaining target
                const totalRemaining = activeGoals.reduce(
                    (sum, g) => sum + (g.targetAmount - g.currentAmount), 0
                );

                const allocationsData: GoalAllocation[] = activeGoals.map(goal => {
                    const remaining = goal.targetAmount - goal.currentAmount;
                    // Distribute proportionally based on remaining amount
                    const proportion = totalRemaining > 0 ? remaining / totalRemaining : 0;
                    // Suggested amount is a percentage of income, capped at remaining
                    const suggested = Math.min(
                        Math.round(incomeAmount * 0.2 * proportion * 100) / 100, // 20% of income distributed
                        remaining
                    );

                    return {
                        goal,
                        suggestedAmount: suggested,
                        allocatedAmount: suggested,
                    };
                });

                setAllocations(allocationsData);
            } catch (error) {
                console.error('Error loading goals:', error);
            } finally {
                setLoading(false);
            }
        }

        loadGoals();
    }, [open, userId, incomeAmount]);

    const updateAllocation = (goalId: string, amount: number) => {
        setAllocations(prev => prev.map(a =>
            a.goal.id === goalId
                ? { ...a, allocatedAmount: Math.max(0, amount) }
                : a
        ));
    };

    const [dontAskAgain, setDontAskAgain] = useState(false);

    // ... (existing updateAllocation)

    const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
    const remaining = incomeAmount - totalAllocated;

    const handleClose = async () => {
        if (dontAskAgain) {
            await updateUserSettings(userId, { autoSuggestGoals: false });
        }
        onOpenChange(false);
    };

    const handleAllocate = async () => {
        if (totalAllocated <= 0) {
            await handleClose();
            return;
        }

        setIsAllocating(true);
        try {
            // Process each allocation
            for (const allocation of allocations) {
                if (allocation.allocatedAmount <= 0) continue;

                // Update goal's current amount
                await updateGoal(userId, allocation.goal.id, {
                    currentAmount: allocation.goal.currentAmount + allocation.allocatedAmount,
                });

                // Transfer from source to goal account if different
                // Creates a real money transfer + maintains virtual allocation
                if (allocation.goal.linkedAccountId && allocation.goal.linkedAccountId !== sourceAccountId) {
                    // Deduct from source account
                    await updateAccountBalance(userId, sourceAccountId, -allocation.allocatedAmount);
                    // Add to goal account
                    await updateAccountBalance(userId, allocation.goal.linkedAccountId, allocation.allocatedAmount);
                }
            }

            if (dontAskAgain) {
                await updateUserSettings(userId, { autoSuggestGoals: false });
            }

            onComplete();
            onOpenChange(false);
        } catch (error) {
            console.error('Error allocating to goals:', error);
        } finally {
            setIsAllocating(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
                <SheetHeader className="text-left">
                    <SheetTitle className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                        Allocate to Goals
                    </SheetTitle>
                    <SheetDescription>
                        You received {formatCurrency(incomeAmount)}. Allocate some to your savings goals?
                    </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : allocations.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>No active goals with linked accounts</p>
                            <p className="text-sm mt-2">
                                Create goals and link them to goal accounts to see suggestions here.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Available amount */}
                            <div className="flex justify-between items-center p-3 rounded-lg bg-muted">
                                <span className="text-muted-foreground">Remaining to allocate</span>
                                <span className={`font-bold ${remaining < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                    {formatCurrency(remaining)}
                                </span>
                            </div>

                            {/* Goal allocations */}
                            {allocations.map((allocation) => {
                                const progress = getGoalProgress(allocation.goal);
                                const remainingToGoal = allocation.goal.targetAmount - allocation.goal.currentAmount;

                                return (
                                    <div key={allocation.goal.id} className="p-4 rounded-lg border border-border bg-card">
                                        <div className="flex items-center gap-3 mb-3">
                                            <span className="text-2xl">{allocation.goal.icon || '🎯'}</span>
                                            <div className="flex-1">
                                                <p className="font-medium">{allocation.goal.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {formatCurrency(allocation.goal.currentAmount)} / {formatCurrency(allocation.goal.targetAmount)}
                                                    <span className="ml-2">({progress.toFixed(0)}%)</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                                            <div
                                                className="h-full bg-primary rounded-full transition-all"
                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                            />
                                        </div>

                                        {/* Allocation input */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-muted-foreground">Allocate:</span>
                                            <div className="relative flex-1">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">€</span>
                                                <Input
                                                    type="number"
                                                    value={allocation.allocatedAmount || ''}
                                                    onChange={(e) => updateAllocation(
                                                        allocation.goal.id,
                                                        parseFloat(e.target.value) || 0
                                                    )}
                                                    className="pl-7"
                                                    max={remainingToGoal}
                                                    step="0.01"
                                                />
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => updateAllocation(allocation.goal.id, remainingToGoal)}
                                                className="shrink-0"
                                            >
                                                Fill
                                            </Button>
                                        </div>
                                        {allocation.allocatedAmount > remainingToGoal && (
                                            <p className="text-xs text-rose-500 mt-1">
                                                Max: {formatCurrency(remainingToGoal)} needed
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}

                    {/* Don't ask again option */}
                    <div className="flex items-center space-x-2 pt-2">
                        <input
                            type="checkbox"
                            id="dontAsk"
                            checked={dontAskAgain}
                            onChange={(e) => setDontAskAgain(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary bg-background"
                        />
                        <label
                            htmlFor="dontAsk"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                        >
                            Don&apos;t ask me again
                        </label>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="flex-1"
                        >
                            Skip
                        </Button>
                        <Button
                            onClick={handleAllocate}
                            disabled={isAllocating || totalAllocated <= 0 || remaining < 0}
                            className="flex-1"
                        >
                            {isAllocating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                `Allocate ${formatCurrency(totalAllocated)}`
                            )}
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
