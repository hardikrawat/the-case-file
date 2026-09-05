"use client";

import AppleSpinner from "@/components/ui/AppleSpinner";

interface DashboardLoadingProps {
    status?: string | null;
}

export default function DashboardLoading({ status = "Retrieving Case Files..." }: DashboardLoadingProps) {
    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-6 bg-background/80 backdrop-blur-md z-50 transition-colors">
            <div className="flex flex-col items-center gap-2.5 text-center animate-in fade-in duration-200">
                <AppleSpinner size="xl" className="text-[var(--sidebar-accent)]" />
                {status && (
                    <p className="text-xs font-mono font-medium text-foreground tracking-wide">
                        {status}
                    </p>
                )}
            </div>
        </div>
    );
}
