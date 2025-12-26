/**
 * @file WeekDetailRenderer.js
 * @description Pure UI Renderer for the expanded Week Detail view.
 * @usedBy js/weekly-ui.js
 * @responsibilities
 * - Generates the HTML for the week card when expanded
 * - Renders AM/PM slots, day headers, and summary stats
 * - Handles the visual state of "Drag and Drop" zones
 * @why Moved massive HTML generation logic out of the main controller to improve readability.
 */

/**
 * Week Detail Renderer
 * Responsibilities:
 * - Generating HTML for the week details view
 * - Handling visual states (colors, icons)
 * - Pure rendering logic (Presenter pattern)
 */

window.WeekDetailRenderer = {
    /**
     * Main render function - returns the HTML element for the week detail
     * @param {Object} options - Data needed for rendering
     * @returns {HTMLElement} The populated detail div
     */
    createDetailView: function (options) {
        const {
            weekIndex,
            weekData,
            template,
            isCycling,
            isEnhanced,
            dailyAvailability,
            weeklyFeedback,
            zoneStats,
            weekStart
        } = options;

        const detailId = `week-detail-${weekIndex}`;
        const detailDiv = document.createElement('div');
        detailDiv.id = detailId;
        detailDiv.className = 'mt-4 p-4 bg-slate-900/50 rounded-xl border border-white/5 animate-slide-up';

        // Prepare dates
        const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const displayDayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        const html = `
            <div class="space-y-4">
                ${this._renderHeader(weekIndex, weekData, zoneStats, isCycling, isEnhanced)}
                
                ${this._renderDayHeaders(displayOrder, displayDayNames, weekStart)}
                
                ${this._renderAMSection(weekIndex, template, displayOrder, dailyAvailability, isCycling)}
                
                ${this._renderPMSection(weekIndex, template, displayOrder, isCycling)}

                <!-- Tips -->
                <div class="text-[10px] text-slate-500 bg-slate-800/50 px-2 py-1.5 rounded-lg">
                    ${UIConstants.LABELS.DRAG_TIP}
                </div>

                <!-- Feedback Section -->
                <div class="pt-3 border-t border-white/5 space-y-2">
                    <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <i class="fa-solid fa-comment-dots"></i> ${UIConstants.LABELS.COACH_NOTE}
                    </label>
                    <textarea 
                        id="week-feedback-${weekIndex}"
                        placeholder="${UIConstants.LABELS.COACH_PLACEHOLDER}"
                        class="w-full h-16 p-2 text-xs bg-slate-800/50 border border-white/10 rounded-lg text-slate-300 placeholder-slate-500 resize-none focus:outline-none focus:border-cyan-500/50 transition-colors"
                        onchange="saveWeekFeedback(${weekIndex}, this.value)"
                    >${weeklyFeedback || ''}</textarea>
                </div>
                
                ${this._renderActionButtons(weekIndex, isEnhanced)}
            </div>
        `;

        detailDiv.innerHTML = html;
        return detailDiv;
    },

    _renderHeader: function (weekIndex, weekData, zoneStats, isCycling, isEnhanced) {
        const phaseLabel = weekData?.phaseName || 'Training';
        const volumeLabel = isCycling ? `${weekData?.rawTSS || '—'} TSS` : `${weekData?.rawKm || '—'} km`;
        const longLabel = isCycling ? `${weekData?.longRide || '—'}h` : `${weekData?.longRun || '—'} km`;

        return `
            <div class="flex flex-wrap items-center justify-between gap-y-2">
                <div class="flex items-center gap-3">
                    <h4 class="text-lg font-bold text-white tracking-tight">📅 ${phaseLabel}</h4>
                    <span class="text-[10px] px-2 py-0.5 bg-cyan-500/10 text-cyan-300 rounded border border-cyan-500/20 font-mono">
                        ${volumeLabel}
                    </span>
                    <span class="text-[10px] px-2 py-0.5 bg-orange-500/10 text-orange-300 rounded border border-orange-500/20 font-mono">
                        Long: ${longLabel}
                    </span>
                    <span class="text-[10px] px-2 py-0.5 bg-violet-500/10 text-violet-300 rounded border border-violet-500/20 font-mono cursor-pointer hover:bg-violet-500/20"
                        onclick="editWeekRampRate(${weekIndex}); event.stopPropagation();"
                        title="Click to adjust week progression">
                        <i class="fa-solid fa-chart-line mr-1"></i>${Math.round((weekData?.rampRate || 1.0) * 100)}%
                    </span>
                    ${isEnhanced ? `
                        <span class="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30 flex items-center gap-1">
                            <i class="fa-solid fa-check-circle"></i> AI Enhanced
                        </span>
                    ` : ''}
                </div>

                <button onclick="openWeekAvailabilityEditor(${weekIndex}); event.stopPropagation();" 
                    class="text-xs px-3 py-1.5 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 hover:text-white transition-colors border border-white/5"
                    title="Edit this week's availability">
                    <i class="fa-solid fa-gear"></i>
                </button>
            </div>
        `;
    },

    _renderZoneStats: function (dist) {
        if (!dist) return '';
        return `
            <div class="flex items-center gap-3 text-xs border-l pl-3 border-white/5 opacity-60 hover:opacity-100 transition-opacity">
                <div class="flex items-center gap-2 font-mono">
                    <span class="text-emerald-400" title="Low Intensity">
                        <i class="fa-solid fa-leaf mr-1"></i>${dist.low}%
                    </span>
                    <span class="text-yellow-400" title="Moderate">
                        <i class="fa-solid fa-bolt mr-1"></i>${dist.mod}%
                    </span>
                    <span class="text-red-400" title="High">
                        <i class="fa-solid fa-fire mr-1"></i>${dist.high}%
                    </span>
                </div>
            </div>`;
    },

    _renderDayHeaders: function (displayOrder, displayDayNames, weekStart) {
        return `
            <div class="grid grid-cols-7 gap-2 mb-1">
                ${displayOrder.map((dIndex, i) => {
            // FIX: Robust date calculation relative to weekStart
            // Calculate offset between target day (dIndex) and weekStart day
            let offset = (dIndex - weekStart.getDay() + 7) % 7;

            // Handle Sunday Wrap-around for Sunday-started weeks displayed in Mon-Sun view
            // If start is Sun(0) and target is Sun(0), we want +7 days (End of Week), not +0
            if (weekStart.getDay() === 0 && dIndex === 0) {
                offset = 7;
            }

            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + offset);
            const dateStr = `${d.getDate()}`;
            return `<div class="text-center text-xs font-bold text-slate-400 border-b border-white/10 pb-1">
                        ${displayDayNames[i]} <span class="text-[10px] text-slate-500">${dateStr}</span>
                    </div>`;
        }).join('')}
            </div>
        `;
    },

    _renderAMSection: function (weekIndex, template, displayOrder, dailyAvailability, isCycling) {
        return `
            <div class="flex items-center mb-1">
                <span class="text-[9px] font-bold text-amber-500/50 w-8 uppercase tracking-widest">AM</span>
                <div class="grid grid-cols-7 gap-2 flex-1">
                    ${displayOrder.map((dayNum) => this._renderAMSlot(weekIndex, dayNum, template[dayNum], dailyAvailability, isCycling)).join('')}
                </div>
            </div>
        `;
    },

    _renderAMSlot: function (weekIndex, dayNum, slotData = {}, dailyAvailability, isCycling) {
        const workout = slotData.workout;
        let typeId = workout ? slotData.type : (typeof slotData.type === 'object' ? slotData.type?.id : slotData.type);

        // Fallback for missing type
        if (!typeId && slotData.dayName) typeId = 'Rest';

        const colorClass = UIConstants.getWorkoutColorClass(typeId);
        const distanceVal = slotData.distance || workout?.totalDistance || 0;
        const distance = distanceVal.toFixed(1);
        const durationVal = slotData.duration || workout?.totalDuration || 0;
        // Fix for "1m" bug: If duration is small (< 600 which is 10 hours), it's likely in minutes (from scheduler).
        // Convert to seconds for formatting.
        const seconds = (durationVal > 0 && durationVal < 600) ? durationVal * 60 : durationVal;
        const duration = this._formatDuration(seconds);
        const title = workout?.name || UIConstants.getWorkoutTitle(typeId, slotData.note, isCycling);
        const hours = dailyAvailability?.[dayNum]?.hours || 0;
        const hasWorkout = typeId && typeId !== 'Rest' && typeId !== 'Blocked';

        const dropZoneClass = 'transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-800/50';
        const dropHandlers = `ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleWorkoutDrop(event, ${weekIndex}, ${dayNum}, 'am')"`;

        if (!hasWorkout) {
            return `<div class="h-20 p-2 rounded border border-transparent hover:border-dashed hover:border-slate-600/50 transition-all text-xs flex flex-col items-center justify-center group ${dropZoneClass}" ${dropHandlers}>
                        <span class="text-slate-800 group-hover:text-slate-600 transition-colors">${hours > 0 ? '—' : '•'}</span>
                        <span class="text-[9px] text-slate-800 group-hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100">${hours}h</span>
                    </div>`;
        }

        return `<div class="h-20 p-2 rounded border ${colorClass} text-xs flex flex-col justify-between overflow-hidden cursor-pointer shadow-sm ${dropZoneClass} hover:ring-2 hover:ring-cyan-500/50" 
                    draggable="true" 
                    ondragstart="handleDragStart(event, ${weekIndex}, ${dayNum}, 'am')"
                    onclick="if(window.WorkoutEditor) { window.WorkoutEditor.open(${weekIndex}, ${dayNum}, 'am'); event.stopPropagation(); }"
                    ${dropHandlers}
                    data-week="${weekIndex}" data-day="${dayNum}" data-slot="am">
                    <div class="font-bold truncate text-[11px] leading-tight" title="${title}">${title}</div>
                    <div class="flex justify-between text-[10px] opacity-70 font-mono mt-1">
                        <span>${distance}k</span>
                        <span>${duration}</span>
                    </div>
                </div>`;
    },

    _renderPMSection: function (weekIndex, template, displayOrder, isCycling) {
        return `
            <div class="flex items-center">
                <span class="text-[9px] font-bold text-indigo-500/50 w-8 uppercase tracking-widest">PM</span>
                <div class="grid grid-cols-7 gap-2 flex-1">
                    ${displayOrder.map((dayNum) => this._renderPMSlot(weekIndex, dayNum, template[dayNum], isCycling)).join('')}
                </div>
            </div>
        `;
    },

    _renderPMSlot: function (weekIndex, dayNum, slotData = {}, isCycling) {
        const secondary = slotData.secondary;
        const isSecondaryObject = typeof secondary === 'object' && secondary !== null;
        const secondaryType = isSecondaryObject ? (secondary.id || secondary.type || 'WeightTraining') : secondary;

        const dropZoneClass = 'transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-800/50';
        const dropHandlers = `ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleWorkoutDrop(event, ${weekIndex}, ${dayNum}, 'pm')"`;

        if (!secondaryType) {
            return `<div class="h-12 p-1 rounded border border-transparent hover:border-dashed hover:border-slate-600/50 transition-all text-xs flex items-center justify-center ${dropZoneClass}" ${dropHandlers}>
                        <span class="text-slate-800 hover:text-slate-600">—</span>
                    </div>`;
        }

        const colorClass = UIConstants.getWorkoutColorClass(secondaryType);
        const title = isSecondaryObject ? (secondary.name || secondary.title || UIConstants.getWorkoutTitle(secondaryType, null, isCycling)) : UIConstants.getWorkoutTitle(secondaryType, null, isCycling);

        return `<div class="h-12 p-1 rounded border ${colorClass} text-xs flex flex-col justify-center items-center overflow-hidden cursor-pointer shadow-sm ${dropZoneClass} hover:ring-2 hover:ring-cyan-500/50"
                    draggable="true"
                    ondragstart="handleDragStart(event, ${weekIndex}, ${dayNum}, 'pm')"
                    onclick="if(window.WorkoutEditor) { window.WorkoutEditor.open(${weekIndex}, ${dayNum}, 'pm'); event.stopPropagation(); }"
                    ${dropHandlers}
                    data-week="${weekIndex}" data-day="${dayNum}" data-slot="pm">
                    <div class="font-bold text-[9px] text-center leading-tight">${title}</div>
                </div>`;
    },

    _renderActionButtons: function (weekIndex, isEnhanced) {
        return `
            <div class="flex items-center justify-between gap-2 pt-2">
                <div class="flex items-center gap-2">
                    <button onclick="enhanceWithAI(${weekIndex}); event.stopPropagation();" 
                        class="px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-1.5"
                        id="enhance-btn-${weekIndex}">
                        <i class="fa-solid fa-wand-magic-sparkles"></i> ${isEnhanced ? 'Re-enhance' : 'Enhance with AI'}
                    </button>
                    <span class="text-[9px] text-slate-500 max-w-[200px]">Adds descriptions, validates schedule</span>
                </div>
                <div class="flex gap-2">
                    <button onclick="pushToIntervalsICU(${weekIndex})" id="push-btn-${weekIndex}" 
                        class="px-3 py-2 bg-slate-700/50 text-slate-300 text-xs rounded-lg hover:bg-slate-600/50 transition-colors">
                        <i class="fa-solid fa-cloud-arrow-up mr-1"></i> Push
                    </button>
                    <button onclick="resetRemoteWeeklyWorkouts(${weekIndex})" 
                        class="px-3 py-2 bg-red-500/10 text-red-400 text-xs rounded-lg hover:bg-red-500/20 transition-colors" title="Clear remote">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    },

    // Helper: format duration (seconds -> h/m)
    _formatDuration: function (seconds) {
        if (!seconds) return '-';
        const mins = Math.round(seconds / 60);
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${mins}m`;
    }
};
