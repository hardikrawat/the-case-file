'use client';

import { useEffect } from 'react';
import useStore from '@/store/useStore';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const theme = useStore((state) => state.theme);

    useEffect(() => {
        // Remove existing theme classes
        document.body.classList.remove(
            'theme-cork',
            'theme-noir',
            'theme-blueprint',
            'theme-minimal',
            'theme-profile'
        );
        // Add current theme class
        document.body.classList.add(theme);
    }, [theme]);

    return <>{children}</>;
}
