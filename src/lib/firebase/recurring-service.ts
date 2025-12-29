// Firebase Recurring Transactions Service
// CRUD operations and auto-processing for recurring transactions

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
import { RecurringTransaction, RecurringType, RecurringFrequency } from '@/types/recurring';
import { createTransaction } from './transactions-service';

// Collection reference helper
const getRecurringRef = (userId: string) =>
    collection(db, 'users', userId, 'recurring');

// Get all recurring transactions
export async function getRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    const recurringRef = getRecurringRef(userId);
    const q = query(recurringRef, orderBy('nextDueDate'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as RecurringTransaction[];
}

// Get recurring by type
export async function getRecurringByType(
    userId: string,
    type: RecurringType
): Promise<RecurringTransaction[]> {
    const recurringRef = getRecurringRef(userId);
    const q = query(
        recurringRef,
        where('type', '==', type),
        where('isActive', '==', true),
        orderBy('name')
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as RecurringTransaction[];
}

// Create recurring transaction
export async function createRecurring(
    userId: string,
    data: {
        type: RecurringType;
        name: string;
        amount: number;
        category: string;
        frequency: RecurringFrequency;
        dayOfMonth?: number;
        dayOfWeek?: number;
        startDate?: Date;  // Optional start date for calendar selection
        endDate?: Date;    // Optional end date for temporary subscriptions
        accountId: string;
    }
): Promise<string> {
    const recurringRef = getRecurringRef(userId);

    // Use startDate if provided, otherwise calculate from today
    const baseDate = data.startDate || new Date();
    const dayOfMonth = data.startDate ? data.startDate.getDate() : data.dayOfMonth;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // If startDate is provided and is today or in the future, use it directly
    // Otherwise, calculate the next due date from the base date
    let nextDueDate: Date;
    if (data.startDate && data.startDate >= today) {
        // Use the provided start date directly as the first due date
        nextDueDate = new Date(data.startDate);
    } else {
        // Calculate next due date (for items starting in the past or without a start date)
        nextDueDate = calculateNextDueDate(
            baseDate,
            data.frequency,
            dayOfMonth,
            data.dayOfWeek
        );
    }

    const newRecurring: Record<string, unknown> = {
        type: data.type,
        name: data.name,
        amount: data.amount,
        category: data.category,
        frequency: data.frequency,
        accountId: data.accountId,
        isActive: true,
        nextDueDate: Timestamp.fromDate(nextDueDate),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    // Only add optional fields if they have values (Firestore rejects undefined)
    if (dayOfMonth !== undefined) {
        newRecurring.dayOfMonth = dayOfMonth;
    }
    if (data.dayOfWeek !== undefined) {
        newRecurring.dayOfWeek = data.dayOfWeek;
    }

    // Store startDate if provided
    if (data.startDate) {
        newRecurring.startDate = Timestamp.fromDate(data.startDate);
    }

    // Store endDate if provided
    if (data.endDate) {
        newRecurring.endDate = Timestamp.fromDate(data.endDate);
    }

    const docRef = await addDoc(recurringRef, newRecurring);
    return docRef.id;
}

// Update recurring transaction
export async function updateRecurring(
    userId: string,
    recurringId: string,
    data: Partial<Omit<RecurringTransaction, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const recurringRef = doc(db, 'users', userId, 'recurring', recurringId);

    await updateDoc(recurringRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

// Delete recurring transaction
export async function deleteRecurring(
    userId: string,
    recurringId: string
): Promise<void> {
    const recurringRef = doc(db, 'users', userId, 'recurring', recurringId);
    await deleteDoc(recurringRef);
}

// Toggle active status
export async function toggleRecurringActive(
    userId: string,
    recurringId: string,
    isActive: boolean
): Promise<void> {
    await updateRecurring(userId, recurringId, { isActive });
}

// Calculate next due date based on frequency
function calculateNextDueDate(
    fromDate: Date,
    frequency: RecurringFrequency,
    dayOfMonth?: number,
    dayOfWeek?: number
): Date {
    const next = new Date(fromDate);

    switch (frequency) {
        case 'weekly':
            // Find next occurrence of dayOfWeek
            const targetDay = dayOfWeek ?? 1; // Default to Monday
            const currentDay = next.getDay();
            const daysUntil = (targetDay - currentDay + 7) % 7 || 7;
            next.setDate(next.getDate() + daysUntil);
            break;

        case 'monthly':
            // Set to dayOfMonth of next month
            const targetDate = dayOfMonth ?? 1;
            next.setMonth(next.getMonth() + 1);
            next.setDate(Math.min(targetDate, getDaysInMonth(next.getFullYear(), next.getMonth())));
            break;

        case 'yearly':
            // Same day next year
            next.setFullYear(next.getFullYear() + 1);
            if (dayOfMonth) {
                next.setDate(Math.min(dayOfMonth, getDaysInMonth(next.getFullYear(), next.getMonth())));
            }
            break;
    }

    return next;
}

function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month + 1, 0).getDate();
}

// Process due recurring transactions
export async function processDueRecurring(userId: string): Promise<number> {
    const all = await getRecurringTransactions(userId);
    const now = new Date();
    let processedCount = 0;

    for (const recurring of all) {
        if (!recurring.isActive) continue;

        const dueDate = recurring.nextDueDate.toDate();

        // Check if due (due date is today or in the past)
        if (dueDate <= now) {
            try {
                // Create the transaction
                const isIncome = recurring.type === 'income';
                await createTransaction(userId, {
                    date: dueDate,
                    payee: recurring.name,
                    category: recurring.category,
                    notes: `Auto-generated from recurring: ${recurring.name}`,
                    amount: recurring.amount,
                    type: isIncome ? 'income' : 'expense',
                    splits: [
                        {
                            accountId: recurring.accountId,
                            amount: isIncome ? recurring.amount : -recurring.amount,
                        },
                    ],
                });

                // Calculate and update next due date
                const nextDue = calculateNextDueDate(
                    dueDate,
                    recurring.frequency,
                    recurring.dayOfMonth,
                    recurring.dayOfWeek
                );

                await updateRecurring(userId, recurring.id, {
                    nextDueDate: Timestamp.fromDate(nextDue),
                    lastProcessed: Timestamp.fromDate(now),
                });

                processedCount++;
            } catch (error) {
                console.error(`Error processing recurring ${recurring.id}:`, error);
            }
        }
    }

    return processedCount;
}

// Get monthly total for subscriptions/bills
export async function getMonthlyRecurringTotal(
    userId: string,
    type: RecurringType
): Promise<number> {
    const items = await getRecurringByType(userId, type);

    return items.reduce((total, item) => {
        let monthlyAmount = item.amount;

        if (item.frequency === 'weekly') {
            monthlyAmount = item.amount * 4.33; // Average weeks per month
        } else if (item.frequency === 'yearly') {
            monthlyAmount = item.amount / 12;
        }

        return total + monthlyAmount;
    }, 0);
}

// Calculate total amount spent on a recurring item since it started
export function calculateTotalSpent(item: RecurringTransaction): number {
    const startDate = item.startDate?.toDate() || item.createdAt.toDate();
    const endDate = item.endDate?.toDate() || new Date();
    const now = new Date();

    // Use the earlier of endDate or now
    const effectiveEndDate = endDate < now ? endDate : now;

    // If subscription hasn't started yet
    if (startDate > effectiveEndDate) return 0;

    const msInDay = 1000 * 60 * 60 * 24;
    const daysDiff = Math.floor((effectiveEndDate.getTime() - startDate.getTime()) / msInDay);

    let occurrences = 0;

    switch (item.frequency) {
        case 'weekly':
            occurrences = Math.floor(daysDiff / 7) + 1;
            break;
        case 'monthly':
            const monthsDiff =
                (effectiveEndDate.getFullYear() - startDate.getFullYear()) * 12 +
                (effectiveEndDate.getMonth() - startDate.getMonth()) + 1;
            occurrences = Math.max(1, monthsDiff);
            break;
        case 'yearly':
            const yearsDiff = effectiveEndDate.getFullYear() - startDate.getFullYear() + 1;
            occurrences = Math.max(1, yearsDiff);
            break;
    }

    return occurrences * item.amount;
}
