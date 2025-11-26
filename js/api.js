// ==========================================
// API LOGIC: AI & EXTERNAL SERVICES
// ==========================================

/**
 * Prepares weekly workout plan using AI
 */
/**
 * Prepares weekly workout plan using AI
 */
async function prepareWeekPlanWithAI(weekIndex) {
    showAILoading("Generating Week Plan with AI...");

    const week = state.generatedPlan[weekIndex];
    if (!week) {
        showToast("Error: Week not found");
        return;
    }

    // 1. Gather Context
    const last4WeeksSummary = getLast4WeeksSummary();
    const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;

    // Ensure calculateRunDistribution exists (it is in weekly-ui.js)
    let distribution = {};
    if (typeof calculateRunDistribution === 'function') {
        distribution = calculateRunDistribution(weekIndex);
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const availableDays = availability.map(d => dayNames[d]).join(', ');

    const totalWeeks = state.generatedPlan.length;
    const weeksToGoal = totalWeeks - week.week;

    const blockPosition = week.positionInBlock || 1;
    const blockLength = week.blockLength || 1;
    const blockType = week.blockType || 'Build';

    // Calculate the Smart Phase Name (from Logic file)
    let smartPhaseName = "Build";
    if (typeof getWeekFocusName === 'function') {
        smartPhaseName = getWeekFocusName(blockPosition, blockLength, blockType);
    }

    // Block Context String
    let blockPositionStr = `${blockPosition}/${blockLength} - ${smartPhaseName}`;
    if (blockType === 'Race') {
        blockPositionStr = 'Race Week';
    } else if (blockType === 'Taper') {
        blockPositionStr = 'Taper Week';
    } else if (blockLength > 1) {
        if (blockPosition === blockLength) {
            blockPositionStr = `${blockPosition}/${blockLength} (Recovery Week)`;
        } else {
            blockPositionStr = `${blockPosition}/${blockLength} (Build Week)`;
        }
    }

    // Goal Assessment Context
    let goalAssessment = null;
    if (typeof assessMarathonGoal === 'function' && state.goalTime && state.raceDate) {
        goalAssessment = assessMarathonGoal(state.goalTime, state.raceDate);
    }

    // Progression Context
    const progressionRate = state.progressionRate || 0.10;
    let progressionContext = `Standard progression (${(progressionRate * 100).toFixed(1)}%)`;
    if (week.weekName === 'Recovery') {
        progressionContext = "Recovery Week (Reduced Volume)";
    } else if (week.weekName === 'Overreach') {
        progressionContext = "Overreach Week (Peak Volume before Recovery)";
    }

    // Volume Context
    const volumeContext = {
        currentWeekTarget: week.rawKm,
        lastWeekActual: state.lastWeekLongRun || 0, // Using lastWeekLongRun as proxy for now, ideally total volume
        suggested: (state.lastWeekLongRun || 0) * (1 + progressionRate)
    };

    // 2. Build Prompt
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
        isRaceWeek: week.isRaceWeek,
        goalAssessment: goalAssessment,
        progressionContext: progressionContext,
        volumeContext: volumeContext,
        athleteHistory: state.history || "Not provided",
        injuries: state.injuries || "None",
        preferences: state.preferences || "None",
        sportType: state.sportType || "Running",
        rampRate: state.rampRate || 5
    });

    console.log("AI Prompt:", prompt);

    // 3. Update Debug Box (FIXED)
    const dbgPrompt = document.getElementById('dbg-ai-prompt');
    if (dbgPrompt) dbgPrompt.innerText = prompt;

    // 4. Call Provider
    const provider = state.aiProvider || 'openai';
    if (provider === 'openai') {
        if (!state.aiApiKey) {
            hideAILoading();
            return showToast("❌ Error: OpenAI API Key is missing.");
        }
        await callOpenAI(prompt, weekIndex, availability);
    } else if (provider === 'gemini') {
        if (!state.geminiApiKey) {
            hideAILoading();
            return showToast("❌ Error: Gemini API Key is missing.");
        }
        await callGeminiAPI(prompt, weekIndex, availability);
    }
}

