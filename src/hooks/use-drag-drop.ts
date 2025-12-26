// ============================================================================
// DRAG AND DROP HOOK
// Custom hook for workout drag and drop functionality
// ============================================================================

import { useState, useCallback } from 'react';
import type { ScheduledWorkout } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface DragItem {
    workout: ScheduledWorkout;
    fromDay: number;
    fromSlot: 'am' | 'pm';
    weekNumber: number;
}

export interface DropTarget {
    day: number;
    slot: 'am' | 'pm';
    weekNumber: number;
}

export interface DragDropState {
    isDragging: boolean;
    dragItem: DragItem | null;
    dropTarget: DropTarget | null;
    isValidDrop: boolean;
    validationMessage: string;
}

export type ValidateDropFn = (
    dragItem: DragItem,
    dropTarget: DropTarget
) => { valid: boolean; message: string };

export interface UseDragDropOptions {
    validateDrop?: ValidateDropFn;
}

export interface UseDragDropReturn {
    state: DragDropState;
    startDrag: (item: DragItem) => void;
    updateDropTarget: (target: DropTarget | null) => void;
    endDrag: () => { dragItem: DragItem; dropTarget: DropTarget } | null;
    cancelDrag: () => void;
}

// ============================================================================
// DEFAULT VALIDATION
// ============================================================================

const defaultValidateDrop: ValidateDropFn = (dragItem, dropTarget) => {
    // Same position check
    if (
        dropTarget.day === dragItem.fromDay &&
        dropTarget.slot === dragItem.fromSlot &&
        dropTarget.weekNumber === dragItem.weekNumber
    ) {
        return { valid: false, message: 'Same position' };
    }

    // Cross-week not allowed by default
    if (dropTarget.weekNumber !== dragItem.weekNumber) {
        return { valid: false, message: 'Cannot move between weeks' };
    }

    return { valid: true, message: '' };
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useDragDrop(options: UseDragDropOptions = {}): UseDragDropReturn {
    const validateDrop = options.validateDrop || defaultValidateDrop;

    const [state, setState] = useState<DragDropState>({
        isDragging: false,
        dragItem: null,
        dropTarget: null,
        isValidDrop: false,
        validationMessage: '',
    });

    /**
     * Start dragging a workout
     */
    const startDrag = useCallback((item: DragItem) => {
        setState({
            isDragging: true,
            dragItem: item,
            dropTarget: null,
            isValidDrop: false,
            validationMessage: '',
        });
    }, []);

    /**
     * Update the current drop target and validate the move
     */
    const updateDropTarget = useCallback((target: DropTarget | null) => {
        setState(prev => {
            if (!prev.dragItem || !target) {
                return {
                    ...prev,
                    dropTarget: null,
                    isValidDrop: false,
                    validationMessage: '',
                };
            }

            // Validate using provided or default function
            const validation = validateDrop(prev.dragItem, target);

            return {
                ...prev,
                dropTarget: target,
                isValidDrop: validation.valid,
                validationMessage: validation.message,
            };
        });
    }, [validateDrop]);

    /**
     * End the drag and return the result if valid
     */
    const endDrag = useCallback(() => {
        const result = state.isValidDrop && state.dragItem && state.dropTarget
            ? { dragItem: state.dragItem, dropTarget: state.dropTarget }
            : null;

        setState({
            isDragging: false,
            dragItem: null,
            dropTarget: null,
            isValidDrop: false,
            validationMessage: '',
        });

        return result;
    }, [state]);

    /**
     * Cancel the drag operation
     */
    const cancelDrag = useCallback(() => {
        setState({
            isDragging: false,
            dragItem: null,
            dropTarget: null,
            isValidDrop: false,
            validationMessage: '',
        });
    }, []);

    return {
        state,
        startDrag,
        updateDropTarget,
        endDrag,
        cancelDrag,
    };
}
