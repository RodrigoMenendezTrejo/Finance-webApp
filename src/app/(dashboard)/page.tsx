'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { BentoGrid } from '@/components/bento/bento-grid';
import { NetWorthChart } from '@/components/bento/net-worth-chart';
import { ReceivablesCard } from '@/components/bento/receivables-card';
import { FinancialOverviewCard, RecentActivityCard } from '@/components/bento/quick-stats-card';
import { RecurringCard } from '@/components/bento/subscriptions-card';
import { FABButton } from '@/components/ui/fab-button';
import { AddTransactionSheet } from '@/components/forms/add-transaction-sheet';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAccounts, getTotalByType } from '@/lib/firebase/accounts-service';
import { getTransactions, getTotalSpending } from '@/lib/firebase/transactions-service';
import { getRecurringTransactions, getMonthlyRecurringTotal } from '@/lib/firebase/recurring-service';
import { Account } from '@/types/firestore';

// Generate avatar colors based on name
const getAvatarColor = (name: string) => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Get greeting based on time of day
const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
};

export default function DashboardPage() {
    const router = useRouter();
    const { user, userProfile } = useAuth();

    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [totalAssets, setTotalAssets] = useState(0);
    const [totalLiabilities, setTotalLiabilities] = useState(0);
    const [totalReceivables, setTotalReceivables] = useState(0);
    const [monthlySpending, setMonthlySpending] = useState(0);
    const [recentCount, setRecentCount] = useState(0);
    const [recurringData, setRecurringData] = useState({
        subscriptions: { total: 0, count: 0 },
        income: { total: 0, count: 0 },
        bills: { total: 0, count: 0 },
    });

    const [isAddingTransaction, setIsAddingTransaction] = useState(false);
    const [addMode, setAddMode] = useState<'camera' | 'text'>('text');

    // Fetch data from Firestore
    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            // Fetch all accounts
            const allAccounts = await getAccounts(user.uid);
            setAccounts(allAccounts);

            // Calculate totals by type
            const assets = allAccounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0);
            const liabilities = allAccounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0);
            const receivables = allAccounts.filter(a => a.type === 'receivable').reduce((sum, a) => sum + a.balance, 0);

            setTotalAssets(assets);
            setTotalLiabilities(liabilities);
            setTotalReceivables(receivables);

            // Get monthly spending
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const spending = await getTotalSpending(user.uid, startOfMonth, now);
            setMonthlySpending(spending);

            // Get recent transactions count
            const { transactions } = await getTransactions(user.uid, { limit: 50 });
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentTxns = transactions.filter(t => t.date.toDate() >= weekAgo);
            setRecentCount(recentTxns.length);

            // Get recurring data for all types
            const recurringItems = await getRecurringTransactions(user.uid);

            const activeSubs = recurringItems.filter(r => r.type === 'subscription' && r.isActive);
            const activeIncome = recurringItems.filter(r => r.type === 'income' && r.isActive);
            const activeBills = recurringItems.filter(r => r.type === 'bill' && r.isActive);

            const [subTotal, incomeTotal, billTotal] = await Promise.all([
                getMonthlyRecurringTotal(user.uid, 'subscription'),
                getMonthlyRecurringTotal(user.uid, 'income'),
                getMonthlyRecurringTotal(user.uid, 'bill'),
            ]);

            setRecurringData({
                subscriptions: { total: subTotal, count: activeSubs.length },
                income: { total: incomeTotal, count: activeIncome.length },
                bills: { total: billTotal, count: activeBills.length },
            });

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleCameraClick = () => {
        setAddMode('camera');
        setIsAddingTransaction(true);
    };

    const handleTextClick = () => {
        setAddMode('text');
        setIsAddingTransaction(true);
    };

    // Calculate net worth
    const netWorth = totalAssets + totalReceivables - totalLiabilities;

    // Get receivable accounts for the card
    const receivableAccounts = accounts
        .filter(a => a.type === 'receivable' && a.balance > 0)
        .map(a => ({
            id: a.id,
            name: a.name,
            amount: a.balance,
            avatarColor: getAvatarColor(a.name),
        }));

    // Mock net worth history (will be replaced with real data later)
    const netWorthData = [
        { month: 'Jul', assets: netWorth * 0.7, liabilities: totalLiabilities, netWorth: netWorth * 0.65 },
        { month: 'Aug', assets: netWorth * 0.75, liabilities: totalLiabilities, netWorth: netWorth * 0.7 },
        { month: 'Sep', assets: netWorth * 0.8, liabilities: totalLiabilities, netWorth: netWorth * 0.78 },
        { month: 'Oct', assets: netWorth * 0.85, liabilities: totalLiabilities, netWorth: netWorth * 0.83 },
        { month: 'Nov', assets: netWorth * 0.95, liabilities: totalLiabilities, netWorth: netWorth * 0.92 },
        { month: 'Dec', assets: totalAssets, liabilities: totalLiabilities, netWorth: netWorth },
    ];

    const percentChange = netWorthData.length >= 2
        ? ((netWorthData[5].netWorth - netWorthData[4].netWorth) / (netWorthData[4].netWorth || 1)) * 100
        : 0;

    // Show loading while fetching
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <main className="min-h-screen pb-24">
            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b border-border/50">
                <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            SafeBalance
                        </h1>
                        <p className="text-xs text-muted-foreground">{getGreeting()}</p>
                    </div>
                    <button
                        onClick={() => router.push('/settings')}
                        className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                    >
                        <span className="text-sm font-medium">
                            {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                        </span>
                    </button>
                </div>
            </header>

            {/* Bento Grid Dashboard */}
            <BentoGrid>
                {/* Net Worth Chart - Large cell */}
                <NetWorthChart
                    data={netWorthData}
                    currentNetWorth={netWorth}
                    percentChange={percentChange}
                />

                {/* Financial Overview - Assets & Liabilities */}
                <FinancialOverviewCard
                    data={{
                        assets: { amount: totalAssets, count: accounts.filter(a => a.type === 'asset').length },
                        liabilities: { amount: totalLiabilities, count: accounts.filter(a => a.type === 'liability').length },
                    }}
                    onAssetsClick={() => router.push('/accounts?type=asset')}
                    onLiabilitiesClick={() => router.push('/accounts?type=liability')}
                />

                {/* Receivables */}
                <ReceivablesCard
                    receivables={receivableAccounts}
                    totalAmount={totalReceivables}
                    onClick={() => router.push('/accounts?type=receivable')}
                />

                {/* Recurring */}
                <RecurringCard
                    data={recurringData}
                    onClick={() => router.push('/recurring')}
                />

                {/* Recent Activity */}
                <RecentActivityCard
                    count={recentCount}
                    onClick={() => router.push('/transactions')}
                />
            </BentoGrid>

            {/* FAB */}
            <FABButton
                onCameraClick={handleCameraClick}
                onTextClick={handleTextClick}
            />

            {/* Add Transaction Sheet */}
            <AddTransactionSheet
                open={isAddingTransaction}
                onOpenChange={setIsAddingTransaction}
                mode={addMode}
                onSuccess={fetchData}
            />
        </main>
    );
}