function buildAIWorkoutPrompt(params) {
    let raceContext = "";
    if (params.isRaceWeek) {
        raceContext = `IMPORTANT: This is RACE WEEK! Schedule Race on Sunday.`;
    }

    let goalContext = "";
    if (params.goalAssessment) {
        goalContext = `
GOAL ASSESSMENT:
- Difficulty: ${params.goalAssessment.difficulty}
- Min Days Required: ${params.goalAssessment.minDays}
- Warnings: ${params.goalAssessment.warnings.join('; ')}
`;
    }

    let sportInstructions = "";
    if (params.sportType === "Cycling") {
        sportInstructions = `
10. **CYCLING SPECIFIC**:
   - Intensity MUST be defined as percentage of FTP (e.g. "65-75% FTP").
   - Use "Power" instead of "Pace" for zones.
   - **TSS TARGET**: The goal for this week is approx ${params.totalVolume} TSS.
   - **RAMP RATE**: The progression is based on a ramp rate of ${params.rampRate} TSS/day (approx).
   - **STRUCTURE**: 
     - Low Intensity (Z1/Z2): 80% of sessions.
     - High Intensity (Z4/Z5): 20% of sessions.
     - Avoid "Grey Zone" (Z3) unless specific Sweet Spot work.
   - **WARMUP**: 10-15 mins @ 50-60% FTP.
`;
    } else {
        sportInstructions = `
10. **PRESS LAP LOGIC**:
   - The Warmup step MUST have "press_lap": true.
   - For intervals where the work duration is <= 60 seconds (or <= 400m), the RECOVERY step MUST have "recovery_press_lap": true.
11. **WARMUP REQUIREMENT**: All workouts MUST include a 10-minute (600 seconds) warmup at 60-70% LTHR Pace with press_lap enabled.
`;
    }

    return `
ROLE: You are an elite ${params.sportType === "Cycling" ? "cycling" : "running"} coach creating a specific workout plan for Week ${params.weekNumber} of a ${params.totalWeeks}-week block. You prescribe holistic training including ${params.sportType === "Cycling" ? "rides" : "running"}, strength, core, and cross-training.

ATHLETE PROFILE:
- History: ${params.athleteHistory}
- Injuries/Limitations: ${params.injuries}
- Preferences: ${params.preferences}

CONTEXT:
- Goal: ${params.sportType === "Cycling" ? "Cycling Event" : "Marathon"} in ${state.goalTime} on ${state.raceDate}
- Phase: ${params.phase} (${params.blockPosition})
- Focus: ${params.focus}
- Progression Logic: ${params.progressionContext}
${goalContext}

DATES FOR THIS WEEK (Week Starts ${params.weekStartDate}):
Please use these exact dates for "start_date_local":
- Monday: ${getDateForDay(params.weekStartDate, 1)}T06:00:00
- Tuesday: ${getDateForDay(params.weekStartDate, 2)}T06:00:00
- Wednesday: ${getDateForDay(params.weekStartDate, 3)}T06:00:00
- Thursday: ${getDateForDay(params.weekStartDate, 4)}T06:00:00
- Friday: ${getDateForDay(params.weekStartDate, 5)}T06:00:00
- Saturday: ${getDateForDay(params.weekStartDate, 6)}T06:00:00
- Sunday: ${getDateForDay(params.weekStartDate, 0)}T06:00:00

VOLUME TARGETS:
- Total Volume: ~${params.totalVolume} ${params.sportType === "Cycling" ? "TSS" : "km"}
- Long ${params.sportType === "Cycling" ? "Ride" : "Run"}: ${params.longRunDistance} ${params.sportType === "Cycling" ? "TSS (approx)" : "km"} on ${params.longRunDay} (MANDATORY)
- Remaining Volume: ${(params.totalVolume - params.longRunDistance).toFixed(1)} ${params.sportType === "Cycling" ? "TSS" : "km"} to be distributed across other days.

ATHLETE HISTORY (Last 4 Weeks):
${params.last4Weeks}

ZONES (${params.sportType === "Cycling" ? "Power & HR" : "Pace & HR"}):
${params.zones}

INSTRUCTIONS:
1. Create 7 days of workouts (Mon-Sun).
2. Key workouts (Long ${params.sportType === "Cycling" ? "Ride" : "Run"}, Intervals) MUST be on available days: ${params.availableDays}.
3. **PRIORITY**: If the user has specified fixed sessions (e.g. "Gym on Tuesday" in preferences), you MUST build the plan around this.
4. **MINIMUM DURATION**: All ${params.sportType === "Cycling" ? "RIDING" : "RUNNING"} sessions must be at least ${params.sportType === "Cycling" ? "45 mins" : "5km"}.
5. **NON-TRAINING DAYS**: On days without ${params.sportType === "Cycling" ? "riding" : "running"}, you MUST propose one of: Rest, Strength, Yoga, or Cross Training.
6. Balance remaining volume across other available days.
7. If the athlete has fewer available days than recommended, prioritize key sessions and combine easy volume if safe.
8. Respect the Phase Focus.
9. **STRUCTURED WORKOUTS**: You must provide a "steps" array for each workout.
   - Steps should have: 
     - "type" (Warmup, ${params.sportType === "Cycling" ? "Ride" : "Run"}, Cooldown, Rest)
     - "duration" (seconds) OR "distance" (meters)
     - "intensity" (MUST be defined as percentage of ${params.sportType === "Cycling" ? "FTP" : "Lactate Threshold Pace"})
     - "reps" (optional, for intervals)
     - "recovery_duration" (optional, seconds)
     - "recovery_intensity" (optional)
     - "press_lap" (boolean, optional)
     - "recovery_press_lap" (boolean, optional)

${sportInstructions}

${raceContext}

OUTPUT JSON ONLY:
{
  "workouts": [
    {
      "start_date_local": "2025-12-01T06:00:00",
      "type": "Intervals",
      "description_ui": "6x800m intervals",
      "steps": [
        { "type": "Warmup", "duration": 600, "intensity": "60-70% ${params.sportType === "Cycling" ? "FTP" : "Pace"}", "press_lap": true },
        { "type": "${params.sportType === "Cycling" ? "Ride" : "Run"}", "distance": 800, "intensity": "100-105% ${params.sportType === "Cycling" ? "FTP" : "Pace"}", "reps": 6, "recovery_duration": 90, "recovery_intensity": "50% ${params.sportType === "Cycling" ? "FTP" : "Pace"}", "recovery_press_lap": false },
        { "type": "Cooldown", "duration": 600, "intensity": "60-70% ${params.sportType === "Cycling" ? "FTP" : "Pace"}" }
      ]
    }
  ]
}
`;
}

