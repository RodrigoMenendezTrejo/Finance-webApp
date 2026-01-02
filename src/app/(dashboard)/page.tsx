'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { BentoGrid } from '@/components/bento/bento-grid';
import { NetWorthChart } from '@/components/bento/net-worth-chart';
import { ReceivablesCard } from '@/components/bento/receivables-card';
import { FinancialOverviewCard, RecentActivityCard, GoalsCard } from '@/components/bento/quick-stats-card';
import { RecurringCard } from '@/components/bento/subscriptions-card';
import { FABButton } from '@/components/ui/fab-button';
import { AddTransactionSheet } from '@/components/forms/add-transaction-sheet';
import { AllocationSuggestSheet } from '@/components/forms/allocation-suggest-sheet';
import { useAuth } from '@/lib/firebase/auth-context';
import { getAccounts, getTotalByType, deleteAccount } from '@/lib/firebase/accounts-service';
import { getTransactions, getTotalSpending } from '@/lib/firebase/transactions-service';
import { getRecurringTransactions, getMonthlyRecurringTotal, processDueRecurring } from '@/lib/firebase/recurring-service';
import { saveNetWorthSnapshot, getNetWorthHistory, aggregateByWeek, aggregateByMonth } from '@/lib/firebase/networth-service';
import { getGoals, getGoalProgress } from '@/lib/firebase/goals-service';
import { Account, SavingsGoal } from '@/types/firestore';

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
    const [recentTransactions, setRecentTransactions] = useState<{ id: string; payee: string; amount: number; type: 'expense' | 'income' | 'transfer'; category: string }[]>([]);
    const [recurringData, setRecurringData] = useState({
        subscriptions: { total: 0, count: 0 },
        income: { total: 0, count: 0 },
        bills: { total: 0, count: 0 },
    });

    // Net worth history data for charts
    const [netWorthData1M, setNetWorthData1M] = useState<{ label: string; assets: number; liabilities: number; netWorth: number }[]>([]);
    const [netWorthData6M, setNetWorthData6M] = useState<{ label: string; assets: number; liabilities: number; netWorth: number }[]>([]);
    const [netWorthData1Y, setNetWorthData1Y] = useState<{ label: string; assets: number; liabilities: number; netWorth: number }[]>([]);

    // Goals data
    const [goals, setGoals] = useState<SavingsGoal[]>([]);

    const [isAddingTransaction, setIsAddingTransaction] = useState(false);
    const [addMode, setAddMode] = useState<'camera' | 'text'>('text');

    // Prevent double processing of recurring transactions (React Strict Mode / fast navigation)
    const hasProcessedRecurring = useRef(false);

    // Allocation suggestion state for recurring income
    const [showAllocation, setShowAllocation] = useState(false);
    const [allocationData, setAllocationData] = useState<{ amount: number; sourceId: string } | null>(null);

    const [hideAmounts, setHideAmounts] = useState(() => {
        // Initialize from localStorage (only on client)
        if (typeof window !== 'undefined') {
            return localStorage.getItem('hideAmounts') === 'true';
        }
        return false;
    });

    // Persist hideAmounts to localStorage
    const toggleHideAmounts = () => {
        const newValue = !hideAmounts;
        setHideAmounts(newValue);
        localStorage.setItem('hideAmounts', String(newValue));
    };

    // Fetch data from Firestore
    const fetchData = useCallback(async () => {
        if (!user) return;

        try {
            // Auto-process any due recurring transactions (only once per page load)
            if (!hasProcessedRecurring.current) {
                hasProcessedRecurring.current = true;
                const processedItems = await processDueRecurring(user.uid);

                // Show toast notification for each processed item
                if (processedItems.length > 0) {
                    const formatCurrency = (value: number) => {
                        return new Intl.NumberFormat('es-ES', {
                            style: 'currency',
                            currency: 'EUR',
                        }).format(value);
                    };

                    processedItems.forEach((item, index) => {
                        // Stagger toasts slightly for better UX
                        setTimeout(() => {
                            if (item.type === 'income') {
                                toast.success(`💰 Income received`, {
                                    description: `${item.name}: +${formatCurrency(item.amount)}`,
                                });
                            } else if (item.type === 'subscription') {
                                toast.info(`📍 Subscription charged`, {
                                    description: `${item.name}: -${formatCurrency(item.amount)}`,
                                });
                            } else {
                                toast.info(`📋 Bill paid`, {
                                    description: `${item.name}: -${formatCurrency(item.amount)}`,
                                });
                            }
                        }, index * 500); // 500ms delay between each toast
                    });

                    // Trigger allocation suggestion for income items if user has autoSuggestGoals enabled
                    const incomeItems = processedItems.filter(item => item.type === 'income');
                    if (incomeItems.length > 0 && userProfile?.autoSuggestGoals !== false) {
                        // Get accounts to check for goal accounts
                        const assetAccounts = await getAccounts(user.uid);

                        // Check if there are any goal accounts (savings accounts marked for goals)
                        const hasGoalAccounts = assetAccounts.some(a => a.isGoalAccount === true);

                        // Only show allocation popup if goal accounts exist
                        if (!hasGoalAccounts) {
                            // No goal accounts, skip showing the popup
                            return;
                        }

                        // Filter out income that already went to a goal account (no need to suggest allocation)
                        const incomeNotInGoalAccounts = incomeItems.filter(item => {
                            const account = assetAccounts.find(a => a.id === item.accountId);
                            return !account?.isGoalAccount;
                        });

                        // If all income already went to goal accounts, skip the popup
                        if (incomeNotInGoalAccounts.length === 0) {
                            return;
                        }

                        const totalIncome = incomeNotInGoalAccounts.reduce((sum, item) => sum + item.amount, 0);
                        // Get the first non-goal asset account as source (the one that received non-goal income)
                        const sourceAccount = assetAccounts.find(a =>
                            a.type === 'asset' &&
                            incomeNotInGoalAccounts.some(item => item.accountId === a.id)
                        ) || assetAccounts.find(a => a.type === 'asset' && !a.isGoalAccount);

                        if (sourceAccount) {
                            setAllocationData({ amount: totalIncome, sourceId: sourceAccount.id });
                            // Delay to show toasts first
                            setTimeout(() => {
                                setShowAllocation(true);
                            }, (processedItems.length * 500) + 1000);
                        }
                    }
                }
            }

            // Fetch all accounts
            const allAccounts = await getAccounts(user.uid);

            // Auto-cleanup: delete any receivables with 0 balance
            const zeroBalanceReceivables = allAccounts.filter(
                a => a.type === 'receivable' && a.balance === 0
            );
            for (const receivable of zeroBalanceReceivables) {
                await deleteAccount(user.uid, receivable.id);
            }

            // Filter out the deleted accounts for state
            const activeAccounts = allAccounts.filter(
                a => !(a.type === 'receivable' && a.balance === 0)
            );
            setAccounts(activeAccounts);

            // Calculate totals by type
            const assets = activeAccounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0);
            const liabilities = activeAccounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0);
            const receivables = activeAccounts.filter(a => a.type === 'receivable').reduce((sum, a) => sum + a.balance, 0);

            setTotalAssets(assets);
            setTotalLiabilities(liabilities);
            setTotalReceivables(receivables);

            // Get monthly spending
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const spending = await getTotalSpending(user.uid, startOfMonth, now);
            setMonthlySpending(spending);

            // Get recent transactions
            const { transactions } = await getTransactions(user.uid, { limit: 50 });
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            const recentTxns = transactions.filter(t => t.date.toDate() >= weekAgo);
            setRecentTransactions(recentTxns.map(t => ({
                id: t.id,
                payee: t.payee,
                amount: t.amount,
                type: t.type,
                category: t.category,
            })));

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

            // Fetch goals for the goals card
            const goalsData = await getGoals(user.uid);
            setGoals(goalsData);

            // Save today's net worth snapshot
            await saveNetWorthSnapshot(user.uid, {
                assets,
                liabilities,
                receivables,
            });

            // Fetch historical net worth data
            const [history1M, history6M, history1Y] = await Promise.all([
                getNetWorthHistory(user.uid, 30),   // Last 30 days
                getNetWorthHistory(user.uid, 180),  // Last 6 months
                getNetWorthHistory(user.uid, 365),  // Last 12 months
            ]);

            // Aggregate data for different time ranges
            const data1M = aggregateByWeek(history1M);
            const data6M = aggregateByMonth(history6M);
            const data1Y = aggregateByMonth(history1Y);

            // If no history exists yet, create a single point with current values
            const currentPoint = {
                label: 'Now',
                assets,
                liabilities,
                netWorth: assets + receivables - liabilities,
            };

            // Create starting point (0 values) for showing growth line
            // Empty label so chart doesn't show "Start" - just shows the line
            const startPoint = {
                label: '',
                assets: 0,
                liabilities: 0,
                netWorth: 0,
            };

            // Get current month name for labeling
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const currentMonth = monthNames[new Date().getMonth()];
            const currentWeek = `Week ${Math.ceil(new Date().getDate() / 7)}`;

            // Helper function to ensure at least 2 points for a visible line
            const ensureLine = (data: typeof data1M, currentLabel: string) => {
                if (data.length === 0) {
                    // No data: show line from 0 to current
                    return [startPoint, { ...currentPoint, label: currentLabel }];
                } else if (data.length === 1) {
                    // Only 1 point: add starting 0 point for context
                    return [startPoint, data[0]];
                }
                return data;
            };

            setNetWorthData1M(ensureLine(data1M, currentWeek));
            setNetWorthData6M(ensureLine(data6M, currentMonth));
            setNetWorthData1Y(ensureLine(data1Y, currentMonth));

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
                    <div className="flex items-center gap-2">
                        <button
                            onClick={toggleHideAmounts}
                            className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
                            title={hideAmounts ? 'Show amounts' : 'Hide amounts'}
                        >
                            {hideAmounts ? (
                                <EyeOff className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <Eye className="w-4 h-4 text-muted-foreground" />
                            )}
                        </button>
                        <button
                            onClick={() => router.push('/settings')}
                            className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                        >
                            <span className="text-sm font-medium">
                                {userProfile?.displayName?.charAt(0).toUpperCase() || 'U'}
                            </span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Bento Grid Dashboard */}
            <BentoGrid>
                {/* Net Worth Chart - Large cell */}
                <NetWorthChart
                    data1M={netWorthData1M}
                    data6M={netWorthData6M}
                    data1Y={netWorthData1Y}
                    currentNetWorth={netWorth}
                    hideAmounts={hideAmounts}
                />

                {/* Financial Overview - Assets & Liabilities */}
                <FinancialOverviewCard
                    data={{
                        assets: { amount: totalAssets, count: accounts.filter(a => a.type === 'asset').length },
                        liabilities: { amount: totalLiabilities, count: accounts.filter(a => a.type === 'liability').length },
                    }}
                    onAssetsClick={() => router.push('/accounts?type=asset')}
                    onLiabilitiesClick={() => router.push('/accounts?type=liability')}
                    hideAmounts={hideAmounts}
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
                    transactions={recentTransactions}
                    onClick={() => router.push('/transactions')}
                />

                {/* Savings Goals */}
                <GoalsCard
                    goalCount={goals.length}
                    totalProgress={goals.length > 0
                        ? goals.reduce((sum, g) => sum + getGoalProgress(g), 0) / goals.length
                        : 0
                    }
                    onClick={() => router.push('/goals')}
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

            {/* Allocation Suggestion Sheet for Recurring Income */}
            {user && allocationData && (
                <AllocationSuggestSheet
                    open={showAllocation}
                    onOpenChange={(open) => {
                        setShowAllocation(open);
                        if (!open) {
                            setAllocationData(null);
                        }
                    }}
                    userId={user.uid}
                    incomeAmount={allocationData.amount}
                    sourceAccountId={allocationData.sourceId}
                    onComplete={() => {
                        setShowAllocation(false);
                        setAllocationData(null);
                        fetchData();
                    }}
                />
            )}
        </main>
    );
}
