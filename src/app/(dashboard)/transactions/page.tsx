'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Filter, Loader2, Trash2, X, Check, List, BarChart3 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { MerchantLogo } from '@/components/ui/merchant-logo';
import { SwipeableRow } from '@/components/ui/swipeable-row';
import { TransactionEvolutionChart } from '@/components/charts/transaction-evolution-chart';
import { getCategoryById } from '@/lib/categories';
import { useAuth } from '@/lib/firebase/auth-context';
import { getTransactions, deleteTransaction, updateTransaction } from '@/lib/firebase/transactions-service';
import { Transaction } from '@/types/firestore';

type FilterType = 'all' | 'income' | 'expense' | 'transfer';
type ViewMode = 'list' | 'chart';

export default function TransactionsPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [isFilterOpen, setIsFilterOpen] = useState(false);

    // Edit/Delete state
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [editedPayee, setEditedPayee] = useState('');
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Fetch transactions
    useEffect(() => {
        async function fetchTransactions() {
            if (!user) return;
            try {
                const { transactions: data } = await getTransactions(user.uid, { limit: 100 });
                setTransactions(data);
            } catch (error) {
                console.error('Error fetching transactions:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchTransactions();
    }, [user]);

    const refreshTransactions = async () => {
        if (!user) return;
        const { transactions: data } = await getTransactions(user.uid, { limit: 100 });
        setTransactions(data);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(value);
    };

    const formatDate = (date: Date) => {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('es-ES', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
            });
        }
    };

    const openEditDialog = (tx: Transaction) => {
        setSelectedTransaction(tx);
        setEditedPayee(tx.payee);
        setIsEditOpen(true);
    };

    const openDeleteConfirm = (tx: Transaction) => {
        setSelectedTransaction(tx);
        setIsDeleteOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!user || !selectedTransaction || !editedPayee.trim()) return;

        setIsSaving(true);
        try {
            await updateTransaction(user.uid, selectedTransaction.id, {
                payee: editedPayee.trim(),
            });
            await refreshTransactions();
            setIsEditOpen(false);
            setSelectedTransaction(null);
        } catch (error) {
            console.error('Error updating transaction:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTransaction = async () => {
        if (!user || !selectedTransaction) return;

        setIsDeleting(true);
        try {
            await deleteTransaction(user.uid, selectedTransaction.id);
            await refreshTransactions();
            setIsDeleteOpen(false);
            setIsEditOpen(false);
            setSelectedTransaction(null);
        } catch (error) {
            console.error('Error deleting transaction:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Convert Firestore timestamps to dates and group
    const processedTransactions = transactions
        .map(tx => ({
            ...tx,
            dateObj: tx.date.toDate(),
        }))
        .filter(tx => {
            // Apply type filter
            if (filterType !== 'all' && tx.type !== filterType) return false;
            // Apply search filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return tx.payee.toLowerCase().includes(query) ||
                    tx.category.toLowerCase().includes(query);
            }
            return true;
        });

    // Group transactions by date
    const groupedTransactions = processedTransactions.reduce((groups, tx) => {
        const dateKey = tx.dateObj.toDateString();
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(tx);
        return groups;
    }, {} as Record<string, typeof processedTransactions>);

    // Calculate daily totals
    const getDailyStats = (txs: typeof processedTransactions) => {
        const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return { income, expense };
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen flex flex-col">
            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b border-border/50">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-xl font-bold">Transactions</h1>

                    {/* Segmented control group */}
                    <div className="ml-auto flex gap-1 bg-muted/50 p-1 rounded-lg">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list'
                                ? 'bg-card text-foreground shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('chart')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'chart'
                                ? 'bg-card text-emerald-500 shadow-sm'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <BarChart3 className="w-4 h-4" />
                        </button>
                        <div className="w-px bg-border/50 mx-1" />
                        <button
                            onClick={() => setIsFilterOpen(true)}
                            className={`p-2 rounded-md transition-all ${filterType !== 'all'
                                ? 'bg-primary/20 text-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search transactions..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
            </header>

            {/* Chart drawer - slides down when active */}
            <div
                className={`overflow-hidden transition-all duration-300 ease-out ${viewMode === 'chart' ? 'max-h-[320px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
            >
                <div className="p-4 pb-2">
                    <TransactionEvolutionChart transactions={transactions} />
                </div>
            </div>

            {/* Transactions list */}
            <ScrollArea className="flex-1">
                <div className={`p-4 space-y-6 transition-opacity duration-200 ${viewMode === 'chart' ? 'opacity-60' : 'opacity-100'
                    }`}>
                    {Object.entries(groupedTransactions)
                        .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
                        .map(([dateKey, txs]) => {
                            const stats = getDailyStats(txs);
                            const hasIncome = stats.income > 0;
                            const hasExpense = stats.expense > 0;

                            return (
                                <div key={dateKey}>
                                    {/* Date header with daily summary */}
                                    <div className="py-2 mb-3">
                                        <div className="flex items-center justify-between">
                                            <h2 className="text-sm font-bold text-foreground">
                                                {formatDate(new Date(dateKey))}
                                            </h2>
                                            <div className="flex items-center gap-3 text-sm">
                                                {hasIncome && (
                                                    <span className="text-emerald-500 font-semibold">
                                                        +{formatCurrency(stats.income)}
                                                    </span>
                                                )}
                                                {hasExpense && (
                                                    <span className="text-rose-400 font-semibold">
                                                        -{formatCurrency(stats.expense)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transaction rows */}
                                    <div className="space-y-2">
                                        {txs.map((tx) => {
                                            const category = getCategoryById(tx.category);
                                            const isIncome = tx.type === 'income';

                                            return (
                                                <SwipeableRow
                                                    key={tx.id}
                                                    onEdit={() => openEditDialog(tx)}
                                                    onDelete={() => openDeleteConfirm(tx)}
                                                >
                                                    <div
                                                        onClick={() => openEditDialog(tx)}
                                                        className="flex items-center gap-3 p-3 rounded-xl bg-card hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                                                    >
                                                        {/* Merchant logo - fixed size container */}
                                                        <div className="shrink-0">
                                                            <MerchantLogo
                                                                name={tx.payee}
                                                                category={tx.category}
                                                                isIncome={isIncome}
                                                            />
                                                        </div>

                                                        {/* Details */}
                                                        <div className="flex-1 min-w-0">
                                                            <p className="font-semibold text-foreground truncate">
                                                                {tx.payee}
                                                            </p>
                                                            <span className="text-xs text-muted-foreground">
                                                                {category?.name || tx.category || 'Other'}
                                                            </span>
                                                        </div>

                                                        {/* Amount */}
                                                        <div className="text-right pr-8 md:pr-0">
                                                            <span
                                                                className={`text-lg font-bold ${isIncome
                                                                    ? 'text-emerald-500'
                                                                    : 'text-foreground'
                                                                    }`}
                                                            >
                                                                {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </SwipeableRow>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                    {transactions.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No transactions yet</p>
                            <p className="text-sm mt-1">Use the + button to add your first one</p>
                        </div>
                    )}

                    {transactions.length > 0 && Object.keys(groupedTransactions).length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            No transactions match your search
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Filter Sheet */}
            <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <SheetContent side="bottom" className="h-auto rounded-t-2xl">
                    <SheetHeader>
                        <SheetTitle>Filter Transactions</SheetTitle>
                    </SheetHeader>
                    <div className="py-4 space-y-3">
                        {(['all', 'income', 'expense', 'transfer'] as FilterType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => {
                                    setFilterType(type);
                                    setIsFilterOpen(false);
                                }}
                                className={`w-full p-3 rounded-xl text-left font-medium transition-colors flex items-center justify-between ${filterType === type
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted hover:bg-muted/80'
                                    }`}
                            >
                                <span className="capitalize">{type === 'all' ? 'All Transactions' : type}</span>
                                {filterType === type && <Check className="w-5 h-5" />}
                            </button>
                        ))}
                    </div>
                </SheetContent>
            </Sheet>

            {/* Edit Transaction Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Transaction</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        {/* Logo preview - updates live as you type */}
                        <div className="flex justify-center">
                            <MerchantLogo
                                name={editedPayee || ''}
                                category={selectedTransaction?.category}
                                isIncome={selectedTransaction?.type === 'income'}
                                size="lg"
                            />
                        </div>

                        {/* Editable payee name */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">
                                Merchant / Payee Name
                            </label>
                            <Input
                                value={editedPayee}
                                onChange={(e) => setEditedPayee(e.target.value)}
                                placeholder="e.g., Netflix, Spotify, Salary..."
                                className="text-lg"
                            />
                        </div>

                        {/* Read-only details */}
                        <div className="space-y-2 text-sm bg-muted/50 rounded-xl p-4">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount</span>
                                <span className={`font-bold ${selectedTransaction?.type === 'income'
                                        ? 'text-emerald-500'
                                        : 'text-foreground'
                                    }`}>
                                    {selectedTransaction?.type === 'income' ? '+' : '-'}
                                    {formatCurrency(selectedTransaction?.amount || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Date</span>
                                <span className="font-medium">
                                    {selectedTransaction?.date.toDate().toLocaleDateString('es-ES', {
                                        day: 'numeric',
                                        month: 'short',
                                        year: 'numeric'
                                    })}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Category</span>
                                <span className="font-medium capitalize">
                                    {selectedTransaction?.category}
                                </span>
                            </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsDeleteOpen(true)}
                                className="flex-1"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                            </Button>
                            <Button
                                onClick={handleSaveEdit}
                                disabled={isSaving || !editedPayee.trim() || editedPayee === selectedTransaction?.payee}
                                className="flex-1"
                            >
                                {isSaving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    'Save Changes'
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Transaction</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this transaction?
                            This will also reverse the balance changes to affected accounts.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteTransaction}
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
