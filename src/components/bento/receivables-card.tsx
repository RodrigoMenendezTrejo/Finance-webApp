'use client';

import { Users } from 'lucide-react';
import { BentoCard, BentoCardHeader, BentoCardContent } from './bento-grid';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface Receivable {
    id: string;
    name: string;
    amount: number;
    avatarColor: string;
}

interface ReceivablesCardProps {
    receivables: Receivable[];
    totalAmount: number;
    onClick?: () => void;
}

export function ReceivablesCard({
    receivables,
    totalAmount,
    onClick,
}: ReceivablesCardProps) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency: 'EUR',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <BentoCard
            colSpan={2}
            rowSpan={1}
            onClick={onClick}
            className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5"
        >
            <BentoCardHeader
                title="Receivables"
                subtitle={`${receivables.length} people`}
                icon={<Users className="w-4 h-4 text-emerald-500" />}
            />
            <BentoCardContent className="flex-row items-center justify-between">
                {/* Avatar stack */}
                <div className="flex -space-x-2">
                    {receivables.slice(0, 4).map((receivable, index) => (
                        <Avatar
                            key={receivable.id}
                            className="w-8 h-8 border-2 border-card"
                            style={{ zIndex: receivables.length - index }}
                        >
                            <AvatarFallback
                                style={{ backgroundColor: receivable.avatarColor }}
                                className="text-xs font-medium text-white"
                            >
                                {getInitials(receivable.name)}
                            </AvatarFallback>
                        </Avatar>
                    ))}
                    {receivables.length > 4 && (
                        <Avatar className="w-8 h-8 border-2 border-card">
                            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                                +{receivables.length - 4}
                            </AvatarFallback>
                        </Avatar>
                    )}
                </div>

                {/* Total amount */}
                <div className="text-right">
                    <span className="text-xl font-bold text-emerald-500">
                        {formatCurrency(totalAmount)}
                    </span>
                </div>
            </BentoCardContent>
        </BentoCard>
    );
}
