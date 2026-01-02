'use client';

import { TrendingUp, TrendingDown, Sparkles, ChevronRight } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { useTheme } from '@/lib/theme-context';

interface SpendingForecastCardProps {
    currentSpending: number;
    lastMonthSpending: number;
    twoMonthsAgoSpending: number;
    hideAmounts?: boolean;
    onClick?: () => void;
}

export function SpendingForecastCard({
    currentSpending,
    lastMonthSpending,
    twoMonthsAgoSpending,
    hideAmounts = false,
    onClick,
}: SpendingForecastCardProps) {
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Calculate prediction using weighted average
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // Current pace projection
    const dailyAverage = dayOfMonth > 0 ? currentSpending / dayOfMonth : 0;
    const currentPaceProjection = dailyAverage * daysInMonth;

    // Weighted prediction
    const hasHistory = lastMonthSpending > 0 || twoMonthsAgoSpending > 0;

    let predictedTotal: number;
    if (!hasHistory) {
        predictedTotal = currentPaceProjection;
    } else if (twoMonthsAgoSpending === 0) {
        predictedTotal = currentPaceProjection * 0.6 + lastMonthSpending * 0.4;
    } else {
        predictedTotal =
            currentPaceProjection * 0.5 +
            lastMonthSpending * 0.3 +
            twoMonthsAgoSpending * 0.2;
    }

    // Pacing calculation
    // Time progress: what % of month has passed
    const timeProgress = (dayOfMonth / daysInMonth) * 100;

    // Spending progress: what % of predicted total have we spent
    const spendingProgress = predictedTotal > 0
        ? (currentSpending / predictedTotal) * 100
        : 0;

    // Are we overspending? (spending faster than time passing)
    const isOverspending = spendingProgress > timeProgress;
    const pacingDiff = spendingProgress - timeProgress;

    // Comparison to last month
    const vsLastMonth = lastMonthSpending > 0
        ? ((predictedTotal - lastMonthSpending) / lastMonthSpending) * 100
        : 0;
    const isLessSpending = vsLastMonth < 0;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Pacing bar color
    const pacingColor = isOverspending
        ? 'from-orange-500 to-rose-500'
        : 'from-emerald-500 to-teal-500';

    return (
        <BentoCard
            colSpan={2}
            rowSpan={1}
            onClick={onClick}
            className={isDark
                ? 'bg-gradient-to-br from-violet-950/50 to-purple-900/30'
                : 'bg-gradient-to-br from-violet-100 to-purple-50 border border-violet-200'
            }
        >
            <BentoCardHeader
                title="Monthly Forecast"
                subtitle={`Day ${dayOfMonth} of ${daysInMonth}`}
                icon={<Sparkles className="w-4 h-4 text-violet-500" />}
            />
            <BentoCardContent className="gap-1">
                {/* Main row */}
                <div className="flex items-center justify-between gap-2">
                    {/* Left: Spent so far */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-muted-foreground leading-tight">Spent</p>
                        <p className={`text-lg font-bold leading-tight ${hideAmounts ? 'blur-md select-none' : ''}`}>
                            {formatCurrency(currentSpending)}
                        </p>
                    </div>

                    {/* Center: Pacing bullet chart with Today Marker */}
                    <div className="flex-1 px-1">
                        <div className="relative h-3 bg-muted/50 rounded-full overflow-visible">
                            {/* Spending progress bar */}
                            <div
                                className={`absolute top-0 left-0 h-full rounded-full transition-all duration-500 bg-gradient-to-r ${pacingColor}`}
                                style={{ width: `${Math.min(spendingProgress, 100)}%` }}
                            />
                            {/* Today Marker - vertical tick */}
                            <div
                                className="absolute top-[-2px] w-0.5 h-[calc(100%+4px)] bg-foreground rounded-full"
                                style={{ left: `${timeProgress}%` }}
                                title={`Day ${dayOfMonth}`}
                            />
                        </div>
                        {/* Pacing indicator text */}
                        <p className={`text-[10px] text-center leading-tight mt-0.5 font-medium ${isOverspending ? 'text-rose-500' : 'text-emerald-500'
                            }`}>
                            {isOverspending ? 'Ahead of pace' : 'On track'}
                        </p>
                    </div>

                    {/* Right: Prediction */}
                    <div className="flex-1 min-w-0 text-right">
                        <p className="text-[10px] text-muted-foreground leading-tight">Predicted</p>
                        <p className={`text-lg font-bold text-violet-500 leading-tight ${hideAmounts ? 'blur-md select-none' : ''}`}>
                            {formatCurrency(predictedTotal)}
                        </p>
                    </div>
                </div>

                {/* Bottom row - daily context + navigation */}
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/30">
                    <div className="flex items-center gap-2">
                        {/* Daily spending rate */}
                        <span className={`text-xs text-muted-foreground ${hideAmounts ? 'blur-sm select-none' : ''}`}>
                            ~{formatCurrency(dailyAverage)}/day
                        </span>

                        {/* vs last month */}
                        {lastMonthSpending > 0 && (
                            <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">•</span>
                                {isLessSpending ? (
                                    <TrendingDown className="w-3 h-3 text-emerald-500" />
                                ) : (
                                    <TrendingUp className="w-3 h-3 text-rose-500" />
                                )}
                                <span className={`text-xs font-medium ${isLessSpending ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    {isLessSpending ? '' : '+'}{vsLastMonth.toFixed(0)}%
                                </span>
                            </div>
                        )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
            </BentoCardContent>
        </BentoCard>
    );
}
