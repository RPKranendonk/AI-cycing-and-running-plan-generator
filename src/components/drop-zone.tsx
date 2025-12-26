// ============================================================================
// DROP ZONE COMPONENT
// Drop target for workout drag and drop
// ============================================================================

import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

interface DropZoneProps {
    day: number;
    slot: 'am' | 'pm';
    weekNumber: number;
    isActive?: boolean;
    isValidDrop?: boolean;
    isEmpty?: boolean;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: () => void;
    onDrop?: () => void;
    children?: React.ReactNode;
}

export function DropZone({
    isActive = false,
    isValidDrop = false,
    isEmpty = true,
    onDragOver,
    onDragLeave,
    onDrop,
    children,
}: DropZoneProps) {
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = isValidDrop ? 'move' : 'none';
        onDragOver?.(e);
    };

    const handleDragLeave = () => {
        onDragLeave?.();
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        onDrop?.();
    };

    if (!isEmpty) {
        return (
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    'relative transition-all',
                    isActive && isValidDrop && 'ring-2 ring-green-500/50 ring-offset-2 rounded-xl',
                    isActive && !isValidDrop && 'ring-2 ring-red-500/50 ring-offset-2 rounded-xl'
                )}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
                'min-h-[60px] rounded-xl border-2 border-dashed transition-all',
                'flex items-center justify-center',
                isEmpty && !isActive && 'border-muted-foreground/20 bg-muted/30',
                isActive && isValidDrop && 'border-green-500 bg-green-50 dark:bg-green-950/30',
                isActive && !isValidDrop && 'border-red-500 bg-red-50 dark:bg-red-950/30'
            )}
        >
            {isActive ? (
                <p className={cn(
                    'text-xs font-medium',
                    isValidDrop ? 'text-green-600' : 'text-red-600'
                )}>
                    {isValidDrop ? 'Drop here' : 'Cannot drop'}
                </p>
            ) : (
                <Plus className="w-4 h-4 text-muted-foreground/40" />
            )}
        </div>
    );
}
