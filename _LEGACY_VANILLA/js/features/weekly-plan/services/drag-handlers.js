/**
 * @file drag-handlers.js
 * @description Event handlers for drag-and-drop interactions in the Weekly Schedule UI.
 * @usedBy js/weekly-ui.js
 * @responsibilities
 * - Handles drag start, over, leave, and drop events
 * - Validates workout swaps (e.g., preventing invalid moves)
 * - Updates the data model after a successful drop
 * @why Encapsulates the complex/verbose native Drag & Drop API logic.
 */

// ==========================================
// DRAG AND DROP HANDLERS
// Handles workout drag/drop interactions
// ==========================================

/**
 * Handle drag start event
 * @param {DragEvent} event - The drag event
 * @param {number} weekIndex - Week index
 * @param {number} dayNum - Day number (0-6)
 * @param {Object} slot - Slot data
 */
function handleDragStart(event, weekIndex, dayNum, slot) {
    state.draggedWorkout = { weekIndex, dayNum, slot };
    // Firefox requires data to be set for drag to work
    event.dataTransfer.setData('text/plain', JSON.stringify({ weekIndex, dayNum, slot }));
    event.dataTransfer.effectAllowed = 'move';
    event.target.classList.add('dragging');
}

/**
 * Handle drag over event - allow dropping
 * @param {DragEvent} event - The drag event
 */
function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    event.currentTarget.classList.add('drag-over');
}

/**
 * Handle drag leave event
 * @param {DragEvent} event - The drag event
 */
function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

/**
 * Handle workout drop event - swap workouts between days
 * @param {DragEvent} event - The drop event
 * @param {number} targetWeekIndex - Target week index
 * @param {number} targetDayNum - Target day number
 * @param {Object} targetSlot - Target slot data
 */
function handleWorkoutDrop(event, targetWeekIndex, targetDayNum, targetSlot) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    if (!state.draggedWorkout) return;

    const { weekIndex: srcWeekIndex, dayNum: srcDayNum, slot: srcSlot } = state.draggedWorkout;

    // Only allow same-week swaps for now
    if (srcWeekIndex !== targetWeekIndex) {
        showToast('❌ Can only swap workouts within the same week');
        state.draggedWorkout = null;
        return;
    }

    // Don't swap with self
    if (srcDayNum === targetDayNum && srcSlot === targetSlot) {
        state.draggedWorkout = null;
        return;
    }

    const schedule = state.weeklyTemplates?.[targetWeekIndex] || state.generatedPlan?.[targetWeekIndex]?.schedule;

    if (schedule && window.RuleBasedScheduler && window.RuleBasedScheduler.validateMove) {
        // Validate the move
        // We need to know which slot type we are moving FROM (am/pm aka workout/secondary)
        // srcSlot is 'am' or 'pm'. 'am' -> 'workout', 'pm' -> 'secondary'
        const validationSlotType = srcSlot === 'am' ? 'workout' : 'secondary';

        const validation = window.RuleBasedScheduler.validateMove(schedule, srcDayNum, targetDayNum, validationSlotType);

        if (!validation.valid && validation.warnings.length > 0) {
            // Show confirmation modal
            const warningText = validation.warnings.map(w => `• ${w}`).join('\n');
            const message = `Caution:\n${warningText}\n\nDo you want to move it anyway?`;

            // We need a custom "Confirm vs Cancel" here. 
            // Reuse showConfirm but with specific text if possible, or build custom one.
            // Standard showConfirm is (title, message, onOk)
            // Let's assume onOk executes the swap.

            showConfirm("Validation Warning", message, () => {
                executeSwap(targetWeekIndex, srcDayNum, targetDayNum, srcSlot, targetSlot);
            });

            state.draggedWorkout = null; // Clear drag state pending confirmation
            return;
        }
    }

    // If no warnings, proceed immediately
    executeSwap(targetWeekIndex, srcDayNum, targetDayNum, srcSlot, targetSlot);
    state.draggedWorkout = null;
}

