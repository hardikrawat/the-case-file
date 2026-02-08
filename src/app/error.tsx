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
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <div className="mb-8">
                    <h1 className="text-6xl font-bold text-red-500/70 font-serif mb-4">Error</h1>
                    <h2 className="text-2xl font-bold text-stone-200 mb-2">Investigation Interrupted</h2>
                    <p className="text-stone-400">
                        Something went wrong during the investigation. The case hit an unexpected snag.
                    </p>

                    {error.message && (
                        <div className="mt-4 p-4 bg-red-950/30 border border-red-900/50 rounded-lg">
                            <p className="text-sm text-red-400 font-mono">{error.message}</p>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 justify-center">
                    <button
                        onClick={reset}
                        className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-semibold rounded-lg transition-all duration-200"
                    >
                        Try Again
                    </button>
                    <Link
                        href="/cases"
                        className="px-6 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-medium rounded-lg transition-all duration-200"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
