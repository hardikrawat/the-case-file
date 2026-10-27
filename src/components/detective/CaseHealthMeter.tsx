import React, { useEffect, useState } from 'react';

interface CaseHealthMeterProps {
  score: number;
  label?: string;
}

export function CaseHealthMeter({ score, label = "CASE STRENGTH" }: CaseHealthMeterProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedScore(score);
    }, 100);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;
  
  const getColor = (val: number) => {
    if (val < 40) return '#ef4444';
    if (val < 70) return '#f59e0b';
    return '#10b981';
  };

  const color = getColor(score);

  return (
    <div className="flex flex-col items-center justify-center py-4">
      <div className="relative w-32 h-32 flex items-center justify-center">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="transparent"
            strokeWidth="10"
            style={{ stroke: 'var(--panel-border)' }}
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="transparent"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
            style={{ stroke: color }}
          />
        </svg>
        <div 
          className="absolute inset-0 flex items-center justify-center flex-col"
          style={{ color: 'var(--panel-foreground)' }}
        >
          <span className="text-3xl font-bold">{score}</span>
        </div>
      </div>
      <div 
        className="mt-2 text-xs font-bold tracking-widest opacity-70"
        style={{ color: 'var(--panel-foreground)' }}
      >
        {label}
      </div>
    </div>
  );
}
