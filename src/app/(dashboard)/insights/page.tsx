'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, TrendingUp, TrendingDown, Loader2 } from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/firebase/auth-context';
import { useTheme } from '@/lib/theme-context';
import { getDailyCumulativeSpending, getCategoryComparison, getTotalSpending } from '@/lib/firebase/transactions-service';

// Category icons
const categoryIcons: Record<string, string> = {
    food: '🍔',
    groceries: '🛒',
    transport: '🚇',
    shopping: '🛍️',
    entertainment: '🎬',
    utilities: '💡',
    health: '🏥',
    education: '📚',
    travel: '✈️',
    subscriptions: '📱',
    other: '📦',
};

export default function InsightsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    const [loading, setLoading] = useState(true);
    const [trajectoryData, setTrajectoryData] = useState<{ day: number; thisMonth: number; lastMonth: number; projection?: number }[]>([]);
    const [categoryMovers, setCategoryMovers] = useState<{ category: string; current: number; average: number; changePercent: number }[]>([]);
    const [dailyAverage, setDailyAverage] = useState(0);

    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    useEffect(() => {
        if (!user) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // Get this month's trajectory
                const thisMonthData = await getDailyCumulativeSpending(
                    user.uid,
                    now.getFullYear(),
                    now.getMonth()
                );

                // Get last month's trajectory
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthData = await getDailyCumulativeSpending(
                    user.uid,
                    lastMonthDate.getFullYear(),
                    lastMonthDate.getMonth()
                );

                // Calculate current daily average for projection
                const currentSpending = thisMonthData[dayOfMonth - 1]?.cumulative || 0;
                const avgPerDay = dayOfMonth > 0 ? currentSpending / dayOfMonth : 0;
                setDailyAverage(avgPerDay);

                // Build combined trajectory data
                const combined = thisMonthData.map((d, i) => {
                    const isToday = d.day <= dayOfMonth;
                    const isFuture = d.day > dayOfMonth;

                    return {
                        day: d.day,
                        thisMonth: isToday ? d.cumulative : undefined,
                        lastMonth: lastMonthData[i]?.cumulative || 0,
                        projection: isFuture ? currentSpending + avgPerDay * (d.day - dayOfMonth) : undefined,
                    };
                });

                setTrajectoryData(combined as any);

                // Get category comparison
                const movers = await getCategoryComparison(user.uid);
                setCategoryMovers(movers.slice(0, 5)); // Top 5

            } catch (error) {
                console.error('Error fetching insights:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const getCategoryIcon = (category: string) => {
        return categoryIcons[category.toLowerCase()] || categoryIcons.other;
    };

    return (
        <main className="min-h-screen pb-8">
            {/* Header */}
            <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b border-border/50">
                <div className="px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-xl font-bold">Insights</h1>
                        <p className="text-xs text-muted-foreground">Spending trajectory</p>
                    </div>
                </div>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="p-4 space-y-6">
                    {/* Trajectory Chart */}
                    <Card className={isDark
                        ? 'bg-gradient-to-br from-violet-950/50 to-purple-900/30 border-violet-800/30'
                        : 'bg-gradient-to-br from-violet-100 to-purple-50 border-violet-200'
                    }>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-4">
                                <Sparkles className="w-5 h-5 text-violet-500" />
                                <h2 className="text-lg font-semibold">Spending Trajectory</h2>
                            </div>

                            {/* Legend */}
                            <div className="flex gap-4 mb-3 text-xs">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5 bg-muted-foreground" style={{ borderStyle: 'dashed' }} />
                                    <span className="text-muted-foreground">Last month</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5 bg-violet-500" />
                                    <span className="text-muted-foreground">This month</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5 bg-violet-500 opacity-50" style={{ borderStyle: 'dotted' }} />
                                    <span className="text-muted-foreground">Projection</span>
                                </div>
                            </div>

                            <div className="h-[200px] -ml-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={trajectoryData}>
                                        <CartesianGrid
                                            strokeDasharray="3 3"
                                            stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                                            vertical={false}
                                        />
                                        <XAxis
                                            dataKey="day"
                                            tick={{ fill: isDark ? '#9ca3af' : '#4b5563', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            tick={{ fill: isDark ? '#9ca3af' : '#4b5563', fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v) => `€${v}`}
                                            width={45}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                                                borderRadius: '8px',
                                                fontSize: '12px',
                                            }}
                                            formatter={(value: any, name: any) => {
                                                if (value === undefined || value === null) return ['-', name];
                                                return [
                                                    formatCurrency(value as number),
                                                    name === 'thisMonth' ? 'This month' :
                                                        name === 'lastMonth' ? 'Last month' : 'Projected'
                                                ];
                                            }}
                                            labelFormatter={(day) => `Day ${day}`}
                                        />
                                        {/* Today marker */}
                                        <ReferenceLine
                                            x={dayOfMonth}
                                            stroke={isDark ? '#a78bfa' : '#7c3aed'}
                                            strokeDasharray="4 4"
                                            label={{ value: 'Today', position: 'top', fontSize: 10, fill: '#a78bfa' }}
                                        />
                                        {/* Last month line - gray dashed */}
                                        <Line
                                            type="monotone"
                                            dataKey="lastMonth"
                                            stroke={isDark ? '#6b7280' : '#9ca3af'}
                                            strokeWidth={2}
                                            strokeDasharray="6 3"
                                            dot={false}
                                        />
                                        {/* This month line - purple solid */}
                                        <Line
                                            type="monotone"
                                            dataKey="thisMonth"
                                            stroke="#8b5cf6"
                                            strokeWidth={2.5}
                                            dot={false}
                                            connectNulls={false}
                                        />
                                        {/* Projection line - purple dotted */}
                                        <Line
                                            type="monotone"
                                            dataKey="projection"
                                            stroke="#8b5cf6"
                                            strokeWidth={2}
                                            strokeDasharray="2 4"
                                            dot={false}
                                            connectNulls={false}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Daily rate context */}
                            <p className="text-xs text-muted-foreground text-center mt-2">
                                Averaging <span className="font-medium text-foreground">{formatCurrency(dailyAverage)}</span>/day
                            </p>
                        </CardContent>
                    </Card>

                    {/* Top Category Movers */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold">Top Movers</h2>
                                <span className="text-xs text-muted-foreground">vs your average</span>
                            </div>

                            {categoryMovers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    Not enough data yet. Keep tracking!
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {categoryMovers.map((item) => {
                                        const isUp = item.changePercent > 0;
                                        const isNew = item.average === 0;

                                        return (
                                            <div key={item.category} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">{getCategoryIcon(item.category)}</span>
                                                    <div>
                                                        <p className="text-sm font-medium capitalize">{item.category}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {formatCurrency(item.current)}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {isNew ? (
                                                        <span className="text-xs font-medium text-blue-500">New</span>
                                                    ) : (
                                                        <>
                                                            {isUp ? (
                                                                <TrendingUp className="w-4 h-4 text-rose-500" />
                                                            ) : (
                                                                <TrendingDown className="w-4 h-4 text-emerald-500" />
                                                            )}
                                                            <span className={`text-sm font-medium ${isUp ? 'text-rose-500' : 'text-emerald-500'}`}>
                                                                {isUp ? '+' : ''}{item.changePercent.toFixed(0)}%
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </main>
    );
}
