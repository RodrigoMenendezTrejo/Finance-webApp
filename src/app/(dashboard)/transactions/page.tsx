'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Filter, ArrowUpRight, ArrowDownLeft, Loader2, Trash2, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { getCategoryById, DEFAULT_CATEGORIES } from '@/lib/categories';
import { useAuth } from '@/lib/firebase/auth-context';
import { getTransactions, deleteTransaction } from '@/lib/firebase/transactions-service';
import { Transaction } from '@/types/firestore';

export default function TransactionsPage() {
    const router = useRouter();
    const { user } = useAuth();

    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit/Delete state
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Edit form state
    const [editPayee, setEditPayee] = useState('');
    const [editAmount, setEditAmount] = useState('');
    const [editCategory, setEditCategory] = useState('');

    // Fetch transactions
    useEffect(() => {
        async function fetchTransactions() {
            if (!user) return;
            try {
                const { transactions: data } = await getTransactions(user.uid, { limit: 50 });
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
        const { transactions: data } = await getTransactions(user.uid, { limit: 50 });
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
        setEditPayee(tx.payee);
        setEditAmount(tx.amount.toString());
        setEditCategory(tx.category);
        setIsEditOpen(true);
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
    const processedTransactions = transactions.map(tx => ({
        ...tx,
        dateObj: tx.date.toDate(),
    }));

    // Group transactions by date
    const groupedTransactions = processedTransactions.reduce((groups, tx) => {
        const dateKey = tx.dateObj.toDateString();
        if (!groups[dateKey]) {
            groups[dateKey] = [];
        }
        groups[dateKey].push(tx);
        return groups;
    }, {} as Record<string, typeof processedTransactions>);

    // Filter by search
    const filteredGroups = Object.entries(groupedTransactions).filter(([, txs]) =>
        txs.some(
            (tx) =>
                tx.payee.toLowerCase().includes(searchQuery.toLowerCase()) ||
                tx.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

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
                    <button className="ml-auto p-2 rounded-full hover:bg-muted transition-colors">
                        <Filter className="w-5 h-5" />
                    </button>
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

            {/* Transactions list */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {filteredGroups.map(([dateKey, txs]) => (
                        <div key={dateKey}>
                            <h2 className="text-sm font-medium text-muted-foreground mb-2">
                                {formatDate(new Date(dateKey))}
                            </h2>
                            <div className="space-y-2">
                                {txs.map((tx) => {
                                    const category = getCategoryById(tx.category);
                                    const isIncome = tx.type === 'income';

                                    return (
                                        <div
                                            key={tx.id}
                                            onClick={() => openEditDialog(tx)}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                                        >
                                            {/* Category icon */}
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center text-lg"
                                                style={{ backgroundColor: (category?.color || '#95A5A6') + '20' }}
                                            >
                                                {category?.icon || '📦'}
                                            </div>

                                            {/* Details */}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate">{tx.payee}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {category?.name || tx.category || 'Other'}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Amount */}
                                            <div className="flex items-center gap-2">
                                                <div className="text-right">
                                                    <div className="flex items-center gap-1">
                                                        {isIncome ? (
                                                            <ArrowDownLeft className="w-3 h-3 text-emerald-500" />
                                                        ) : (
                                                            <ArrowUpRight className="w-3 h-3 text-rose-500" />
                                                        )}
                                                        <span
                                                            className={`font-bold ${isIncome ? 'text-emerald-500' : 'text-foreground'
                                                                }`}
                                                        >
                                                            {isIncome ? '+' : '-'}{formatCurrency(tx.amount)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Pencil className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {transactions.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            <p>No transactions yet</p>
                            <p className="text-sm mt-1">Use the + button to add your first one</p>
                        </div>
                    )}

                    {transactions.length > 0 && filteredGroups.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground">
                            No transactions match your search
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Edit Transaction Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Transaction Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                        <div className="p-4 rounded-xl bg-muted space-y-3">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Payee</span>
                                <span className="font-medium">{selectedTransaction?.payee}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount</span>
                                <span className={`font-bold ${selectedTransaction?.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {selectedTransaction?.type === 'income' ? '+' : '-'}
                                    {formatCurrency(selectedTransaction?.amount || 0)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Category</span>
                                <span className="font-medium">{selectedTransaction?.category}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Date</span>
                                <span className="font-medium">
                                    {selectedTransaction?.date.toDate().toLocaleDateString()}
                                </span>
                            </div>
                            {selectedTransaction?.notes && (
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Notes</span>
                                    <span className="font-medium">{selectedTransaction.notes}</span>
                                </div>
                            )}
                        </div>

                        {/* Delete button */}
                        <Button
                            variant="destructive"
                            onClick={() => setIsDeleteOpen(true)}
                            className="w-full"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Transaction
                        </Button>
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
