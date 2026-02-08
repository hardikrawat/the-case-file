'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';

interface ProgressBarProps {
    progress?: number; // 0 to 100
    label?: string;
    className?: string;
    isIndeterminate?: boolean;
}

const ProgressBar = ({ progress = 0, label, className, isIndeterminate = false }: ProgressBarProps) => {
    return (
        <div className={twMerge('flex flex-col gap-1.5 w-full max-w-[200px]', className)}>
            {label && (
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] uppercase font-serif tracking-widest text-stone-500 font-bold">
                        {label}
                    </span>
                    {!isIndeterminate && (
                        <span className="text-[10px] font-mono text-stone-400">
                            {Math.round(progress)}%
                        </span>
                    )}
                </div>
            )}

            <div className="h-2 w-full investigation-track rounded-full overflow-hidden relative">
                <div
                    className={twMerge(
                        "h-full red-string transition-all duration-500 ease-out rounded-full",
                        isIndeterminate && "w-1/3 animate-[indeterminate-string_1.5s_infinite_ease-in-out]"
                    )}
                    style={{
                        width: isIndeterminate ? undefined : `${progress}%`,
                        // Add some CSS-in-JS for the indeterminate animation if not in globals.css
                    }}
                />
            </div>

            <style jsx>{`
                @keyframes indeterminate-string {
                    0% { transform: translateX(-100%) skewX(-20deg); }
                    50% { transform: translateX(100%) skewX(20deg); }
                    100% { transform: translateX(300%) skewX(-20deg); }
                }
            `}</style>
        </div>
    );
};

export default ProgressBar;
