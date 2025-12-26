// ============================================================================
// DRAGGABLE WORKOUT CARD
// Workout card with drag and drop support
// ============================================================================

import { cn } from '@/lib/utils';
import type { ScheduledWorkout } from '@/types';
import { GripVertical, Clock, MapPin } from 'lucide-react';

interface DraggableWorkoutCardProps {
    workout: ScheduledWorkout;
    day: number;
    slot: 'am' | 'pm';
    weekNumber: number;
    isDragging?: boolean;
    isDropTarget?: boolean;
    isValidDrop?: boolean;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    compact?: boolean;
}

export function DraggableWorkoutCard({
    workout,
    isDragging = false,
    isDropTarget = false,
    isValidDrop = false,
    onDragStart,
    onDragEnd,
    compact = false,
}: DraggableWorkoutCardProps) {
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', workout.id);
        onDragStart?.();
    };

    const handleDragEnd = () => {
        onDragEnd?.();
    };

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className={cn(
                'group relative rounded-xl border transition-all cursor-grab active:cursor-grabbing',
                'bg-white dark:bg-zinc-900',
                compact ? 'p-2' : 'p-3',
                isDragging && 'opacity-50 scale-95 shadow-lg',
                isDropTarget && isValidDrop && 'ring-2 ring-green-500 ring-offset-2',
                isDropTarget && !isValidDrop && 'ring-2 ring-red-500 ring-offset-2',
                !isDragging && 'hover:shadow-md hover:border-primary/50'
            )}
        >
            {/* Drag Handle */}
            <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-50 transition-opacity">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
            </div>

            {/* Color Indicator */}
            <div
                className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
                style={{ backgroundColor: workout.color }}
            />

            <div className="ml-4">
                {/* Sport Badge & Name */}
                <div className="flex items-center gap-2 mb-1">
                    <span
                        className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: workout.color }}
                    >
                        {workout.sport}
                    </span>
                    <h4 className={cn('font-semibold truncate', compact ? 'text-xs' : 'text-sm')}>
                        {workout.name}
                    </h4>
                </div>

                {/* Meta Info */}
                {!compact && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{workout.estimatedDuration}m</span>
                        </div>
                        {workout.estimatedDistance && (
                            <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{workout.estimatedDistance}km</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Focus */}
                {!compact && workout.focus && (
                    <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {workout.focus}
                    </p>
                )}
            </div>
        </div>
    );
}
