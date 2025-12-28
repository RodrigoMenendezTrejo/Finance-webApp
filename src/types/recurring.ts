// Recurring Transaction Types
// For subscriptions, regular income, and recurring bills

import { Timestamp } from 'firebase/firestore';

export type RecurringType = 'subscription' | 'income' | 'bill';
export type RecurringFrequency = 'weekly' | 'monthly' | 'yearly';

export interface RecurringTransaction {
    id: string;
    type: RecurringType;          // subscription, income, bill
    name: string;                  // "Netflix", "Salary", "Rent"
    amount: number;
    category: string;
    frequency: RecurringFrequency;
    dayOfMonth?: number;           // 1-31 for monthly/yearly
    dayOfWeek?: number;            // 0-6 for weekly (0 = Sunday)
    startDate?: Timestamp;         // When the recurring starts (for calendar selection)
    endDate?: Timestamp;           // Optional end date for temporary subscriptions
    accountId: string;             // Account to affect
    isActive: boolean;
    nextDueDate: Timestamp;
    lastProcessed?: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// Common subscription presets
export const SUBSCRIPTION_PRESETS = [
    { name: 'Netflix', icon: '🎬', amount: 12.99, category: 'subscriptions' },
    { name: 'Spotify', icon: '🎵', amount: 9.99, category: 'subscriptions' },
    { name: 'Amazon Prime', icon: '📦', amount: 4.99, category: 'subscriptions' },
    { name: 'Disney+', icon: '🏰', amount: 8.99, category: 'subscriptions' },
    { name: 'HBO Max', icon: '📺', amount: 9.99, category: 'subscriptions' },
    { name: 'YouTube Premium', icon: '▶️', amount: 11.99, category: 'subscriptions' },
    { name: 'Apple Music', icon: '🍎', amount: 10.99, category: 'subscriptions' },
    { name: 'iCloud', icon: '☁️', amount: 0.99, category: 'subscriptions' },
    { name: 'Google One', icon: '🔵', amount: 1.99, category: 'subscriptions' },
    { name: 'Gym', icon: '💪', amount: 30.00, category: 'health' },
];

// Common income presets
export const INCOME_PRESETS = [
    { name: 'Salary', icon: '💰', category: 'income' },
    { name: 'Freelance', icon: '💻', category: 'income' },
    { name: 'Side Hustle', icon: '🚀', category: 'income' },
    { name: 'Dividends', icon: '📈', category: 'income' },
    { name: 'Rental Income', icon: '🏠', category: 'income' },
];

// Common bill presets
export const BILL_PRESETS = [
    { name: 'Rent', icon: '🏠', category: 'housing' },
    { name: 'Electricity', icon: '⚡', category: 'utilities' },
    { name: 'Water', icon: '💧', category: 'utilities' },
    { name: 'Gas', icon: '🔥', category: 'utilities' },
    { name: 'Internet', icon: '📶', category: 'utilities' },
    { name: 'Phone', icon: '📱', category: 'utilities' },
    { name: 'Insurance', icon: '🛡️', category: 'insurance' },
];
