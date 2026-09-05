'use client';

import React from 'react';
import { twMerge } from 'tailwind-merge';

export interface AppleSpinnerProps {
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
    color?: string;
    label?: string;
    description?: string;
    className?: string;
    labelClassName?: string;
    fullscreen?: boolean;
    overlay?: boolean;
    layout?: 'vertical' | 'horizontal';
}

const SPOKES = [
    { rotate: 0, opacity: 1.0 },
    { rotate: 30, opacity: 0.92 },
    { rotate: 60, opacity: 0.83 },
    { rotate: 90, opacity: 0.75 },
    { rotate: 120, opacity: 0.67 },
    { rotate: 150, opacity: 0.58 },
    { rotate: 180, opacity: 0.50 },
    { rotate: 210, opacity: 0.42 },
    { rotate: 240, opacity: 0.33 },
    { rotate: 270, opacity: 0.25 },
    { rotate: 300, opacity: 0.17 },
    { rotate: 330, opacity: 0.08 },
];

const SIZE_MAP = {
    xs: 'w-3.5 h-3.5',
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-9 h-9',
    xl: 'w-12 h-12',
};

export function AppleSpinner({
    size = 'md',
    color = 'currentColor',
    label,
    description,
    className,
    labelClassName,
    fullscreen = false,
    overlay = false,
    layout = 'vertical',
}: AppleSpinnerProps) {
    const sizeClass = typeof size === 'number' ? '' : SIZE_MAP[size] || SIZE_MAP.md;
    const style = typeof size === 'number' ? { width: size, height: size } : undefined;

    const spinnerSvg = (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            style={style}
            className={twMerge('animate-apple-spinner shrink-0', sizeClass, className)}
            xmlns="http://www.w3.org/2000/svg"
            role="status"
            aria-label={label || 'Loading...'}
        >
            {SPOKES.map((spoke, idx) => (
                <line
                    key={idx}
                    x1="12"
                    y1="2.5"
                    x2="12"
                    y2="6.5"
                    stroke={color}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity={spoke.opacity}
                    transform={`rotate(${spoke.rotate} 12 12)`}
                />
            ))}
        </svg>
    );

    if (fullscreen) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md transition-all duration-300 p-6 animate-in fade-in duration-200">
                <div className="flex flex-col items-center gap-2.5 text-center animate-in fade-in duration-200">
                    {spinnerSvg}
                    {label && (
                        <p className={twMerge("text-xs font-mono font-medium text-foreground tracking-wide", labelClassName)}>
                            {label}
                        </p>
                    )}
                    {description && (
                        <p className="text-[11px] font-mono text-foreground/60 leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (overlay) {
        return (
            <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300 rounded-[inherit] p-3 animate-in fade-in duration-150">
                <div className="flex flex-col items-center gap-2 text-center">
                    {spinnerSvg}
                    {label && (
                        <p className={twMerge("text-xs font-mono font-medium text-foreground tracking-wide", labelClassName)}>
                            {label}
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (label) {
        if (layout === 'horizontal') {
            return (
                <div className={twMerge('inline-flex items-center gap-2', className)}>
                    {spinnerSvg}
                    <span className={twMerge('text-xs font-mono font-medium text-foreground tracking-wide', labelClassName)}>{label}</span>
                </div>
            );
        }

        return (
            <div className={twMerge('flex flex-col items-center gap-2 text-center', className)}>
                {spinnerSvg}
                <span className={twMerge('text-xs font-mono font-medium text-foreground tracking-wide', labelClassName)}>
                    {label}
                </span>
            </div>
        );
    }

    return spinnerSvg;
}

export default AppleSpinner;
