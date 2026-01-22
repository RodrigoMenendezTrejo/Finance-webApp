'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Loader2, Wallet, Trash2, Pencil, AlertTriangle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/firebase/auth-context';
import {
    getBudgets,
    createBudget,
    updateBudget,
    deleteBudget,
    getBudgetProgress,
    BudgetProgress,
} from '@/lib/firebase/budget-service';
import { Budget } from '@/types/firestore';
import { DEFAULT_CATEGORIES, CategoryDef } from '@/lib/categories';
import { useChatActions } from '@/lib/chat-action-context';


// Status colors for budget progress
const getProgressColor = (progress: BudgetProgress) => {
    if (progress.isOverBudget) return { bar: 'bg-rose-500', text: 'text-rose-500', bg: 'bg-rose-500/10' };
    if (progress.isNearLimit) return { bar: 'bg-amber-500', text: 'text-amber-500', bg: 'bg-amber-500/10' };
    return { bar: 'bg-emerald-500', text: 'text-emerald-500', bg: 'bg-emerald-500/10' };
};

export default function BudgetsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { isBudgetFormOpen, closeBudgetForm, budgetPrefill } = useChatActions();


    const [budgetProgress, setBudgetProgress] = useState<BudgetProgress[]>([]);
    const [loading, setLoading] = useState(true);

    // Add dialog state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newCategory, setNewCategory] = useState('');
    const [newAmount, setNewAmount] = useState('');
    const [newThreshold, setNewThreshold] = useState('80');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    // Edit dialog state
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editBudget, setEditBudget] = useState<Budget | null>(null);
    const [editAmount, setEditAmount] = useState('');
    const [editThreshold, setEditThreshold] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);

    // Delete dialog state
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;
            try {
                const progress = await getBudgetProgress(user.uid);
                setBudgetProgress(progress);
            } catch (error) {
                console.error('Error fetching budgets:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, [user]);

    // Sync with chat context
    useEffect(() => {
        if (isBudgetFormOpen) {
            setIsAddOpen(true);
            if (budgetPrefill) {
                if (budgetPrefill.category) setNewCategory(budgetPrefill.category);
                if (budgetPrefill.amount) setNewAmount(budgetPrefill.amount.toString());
            }
        }
    }, [isBudgetFormOpen, budgetPrefill]);


    const refreshData = async () => {
        if (!user) return;
        const progress = await getBudgetProgress(user.uid);
        setBudgetProgress(progress);
    };

    // Get categories that don't have a budget yet
    const existingCategoryIds = budgetProgress.map(bp => bp.budget.categoryId);
    const availableCategories = DEFAULT_CATEGORIES.filter(
        cat => !existingCategoryIds.includes(cat.id) && cat.id !== 'income' && cat.id !== 'transfer'
    );

    const getCategoryDef = (categoryId: string): CategoryDef | undefined => {
        return DEFAULT_CATEGORIES.find(cat => cat.id === categoryId);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    const handleCreate = async () => {
        if (!user || !newCategory || !newAmount) return;

        setIsCreating(true);
        setCreateError('');
        try {
            await createBudget(user.uid, {
                categoryId: newCategory,
                amount: parseFloat(newAmount),
                alertThreshold: parseInt(newThreshold) || 80,
            });

            await refreshData();
            // Reset form
            setNewCategory('');
            setNewAmount('');
            setNewThreshold('80');
            setIsAddOpen(false);
        } catch (error) {
            console.error('Error creating budget:', error);
            setCreateError(error instanceof Error ? error.message : 'Failed to create budget');
        } finally {
            setIsCreating(false);
        }
    };

    const openEditDialog = (budget: Budget) => {
        setEditBudget(budget);
        setEditAmount(budget.amount.toString());
        setEditThreshold(budget.alertThreshold.toString());
        setIsEditOpen(true);
    };

    const handleUpdate = async () => {
        if (!user || !editBudget || !editAmount) return;

        setIsUpdating(true);
        try {
            await updateBudget(user.uid, editBudget.id, {
                amount: parseFloat(editAmount),
                alertThreshold: parseInt(editThreshold) || 80,
            });

            await refreshData();
            setIsEditOpen(false);
            setEditBudget(null);
        } catch (error) {
            console.error('Error updating budget:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleDelete = async () => {
        if (!user || !selectedBudget) return;

        setIsDeleting(true);
        try {
            await deleteBudget(user.uid, selectedBudget.id);
            await refreshData();
            setIsDeleteOpen(false);
            setSelectedBudget(null);
        } catch (error) {
            console.error('Error deleting budget:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Calculate totals
    const totalBudgeted = budgetProgress.reduce((sum, bp) => sum + bp.budget.amount, 0);
    const totalSpent = budgetProgress.reduce((sum, bp) => sum + bp.spent, 0);
    const overallPercent = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;
    const overBudgetCount = budgetProgress.filter(bp => bp.isOverBudget).length;

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
                    <h1 className="text-xl font-bold">Budget Limits</h1>

                    <Button size="sm" className="ml-auto" onClick={() => setIsAddOpen(true)} disabled={availableCategories.length === 0}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Budget
                    </Button>
                </div>
            </header>

            <div className="p-4 space-y-4">
                {/* Overall Summary */}
                {budgetProgress.length > 0 && (
                    <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
                        <CardContent className="p-4">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-muted-foreground">Monthly Budget Usage</span>
                                <span className="text-sm font-medium">{overallPercent.toFixed(0)}%</span>
                            </div>
                            <div className="h-3 bg-muted rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${overallPercent > 100 ? 'bg-rose-500' :
                                        overallPercent > 80 ? 'bg-amber-500' :
                                            'bg-gradient-to-r from-primary to-primary/70'
                                        }`}
                                    style={{ width: `${Math.min(overallPercent, 100)}%` }}
                                />
                            </div>
                            <div className="flex justify-between mt-2 text-sm">
                                <span className="text-muted-foreground">{formatCurrency(totalSpent)} spent</span>
                                <span className="font-medium">{formatCurrency(totalBudgeted)} budgeted</span>
                            </div>
                            {overBudgetCount > 0 && (
                                <div className="mt-3 flex items-center gap-2 text-rose-500 text-sm">
                                    <AlertTriangle className="w-4 h-4" />
                                    <span>{overBudgetCount} categor{overBudgetCount > 1 ? 'ies' : 'y'} over budget</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Budgets List */}
                {budgetProgress.map((progress) => {
                    const category = getCategoryDef(progress.budget.categoryId);
                    const colors = getProgressColor(progress);

                    return (
                        <Card key={progress.budget.id} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                    <div
                                        className="text-2xl p-2 rounded-lg"
                                        style={{ backgroundColor: category?.color + '20' }}
                                    >
                                        {category?.icon || '📦'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-medium truncate">{category?.name || progress.budget.categoryId}</h3>
                                            {progress.isOverBudget && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
                                                    Over Budget
                                                </span>
                                            )}
                                            {progress.isNearLimit && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500">
                                                    Near Limit
                                                </span>
                                            )}
                                        </div>

                                        {/* Progress bar */}
                                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${colors.bar}`}
                                                style={{ width: `${Math.min(progress.percentUsed, 100)}%` }}
                                            />
                                        </div>

                                        <div className="flex justify-between text-sm">
                                            <span className="text-muted-foreground">
                                                {formatCurrency(progress.spent)} / {formatCurrency(progress.budget.amount)}
                                            </span>
                                            <span className={`font-medium ${colors.text}`}>
                                                {progress.percentUsed.toFixed(0)}%
                                            </span>
                                        </div>

                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatCurrency(progress.remaining)} remaining • Alert at {progress.budget.alertThreshold}%
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <button
                                            onClick={() => openEditDialog(progress.budget)}
                                            className="p-2 rounded-full hover:bg-muted transition-colors"
                                        >
                                            <Pencil className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSelectedBudget(progress.budget);
                                                setIsDeleteOpen(true);
                                            }}
                                            className="p-2 rounded-full hover:bg-muted transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4 text-rose-500" />
                                        </button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}

                {/* Empty state */}
                {budgetProgress.length === 0 && (
                    <div className="text-center py-12 text-muted-foreground">
                        <Wallet className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="mb-2">No budget limits set</p>
                        <p className="text-sm mb-4">Set spending limits for categories to track your budget</p>
                        <Button variant="link" onClick={() => setIsAddOpen(true)}>
                            Create your first budget
                        </Button>
                    </div>
                )}
            </div>

            {/* Add Budget Dialog */}
            <Dialog open={isAddOpen} onOpenChange={(open) => {
                setIsAddOpen(open);
                if (!open) closeBudgetForm();
            }}>

                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Budget Limit</DialogTitle>
                        <DialogDescription>
                            Set a monthly spending limit for a category
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {/* Category selector */}
                        <div>
                            <label className="text-sm text-muted-foreground mb-2 block">Category</label>
                            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                {availableCategories.map((cat) => (
                                    <button
                                        key={cat.id}
                                        onClick={() => setNewCategory(cat.id)}
                                        className={`p-3 rounded-lg text-left flex items-center gap-2 ${newCategory === cat.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted hover:bg-muted/80'
                                            }`}
                                    >
                                        <span>{cat.icon}</span>
                                        <span className="text-sm truncate">{cat.name}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Monthly Limit (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={newAmount}
                                onChange={(e) => setNewAmount(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Alert Threshold (%)</label>
                            <Input
                                type="number"
                                placeholder="80"
                                value={newThreshold}
                                onChange={(e) => setNewThreshold(e.target.value)}
                                min="50"
                                max="100"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                You&apos;ll be warned when spending reaches this percentage
                            </p>
                        </div>

                        {createError && (
                            <p className="text-rose-500 text-sm">{createError}</p>
                        )}

                        <Button
                            onClick={handleCreate}
                            disabled={isCreating || !newCategory || !newAmount}
                            className="w-full"
                        >
                            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Budget'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Budget Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Budget</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {editBudget && (
                            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                <span className="text-xl">{getCategoryDef(editBudget.categoryId)?.icon}</span>
                                <span className="font-medium">{getCategoryDef(editBudget.categoryId)?.name}</span>
                            </div>
                        )}

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Monthly Limit (€)</label>
                            <Input
                                type="number"
                                placeholder="0.00"
                                value={editAmount}
                                onChange={(e) => setEditAmount(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="text-sm text-muted-foreground mb-1 block">Alert Threshold (%)</label>
                            <Input
                                type="number"
                                placeholder="80"
                                value={editThreshold}
                                onChange={(e) => setEditThreshold(e.target.value)}
                                min="50"
                                max="100"
                            />
                        </div>

                        <Button
                            onClick={handleUpdate}
                            disabled={isUpdating || !editAmount}
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
                        <DialogTitle>Delete Budget</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the budget for &quot;{getCategoryDef(selectedBudget?.categoryId || '')?.name}&quot;?
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
        </main>
    );
}
