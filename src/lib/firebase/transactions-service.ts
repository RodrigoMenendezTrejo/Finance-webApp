// Firebase Transactions Service
// Transaction operations with atomic balance updates

import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    serverTimestamp,
    runTransaction,
    Timestamp,
    DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { Transaction, TransactionSplit, Account } from '@/types/firestore';

// Collection reference helper
const getTransactionsRef = (userId: string) =>
    collection(db, 'users', userId, 'transactions');

// Get transactions with pagination
export async function getTransactions(
    userId: string,
    options?: {
        limit?: number;
        startAfterDoc?: DocumentSnapshot;
        category?: string;
        startDate?: Date;
        endDate?: Date;
    }
): Promise<{ transactions: Transaction[]; lastDoc: DocumentSnapshot | null }> {
    const transactionsRef = getTransactionsRef(userId);
    let q = query(transactionsRef, orderBy('date', 'desc'));

    if (options?.category) {
        q = query(q, where('category', '==', options.category));
    }

    if (options?.startDate) {
        q = query(q, where('date', '>=', Timestamp.fromDate(options.startDate)));
    }

    if (options?.endDate) {
        q = query(q, where('date', '<=', Timestamp.fromDate(options.endDate)));
    }

    if (options?.startAfterDoc) {
        q = query(q, startAfter(options.startAfterDoc));
    }

    q = query(q, limit(options?.limit ?? 20));

    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Transaction[];

    const lastDoc = snapshot.docs[snapshot.docs.length - 1] || null;

    return { transactions, lastDoc };
}

// Get single transaction
export async function getTransaction(
    userId: string,
    transactionId: string
): Promise<Transaction | null> {
    const transactionRef = doc(db, 'users', userId, 'transactions', transactionId);
    const snapshot = await getDoc(transactionRef);

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data(),
    } as Transaction;
}

// Update transaction (only payee name, does not affect balances)
export async function updateTransaction(
    userId: string,
    transactionId: string,
    data: { payee: string }
): Promise<void> {
    const transactionRef = doc(db, 'users', userId, 'transactions', transactionId);
    await updateDoc(transactionRef, {
        payee: data.payee,
        updatedAt: serverTimestamp(),
    });
}

// Create transaction with atomic balance updates
export async function createTransaction(
    userId: string,
    data: {
        date: Date;
        payee: string;
        category: string;
        notes?: string;
        amount: number;
        type: 'expense' | 'income' | 'transfer';
        splits: TransactionSplit[];
    }
): Promise<string> {
    return runTransaction(db, async (transaction) => {
        // PHASE 1: ALL READS FIRST
        // Collect all account references and read them
        const accountReads: {
            ref: ReturnType<typeof doc>;
            split: TransactionSplit;
            snapshot?: Awaited<ReturnType<typeof transaction.get>>;
            currentBalance?: number;
        }[] = [];

        for (const split of data.splits) {
            const accountRef = doc(db, 'users', userId, 'accounts', split.accountId);
            accountReads.push({ ref: accountRef, split });
        }

        // Perform all reads
        for (const accountRead of accountReads) {
            const accountSnap = await transaction.get(accountRead.ref);
            if (!accountSnap.exists()) {
                throw new Error(`Account ${accountRead.split.accountId} not found`);
            }
            accountRead.snapshot = accountSnap;
            accountRead.currentBalance = (accountSnap.data() as Account).balance;
        }

        // PHASE 2: ALL WRITES AFTER READS
        // Update all affected account balances
        for (const accountRead of accountReads) {
            const newBalance = accountRead.currentBalance! + accountRead.split.amount;
            transaction.update(accountRead.ref, {
                balance: newBalance,
                updatedAt: serverTimestamp(),
            });
        }

        // Create transaction document
        const transactionsRef = getTransactionsRef(userId);
        const newTransactionRef = doc(transactionsRef);

        const transactionData = {
            date: Timestamp.fromDate(data.date),
            payee: data.payee,
            category: data.category,
            notes: data.notes || '',
            amount: data.amount,
            type: data.type,
            splits: data.splits,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };

        transaction.set(newTransactionRef, transactionData);

        return newTransactionRef.id;
    });
}

