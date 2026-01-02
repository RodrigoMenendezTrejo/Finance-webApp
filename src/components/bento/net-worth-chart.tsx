'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from 'recharts';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { useTheme } from '@/lib/theme-context';

interface NetWorthDataPoint {
    label: string;
    assets: number;
    liabilities: number;
    netWorth: number;
}

export type TimeRange = '1M' | '6M' | '1Y';

interface NetWorthChartProps {
    data1M: NetWorthDataPoint[];
    data6M: NetWorthDataPoint[];
    data1Y: NetWorthDataPoint[];
    currentNetWorth: number;
    hideAmounts?: boolean;
}

const timeRangeLabels: Record<TimeRange, string> = {
    '1M': 'Last 4 weeks',
    '6M': 'Last 6 months',
    '1Y': 'Last 12 months',
};

export function NetWorthChart({
    data1M,
    data6M,
    data1Y,
    currentNetWorth,
    hideAmounts = false,
}: NetWorthChartProps) {
    const [timeRange, setTimeRange] = useState<TimeRange>('6M');
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Get data based on selected time range
    const data = useMemo(() => {
        switch (timeRange) {
            case '1M': return data1M;
            case '6M': return data6M;
            case '1Y': return data1Y;
            default: return data6M;
        }
    }, [timeRange, data1M, data6M, data1Y]);

    // Calculate percent change based on selected view
    // 1M: needs 2+ weeks, 6M/1Y: needs 2+ months
    const percentChange = useMemo((): number | null => {
        const viewData = data;

        // Minimum data points needed:
        // - For 1M (weekly): 2 weeks
        // - For 6M/1Y (monthly): 2 months
        const minPoints = 2;

        if (viewData.length < minPoints) return null;

        const firstValue = viewData[0].netWorth;
        const lastValue = viewData[viewData.length - 1].netWorth;

        // If first value is 0 or near-zero, percentage is meaningless
        // This handles new users who just started tracking
        if (firstValue <= 0 || Math.abs(firstValue) < 1) {
            return null;
        }

        return ((lastValue - firstValue) / firstValue) * 100;
    }, [data]);

    const isPositive = percentChange === null || percentChange >= 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    // Calculate dynamic Y-axis domain based on data
    const yAxisDomain = useMemo(() => {
        if (!data || data.length === 0) return [0, 1000];

        const allValues = data.flatMap(d => [d.netWorth, d.assets]);
        const minValue = Math.min(...allValues);
        const maxValue = Math.max(...allValues);

        // Add 10% padding on each side for visual breathing room
        const range = maxValue - minValue;
        const padding = Math.max(range * 0.15, 50); // At least €50 padding

        const yMin = Math.max(0, Math.floor((minValue - padding) / 100) * 100);
        const yMax = Math.ceil((maxValue + padding) / 100) * 100;

        return [yMin, yMax];
    }, [data]);

    // Format Y-axis label to show max 3 significant figures
    // €300.45 -> "300", €10,341 -> "10.3k", €648,198 -> "648k"
    const formatYAxis = (value: number) => {
        if (value >= 1000000) {
            // Millions: show as Xm or X.Xm (max 3 figures)
            const millions = value / 1000000;
            return millions >= 100 ? `${Math.round(millions)}m` :
                millions >= 10 ? `${millions.toFixed(0)}m` :
                    `${millions.toFixed(1)}m`;
        } else if (value >= 1000) {
            // Thousands: show as Xk or X.Xk or XXXk (max 3 figures)
            const thousands = value / 1000;
            return thousands >= 100 ? `${Math.round(thousands)}k` :
                thousands >= 10 ? `${Math.round(thousands)}k` :
                    `${thousands.toFixed(1)}k`;
        }
        // Under 1000: just show the integer
        return `${Math.round(value)}`;
    };

    return (
        <BentoCard colSpan={2} rowSpan={2} className={isDark ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-100 to-slate-50 border border-slate-200'}>
            <BentoCardHeader
                title="Net Worth"
                subtitle={timeRangeLabels[timeRange]}
                icon={
                    isPositive ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                    ) : (
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                    )
                }
            />
            <BentoCardContent className="gap-2">
                {/* Amount and Time Range Selector */}
                <div className="flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-2xl md:text-3xl font-bold text-foreground ${hideAmounts ? 'blur-md select-none' : ''}`}>
                            {formatCurrency(currentNetWorth)}
                        </span>
                        <span
                            className={`text-sm font-medium ${percentChange === null ? 'text-blue-400' : isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
                        >
                            {percentChange === null
                                ? 'New'
                                : `${isPositive ? '+' : ''}${percentChange.toFixed(1)}%`
                            }
                        </span>
                    </div>

                    {/* Time Range Toggle */}
                    <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
                        {(['1M', '6M', '1Y'] as TimeRange[]).map((range) => (
                            <button
                                key={range}
                                onClick={() => setTimeRange(range)}
                                className={`px-2 py-1 text-xs font-medium rounded-md transition-all ${timeRange === range
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[100px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                            <defs>
                                {/* Neon glow filter for Net Worth line */}
                                <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                                    <feMerge>
                                        <feMergeNode in="coloredBlur" />
                                        <feMergeNode in="SourceGraphic" />
                                    </feMerge>
                                </filter>
                                {/* Enhanced Net Worth gradient - 40% opacity at top */}
                                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                {/* Assets gradient - subtle since it's secondary */}
                                <linearGradient id="assetsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            {/* Clean horizontal-only gridlines */}
                            <CartesianGrid
                                strokeDasharray="0"
                                stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                                strokeWidth={1}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: isDark ? '#9ca3af' : '#4b5563', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                domain={yAxisDomain}
                                tick={{ fill: isDark ? '#9ca3af' : '#4b5563', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={formatYAxis}
                                width={45}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                    border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                    color: isDark ? '#f1f5f9' : '#1e293b',
                                }}
                                formatter={(value, name) => [formatCurrency(value as number), name]}
                                labelStyle={{ color: isDark ? '#9ca3af' : '#64748b', marginBottom: '4px' }}
                            />
                            {/* Assets line - secondary, dashed, lower opacity */}
                            <Area
                                type="monotoneX"
                                dataKey="assets"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                strokeDasharray="4 2"
                                strokeOpacity={0.6}
                                fill="url(#assetsGradient)"
                                name="Assets"
                            />
                            {/* Net Worth line - primary, smooth, prominent with neon glow */}
                            <Area
                                type="monotoneX"
                                dataKey="netWorth"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                fill="url(#netWorthGradient)"
                                name="Net Worth"
                                style={{ filter: 'url(#neonGlow)' }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </BentoCardContent>
        </BentoCard>
    );
}


