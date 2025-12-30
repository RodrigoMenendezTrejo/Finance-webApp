// Firebase types for Sovereign Finance
import { Timestamp } from 'firebase/firestore';

// Account types
export type AccountType = 'asset' | 'liability' | 'receivable';

export interface Account {
    id: string;
    name: string;
    type: AccountType;
    balance: number;
    currency: string; // Default: 'EUR'
    icon?: string;
    category?: string; // For receivables/liabilities: reason (food, gas, etc.)
    isPaid?: boolean; // For liabilities: has this been paid?
    paidFromAccountId?: string; // For liabilities: which asset account was used to pay
    paidAt?: Timestamp; // For liabilities: when was it paid
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Transaction types
export type TransactionType = 'expense' | 'income' | 'transfer';

export interface TransactionSplit {
    accountId: string;
    amount: number; // Positive for credit, negative for debit
    isDebtSettlement?: boolean;
}

export interface Transaction {
    id: string;
    date: Timestamp;
    payee: string;
    category: string;
    notes: string;
    amount: number; // Total transaction amount
    type: TransactionType;
    splits: TransactionSplit[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Category with predefined + AI extendable
export interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
    isDefault: boolean; // true for predefined, false for AI-added
}

// Budget types
export interface Budget {
    id: string;
    categoryId: string;
    amount: number;
    period: 'monthly' | 'annual';
    currency: string;
}

// User profile
export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    photoURL?: string | null;
    defaultCurrency: string;
    createdAt: Timestamp;
}

// AI Receipt parsing result
export interface ParsedReceipt {
    merchant: string;
    date: string; // ISO string
    total: number;
    myShare: number;
    debtShare: number | null;
    debtorName: string | null;
    category: string;
    confidence: number;
}

// Net Worth History Snapshot
// Stored daily to track net worth over time
export interface NetWorthSnapshot {
    id: string;              // Document ID = "YYYY-MM-DD"
    date: string;            // "YYYY-MM-DD" format for easy querying
    assets: number;
    liabilities: number;
    receivables: number;
    netWorth: number;        // assets + receivables - liabilities
    createdAt: Timestamp;
}