// Helper to calculate date string for a specific day of the week
function getDateForDay(weekStartDateStr, targetDayNum) {
    // weekStartDateStr is YYYY-MM-DD (Monday)
    const [y, m, d] = weekStartDateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d); // Local date

    // Calculate offset
    // Monday is 1. If target is 1 (Mon), offset 0.
    // If target is 0 (Sun), offset 6.
    let offset = 0;
    if (targetDayNum === 0) offset = 6;
    else offset = targetDayNum - 1;

    date.setDate(date.getDate() + offset);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function callOpenAI(prompt, weekIndex, availability) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.aiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are an expert running coach. You output ONLY valid JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(60000) // 60s timeout
        });
        const data = await response.json();
        processAIResponse(data.choices[0].message.content, weekIndex, availability);
    } catch (error) {
        hideAILoading();
        showToast(`❌ OpenAI Error: ${error.message}`);
    }
}

async function callGeminiAPI(prompt, weekIndex, availability) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + "\n\nIMPORTANT: Output ONLY valid JSON." }] }]
            }),
            signal: AbortSignal.timeout(60000) // 60s timeout
        });
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            processAIResponse(data.candidates[0].content.parts[0].text, weekIndex, availability);
        } else {
            hideAILoading();
            throw new Error("No candidates returned from Gemini");
        }
    } catch (error) {
        hideAILoading();
        showToast(`❌ Gemini Error: ${error.message}`);
    }
}

