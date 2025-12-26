// --- WEEKLY RUN DISTRIBUTION ---

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

            // Prepare Long Run Badge HTML
            let longRunBadge = '';
            if (isLongRun) {
                longRunBadge = `
    \u003cdiv class="absolute inset-0 flex items-center justify-center"\u003e
        \u003cdiv class="px-2 py-0.5 bg-orange-500 text-white rounded cursor-move font-bold text-xs shadow-lg"
            draggable="true"
            ondragstart="event.dataTransfer.effectAllowed='move'; event.stopPropagation();"\u003e
            Long
        \u003c/div\u003e
    \u003c/div\u003e`;
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
            <span class="text-sm text-slate-300">${dayName}</span>
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
        html += `<button onclick="prepareWeekPlanWithAI(${weekIndex}); event.stopPropagation();"
class="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2 px-3 rounded transition-colors">
                    🤖 Prepare Week Plan with AI(Please be patient!)
                 </button>`;
        html += `<div class="grid grid-cols-2 gap-2">
                    <button onclick="pushToIntervalsICU(${weekIndex}); event.stopPropagation();" 
                            id="push-btn-${weekIndex}"
                            class="bg-green-600 hover:bg-green-500 text-white text-xs font-semibold py-2 px-3 rounded transition-colors">
                        📤 Push to Intervals.icu
                    </button>
                    <button onclick="resetWeeklyWorkouts(${weekIndex}); event.stopPropagation();" 
                            class="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold py-2 px-3 rounded transition-colors">
                        🗑️ Reset Workouts
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
    } catch (e) {
        console.error("Error in toggleWeekDetail:", e);
        showToast(`❌ Error opening week: ${e.message} `);
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
 * Determines the "Smart Name" for a week based on the Technical Approach
 * @param {number} position - Current week number in the block (1-based)
 * @param {number} length - Total weeks in this block
 * @param {string} type - 'Build', 'Taper', or 'Race'
 */
function getSmartPhaseName(position, length, type) {
    if (type === 'Race') return 'Race Week';
    if (type === 'Taper') return `Taper Phase ${position}`;

    // Recovery / Adaptation is always the last week of a Build block
    if (position === length) return 'Adaptation (Recovery)';

    // Logic for Naming based on Block Length
    if (length === 2) {
        // Compressed Block
        const names = ['Accumulation', 'Adaptation']; // Note: Logic handles last week above, but safe fallback
        return names[position - 1] || 'Build';
    }
    else if (length === 3) {
        // Short Block
        const names = ['Accumulation', 'Overreach'];
        return names[position - 1] || 'Build';
    }
    else if (length === 4) {
        // Standard Block
        const names = ['Acclimation', 'Accumulation', 'Overreach'];
        return names[position - 1] || 'Build';
    }
    else if (length >= 5) {
        // Extended Block
        const names = ['Acclimation', 'Accumulation', 'Progression', 'Overreach'];
        // Handle cases where block is massive (repeat Progression)
        if (position > 4) return 'Overreach';
        return names[position - 1] || 'Build';
    }

    return 'Build';
}

/**
 * Prepares weekly workout plan using AI
 */
async function prepareWeekPlanWithAI(weekIndex) {
    showToast("Preparing AI workout plan...");

    const week = state.generatedPlan[weekIndex];
    if (!week) {
        showToast("Error: Week not found");
        return;
    }

    // Get last 4 weeks of activity summary
    const last4WeeksSummary = getLast4WeeksSummary();

    // Get current week's parameters
    const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;
    const distribution = calculateRunDistribution(weekIndex);

    // Get day names for readability
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const availableDays = availability.map(d => dayNames[d]).join(', ');

    // Calculate Plan Context
    const totalWeeks = state.generatedPlan.length;
    const weeksToGoal = totalWeeks - week.week;

    // Use actual block information from the week object
    const blockPosition = week.positionInBlock || 1;
    const blockLength = week.blockLength || 1;
    const blockType = week.blockType || 'Build';

    // Calculate the Smart Phase Name
    const smartPhaseName = getSmartPhaseName(blockPosition, blockLength, blockType);

    // --- FIX START: Logic to determine block string without redeclaring variable ---
    let blockPositionStr = `${blockPosition}/${blockLength} - ${smartPhaseName}`;

    if (blockType === 'Race') {
        blockPositionStr = 'Race Week';
    } else if (blockType === 'Taper') {
        blockPositionStr = 'Taper Week';
    } else if (blockLength > 1) {
        // Build block with multiple weeks
        if (blockPosition === blockLength) {
            blockPositionStr = `${blockPosition}/${blockLength} (Recovery Week)`;
        } else {
            blockPositionStr = `${blockPosition}/${blockLength} (Build Week)`;
        }
    }
    // --- FIX END ---

    // Build the AI prompt
    const prompt = buildAIWorkoutPrompt({
        weekNumber: week.week,
        totalWeeks: totalWeeks,
        weeksToGoal: weeksToGoal,
        blockPosition: blockPositionStr,
        phase: week.phase,
        focus: week.focus,
        totalVolume: week.rawKm,
        longRunDistance: parseInt(week.longRun) || 0,
        longRunDay: dayNames[state.longRunDay],
        availableDays: availableDays,
        availableDaysCount: availability.length,
        distribution: distribution,
        last4Weeks: last4WeeksSummary,
        zones: getZonePaceStrings(),
        isRaceWeek: week.isRaceWeek
    });

    console.log("AI Prompt:", prompt);

    // Show prompt in debug tool
    const dbgPrompt = document.getElementById('dbg-ai-prompt');
    if (dbgPrompt) dbgPrompt.innerText = prompt;

    // Determine Provider
    const provider = state.aiProvider || 'openai';

    if (provider === 'openai') {
        if (!state.aiApiKey) {
            showToast("❌ Error: OpenAI API Key is missing. Please add it in Settings.");
            return;
        }
        await callOpenAI(prompt, weekIndex, availability);
    } else if (provider === 'gemini') {
        if (!state.geminiApiKey) {
            showToast("❌ Error: Gemini API Key is missing. Please add it in Settings.");
            return;
        }
        await callGeminiAPI(prompt, weekIndex, availability);
    }
}

function processAIResponse(content, weekIndex, availability) {
    let workoutsData;
    try {
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        workoutsData = JSON.parse(cleanContent);
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw Content:", content);
        showToast("❌ Failed to parse AI response.");
        return;
    }

    if (!workoutsData.workouts || !Array.isArray(workoutsData.workouts)) {
        showToast("❌ Invalid response format from AI.");
        return;
    }

    renderAIWorkouts(weekIndex, workoutsData.workouts, availability);
    showToast("✅ AI Workout Plan Generated!");
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
        // AI might return "Monday", "Mon", or day number. We try to match flexible.
        const workout = workouts.find(w => {
            if (typeof w.day === 'string') {
                return w.day.toLowerCase().includes(dayName.toLowerCase());
            }
            return w.day === dayNum;
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
 * Gets summary of last 4 weeks from activities
 */
function getLast4WeeksSummary() {
    if (!state.activities || state.activities.length === 0) {
        return "No recent activity data available.";
    }

    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);

    // Group activities by week
    const weeklyData = {};
    state.activities.forEach(act => {
        if (act.type === 'Run') {
            const actDate = new Date(act.start_date_local);
            if (actDate >= fourWeeksAgo && actDate <= now) {
                const weekKey = getWeekKey(actDate);
                if (!weeklyData[weekKey]) {
                    weeklyData[weekKey] = { totalKm: 0, runs: [] };
                }
                const km = (act.distance || 0) / 1000;
                weeklyData[weekKey].totalKm += km;
                weeklyData[weekKey].runs.push({ day: actDate.getDay(), km: km.toFixed(1) });
            }
        }
    });

    let summary = "Last 4 weeks activity:\n";
    Object.keys(weeklyData).sort().forEach(week => {
        const data = weeklyData[week];
        summary += `Week ${week}: ${data.totalKm.toFixed(1)}km over ${data.runs.length} runs\n`;
    });

    return summary;
}

/**
 * Helper to get week key for grouping
 */
function getWeekKey(date) {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay()); // Start of week (Sunday)
    return `${start.getMonth() + 1}/${start.getDate()}`;
}

/**
 * Gets zone pace strings for AI context
 */
/**
 * Gets zone pace and HR strings for AI context
 */
function getZonePaceStrings() {
    if (!state.fetchedZones) return "Zones not available";

    let table = "| Zone | Pace (min/km) | HR (bpm) |\n|---|---|---|\n";

    const paceZones = state.fetchedZones.pace || [];
    const hrZones = state.fetchedZones.hr || [];
    const maxRows = Math.max(paceZones.length, hrZones.length);

    // Helper to format seconds to MM:SS
    const fmt = (sec) => {
        if (!sec || sec === 99999 || sec === 0) return "--";
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Helper to format pace range
    const formatPace = (val) => {
        if (typeof val === 'object' && val.min) val = val.min; // Handle object format
        if (val === 0 || val > 900) return "--";
        if (val < 25) return fmt(1000 / val); // Convert m/s to min/km
        return fmt(val); // Already seconds
    };

    for (let i = 0; i < maxRows; i++) {
        const zName = `Z${i + 1}`;

        // Format Pace
        let paceStr = "--";
        if (paceZones[i]) {
            if (typeof paceZones[i] === 'object' && paceZones[i].min !== undefined) {
                // Intervals.icu sometimes returns {min: X, max: Y}
                paceStr = `${formatPace(paceZones[i].max)} - ${formatPace(paceZones[i].min)}`;
            } else {
                // Fallback if it's just a number (boundary)
                paceStr = formatPace(paceZones[i]);
            }
        }
        // Use the pre-calculated strings from state.zones if available for cleaner format
        if (state.zones && state.zones[`z${i + 1}`]) {
            paceStr = state.zones[`z${i + 1}`];
        }

        // Format HR
        let hrStr = "--";
        if (hrZones[i]) {
            hrStr = `${hrZones[i].min} - ${hrZones[i].max}`;
        }

        table += `| ${zName} | ${paceStr} | ${hrStr} |\n`;
    }

    return table;
}

/**
 * Builds the AI prompt with all context
 */
function buildAIWorkoutPrompt(params) {
    // Add Race Week Context
    let raceContext = "";
    if (params.isRaceWeek) {
        raceContext = `
IMPORTANT: This is RACE WEEK!
- You MUST schedule the "Race Event" on Sunday (or the specific race day if known).
- The Race Event should have type "Race" and description "Goal Time: ${state.goalTime || 'Finish'}".
- The rest of the week should be a sharp taper.
`;
    }

    // Get Zone Strings
    const zoneStr = getZonePaceStrings();

    // Get History String (if available in params, else use state)
    const historyStr = params.last4Weeks || state.trainingHistory || "No recent history";

    // Determine Long Run Day Name
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const longRunDayName = days[state.longRunDay];

    return `
ROLE: You are an elite endurance coach creating a specific workout plan for Week ${params.weekNumber} of a ${params.totalWeeks}-week block.
CONTEXT:
- Athlete Name: ${state.athleteName || 'Athlete'}
- Goal: Marathon in ${state.goalTime} on ${state.raceDate}
- Current Phase: ${params.phase}
- Week Focus: ${params.focus}
- Block Position: ${params.blockPosition}
- Weeks to Goal: ${params.weeksToGoal}

ATHLETE PROFILE:
- Training History: ${state.trainingHistory || 'Not specified'}
- Injuries/Limitations: ${state.injuries || 'None'}
- Gym Access: ${state.gymAccess || 'None'}
- Training Preferences: ${state.trainingPreferences || 'None'}

TRAINING HISTORY (Last 4 Weeks):
${historyStr}

TRAINING ZONES:
${zoneStr}

INSTRUCTIONS:
1. Create 7 days of workouts (Mon-Sun).
2. Respect the "Available Days" logic: 
   - Key workouts (Long Run, Intervals) MUST be on available days.
   - Rest/Recovery on unavailable days.
3. The Long Run is MANDATORY on ${longRunDayName} (${params.longRunDistance} km).
   - MAXIMUM LONG RUN: The long run distance is capped at 34km for safety.
   - ELITE PROGRESSION: If the long run is consistently at 34km (elite preparation), enhance quality by adding intervals/tempo segments within the long run instead of increasing distance.
4. Total Volume target: ~${params.totalVolume} km.
   - STRICT VOLUME RULE: You have ${params.totalVolume - params.longRunDistance} km remaining after the long run.
   - Divide this remaining volume across the other ${params.availableDaysCount - 1} available days.
   - TARGET DAILY AVERAGE: ${((params.totalVolume - params.longRunDistance) / (params.availableDaysCount - 1)).toFixed(1)} km/day.
   - CRITICAL: Do NOT schedule short runs (e.g. 5km) if the average needs to be higher. Match the target daily average closely.
   - Do NOT exceed the total weekly volume of ${params.totalVolume} km.
5. Progression: This is a "${params.blockPosition}" week.
   - If "Acclimation": Introduce new intensity, keep volume moderate.
   - If "Accumulation": Increase volume and load.
   - If "Overreach": This is the hardest week of the block. Push limits safely.
   - If "Adaptation": Reduce volume by ~30% for recovery.
   - If "Taper": Sharp reduction in volume, keep intensity high.
6. Race Event: If this is the final week, schedule the Race on Sunday with a taper leading up to it.
${raceContext}

IMPORTANT: WORKOUT DESCRIPTION FORMATTING
You MUST provide two description fields for each workout:
1. "description_ui": A short, human-readable summary (e.g., "VO2max intervals 4x4min Z5a").
2. "description_export": The specific Intervals.icu builder format.

Rules for "description_export":
- Sport Logic:
  - Running: Use % Pace (e.g., "75-85% Pace"). Do NOT use Zones (Z1, Z2).
  - Cycling: Use % FTP (e.g., "65-75% FTP").
- Duration Logic:
  - General: Prioritize Distance (km) for Warmups and Steady/Long runs.
  - Intervals: Use Time (m,s) for high-intensity intervals.
  - Cooldown: Can be Time or Distance.
- Intensity Ranges: Always use generous ranges (e.g., 65-75%) rather than exact numbers.
- "Press Lap" Feature:
  - Always add "Press lap" to the start of the Warmup step.
  - Add "Press lap" to recovery intervals where location management is needed.
- Structure & Formatting:
  - Headers: Use "Warmup", "Main Set", "Cooldown". Treat repetition blocks (e.g., "4x") as headers.
  - Separation: Always insert an empty line (\\n\\n) before a new Header or Repetition block.
  - Steps: Use "- " for steps. Do NOT use "- " before the "Nx" header.

OUTPUT FORMAT (JSON):
{
  "workouts": [
    {
      "day": "Monday",
      "type": "Run",
      "title": "Steady Run",
      "description_ui": "Steady Run 8km",
      "description_export": "Warmup\\n- Press lap 2km 65-75% Pace\\n\\nMain Set\\n- 6km 75-85% Pace\\n\\nCooldown\\n- 10m 60-70% Pace",
      "distance": 9.0,
      "duration": 50
    }
  ]
}
`;
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
            <!-- Removed suggested distance span -->
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
 * Pushes weekly workouts to Intervals.icu
 */
async function pushToIntervalsICU(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) {
        showToast("Error: Week not found");
        return;
    }

    // Get stored workouts for this week
    const workoutContainer = document.getElementById(`workout-summary-${weekIndex}`);
    if (!workoutContainer || workoutContainer.querySelector('.text-slate-500.italic')) {
        showToast("No workouts to push. Generate workouts first.");
        return;
    }


    // Disable button during push
    const pushBtn = document.getElementById(`push-btn-${weekIndex}`);
    if (pushBtn) {
        pushBtn.disabled = true;
        pushBtn.textContent = "Pushing...";
    }

    showToast("Pushing workouts to Intervals.icu...");

    try {
        // 1. Delete existing workouts for this week first (Overwrite behavior)
        await deleteWorkoutsForWeek(weekIndex);

        // Get the week's start date
        const weekStartDate = new Date(week.startDate);

        // Build events array for Intervals.icu
        const events = [];
        const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;
        const distribution = calculateRunDistribution(weekIndex);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Get workout data from the summary container
        const workoutDivs = workoutContainer.querySelectorAll('.p-2');

        // Sort availability to match UI order (Mon-Sun)
        // This is CRITICAL to ensure the correct description maps to the correct day
        const dayNumbers = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order
        const sortedAvailability = [...availability].sort((a, b) => {
            const aIndex = dayNumbers.indexOf(a);
            const bIndex = dayNumbers.indexOf(b);
            return aIndex - bIndex;
        });

        sortedAvailability.forEach((dayNum, idx) => {
            const dayName = dayNames[dayNum];
            const workoutDate = new Date(weekStartDate);
            // Calculate offset from Monday (Mon=1 -> 0, Sun=0 -> 6)
            const offset = (dayNum + 6) % 7;
            workoutDate.setDate(weekStartDate.getDate() + offset);

            // Format date for Intervals.icu (YYYY-MM-DD) using local time to prevent timezone shifts
            const year = workoutDate.getFullYear();
            const month = String(workoutDate.getMonth() + 1).padStart(2, '0');
            const day = String(workoutDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Get workout details from the displayed summary
            let workoutType = "Easy Run";
            let workoutDesc = "Easy aerobic run";

            if (idx < workoutDivs.length) {
                const div = workoutDivs[idx];
                const boldText = div.querySelector('.font-bold');
                if (boldText) {
                    const parts = boldText.textContent.split(':');
                    if (parts.length > 1) {
                        workoutType = parts[1].trim();
                    }
                }

                // Prefer raw description from data attribute
                if (div.dataset.description) {
                    workoutDesc = div.dataset.description;
                } else {
                    const descText = div.querySelector('.text-\\[10px\\]');
                    if (descText) {
                        workoutDesc = descText.textContent.trim();
                    }
                }
            }

            const isLongRun = dayNum === state.longRunDay;
            const distance = distribution[dayNum] ? distribution[dayNum].distance : 0;

            // Build workout description in Intervals.icu format
            let workoutDescription = '';

            // If we have a structured AI description (contains newlines), use it directly
            if (workoutDesc.includes('\n') || workoutDesc.includes('Warmup')) {
                workoutDescription = workoutDesc;
            } else if (isLongRun) {
                workoutDescription = `- ${distance.toFixed(1)}km easy pace\nLong run for the week.Build effort in final 20 %.`;
            } else if (workoutType.includes('Tempo')) {
                workoutDescription = `${workoutDesc} \nTotal: ${distance.toFixed(1)} km`;
            } else if (workoutType.includes('Intervals')) {
                workoutDescription = `${workoutDesc} \nTotal: ${distance.toFixed(1)} km`;
            } else {
                workoutDescription = `- ${distance.toFixed(1)}km easy\n${workoutDesc} `;
            }

            // Determine workout type
            let type = "Run";
            const lowerType = workoutType.toLowerCase();
            const lowerDesc = workoutDescription.toLowerCase();

            if (lowerType.includes('ride') || lowerType.includes('cycle') || lowerType.includes('bike')) {
                type = "Ride";
            } else if (lowerType.includes('strength') || lowerType.includes('weight') || lowerType.includes('gym') || lowerType.includes('core')) {
                type = "WeightTraining";
            } else if (lowerType.includes('swim') || lowerType.includes('pool')) {
                type = "Swim";
            } else if (lowerType.includes('yoga') || lowerType.includes('stretch')) {
                type = "Yoga";
            }

            events.push({
                category: "WORKOUT",
                type: type,  // Dynamic type
                start_date_local: `${dateStr}T00:00:00`,  // ISO 8601 format
                name: workoutType,
                description: workoutDescription,
                external_id: `elite_coach_w${week.week}_${dayName.toLowerCase()}`
            });
        });

        // POST to Intervals.icu API
        console.log("Pushing to Intervals.icu for Athlete ID:", state.athleteId);
        console.log("Payload:", JSON.stringify(events, null, 2));

        const response = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/bulk?upsert=true`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`API_KEY:${state.apiKey}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(events)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Intervals API Error Response:", errorText);
            throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log("Intervals API Success Response:", result);
        showToast(`✅ Successfully pushed ${events.length} workouts to Intervals.icu!`);

        // Re-enable button
        if (pushBtn) {
            pushBtn.disabled = false;
            pushBtn.textContent = "📤 Push to Intervals.icu";
        }

    } catch (error) {
        console.error("Error pushing to Intervals.icu:", error);
        showToast(`❌ Error pushing workouts: ${error.message}`);

        // Re-enable button
        if (pushBtn) {
            pushBtn.disabled = false;
            pushBtn.textContent = "📤 Push to Intervals.icu";
        }
    }
}

/**
 * Deletes workouts for the current week from Intervals.icu (keeps local plan)
 */
async function resetWeeklyWorkouts(weekIndex) {
    if (!confirm("⚠️ This will delete the workouts for THIS WEEK from your Intervals.icu calendar.\n\nYour local plan will remain visible.\n\nAre you sure?")) {
        return;
    }

    showToast("⏳ Deleting workouts from Intervals.icu...");

    try {
        const count = await deleteWorkoutsForWeek(weekIndex);

        if (count > 0) {
            showToast(`✅ Successfully deleted ${count} workouts from Intervals.icu.`);
        } else {
            showToast("ℹ️ No workouts found to delete for this week.");
        }

    } catch (error) {
        console.error("Error resetting workouts:", error);
        showToast(`❌ Error: ${error.message}`);
    }
}

/**
 * Helper: Deletes workouts for a specific week from Intervals.icu
 * Returns the number of deleted workouts.
 */
async function deleteWorkoutsForWeek(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return 0;

    const weekStartDate = new Date(week.startDate);
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 7);

    const startStr = weekStartDate.toISOString().split('T')[0];
    const endStr = weekEndDate.toISOString().split('T')[0];

    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        // 1. Fetch events for this week
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${startStr}&newest=${endStr}`, { headers });
        if (!res.ok) throw new Error("Failed to fetch events");

        const events = await res.json();

        // 2. Filter for app-generated events
        const eventsToDelete = events.filter(e => e.external_id && e.external_id.startsWith('elite_coach_'));

        if (eventsToDelete.length === 0) return 0;

        // 3. Delete each event
        let deletedCount = 0;
        for (const event of eventsToDelete) {
            const delRes = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/${event.id}`, {
                method: 'DELETE',
                headers: headers
            });
            if (delRes.ok) deletedCount++;
        }
        return deletedCount;

    } catch (error) {
        console.error("Error deleting workouts:", error);
        throw error;
    }
}
