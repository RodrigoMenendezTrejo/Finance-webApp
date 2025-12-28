'use client';

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface BentoGridProps {
    children: ReactNode;
    className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
    return (
        <div
            className={cn(
                'grid gap-4 p-4',
                'grid-cols-2 md:grid-cols-4',
                'auto-rows-[150px] md:auto-rows-[140px]',
                className
            )}
        >
            {children}
        </div>
    );
}

interface BentoCardProps {
    children: ReactNode;
    className?: string;
    colSpan?: 1 | 2 | 3 | 4;
    rowSpan?: 1 | 2 | 3;
    onClick?: () => void;
}

export function BentoCard({
    children,
    className,
    colSpan = 1,
    rowSpan = 1,
    onClick,
}: BentoCardProps) {
    const colSpanClasses = {
        1: 'col-span-1',
        2: 'col-span-2',
        3: 'col-span-3',
        4: 'col-span-4',
    };

    const rowSpanClasses = {
        1: 'row-span-1',
        2: 'row-span-2',
        3: 'row-span-3',
    };

    return (
        <div
            className={cn(
                // Base styles
                'group relative overflow-hidden rounded-2xl',
                'bg-gradient-to-br from-card to-card/80',
                'border border-border/50',
                'p-4 flex flex-col',
                // Hover effects
                'transition-all duration-300 ease-out',
                'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
                'hover:scale-[1.02]',
                // Glassmorphism
                'backdrop-blur-sm',
                // Span classes
                colSpanClasses[colSpan],
                rowSpanClasses[rowSpan],
                // Clickable styles
                onClick && 'cursor-pointer active:scale-[0.98]',
                className
            )}
            onClick={onClick}
        >
            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Content */}
            <div className="relative z-10 flex flex-col h-full">
                {children}
            </div>
        </div>
    );
}

interface BentoCardHeaderProps {
    title: string;
    subtitle?: ReactNode;
    icon?: ReactNode;
}

export function BentoCardHeader({ title, subtitle, icon }: BentoCardHeaderProps) {
    return (
        <div className="flex items-start justify-between mb-2">
            <div>
                <h3 className="font-semibold text-sm text-foreground">{title}</h3>
                {subtitle && (
                    <p className="text-xs text-muted-foreground">{subtitle}</p>
                )}
            </div>
            {icon && (
                <div className="text-muted-foreground group-hover:text-primary transition-colors">
                    {icon}
                </div>
            )}
        </div>
    );
}

interface BentoCardContentProps {
    children: ReactNode;
    className?: string;
}

export function BentoCardContent({ children, className }: BentoCardContentProps) {
    return (
        <div className={cn('flex-1 flex flex-col justify-center', className)}>
            {children}
        </div>
    );
}
