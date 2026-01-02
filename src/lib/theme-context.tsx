'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    setTheme: () => { },
    resolvedTheme: 'dark',
});

// This script runs before React hydrates to prevent FOUC
export const themeScript = `
(function() {
    try {
        var theme = localStorage.getItem('theme') || 'dark';
        var resolved = theme;
        if (theme === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.classList.remove('light', 'dark');
        document.documentElement.classList.add(resolved);
    } catch (e) {
        document.documentElement.classList.add('dark');
    }
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('dark');
    const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        // Read from localStorage on mount
        const stored = (localStorage.getItem('theme') as Theme) || 'dark';
        setThemeState(stored);
        applyTheme(stored);

        // Listen for system theme changes
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                applyTheme('system');
            }
        };
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    const applyTheme = (t: Theme) => {
        const root = document.documentElement;
        let resolved: 'light' | 'dark' = 'dark';

        if (t === 'system') {
            resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        } else {
            resolved = t;
        }

        root.classList.remove('light', 'dark');
        root.classList.add(resolved);
        setResolvedTheme(resolved);

        // Update theme-color meta for PWA
        const themeColor = resolved === 'dark' ? '#0a0a0a' : '#ffffff';
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
    };

    const setTheme = (t: Theme) => {
        localStorage.setItem('theme', t);
        setThemeState(t);
        applyTheme(t);
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export const useTheme = () => useContext(ThemeContext);
