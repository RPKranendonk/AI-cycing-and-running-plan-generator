// ===================================================================
// WEEKLY UI MODULE
// Handles week detail view rendering and user interactions
// ===================================================================

/**
 * Expands or collapses the weekly detail view for a given week
 */
function toggleWeekDetail(weekIndex) {
    try {
        console.log(`toggleWeekDetail called with weekIndex: ${weekIndex}`);
        const detailId = `week-detail-${weekIndex}`;
        let detailDiv = document.getElementById(detailId);

        if (detailDiv) {
            // Already exists, toggle visibility
            console.log(`Detail div exists, toggling visibility. Current classes: ${detailDiv.className}`);
            if (detailDiv.classList.contains('hidden')) {
                detailDiv.classList.remove('hidden');
                calculateAndRenderDistribution(weekIndex);
            } else {
                detailDiv.classList.add('hidden');
            }
            return;
        }

        // Create the detail view
        console.log(`Creating detail view for week ${weekIndex}`);
        const weekCard = document.querySelector(`[data-week-index="${weekIndex}"]`);
        if (!weekCard) {
            console.error(`Week card not found for index ${weekIndex}`);
            showToast(`Error: Week card ${weekIndex} not found`);
            return;
        }

        detailDiv = document.createElement('div');
        detailDiv.id = detailId;
        detailDiv.className = 'mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700';

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

        // Calculate distribution to show km per day
        console.log("Calculating run distribution...");
        const distribution = calculateRunDistribution(weekIndex);
        console.log("Distribution calculated:", distribution);

        let html = '<div class="space-y-4">';

        // Grid container for side-by-side layout
        html += '<div class="grid grid-cols-1 lg:grid-cols-3 gap-4">';

        // LEFT SIDE: Weekly Schedule
        html += '<div>';
        html += '<h4 class="text-sm font-bold text-slate-300 mb-3">Weekly Schedule</h4>';
        html += '<div class="space-y-1">';

        // Create rows for each day
        dayNumbers.forEach(dayNum => {
            const dayName = dayNames[dayNum];
            const isChecked = availability.includes(dayNum);
            const isLongRun = dayNum === state.longRunDay;

            // Calculate Date for this day
            // Monday is 1. If target is 1 (Mon), offset 0.
            // If target is 0 (Sun), offset 6.
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
        <div class="px-2 py-0.5 bg-orange-500 text-white rounded cursor-move font-bold text-xs shadow-lg"
            draggable="true"
            ondragstart="event.dataTransfer.effectAllowed='move'; event.stopPropagation();">
            Long
        </div>
    </div>`;
            }

            const rowClass = isLongRun ? 'bg-orange-500/20 border border-orange-500/40' : 'bg-slate-700/30';
            const borderClass = isLongRun ? 'border-orange-500 bg-orange-500/10' : 'border-slate-600 hover:border-slate-500';

            html += `
    <div class="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center p-2 rounded ${rowClass}">
        <input type="checkbox"
            data-day="${dayNum}"
            ${isChecked ? 'checked' : ''}
            onchange="updateWeekAvailability(${weekIndex}, ${dayNum}, this.checked)"
            onclick="event.stopPropagation()"
            class="cursor-pointer">
            <span class="text-sm text-slate-300">${dayName} <span class="text-xs text-slate-500 ml-1">${dateStr}</span></span>
            <span class="text-sm font-mono text-slate-400"></span>
            <div class="relative w-20">
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
        html += '<div class="lg:col-span-2 p-4 bg-slate-900/50 rounded border border-blue-500/30 h-fit">';
        html += '<h4 class="text-sm font-bold text-blue-400 mb-3">📋 Weekly Workout Plan</h4>';

        // Workout summary area
        html += `<div id="workout-summary-${weekIndex}" class="mb-3 space-y-2 min-h-[120px] max-h-[300px] overflow-y-auto">`;
        html += '<div class="text-xs text-slate-500 italic">No workouts generated yet. Click "Prepare Week Plan" to generate AI-powered workouts.</div>';
        html += '</div>';

        // Action buttons
        html += '<div class="space-y-2">';
        html += '<div class="text-xs text-slate-500 mb-1">Week options: (we recommend building your plan per block and not per week!), </div>';
        html += `<div class="flex gap-2">
                    <button onclick="preparePlanWithAI('week', [${weekIndex}]); event.stopPropagation();" 
                        class="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold py-1.5 px-3 rounded border border-blue-500/30 transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-robot"></i> Prepare Week Plan
                    </button>
                    <button onclick="pushToIntervalsICU(${weekIndex}); event.stopPropagation();" 
                            id="push-btn-${weekIndex}"
                            class="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[10px] font-bold py-1.5 rounded border border-green-500/30 transition-colors">
                        Upload week
                    </button>
                    <button onclick="resetWeeklyWorkouts(${weekIndex}); event.stopPropagation();" 
                            class="flex-1 bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-bold py-1.5 rounded border border-red-500/30 transition-colors">
                        Reset week
                    </button>
                 </div>`;
        html += '</div>';
        html += '</div>'; // End right side

        html += '</div>'; // End grid
        html += '</div>'; // End container

        detailDiv.innerHTML = html;
        weekCard.appendChild(detailDiv);
        console.log(`Detail view appended for week ${weekIndex}`);

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

            html += `<div class="p-2 bg-orange-500/10 border border-orange-500/30 rounded" data-description="${descExport.replace(/"/g, '&quot;')}">
                <div class="text-xs font-bold text-orange-400">${dayName}: Long Run</div>
                <div class="text-[10px] text-slate-400">${descUI}</div>
            </div>`;
        } else if (workout) {
            // Handle both new format (ui/export) and legacy format (description)
            const descUI = workout.description_ui || workout.description;
            const descExport = workout.description_export || workout.description;

            html += `<div class="p-2 bg-slate-700/30 rounded" data-description="${descExport.replace(/"/g, '&quot;')}">
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
