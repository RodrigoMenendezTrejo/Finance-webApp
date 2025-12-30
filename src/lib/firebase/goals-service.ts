// Firebase Goals Service
// CRUD operations for savings goals

import {
    collection,
    doc,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { SavingsGoal } from '@/types/firestore';

// Collection reference helper
const getGoalsRef = (userId: string) =>
    collection(db, 'users', userId, 'goals');

// Get all goals for a user, ordered by priority
export async function getGoals(userId: string): Promise<SavingsGoal[]> {
    const goalsRef = getGoalsRef(userId);
    const q = query(goalsRef, orderBy('priority', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as SavingsGoal[];
}

// Get single goal
export async function getGoal(
    userId: string,
    goalId: string
): Promise<SavingsGoal | null> {
    const goalRef = doc(db, 'users', userId, 'goals', goalId);
    const snapshot = await getDoc(goalRef);

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data(),
    } as SavingsGoal;
}

// Create new goal
export async function createGoal(
    userId: string,
    data: {
        name: string;
        targetAmount: number;
        currentAmount?: number;
        deadline?: Date;
        linkedAccountId?: string;
        icon?: string;
    }
): Promise<string> {
    const goalsRef = getGoalsRef(userId);

    // Get current max priority to set new goal at lowest priority
    const existingGoals = await getGoals(userId);
    const maxPriority = existingGoals.reduce((max, g) => Math.max(max, g.priority), 0);

    const newGoal: Record<string, unknown> = {
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount ?? 0,
        priority: maxPriority + 1,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    // Only add optional fields if provided
    if (data.deadline) {
        newGoal.deadline = Timestamp.fromDate(data.deadline);
    }
    if (data.linkedAccountId) {
        newGoal.linkedAccountId = data.linkedAccountId;
    }
    if (data.icon) {
        newGoal.icon = data.icon;
    }

    const docRef = await addDoc(goalsRef, newGoal);
    return docRef.id;
}

// Update goal - separate deadline type to avoid Timestamp/Date conflict
interface UpdateGoalData {
    name?: string;
    targetAmount?: number;
    currentAmount?: number;
    linkedAccountId?: string;
    priority?: number;
    icon?: string;
    deadline?: Date | null;
}

export async function updateGoal(
    userId: string,
    goalId: string,
    data: UpdateGoalData
): Promise<void> {
    const goalRef = doc(db, 'users', userId, 'goals', goalId);

    const updateData: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
    };

    // Copy simple fields
    if (data.name !== undefined) updateData.name = data.name;
    if (data.targetAmount !== undefined) updateData.targetAmount = data.targetAmount;
    if (data.currentAmount !== undefined) updateData.currentAmount = data.currentAmount;
    if (data.linkedAccountId !== undefined) updateData.linkedAccountId = data.linkedAccountId;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.icon !== undefined) updateData.icon = data.icon;

    // Handle deadline conversion
    if (data.deadline === null) {
        updateData.deadline = null;
    } else if (data.deadline instanceof Date) {
        updateData.deadline = Timestamp.fromDate(data.deadline);
    }

    await updateDoc(goalRef, updateData);
}

// Delete goal
export async function deleteGoal(
    userId: string,
    goalId: string
): Promise<void> {
    const goalRef = doc(db, 'users', userId, 'goals', goalId);
    await deleteDoc(goalRef);
}

// Allocate amount to goal (add to currentAmount)
export async function allocateToGoal(
    userId: string,
    goalId: string,
    amount: number
): Promise<void> {
    const goal = await getGoal(userId, goalId);
    if (!goal) throw new Error('Goal not found');

    const newAmount = goal.currentAmount + amount;

    await updateGoal(userId, goalId, {
        currentAmount: Math.min(newAmount, goal.targetAmount), // Cap at target
    });
}

// Calculate goal progress percentage
export function getGoalProgress(goal: SavingsGoal): number {
    if (goal.targetAmount <= 0) return 0;
    return Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
}

// Calculate if goal is on track based on deadline
export function getGoalStatus(goal: SavingsGoal): 'on-track' | 'behind' | 'at-risk' | 'no-deadline' | 'completed' {
    // Already completed
    if (goal.currentAmount >= goal.targetAmount) {
        return 'completed';
    }

    // No deadline set
    if (!goal.deadline) {
        return 'no-deadline';
    }

    const now = new Date();
    const deadline = goal.deadline.toDate();
    const startDate = goal.createdAt.toDate();

    // Calculate expected progress
    const totalDuration = deadline.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();

    if (totalDuration <= 0) {
        return 'at-risk'; // Deadline has passed or is same as start
    }

    const expectedProgress = (elapsed / totalDuration) * 100;
    const actualProgress = getGoalProgress(goal);

    // Compare actual vs expected
    const progressDiff = actualProgress - expectedProgress;

    if (progressDiff >= -5) {
        return 'on-track'; // Within 5% of expected
    } else if (progressDiff >= -20) {
        return 'behind'; // 5-20% behind
    } else {
        return 'at-risk'; // More than 20% behind
    }
}

// Update goal priorities (for reordering)
export async function updateGoalPriorities(
    userId: string,
    goalIds: string[]
): Promise<void> {
    const updatePromises = goalIds.map((goalId, index) =>
        updateGoal(userId, goalId, { priority: index + 1 })
    );

    await Promise.all(updatePromises);
}

// Goal icon presets
export const GOAL_ICONS = [
    { emoji: '🏖️', label: 'Vacation' },
    { emoji: '🚗', label: 'Car' },
    { emoji: '🏠', label: 'Home' },
    { emoji: '💍', label: 'Wedding' },
    { emoji: '🎓', label: 'Education' },
    { emoji: '💻', label: 'Tech' },
    { emoji: '🛡️', label: 'Emergency Fund' },
    { emoji: '🎁', label: 'Gift' },
    { emoji: '🎮', label: 'Gaming' },
    { emoji: '✈️', label: 'Travel' },
    { emoji: '💰', label: 'Savings' },
    { emoji: '🎯', label: 'General' },
];

/**
 * Rebalance goal allocations when Goal Account balance decreases.
 * Proportionally reduces all goal currentAmounts so total doesn't exceed new available balance.
 * 
 * @param userId - User ID
 * @param newTotalAvailable - The new total balance across all Goal Accounts
 */
export async function rebalanceGoalsForNewBalance(
    userId: string,
    newTotalAvailable: number
): Promise<void> {
    const goals = await getGoals(userId);

    // Calculate current total allocation
    const totalAllocated = goals.reduce((sum, g) => sum + g.currentAmount, 0);

    // If we're within budget, no rebalancing needed
    if (totalAllocated <= newTotalAvailable) return;

    // Calculate the ratio to apply (e.g., if we have 500 allocated but only 300 available, ratio = 0.6)
    const ratio = newTotalAvailable / totalAllocated;

    // Update each goal proportionally
    const updatePromises = goals.map(goal => {
        const newAmount = Math.floor(goal.currentAmount * ratio * 100) / 100; // Round to 2 decimals
        return updateGoal(userId, goal.id, { currentAmount: Math.max(0, newAmount) });
    });

    await Promise.all(updatePromises);
}