function processAIResponse(content, weekIndex, availability) {
    try {
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        const workoutsData = JSON.parse(cleanContent);

        if (workoutsData.workouts) {
            // Save to state
            state.generatedWorkouts[weekIndex] = workoutsData.workouts;

            renderAIWorkouts(weekIndex, workoutsData.workouts, availability);
            hideAILoading();
            showToast("✅ AI Workout Plan Generated!");
        } else {
            throw new Error("Invalid JSON structure: missing 'workouts' key");
        }
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw Content:", content);
        hideAILoading();
        showToast("❌ Failed to parse AI response.");
    }
}

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
            // Always prioritize the long run structure
            const descUI = workout && workout.description_ui ? workout.description_ui : "Steady aerobic pace, build last 20%";
            html += `<div class="p-2 bg-orange-500/10 border border-orange-500/30 rounded">
                <div class="text-xs font-bold text-orange-400">${dayName}: Long Run</div>
                <div class="text-[10px] text-slate-400">${descUI}</div>
            </div>`;
        } else if (workout) {
            const descUI = workout.description_ui || workout.description;
            html += `<div class="p-2 bg-slate-700/30 rounded">
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
                // Simple week grouping key
                const weekKey = `${actDate.getFullYear()}-W${getWeekNumber(actDate)}`;
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
        summary += `${week}: ${data.totalKm.toFixed(1)}km over ${data.runs.length} runs\n`;
    });

    return summary;
}

// Helper for week number
function getWeekNumber(d) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
}

function getZonePaceStrings() {
    if (!state.lthrPace) return "Lactate Threshold Pace: Not synced (please sync with Intervals.icu)";

    let zStr = `Lactate Threshold Pace: ${state.lthrPace}\n`;
    if (state.lthrBpm) {
        zStr += `Lactate Threshold HR: ${state.lthrBpm} bpm\n`;
    }

    return zStr;
}

function formatStepsForIntervals(steps) {
    if (!steps || !Array.isArray(steps)) return "";

    let text = "";
    steps.forEach(step => {
        let line = "";

        // Header for step type if needed, but usually we just list steps
        // Intervals.icu format:
        // Warmup
        // - 10m Z1

        // Simplified single line format: "- 10m Z1"

        if (step.type === "Warmup") line += "Warmup\n";
        if (step.type === "Cooldown") line += "Cooldown\n";
        if (step.type === "Rest") line += "Rest\n";

        let dur = "";
        if (step.duration) {
            // Convert seconds to minutes/seconds
            const mins = Math.floor(step.duration / 60);
            const secs = step.duration % 60;
            if (mins > 0) dur += `${mins}m`;
            if (secs > 0) dur += `${secs}s`;
        } else if (step.distance) {
            // Always use km to avoid Intervals.icu interpreting meters as minutes
            dur += `${(step.distance / 1000).toFixed(2)}km`;
        }

        let intensity = step.intensity || "";

        // Handle Press Lap for main step - should go at the beginning
        let pressLap = step.press_lap ? "Press Lap " : "";

        if (step.reps) {
            line += `${step.reps}x\n`;
            line += `- ${pressLap}${dur} ${intensity}\n`;

            if (step.recovery_duration || step.recovery_distance) {
                let recDur = "";
                if (step.recovery_duration) {
                    const rMins = Math.floor(step.recovery_duration / 60);
                    const rSecs = step.recovery_duration % 60;
                    if (rMins > 0) recDur += `${rMins}m`;
                    if (rSecs > 0) recDur += `${rSecs}s`;
                } else if (step.recovery_distance) {
                    // Always use km to avoid Intervals.icu interpreting meters as minutes
                    recDur += `${(step.recovery_distance / 1000).toFixed(2)}km`;
                }
                // Use a broad range for recovery to allow for lactate flushing
                let recInt = step.recovery_intensity || "50-65% Pace";
                let recPressLap = step.recovery_press_lap ? "Press Lap " : "";
                line += `- ${recPressLap}${recDur} ${recInt}\n`;
            }
        } else {
            line += `- ${pressLap}${dur} ${intensity}\n`;
        }

        text += line + "\n";
    });
    return text.trim();
}

async function pushToIntervalsICU(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return showToast("Error: Week not found");

    const workouts = state.generatedWorkouts[weekIndex];
    if (!workouts || workouts.length === 0) {
        return showToast("No workouts generated yet.");
    }

    const pushBtn = document.getElementById(`push-btn-${weekIndex}`);
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }

    showToast("Pushing to Intervals.icu...");

    try {
        // Only delete from Intervals.icu, DO NOT clear local state
        await deleteRemoteWorkouts(weekIndex);

        const events = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;

        workouts.forEach(workout => {
            let dateStr = "";
            let dayName = "";

            if (workout.start_date_local) {
                // Use the explicit date provided by AI
                dateStr = workout.start_date_local.split('T')[0];
                const d = new Date(workout.start_date_local); // Use full datetime for correct day
                const dayNum = d.getDay();

                // Check availability
                if (!availability.includes(dayNum)) return;
                dayName = dayNames[dayNum];

            } else {
                return; // Skip if no start_date_local (legacy data not supported)
            }

            // Construct Description
            let desc = workout.description_export || workout.description_ui || "";

            // If we have structured steps, use them to build the Intervals.icu text
            if (workout.steps && Array.isArray(workout.steps)) {
                desc = formatStepsForIntervals(workout.steps);
            }

            events.push({
                category: "WORKOUT",
                start_date_local: `${dateStr}T06:00:00`,
                type: "Run",
                name: workout.type || "Run",
                description: desc,
                external_id: `elite_coach_w${week.week}_${dayName}`
            });
        });

        // Bulk create
        const response = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/bulk?upsert=true`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`API_KEY:${state.apiKey}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(events)
        });

        if (!response.ok) throw new Error("API Error");
        showToast(`✅ Pushed ${events.length} workouts!`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "📤 Push to Intervals.icu"; }
    }
}

async function resetWeeklyWorkouts(weekIndex) {
    if (!confirm("Delete workouts for this week from Intervals.icu?")) return;

    showToast("Deleting...");
    try {
        // Delete from both local state and remote
        delete state.generatedWorkouts[weekIndex];
        await deleteRemoteWorkouts(weekIndex);

        // Clear UI
        const container = document.getElementById(`workout-summary-${weekIndex}`);
        if (container) {
            container.innerHTML = '<div class="text-xs text-slate-500 italic">No workouts generated yet. Click "Prepare Week Plan" to generate AI-powered workouts.</div>';
        }
        showToast("✅ Workouts cleared.");
    } catch (e) {
        showToast(`❌ Error: ${e.message}`);
    }
}

async function deleteRemoteWorkouts(weekIndex) {
    // Only delete from Intervals.icu
    // delete state.generatedWorkouts[weekIndex]; // REMOVED: Do not clear state here

    const week = state.generatedPlan[weekIndex];
    if (!week) return;

    const start = new Date(week.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const sStr = start.toISOString().split('T')[0];
    const eStr = end.toISOString().split('T')[0];
    const auth = btoa("API_KEY:" + state.apiKey);

    const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${sStr}&newest=${eStr}`, {
        headers: { 'Authorization': `Basic ${auth}` }
    });

    const events = await res.json();
    const appEvents = events.filter(e => e.external_id && e.external_id.includes(`elite_coach_w${week.week}`));

    for (const e of appEvents) {
        await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/${e.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Basic ${auth}` }
        });
    }
}

// ==========================================
// BLOCK LEVEL FUNCTIONS
// ==========================================

/**
 * Prepares workout plan for an entire block
 */
async function prepareBlockPlanWithAI(blockNum, weekIndices) {
    showAILoading(`Generating Block ${blockNum} Plan with AI...`);

    // 1. Gather Context for ALL weeks
    const blockWeeks = weekIndices.map(idx => state.generatedPlan[idx]);
    const firstWeek = blockWeeks[0];

    if (!firstWeek) return showToast("Error: Block data not found");

    const last4WeeksSummary = getLast4WeeksSummary();
    const zones = getZonePaceStrings();
    const progressionRate = state.progressionRate || 0.10;

    // Goal Assessment
    let goalAssessment = null;
    if (typeof assessMarathonGoal === 'function' && state.goalTime && state.raceDate) {
        goalAssessment = assessMarathonGoal(state.goalTime, state.raceDate);
    }

    // Build context for each week
    const weeksContext = blockWeeks.map(week => {
        const availability = state.weeklyAvailability[week.week - 1] || state.defaultAvailableDays;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDays = availability.map(d => dayNames[d]).join(', ');

        let distribution = {};
        if (typeof calculateRunDistribution === 'function') {
            distribution = calculateRunDistribution(week.week - 1);
        }

        return {
            weekNumber: week.week,
            phase: week.phase,
            focus: week.focus,
            totalVolume: week.rawKm,
            longRunDistance: parseInt(week.longRun) || 0,
            longRunDay: dayNames[state.longRunDay],
            availableDays: availableDays,
            distribution: distribution,
            weekStartDate: week.startDate
        };
    });

    // 2. Build Block Prompt
    const prompt = `
ROLE: You are an elite endurance coach creating a PROGRESSIVE workout plan for a ${blockWeeks.length}-week training block (Block ${blockNum}). You prescribe holistic training including running, strength, core, and cross-training.

ATHLETE PROFILE:
- History: ${state.trainingHistory || "Not provided"}
- Injuries: ${state.injuries || "None"}
- Preferences: ${state.trainingPreferences || "None"}

GOAL: Marathon in ${state.goalTime} on ${state.raceDate}
PHASE: ${firstWeek.phaseName}
BLOCK FOCUS: Progressive overload across ${blockWeeks.length} weeks.

ZONES:
${zones}

LAST 4 WEEKS:
${last4WeeksSummary}

INSTRUCTIONS:
1. Create a cohesive plan for ALL ${blockWeeks.length} weeks.
2. Ensure PROGRESSIVE OVERLOAD.
3. CRITICAL: CHECK THE 'focus' FIELD FOR EACH WEEK.
4. Respect volume targets and long run distances.
5. Key workouts (Intervals/Tempo) should progress logically.
6. **PRIORITY**: If the user has specified fixed sessions (e.g. "Gym on Tuesday" in preferences), you MUST build the plan around this.
7. **MINIMUM DISTANCE**: All RUNNING sessions must be at least 5km. If a run would be shorter, increase it to 5km or change it to cross-training/rest.
8. **NON-RUNNING DAYS**: On days without running, you MUST propose one of: Rest, Strength, Bike, Pilates, or Cross Training. Do not leave days blank or just "Rest" unless appropriate for recovery.
9. **STRUCTURED WORKOUTS**: You must provide a "steps" array for each workout.
   - Steps should have: 
     - "type" (Warmup, Run, Cooldown, Rest)
     - "press_lap" (boolean, optional)
     - "duration" (m, s) OR "distance" (km)
     - "intensity" (MUST be defined as percentage of Lactate Threshold Pace, e.g. "85-90% Pace")
     - "reps" (optional, for intervals)
     - "recovery_duration" (optional, seconds)
     - "recovery_intensity" (optional, e.g. "50-60% Pace")
     - "recovery_press_lap" (boolean, optional)
10. **PRESS LAP LOGIC**:
   - The Warmup step MUST have "press_lap": true.
   - For intervals where the work duration is <= 60 seconds (or <= 400m), the RECOVERY step MUST have "recovery_press_lap": true.

11. **DATE HANDLING**:
   - You MUST use "start_date_local" for every workout.
   - Format: "YYYY-MM-DDTHH:MM:SS"
   - Time: Always use T06:00:00
   - Use the "weekStartDate" provided in the context to calculate the correct dates for each week.
   - Monday is the start date.

WEEKS TO PLAN:
${JSON.stringify(weeksContext, null, 2)}

OUTPUT JSON FORMAT ONLY:
{
  "weeks": [
    {
      "weekNumber": 1,
      "workouts": [
        { 
          "start_date_local": "2025-12-01T06:00:00",
          "type": "Run",
          "title": "Steady Run",
          "description_ui": "Steady Run 8km",
          "description_export": "Warmup\\n- Press lap 2km 65-75% Pace\\n\\nMain Set\\n- 6km 75-85% Pace\\n\\nCooldown\\n- 10m 60-70% Pace",
          "distance": 9.0,
          "duration": 50,
          "steps": [
            { "type": "Warmup", "duration": 600, "intensity": "60-70% Pace", "press_lap": true },
            { "type": "Run", "distance": 6000, "intensity": "75-85% Pace" },
            { "type": "Cooldown", "duration": 600, "intensity": "60-70% Pace" }
          ]
        }
    ]
    }
  ]
}
`;

    console.log("Block Prompt:", prompt);
    const dbgPrompt = document.getElementById('dbg-ai-prompt');
    if (dbgPrompt) dbgPrompt.innerText = prompt;

    // 3. Call AI
    const provider = state.aiProvider || 'openai';
    if (provider === 'openai') {
        if (!state.aiApiKey) return showToast("❌ Error: OpenAI API Key is missing.");
        await callOpenAIBlock(prompt, weekIndices);
    } else if (provider === 'gemini') {
        if (!state.geminiApiKey) return showToast("❌ Error: Gemini API Key is missing.");
        await callGeminiAPIBlock(prompt, weekIndices);
    }
}

async function callOpenAIBlock(prompt, weekIndices) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.aiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are an expert running coach. You output ONLY valid JSON." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            })
        });
        const data = await response.json();
        processAIBlockResponse(data.choices[0].message.content, weekIndices);
    } catch (error) {
        hideAILoading();
        showToast(`❌ OpenAI Error: ${error.message}`);
    }
}

async function callGeminiAPIBlock(prompt, weekIndices) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + "\n\nIMPORTANT: Output ONLY valid JSON." }] }]
            })
        });
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            processAIBlockResponse(data.candidates[0].content.parts[0].text, weekIndices);
        } else {
            hideAILoading();
            throw new Error("No candidates returned from Gemini");
        }
    } catch (error) {
        showToast(`❌ Gemini Error: ${error.message}`);
    }
}

function processAIBlockResponse(content, weekIndices) {
    try {
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        const data = JSON.parse(cleanContent);

        if (data.weeks && Array.isArray(data.weeks)) {
            data.weeks.forEach((weekData, idx) => {
                // Find the corresponding week index from our input list
                // We assume the AI returns weeks in order 1..N matching the input
                if (idx < weekIndices.length) {
                    const globalWeekIndex = weekIndices[idx];
                    const availability = state.weeklyAvailability[globalWeekIndex] || state.defaultAvailableDays;

                    // Save to state
                    state.generatedWorkouts[globalWeekIndex] = weekData.workouts;

                    // Render this week
                    renderAIWorkouts(globalWeekIndex, weekData.workouts, availability);
                }
            });
            hideAILoading();
            showToast("✅ Block Plan Generated Successfully!");
        } else {
            hideAILoading();
            throw new Error("Invalid JSON structure: missing 'weeks' array");
        }
    } catch (e) {
        console.error("JSON Parse Error:", e);
        hideAILoading();
        showToast("❌ Failed to parse AI response.");
    }
}

async function pushBlockToIntervalsICU(weekIndices) {
    if (!confirm(`Push all ${weekIndices.length} weeks to Intervals.icu? This will overwrite existing workouts.`)) return;

    showToast("Pushing block...");
    for (const idx of weekIndices) {
        await pushToIntervalsICU(idx);
        // Small delay to be nice to API
        await new Promise(r => setTimeout(r, 500));
    }
    showToast("✅ Block pushed!");
}

async function deleteBlockWorkouts(weekIndices) {
    if (!confirm(`Delete all workouts for these ${weekIndices.length} weeks?`)) return;

    showToast("Deleting block workouts...");
    for (const idx of weekIndices) {
        delete state.generatedWorkouts[idx];
        await deleteRemoteWorkouts(idx);

        // Clear UI
        const container = document.getElementById(`workout-summary-${idx}`);
        if (container) {
            container.innerHTML = '<div class="text-xs text-slate-500 italic">No workouts generated yet. Click "Prepare Week Plan" to generate AI-powered workouts.</div>';
        }
    }
    showToast("✅ Block workouts deleted.");
}

async function pushWeeklyTargetsToIntervals() {
    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        return showToast("No plan generated yet.");
    }

    if (!confirm("Push weekly targets to Intervals.icu? This will update your goals.")) return;

    const pushBtn = document.getElementById('push-targets-btn');
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }
    showToast("Pushing targets...");

    try {
        const events = [];
        const isCycling = state.sportType === 'Cycling';
        
        // Use Plan Start Date if available, otherwise fallback to today/calculated dates
        const planStartInput = document.getElementById('planStartDateInput');
        const planStartDate = planStartInput && planStartInput.value ? new Date(planStartInput.value) : new Date();

        state.generatedPlan.forEach(week => {
            // Calculate Monday of this week
            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + ((week.weekNumber - 1) * 7));
            
            // Adjust to Monday if planStartDate is not Monday? 
            // Actually, let's assume the plan logic aligns weeks correctly.
            // Intervals.icu targets usually start on Monday.
            // Let's ensure we are targeting the Monday of that week.
            const day = weekStart.getDay();
            const diff = weekStart.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(weekStart.setDate(diff));
            const dateStr = monday.toISOString().split('T')[0];

            const event = {
                category: "TARGET",
                start_date_local: dateStr,
                type: isCycling ? "Ride" : "Run",
            };

            if (isCycling) {
                // Push Load (TSS)
                event.load_target = Math.round(week.goalLoad);
                // event.time_target = Math.round(week.goalLoad * 3600 / 50); // Rough estimate if needed
            } else {
                // Push Distance (meters)
                event.distance_target = Math.round(week.goalLoad * 1000);
            }

            events.push(event);
        });

        // Bulk create
        const response = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/bulk?upsert=true`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`API_KEY:${state.apiKey}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(events)
        });

        if (!response.ok) throw new Error("API Error");
        showToast(`✅ Pushed ${events.length} weekly targets!`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "🎯 Push Weekly Targets"; }
    }
}

async function deleteFutureTargets() {
    if (!confirm("Delete ALL future targets from today onwards? This cannot be undone.")) return;

    const delBtn = document.getElementById('delete-targets-btn');
    if (delBtn) { delBtn.disabled = true; delBtn.textContent = "Deleting..."; }
    showToast("Deleting future targets...");

    try {
        const today = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const nextYearStr = nextYear.toISOString().split('T')[0];

        const auth = btoa(`API_KEY:${state.apiKey}`);
        
        // 1. Fetch Events
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${today}&newest=${nextYearStr}&category=TARGET`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        
        if (!res.ok) throw new Error("Failed to fetch targets");
        const events = await res.json();
        
        const targets = events.filter(e => e.category === 'TARGET');
        
        if (targets.length === 0) {
            showToast("No future targets found.");
            return;
        }

        // 2. Delete Each
        for (const t of targets) {
            await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/${t.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Basic ${auth}` }
            });
        }

        showToast(`✅ Deleted ${targets.length} targets.`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Delete Error: ${e.message}`);
    } finally {
        if (delBtn) { delBtn.disabled = false; delBtn.textContent = "🗑️ Delete Future Targets"; }
    }
}
