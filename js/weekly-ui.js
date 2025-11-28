// ===================================================================
// WEEKLY UI MODULE
// Handles week detail view rendering and user interactions
// ===================================================================

/**
 * Expands or collapses the weekly detail view for a given week
 */
function toggleWeekDetail(weekIndex, element) {
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

        // Robust strategy to find the week card
        let weekCard = null;

        // Strategy 1: Use passed element
        if (element) {
            weekCard = element.closest('[data-week-index]');
            if (weekCard) console.log("Found week card via element.closest");
        }

        // Strategy 2: Use specific selector
        if (!weekCard) {
            weekCard = document.querySelector(`[data-week-index="${weekIndex}"]`);
            if (weekCard) console.log("Found week card via querySelector");
        }

        // Strategy 3: Search within plan container (fallback)
        if (!weekCard) {
            const container = document.getElementById('planContainer');
            if (container) {
                const cards = container.querySelectorAll('[data-week-index]');
                for (let card of cards) {
                    if (parseInt(card.dataset.weekIndex) === weekIndex) {
                        weekCard = card;
                        console.log("Found week card via manual search in container");
                        break;
                    }
                }
            }
        }

        if (!weekCard) {
            console.error(`Week card not found for index ${weekIndex}`);
            showToast(`Error: Week card ${weekIndex} not found. Please regenerate plan.`);
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
                    <button type="button" onclick="preparePlanWithAI('week', [${weekIndex}]); event.stopPropagation();" 
                        class="bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-xs font-bold py-1.5 px-3 rounded border border-blue-500/30 transition-colors flex items-center gap-2">
                        <i class="fa-solid fa-robot"></i> Prepare Week Plan
                    </button>
                    <button type="button" onclick="pushToIntervalsICU(${weekIndex}); event.stopPropagation();" 
                            id="push-btn-${weekIndex}"
                            class="flex-1 bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[10px] font-bold py-1.5 rounded border border-green-500/30 transition-colors">
                        Upload week
                    </button>
                    <button type="button" onclick="resetWeeklyWorkouts(${weekIndex}); event.stopPropagation();" 
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

/**
 * Renders the weekly plan to the UI, grouped by blocks
 */
function renderWeeklyPlan() {
    const container = document.getElementById('planContainer');
    if (!container) return;

    container.innerHTML = '';

    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        container.innerHTML = '<div class="text-center text-slate-500 p-8">No plan generated yet. Configure your settings to get started.</div>';
        return;
    }

    const isCycling = state.sportType === 'Cycling';
    const volLabel = isCycling ? 'Load' : 'Volume';
    const volUnit = isCycling ? 'TSS' : 'km';
    const lrLabel = isCycling ? 'Long Ride' : 'Long Run';
    const lrUnit = isCycling ? 'h' : 'km';

    // 1. Group weeks into blocks
    const blocks = [];
    let currentBlock = null;

    state.generatedPlan.forEach((week, index) => {
        // Group by Block Number (calculated in planning logic)
        // This ensures that "Base Phase" block 1 and "Base Phase" block 2 are separate.
        const blockKey = week.blockNum || week.phaseName;

        if (!currentBlock || currentBlock.id !== blockKey) {
            currentBlock = {
                id: blockKey,
                name: week.phaseName, // Use the phase name of the first week
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
        blockDiv.className = 'mb-4 bg-slate-900/30 rounded-xl border border-slate-800 overflow-hidden';

        // Block Header (Click to toggle)
        const header = document.createElement('div');
        header.className = 'p-3 bg-slate-800/80 flex items-center justify-between cursor-pointer hover:bg-slate-800 transition-colors';
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

        // Determine Block Color based on name
        let blockColorClass = 'text-slate-300';
        if (block.name.includes('Base')) blockColorClass = 'text-blue-400';
        if (block.name.includes('Build')) blockColorClass = 'text-green-400';
        if (block.name.includes('Peak')) blockColorClass = 'text-purple-400';
        if (block.name.includes('Taper')) blockColorClass = 'text-yellow-400';
        if (block.name.includes('Race')) blockColorClass = 'text-red-400';
        if (block.name.includes('Recovery')) blockColorClass = 'text-teal-400';

        // Calculate Block Totals
        const totalVol = block.weeks.reduce((sum, w) => sum + (parseFloat(w.mileage) || 0), 0);
        const duration = block.weeks.length;

        header.innerHTML = `
            <div class="flex items-center gap-3">
                <i class="fa-solid fa-chevron-down transition-transform duration-300 rotate-180 text-slate-500" id="icon-${blockId}"></i>
                <div>
                    <h3 class="font-bold ${blockColorClass} text-sm">${block.name}</h3>
                    <div class="text-[10px] text-slate-500">${duration} Weeks • Total ${Math.round(totalVol)} ${volUnit}</div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <button onclick="event.stopPropagation(); prepareBlockWorkouts(${blockIndex})" 
                    class="text-[10px] bg-slate-700 hover:bg-blue-600 text-white px-2 py-1 rounded transition-colors border border-slate-600">
                    <i class="fa-solid fa-wand-magic-sparkles mr-1"></i> Prepare Block
                </button>
                <button onclick="event.stopPropagation(); pushBlockWorkouts(${blockIndex})" 
                    class="text-[10px] bg-slate-700 hover:bg-green-600 text-white px-2 py-1 rounded transition-colors border border-slate-600">
                    <i class="fa-solid fa-cloud-arrow-up mr-1"></i> Push Block
                </button>
                <button onclick="event.stopPropagation(); deleteFutureWorkouts(${blockIndex})" 
                    class="text-[10px] bg-slate-700 hover:bg-red-600 text-white px-2 py-1 rounded transition-colors border border-slate-600">
                    <i class="fa-solid fa-trash mr-1"></i> Clear Future
                </button>
                <div class="text-[10px] font-mono text-slate-500">
                    ${block.weeks[0].date} - ${block.weeks[block.weeks.length - 1].date}
                </div>
            </div>
        `;

        // Block Content (Weeks)
        const content = document.createElement('div');
        content.id = `content-${blockId}`;
        content.className = 'p-2 space-y-2'; // Default Open

        block.weeks.forEach(week => {
            const index = week.originalIndex;
            const weekCard = document.createElement('div');
            weekCard.className = 'bg-slate-800/50 rounded-lg border border-slate-700/50 p-3 transition-all hover:border-slate-600';
            weekCard.dataset.weekIndex = index;

            // Determine Phase Color (for inner badge)
            let phaseColor = 'text-slate-400';
            let phaseBg = 'bg-slate-700/50';
            let phaseBorder = 'border-slate-600';

            if (week.phaseName.includes('Base')) { phaseColor = 'text-blue-400'; phaseBg = 'bg-blue-900/20'; phaseBorder = 'border-blue-500/30'; }
            else if (week.phaseName.includes('Build')) { phaseColor = 'text-green-400'; phaseBg = 'bg-green-900/20'; phaseBorder = 'border-green-500/30'; }
            else if (week.phaseName.includes('Peak')) { phaseColor = 'text-purple-400'; phaseBg = 'bg-purple-900/20'; phaseBorder = 'border-purple-500/30'; }
            else if (week.phaseName.includes('Taper')) { phaseColor = 'text-yellow-400'; phaseBg = 'bg-yellow-900/20'; phaseBorder = 'border-yellow-500/30'; }
            else if (week.phaseName.includes('Race')) { phaseColor = 'text-red-400'; phaseBg = 'bg-red-900/20'; phaseBorder = 'border-red-500/30'; }
            else if (week.weekName.includes('Recovery')) { phaseColor = 'text-teal-400'; phaseBg = 'bg-teal-900/20'; phaseBorder = 'border-teal-500/30'; }

            const headerHtml = `
                <div class="flex items-center justify-between cursor-pointer" onclick="toggleWeekDetail(${index}, this)">
                    <div class="flex items-center gap-3">
                        <div class="flex flex-col items-center justify-center w-10 h-10 rounded-lg ${phaseBg} ${phaseBorder} border">
                            <span class="text-[9px] text-slate-400 uppercase">W</span>
                            <span class="text-sm font-bold ${phaseColor}">${week.week}</span>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="text-xs font-bold text-slate-300">${week.weekName}</span>
                                <span class="text-[9px] px-1.5 py-0.5 rounded-full ${phaseBg} ${phaseColor} border ${phaseBorder}">${week.focus}</span>
                            </div>
                            <div class="text-[10px] text-slate-500 mt-0.5 flex items-center gap-2">
                                <span><i class="fa-regular fa-calendar mr-1"></i> ${week.date}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex items-center gap-4">
                        <div class="text-right">
                            <div class="text-[9px] text-slate-500 uppercase tracking-wider">${volLabel}</div>
                            <div class="font-mono font-bold text-sm text-slate-200">${week.mileage} <span class="text-[9px] text-slate-500">${volUnit}</span></div>
                        </div>
                        <div class="text-right hidden sm:block">
                            <div class="text-[9px] text-slate-500 uppercase tracking-wider">${lrLabel}</div>
                            <div class="font-mono font-bold text-sm text-slate-200">${week.longRun} <span class="text-[9px] text-slate-500">${lrUnit}</span></div>
                        </div>
                        <div class="w-6 h-6 flex items-center justify-center rounded-full bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
                            <i class="fa-solid fa-chevron-down transition-transform duration-300 text-xs" id="chevron-${index}"></i>
                        </div>
                    </div>
                </div>
                
                <!-- Week Detail (Hidden) -->

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
        let blockName = week.phaseName;
        if (!currentBlock || currentBlock.name !== blockName) {
            currentBlock = { name: blockName, weeks: [] };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    const targetBlock = blocks[blockIndex];
    if (!targetBlock) return showToast("Block not found");

    if (!confirm(`Prepare detailed workouts for all ${targetBlock.weeks.length} weeks in "${targetBlock.name}"? This may take a minute.`)) return;

    showToast(`🪄 Preparing ${targetBlock.weeks.length} weeks for ${targetBlock.name}...`);

    showToast(`🪄 Preparing ${targetBlock.weeks.length} weeks for ${targetBlock.name}...`);

    try {
        // Collect all week indices
        const weekIndices = targetBlock.weeks.map(w => w.originalIndex);

        // Call AI once for the whole block
        await preparePlanWithAI('block', weekIndices);

    } catch (e) {
        console.error(`Error preparing block ${targetBlock.name}:`, e);
        showToast(`❌ Error preparing block`);
    }

    showToast(`✅ Block "${targetBlock.name}" ready!`);
}

async function pushBlockWorkouts(blockIndex) {
    if (!state.generatedPlan) return;

    // Re-derive blocks
    const blocks = [];
    let currentBlock = null;
    state.generatedPlan.forEach((week, index) => {
        let blockName = week.phaseName;
        if (!currentBlock || currentBlock.name !== blockName) {
            currentBlock = { name: blockName, weeks: [] };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    const targetBlock = blocks[blockIndex];
    if (!targetBlock) return showToast("Block not found");

    if (!confirm(`Upload all workouts for "${targetBlock.name}" to Intervals.icu?`)) return;

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
}

async function deleteFutureWorkouts(blockIndex) {
    if (!state.generatedPlan) return;

    // Re-derive blocks
    const blocks = [];
    let currentBlock = null;
    state.generatedPlan.forEach((week, index) => {
        let blockName = week.phaseName;
        if (!currentBlock || currentBlock.name !== blockName) {
            currentBlock = { name: blockName, weeks: [] };
            blocks.push(currentBlock);
        }
        currentBlock.weeks.push({ ...week, originalIndex: index });
    });

    const targetBlock = blocks[blockIndex];
    if (!targetBlock) return showToast("Block not found");

    if (!confirm(`Delete all future workouts for "${targetBlock.name}"? This cannot be undone.`)) return;

    showToast(`🗑️ Clearing workouts for ${targetBlock.name}...`);

    for (const week of targetBlock.weeks) {
        try {
            // Assuming resetWeeklyWorkouts exists and clears the week
            if (typeof resetWeeklyWorkouts === 'function') {
                resetWeeklyWorkouts(week.originalIndex);
            }
        } catch (e) {
            console.error(`Error clearing week ${week.week}:`, e);
        }
    }

    showToast(`✅ Block "${targetBlock.name}" cleared!`);
}


