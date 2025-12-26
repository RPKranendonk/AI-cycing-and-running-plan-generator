
// Ensure we wait for DOM
document.addEventListener('DOMContentLoaded', () => {

    // Init UI
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const container = document.getElementById('availabilityInputs');

    if (container) {
        container.innerHTML = ''; // Clear first to be safe
        // Default availability: Sun=3h, Sat=2h, Mon-Fri=1h (Wed=0)
        days.forEach((d, i) => {
            let defaultHours = 1;
            if (i === 0) defaultHours = 3; // Sun
            if (i === 6) defaultHours = 2; // Sat
            if (i === 3) defaultHours = 0; // Wed

            container.innerHTML += `
                <div class="glass-panel p-3 mb-2 rounded bg-slate-800/50">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-sm font-bold text-slate-300 w-12">${d}</span>
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] text-slate-500 uppercase font-bold m-0 cursor-pointer flex items-center gap-1">
                                <input type="checkbox" id="split-${i}" class="w-3 h-3 rounded border-slate-600 bg-slate-700" onchange="toggleSplit(${i})">
                                Split
                            </label>
                            <input type="number" id="day-${i}" value="${defaultHours}" min="0" max="6" step="0.5" class="w-16 text-right text-xs p-1">
                        </div>
                    </div>
                    
                    <div id="split-container-${i}" class="hidden grid-cols-2 gap-2 mt-2 border-t border-white/5 pt-2">
                        <div>
                            <label class="text-[9px] text-slate-500 mb-0.5 block">AM Hours</label>
                            <input type="number" id="day-${i}-am" value="${defaultHours / 2}" min="0" max="4" step="0.25" class="w-full text-right text-xs p-1 bg-slate-900/50" oninput="updateTotal(${i})">
                        </div>
                        <div>
                            <label class="text-[9px] text-slate-500 mb-0.5 block">PM Hours</label>
                            <input type="number" id="day-${i}-pm" value="${defaultHours / 2}" min="0" max="4" step="0.25" class="w-full text-right text-xs p-1 bg-slate-900/50" oninput="updateTotal(${i})">
                        </div>
                    </div>
                </div>
            `;
        });
    }

    // Toggle Split Logic
    window.toggleSplit = function (dayIndex) {
        const isSplit = document.getElementById(`split-${dayIndex}`).checked;
        const container = document.getElementById(`split-container-${dayIndex}`);
        const totalInput = document.getElementById(`day-${dayIndex}`);

        if (isSplit) {
            container.classList.remove('hidden');
            container.classList.add('grid');
            totalInput.disabled = true;
            totalInput.classList.add('opacity-50');
            window.updateTotal(dayIndex);
        } else {
            container.classList.add('hidden');
            container.classList.remove('grid');
            totalInput.disabled = false;
            totalInput.classList.remove('opacity-50');
        }
    };

    // Update Total from AM/PM
    window.updateTotal = function (dayIndex) {
        const am = parseFloat(document.getElementById(`day-${dayIndex}-am`).value) || 0;
        const pm = parseFloat(document.getElementById(`day-${dayIndex}-pm`).value) || 0;
        document.getElementById(`day-${dayIndex}`).value = (am + pm);
    };

    // Pace Converter
    window.getPaceSec = function () {
        const min = parseInt(document.getElementById('paceMin').value) || 5;
        const sec = parseInt(document.getElementById('paceSec').value) || 0;
        const total = (min * 60) + sec;
        const display = document.getElementById('paceDisplay');
        if (display) {
            display.textContent = `${total} sec/km (~${min}:${sec.toString().padStart(2, '0')}/km)`;
        }
        return total;
    };

    const pMin = document.getElementById('paceMin');
    const pSec = document.getElementById('paceSec');
    if (pMin) pMin.addEventListener('input', window.getPaceSec);
    if (pSec) pSec.addEventListener('input', window.getPaceSec);

    // Apply Persona Presets
    window.applyPersona = function (type) {
        // Reset all first
        for (let i = 0; i < 7; i++) {
            document.getElementById(`split-${i}`).checked = false;
            window.toggleSplit(i); // Reset UI
        }

        if (type === 'unlimited') {
            for (let i = 0; i < 7; i++) {
                document.getElementById(`day-${i}`).value = 3.0; // 3h every day
            }
        } else if (type === 'weekend') {
            for (let i = 0; i < 7; i++) {
                // Sun(0) and Sat(6) = 4h. Others 1h.
                if (i === 0 || i === 6) document.getElementById(`day-${i}`).value = 4.0;
                else document.getElementById(`day-${i}`).value = 0.5;
            }
        } else if (type === 'split') {
            // Weekdays (Mon=1 to Fri=5) split
            for (let i = 1; i <= 5; i++) {
                document.getElementById(`split-${i}`).checked = true;
                window.toggleSplit(i);
                document.getElementById(`day-${i}-am`).value = 1.0;
                document.getElementById(`day-${i}-pm`).value = 1.0;
                window.updateTotal(i); // Calc total 2.0
            }
            // Weekends normal
            document.getElementById(`day-0`).value = 3.0;
            document.getElementById(`day-6`).value = 3.0;
        }

        window.runSimulation();
    };

    // Simulation
    window.runSimulation = function () {
        // console.log("Running simulation..."); // Debounce log if needed
        const resultsDiv = document.getElementById('resultsContainer');
        const header = document.getElementById('resultsHeader');
        // Keep header visible, clear results
        header.classList.remove('hidden');
        resultsDiv.innerHTML = '';

        // 1. Inputs
        const thresholdPace = window.getPaceSec();
        const startVolume = parseInt(document.getElementById('startVolume').value) || 30;
        const startLongRun = parseInt(document.getElementById('startLongRun').value) || 12;
        const raceType = document.getElementById('raceType').value;

        // Advanced settings
        const progressionRate = parseFloat(document.getElementById('progressionRate').value) || 0.075;
        const longRunProgression = parseFloat(document.getElementById('longRunProgression').value) || 2.0;
        const taperDuration = parseInt(document.getElementById('taperDuration').value) || 3;
        const gymDays = parseInt(document.getElementById('gymDays').value) || 2;
        const preferredLRDay = parseInt(document.getElementById('longRunDay').value) || 0;

        const availability = {};
        for (let i = 0; i < 7; i++) {
            const el = document.getElementById(`day-${i}`);
            availability[i] = el ? (parseFloat(el.value) || 0) : 0;
        }

        // 2. Generate Macro Plan
        if (!window.RunningAdapter) {
            resultsDiv.innerHTML = '<div class="text-red-400">Error: RunningAdapter not loaded.</div>';
            return;
        }

        const today = new Date();
        const futureDate = new Date();
        futureDate.setDate(today.getDate() + (16 * 7)); // 16 weeks out
        const raceDateStr = futureDate.toISOString().split('T')[0];
        const startDateStr = today.toISOString().split('T')[0];

        const adapter = new window.RunningAdapter();

        // Correct Input Mapping for RunningAdapter
        const inputs = {
            raceType: raceType,
            startVolume: startVolume, // FIXED: was initialVolume
            startLongRun: startLongRun,
            planDuration: 16,
            availableWeeks: 16,
            startDate: startDateStr,

            // Explicitly pass options here as well if adapter looks into inputs
            progressionRate: progressionRate,
            taperDuration: taperDuration,
            longRunProgression: longRunProgression
        };

        const settings = {
            progressionRate: progressionRate,
            longRunProgression: longRunProgression,
            taperDuration: taperDuration,
            raceDate: raceDateStr,
            planStartDate: startDateStr,
            userEasyPace: thresholdPace / 60 * 1.25 // Pass Easy Pace (min/km) for 3h Cap
        };

        // Generate Macro Plan
        console.log("Generating plan with inputs:", inputs);
        console.log("Using settings:", settings);

        const plan = adapter.generatePlan(inputs, settings);
        console.log("Generated plan (Macro):", plan);

        // 3. Generate Micro Schedule
        const options = {
            thresholdPace: thresholdPace,
            easyPace: Math.round(thresholdPace * 1.25),
            preferredLongRunDay: preferredLRDay
        };

        if (plan.length === 0) {
            console.warn("Plan is empty!");
            resultsDiv.innerHTML = '<div class="text-yellow-400">No plan generated. Check inputs.</div>';
            return;
        }

        let currentPhase = "";
        let weekInPhase = 1;

        plan.forEach((weekData, index) => {
            const schedulerInput = {
                targetVolume: weekData.rawKm || weekData.mileage,
                longRunDistance: weekData.longRun,
                phase: weekData.phaseName,
                gymTarget: gymDays,
                sport: 'Running'
            };

            // Normalize Phase Name
            let phaseName = weekData.phaseName;
            if (phaseName.includes('Phase')) phaseName = phaseName.replace(' Phase', '').trim();
            if (phaseName.includes('/')) {
                if (phaseName.includes('Build')) phaseName = 'Build';
                else if (phaseName.includes('Base')) phaseName = 'Base';
            }

            // Track Progression (Reset counter if phase changes)
            if (phaseName !== currentPhase) {
                currentPhase = phaseName;
                weekInPhase = 1;
            } else {
                weekInPhase++;
            }

            // SMART SCHEDULER INPUTS
            const smartInput = {
                targetVolume: weekData.rawKm || weekData.mileage,
                longRunDistance: weekData.longRun,
                phase: phaseName,
                gymTarget: gymDays,
                sport: 'Running',
                availability: availability, // Use current persona settings
                isRecoveryWeek: weekData.isRecovery, // Corrected from weekData.isRecoveryWeek
                weekInPhase: weekInPhase, // Pass progression index
                userEasyPace: thresholdPace / 60 * 1.25 // Convert sec/km to min/km properly? 
                // userEasyPace in SmartScheduler is min/km. thresholdPace is sec/km.
                // Easy pace ~1.25x Threshold.
                // Ex: Threshold 5:00/km (300s). Easy 6:15/km (375s). 375/60 = 6.25 min/km.
            };

            // Calc Pace in min/km
            const easyPaceSec = Math.round(thresholdPace * 1.25);
            smartInput.userEasyPace = easyPaceSec / 60;

            const availabilityObj = availability; // Already {0: hrs, ...}

            // RUN SMART SCHEDULER
            const result = window.generateWeeklyTemplate(smartInput, availabilityObj, {
                minSessionDuration: 30
            });

            // Adapt Result for Render
            // SmartScheduler returns { template: [], warnings: [] }
            // Template slots have .type { id, label, color }

            const adaptedResult = {
                schedule: result.template.map(slot => {
                    // Only treat secondary as a PM workout if it's a gym session
                    const isGymSecondary = slot.secondary?.id === 'WeightTraining';

                    return {
                        day: slot.day,
                        dayName: slot.dayName,
                        type: slot.type ? slot.type.id : null,
                        workout: slot.type ? {
                            name: slot.type.label,
                            totalDistance: slot.distance,
                            duration: slot.duration,
                            description: `Priority: ${slot.priority}`,
                            steps: slot.steps // [FIX] Propagate steps to UI object
                        } : null,
                        // PM slot: Only for actual gym sessions
                        secondary: isGymSecondary ? {
                            id: 'WeightTraining',
                            name: 'Strength',
                            label: 'Strength',
                            duration: 2700
                        } : null,
                        availableHours: slot.availableHours,
                        sport: slot.type?.id === 'WeightTraining' ? 'Strength' : 'Running',
                        note: slot.note || (slot.secondary?.label && !isGymSecondary ? slot.secondary.label : null),
                        distance: slot.distance,
                        duration: slot.duration
                    };
                }),
                warnings: result.warnings,
                usedVolume: result.template.reduce((acc, s) => acc + (s.distance || 0), 0)
            };

            renderWeek(index + 1, weekData, adaptedResult);
        });
    };

    // Auto-Run Listeners on ALL Inputs
    function attachListeners() {
        const inputs = document.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('change', window.runSimulation);
            input.addEventListener('input', window.runSimulation);
        });
    }

    // Robust Initialization
    function init() {
        attachListeners();

        // Try running simulation, retry if adapters missing
        const attemptRun = () => {
            if (window.RunningAdapter && window.DeterministicScheduler) {
                window.runSimulation();
            } else {
                console.log("Waiting for adapters...");
                setTimeout(attemptRun, 100);
            }
        };
        attemptRun();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function renderWeek(weekNum, macro, micro) {
        const container = document.getElementById('resultsContainer');
        const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

        // Color mapping helper
        function getColorClass(type) {
            if (type === 'LongRun') return 'border-orange-500/50 bg-orange-900/20 text-orange-200';
            if (type === 'Intervals' || type === 'HillSprints' || type === 'Fartlek') return 'border-red-500/50 bg-red-900/20 text-red-200';
            if (type === 'Tempo' || type === 'Progression') return 'border-amber-500/50 bg-amber-900/20 text-amber-200';
            if (type === 'WeightTraining') return 'border-purple-500/50 bg-purple-900/20 text-purple-200';
            if (type === 'Easy') return 'border-blue-500/50 bg-blue-900/20 text-blue-200';
            if (type === 'ActiveRecovery') return 'border-emerald-500/50 bg-emerald-900/20 text-emerald-200';
            return 'border-slate-700 bg-slate-800/50';
        }

        // Format Duration helper
        function formatDuration(seconds) {
            if (!seconds) return '-';
            const mins = Math.round(seconds / 60);
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
        }

        // Day headers
        let headerHtml = displayOrder.map(dIndex => {
            const dayData = micro.schedule[dIndex];
            return `<div class="text-center text-xs font-bold text-slate-400 border-b border-white/10 pb-1">${dayData.dayName}</div>`;
        }).join('');

        // AM Row (Primary workout or Rest)
        let amRowHtml = displayOrder.map(dIndex => {
            const dayData = micro.schedule[dIndex];
            const type = dayData.type || 'Rest';
            const workout = dayData.workout;
            const colorClass = getColorClass(type);

            if (type === 'Rest' || !workout) {
                return `<div class="h-20 p-2 rounded border border-slate-700 bg-slate-800/30 text-xs flex items-center justify-center text-slate-600">
                    <span>-</span>
                </div>`;
            }

            return `
                <div class="h-20 p-2 rounded border ${colorClass} text-xs flex flex-col justify-between overflow-hidden">
                    <div class="font-bold truncate text-[11px]" title="${workout.name}">${workout.name}</div>
                    <div class="flex justify-between text-[10px] opacity-80">
                        <span>${workout.totalDistance || dayData.distance || 0}km</span>
                        <span>${formatDuration(workout.duration || dayData.duration)}</span>
                    </div>
                    ${dayData.note ? `<div class="text-[8px] opacity-60 truncate" title="${dayData.note}">${dayData.note}</div>` : ''}
                </div>
            `;
        }).join('');

        // PM Row (Secondary workout like gym, or empty)
        let pmRowHtml = displayOrder.map(dIndex => {
            const dayData = micro.schedule[dIndex];
            const secondary = dayData.secondary;

            if (!secondary) {
                return `<div class="h-14 p-1 rounded border border-dashed border-slate-700/50 bg-slate-900/30 text-xs flex items-center justify-center text-slate-700">
                    <span class="text-[9px]">—</span>
                </div>`;
            }

            const colorClass = getColorClass(secondary.id || 'WeightTraining');
            const name = secondary.name || secondary.label || 'Gym';

            return `
                <div class="h-14 p-1 rounded border ${colorClass} text-xs flex flex-col justify-center items-center overflow-hidden">
                    <div class="font-bold text-[10px]">${name}</div>
                    <div class="text-[9px] opacity-70">45m</div>
                </div>
            `;
        }).join('');

        const html = `
            <div class="week-card rounded-xl p-4 transition-all hover:bg-slate-800/80">
                <div class="flex justify-between items-end mb-3 pb-2 border-b border-white/5">
                    <div>
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">Week ${weekNum}</span>
                        <h3 class="text-lg font-bold text-white">${macro.phaseName}</h3>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-cyan-400">${micro.usedVolume.toFixed(1)} <span class="text-xs text-slate-500 font-normal">/ ${macro.rawKm} km</span></div>
                    </div>
                </div>
                
                <!-- Day Headers -->
                <div class="grid grid-cols-7 gap-2 mb-1">
                    ${headerHtml}
                </div>
                
                <!-- AM Slots -->
                <div class="flex items-center mb-1">
                    <span class="text-[9px] font-bold text-slate-500 w-8 uppercase">AM</span>
                    <div class="grid grid-cols-7 gap-2 flex-1">
                        ${amRowHtml}
                    </div>
                </div>
                
                <!-- PM Slots -->
                <div class="flex items-center">
                    <span class="text-[9px] font-bold text-slate-500 w-8 uppercase">PM</span>
                    <div class="grid grid-cols-7 gap-2 flex-1">
                        ${pmRowHtml}
                    </div>
                </div>
                
                ${micro.warnings.length > 0 ? `
                    <div class="mt-2 bg-red-500/10 border border-red-500/20 p-2 rounded text-[10px] text-red-300">
                        ${micro.warnings.map(w => w.message).join('<br>')}
                    </div>
                ` : ''}
            </div>
        `;

        container.innerHTML += html;
    }

    console.log("Scheduler Logic Loaded");
});
