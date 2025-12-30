// Firebase Accounts Service
// CRUD operations for user accounts

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
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { Account, AccountType } from '@/types/firestore';

// Collection reference helper
const getAccountsRef = (userId: string) =>
    collection(db, 'users', userId, 'accounts');

// Get all accounts for a user
export async function getAccounts(userId: string): Promise<Account[]> {
    const accountsRef = getAccountsRef(userId);
    const q = query(accountsRef, orderBy('name'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Account[];
}

// Get accounts by type
export async function getAccountsByType(
    userId: string,
    type: AccountType
): Promise<Account[]> {
    const accountsRef = getAccountsRef(userId);
    const q = query(
        accountsRef,
        where('type', '==', type),
        orderBy('name')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Account[];
}

// Get single account
export async function getAccount(
    userId: string,
    accountId: string
): Promise<Account | null> {
    const accountRef = doc(db, 'users', userId, 'accounts', accountId);
    const snapshot = await getDoc(accountRef);

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data(),
    } as Account;
}

// Create new account
export async function createAccount(
    userId: string,
    data: {
        name: string;
        type: AccountType;
        balance?: number;
        currency?: string;
        icon?: string;
        category?: string; // For receivables: reason (food, gas, etc.)
        isGoalAccount?: boolean; // For assets: designate as goal account
    }
): Promise<string> {
    const accountsRef = getAccountsRef(userId);

    const newAccount: Record<string, unknown> = {
        name: data.name,
        type: data.type,
        balance: data.balance ?? 0,
        currency: data.currency ?? 'EUR',
        icon: data.icon,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    // Only add category if provided (Firestore rejects undefined)
    if (data.category) {
        newAccount.category = data.category;
    }

    // Only add isGoalAccount if true (for assets)
    if (data.isGoalAccount) {
        newAccount.isGoalAccount = true;
    }

    const docRef = await addDoc(accountsRef, newAccount);
    return docRef.id;
}

// Update account
export async function updateAccount(
    userId: string,
    accountId: string,
    data: Partial<Omit<Account, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const accountRef = doc(db, 'users', userId, 'accounts', accountId);

    await updateDoc(accountRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

// Update account balance by delta (positive adds, negative subtracts)
export async function updateAccountBalance(
    userId: string,
    accountId: string,
    delta: number
): Promise<void> {
    const account = await getAccount(userId, accountId);
    if (!account) throw new Error('Account not found');

    const newBalance = account.balance + delta;
    const accountRef = doc(db, 'users', userId, 'accounts', accountId);

    await updateDoc(accountRef, {
        balance: newBalance,
        updatedAt: serverTimestamp(),
    });
}

// Delete account
export async function deleteAccount(
    userId: string,
    accountId: string
): Promise<void> {
    const accountRef = doc(db, 'users', userId, 'accounts', accountId);
    await deleteDoc(accountRef);
}

// Get total by account type
export async function getTotalByType(
    userId: string,
    type: AccountType
): Promise<number> {
    const accounts = await getAccountsByType(userId, type);
    return accounts.reduce((sum, account) => sum + account.balance, 0);
}

// Calculate net worth (assets + receivables - liabilities)
export async function getNetWorth(userId: string): Promise<number> {
    const accounts = await getAccounts(userId);

    return accounts.reduce((netWorth, account) => {
        if (account.type === 'asset' || account.type === 'receivable') {
            return netWorth + account.balance;
        } else if (account.type === 'liability') {
            return netWorth - account.balance;
        }
        return netWorth;
    }, 0);
}

// Create default accounts for new users
export async function createDefaultAccounts(userId: string): Promise<void> {
    const defaultAccounts = [
        { name: 'Cash', type: 'asset' as AccountType, icon: '💵' },
        { name: 'Bank Account', type: 'asset' as AccountType, icon: '🏦' },
        { name: 'Credit Card', type: 'liability' as AccountType, icon: '💳' },
    ];

    for (const account of defaultAccounts) {
        await createAccount(userId, account);
    }
}

// Get unpaid liabilities
export async function getUnpaidLiabilities(userId: string): Promise<Account[]> {
    const liabilities = await getAccountsByType(userId, 'liability');
    return liabilities.filter(l => !l.isPaid);
}

// Mark a liability as paid and deduct from an asset account
export async function markLiabilityPaid(
    userId: string,
    liabilityId: string,
    payFromAccountId: string
): Promise<void> {
    // Get the liability
    const liability = await getAccount(userId, liabilityId);
    if (!liability) throw new Error('Liability not found');
    if (liability.type !== 'liability') throw new Error('Account is not a liability');
    if (liability.isPaid) throw new Error('Liability is already paid');

    // Get the asset account
    const assetAccount = await getAccount(userId, payFromAccountId);
    if (!assetAccount) throw new Error('Asset account not found');
    if (assetAccount.type !== 'asset') throw new Error('Can only pay from asset accounts');

    // Deduct from asset account
    const newAssetBalance = assetAccount.balance - liability.balance;
    await updateAccountBalance(userId, payFromAccountId, newAssetBalance);

    // Mark liability as paid
    await updateAccount(userId, liabilityId, {
        isPaid: true,
        paidFromAccountId: payFromAccountId,
        paidAt: Timestamp.now(),
        balance: 0, // Clear the balance since it's paid
    });
}

// Unmark a liability as paid (restore the debt)
export async function unmarkLiabilityPaid(
    userId: string,
    liabilityId: string,
    originalAmount: number
): Promise<void> {
    const liability = await getAccount(userId, liabilityId);
    if (!liability) throw new Error('Liability not found');
    if (!liability.isPaid) throw new Error('Liability is not paid');

    // If we know which account it was paid from, restore the balance
    if (liability.paidFromAccountId) {
        const assetAccount = await getAccount(userId, liability.paidFromAccountId);
        if (assetAccount) {
            const newAssetBalance = assetAccount.balance + originalAmount;
            await updateAccountBalance(userId, liability.paidFromAccountId, newAssetBalance);
        }
    }

    // Restore the liability
    await updateAccount(userId, liabilityId, {
        isPaid: false,
        paidFromAccountId: undefined,
        paidAt: undefined,
        balance: originalAmount,
    });
}
