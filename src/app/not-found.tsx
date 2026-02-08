import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950 flex items-center justify-center p-4">
            <div className="text-center">
                <div className="mb-8">
                    <h1 className="text-9xl font-bold text-amber-500/20 font-serif">404</h1>
                    <h2 className="text-3xl font-bold text-stone-200 mt-4 mb-2">Case Not Found</h2>
                    <p className="text-stone-400 text-lg">
                        This investigation has gone cold. The evidence you&apos;re looking for doesn&apos;t exist.
                    </p>
                </div>

                <div className="flex gap-4 justify-center">
                    <Link
                        href="/dashboard"
                        className="px-6 py-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-semibold rounded-lg transition-all duration-200"
                    >
                        Return to Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-stone-800 hover:bg-stone-700 border border-stone-700 text-stone-200 font-medium rounded-lg transition-all duration-200"
                    >
                        Go Home
                    </Link>
                </div>

                {/* Detective illustration */}
                <div className="mt-12 text-stone-700">
                    <svg className="w-32 h-32 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
