import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 transition-colors duration-500">
            <div className="text-center max-w-md">
                <div className="mb-8">
                    <h1 className="text-9xl font-bold text-sidebar-accent/20 font-serif">404</h1>
                    <h2 className="text-3xl font-bold text-foreground mt-4 mb-2">Case Not Found</h2>
                    <p className="text-panel-foreground/70 text-lg">
                        This investigation has gone cold. The evidence you&apos;re looking for doesn&apos;t exist.
                    </p>
                </div>

                <div className="flex gap-4 justify-center">
                    <Link
                        href="/cases"
                        className="px-6 py-3 bg-sidebar-accent hover:bg-sidebar-accent/90 text-sidebar-accent-foreground font-semibold rounded-lg transition-all duration-200 shadow-md"
                    >
                        Return to Dashboard
                    </Link>
                    <Link
                        href="/"
                        className="px-6 py-3 bg-panel hover:bg-panel/80 border border-panel-border text-panel-foreground font-medium rounded-lg transition-all duration-200 shadow-sm"
                    >
                        Go Home
                    </Link>
                </div>

                {/* Detective illustration */}
                <div className="mt-12 text-panel-foreground/20">
                    <svg className="w-32 h-32 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
                    </svg>
                </div>
            </div>
        </div>
    );
}
