import React from 'react';
import { cn } from '@/lib/utils';
import { Zone } from '@/lib/types';

interface ZoneBadgeProps {
  zone: Zone;
  className?: string;
  showLabel?: boolean;
}

const ZONE_CONFIG: Record<Zone, { label: string; colorClass: string; bgClass: string }> = {
  1: { label: 'Z1 Recovery', colorClass: 'text-[hsl(var(--zone-1))]', bgClass: 'bg-[hsl(var(--zone-1))]' },
  2: { label: 'Z2 Endurance', colorClass: 'text-[hsl(var(--zone-2))]', bgClass: 'bg-[hsl(var(--zone-2))]' },
  3: { label: 'Z3 Tempo', colorClass: 'text-[hsl(var(--zone-3))]', bgClass: 'bg-[hsl(var(--zone-3))]' },
  4: { label: 'Z4 Threshold', colorClass: 'text-[hsl(var(--zone-4))]', bgClass: 'bg-[hsl(var(--zone-4))]' },
  5: { label: 'Z5 VO2max', colorClass: 'text-[hsl(var(--zone-5))]', bgClass: 'bg-[hsl(var(--zone-5))]' },
  strength: { label: 'Strength', colorClass: 'text-[hsl(var(--zone-strength))]', bgClass: 'bg-[hsl(var(--zone-strength))]' },
  rest: { label: 'Rest Day', colorClass: 'text-[hsl(var(--zone-rest))]', bgClass: 'bg-[hsl(var(--zone-rest))]' },
};

export function ZoneBadge({ zone, className, showLabel = true }: ZoneBadgeProps) {
  const config = ZONE_CONFIG[zone];
  
  return (
    <div className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/50 border border-black/5 backdrop-blur-sm", className)}>
      <div className={cn("w-2 h-2 rounded-full", config.bgClass)} />
      {showLabel && (
        <span className="text-xs font-medium text-foreground/80">{config.label}</span>
      )}
    </div>
  );
}
