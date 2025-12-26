/**
 * @file workout-editor.js
 * @description Modal for viewing workout details with read-only metrics and simplified step view.
 * @usedBy js/ui/renderers/WeekDetailRenderer.js
 */

window.WorkoutEditor = {
    currentWorkout: null,
    currentWeekIndex: null,
    currentDayNum: null,
    currentSlot: null,
    computedDateStr: '',

    open: function (weekIndex, dayNum, slot) {
        this.currentWeekIndex = weekIndex;
        this.currentDayNum = dayNum;
        this.currentSlot = slot;

        // Retrieve workout data
        const template = state.weeklyTemplates?.[weekIndex] || state.generatedPlan?.[weekIndex]?.schedule;
        if (!template) return showToast('Error: Schedule not found', 'error');

        const slotData = template[dayNum];
        let targetObj = slot === 'am' ? slotData.workout : slotData.secondary;

        if (!targetObj) {
            if (slot === 'am' && slotData.type && slotData.type !== 'Rest') {
                targetObj = slotData;
            } else {
                return showToast('No workout to view', 'error');
            }
        }

        this.currentWorkout = JSON.parse(JSON.stringify(targetObj)); // Deep copy to edit

        // Calculate Date String
        this.computedDateStr = this.calculateDate(weekIndex, dayNum);

        this.renderModal();
    },

    calculateDate: function (weekIndex, dayNum) {
        try {
            const weekData = state.generatedPlan?.[weekIndex];
            if (!weekData || !weekData.startDate) return `Day ${dayNum + 1}`;

            const parts = weekData.startDate.split('-');
            // weekData.startDate is usually Monday?
            // standard JS Date parser might flake on simple strings, use parts
            const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

            // Add days (dayNum 0 = Monday usually in this app logic? Or Sunday? 
            // In WeekDetailRenderer: displayOrder = [1, 2, 3, 4, 5, 6, 0] so 1=Mon.
            // But strict 'dayNum' is 0..6 keys in schedule object. 
            // Usually schedule[0] is Sunday? Or Monday?
            // deterministic-scheduler uses 0=Sun, 1=Mon.
            // weekData.startDate is usually the MONDAY of that week.
            // If dayNum=1 (Mon), offset is 0. If dayNum=0 (Sun), offset is 6.

            // Robust calculation:
            // If we assume startDate is Monday.
            // offset = (dayNum + 6) % 7 ? No, simplistic logic:
            // Let's assume dayNum 1 is Monday.
            // d is Monday.

            let offset = 0;
            // Map JS Day (0=Sun, 1=Mon) to offset from Monday(0)
            if (dayNum === 0) offset = 6; // Sun is 6 days after Mon
            else offset = dayNum - 1;     // Mon(1)-1=0, Tue(2)-1=1

            d.setDate(d.getDate() + offset);

            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

            return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
        } catch (e) {
            return `Day ${dayNum + 1}`;
        }
    },

    renderModal: function () {
        const w = this.currentWorkout;
        const isCycling = w.sport === 'Cycling' || w.type === 'Ride';

        let modal = document.getElementById('workout-editor-modal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'workout-editor-modal';
        modal.className = 'fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm animate-fade-in';
        modal.onclick = (e) => { if (e.target === modal) this.close(); };

        const stepsHtml = this.renderStepsAsText(w);

        // Header Values
        const durationMin = (w.totalDuration > 600 ? Math.round(w.totalDuration / 60) : (w.totalDuration || 0));
        const distVal = w.totalDistance || 0;
        const loadVal = w.tss || w.load || '--';
        const intVal = '--'; // Intensity not currently calculated/stored reliably

        modal.innerHTML = `
            <div class="glass-panel bg-white dark:bg-slate-900 rounded-none md:rounded-lg max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto animate-scale-in relative text-slate-800 dark:text-slate-200 font-sans">
                
                <!-- HEADER (Intervals.icu Style) -->
                <div class="flex flex-wrap md:flex-nowrap items-center border-b border-slate-200 dark:border-slate-700 p-4 gap-4 bg-slate-50 dark:bg-slate-800/50">
                    
                    <!-- Icon -->
                    <div class="w-12 h-12 rounded-full border-2 border-cyan-500 flex items-center justify-center shrink-0">
                        <i class="fa-solid ${isCycling ? 'fa-bicycle' : 'fa-person-running'} text-cyan-600 dark:text-cyan-400 text-xl"></i>
                    </div>

                    <!-- Title Input -->
                    <div class="flex-1 min-w-[200px]">
                         <input type="text" id="editor-name" value="${w.name || w.type}" 
                                class="text-xl md:text-2xl font-bold bg-transparent border-none focus:ring-0 w-full text-slate-900 dark:text-white placeholder-slate-400"
                                placeholder="Workout Name">
                    </div>

                    <!-- Stats Row -->
                    <div class="flex items-center gap-6 text-center shrink-0">
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase text-slate-500 font-semibold">Date</span>
                            <span class="text-sm font-medium whitespace-nowrap">${this.computedDateStr}</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase text-slate-500 font-semibold">Duration</span>
                            <span class="text-sm font-bold">${durationMin}m</span>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-[10px] uppercase text-slate-500 font-semibold">${isCycling ? 'Load' : 'Distance'}</span>
                            <span class="text-sm font-bold">${isCycling ? loadVal : distVal + ' km'}</span>
                        </div>
                        <div class="flex flex-col opacity-50">
                            <span class="text-[10px] uppercase text-slate-500 font-semibold">Intensity</span>
                            <span class="text-sm font-bold">${intVal}%</span>
                        </div>
                    </div>

                    <!-- Close -->
                    <button onclick="WorkoutEditor.close()" class="ml-auto md:ml-4 text-slate-400 hover:text-slate-600 dark:hover:text-white">
                        <i class="fa-solid fa-times text-lg"></i>
                    </button>
                    
                </div>

                <!-- BODY -->
                <div class="flex flex-col md:flex-row h-full">
                    
                    <!-- Left: Steps -->
                    <div class="flex-1 p-6 border-r border-slate-200 dark:border-slate-700">
                        ${stepsHtml}

                         <!-- Desc Input (Subtle) -->
                        <div class="mt-8 pt-4 border-t border-slate-200 dark:border-slate-800">
                             <label class="block text-xs font-bold text-slate-400 uppercase mb-2">Description / Notes</label>
                             <textarea id="editor-description" rows="3" 
                                class="w-full bg-slate-100 dark:bg-slate-800 rounded p-2 text-sm text-slate-700 dark:text-slate-300 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                placeholder="Add workout notes...">${w.description || ''}</textarea>
                        </div>
                    </div>

                    <!-- Right: Stats/Zones (Mocked for visual match) -->
                    <div class="w-full md:w-64 p-6 bg-slate-50 dark:bg-slate-800/30">
                        <h4 class="text-xs font-bold text-slate-500 uppercase mb-4">Estimated Zones</h4>
                        
                        <div class="space-y-2 text-xs">
                            <div class="flex justify-between items-center">
                                <span class="w-8">Z1</span>
                                <div class="flex-1 h-3 mx-2 bg-slate-200 dark:bg-slate-700 rounded-sm overflow-hidden">
                                     <div class="h-full bg-emerald-400" style="width: 20%"></div>
                                </div>
                                <span class="text-slate-500 w-12 text-right">--</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="w-8">Z2</span>
                                <div class="flex-1 h-3 mx-2 bg-slate-200 dark:bg-slate-700 rounded-sm overflow-hidden">
                                     <div class="h-full bg-emerald-500" style="width: 60%"></div>
                                </div>
                                <span class="text-slate-500 w-12 text-right">--</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="w-8">Z3</span>
                                <div class="flex-1 h-3 mx-2 bg-slate-200 dark:bg-slate-700 rounded-sm overflow-hidden">
                                     <div class="h-full bg-yellow-400" style="width: 10%"></div>
                                </div>
                                <span class="text-slate-500 w-12 text-right">--</span>
                            </div>
                            <!-- ... more zones ... -->
                        </div>

                        <div class="mt-8 text-center">
                             <button onclick="WorkoutEditor.save()" class="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded shadow-lg shadow-cyan-500/20 transition-all">
                                Save Changes
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modal);
    },

    /**
     * Renders steps in a clean, bulleted list format
     */
    renderStepsAsText: function (workout) {
        if (workout.sport === 'Strength' || workout.type === 'WeightTraining') {
            return `<div class="p-4 bg-slate-100 dark:bg-slate-800 rounded text-sm italic text-slate-600 dark:text-slate-400">
                ${workout.description || 'Strength Session Details'}
            </div>`;
        }

        const steps = workout.steps || [];
        if (steps.length === 0) {
            return `<div class="opacity-50 italic text-sm">No structured steps.</div>`;
        }

        let html = '<div class="space-y-4 text-sm font-medium text-slate-800 dark:text-slate-200">';

        // Helper to format line
        const formatLine = (s) => {
            let dur = '';
            if (s.duration) {
                const min = Math.floor(s.duration / 60);
                const sec = s.duration % 60;
                dur = min > 0 ? `${min}m` : '';
                if (sec > 0) dur += `${sec}s`;
            } else if (s.distance) {
                dur = `${s.distance / 1000}km`;
            } else {
                dur = 'Lap Button';
            }

            // Mocking Pace/HR range for visual completeness
            let intensity = s.intensity || 'Zone 1-2';
            if (s.type === 'Warmup') intensity = '50-60%';
            if (s.type === 'Cooldown') intensity = '50-60%';
            if (s.type === 'Run' || s.type === 'Work') intensity = 'Threshold / Z4';

            return `• ${dur} <span class="text-slate-500 font-normal ml-1">${intensity} Pace</span>`;
        };

        steps.forEach(step => {
            if (step.reps) {
                // Repeats Block
                html += `
                    <div>
                        <div class="text-base font-bold mb-1">${step.reps}x</div>
                        <ul class="pl-4 space-y-1">
                 `;
                step.steps.forEach(sub => {
                    html += `<li>${formatLine(sub)}</li>`;
                });
                html += `</ul></div>`;
            } else {
                // Top Level Section Header?
                // Intervals.icu groups strict "Warmup", "Main Set", "Cooldown".
                // Our data is flat list of steps usually.
                // We'll infer headers if type changes or just list them.

                // For "Roughly" match:
                if (step.type === 'Warmup' || step.type === 'Cooldown') {
                    html += `<div class="mt-4 first:mt-0 font-semibold text-slate-600 dark:text-slate-400 mb-1">${step.type}</div>`;
                }
                html += `<ul><li>${formatLine(step)}</li></ul>`;
            }
        });

        html += '</div>';
        return html;
    },

    save: function () {
        if (!this.currentWorkout) return;

        // Only saving Name and Description really
        const name = document.getElementById('editor-name').value;
        const desc = document.getElementById('editor-description').value;

        this.currentWorkout.name = name;
        this.currentWorkout.description = desc;

        // Apply back to State (Legacy & New logic same as before)
        const wIndex = this.currentWeekIndex;
        const dNum = this.currentDayNum;
        const slot = this.currentSlot;

        if (state.weeklyTemplates && state.weeklyTemplates[wIndex]) {
            const tSlot = state.weeklyTemplates[wIndex][dNum];
            if (slot === 'am') tSlot.workout = this.currentWorkout;
            else tSlot.secondary = this.currentWorkout;
        }

        if (state.generatedPlan && state.generatedPlan[wIndex]?.schedule) {
            const gSlot = state.generatedPlan[wIndex].schedule[dNum];
            if (slot === 'am') gSlot.workout = this.currentWorkout;
            else gSlot.secondary = this.currentWorkout;
        }

        if (window.convertTemplateToWorkouts) {
            window.convertTemplateToWorkouts(wIndex,
                state.weeklyTemplates[wIndex] || state.generatedPlan[wIndex].schedule,
                state.generatedPlan[wIndex]
            );
        }

        if (window.toggleWeekDetail) {
            const detailDiv = document.getElementById(`week-detail-${wIndex}`);
            if (detailDiv) {
                detailDiv.remove();
                const weekCard = document.querySelector(`[data-week-index="${wIndex}"]`);
                if (weekCard) window.toggleWeekDetail(wIndex, weekCard);
            }
        }

        this.close();
        showToast('✓ Workout updated');
    },

    close: function () {
        const modal = document.getElementById('workout-editor-modal');
        if (modal) modal.remove();
        this.currentWorkout = null;
    }
};