/**
 * Executes the actual data swap and UI refresh
 */
function executeSwap(weekIndex, srcDayNum, targetDayNum, srcSlot, targetSlot) {
    // Perform swap in temporary state (weeklyTemplates) AND generatedPlan if possible
    let template = state.weeklyTemplates?.[weekIndex];
    if (!template) {
        // If no template in state, grab from generatedPlan and initialize it
        template = state.generatedPlan?.[weekIndex]?.schedule;
        if (template) {
            if (!state.weeklyTemplates) state.weeklyTemplates = {};
            state.weeklyTemplates[weekIndex] = template;
        }
    }

    if (template) {
        // LOGIC FOR ELEMENT SWAP
        // 4 Cases: AM->AM, PM->PM, AM->PM, PM->AM

        // Helper to get/set
        const getVal = (day, slot) => slot === 'am' ? template[day] : (template[day].secondary || null);

        // This is complex because 'am' slot IS the object, but 'pm' is a property 'secondary'
        // Actually, template[day] is the Day Object. 
        // template[day].workout = AM workout
        // template[day].secondary = PM workout
        // BUT wait, existing code structure says:
        // template[day] has { workout: ..., secondary: ... } OR generic properties?
        // JS Debug says: schedule[day].workout = ...

        // Let's refine the "Swap" logic to be robust.

        // Source Object
        let srcObj = null;
        if (srcSlot === 'am') {
            srcObj = template[srcDayNum].workout;
            // If we move AM, we leave 'workout' null? or undefined?
        } else {
            srcObj = template[srcDayNum].secondary;
        }

        // Target Object
        let targetObj = null;
        if (targetSlot === 'am') {
            targetObj = template[targetDayNum].workout;
        } else {
            targetObj = template[targetDayNum].secondary;
        }

        // SWAP
        if (srcSlot === 'am') template[srcDayNum].workout = targetObj;
        else template[srcDayNum].secondary = targetObj;

        if (targetSlot === 'am') template[targetDayNum].workout = srcObj;
        else template[targetDayNum].secondary = srcObj;

        // Also update the 'type' field for AM slots since high-level logic uses it
        if (srcSlot === 'am') template[srcDayNum].type = targetObj ? (targetObj.type || 'Run') : 'Rest';
        if (targetSlot === 'am') template[targetDayNum].type = srcObj ? (srcObj.type || 'Run') : 'Rest';


        // Update State & Re-render
        // We also need to update convertTemplateToWorkouts to ensure consistency
        const weekData = state.generatedPlan[weekIndex];
        if (window.convertTemplateToWorkouts) {
            window.convertTemplateToWorkouts(weekIndex, template, weekData);
        }

        // Re-render
        if (window.toggleWeekDetail) {
            const detailDiv = document.getElementById(`week-detail-${weekIndex}`);
            if (detailDiv) {
                detailDiv.remove();
                const weekCard = document.querySelector(`[data-week-index="${weekIndex}"]`);
                if (weekCard) {
                    window.toggleWeekDetail(weekIndex, weekCard);
                }
            }
        }

        showToast('✓ Workouts moved');
    }
}

/**
 * Handle long run drop - change long run day
 * @param {DragEvent} event - The drop event
 * @param {number} weekIndex - Week index
 * @param {number} dayNum - Target day number
 */
function handleLongRunDrop(event, weekIndex, dayNum) {
    event.preventDefault();
    if (window.setLongRunDay) {
        window.setLongRunDay(weekIndex, dayNum);
    }
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;
window.handleWorkoutDrop = handleWorkoutDrop;
window.handleLongRunDrop = handleLongRunDrop;

window.DragHandlers = {
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleWorkoutDrop,
    handleLongRunDrop,
    get draggedWorkout() { return state.draggedWorkout; }
};
