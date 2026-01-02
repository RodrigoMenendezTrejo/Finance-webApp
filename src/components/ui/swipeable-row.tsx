'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SwipeableRowProps {
    children: ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
    className?: string;
}

export function SwipeableRow({
    children,
    onEdit,
    onDelete,
    className
}: SwipeableRowProps) {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [isHovered, setIsHovered] = useState(false);
    const [isSwiping, setIsSwiping] = useState(false);
    const startXRef = useRef(0);
    const currentXRef = useRef(0);
    const rowRef = useRef<HTMLDivElement>(null);

    const ACTION_WIDTH = 140; // Width of action buttons area
    const SWIPE_THRESHOLD = 50; // Minimum swipe distance to trigger

    const handleTouchStart = (e: React.TouchEvent) => {
        startXRef.current = e.touches[0].clientX;
        currentXRef.current = e.touches[0].clientX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isSwiping) return;

        currentXRef.current = e.touches[0].clientX;
        const diff = startXRef.current - currentXRef.current;

        // Only allow left swipe (positive diff) up to ACTION_WIDTH
        if (diff > 0) {
            setSwipeOffset(Math.min(diff, ACTION_WIDTH));
        } else if (swipeOffset > 0) {
            // Allow swiping back
            setSwipeOffset(Math.max(0, swipeOffset + diff / 2));
        }
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);

        // Snap to open or closed
        if (swipeOffset > SWIPE_THRESHOLD) {
            setSwipeOffset(ACTION_WIDTH);
        } else {
            setSwipeOffset(0);
        }
    };

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (rowRef.current && !rowRef.current.contains(e.target as Node)) {
                setSwipeOffset(0);
            }
        };

        if (swipeOffset > 0) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [swipeOffset]);

    const handleEdit = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSwipeOffset(0);
        onEdit?.();
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setSwipeOffset(0);
        onDelete?.();
    };

    return (
        <div
            ref={rowRef}
            className={cn('relative rounded-xl', className)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Swipeable content with background */}
            <div
                className={cn(
                    'relative rounded-xl transition-transform duration-200 ease-out',
                    !isSwiping && 'duration-300'
                )}
                style={{
                    transform: `translateX(-${swipeOffset}px)`,
                }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
            >
                {/* Desktop hover actions - only show on desktop when hovering */}
                <div
                    className={cn(
                        'absolute right-3 top-1/2 -translate-y-1/2 flex gap-1 z-10 transition-opacity duration-200',
                        'opacity-0 pointer-events-none',
                        isHovered && swipeOffset === 0 && 'md:opacity-100 md:pointer-events-auto'
                    )}
                >
                    {onEdit && (
                        <button
                            onClick={handleEdit}
                            className="p-2 rounded-lg bg-blue-500/30 hover:bg-blue-500/50 transition-colors backdrop-blur-sm"
                        >
                            <Pencil className="w-4 h-4 text-blue-300" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={handleDelete}
                            className="p-2 rounded-lg bg-rose-500/30 hover:bg-rose-500/50 transition-colors backdrop-blur-sm"
                        >
                            <Trash2 className="w-4 h-4 text-rose-300" />
                        </button>
                    )}
                </div>

                {children}
            </div>

            {/* Mobile swipe action buttons - positioned behind content, revealed on swipe */}
            {swipeOffset > 0 && (
                <div
                    className="absolute right-0 top-0 h-full flex items-stretch rounded-r-xl overflow-hidden"
                    style={{ width: swipeOffset }}
                >
                    {onEdit && (
                        <button
                            onClick={handleEdit}
                            className="flex-1 flex items-center justify-center bg-blue-500 hover:bg-blue-600 transition-colors min-w-[70px]"
                        >
                            <Pencil className="w-5 h-5 text-white" />
                        </button>
                    )}
                    {onDelete && (
                        <button
                            onClick={handleDelete}
                            className="flex-1 flex items-center justify-center bg-rose-500 hover:bg-rose-600 transition-colors min-w-[70px]"
                        >
                            <Trash2 className="w-5 h-5 text-white" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
