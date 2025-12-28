'use client';

import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';

type BudgetStatus = 'under' | 'on-track' | 'over';

interface BudgetIndicatorProps {
    spent: number;
    budget: number;
    period: 'monthly' | 'annual';
    onTogglePeriod?: () => void;
}

export function BudgetIndicator({
    spent,
    budget,
    period,
    onTogglePeriod,
}: BudgetIndicatorProps) {
    const percentage = (spent / budget) * 100;
    const remaining = budget - spent;

    const getStatus = (): BudgetStatus => {
        if (percentage <= 80) return 'under';
        if (percentage <= 100) return 'on-track';
        return 'over';
    };

    const status = getStatus();

    const statusConfig = {
        under: {
            color: 'text-emerald-500',
            bgColor: 'bg-emerald-500',
            icon: TrendingDown,
            label: 'Under Budget',
        },
        'on-track': {
            color: 'text-amber-500',
            bgColor: 'bg-amber-500',
            icon: Minus,
            label: 'On Track',
        },
        over: {
            color: 'text-rose-500',
            bgColor: 'bg-rose-500',
            icon: TrendingUp,
            label: 'Over Budget',
        },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <BentoCard colSpan={1} rowSpan={1}>
            <BentoCardHeader
                title={period === 'monthly' ? 'This Month' : 'This Year'}
                icon={<Icon className={`w-4 h-4 ${config.color}`} />}
            />
            <BentoCardContent className="gap-2">
                {/* Progress bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                        className={`h-full ${config.bgColor} transition-all duration-500 rounded-full`}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                </div>

                {/* Amounts */}
                <div className="flex justify-between items-end text-xs">
                    <span className="text-muted-foreground">
                        {formatCurrency(spent)}
                    </span>
                    <span className={config.color}>
                        {remaining >= 0 ? `${formatCurrency(remaining)} left` : formatCurrency(Math.abs(remaining)) + ' over'}
                    </span>
                </div>

                {/* Toggle button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onTogglePeriod?.();
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                >
                    View {period === 'monthly' ? 'Annual' : 'Monthly'}
                </button>
            </BentoCardContent>
        </BentoCard>
    );
}
