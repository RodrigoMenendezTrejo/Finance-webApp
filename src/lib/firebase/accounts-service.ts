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

// Update account balance directly
export async function updateAccountBalance(
    userId: string,
    accountId: string,
    newBalance: number
): Promise<void> {
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
