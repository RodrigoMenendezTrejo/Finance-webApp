'use client';

import { Repeat } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';

interface SubscriptionsCardProps {
    monthlyTotal: number;
    activeCount: number;
    onClick?: () => void;
}

export function SubscriptionsCard({
    monthlyTotal,
    activeCount,
    onClick,
}: SubscriptionsCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    return (
        <BentoCard
            colSpan={1}
            rowSpan={1}
            onClick={onClick}
            className="bg-gradient-to-br from-purple-500/10 to-purple-600/5"
        >
            <BentoCardHeader
                title="Recurring"
                subtitle={`${activeCount} active`}
                icon={<Repeat className="w-4 h-4 text-purple-500" />}
            />
            <BentoCardContent>
                <span className="text-xl font-bold text-purple-500">
                    -{formatCurrency(monthlyTotal)}
                </span>
                <span className="text-xs text-muted-foreground">/month</span>
            </BentoCardContent>
        </BentoCard>
    );
}
