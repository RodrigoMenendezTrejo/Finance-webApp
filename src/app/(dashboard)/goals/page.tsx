'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Target, Trash2, Pencil, CheckCircle, AlertCircle, ChevronUp, ChevronDown, PlusCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAccounts, updateAccountBalance } from '@/lib/firebase/accounts-service';
import {
    getGoals,
    createGoal,
    updateGoal,
    deleteGoal,
    getGoalProgress,
    getGoalStatus,
    updateGoalPriorities,
    GOAL_ICONS,
} from '@/lib/firebase/goals-service';
import { createTransaction } from '@/lib/firebase/transactions-service';
import { SavingsGoal, Account } from '@/types/firestore';
import { useChatActions } from '@/lib/chat-action-context';


// Status colors and icons
const statusConfig = {
    'completed': { color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Completed', icon: CheckCircle },
    'on-track': { color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'On Track', icon: Target },
    'behind': { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Behind', icon: AlertCircle },
    'at-risk': { color: 'text-rose-500', bg: 'bg-rose-500/10', label: 'At Risk', icon: AlertCircle },
    'no-deadline': { color: 'text-muted-foreground', bg: 'bg-muted', label: 'No Deadline', icon: Target },
};

export default function GoalsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { isGoalFormOpen, closeGoalForm, goalPrefill } = useChatActions();


    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    // Add dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const [newCurrent, setNewCurrent] = useState('');
    const [newDeadline, setNewDeadline] = useState<Date | undefined>(undefined);
    const [hasDeadline, setHasDeadline] = useState(false);
    const [newLinkedAccount, setNewLinkedAccount] = useState('');
    const [newIcon, setNewIcon] = useState('🎯');
    const [isCreating, setIsCreating] = useState(false);

    // Edit dialog state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editGoal, setEditGoal] = useState<SavingsGoal | null>(null);
    const [editName, setEditName] = useState('');
    const [editTarget, setEditTarget] = useState('');
    const [editCurrent, setEditCurrent] = useState('');
    const [editDeadline, setEditDeadline] = useState<Date | undefined>(undefined);
    const [editHasDeadline, setEditHasDeadline] = useState(false);
    const [editIcon, setEditIcon] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete dialog state
    const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            try {
                const [goalsData, accountsData] = await Promise.all([
                    getGoals(user.uid),
                    getAccounts(user.uid),
                ]);
                setGoals(goalsData);
                setAccounts(accountsData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user]);

    // Sync with chat context
    useEffect(() => {
        if (isGoalFormOpen) {
            setIsAddOpen(true);
            if (goalPrefill) {
                if (goalPrefill.name) setNewName(goalPrefill.name);
                if (goalPrefill.target) setNewTarget(goalPrefill.target.toString());
                if (goalPrefill.icon) setNewIcon(goalPrefill.icon);
            }
        }
    }, [isGoalFormOpen, goalPrefill]);


    const refreshData = async () => {
        if (!user) return;
        const [goalsData, accountsData] = await Promise.all([
            getGoals(user.uid),
            getAccounts(user.uid),
        ]);
        setGoals(goalsData);
        setAccounts(accountsData);
    };

    // Add funds dialog state
    const [isAddFundsOpen, setIsAddFundsOpen] = useState(false);
    const [addFundsGoal, setAddFundsGoal] = useState<SavingsGoal | null>(null);
    const [addFundsAmount, setAddFundsAmount] = useState('');
    const [addFundsError, setAddFundsError] = useState('');
    const [isAddingFunds, setIsAddingFunds] = useState(false);

    // Complete goal dialog state
    const [isCompleteOpen, setIsCompleteOpen] = useState(false);
    const [completeGoal, setCompleteGoal] = useState<SavingsGoal | null>(null);
    const [isCompleting, setIsCompleting] = useState(false);

    // Get ONLY goal accounts (savings accounts marked for goals)
    const goalAccounts = accounts.filter(a => a.type === 'asset' && a.isGoalAccount);

    // Calculate total allocated to all goals
    const totalAllocated = goals.reduce((sum, g) => sum + g.currentAmount, 0);

    // Get total available in goal accounts
    const totalGoalAccountBalance = goalAccounts.reduce((sum, a) => sum + a.balance, 0);

    // Available for new allocations
    const availableForAllocation = totalGoalAccountBalance - totalAllocated;

    const openAddFundsDialog = (goal: SavingsGoal) => {
        setAddFundsGoal(goal);
        setAddFundsAmount('');
        setAddFundsError('');
        setIsAddFundsOpen(true);
    };

    const handleAddFunds = async () => {
        if (!user || !addFundsGoal) return;
        setAddFundsError('');

        const amount = parseFloat(addFundsAmount);
        if (amount <= 0) {
            setAddFundsError('Please enter a valid amount');
            return;
        }

        // Check if there's enough unallocated money in goal accounts
        if (amount > availableForAllocation) {
            setAddFundsError(`Insufficient funds. Available: €${availableForAllocation.toFixed(2)}`);
            return;
        }

        // Cap at remaining amount needed for this goal
        const remaining = addFundsGoal.targetAmount - addFundsGoal.currentAmount;
        const actualAmount = Math.min(amount, remaining);

        setIsAddingFunds(true);
        try {
            // VIRTUAL allocation - just update goal, don't touch account
            await updateGoal(user.uid, addFundsGoal.id, {
                currentAmount: addFundsGoal.currentAmount + actualAmount,
            });

            await refreshData();
            setIsAddFundsOpen(false);
        } catch (error) {
            console.error('Error adding funds:', error);
            setAddFundsError('Failed to add funds. Please try again.');
        } finally {
            setIsAddingFunds(false);
        }
    };

    const openCompleteDialog = (goal: SavingsGoal) => {
        setCompleteGoal(goal);
        setIsCompleteOpen(true);
    };

    const handleCompleteGoal = async () => {
        if (!user || !completeGoal) return;

        setIsCompleting(true);
        try {
            // Deduct the goal's amount from first goal account (or linked account)
            const targetAccountId = completeGoal.linkedAccountId || goalAccounts[0]?.id;

            if (targetAccountId && completeGoal.currentAmount > 0) {
                // Create an expense transaction for the completed goal
                // This automatically deducts the balance from the account
                await createTransaction(user.uid, {
                    date: new Date(),
                    payee: `Goal Completed: ${completeGoal.name}`,
                    category: 'Savings Goal', // Could be dynamic or user-selected later
                    notes: `Goal target: €${completeGoal.targetAmount}`,
                    amount: completeGoal.currentAmount,
                    type: 'expense',
                    splits: [{
                        accountId: targetAccountId,
                        amount: -completeGoal.currentAmount
                    }]
                });
            }

            // Delete the goal
            await deleteGoal(user.uid, completeGoal.id);

            await refreshData();
            setIsCompleteOpen(false);
        } catch (error) {
            console.error('Error completing goal:', error);
        } finally {
            setIsCompleting(false);
        }
    };

    const movePriority = async (goalId: string, direction: 'up' | 'down') => {
        const currentIndex = goals.findIndex(g => g.id === goalId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= goals.length) return;

        // Swap in local state
        const newGoals = [...goals];
        [newGoals[currentIndex], newGoals[newIndex]] = [newGoals[newIndex], newGoals[currentIndex]];
        setGoals(newGoals);

        // Update priorities in Firestore
        if (user) {
            const goalIds = newGoals.map(g => g.id);
            await updateGoalPriorities(user.uid, goalIds);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    const handleCreate = async () => {
        if (!user || !newName.trim() || !newTarget) return;

        setIsCreating(true);
        try {
            await createGoal(user.uid, {
                name: newName.trim(),
                targetAmount: parseFloat(newTarget),
                currentAmount: newCurrent ? parseFloat(newCurrent) : 0,
                deadline: hasDeadline ? newDeadline : undefined,
                linkedAccountId: newLinkedAccount || undefined,
                icon: newIcon,
            });

            await refreshData();
            // Reset form
            setNewName('');
            setNewTarget('');
            setNewCurrent('');
            setNewDeadline(undefined);
            setHasDeadline(false);
            setNewLinkedAccount('');
            setNewIcon('🎯');
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error creating goal:', error);
        } finally {
            setIsCreating(false);
        }
    };

    const openEditDialog = (goal: SavingsGoal) => {
        setEditGoal(goal);
        setEditName(goal.name);
        setEditTarget(goal.targetAmount.toString());
        setEditCurrent(goal.currentAmount.toString());
        setEditDeadline(goal.deadline?.toDate());
        setEditHasDeadline(!!goal.deadline);
        setEditIcon(goal.icon || '🎯');
        setIsEditOpen(true);
    };

    const handleUpdate = async () => {
        if (!user || !editGoal || !editName.trim() || !editTarget) return;

        setIsUpdating(true);
        try {
            await updateGoal(user.uid, editGoal.id, {
                name: editName.trim(),
                targetAmount: parseFloat(editTarget),
                currentAmount: parseFloat(editCurrent) || 0,
                deadline: editHasDeadline && editDeadline ? editDeadline : null,
                icon: editIcon,
            });

            await refreshData();
            setIsEditOpen(false);
            setEditGoal(null);
        } catch (error) {
            console.error('Error updating goal:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !selectedGoal) return;

        setIsDeleting(true);
        try {
            await deleteGoal(user.uid, selectedGoal.id);
            await refreshData();
            setIsDeleteOpen(false);
            setSelectedGoal(null);
        } catch (error) {
            console.error('Error deleting goal:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Calculate total progress
    const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalCurrent = goals.reduce((sum, g) => sum + g.currentAmount, 0);
    const overallProgress = totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0;

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b border-border/50">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold">Savings Goals</h1>

                    <Button size="sm" className="ml-auto" onClick={() => setIsAddOpen(true)}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Goal
                    </Button>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Overall Summary */}
                {goals.length > 0 && (
                    <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-muted-foreground">Overall Progress</span>
                                <span className="text-sm font-medium">{overallProgress.toFixed(0)}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(overallProgress, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 text-sm">
                                <span className="text-muted-foreground">{formatCurrency(totalCurrent)} saved</span>
                                <span className="font-medium">{formatCurrency(totalTarget)} target</span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Goals List */}
                {goals.map((goal) => {
                    const progress = getGoalProgress(goal);
                    const status = getGoalStatus(goal);
                    const StatusIcon = statusConfig[status].icon;

                    return (
                        <Card key={goal.id} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <div className="text-2xl">{goal.icon || '🎯'}</div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-medium truncate">{goal.name}</h3>
                                            <span className={`text-xs px-2 py-0.5 rounded-full ${statusConfig[status].bg} ${statusConfig[status].color}`}>
                                                {statusConfig[status].label}
                                            </span>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${status === 'completed' ? 'bg-emerald-500' :
                                                    status === 'on-track' ? 'bg-blue-500' :
                                                        status === 'behind' ? 'bg-yellow-500' :
                                                            status === 'at-risk' ? 'bg-rose-500' :
                                                                'bg-primary'
                                                    }`}
                                                style={{ width: `${Math.min(progress, 100)}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                                            </span>
                                            <span className="font-medium">{progress.toFixed(0)}%</span>
                                        </div>

                                        {goal.deadline && (
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Deadline: {goal.deadline.toDate().toLocaleDateString('es-ES', {
                                                    day: 'numeric',
                                                    month: 'long',
                                                    year: 'numeric'
                                                })}
                                            </p>
                                        )}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        {/* Priority controls */}
                                        <div className="flex flex-col">
                                            <button
                                                onClick={() => movePriority(goal.id, 'up')}
                                                disabled={goals.indexOf(goal) === 0}
                                                className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30"
                                                title="Move up"
                                            >
                                                <ChevronUp className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                            <button
                                                onClick={() => movePriority(goal.id, 'down')}
                                                disabled={goals.indexOf(goal) === goals.length - 1}
                                                className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30"
                                                title="Move down"
                                            >
                                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                            </button>
                                        </div>
                                        {/* Edit/Delete buttons */}
                                        <button
                                            onClick={() => openEditDialog(goal)}
                                            className="p-2 rounded-full hover:bg-muted transition-colors"
                                        >
                                            <Pencil className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedGoal(goal);
                                                setIsDeleteOpen(true);
                                            }}
                                            className="p-2 rounded-full hover:bg-muted transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-rose-500" />
                                        </button>
                                        {/* Add Funds button */}
                                        {goal.currentAmount < goal.targetAmount && (
                                            <button
                                                onClick={() => openAddFundsDialog(goal)}
                                                className="p-2 rounded-full hover:bg-emerald-500/20 transition-colors"
                                                title="Add funds to goal"
                                            >
                                                <PlusCircle className="w-4 h-4 text-emerald-500" />
                                            </button>
                                        )}
                                        {/* Complete Goal button - shows when goal has some funds */}
                                        {goal.currentAmount > 0 && (
                                            <button
                                                onClick={() => openCompleteDialog(goal)}
                                                className="p-2 rounded-full hover:bg-blue-500/20 transition-colors"
                                                title="Complete goal (spend money)"
                                            >
                                                <Check className="w-4 h-4 text-blue-500" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {/* Empty state */}
                {goals.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">No savings goals yet</p>
                        <Button variant="link" onClick={() => setIsAddOpen(true)}>
                            Create your first goal
                        </Button>
                    </div>
                )}
            </div>

            {/* Add Goal Dialog */}
            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) closeGoalForm();
            }}>

                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Savings Goal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {/* Icon selector */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Icon</label>
                            <div className="flex gap-2 flex-wrap">
                                {GOAL_ICONS.map((icon) => (
                                    <button
                                        key={icon.emoji}
                                        onClick={() => setNewIcon(icon.emoji)}
                                        className={`p-2 rounded-lg text-xl ${newIcon === icon.emoji ? 'bg-primary ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}
                                        title={icon.label}
                                    >
                                        {icon.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Goal Name</label>
                            <Input
                                placeholder="e.g., Vacation, Emergency Fund"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Target Amount (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={newTarget}
                                onChange={(e) => setNewTarget(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Current Amount (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={newCurrent}
                                onChange={(e) => setNewCurrent(e.target.value)}
                            />
                        </div>

                        {/* Deadline toggle */}
                        <div>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={hasDeadline}
                                    onChange={(e) => {
                                        setHasDeadline(e.target.checked);
                                        if (!e.target.checked) setNewDeadline(undefined);
                                    }}
                                    className="rounded"
                                />
                                Set a deadline
                            </label>
                        </div>

                        {hasDeadline && (
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Deadline</label>
                                <DatePicker
                                    date={newDeadline}
                                    onDateChange={setNewDeadline}
                                    placeholder="Select deadline"
                                />
                            </div>
                        )}

                        {/* Link to goal account (optional) */}
                        {goalAccounts.length > 0 && (
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Link to Goal Account (optional)</label>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => setNewLinkedAccount('')}
                                        className={`w-full p-3 rounded-lg text-left ${!newLinkedAccount ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                                    >
                                        No linked account
                                    </button>
                                    {goalAccounts.map((account) => (
                                        <button
                                            key={account.id}
                                            onClick={() => setNewLinkedAccount(account.id)}
                                            className={`w-full p-3 rounded-lg text-left flex items-center gap-3 ${newLinkedAccount === account.id ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                                        >
                                            <span>{account.icon || '🎯'}</span>
                                            <span>{account.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <Button
                            onClick={handleCreate}
                            disabled={isCreating || !newName.trim() || !newTarget}
                            className="w-full"
                        >
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Goal'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Goal Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Goal</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {/* Icon selector */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Icon</label>
                            <div className="flex gap-2 flex-wrap">
                                {GOAL_ICONS.map((icon) => (
                                    <button
                                        key={icon.emoji}
                                        onClick={() => setEditIcon(icon.emoji)}
                                        className={`p-2 rounded-lg text-xl ${editIcon === icon.emoji ? 'bg-primary ring-2 ring-primary' : 'bg-muted hover:bg-muted/80'}`}
                                        title={icon.label}
                                    >
                                        {icon.emoji}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Goal Name</label>
                            <Input
                                placeholder="e.g., Vacation, Emergency Fund"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Target Amount (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={editTarget}
                                onChange={(e) => setEditTarget(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Current Amount (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={editCurrent}
                                onChange={(e) => setEditCurrent(e.target.value)}
                            />
                        </div>

                        {/* Deadline toggle */}
                        <div>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input
                                    type="checkbox"
                                    checked={editHasDeadline}
                                    onChange={(e) => {
                                        setEditHasDeadline(e.target.checked);
                                        if (!e.target.checked) setEditDeadline(undefined);
                                    }}
                                    className="rounded"
                                />
                                Set a deadline
                            </label>
                        </div>

                        {editHasDeadline && (
                            <div>
                                <label className="text-sm text-muted-foreground mb-1 block">Deadline</label>
                                <DatePicker
                                    date={editDeadline}
                                    onDateChange={setEditDeadline}
                                    placeholder="Select deadline"
                                />
                            </div>
                        )}

                        <Button
                            onClick={handleUpdate}
                            disabled={isUpdating || !editName.trim() || !editTarget}
                            className="w-full"
                        >
                            {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Goal</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete &quot;{selectedGoal?.name}&quot;?
                            This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDelete}
                            disabled={isDeleting}
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Funds Dialog */}
            <Dialog open={isAddFundsOpen} onOpenChange={setIsAddFundsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Funds to Goal</DialogTitle>
                        <DialogDescription>
                            Add savings to &quot;{addFundsGoal?.name}&quot;
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {addFundsGoal && (
                            <>
                                <div className="p-4 rounded-lg bg-muted">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>Current Progress</span>
                                        <span className="font-medium">
                                            {((addFundsGoal.currentAmount / addFundsGoal.targetAmount) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-background rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full"
                                            style={{ width: `${Math.min((addFundsGoal.currentAmount / addFundsGoal.targetAmount) * 100, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                                        <span>€{addFundsGoal.currentAmount.toFixed(2)}</span>
                                        <span>€{addFundsGoal.targetAmount.toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Available funds info */}
                                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-blue-400">Available for allocation</span>
                                        <span className="font-medium text-blue-400">€{availableForAllocation.toFixed(2)}</span>
                                    </div>
                                    {goalAccounts.length === 0 && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            No goal accounts found. Mark an asset account as &quot;Goal Account&quot; first.
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="text-sm text-muted-foreground mb-2 block">
                                        Amount to allocate (max: €{Math.min(
                                            addFundsGoal.targetAmount - addFundsGoal.currentAmount,
                                            availableForAllocation
                                        ).toFixed(2)})
                                    </label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        value={addFundsAmount}
                                        onChange={(e) => setAddFundsAmount(e.target.value)}
                                    />
                                    {addFundsError && (
                                        <p className="text-rose-500 text-sm mt-2">{addFundsError}</p>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <DialogFooter className="gap-2 mt-4">
                        <Button variant="outline" onClick={() => setIsAddFundsOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleAddFunds}
                            disabled={isAddingFunds || !addFundsAmount}
                            className="bg-emerald-600 hover:bg-emerald-700"
                        >
                            {isAddingFunds ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add Funds'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Complete Goal Confirmation Dialog */}
            <Dialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Complete Goal</DialogTitle>
                        <DialogDescription>
                            Complete &quot;{completeGoal?.name}&quot; and spend the allocated money?
                        </DialogDescription>
                    </DialogHeader>
                    {completeGoal && (
                        <div className="space-y-4 pt-4">
                            <div className="p-4 rounded-lg bg-muted">
                                <div className="flex justify-between text-sm mb-2">
                                    <span>Amount to deduct</span>
                                    <span className="font-bold text-rose-500">
                                        -€{completeGoal.currentAmount.toFixed(2)}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    This will deduct €{completeGoal.currentAmount.toFixed(2)} from your goal account and delete this goal.
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 mt-4">
                        <Button variant="outline" onClick={() => setIsCompleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCompleteGoal}
                            disabled={isCompleting}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Complete & Spend'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
