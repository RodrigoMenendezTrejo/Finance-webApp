'use client';

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

interface NetWorthData {
    month: string;
    assets: number;
    liabilities: number;
    netWorth: number;
}

interface NetWorthChartProps {
    data: NetWorthData[];
    currentNetWorth: number;
    percentChange: number;
    hideAmounts?: boolean;
}

export function NetWorthChart({
    data,
    currentNetWorth,
    percentChange,
    hideAmounts = false,
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

    return (
        <BentoCard colSpan={2} rowSpan={2} className="bg-gradient-to-br from-slate-900 to-slate-800">
            <BentoCardHeader
                title="Net Worth"
                subtitle="Last 6 months"
                icon={
                    isPositive ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                    ) : (
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                    )
                }
            />
            <BentoCardContent className="gap-2">
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl md:text-3xl font-bold text-foreground ${hideAmounts ? 'blur-md select-none' : ''}`}>
                        {formatCurrency(currentNetWorth)}
                    </span>
                    <span
                        className={`text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'
                            }`}
                    >
                        {isPositive ? '+' : ''}
                        {percentChange.toFixed(1)}%
                    </span>
                </div>

                {/* Chart */}
                <div className="flex-1 min-h-[100px] mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="assetsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: '#1e293b',
                                    border: '1px solid #334155',
                                    borderRadius: '8px',
                                    fontSize: '12px',
                                }}
                                formatter={(value) => [formatCurrency(value as number), '']}
                            />
                            <Area
                                type="monotone"
                                dataKey="assets"
                                stroke="#3b82f6"
                                strokeWidth={1.5}
                                fill="url(#assetsGradient)"
                                name="Assets"
                            />
                            <Area
                                type="monotone"
                                dataKey="netWorth"
                                stroke="#10b981"
                                strokeWidth={2}
                                fill="url(#netWorthGradient)"
                                name="Net Worth"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </BentoCardContent>
        </BentoCard>
    );
}
