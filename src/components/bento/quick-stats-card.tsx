'use client';

import { useState } from 'react';
import { Wallet, CreditCard, PiggyBank, ArrowRightLeft } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { MerchantLogo } from '@/components/ui/merchant-logo';
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
    hideAmounts?: boolean;
}

type FinancialTab = 'assets' | 'liabilities';

export function FinancialOverviewCard({
    data,
    onAssetsClick,
    onLiabilitiesClick,
    hideAmounts = false,
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
                subtitle={<span className={hideAmounts ? 'blur-sm select-none' : ''}>Net Worth: {formatCurrency(netWorth)}</span>}
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
                    <span className={`text-2xl font-bold ${colors.text} ${hideAmounts ? 'blur-md select-none' : ''}`}>
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

// Recent activity card - now shows mini feed of last 3 transactions
interface RecentTransaction {
    id: string;
    payee: string;
    amount: number;
    type: 'expense' | 'income' | 'transfer';
    category: string;
}

interface RecentActivityCardProps {
    transactions: RecentTransaction[];
    onClick?: () => void;
}

export function RecentActivityCard({ transactions, onClick }: RecentActivityCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const displayTxs = transactions.slice(0, 2);

    return (
        <BentoCard
            colSpan={1}
            rowSpan={1}
            onClick={onClick}
            className="bg-gradient-to-br from-amber-500/10 to-amber-600/5"
        >
            <BentoCardHeader
                title="Recent Transactions"
                subtitle={`${transactions.length} this week`}
                icon={<ArrowRightLeft className="w-4 h-4 text-amber-500" />}
            />
            <BentoCardContent>
                {displayTxs.length > 0 ? (
                    <div className="space-y-2 w-full">
                        {displayTxs.map((tx) => (
                            <div key={tx.id} className="flex items-center gap-2">
                                {/* Merchant logo */}
                                <MerchantLogo
                                    name={tx.payee}
                                    category={tx.category}
                                    isIncome={tx.type === 'income'}
                                    size="xs"
                                />
                                {/* Name */}
                                <span className="flex-1 text-sm truncate font-medium">
                                    {tx.payee}
                                </span>
                                {/* Amount */}
                                <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-emerald-500' : 'text-foreground'
                                    }`}>
                                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">No recent transactions</span>
                )}
            </BentoCardContent>
        </BentoCard>
    );
}

// Goals summary card
interface GoalsCardProps {
    goalCount: number;
    totalProgress: number; // 0-100
    onClick?: () => void;
}

export function GoalsCard({ goalCount, totalProgress, onClick }: GoalsCardProps) {
    return (
        <BentoCard
            colSpan={1}
            rowSpan={1}
            onClick={onClick}
            className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5"
        >
            <BentoCardHeader
                title="Savings Goals"
                subtitle={goalCount > 0 ? `${goalCount} active` : 'Set your goals'}
                icon={<PiggyBank className="w-4 h-4 text-cyan-500" />}
            />
            <BentoCardContent>
                {goalCount > 0 ? (
                    <div className="w-full">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium text-cyan-500">{totalProgress.toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-cyan-500 rounded-full transition-all"
                                style={{ width: `${Math.min(totalProgress, 100)}%` }}
                            />
                        </div>
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">Tap to start</span>
                )}
            </BentoCardContent>
        </BentoCard>
    );
}

// Budget limits card
interface BudgetsCardProps {
    budgetCount: number;
    usedPercent: number; // 0-100 overall budget usage
    overBudgetCount: number;
    onClick?: () => void;
}

export function BudgetsCard({ budgetCount, usedPercent, overBudgetCount, onClick }: BudgetsCardProps) {
    return (
        <BentoCard
            colSpan={2}
            rowSpan={1}
            onClick={onClick}
            className="bg-gradient-to-br from-violet-500/10 to-violet-600/5"
        >
            <BentoCardHeader
                title="Budget Limits"
                subtitle={budgetCount > 0 ? `${budgetCount} categories` : 'Set limits'}
                icon={<Wallet className="w-4 h-4 text-violet-500" />}
            />
            <BentoCardContent>
                {budgetCount > 0 ? (
                    <div className="w-full">
                        <div className="flex justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Usage</span>
                            <span className={`font-medium ${overBudgetCount > 0 ? 'text-rose-500' :
                                usedPercent > 80 ? 'text-amber-500' :
                                    'text-violet-500'
                                }`}>
                                {usedPercent.toFixed(0)}%
                            </span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all ${overBudgetCount > 0 ? 'bg-rose-500' :
                                    usedPercent > 80 ? 'bg-amber-500' :
                                        'bg-violet-500'
                                    }`}
                                style={{ width: `${Math.min(usedPercent, 100)}%` }}
                            />
                        </div>
                        {overBudgetCount > 0 && (
                            <p className="text-xs text-rose-500 mt-1">{overBudgetCount} over budget</p>
                        )}
                    </div>
                ) : (
                    <span className="text-sm text-muted-foreground">Tap to set limits</span>
                )}
            </BentoCardContent>
        </BentoCard>
    );
}

