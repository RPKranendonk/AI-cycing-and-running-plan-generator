/**
 * @file week-actions.js
 * @description Handler for functional actions on weeks and blocks (Push, Delete, Reset).
 * @usedBy js/weekly-ui.js
 * @responsibilities
 * - Manages "Block Level" actions (e.g., Push entire block to Intervals.icu)
 * - Manages "Week Level" actions (e.g., Reset week, Regenerate with AI)
 * - Interfaces with the sync services (intervals-service.js)
 * @why Separates "Actions" (Business Logic) from "Rendering" (UI Logic) in the weekly plan.
 */

// ==========================================
// WEEK ACTIONS
// Block and week-level actions (push, delete, reset)
// ==========================================

/**
 * Prepare block workouts for pushing
 * @param {number} blockIndex - Block index
 */
function prepareBlockWorkouts(blockIndex) {
    // Reconstruct blocks from state
    const phases = [...new Set(state.generatedPlan.map(w => w.phaseName))];
    const blocks = phases.map(phase => {
        const weeks = state.generatedPlan
            .map((w, i) => ({ ...w, index: i }))
            .filter(w => w.phaseName === phase);
        return { phase, weeks };
    });

    if (blockIndex >= blocks.length) {
        showToast('❌ Block not found');
        return;
    }

    const block = blocks[blockIndex];
    const weekIndices = block.weeks.map(w => w.index);

    console.log(`[WeekActions] Preparing block ${blockIndex} (${block.phase}): weeks ${weekIndices.join(', ')}`);

    // Call AI for all weeks in this block
    if (window.preparePlanWithAI) {
        window.preparePlanWithAI('block', weekIndices);
    }
}

/**
 * Push block workouts to Intervals.icu
 * @param {number} blockIndex - Block index
 */
async function pushBlockWorkouts(blockIndex) {
    // Reconstruct blocks
    const phases = [...new Set(state.generatedPlan.map(w => w.phaseName))];
    const blocks = phases.map(phase => {
        const weeks = state.generatedPlan
            .map((w, i) => ({ ...w, index: i }))
            .filter(w => w.phaseName === phase);
        return { phase, weeks };
    });

    if (blockIndex >= blocks.length) {
        showToast('❌ Block not found');
        return;
    }

    const block = blocks[blockIndex];
    const weekIndices = block.weeks.map(w => w.index);

    console.log(`[WeekActions] Pushing block ${blockIndex} (${block.phase}): weeks ${weekIndices.join(', ')}`);

    // Push each week
    let successCount = 0;
    let failCount = 0;

    for (const weekIndex of weekIndices) {
        try {
            if (window.pushToIntervalsICU) {
                await window.pushToIntervalsICU(weekIndex);
                successCount++;
            }
        } catch (e) {
            console.error(`Failed to push week ${weekIndex}:`, e);
            failCount++;
        }
    }

    if (failCount === 0) {
        showToast(`✅ Pushed ${successCount} weeks to Intervals.icu`);
    } else {
        showToast(`⚠️ Pushed ${successCount} weeks, ${failCount} failed`);
    }
}

/**
 * Delete future workouts from a block
 * @param {number} blockIndex - Block index
 */
async function deleteFutureWorkouts(blockIndex) {
    // Reconstruct blocks
    const phases = [...new Set(state.generatedPlan.map(w => w.phaseName))];
    const blocks = phases.map(phase => {
        const weeks = state.generatedPlan
            .map((w, i) => ({ ...w, index: i }))
            .filter(w => w.phaseName === phase);
        return { phase, weeks };
    });

    if (blockIndex >= blocks.length) {
        showToast('❌ Block not found');
        return;
    }

    const block = blocks[blockIndex];
    const weekIndices = block.weeks.map(w => w.index);

    const confirmed = confirm(`Delete all workouts from ${block.phase} (${weekIndices.length} weeks) on Intervals.icu?`);
    if (!confirmed) return;

    console.log(`[WeekActions] Deleting block ${blockIndex}: weeks ${weekIndices.join(', ')}`);

    for (const weekIndex of weekIndices) {
        try {
            if (window.deleteRemoteWorkouts) {
                await window.deleteRemoteWorkouts(weekIndex);
            }
        } catch (e) {
            console.error(`Failed to delete week ${weekIndex}:`, e);
        }
    }

    showToast(`✅ Deleted ${block.phase} workouts from Intervals.icu`);
}

/**
 * Reset/Clear workouts for a specific week
 * @param {number} weekIndex - Week index
 * @param {boolean} skipConfirm - Skip confirmation dialog
 */
function resetWeeklyWorkouts(weekIndex, skipConfirm = false) {
    function doReset() {
        // Clear local state
        if (state.generatedWorkouts) {
            state.generatedWorkouts[weekIndex] = [];
        }

        // Clear schedule
        if (state.generatedPlan?.[weekIndex]?.schedule) {
            state.generatedPlan[weekIndex].schedule = null;
        }

        // Refresh UI
        const detailDiv = document.getElementById(`week-detail-${weekIndex}`);
        if (detailDiv) {
            detailDiv.remove();
        }

        showToast(`✓ Week ${weekIndex + 1} reset`);
    }

    if (skipConfirm) {
        doReset();
    } else {
        if (confirm('Reset this week? Local workouts will be cleared.')) {
            doReset();
        }
    }
}

/**
 * Save weekly feedback to state
 * @param {number} weekIndex - Week index
 * @param {string} feedback - Feedback text
 */
function saveWeekFeedback(weekIndex, feedback) {
    if (!state.weekFeedback) state.weekFeedback = {};
    state.weekFeedback[weekIndex] = {
        text: feedback,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('weekFeedback', JSON.stringify(state.weekFeedback));
    showToast('💾 Feedback saved');
}

/**
 * Enhance schedule with AI using feedback
 * @param {number} weekIndex - Week index
 */
async function enhanceWithAI(weekIndex) {
    const feedback = state.weekFeedback?.[weekIndex]?.text || '';

    if (!feedback.trim()) {
        showToast('ℹ️ No feedback provided. Add notes first.');
        return;
    }

    console.log(`[WeekActions] Enhancing week ${weekIndex} with feedback: "${feedback}"`);

    // Store feedback for prompt builder
    if (!state.regenerationFeedback) state.regenerationFeedback = {};
    state.regenerationFeedback[weekIndex] = feedback;

    // Regenerate with AI
    if (window.preparePlanWithAI) {
        await window.preparePlanWithAI('week', [weekIndex]);
    }

    // Clear the used feedback
    delete state.regenerationFeedback[weekIndex];
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.prepareBlockWorkouts = prepareBlockWorkouts;
window.pushBlockWorkouts = pushBlockWorkouts;
window.deleteFutureWorkouts = deleteFutureWorkouts;
window.resetWeeklyWorkouts = resetWeeklyWorkouts;
window.saveWeekFeedback = saveWeekFeedback;
window.enhanceWithAI = enhanceWithAI;

window.WeekActions = {
    prepareBlockWorkouts,
    pushBlockWorkouts,
    deleteFutureWorkouts,
    resetWeeklyWorkouts,
    saveWeekFeedback,
    enhanceWithAI
};
