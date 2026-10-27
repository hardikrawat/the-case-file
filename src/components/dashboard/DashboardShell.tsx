'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { TopNavbar } from '@/components/dashboard/TopNavbar';

interface DashboardShellProps {
    children: React.ReactNode;
    rightPanel: React.ReactNode;
}

export function DashboardShell({ children, rightPanel }: DashboardShellProps) {
    const pathname = usePathname();
    const isBoard = pathname.startsWith('/board/');

    return (
        <div className="flex flex-col h-screen w-screen font-sans bg-background text-foreground transition-colors duration-500 overflow-hidden relative">
            {/* Minimalist Top Navigation Header */}
            <TopNavbar />

            {/* Content Viewport */}
            <div className="flex-1 flex overflow-hidden min-w-0 h-[calc(100vh-3.5rem)]">
                <main
                    className={`flex-1 min-w-0 h-full ${
                        isBoard
                            ? 'p-0 relative overflow-hidden'
                            : 'overflow-y-auto no-scrollbar p-6 md:p-8'
                    }`}
                >
                    {children}
                </main>

                {/* Auxiliary RightPanel on non-board wide screens */}
                {!isBoard && rightPanel}
            </div>
        </div>
    );
}

export default DashboardShell;
