'use client';

import { useMemo } from 'react';
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
import { cn } from '@/lib/utils';

export type ChartPeriod = '1M' | '6M' | '1Y';

interface NetWorthData {
    date: string;
    assets: number;
    liabilities: number;
    netWorth: number;
}

interface NetWorthChartProps {
    data: NetWorthData[];
    currentNetWorth: number;
    percentChange: number;
    hideAmounts?: boolean;
    selectedPeriod: ChartPeriod;
    onPeriodChange: (period: ChartPeriod) => void;
    isLoading?: boolean;
}

export function NetWorthChart({
    data,
    currentNetWorth,
    percentChange,
    hideAmounts = false,
    selectedPeriod,
    onPeriodChange,
    isLoading = false,
}: NetWorthChartProps) {
    const isPositive = percentChange >= 0;

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

    // Format Y-axis label to show proper values
    const formatYAxis = (value: number) => {
        if (value >= 1000) {
            return `€${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
        }
        return `€${value}`;
    };

    const periods: ChartPeriod[] = ['1M', '6M', '1Y'];

    return (
        <BentoCard colSpan={2} rowSpan={2} className="bg-gradient-to-br from-slate-900 to-slate-800">
            <div className="flex items-start justify-between mb-2">
                <div>
                    <h3 className="font-semibold text-sm text-foreground">Net Worth</h3>
                    {/* Period selector */}
                    <div className="flex gap-1 mt-1">
                        {periods.map((period) => (
                            <button
                                key={period}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onPeriodChange(period);
                                }}
                                className={cn(
                                    'px-2 py-0.5 text-xs rounded-md font-medium transition-all',
                                    selectedPeriod === period
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                                )}
                            >
                                {period}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    {isPositive ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                    ) : (
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                    )}
                </div>
            </div>
            <BentoCardContent className="gap-2">
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl md:text-3xl font-bold text-foreground ${hideAmounts ? 'blur-md select-none' : ''}`}>
                        {formatCurrency(currentNetWorth)}
                    </span>
                    <span
                        className={`text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}
                    >
                        {isPositive ? '+' : ''}
                        {percentChange.toFixed(1)}%
                    </span>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[100px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                            <defs>
                                {/* Neon glow filter for the main line */}
                                <filter id="neonGlow" x="-50%" y="-50%" width="200%" height="200%">
                                    <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                                    <feMerge>
                                        <feMergeNode in="blur" />
                                        <feMergeNode in="blur" />
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
                                stroke="rgba(255,255,255,0.08)"
                                strokeWidth={1}
                                vertical={false}
                            />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                domain={yAxisDomain}
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={formatYAxis}
                                width={45}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                                formatter={(value, name) => [formatCurrency(value as number), name]}
                                labelStyle={{ color: '#9ca3af', marginBottom: '4px' }}
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
                            {/* Net Worth line - primary with neon glow */}
                            <Area
                                type="monotoneX"
                                dataKey="netWorth"
                                stroke="#10b981"
                                strokeWidth={2.5}
                                fill="url(#netWorthGradient)"
                                name="Net Worth"
                                filter="url(#neonGlow)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </BentoCardContent>
        </BentoCard>
    );
}

