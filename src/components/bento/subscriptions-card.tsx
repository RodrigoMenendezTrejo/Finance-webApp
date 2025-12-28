'use client';

import { useState } from 'react';
import { Repeat, TrendingUp, Receipt } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { cn } from '@/lib/utils';

interface RecurringData {
    subscriptions: { total: number; count: number };
    income: { total: number; count: number };
    bills: { total: number; count: number };
}

interface RecurringCardProps {
    data: RecurringData;
    onClick?: () => void;
}

type TabType = 'subscriptions' | 'income' | 'bills';

export function RecurringCard({
    data,
    onClick,
}: RecurringCardProps) {
    const [activeTab, setActiveTab] = useState<TabType>('subscriptions');

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const tabs: { key: TabType; label: string; icon: typeof Repeat; color: string }[] = [
        { key: 'subscriptions', label: 'Subs', icon: Repeat, color: 'purple' },
        { key: 'income', label: 'Income', icon: TrendingUp, color: 'emerald' },
        { key: 'bills', label: 'Bills', icon: Receipt, color: 'orange' },
    ];

    const activeData = data[activeTab];
    const activeTabConfig = tabs.find(t => t.key === activeTab)!;
    const totalCount = data.subscriptions.count + data.income.count + data.bills.count;

    const colorClasses = {
        subscriptions: {
            text: 'text-purple-500',
            bg: 'bg-purple-500',
            bgLight: 'from-purple-500/10 to-purple-600/5',
        },
        income: {
            text: 'text-emerald-500',
            bg: 'bg-emerald-500',
            bgLight: 'from-emerald-500/10 to-emerald-600/5',
        },
        bills: {
            text: 'text-orange-500',
            bg: 'bg-orange-500',
            bgLight: 'from-orange-500/10 to-orange-600/5',
        },
    };

    const colors = colorClasses[activeTab];

    return (
        <BentoCard
            colSpan={2}
            rowSpan={1}
            onClick={onClick}
            className={`bg-gradient-to-br ${colors.bgLight}`}
        >
            <BentoCardHeader
                title="Recurring"
                subtitle={`${totalCount} active`}
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
                            'flex-1 py-1 px-2 rounded-md text-xs font-medium transition-all',
                            activeTab === tab.key
                                ? `${colorClasses[tab.key].bg} text-white`
                                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                        )}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <BentoCardContent>
                <span className={`text-xl font-bold ${colors.text}`}>
                    {activeTab === 'income' ? '+' : '-'}{formatCurrency(activeData.total)}
                </span>
                <span className="text-xs text-muted-foreground">
                    {activeData.count} {activeTab === 'income' ? 'sources' : 'active'} /month
                </span>
            </BentoCardContent>
        </BentoCard>
    );
}

// Legacy export for compatibility - deprecated
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
    return (
        <RecurringCard
            data={{
                subscriptions: { total: monthlyTotal, count: activeCount },
                income: { total: 0, count: 0 },
                bills: { total: 0, count: 0 },
            }}
            onClick={onClick}
        />
    );
}
