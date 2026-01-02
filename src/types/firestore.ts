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
    isGoalAccount?: boolean; // Designate as a savings/goal account
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

// Bill split participant (for splitting expenses with friends)
export interface SplitParticipant {
    name: string;           // Person's name: "Carlos", "María"
    amount: number;         // How much they owe you
    isPaid: boolean;        // Have they paid you back?
    paidAt?: Timestamp;     // When they paid (if isPaid)
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
    splitWith?: SplitParticipant[]; // Friends who owe you for this expense
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
    autoSuggestGoals?: boolean; // Suggest allocations on income (default true)
    createdAt: Timestamp;
}

// Savings Goal
export interface SavingsGoal {
    id: string;
    name: string;                   // "Vacation", "Emergency Fund"
    targetAmount: number;
    currentAmount: number;          // Allocated so far
    deadline?: Timestamp;           // Optional target date
    linkedAccountId?: string;       // Link to a goal account (optional)
    priority: number;               // 1 = highest priority
    icon?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
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

