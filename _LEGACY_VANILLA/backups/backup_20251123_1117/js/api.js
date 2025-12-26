// ==========================================
// API LOGIC: AI & EXTERNAL SERVICES
// ==========================================

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
        isRaceWeek: week.isRaceWeek
    });

    console.log("AI Prompt:", prompt);

    // 3. Update Debug Box (FIXED)
    const dbgPrompt = document.getElementById('dbg-ai-prompt');
    if (dbgPrompt) dbgPrompt.innerText = prompt;

    // 4. Call Provider
    const provider = state.aiProvider || 'openai';
    if (provider === 'openai') {
        if (!state.aiApiKey) return showToast("❌ Error: OpenAI API Key is missing.");
        await callOpenAI(prompt, weekIndex, availability);
    } else if (provider === 'gemini') {
        if (!state.geminiApiKey) return showToast("❌ Error: Gemini API Key is missing.");
        await callGeminiAPI(prompt, weekIndex, availability);
    }
}

function buildAIWorkoutPrompt(params) {
    let raceContext = "";
    if (params.isRaceWeek) {
        raceContext = `IMPORTANT: This is RACE WEEK! Schedule Race on Sunday.`;
    }

    return `
ROLE: You are an elite endurance coach creating a specific workout plan for Week ${params.weekNumber} of a ${params.totalWeeks}-week block.
CONTEXT:
- Goal: Marathon in ${state.goalTime} on ${state.raceDate}
- Phase: ${params.phase} (${params.blockPosition})
- Volume Target: ~${params.totalVolume} km
- Long Run: ${params.longRunDistance} km on ${params.longRunDay} (MANDATORY)

ATHLETE HISTORY:
${params.last4Weeks}

ZONES:
${params.zones}

INSTRUCTIONS:
1. Create 7 days of workouts (Mon-Sun).
2. Key workouts (Long Run, Intervals) MUST be on available days: ${params.availableDays}.
3. Balance remaining volume (${(params.totalVolume - params.longRunDistance).toFixed(1)} km) across other available days.
4. Description Format: Provide "description_ui" (short) and "description_export" (Intervals.icu format).
${raceContext}

OUTPUT JSON ONLY:
{
  "workouts": [
    {
      "day": "Monday",
      "type": "Intervals",
      "description_ui": "6x800m intervals",
      "steps": [
        { "type": "Warmup", "duration": 600, "intensity": "60-70% Pace", "press_lap": true },
        { "type": "Run", "distance": 800, "intensity": "100-105% Pace", "reps": 6, "recovery_duration": 90, "recovery_intensity": "50% Pace", "recovery_press_lap": false },
        { "type": "Cooldown", "duration": 600, "intensity": "60-70% Pace" }
      ]
    }
  ]
}
`;
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
            })
        });
        const data = await response.json();
        processAIResponse(data.choices[0].message.content, weekIndex, availability);
    } catch (error) {
        showToast(`❌ OpenAI Error: ${error.message}`);
    }
}

async function callGeminiAPI(prompt, weekIndex, availability) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${state.geminiApiKey}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt + "\n\nIMPORTANT: Output ONLY valid JSON." }] }]
            })
        });
        const data = await response.json();

        if (data.candidates && data.candidates.length > 0) {
            processAIResponse(data.candidates[0].content.parts[0].text, weekIndex, availability);
        } else {
            throw new Error("No candidates returned from Gemini");
        }
    } catch (error) {
        showToast(`❌ Gemini Error: ${error.message}`);
    }
}

function processAIResponse(content, weekIndex, availability) {
    try {
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        const workoutsData = JSON.parse(cleanContent);

        if (workoutsData.workouts) {
            renderAIWorkouts(weekIndex, workoutsData.workouts, availability);
            showToast("✅ AI Workout Plan Generated!");
        } else {
            throw new Error("Invalid JSON structure: missing 'workouts' key");
        }
    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw Content:", content);
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
            if (typeof w.day === 'string') {
                return w.day.toLowerCase().includes(dayName.toLowerCase());
            }
            return w.day === dayNum;
        });

        if (isLongRun) {
            // Always prioritize the long run structure
            const descUI = workout && workout.description_ui ? workout.description_ui : "Steady aerobic pace, build last 20%";
            const descExport = workout && workout.description_export ? workout.description_export : descUI;

            html += `<div class="p-2 bg-orange-500/10 border border-orange-500/30 rounded" data-description="${descExport.replace(/"/g, '&quot;')}">
                <div class="text-xs font-bold text-orange-400">${dayName}: Long Run</div>
                <div class="text-[10px] text-slate-400">${descUI}</div>
            </div>`;
        } else if (workout) {
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
    if (!state.zones) return "Zones not available (using default estimation).";

    // Construct a readable string for the AI from state.zones
    let zStr = "Running Zones:\n";
    if (state.zones.z1) zStr += `Z1 (Recovery): ${state.zones.z1}\n`;
    if (state.zones.z2) zStr += `Z2 (Endurance): ${state.zones.z2}\n`;
    if (state.zones.z3) zStr += `Z3 (Tempo): ${state.zones.z3}\n`;
    if (state.zones.z4) zStr += `Z4 (Threshold): ${state.zones.z4}\n`;
    if (state.zones.z5) zStr += `Z5 (VO2 Max): ${state.zones.z5}\n`;

    return zStr;
}

async function pushToIntervalsICU(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return showToast("Error: Week not found");

    const workoutContainer = document.getElementById(`workout-summary-${weekIndex}`);
    // Check if empty or contains the "No workouts" italic text
    if (!workoutContainer || workoutContainer.querySelector('div.italic')) {
        return showToast("No workouts generated yet.");
    }

    const pushBtn = document.getElementById(`push-btn-${weekIndex}`);
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }

    showToast("Pushing to Intervals.icu...");

    try {
        await deleteWorkoutsForWeek(weekIndex);

        const events = [];
        const weekStartDate = new Date(week.startDate);
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Scrape the DOM for workouts we just rendered
        const workoutDivs = workoutContainer.querySelectorAll('div[data-description]');

        const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;
        const dayNumbers = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun
        const sortedAvailability = [...availability].sort((a, b) => dayNumbers.indexOf(a) - dayNumbers.indexOf(b));

        workoutDivs.forEach((div, idx) => {
            if (idx >= sortedAvailability.length) return; // Safety check

            const dayNum = sortedAvailability[idx];
            const dayName = dayNames[dayNum];

            // Calculate date logic relative to week start
            const startDayNum = new Date(week.startDate).getDay(); // e.g. 1 (Mon)

            // Calculate difference in days. Handle wrap around.
            let dayOffset = dayNum - startDayNum;
            if (dayOffset < 0) dayOffset += 7;

            const specificDate = new Date(week.startDate);
            specificDate.setDate(specificDate.getDate() + dayOffset);

            const dateStr = specificDate.toISOString().split('T')[0];
            const desc = div.dataset.description;

            // Get title from text content
            let title = "Run";
            const titleEl = div.querySelector('.font-bold');
            if (titleEl) {
                const text = titleEl.innerText; // "Monday: Long Run"
                if (text.includes(':')) title = text.split(':')[1].trim();
            }

            events.push({
                category: "WORKOUT",
                start_date_local: `${dateStr}T00:00:00`,
                type: "Run",
                name: title,
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
        await deleteWorkoutsForWeek(weekIndex);

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

async function deleteWorkoutsForWeek(weekIndex) {
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