// Create expense with optional debt tracking
export async function createExpenseWithDebt(
    userId: string,
    data: {
        date: Date;
        payee: string;
        category: string;
        notes?: string;
        totalAmount: number;
        sourceAccountId: string; // Where money comes from
        myShare: number;
        debtorAccountId?: string; // Receivable account for debtor
        debtShare?: number;
    }
): Promise<string> {
    const splits: TransactionSplit[] = [
        // Money leaving source account
        {
            accountId: data.sourceAccountId,
            amount: -data.totalAmount,
        },
    ];

    // If there's a debt component
    if (data.debtorAccountId && data.debtShare && data.debtShare > 0) {
        // Add to receivable account
        splits.push({
            accountId: data.debtorAccountId,
            amount: data.debtShare,
            isDebtSettlement: false,
        });
    }

    return createTransaction(userId, {
        date: data.date,
        payee: data.payee,
        category: data.category,
        notes: data.notes,
        amount: data.myShare, // User's actual expense
        type: 'expense',
        splits,
    });
}

// Delete transaction and reverse balance updates
export async function deleteTransaction(
    userId: string,
    transactionId: string
): Promise<void> {
    return runTransaction(db, async (transaction) => {
        // PHASE 1: ALL READS FIRST
        const transactionRef = doc(db, 'users', userId, 'transactions', transactionId);
        const transactionSnap = await transaction.get(transactionRef);

        if (!transactionSnap.exists()) {
            throw new Error('Transaction not found');
        }

        const txData = transactionSnap.data() as Transaction;

        // Read all account balances first
        const accountReads: {
            ref: ReturnType<typeof doc>;
            split: TransactionSplit;
            currentBalance?: number;
            exists: boolean;
        }[] = [];

        for (const split of txData.splits) {
            const accountRef = doc(db, 'users', userId, 'accounts', split.accountId);
            const accountSnap = await transaction.get(accountRef);
            accountReads.push({
                ref: accountRef,
                split,
                currentBalance: accountSnap.exists() ? (accountSnap.data() as Account).balance : 0,
                exists: accountSnap.exists(),
            });
        }

        // PHASE 2: ALL WRITES AFTER READS
        // Reverse all balance updates
        for (const accountRead of accountReads) {
            if (accountRead.exists) {
                const newBalance = accountRead.currentBalance! - accountRead.split.amount;
                transaction.update(accountRead.ref, {
                    balance: newBalance,
                    updatedAt: serverTimestamp(),
                });
            }
        }

        transaction.delete(transactionRef);
    });
}

// Get spending by category for a period
export async function getSpendingByCategory(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<Record<string, number>> {
    const transactionsRef = getTransactionsRef(userId);
    const q = query(
        transactionsRef,
        where('type', '==', 'expense'),
        where('date', '>=', Timestamp.fromDate(startDate)),
        where('date', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(q);
    const spending: Record<string, number> = {};

    snapshot.docs.forEach((doc) => {
        const tx = doc.data() as Transaction;
        const category = tx.category || 'Other';
        spending[category] = (spending[category] || 0) + tx.amount;
    });

    return spending;
}

// Get total spending for a period
export async function getTotalSpending(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<number> {
    const spending = await getSpendingByCategory(userId, startDate, endDate);
    return Object.values(spending).reduce((sum, amount) => sum + amount, 0);
}

// Create transfer between accounts
export async function createTransfer(
    userId: string,
    data: {
        fromAccountId: string;
        toAccountId: string;
        amount: number;
        notes?: string;
    }
): Promise<string> {
    return createTransaction(userId, {
        date: new Date(),
        payee: 'Transfer',
        category: 'transfer',
        notes: data.notes || '',
        amount: data.amount,
        type: 'transfer',
        splits: [
            { accountId: data.fromAccountId, amount: -data.amount },
            { accountId: data.toAccountId, amount: data.amount },
        ],
    });
}
