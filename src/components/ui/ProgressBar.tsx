'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';
import AppleSpinner from './AppleSpinner';

interface ProgressBarProps {
    progress?: number; // 0 to 100
    label?: string;
    className?: string;
    isIndeterminate?: boolean;
}

const ProgressBar = ({ progress = 0, label, className, isIndeterminate = false }: ProgressBarProps) => {
    if (isIndeterminate) {
        return (
            <div className={twMerge('inline-flex items-center gap-2.5', className)}>
                <AppleSpinner size="sm" />
                {label && (
                    <span className="text-xs font-mono font-medium text-foreground tracking-wide">
                        {label}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className={twMerge('flex flex-col gap-1.5 w-full max-w-[200px]', className)}>
            {label && (
                <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] uppercase font-serif tracking-widest text-panel-foreground opacity-60 font-bold">
                        {label}
                    </span>
                    <span className="text-[10px] font-mono text-panel-foreground opacity-40">
                        {Math.round(progress)}%
                    </span>
                </div>
            )}

            <div className="h-2 w-full investigation-track rounded-full overflow-hidden relative">
                <div
                    className="h-full red-string transition-all duration-500 ease-out rounded-full"
                    style={{
                        width: `${progress}%`,
                    }}
                />
            </div>
        </div>
    );
};

export default ProgressBar;
