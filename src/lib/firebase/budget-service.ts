// Firebase Budget Service
// CRUD operations for user budgets with spending tracking

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
import { Budget } from '@/types/firestore';
import { getSpendingByCategory } from './transactions-service';

// Collection reference helper
const getBudgetsRef = (userId: string) =>
    collection(db, 'users', userId, 'budgets');

// Get all budgets for a user
export async function getBudgets(userId: string): Promise<Budget[]> {
    const budgetsRef = getBudgetsRef(userId);
    const q = query(budgetsRef, orderBy('categoryId'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Budget[];
}

// Get a single budget by ID
export async function getBudget(
    userId: string,
    budgetId: string
): Promise<Budget | null> {
    const budgetRef = doc(db, 'users', userId, 'budgets', budgetId);
    const snapshot = await getDoc(budgetRef);

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data(),
    } as Budget;
}

// Get budget by category
export async function getBudgetByCategory(
    userId: string,
    categoryId: string
): Promise<Budget | null> {
    const budgetsRef = getBudgetsRef(userId);
    const q = query(budgetsRef, where('categoryId', '==', categoryId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    return {
        id: doc.id,
        ...doc.data(),
    } as Budget;
}

// Create a new budget
export async function createBudget(
    userId: string,
    data: {
        categoryId: string;
        amount: number;
        period?: 'monthly' | 'annual';
        currency?: string;
        alertThreshold?: number;
    }
): Promise<string> {
    const budgetsRef = getBudgetsRef(userId);

    // Check if budget for this category already exists
    const existing = await getBudgetByCategory(userId, data.categoryId);
    if (existing) {
        throw new Error('Budget for this category already exists');
    }

    const newBudget = {
        categoryId: data.categoryId,
        amount: data.amount,
        period: data.period ?? 'monthly',
        currency: data.currency ?? 'EUR',
        alertThreshold: data.alertThreshold ?? 80,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(budgetsRef, newBudget);
    return docRef.id;
}

// Update a budget
export async function updateBudget(
    userId: string,
    budgetId: string,
    data: Partial<Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
    const budgetRef = doc(db, 'users', userId, 'budgets', budgetId);

    await updateDoc(budgetRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

// Delete a budget
export async function deleteBudget(
    userId: string,
    budgetId: string
): Promise<void> {
    const budgetRef = doc(db, 'users', userId, 'budgets', budgetId);
    await deleteDoc(budgetRef);
}

// Budget progress data structure
export interface BudgetProgress {
    budget: Budget;
    spent: number;
    remaining: number;
    percentUsed: number;
    isOverBudget: boolean;
    isNearLimit: boolean; // true when >= alertThreshold
}

// Get spending progress for all budgets in current period
export async function getBudgetProgress(
    userId: string
): Promise<BudgetProgress[]> {
    const budgets = await getBudgets(userId);
    if (budgets.length === 0) return [];

    // Get date range for current month
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Get spending by category
    const spendingByCategory = await getSpendingByCategory(userId, startDate, endDate);

    // Calculate progress for each budget
    return budgets.map((budget) => {
        const spent = spendingByCategory[budget.categoryId] || 0;
        const remaining = Math.max(0, budget.amount - spent);
        const percentUsed = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        return {
            budget,
            spent,
            remaining,
            percentUsed,
            isOverBudget: spent > budget.amount,
            isNearLimit: percentUsed >= budget.alertThreshold && !(spent > budget.amount),
        };
    });
}

// Get summary stats for dashboard
export async function getBudgetSummary(userId: string): Promise<{
    budgetCount: number;
    totalBudgeted: number;
    totalSpent: number;
    overBudgetCount: number;
    nearLimitCount: number;
}> {
    const progress = await getBudgetProgress(userId);

    return {
        budgetCount: progress.length,
        totalBudgeted: progress.reduce((sum, p) => sum + p.budget.amount, 0),
        totalSpent: progress.reduce((sum, p) => sum + p.spent, 0),
        overBudgetCount: progress.filter((p) => p.isOverBudget).length,
        nearLimitCount: progress.filter((p) => p.isNearLimit).length,
    };
}
