// ============================================================================
// PROGRESS RING
// Circular progress indicator
// ============================================================================

import { cn } from '@/lib/utils';

interface ProgressRingProps {
    progress: number; // 0-100
    size?: number;
    strokeWidth?: number;
    className?: string;
    label?: string;
    sublabel?: string;
}

export function ProgressRing({
    progress,
    size = 120,
    strokeWidth = 8,
    className,
    label,
    sublabel,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    // Clamp progress
    const clampedProgress = Math.min(100, Math.max(0, progress));

    // Color based on progress
    const getColor = () => {
        if (clampedProgress >= 90) return 'hsl(142, 76%, 36%)'; // Green
        if (clampedProgress >= 70) return 'hsl(var(--primary))'; // Blue
        if (clampedProgress >= 50) return 'hsl(45, 93%, 47%)'; // Yellow
        return 'hsl(0, 84%, 60%)'; // Red
    };

    return (
        <div className={cn('relative inline-flex items-center justify-center', className)}>
            <svg width={size} height={size} className="-rotate-90">
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth={strokeWidth}
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={getColor()}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-500 ease-out"
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">{Math.round(clampedProgress)}%</span>
                {label && <span className="text-xs text-muted-foreground">{label}</span>}
                {sublabel && <span className="text-[10px] text-muted-foreground/70">{sublabel}</span>}
            </div>
        </div>
    );
}
