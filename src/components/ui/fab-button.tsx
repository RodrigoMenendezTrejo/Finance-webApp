'use client';

import { useState } from 'react';
import { Plus, Camera, Keyboard, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FABButtonProps {
    onCameraClick: () => void;
    onTextClick: () => void;
}

export function FABButton({ onCameraClick, onTextClick }: FABButtonProps) {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm -z-10"
                    onClick={() => setIsOpen(false)}
                />
            )}

            {/* Action buttons */}
            <div
                className={cn(
                    'absolute bottom-16 left-1/2 -translate-x-1/2',
                    'flex flex-col gap-3 items-center',
                    'transition-all duration-300',
                    isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                )}
            >
                {/* Camera option */}
                <button
                    onClick={() => {
                        onCameraClick();
                        setIsOpen(false);
                    }}
                    className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-full',
                        'bg-gradient-to-r from-violet-600 to-purple-600',
                        'text-white font-medium shadow-lg shadow-violet-500/30',
                        'hover:shadow-violet-500/50 hover:scale-105',
                        'transition-all duration-200',
                        'no-select'
                    )}
                >
                    <Camera className="w-5 h-5" />
                    <span>Scan Receipt</span>
                </button>

                {/* Text option */}
                <button
                    onClick={() => {
                        onTextClick();
                        setIsOpen(false);
                    }}
                    className={cn(
                        'flex items-center gap-3 px-4 py-3 rounded-full',
                        'bg-gradient-to-r from-blue-600 to-cyan-600',
                        'text-white font-medium shadow-lg shadow-blue-500/30',
                        'hover:shadow-blue-500/50 hover:scale-105',
                        'transition-all duration-200',
                        'no-select'
                    )}
                >
                    <Keyboard className="w-5 h-5" />
                    <span>Type Text</span>
                </button>
            </div>

            {/* Main FAB */}
            <button
                onClick={toggleMenu}
                className={cn(
                    'w-14 h-14 rounded-full',
                    'bg-gradient-to-r from-primary to-primary/80',
                    'flex items-center justify-center',
                    'shadow-lg shadow-primary/30',
                    'hover:shadow-primary/50 hover:scale-105',
                    'active:scale-95',
                    'transition-all duration-200',
                    'no-select'
                )}
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
                <div
                    className={cn(
                        'transition-transform duration-300',
                        isOpen && 'rotate-45'
                    )}
                >
                    {isOpen ? (
                        <X className="w-6 h-6 text-primary-foreground" />
                    ) : (
                        <Plus className="w-6 h-6 text-primary-foreground" />
                    )}
                </div>
            </button>
        </div>
    );
}
