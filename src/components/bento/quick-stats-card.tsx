'use client';

import { Wallet, CreditCard, PiggyBank, ArrowRightLeft } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { AccountType } from '@/types/firestore';

interface QuickStatsCardProps {
    type: 'assets' | 'liabilities' | 'balance';
    amount: number;
    label: string;
    accountCount?: number;
    onClick?: () => void;
}

export function QuickStatsCard({
    type,
    amount,
    label,
    accountCount,
    onClick,
}: QuickStatsCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const config = {
        assets: {
            icon: Wallet,
            color: 'text-blue-500',
            bgGradient: 'from-blue-500/10 to-blue-600/5',
        },
        liabilities: {
            icon: CreditCard,
            color: 'text-rose-500',
            bgGradient: 'from-rose-500/10 to-rose-600/5',
        },
        balance: {
            icon: PiggyBank,
            color: 'text-emerald-500',
            bgGradient: 'from-emerald-500/10 to-emerald-600/5',
        },
    };

    const { icon: Icon, color, bgGradient } = config[type];

    return (
        <BentoCard
            colSpan={1}
            rowSpan={1}
            onClick={onClick}
            className={`bg-gradient-to-br ${bgGradient}`}
        >
            <BentoCardHeader
                title={label}
                subtitle={accountCount ? `${accountCount} accounts` : undefined}
                icon={<Icon className={`w-4 h-4 ${color}`} />}
            />
            <BentoCardContent>
                <span className={`text-xl font-bold ${color}`}>
                    {formatCurrency(amount)}
                </span>
            </BentoCardContent>
        </BentoCard>
    );
}

// Recent activity card
interface RecentActivityCardProps {
    count: number;
    onClick?: () => void;
}

export function RecentActivityCard({ count, onClick }: RecentActivityCardProps) {
    return (
        <BentoCard colSpan={1} rowSpan={1} onClick={onClick}>
            <BentoCardHeader
                title="Recent"
                subtitle="Transactions"
                icon={<ArrowRightLeft className="w-4 h-4" />}
            />
            <BentoCardContent>
                <span className="text-xl font-bold text-foreground">{count}</span>
                <span className="text-xs text-muted-foreground">this week</span>
            </BentoCardContent>
        </BentoCard>
    );
}
