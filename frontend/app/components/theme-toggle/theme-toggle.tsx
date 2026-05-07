'use client';

import { useTheme } from '@/app/context/ThemeContext';
import { useEffect, useState } from 'react';

export const ThemeToggle = () => {
    const { theme, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <button
            onClick={toggleTheme}
            className="fixed top-4 right-4 z-50 p-3 rounded-full glass-panel hover:bg-white/10 transition-all duration-300 hover:scale-110 group"
            aria-label="Toggle Theme"
        >
            <span className="text-xl group-hover:rotate-90 transition-transform duration-500 block">
                {theme === 'dark' ? '🌙' : '☀️'}
            </span>
        </button>
    );
};
