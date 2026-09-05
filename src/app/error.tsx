'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Error:', error);
    }, [error]);

    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-500">
            <div className="text-center max-w-md">
                <div className="mb-8">
                    <h1 className="text-6xl font-bold text-red-500 font-serif mb-4">Error</h1>
                    <h2 className="text-2xl font-bold text-foreground mb-2">Investigation Interrupted</h2>
                    <p className="text-panel-foreground/70">
                        Something went wrong during the investigation. The case hit an unexpected snag.
                    </p>

                    {error.message && (
                        <div className="mt-4 p-4 bg-red-950/20 border border-red-500/30 rounded-lg">
                            <p className="text-sm text-red-400 font-mono">{error.message}</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-3 bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground font-semibold rounded-lg transition-all duration-200 shadow-md"
                    >
                        Try Again
                    </button>
                    <Link
                        href="/cases"
                        className="px-6 py-3 bg-panel hover:bg-panel/80 border border-panel-border text-panel-foreground font-medium rounded-lg transition-all duration-200 shadow-sm"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
