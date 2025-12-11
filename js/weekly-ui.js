// ===================================================================
// WEEKLY UI MODULE
// Handles week detail view rendering and user interactions
// ===================================================================

/**
 * Expands or collapses the weekly detail view for a given week
 */
function toggleWeekDetail(weekIndex, element) {
    try {
        const detailId = `week-detail-${weekIndex}`;
        let detailDiv = document.getElementById(detailId);
        const chevron = document.getElementById(`chevron-${weekIndex}`);

        if (detailDiv) {
            // Already exists, toggle visibility
            if (detailDiv.classList.contains('hidden')) {
                detailDiv.classList.remove('hidden');
                detailDiv.classList.add('animate-slide-up');
                if (chevron) chevron.classList.add('rotate-90');
                calculateAndRenderDistribution(weekIndex);
            } else {
                detailDiv.classList.add('hidden');
                detailDiv.classList.remove('animate-slide-up');
                if (chevron) chevron.classList.remove('rotate-90');
            }
            return;
        }

        // Create the detail view
        let weekCard = element.closest('[data-week-index]');
        if (!weekCard) {
            weekCard = document.querySelector(`[data-week-index="${weekIndex}"]`);
        }

        if (!weekCard) {
            console.error(`Week card not found for index ${weekIndex}`);
            return;
        }

        if (chevron) chevron.classList.add('rotate-90');

        detailDiv = document.createElement('div');
        detailDiv.id = detailId;
        detailDiv.className = 'mt-4 p-4 bg-slate-900/50 rounded-xl border border-white/5 animate-slide-up';

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNumbers = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order

        // Get current availability or default
        const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;

        // Calculate Week Start Date
        const weekData = state.generatedPlan[weekIndex];
        let weekStart = new Date();
        if (weekData && weekData.startDate) {
            const parts = weekData.startDate.split('-');
            weekStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        let html = '<div class="space-y-6">';

        // Grid container for side-by-side layout
        html += '<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">';

        // LEFT SIDE: Weekly Schedule
        html += '<div>';
        html += '<h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Weekly Schedule</h4>';
        html += '<div class="space-y-2">';

        // Create rows for each day
        dayNumbers.forEach(dayNum => {
            const dayName = dayNames[dayNum];
            const isChecked = availability.includes(dayNum);
            const isLongRun = dayNum === state.longRunDay;

            let offset = 0;
            if (dayNum === 0) offset = 6;
            else offset = dayNum - 1;

            const d = new Date(weekStart);
            d.setDate(weekStart.getDate() + offset);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;

            // Prepare Long Run Badge HTML
            let longRunBadge = '';
            if (isLongRun) {
                longRunBadge = `
    <div class="absolute inset-0 flex items-center justify-center">
        <div class="px-2 py-0.5 bg-orange-500 text-white rounded cursor-move font-bold text-[10px] shadow-lg"
            draggable="true"
            ondragstart="event.dataTransfer.effectAllowed='move'; event.stopPropagation();">
            LONG
        </div>
    </div>`;
            }

            const rowClass = isLongRun ? 'bg-orange-500/10 border-orange-500/30' : 'bg-white/5 border-white/5';
            const borderClass = isLongRun ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/10 hover:border-white/20';

            html += `
    <div class="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center p-2 rounded-lg border ${rowClass} transition-colors">
        <input type="checkbox"
            data-day="${dayNum}"
            ${isChecked ? 'checked' : ''}
            onchange="updateWeekAvailability(${weekIndex}, ${dayNum}, this.checked)"
            onclick="event.stopPropagation()"
            class="cursor-pointer accent-cyan-500 w-4 h-4 rounded border-slate-600 bg-slate-800">
            <span class="text-sm text-slate-300 font-medium">${dayName} <span class="text-xs text-slate-500 ml-1 font-mono">${dateStr}</span></span>
            <span class="text-sm font-mono text-slate-400"></span>
            <div class="relative w-16">
                <div class="h-6 border-2 border-dashed rounded cursor-pointer transition-all ${borderClass}"
                    data-day="${dayNum}"
                    onclick="setLongRunDay(${weekIndex}, ${dayNum}); event.stopPropagation();"
                    ondragover="event.preventDefault(); event.currentTarget.classList.add('bg-slate-700');"
                    ondragleave="event.currentTarget.classList.remove('bg-slate-700');"
                    ondrop="handleLongRunDrop(event, ${weekIndex}, ${dayNum})">
                    ${longRunBadge}
                </div>
            </div>
        </div>
`;
        });

        html += '</div>';
        html += '</div>'; // End left side

        // RIGHT SIDE: AI Workout Planning Section
        html += '<div class="lg:col-span-2 flex flex-col">';
        html += '<h4 class="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4">AI Workout Plan</h4>';

        // Workout summary area
        html += `<div id="workout-summary-${weekIndex}" class="flex-1 mb-4 space-y-2 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar">`;
        html += '<div class="text-sm text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-lg">No workouts generated yet. Click "Prepare Week Plan" to generate.</div>';
        html += '</div>';

        // Action buttons
        html += '<div class="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">';
        html += `
            <button type="button" onclick="preparePlanWithAI('week', [${weekIndex}]); event.stopPropagation();" 
                class="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-bold py-2 px-4 rounded-lg border border-blue-500/20 transition-colors flex items-center justify-center gap-2">
                <i class="fa-solid fa-robot"></i> Generate
            </button>
            <div class="col-span-2 flex gap-2">
                <button onclick="pushToIntervalsICU(${weekIndex})" id="push-btn-${weekIndex}" class="flex-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs py-2 rounded transition-colors flex items-center justify-center gap-2 border border-cyan-500/20">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Push to Intervals.icu
                </button>
                <button onclick="resetRemoteWeeklyWorkouts(${weekIndex})" class="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs py-2 rounded transition-colors border border-red-500/20" title="Clear workouts from Intervals.icu (Keeps local plan)">
                    <i class="fa-solid fa-trash-can"></i> Clear Remote
                </button>
            </div>
        `;
        html += '</div>';
        html += '</div>'; // End right side

        html += '</div>'; // End grid
        html += '</div>'; // End container

        detailDiv.innerHTML = html;
        weekCard.appendChild(detailDiv);

        calculateAndRenderDistribution(weekIndex);

        // Check if we have generated workouts in state and render them
        if (state.generatedWorkouts && state.generatedWorkouts[weekIndex]) {
            renderAIWorkouts(weekIndex, state.generatedWorkouts[weekIndex], availability);
        }
    } catch (e) {
        console.error("Error in toggleWeekDetail:", e);
        showToast(`❌ Error opening week: ${e.message}`);
    }
}

/**
 * Sets the long run day for the week
 */
function setLongRunDay(weekIndex, dayNum) {
    // Update the global long run day setting
    state.longRunDay = dayNum;
    localStorage.setItem('elite_longRunDay', dayNum);

    // Get current availability
    let availability = state.weeklyAvailability[weekIndex] || [...state.defaultAvailableDays];

    // Make sure long run day is in the availability list
    if (!availability.includes(dayNum)) {
        availability.push(dayNum);
        state.weeklyAvailability[weekIndex] = availability;
        localStorage.setItem('elite_weeklyAvail', JSON.stringify(state.weeklyAvailability));
    }

    // Re-render the entire week detail to update highlighting
    const detailDiv = document.getElementById(`week-detail-${weekIndex}`);
    if (detailDiv) {
        detailDiv.remove();
    }
    toggleWeekDetail(weekIndex);
}

/**
 * Handles dropping the long run indicator on a day
 */
function handleLongRunDrop(event, weekIndex, dayNum) {
    event.preventDefault();
    event.currentTarget.classList.remove('bg-slate-700');
    setLongRunDay(weekIndex, dayNum);
}

/**
 * Updates the availability for a specific week when a checkbox is toggled
 */
function updateWeekAvailability(weekIndex, dayNum, isChecked) {
    // Prevent unchecking the long run day
    if (!isChecked && dayNum === state.longRunDay) {
        showToast("Please select another day for your long run first");
        // Re-check the checkbox
        const checkbox = document.querySelector(`#week-detail-${weekIndex} input[data-day="${dayNum}"]`);
        if (checkbox) {
            checkbox.checked = true;
        }
        return;
    }

    // Get current availability
    let availability = state.weeklyAvailability[weekIndex] || [...state.defaultAvailableDays];

    if (isChecked) {
        // Add day if not already there
        if (!availability.includes(dayNum)) {
            availability.push(dayNum);
        }
    } else {
        // Remove day
        availability = availability.filter(d => d !== dayNum);
    }

    // Store override
    state.weeklyAvailability[weekIndex] = availability;
    localStorage.setItem('elite_weeklyAvail', JSON.stringify(state.weeklyAvailability));

    // Recalculate distribution
    calculateAndRenderDistribution(weekIndex);
}

/**
 * Calculates run distribution for a given week
 */
function calculateRunDistribution(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return null;

    const totalVolume = week.rawKm;
    const longRunKm = parseInt(week.longRun) || 0;
    const remainingKm = totalVolume - longRunKm;

    // Get availability
    const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;
    // Exclude long run day from the "other days" list for distribution
    const otherDays = availability.filter(d => d !== state.longRunDay);

    const distribution = {};

    // Add long run
    distribution[state.longRunDay] = {
        distance: longRunKm,
        isLongRun: true
    };

    // Distribute remaining across other days (excluding long run day)
    if (otherDays.length > 0) {
        const perDayKm = remainingKm / otherDays.length;
        otherDays.forEach(day => {
            distribution[day] = {
                distance: perDayKm,
                isLongRun: false
            };
        });
    }

    return distribution;
}

/**
 * Recalculates and updates the km labels in the checkboxes
 */
function calculateAndRenderDistribution(weekIndex) {
    // Distance display removed as per user request
    return;
}

/**
 * Renders AI-generated workouts to the UI
 */
function renderAIWorkouts(weekIndex, workouts, availability) {
    const container = document.getElementById(`workout-summary-${weekIndex}`);
    if (!container) return;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNumbers = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order

    let html = '';
    console.log(`Rendering workouts for Week ${weekIndex + 1}`, workouts);

    if (!workouts || workouts.length === 0) {
        console.warn(`No workouts found for Week ${weekIndex + 1}`);
        container.innerHTML = '<div class="text-sm text-slate-500 italic p-4 text-center border border-dashed border-slate-800 rounded-lg">No workouts generated yet. Click "Prepare Week Plan" to generate.</div>';
        return;
    }

    // Sort availability to display in Mon-Sun order
    const sortedAvailability = [...availability].sort((a, b) => {
        const aIndex = dayNumbers.indexOf(a);
        const bIndex = dayNumbers.indexOf(b);
        return aIndex - bIndex;
    });

    sortedAvailability.forEach(dayNum => {
        const dayName = dayNames[dayNum];
        const isLongRun = dayNum === state.longRunDay;

        // Find workout for this day
        const workout = workouts.find(w => {
            if (w.start_date_local) {
                const wDate = new Date(w.start_date_local);
                const wDay = wDate.getDay();
                return wDay === dayNum;
            }
            return false;
        });

        if (isLongRun) {
            // Always prioritize the long run structure, but use AI description if available
            const descUI = workout && workout.description_ui ? workout.description_ui : "Steady aerobic pace, build last 20%";
            const descExport = workout && workout.description_export ? workout.description_export : descUI;
            const safeDescExport = (descExport || "").replace(/"/g, '&quot;');

            html += `<div class="p-2 bg-orange-500/10 border border-orange-500/30 rounded" data-description="${safeDescExport}">
                <div class="text-xs font-bold text-orange-400">${dayName}: Long Run</div>
                <div class="text-[10px] text-slate-400">${descUI}</div>
            </div>`;
        } else if (workout) {
            // Handle both new format (ui/export) and legacy format (description)
            const descUI = workout.description_ui || workout.description || "";
            const descExport = workout.description_export || workout.description || descUI;
            const safeDescExport = (descExport || "").replace(/"/g, '&quot;');

            html += `<div class="p-2 bg-slate-700/30 rounded" data-description="${safeDescExport}">
                <div class="text-xs font-bold text-slate-300">${dayName}: ${workout.type}</div>
                <div class="text-[10px] text-slate-400">${descUI}</div>
            </div>`;
        } else {
            // Fallback if AI missed a day
            html += `<div class="p-2 bg-slate-700/30 rounded opacity-50">
                <div class="text-xs font-bold text-slate-300">${dayName}: Easy Run</div>
                <div class="text-[10px] text-slate-400">Easy aerobic run (AI missed this day)</div>
            </div>`;
        }
    });

    container.innerHTML = html;
}

/**
 * Displays mock workouts for demonstration
 */
function displayMockWorkouts(weekIndex, availability) {
    const container = document.getElementById(`workout-summary-${weekIndex}`);
    if (!container) return;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNumbers = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order

    let html = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
            <div class="text-xs font-bold text-slate-400 uppercase mb-2">Availability & Distribution</div>
            <div class="space-y-2">`;

    // Sort availability to display in Mon-Sun order
    const workoutTypes = [
        { type: "Tempo Run", desc: "3x8min @ threshold, 2min rest" },
        { type: "Easy Run", desc: "Easy aerobic pace" },
        { type: "Intervals", desc: "6x800m @ 5K pace, 400m jog" },
        { type: "Recovery", desc: "Very easy, conversational pace" }
    ];

    dayNumbers.forEach(dayNum => {
        const dayName = dayNames[dayNum];
        const isSelected = availability.includes(dayNum);
        const isLongRun = dayNum === state.longRunDay;

        html += `<label class="flex items-center justify-between p-2 rounded bg-slate-900/50 border ${isSelected ? 'border-slate-600' : 'border-slate-800 opacity-50'} cursor-pointer hover:border-slate-500 transition-colors">
            <div class="flex items-center gap-2">
                <input type="checkbox" data-day="${dayNum}" ${isSelected ? 'checked' : ''} class="accent-teal-500" onchange="updateWeekAvailability(${weekIndex}, ${dayNum}, this.checked)">
                <span class="text-sm text-slate-300 font-bold w-8">${dayName}</span>
                ${isLongRun ? '<span class="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded ml-2">Long Run</span>' : ''}
            </div>
            <span class="text-sm font-mono text-slate-400"></span> 
        </label>`;

        const workout = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];

        html += `<div class="p-2 bg-slate-700/30 rounded">
                    <div class="text-xs font-bold text-slate-300">${dayName}: ${workout.type}</div>
                    <div class="text-[10px] text-slate-400">${workout.desc}</div>
                </div>`;
    });

    container.innerHTML = html;
}

/**
 * Renders the weekly plan to the UI, grouped by blocks
 */
function renderWeeklyPlan() {
    const container = document.getElementById('planContainer');
    if (!container) return;

    container.innerHTML = '';

    const emptyState = document.getElementById('emptyStateContainer');

    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        container.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    container.classList.remove('hidden');

    const isCycling = state.sportType === 'Cycling';
    const volLabel = isCycling ? 'Load' : 'Volume';
    const volUnit = isCycling ? 'TSS' : 'km';
    const lrLabel = isCycling ? 'Long Ride' : 'Long Run';
    const lrUnit = isCycling ? 'h' : 'km';

    // 1. Group weeks into blocks
    const blocks = [];
    let currentBlock = null;

    state.generatedPlan.forEach((week, index) => {
        const blockKey = week.blockNum || week.phaseName;

        if (!currentBlock || currentBlock.id !== blockKey) {
            currentBlock = {
                id: blockKey,
                name: week.phaseName,
                weeks: [],
                isOpen: true
            };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    // 2. Render Blocks
    blocks.forEach((block, blockIndex) => {
        const blockId = `block-${blockIndex}`;

        // Block Container
        const blockDiv = document.createElement('div');
        blockDiv.className = 'glass-panel rounded-2xl overflow-hidden animate-fade-in mb-6';
        blockDiv.style.animationDelay = `${blockIndex * 0.1}s`;

        // Block Header
        const header = document.createElement('div');
        header.className = 'p-4 bg-white/5 flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors border-b border-white/5';
        header.onclick = () => {
            const content = document.getElementById(`content-${blockId}`);
            const icon = document.getElementById(`icon-${blockId}`);
            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                icon.classList.add('rotate-180');
            } else {
                content.classList.add('hidden');
                icon.classList.remove('rotate-180');
            }
        };

        // Determine Block Color
        let blockColorClass = 'text-slate-300';
        if (block.name.includes('Base')) blockColorClass = 'text-cyan-400';
        if (block.name.includes('Build')) blockColorClass = 'text-emerald-400';
        if (block.name.includes('Peak')) blockColorClass = 'text-purple-400';
        if (block.name.includes('Taper')) blockColorClass = 'text-yellow-400';
        if (block.name.includes('Race')) blockColorClass = 'text-red-400';
        if (block.name.includes('Recovery')) blockColorClass = 'text-teal-400';

        const totalVol = block.weeks.reduce((sum, w) => sum + (parseFloat(w.mileage) || 0), 0);
        const duration = block.weeks.length;

        header.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <i class="fa-solid fa-chevron-down transition-transform duration-300 rotate-180 text-slate-400 text-xs" id="icon-${blockId}"></i>
                </div>
                <div>
                    <h3 class="font-bold ${blockColorClass} text-lg tracking-tight">${block.name}</h3>
                    <div class="text-xs text-slate-500 font-mono">${duration} Weeks • Total ${Math.round(totalVol)} ${volUnit}</div>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button onclick="event.stopPropagation(); prepareBlockWorkouts(${blockIndex})" 
                    class="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all text-xs font-bold flex items-center gap-2">
                    <i class="fa-solid fa-wand-magic-sparkles"></i> <span class="hidden sm:inline">Prepare</span>
                </button>
                <button onclick="event.stopPropagation(); pushBlockWorkouts(${blockIndex})" 
                    class="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all text-xs font-bold flex items-center gap-2">
                    <i class="fa-solid fa-cloud-arrow-up"></i> <span class="hidden sm:inline">Push</span>
                </button>
                <button onclick="event.stopPropagation(); deleteFutureWorkouts(${blockIndex})" 
                    class="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all text-xs font-bold flex items-center gap-2">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;

        // Block Content (Weeks)
        const content = document.createElement('div');
        content.id = `content-${blockId}`;
        content.className = 'p-4 space-y-3';

        block.weeks.forEach(week => {
            const index = week.originalIndex;
            const weekCard = document.createElement('div');
            weekCard.className = 'glass-card rounded-xl p-4 cursor-pointer group';
            weekCard.dataset.weekIndex = index;
            // Note: We don't attach onclick here because the header inside will handle it, 
            // or we can attach it to the card but prevent propagation on buttons.
            // Let's attach to the card for better UX.
            weekCard.onclick = (e) => {
                // Only toggle if clicking the header or a child of the header
                if (e.target.closest('.week-header')) {
                    toggleWeekDetail(index, e.currentTarget);
                }
            };

            // Phase Badge
            let phaseColor = 'text-slate-400';
            let phaseBg = 'bg-slate-800';

            if (week.phaseName.includes('Base')) { phaseColor = 'text-cyan-400'; phaseBg = 'bg-cyan-950/30 border-cyan-500/20'; }
            else if (week.phaseName.includes('Build')) { phaseColor = 'text-emerald-400'; phaseBg = 'bg-emerald-950/30 border-emerald-500/20'; }
            else if (week.phaseName.includes('Peak')) { phaseColor = 'text-purple-400'; phaseBg = 'bg-purple-950/30 border-purple-500/20'; }
            else if (week.phaseName.includes('Taper')) { phaseColor = 'text-yellow-400'; phaseBg = 'bg-yellow-950/30 border-yellow-500/20'; }
            else if (week.phaseName.includes('Race')) { phaseColor = 'text-red-400'; phaseBg = 'bg-red-950/30 border-red-500/20'; }
            else if (week.weekName.includes('Recovery')) { phaseColor = 'text-teal-400'; phaseBg = 'bg-teal-950/30 border-teal-500/20'; }

            // Get weekly note if exists
            const weekNote = state.weeklyNotes && state.weeklyNotes[index] ? state.weeklyNotes[index].note : null;
            const noteHtml = weekNote ? `
                <div class="mt-2 p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div class="text-[10px] text-amber-400 flex items-center gap-1">
                        <i class="fa-solid fa-lightbulb"></i> Coach Note
                    </div>
                    <div class="text-xs text-amber-200/80">${weekNote}</div>
                </div>` : '';

            const headerHtml = `
                <div class="week-header flex items-center justify-between">
                    <div class="flex items-center gap-4">
                        <div class="flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-slate-800/50 border border-white/5 group-hover:border-white/10 transition-colors">
                            <span class="text-[10px] text-slate-500 font-bold uppercase">Week</span>
                            <span class="text-lg font-bold text-white">${week.week}</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <span class="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">${week.weekName}</span>
                                <span class="text-[10px] px-2 py-0.5 rounded-full border ${phaseBg} ${phaseColor} font-bold uppercase tracking-wider">${week.focus}</span>
                            </div>
                            <div class="text-xs text-slate-500 flex items-center gap-2 font-mono">
                                <i class="fa-regular fa-calendar"></i> ${week.date}
                            </div>
                            ${noteHtml}
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-6">
                        <div class="text-right hidden sm:block">
                            <div class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">${volLabel}</div>
                            <div class="font-mono font-bold text-lg text-white leading-none">${week.mileage} <span class="text-xs text-slate-500 font-normal">${volUnit}</span></div>
                        </div>
                        <div class="text-right hidden sm:block">
                            <div class="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">${lrLabel}</div>
                            <div class="font-mono font-bold text-lg text-white leading-none">${week.longRun} <span class="text-xs text-slate-500 font-normal">${lrUnit}</span></div>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-cyan-500 group-hover:text-white transition-all">
                            <i class="fa-solid fa-chevron-right text-xs transition-transform duration-300" id="chevron-${index}"></i>
                        </div>
                    </div>
                </div>
            `;

            weekCard.innerHTML = headerHtml;
            content.appendChild(weekCard);
        });

        blockDiv.appendChild(header);
        blockDiv.appendChild(content);
        container.appendChild(blockDiv);
    });
}

// Global variable to store blocks for access by prepareBlockWorkouts
// We need to reconstruct the blocks logic or store it in state.
// Since renderWeeklyPlan reconstructs it locally, we should probably store it in state or re-derive it.
// Re-deriving is safer.

async function prepareBlockWorkouts(blockIndex) {
    if (!state.generatedPlan) return;

    // Re-derive blocks (same logic as render)
    const blocks = [];
    let currentBlock = null;
    state.generatedPlan.forEach((week, index) => {
        const blockKey = week.blockNum || week.phaseName;
        if (!currentBlock || currentBlock.id !== blockKey) {
            currentBlock = { id: blockKey, name: week.phaseName, weeks: [] };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    const targetBlock = blocks[blockIndex];
    if (!targetBlock) return showToast("Block not found");

    showConfirm("Prepare Block Plan", `Prepare detailed workouts for all ${targetBlock.weeks.length} weeks in "${targetBlock.name}"? This may take a minute.`, async () => {
        showToast(`🪄 Preparing ${targetBlock.weeks.length} weeks for ${targetBlock.name}...`);

        try {
            // Collect all week indices
            const weekIndices = targetBlock.weeks.map(w => w.originalIndex);
            console.log(`[Block Debug] Preparing block "${targetBlock.name}" with indices:`, weekIndices);

            // Call AI once for the whole block
            await preparePlanWithAI('block', weekIndices);

        } catch (e) {
            console.error(`Error preparing block ${targetBlock.name}:`, e);
            showToast(`❌ Error preparing block`);
        }

        showToast(`✅ Block "${targetBlock.name}" ready!`);
    });
}

async function pushBlockWorkouts(blockIndex) {
    if (!state.generatedPlan) return;

    // Re-derive blocks
    const blocks = [];
    let currentBlock = null;
    state.generatedPlan.forEach((week, index) => {
        const blockKey = week.blockNum || week.phaseName;
        if (!currentBlock || currentBlock.id !== blockKey) {
            currentBlock = { id: blockKey, name: week.phaseName, weeks: [] };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    const targetBlock = blocks[blockIndex];
    if (!targetBlock) return showToast("Block not found");

    showConfirm("Upload Block", `Upload all workouts for "${targetBlock.name}" to Intervals.icu?`, async () => {
        showToast(`🚀 Uploading ${targetBlock.weeks.length} weeks...`);

        try {
            // Collect all week indices
            const weekIndices = targetBlock.weeks.map(w => w.originalIndex);

            // Use new Bulk Upload function
            await pushWeeksToIntervalsBulk(weekIndices);

            showToast(`✅ Block "${targetBlock.name}" uploaded!`);
        } catch (e) {
            console.error("Block upload failed:", e);
            // Toast already shown by pushWeeksToIntervalsBulk
        }
    });
}

async function deleteFutureWorkouts(blockIndex) {
    if (!state.generatedPlan) return;

    // Re-derive blocks
    const blocks = [];
    let currentBlock = null;
    state.generatedPlan.forEach((week, index) => {
        const blockKey = week.blockNum || week.phaseName;
        if (!currentBlock || currentBlock.id !== blockKey) {
            currentBlock = { id: blockKey, name: week.phaseName, weeks: [] };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    const targetBlock = blocks[blockIndex];
    if (!targetBlock) return showToast("Block not found");

    showConfirm("Clear Block", `Delete ALL workouts for "${targetBlock.name}"? \n\nThis will remove workouts from:\n1. The Local Plan\n2. Intervals.icu (Remote)\n\nThis cannot be undone.`, async () => {
        showToast(`🗑️ Clearing workouts for ${targetBlock.name}...`);

        for (const week of targetBlock.weeks) {
            try {
                // 1. Clear Remote (Intervals.icu)
                // We assume resetRemoteWeeklyWorkouts is available globally or we can replicate its logic
                if (typeof resetRemoteWeeklyWorkouts === 'function') {
                    await resetRemoteWeeklyWorkouts(week.originalIndex, true); // true = skip confirm
                }

                // 2. Clear Local
                if (typeof resetWeeklyWorkouts === 'function') {
                    resetWeeklyWorkouts(week.originalIndex, true); // true = skip confirm
                }
            } catch (e) {
                console.error(`Error clearing week ${week.week}:`, e);
            }
        }

        showToast(`✅ Block "${targetBlock.name}" cleared!`);
    });
}



/**
 * Resets/Clears workouts for a specific week
 */
function resetWeeklyWorkouts(weekIndex, skipConfirm = false) {
    const doReset = () => {
        if (state.generatedWorkouts && state.generatedWorkouts[weekIndex]) {
            delete state.generatedWorkouts[weekIndex];

            // Re-render the week's workout section
            const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;
            renderAIWorkouts(weekIndex, [], availability);

            showToast("Week cleared");
        }
    };

    if (skipConfirm) {
        doReset();
    } else {
        showConfirm("Reset Week", "Are you sure you want to clear the workouts for this week?", doReset);
    }
}

// Expose globally
window.resetWeeklyWorkouts = resetWeeklyWorkouts;
