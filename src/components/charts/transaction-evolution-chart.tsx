'use client';

import { useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    ReferenceLine,
    CartesianGrid,
    Cell,
} from 'recharts';
import { Transaction } from '@/types/firestore';

interface DailyData {
    date: string;
    fullDate: string;
    income: number;
    expense: number;
    net: number;
}

interface TransactionEvolutionChartProps {
    transactions: Transaction[];
}

// Custom tooltip component
const CustomTooltip = ({
    active,
    payload,
    label
}: {
    active?: boolean;
    payload?: Array<{ dataKey: string; value: number; payload: DailyData }>;
    label?: string;
}) => {
    if (!active || !payload || payload.length === 0) return null;

    const data = payload[0].payload;
    const net = data.income + data.expense;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
        }).format(Math.abs(value));
    };

    return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 shadow-xl">
            <p className="text-xs text-muted-foreground mb-2">{data.fullDate}</p>
            {data.income > 0 && (
                <p className="text-sm">
                    <span className="text-muted-foreground">Income: </span>
                    <span className="text-emerald-500 font-semibold">+{formatCurrency(data.income)}</span>
                </p>
            )}
            {data.expense < 0 && (
                <p className="text-sm">
                    <span className="text-muted-foreground">Expense: </span>
                    <span className="text-rose-400 font-semibold">-{formatCurrency(Math.abs(data.expense))}</span>
                </p>
            )}
            <div className="border-t border-zinc-700 mt-2 pt-2">
                <p className="text-sm">
                    <span className="text-muted-foreground">Net: </span>
                    <span className={`font-bold ${net >= 0 ? 'text-emerald-500' : 'text-rose-400'}`}>
                        {net >= 0 ? '+' : '-'}{formatCurrency(Math.abs(net))}
                    </span>
                </p>
            </div>
        </div>
    );
};

export function TransactionEvolutionChart({ transactions }: TransactionEvolutionChartProps) {
    // Process transactions into daily data for the last 14 days
    const chartData = useMemo(() => {
        const dailyMap: Record<string, { income: number; expense: number }> = {};

        // Get current date and 14 days ago
        const today = new Date();
        const twoWeeksAgo = new Date(today);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 13);

        // Initialize all days with 0
        for (let d = new Date(twoWeeksAgo); d <= today; d.setDate(d.getDate() + 1)) {
            const key = d.toDateString();
            dailyMap[key] = { income: 0, expense: 0 };
        }

        // Aggregate transactions by day
        transactions.forEach(tx => {
            const date = tx.date.toDate();
            const key = date.toDateString();

            if (dailyMap[key]) {
                if (tx.type === 'income') {
                    dailyMap[key].income += tx.amount;
                } else if (tx.type === 'expense') {
                    dailyMap[key].expense -= tx.amount; // Negative for diverging chart
                }
            }
        });

        // Convert to array sorted by date
        return Object.entries(dailyMap)
            .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
            .map(([dateStr, values]) => {
                const date = new Date(dateStr);
                return {
                    date: date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }),
                    fullDate: date.toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                    }),
                    income: values.income,
                    expense: values.expense,
                    net: values.income + values.expense,
                };
            });
    }, [transactions]);

    // Calculate max value for Y axis symmetry
    const maxValue = useMemo(() => {
        let max = 0;
        chartData.forEach(d => {
            max = Math.max(max, d.income, Math.abs(d.expense));
        });
        return Math.ceil(max / 100) * 100 + 100; // Round up to nearest 100 + buffer
    }, [chartData]);

    // Format Y-axis with proper sign
    const formatYAxis = (value: number) => {
        if (value === 0) return '€0';
        const absValue = Math.abs(value);
        const sign = value < 0 ? '-' : '+';
        if (absValue >= 1000) {
            return `${sign}€${(absValue / 1000).toFixed(1)}k`;
        }
        return `${sign}€${absValue}`;
    };

    if (transactions.length === 0) {
        return (
            <div className="h-[280px] w-full bg-card/50 rounded-2xl p-6 border border-border/50 backdrop-blur-sm flex items-center justify-center">
                <p className="text-muted-foreground">No transactions to display</p>
            </div>
        );
    }

    return (
        <div className="h-[280px] w-full bg-card/50 rounded-2xl p-4 border border-border/50 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">Cash Flow - Last 14 Days</h3>
                <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                        <span className="text-muted-foreground">Income</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-sm bg-rose-500" />
                        <span className="text-muted-foreground">Expense</span>
                    </div>
                </div>
            </div>

            <ResponsiveContainer width="100%" height="90%">
                <BarChart
                    data={chartData}
                    stackOffset="sign"
                    margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                >
                    {/* Subtle grid lines */}
                    <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                    />

                    {/* Zero reference line */}
                    <ReferenceLine y={0} stroke="#52525b" strokeWidth={1} />

                    <XAxis
                        dataKey="date"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        dy={8}
                        interval="preserveStartEnd"
                    />

                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#71717a', fontSize: 10 }}
                        tickFormatter={formatYAxis}
                        domain={[-maxValue, maxValue]}
                        width={55}
                    />

                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />

                    {/* Income Bars (Green, above zero) - THICKER with rounded tops */}
                    <Bar
                        dataKey="income"
                        fill="#10b981"
                        radius={[6, 6, 0, 0]}
                        barSize={28}
                        maxBarSize={40}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`income-${index}`}
                                fill={entry.income > 0 ? '#10b981' : 'transparent'}
                            />
                        ))}
                    </Bar>

                    {/* Expense Bars (Rose, below zero) - THICKER with rounded bottoms */}
                    <Bar
                        dataKey="expense"
                        fill="#f43f5e"
                        radius={[0, 0, 6, 6]}
                        barSize={28}
                        maxBarSize={40}
                    >
                        {chartData.map((entry, index) => (
                            <Cell
                                key={`expense-${index}`}
                                fill={entry.expense < 0 ? '#f43f5e' : 'transparent'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
