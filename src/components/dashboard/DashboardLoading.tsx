"use client";

import { FolderSearch, Lock } from "lucide-react";
import ProgressBar from "@/components/ui/ProgressBar";

interface DashboardLoadingProps {
    status?: string | null;
}

export default function DashboardLoading({ status = "Retrieving Case Files..." }: DashboardLoadingProps) {

    return (
        <div className="fixed inset-0 flex flex-col items-center justify-center p-8 bg-background font-mono z-50 transition-colors">
            <div className="flex flex-col items-center gap-6 max-w-sm w-full mx-auto">
                {/* Animated Archive Icon */}
                <div className="relative w-24 h-24 mb-4">
                    <div className="absolute inset-0 bg-sidebar-accent/10 rounded-full animate-pulse border border-sidebar-accent/30" />
                    <div className="absolute inset-2 bg-sidebar-accent/5 rounded-full animate-ping opacity-60" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <FolderSearch className="w-12 h-12 text-sidebar-accent animate-bounce" />
                    </div>
                </div>

                <div className="w-full text-center space-y-2">
                    <h2 className="text-xl font-bold font-serif text-sidebar-foreground uppercase tracking-widest">
                        {status}
                    </h2>
                    <p className="text-xs text-sidebar-foreground/60 font-mono flex items-center justify-center gap-2">
                        <Lock className="w-3 h-3" /> Secure Connection Established
                    </p>
                </div>

                <div className="w-full max-w-[240px]">
                    <ProgressBar
                        progress={0}
                        isIndeterminate={true}
                        label="Decryption Progress"
                        className="w-full"
                    />
                </div>

                {/* Simulated Log Output */}
                <div className="w-full bg-[var(--sidebar-background)] p-3 rounded-lg font-mono text-[10px] text-[var(--sidebar-accent)] border border-[var(--sidebar-accent)]/30 h-24 overflow-hidden relative shadow-inner">
                    <div className="absolute inset-0 bg-scanline pointer-events-none opacity-20" />
                    <code className="block flex flex-col gap-1">
                        <span>&gt; AUTH_HANDSHAKE_INIT... [OK]</span>
                        <span className="animate-reveal-1">&gt; SYNC_ARCHIVES... [PENDING]</span>
                        <span className="animate-reveal-2">&gt; DECRYPT_METADATA... [PROCESSING]</span>
                        <span className="animate-reveal-3">&gt; LOADING_CASE_FILES...</span>
                    </code>

                    {/* Scanline Animation */}
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--sidebar-accent)]/50 shadow-[0_0_10px_var(--sidebar-accent)] animate-scanline" />
                </div>
            </div>

            <style jsx>{`
                @keyframes reveal-1 { 0% { opacity: 0; } 30% { opacity: 0; } 100% { opacity: 1; } }
                @keyframes reveal-2 { 0% { opacity: 0; } 60% { opacity: 0; } 100% { opacity: 1; } }
                @keyframes reveal-3 { 0% { opacity: 0; } 90% { opacity: 0; } 100% { opacity: 1; } }
                .animate-reveal-1 { animation: reveal-1 2s forwards; }
                .animate-reveal-2 { animation: reveal-2 3s forwards; }
                .animate-reveal-3 { animation: reveal-3 4s forwards; }
                @keyframes scanline {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scanline {
                    animation: scanline 3s linear infinite;
                }
            `}</style>
        </div>
    );
}

// Simple fallback if ProgressBar isn't globally available or imported correctly
// (Assuming ProgressBar is default export from UI components as viewed earlier)
