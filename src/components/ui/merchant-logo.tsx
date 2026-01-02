'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

// Brandfetch client ID
const BRANDFETCH_CLIENT_ID = '1idGITPJrDvSud3m2sr';

// Static icons for system/common events that shouldn't use brand logos
const systemIcons: Record<string, string> = {
    salary: '💰',
    salario: '💰',
    freelance: '💼',
    transfer: '↔️',
    transferencia: '↔️',
    rent: '🏠',
    alquiler: '🏠',
    groceries: '🛒',
    supermercado: '🛒',
    bizum: '📱',
    income: '💵',
    ingreso: '💵',
    savings: '🏦',
    'savings goal': '🎯',
    goal: '🎯',
};

// Common brand domains mapping for better logo matching
const brandDomains: Record<string, string> = {
    netflix: 'netflix.com',
    spotify: 'spotify.com',
    amazon: 'amazon.com',
    'amazon prime': 'amazon.com',
    uber: 'uber.com',
    'uber eats': 'ubereats.com',
    starbucks: 'starbucks.com',
    mcdonalds: 'mcdonalds.com',
    "mcdonald's": 'mcdonalds.com',
    'burger king': 'burgerking.com',
    zara: 'zara.com',
    ikea: 'ikea.com',
    apple: 'apple.com',
    google: 'google.com',
    microsoft: 'microsoft.com',
    paypal: 'paypal.com',
    steam: 'store.steampowered.com',
    nintendo: 'nintendo.com',
    playstation: 'playstation.com',
    xbox: 'xbox.com',
    hbo: 'hbomax.com',
    disney: 'disneyplus.com',
    'disney+': 'disneyplus.com',
    youtube: 'youtube.com',
    twitch: 'twitch.tv',
    github: 'github.com',
    openai: 'openai.com',
    chatgpt: 'openai.com',
    notion: 'notion.so',
    figma: 'figma.com',
    slack: 'slack.com',
    zoom: 'zoom.us',
    dropbox: 'dropbox.com',
    airbnb: 'airbnb.com',
    booking: 'booking.com',
    ryanair: 'ryanair.com',
    vueling: 'vueling.com',
    iberia: 'iberia.com',
    mercadona: 'mercadona.es',
    carrefour: 'carrefour.es',
    lidl: 'lidl.es',
    aldi: 'aldi.es',
    glovo: 'glovoapp.com',
    deliveroo: 'deliveroo.com',
    'just eat': 'just-eat.es',
};

// Generate consistent color from name for fallback avatar
const getAvatarColor = (name: string): string => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
        '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Get initials from name
const getInitials = (name: string): string => {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
};

// Try to get domain from merchant name
const getDomain = (name: string): string | null => {
    const normalized = name.toLowerCase().trim();

    // Check known brand mappings first
    if (brandDomains[normalized]) {
        return brandDomains[normalized];
    }

    // Check if any key contains the name or vice versa
    for (const [brand, domain] of Object.entries(brandDomains)) {
        if (normalized.includes(brand) || brand.includes(normalized)) {
            return domain;
        }
    }

    // Try to construct domain (works for simple cases like "Netflix" -> "netflix.com")
    const simpleDomain = normalized.replace(/[^a-z0-9]/g, '') + '.com';
    return simpleDomain;
};

// Check if this is a system event that should use emoji
const isSystemEvent = (name: string, category?: string): string | null => {
    const normalized = name.toLowerCase().trim();
    const categoryNorm = category?.toLowerCase().trim() || '';

    // Check name first
    if (systemIcons[normalized]) {
        return systemIcons[normalized];
    }

    // Check category
    if (systemIcons[categoryNorm]) {
        return systemIcons[categoryNorm];
    }

    // Check if name contains any system keywords
    for (const [keyword, icon] of Object.entries(systemIcons)) {
        if (normalized.includes(keyword)) {
            return icon;
        }
    }

    return null;
};

interface MerchantLogoProps {
    name: string;
    category?: string;
    isIncome?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg';
    className?: string;
}

export function MerchantLogo({
    name,
    category,
    isIncome = false,
    size = 'md',
    className
}: MerchantLogoProps) {
    const [logoError, setLogoError] = useState(false);
    const [logoLoaded, setLogoLoaded] = useState(false);

    // Determine if this should use a system icon
    const systemIcon = isSystemEvent(name, category);

    // Get domain for brand logo
    const domain = !systemIcon ? getDomain(name) : null;

    // Brandfetch URL with lettermark fallback
    const logoUrl = domain
        ? `https://cdn.brandfetch.io/${domain}/w/120/h/120/theme/dark/fallback/lettermark/type/icon?c=${BRANDFETCH_CLIENT_ID}`
        : null;

    // Size classes
    const sizeClasses = {
        xs: 'w-7 h-7 text-xs',
        sm: 'w-9 h-9 text-sm',
        md: 'w-11 h-11 text-base',
        lg: 'w-14 h-14 text-lg',
    };

    // Background colors
    const bgColor = isIncome
        ? 'bg-emerald-500/20'
        : 'bg-muted';

    const avatarColor = getAvatarColor(name);

    // Reset error state when name changes
    useEffect(() => {
        setLogoError(false);
        setLogoLoaded(false);
    }, [name]);

    // If system icon, render emoji
    if (systemIcon) {
        return (
            <div
                className={cn(
                    'rounded-xl flex items-center justify-center',
                    sizeClasses[size],
                    bgColor,
                    isIncome && 'ring-1 ring-emerald-500/30',
                    className
                )}
            >
                <span className="text-2xl">{systemIcon}</span>
            </div>
        );
    }

    // Try brand logo, fallback to initials
    const showBackground = logoError || !logoLoaded;

    return (
        <div
            className={cn(
                'rounded-xl flex items-center justify-center overflow-hidden',
                sizeClasses[size],
                showBackground && bgColor,
                isIncome && showBackground && 'ring-1 ring-emerald-500/30',
                className
            )}
            style={logoError ? { backgroundColor: avatarColor + '30' } : undefined}
        >
            {logoUrl && !logoError ? (
                <>
                    {!logoLoaded && (
                        <span
                            className="font-bold"
                            style={{ color: avatarColor }}
                        >
                            {getInitials(name)}
                        </span>
                    )}
                    <img
                        src={logoUrl}
                        alt={name}
                        className={cn(
                            'w-full h-full object-contain',
                            !logoLoaded && 'hidden'
                        )}
                        onLoad={() => setLogoLoaded(true)}
                        onError={() => setLogoError(true)}
                    />
                </>
            ) : (
                <span
                    className="font-bold"
                    style={{ color: avatarColor }}
                >
                    {getInitials(name)}
                </span>
            )}
        </div>
    );
}
