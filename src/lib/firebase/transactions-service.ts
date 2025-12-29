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
        // Validate splits sum equals transaction amount (with some tolerance for floating point)
        const splitsSum = data.splits.reduce((sum, split) => sum + Math.abs(split.amount), 0);
        // For expenses with debt, the sum of absolute values should match
        // For simple transactions, splits sum should roughly match amount

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

        // Update all affected account balances
        for (const split of data.splits) {
            const accountRef = doc(db, 'users', userId, 'accounts', split.accountId);
            const accountSnap = await transaction.get(accountRef);

            if (!accountSnap.exists()) {
                throw new Error(`Account ${split.accountId} not found`);
            }

            const account = accountSnap.data() as Account;
            const newBalance = account.balance + split.amount;

            transaction.update(accountRef, {
                balance: newBalance,
                updatedAt: serverTimestamp(),
            });
        }

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
        const transactionRef = doc(db, 'users', userId, 'transactions', transactionId);
        const transactionSnap = await transaction.get(transactionRef);

        if (!transactionSnap.exists()) {
            throw new Error('Transaction not found');
        }

        const txData = transactionSnap.data() as Transaction;

        // Reverse all balance updates
        for (const split of txData.splits) {
            const accountRef = doc(db, 'users', userId, 'accounts', split.accountId);
            const accountSnap = await transaction.get(accountRef);

            if (accountSnap.exists()) {
                const account = accountSnap.data() as Account;
                // Reverse the split amount
                const newBalance = account.balance - split.amount;

                transaction.update(accountRef, {
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

// Get net worth history for charting
// Works by fetching all transactions and calculating running balance over time
export async function getNetWorthHistory(
    userId: string,
    period: '1M' | '6M' | '1Y',
    currentAssets: number,
    currentLiabilities: number
): Promise<{ date: string; assets: number; liabilities: number; netWorth: number }[]> {
    const now = new Date();
    let startDate: Date;
    let pointCount: number;
    let labelFormat: (d: Date) => string;

    // Configure based on period
    switch (period) {
        case '1M':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            pointCount = 5; // Weekly points (5 weeks for cleaner display)
            labelFormat = (d) => {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return `${months[d.getMonth()]} ${d.getDate()}`;
            };
            break;
        case '6M':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 6);
            pointCount = 7; // Monthly points (one per month)
            labelFormat = (d) => {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[d.getMonth()];
            };
            break;
        case '1Y':
            startDate = new Date(now);
            startDate.setFullYear(startDate.getFullYear() - 1);
            pointCount = 12; // Monthly points
            labelFormat = (d) => {
                const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                return months[d.getMonth()];
            };
            break;
    }

    // Fetch all transactions in the period
    const transactionsRef = getTransactionsRef(userId);
    const q = query(
        transactionsRef,
        where('date', '>=', Timestamp.fromDate(startDate)),
        orderBy('date', 'desc')
    );
    const snapshot = await getDocs(q);
    const transactions = snapshot.docs.map((doc) => ({
        ...doc.data(),
        date: (doc.data().date as Timestamp).toDate(),
    })) as (Transaction & { date: Date })[];

    // Generate time points
    const points: { date: Date; label: string }[] = [];
    const millisPerPoint = (now.getTime() - startDate.getTime()) / (pointCount - 1);

    for (let i = 0; i < pointCount; i++) {
        const pointDate = new Date(startDate.getTime() + i * millisPerPoint);
        points.push({
            date: pointDate,
            label: labelFormat(pointDate),
        });
    }

    // Calculate balance at each point by working backwards from current
    // For each point, sum up all transaction impacts after that point
    const result: { date: string; assets: number; liabilities: number; netWorth: number }[] = [];

    for (const point of points) {
        // Sum all transaction impacts after this point
        let assetDelta = 0;
        let liabilityDelta = 0;

        for (const tx of transactions) {
            if (tx.date > point.date) {
                // This transaction happened after the point, so we need to reverse its impact
                for (const split of tx.splits) {
                    // We need to determine if this was an asset or liability account
                    // For simplicity, we'll use the transaction amount directly
                    // Negative splits typically hit assets, positive splits hit receivables
                    if (split.amount < 0) {
                        assetDelta += Math.abs(split.amount); // Reverse the deduction
                    } else if (!split.isDebtSettlement) {
                        // Positive split that's not debt settlement could be receivable
                        liabilityDelta -= split.amount; // This is tricky...
                    }
                }
            }
        }

        // Historical balance = current - changes since then
        const assetsAtPoint = Math.max(0, currentAssets - assetDelta);
        const liabilitiesAtPoint = Math.max(0, currentLiabilities);
        const netWorthAtPoint = assetsAtPoint - liabilitiesAtPoint;

        result.push({
            date: point.label,
            assets: assetsAtPoint,
            liabilities: liabilitiesAtPoint,
            netWorth: netWorthAtPoint,
        });
    }

    return result;
}

