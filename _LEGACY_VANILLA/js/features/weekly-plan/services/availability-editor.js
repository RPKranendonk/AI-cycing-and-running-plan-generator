/**
 * @file availability-editor.js
 * @description Modal UI for managing week-specific availability overrides.
 * @usedBy js/weekly-ui.js
 * @responsibilities
 * - Renders the Weekly Availability Modal
 * - Handles AM/PM split logic
 * - Updates local state with availability changes before regeneration
 * @why Complex UI logic for availability editing was cluttering the main weekly-ui.js file.
 */

// ==========================================
// AVAILABILITY EDITOR
// Week-specific availability editing UI
// ==========================================

/**
 * Open week-specific availability editor with slider UI + AM/PM split
 * Pre-filled with global dailyAvailability, allows per-week override
 * @param {number} weekIndex - Week index to edit
 */
function openWeekAvailabilityEditor(weekIndex) {
    const weekData = state.generatedPlan?.[weekIndex];
    if (!weekData) {
        showToast('❌ Week data not found');
        return;
    }

    // Get current availability for this week
    const weekAvail = state.weekAvailabilityOverrides?.[weekIndex] || state.dailyAvailability || {};

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let modalHTML = `
        <div id="week-avail-modal" class="modal-overlay" style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 9999;">
            <div class="modal-content" style="background: var(--bg-alt, #1e293b); border-radius: 12px; padding: 24px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 16px; color: var(--text, white);">📅 Edit Week ${weekData.week} Availability</h3>
                <p style="color: var(--text-muted, #aaa); margin-bottom: 16px; font-size: 0.9rem;">
                    Adjust training time available for each day. Changes only affect this week.
                </p>
                <div id="week-avail-days" style="display: flex; flex-direction: column; gap: 12px;">
    `;

    dayNames.forEach((name, dayNum) => {
        const dayData = weekAvail[dayNum] || { hours: 1.5, hasSplit: false, am: 0.75, pm: 0.75 };
        const hours = dayData.hours || 1.5;
        const isSplit = dayData.split || dayData.hasSplit || false;
        const splitDisplay = isSplit ? 'block' : 'none';

        modalHTML += `
            <div class="day-avail-row" style="display: flex; align-items: center; gap: 12px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                <span style="width: 60px; color: var(--text, white); font-weight: 500;">${name.slice(0, 3)}</span>
                <input type="range" id="week-avail-${dayNum}" min="0" max="4" step="0.5" value="${hours}"
                    style="flex: 1;" onchange="window.updateWeekAvailDisplay(${dayNum})">
                <span id="week-avail-display-${dayNum}" style="width: 45px; text-align: right; color: var(--primary, #3b82f6);">${hours}h</span>
                <label class="flex items-center gap-2 cursor-pointer" style="margin-left:auto;">
                    <input type="checkbox" id="week-split-check-${dayNum}" 
                        onchange="window.toggleWeekSplit(${dayNum})"
                        ${isSplit ? 'checked' : ''}
                        class="form-checkbox h-4 w-4 text-cyan-500 rounded border-slate-600 bg-slate-700/50 focus:ring-cyan-500/50">
                    <span style="font-size: 0.8rem; color: var(--text-muted, #aaa);">Split</span>
                </label>
            </div>
            <div id="week-split-${dayNum}" style="display: ${splitDisplay}; margin-left: 72px; margin-top: -8px; padding: 8px; background: rgba(255,255,255,0.03); border-radius: 6px;">
                <div style="display: flex; gap: 12px; align-items: center;">
                    <label style="color: var(--text-muted, #aaa); font-size: 0.85rem;">AM:</label>
                    <input type="number" id="week-am-${dayNum}" min="0" max="4" step="0.5" value="${dayData.am || hours / 2}"
                        style="width: 60px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border, #333); background: var(--bg, #0f172a); color: var(--text, white);"
                        onchange="window.updateWeekSplitTotal(${dayNum})">
                    <label style="color: var(--text-muted, #aaa); font-size: 0.85rem;">PM:</label>
                    <input type="number" id="week-pm-${dayNum}" min="0" max="4" step="0.5" value="${dayData.pm || hours / 2}"
                        style="width: 60px; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border, #333); background: var(--bg, #0f172a); color: var(--text, white);"
                        onchange="window.updateWeekSplitTotal(${dayNum})">
                </div>
            </div>
        `;
    });

    modalHTML += `
                </div>
                <div style="display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;">
                    <button onclick="window.closeWeekAvailModal()" style="padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border, #333); background: transparent; color: var(--text, white); cursor: pointer;">
                        Cancel
                    </button>
                    <button onclick="window.applyWeekAvailability(${weekIndex})" style="padding: 8px 16px; border-radius: 6px; border: none; background: var(--primary, #3b82f6); color: white; cursor: pointer; font-weight: 500;">
                        Apply Changes
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

/**
 * Update display when slider changes
 * @param {number} dayNum - Day number (0-6)
 */
function updateWeekAvailDisplay(dayNum) {
    const slider = document.getElementById(`week-avail-${dayNum}`);
    const display = document.getElementById(`week-avail-display-${dayNum}`);
    if (slider && display) {
        display.textContent = `${slider.value}h`;
    }
}

/**
 * Toggle AM/PM split visibility
 * @param {number} dayNum - Day number (0-6)
 */
function toggleWeekSplit(dayNum) {
    const checkbox = document.getElementById(`week-split-check-${dayNum}`);
    const splitDiv = document.getElementById(`week-split-${dayNum}`);

    if (splitDiv && checkbox) {
        const isChecked = checkbox.checked;
        splitDiv.style.display = isChecked ? 'block' : 'none';

        if (isChecked) {
            // Initialize AM/PM values from total
            const slider = document.getElementById(`week-avail-${dayNum}`);
            const total = parseFloat(slider?.value || 1.5);
            const amInput = document.getElementById(`week-am-${dayNum}`);
            const pmInput = document.getElementById(`week-pm-${dayNum}`);
            if (amInput && !amInput.value) amInput.value = (total / 2).toFixed(1);
            if (pmInput && !pmInput.value) pmInput.value = (total / 2).toFixed(1);
        }
    }
}

/**
 * Update total when AM/PM changes
 * @param {number} dayNum - Day number (0-6)
 */
function updateWeekSplitTotal(dayNum) {
    const amInput = document.getElementById(`week-am-${dayNum}`);
    const pmInput = document.getElementById(`week-pm-${dayNum}`);
    const slider = document.getElementById(`week-avail-${dayNum}`);
    const display = document.getElementById(`week-avail-display-${dayNum}`);

    if (amInput && pmInput && slider && display) {
        const total = parseFloat(amInput.value || 0) + parseFloat(pmInput.value || 0);
        slider.value = Math.min(4, total);
        display.textContent = `${total.toFixed(1)}h`;
    }
}

/**
 * Close availability modal
 */
function closeWeekAvailModal() {
    const modal = document.getElementById('week-avail-modal');
    if (modal) modal.remove();
}

/**
 * Apply availability changes for a week
 * @param {number} weekIndex - Week index
 */
function applyWeekAvailability(weekIndex) {
    if (!state.weekAvailabilityOverrides) state.weekAvailabilityOverrides = {};
    state.weekAvailabilityOverrides[weekIndex] = {};

    for (let dayNum = 0; dayNum < 7; dayNum++) {
        const slider = document.getElementById(`week-avail-${dayNum}`);
        const splitDiv = document.getElementById(`week-split-${dayNum}`);
        const hasSplit = splitDiv && splitDiv.style.display !== 'none';

        const hours = parseFloat(slider?.value || 0);
        let am = hours / 2;
        let pm = hours / 2;

        if (hasSplit) {
            const amInput = document.getElementById(`week-am-${dayNum}`);
            const pmInput = document.getElementById(`week-pm-${dayNum}`);
            am = parseFloat(amInput?.value || 0);
            pm = parseFloat(pmInput?.value || 0);
        }

        state.weekAvailabilityOverrides[weekIndex][dayNum] = {
            hours: hours,
            hasSplit: hasSplit,
            am: am,
            pm: pm
        };
    }

    // Regenerate week with new availability
    closeWeekAvailModal();

    // FORCE REGENERATION: Clear existing template and workouts so toggleWeekDetail creates a new one
    if (state.weeklyTemplates && state.weeklyTemplates[weekIndex]) {
        delete state.weeklyTemplates[weekIndex];
    }
    if (state.generatedWorkouts && state.generatedWorkouts[weekIndex]) {
        delete state.generatedWorkouts[weekIndex];
    }

    // Refresh the week detail
    const detailDiv = document.getElementById(`week-detail-${weekIndex}`);
    if (detailDiv) {
        detailDiv.remove(); // Remove old UI
        const weekCard = document.querySelector(`[data-week-index="${weekIndex}"]`);
        if (weekCard && window.toggleWeekDetail) {
            window.toggleWeekDetail(weekIndex, weekCard); // This will now regenerate the plan
        }
    }

    showToast('✓ Availability updated. Regenerate week to apply.');
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.openWeekAvailabilityEditor = openWeekAvailabilityEditor;
window.updateWeekAvailDisplay = updateWeekAvailDisplay;
window.toggleWeekSplit = toggleWeekSplit;
window.updateWeekSplitTotal = updateWeekSplitTotal;
window.closeWeekAvailModal = closeWeekAvailModal;
window.applyWeekAvailability = applyWeekAvailability;

window.AvailabilityEditor = {
    openWeekAvailabilityEditor,
    updateWeekAvailDisplay,
    toggleWeekSplit,
    updateWeekSplitTotal,
    closeWeekAvailModal,
    applyWeekAvailability
};
