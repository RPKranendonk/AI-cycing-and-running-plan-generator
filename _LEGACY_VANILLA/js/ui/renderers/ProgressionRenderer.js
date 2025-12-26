/**
 * @file ProgressionRenderer.js
 * @description Renderer for the "Long Term Plan" table (Progression Preview).
 * @usedBy js/weekly-ui.js
 * @responsibilities
 * - Renders the table showing Week #, Phase, Volume, and Long Run per week
 * - Visualizes "Traffic Light" status (Green/Red/Orange week types)
 * - Handles the "Rest Week" toggle checkbox logic
 * @why Visualizes the high-level macrocycle structure for the user.
 */

/**
 * Progression Side Panel Renderer
 * Renders the preview table showing the generated plan structure (Weeks, Phases, Volume, Long Run)
 */
window.ProgressionRenderer = {
    render: function () {
        const sportType = state.sportType || 'Running';
        const isCycling = (sportType === 'Cycling');

        // Target correct container based on sport
        const containerId = isCycling ? 'progression-preview-cycle' : 'progression-preview-run';
        const container = document.getElementById(containerId);

        if (!container) {
            // console.warn(`Progression container #${containerId} not found`);
            return;
        }

        let adapter = null;
        if (window.sportRegistry) {
            adapter = window.sportRegistry.getAdapter(sportType);
        }

        const volUnit = adapter ? adapter.getVolumeUnit() : (isCycling ? 'TSS' : 'km');
        const lrLabel = adapter ? adapter.getLongSessionLabel() : (isCycling ? 'Long Ride' : 'Long Run');
        const lrUnit = isCycling ? 'h' : 'km';

        const plan = state.generatedPlan;
        if (!plan || plan.length === 0) return;

        let html = '<div id="progression-alerts" class="mb-2"></div>';
        html += '<div class="grid grid-cols-6 gap-1 text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 mb-1 text-center">';
        html += `<div>Week</div><div>Date</div><div>Phase</div><div>Rest?</div><div>${volUnit}</div><div>${lrLabel}</div></div>`;

        let lastRestWeek = 0;
        let maxGap = 0;

        plan.forEach((week, index) => {
            let rowClass = "border-b border-slate-800 py-1 text-center";
            let phaseDisplay = week.phaseName.replace(" Phase", "");
            let isRest = false;
            let phaseClass = "";
            let restBadge = "";

            if (week.isRaceWeek) {
                phaseDisplay = "RACE";
                rowClass += " bg-purple-900/20 text-purple-200";
                phaseClass = "text-purple-200";
            } else if (week.blockType === "Taper") {
                rowClass += " text-blue-200";
                phaseClass = "text-blue-200";
            } else if (week.weekName.includes("Recovery") || week.weekName === "Recovery Start" || week.weekName === "Custom Recovery") {
                phaseDisplay = "Recov";
                rowClass += " text-green-200";
                phaseClass = "text-green-200";
                isRest = true;
                restBadge = `<span class="inline-block bg-green-600 text-white text-[8px] px-1 rounded-full">R</span>`;
            } else if (week.blockType === "Peak") {
                phaseClass = "text-orange-200";
            } else {
                phaseClass = "text-slate-300";
            }

            // Gap Check
            if (isRest) {
                const gap = week.week - lastRestWeek - 1;
                if (gap > maxGap) maxGap = gap;
                lastRestWeek = week.week;
            }

            const dateStr = week.startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            // Checkbox Logic
            let checkboxHtml = '';
            let isDisabled = false;

            if (week.isRaceWeek || week.blockType === "Taper" || week.blockType === "Peak") {
                isDisabled = true;
            }

            if (!week.isRaceWeek) {
                const isChecked = isRest ? 'checked' : '';
                const disabledAttr = isDisabled ? 'disabled style="opacity: 0.3;"' : '';
                checkboxHtml = `<input type="checkbox" class="rest-week-toggle accent-green-500" data-week="${week.week}" ${isChecked} ${disabledAttr}>`;
            }

            html += `
            <div class="grid grid-cols-6 gap-1 text-[10px] items-center text-center p-1 rounded hover:bg-slate-800 transition-colors ${rowClass}">
                <div class="font-bold text-slate-300">W${week.week}</div>
                <div class="text-slate-500">${dateStr}</div>
                <div class="${phaseClass}">${week.phaseName || week.blockType}</div>
                <div>${checkboxHtml}</div>
                <div class="font-mono text-slate-300">${week.mileage} ${isCycling ? 'TSS' : 'km'}</div>
                <div class="font-mono text-slate-300">${week.longRun} ${isCycling ? 'h' : 'km'}</div>
            </div>`;
        });

        container.innerHTML = html;

        if (maxGap > 5) {
            showToast("⚠️ Warning: >5 weeks without rest. Recommended: 3-4 weeks.");
            const alertEl = container.querySelector('#progression-alerts');
            if (alertEl) {
                alertEl.innerHTML = `
                    <div class="p-2 mb-2 bg-amber-500/10 border border-amber-500/20 rounded text-amber-200 text-[10px] flex items-center gap-2">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                        <span>Warning: Long block of ${maxGap} weeks without recovery. Recommended every 3-4 weeks.</span>
                    </div>
                `;
            }
        }

        this._attachListeners(container);
    },

    _attachListeners: function (container) {
        const checkboxes = container.querySelectorAll('.rest-week-toggle');
        checkboxes.forEach(cb => {
            cb.addEventListener('change', (e) => {
                const weekNum = parseInt(e.target.dataset.week);

                if (weekNum === 1) {
                    const startRestCheckbox = document.getElementById('use-rest-week');
                    if (startRestCheckbox) startRestCheckbox.checked = e.target.checked;
                }

                if (e.target.checked) {
                    if (!state.customRestWeeks) state.customRestWeeks = [];
                    if (!state.customRestWeeks.includes(weekNum)) state.customRestWeeks.push(weekNum);
                    if (state.forceBuildWeeks) state.forceBuildWeeks = state.forceBuildWeeks.filter(w => w !== weekNum);
                } else {
                    if (state.customRestWeeks) state.customRestWeeks = state.customRestWeeks.filter(w => w !== weekNum);
                    if (!state.forceBuildWeeks) state.forceBuildWeeks = [];
                    if (!state.forceBuildWeeks.includes(weekNum)) state.forceBuildWeeks.push(weekNum);
                }

                // Re-calculate
                if (window.viewProgressionFromInputs) window.viewProgressionFromInputs();
            });
        });
    }
};
