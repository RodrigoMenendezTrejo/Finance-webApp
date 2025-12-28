'use client';

import { useState } from 'react';
import { Wallet, CreditCard, PiggyBank, ArrowRightLeft } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { cn } from '@/lib/utils';

// Combined Assets & Liabilities card with tabs
interface FinancialOverviewData {
    assets: { amount: number; count: number };
    liabilities: { amount: number; count: number };
}

interface FinancialOverviewCardProps {
    data: FinancialOverviewData;
    onAssetsClick?: () => void;
    onLiabilitiesClick?: () => void;
}

type FinancialTab = 'assets' | 'liabilities';

export function FinancialOverviewCard({
    data,
    onAssetsClick,
    onLiabilitiesClick,
}: FinancialOverviewCardProps) {
    const [activeTab, setActiveTab] = useState<FinancialTab>('assets');

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const tabs: { key: FinancialTab; label: string; icon: typeof Wallet; color: string }[] = [
        { key: 'assets', label: 'Assets', icon: Wallet, color: 'blue' },
        { key: 'liabilities', label: 'Liabilities', icon: CreditCard, color: 'rose' },
    ];

    const activeData = data[activeTab];
    const activeTabConfig = tabs.find(t => t.key === activeTab)!;
    const netWorth = data.assets.amount - data.liabilities.amount;

    const colorClasses = {
        assets: {
            text: 'text-blue-500',
            bg: 'bg-blue-500',
            bgLight: 'from-blue-500/10 to-blue-600/5',
        },
        liabilities: {
            text: 'text-rose-500',
            bg: 'bg-rose-500',
            bgLight: 'from-rose-500/10 to-rose-600/5',
        },
    };

    const colors = colorClasses[activeTab];

    const handleClick = () => {
        if (activeTab === 'assets' && onAssetsClick) {
            onAssetsClick();
        } else if (activeTab === 'liabilities' && onLiabilitiesClick) {
            onLiabilitiesClick();
        }
    };

    return (
        <BentoCard
            colSpan={2}
            rowSpan={1}
            onClick={handleClick}
            className={`bg-gradient-to-br ${colors.bgLight}`}
        >
            <BentoCardHeader
                title="Financial Overview"
                subtitle={`Net Worth: ${formatCurrency(netWorth)}`}
                icon={<activeTabConfig.icon className={`w-4 h-4 ${colors.text}`} />}
            />

            {/* Tab selector */}
            <div className="flex gap-1 px-1 mb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveTab(tab.key);
                        }}
                        className={cn(
                            'flex-1 py-1.5 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2',
                            activeTab === tab.key
                                ? `${colorClasses[tab.key].bg} text-white`
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            <BentoCardContent>
                <div className="flex items-baseline gap-2">
                    <span className={`text-2xl font-bold ${colors.text}`}>
                        {formatCurrency(activeData.amount)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {activeData.count} {activeData.count === 1 ? 'account' : 'accounts'}
                    </span>
                </div>
            </BentoCardContent>
        </BentoCard>
    );
}

// Legacy individual cards - kept for compatibility
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

// Recent activity card - now full width
interface RecentActivityCardProps {
    count: number;
    onClick?: () => void;
}

export function RecentActivityCard({ count, onClick }: RecentActivityCardProps) {
    return (
        <BentoCard colSpan={2} rowSpan={1} onClick={onClick}>
            <BentoCardHeader
                title="Recent Transactions"
                subtitle="this week"
                icon={<ArrowRightLeft className="w-4 h-4" />}
            />
            <BentoCardContent>
                <span className="text-2xl font-bold text-foreground">{count}</span>
                <span className="text-sm text-muted-foreground ml-2">transactions</span>
            </BentoCardContent>
        </BentoCard>
    );
}
