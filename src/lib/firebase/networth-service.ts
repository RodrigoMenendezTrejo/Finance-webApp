// Firebase Net Worth History Service
// Manages daily snapshots of user's net worth for historical tracking

import {
    collection,
    doc,
    getDoc,
    setDoc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    Timestamp,
} from 'firebase/firestore';
import { db } from './config';
import { NetWorthSnapshot } from '@/types/firestore';

// Collection reference helper
const getNetWorthHistoryRef = (userId: string) =>
    collection(db, 'users', userId, 'netWorthHistory');

// Format date as YYYY-MM-DD for document IDs
function formatDateId(date: Date): string {
    return date.toISOString().split('T')[0];
}

// Get today's date ID
function getTodayId(): string {
    return formatDateId(new Date());
}

// Check if today's snapshot exists
export async function getTodaySnapshot(userId: string): Promise<NetWorthSnapshot | null> {
    const todayId = getTodayId();
    const docRef = doc(db, 'users', userId, 'netWorthHistory', todayId);
    const snapshot = await getDoc(docRef);

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data(),
    } as NetWorthSnapshot;
}

// Save today's net worth snapshot (upsert - only updates if values changed)
export async function saveNetWorthSnapshot(
    userId: string,
    data: {
        assets: number;
        liabilities: number;
        receivables: number;
    }
): Promise<void> {
    const todayId = getTodayId();
    const docRef = doc(db, 'users', userId, 'netWorthHistory', todayId);

    const netWorth = data.assets + data.receivables - data.liabilities;

    // Check if snapshot already exists for today
    const existing = await getDoc(docRef);

    if (existing.exists()) {
        // Only update if values have changed
        const existingData = existing.data() as NetWorthSnapshot;
        if (
            existingData.assets === data.assets &&
            existingData.liabilities === data.liabilities &&
            existingData.receivables === data.receivables
        ) {
            // No change, skip update
            return;
        }
    }

    // Save or update the snapshot
    await setDoc(docRef, {
        date: todayId,
        assets: data.assets,
        liabilities: data.liabilities,
        receivables: data.receivables,
        netWorth,
        createdAt: existing?.exists() ? existing.data().createdAt : serverTimestamp(),
    });
}

// Get net worth history for last N days
export async function getNetWorthHistory(
    userId: string,
    days: number
): Promise<NetWorthSnapshot[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateId = formatDateId(startDate);

    const historyRef = getNetWorthHistoryRef(userId);
    const q = query(
        historyRef,
        where('date', '>=', startDateId),
        orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as NetWorthSnapshot[];
}

// Get net worth history between specific dates
export async function getNetWorthHistoryByRange(
    userId: string,
    startDate: Date,
    endDate: Date
): Promise<NetWorthSnapshot[]> {
    const startDateId = formatDateId(startDate);
    const endDateId = formatDateId(endDate);

    const historyRef = getNetWorthHistoryRef(userId);
    const q = query(
        historyRef,
        where('date', '>=', startDateId),
        where('date', '<=', endDateId),
        orderBy('date', 'asc')
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as NetWorthSnapshot[];
}

// Aggregate snapshots by week (for 1M view)
// Returns 4 data points representing the last 4 weeks
export function aggregateByWeek(snapshots: NetWorthSnapshot[]): {
    label: string;
    assets: number;
    liabilities: number;
    netWorth: number;
}[] {
    if (snapshots.length === 0) return [];

    const weeks: Map<string, NetWorthSnapshot[]> = new Map();

    // Group by week number
    snapshots.forEach((snapshot) => {
        const date = new Date(snapshot.date);
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
        const weekKey = formatDateId(weekStart);

        if (!weeks.has(weekKey)) {
            weeks.set(weekKey, []);
        }
        weeks.get(weekKey)!.push(snapshot);
    });

    // Get last value of each week (most recent snapshot)
    const result: {
        label: string;
        assets: number;
        liabilities: number;
        netWorth: number;
    }[] = [];

    const sortedWeeks = Array.from(weeks.keys()).sort();
    const recentWeeks = sortedWeeks.slice(-4); // Last 4 weeks

    recentWeeks.forEach((weekKey, index) => {
        const weekSnapshots = weeks.get(weekKey)!;
        const lastSnapshot = weekSnapshots[weekSnapshots.length - 1];

        result.push({
            label: `Week ${index + 1}`,
            assets: lastSnapshot.assets,
            liabilities: lastSnapshot.liabilities,
            netWorth: lastSnapshot.netWorth,
        });
    });

    return result;
}

// Aggregate snapshots by month (for 6M and 1Y views)
export function aggregateByMonth(snapshots: NetWorthSnapshot[]): {
    label: string;
    assets: number;
    liabilities: number;
    netWorth: number;
}[] {
    if (snapshots.length === 0) return [];

    const months: Map<string, NetWorthSnapshot[]> = new Map();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Group by month
    snapshots.forEach((snapshot) => {
        const date = new Date(snapshot.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!months.has(monthKey)) {
            months.set(monthKey, []);
        }
        months.get(monthKey)!.push(snapshot);
    });

    // Get last value of each month
    const result: {
        label: string;
        assets: number;
        liabilities: number;
        netWorth: number;
    }[] = [];

    const sortedMonths = Array.from(months.keys()).sort();

    sortedMonths.forEach((monthKey) => {
        const monthSnapshots = months.get(monthKey)!;
        const lastSnapshot = monthSnapshots[monthSnapshots.length - 1];
        const monthIndex = parseInt(monthKey.split('-')[1]) - 1;

        result.push({
            label: monthNames[monthIndex],
            assets: lastSnapshot.assets,
            liabilities: lastSnapshot.liabilities,
            netWorth: lastSnapshot.netWorth,
        });
    });

    return result;
}
