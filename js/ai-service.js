// ==========================================
// AI SERVICE
// Handles AI prompt generation and API calls
// ==========================================

/**
 * Prepares workout plan using AI
 * @param {string} scope - 'week' or 'block'
 * @param {Array<number>} indices - Array of week indices to generate for
 */
async function preparePlanWithAI(scope, indices) {
    const isBlock = scope === 'block';
    const label = isBlock ? `Block Plan` : `Week Plan`;
    showAILoading(`Generating ${label} with AI...`);

    // 1. Gather Context
    const weeks = indices.map(idx => state.generatedPlan[idx]);
    if (weeks.some(w => !w)) {
        showToast("Error: Week data not found");
        hideAILoading();
        return;
    }

    const firstWeek = weeks[0];
    const last4WeeksSummary = getLast4WeeksSummary();
    const zones = getZonePaceStrings();
    const progressionRate = state.progressionRate || 0.10;

    // Goal Assessment
    let goalAssessment = null;
    if (typeof assessMarathonGoal === 'function' && state.goalTime && state.raceDate) {
        goalAssessment = assessMarathonGoal(state.goalTime, state.raceDate);
    }

    // Build context for each week
    const weeksContext = weeks.map(week => {
        const availability = state.weeklyAvailability[week.week - 1] || state.defaultAvailableDays;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDays = availability.map(d => dayNames[d]).join(', ');

        let distribution = {};
        if (typeof calculateRunDistribution === 'function') {
            distribution = calculateRunDistribution(week.week - 1);
        }

        // Progression Context (for single week mainly, but useful for block too)
        let progressionContext = `Standard progression (${(progressionRate * 100).toFixed(1)}%)`;
        if (week.weekName === 'Recovery') {
            progressionContext = "Recovery Week (Reduced Volume)";
        } else if (week.weekName === 'Overreach') {
            progressionContext = "Overreach Week (Peak Volume before Recovery)";
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
            weekStartDate: week.startDate,
            progressionContext: progressionContext,
            blockPosition: `${week.positionInBlock || 1}/${week.blockLength || 1}`
        };
    });

    // 2. Build Prompt
    const prompt = buildAIWorkoutPrompt({
        scope: scope,
        weeks: weeksContext,
        totalWeeks: state.generatedPlan.length,
        goalAssessment: goalAssessment,
        last4Weeks: last4WeeksSummary,
        zones: zones,
        athleteHistory: state.history || "Not provided",
        injuries: state.injuries || "None",
        preferences: state.preferences || "None",
        sportType: state.sportType || "Running",
        rampRate: state.rampRate || 5,
        goalTime: state.goalTime,
        raceDate: state.raceDate
    });

    console.log("AI Prompt:", prompt);
    const dbgPrompt = document.getElementById('dbg-ai-prompt');
    if (dbgPrompt) dbgPrompt.innerText = prompt;

    // 3. Call AI
    const provider = state.aiProvider || 'openai';
    if (provider === 'openai') {
        if (!state.aiApiKey) {
            hideAILoading();
            return showToast("❌ Error: OpenAI API Key is missing.");
        }
        await callOpenAI(prompt, indices);
    } else if (provider === 'gemini') {
        if (!state.geminiApiKey) {
            hideAILoading();
            return showToast("❌ Error: Gemini API Key is missing.");
        }
        await callGeminiAPI(prompt, indices);
    }
}

function buildAIWorkoutPrompt(params) {
    const isBlock = params.scope === 'block';
    const firstWeek = params.weeks[0];

    let sportInstructions = "";
    if (params.sportType === "Cycling") {
        sportInstructions = `
10. **CYCLING SPECIFIC**:
   - Intensity MUST be defined as percentage of FTP (e.g. "65-75% FTP").
   - Use "Power" instead of "Pace" for zones.
   - **TSS TARGET**: The goal is approx ${firstWeek.totalVolume} TSS (for first week, progress from there).
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

    let goalContext = "";
    if (params.goalAssessment) {
        goalContext = `
GOAL ASSESSMENT:
- Difficulty: ${params.goalAssessment.difficulty}
- Min Days Required: ${params.goalAssessment.minDays}
- Warnings: ${params.goalAssessment.warnings.join('; ')}
`;
    }

    return `
ROLE: You are an elite ${params.sportType === "Cycling" ? "cycling" : "running"} coach creating a ${isBlock ? "PROGRESSIVE " : ""}workout plan for ${isBlock ? `a ${params.weeks.length}-week block` : `Week ${firstWeek.weekNumber}`}. You prescribe holistic training including ${params.sportType === "Cycling" ? "rides" : "running"}, strength, core, and cross-training.

ATHLETE PROFILE:
- History: ${params.athleteHistory}
- Injuries/Limitations: ${params.injuries}
- Preferences: ${params.preferences}

CONTEXT:
- Goal: ${params.sportType === "Cycling" ? "Cycling Event" : "Marathon"} in ${params.goalTime} on ${params.raceDate}
- Phase: ${firstWeek.phase}
- Focus: ${firstWeek.focus}
${goalContext}

ZONES (${params.sportType === "Cycling" ? "Power & HR" : "Pace & HR"}):
${params.zones}

LAST 4 WEEKS:
${params.last4Weeks}

INSTRUCTIONS:
1. Create a cohesive plan for ${isBlock ? `ALL ${params.weeks.length} weeks` : "the week"}.
2. ${isBlock ? "Ensure PROGRESSIVE OVERLOAD." : "Respect volume targets."}
3. **PRIORITY**: If the user has specified fixed sessions (e.g. "Gym on Tuesday" in preferences), you MUST build the plan around this.
4. **MINIMUM DURATION**: All ${params.sportType === "Cycling" ? "RIDING" : "RUNNING"} sessions must be at least ${params.sportType === "Cycling" ? "45 mins" : "5km"}.
5. **NON-TRAINING DAYS**: On days without ${params.sportType === "Cycling" ? "riding" : "running"}, you MUST propose one of: Rest, Strength, Yoga, or Cross Training.
6. **STRUCTURED WORKOUTS**: You must provide a "steps" array for each workout.
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

DATE HANDLING:
- You MUST use "start_date_local" for every workout.
- Format: "YYYY-MM-DDTHH:MM:SS"
- Time: Always use T06:00:00
- Use the "weekStartDate" provided in the context to calculate the correct dates.

WEEKS TO PLAN:
${JSON.stringify(params.weeks, null, 2)}

OUTPUT JSON FORMAT ONLY:
{
  "weeks": [
    {
      "weekNumber": ${firstWeek.weekNumber},
      "workouts": [
        { 
          "start_date_local": "2025-12-01T06:00:00",
          "type": "${params.sportType === "Cycling" ? "Ride" : "Run"}",
          "title": "Steady Run",
          "description_ui": "Steady Run 8km",
          "description_export": "Warmup\\n- Press lap 2km 65-75% Pace\\n\\nMain Set\\n- 6km 75-85% Pace\\n\\nCooldown\\n- 10m 60-70% Pace",
          "distance": 9000,
          "duration": 3000,
          "steps": [
            { "type": "Warmup", "duration": 600, "intensity": "60-70% ${params.sportType === "Cycling" ? "FTP" : "Pace"}", "press_lap": true },
            { "type": "${params.sportType === "Cycling" ? "Ride" : "Run"}", "distance": 6000, "intensity": "75-85% ${params.sportType === "Cycling" ? "FTP" : "Pace"}" },
            { "type": "Cooldown", "duration": 600, "intensity": "60-70% ${params.sportType === "Cycling" ? "FTP" : "Pace"}" }
          ]
        }
      ]
    }
  ]
}
`;
}

async function callOpenAI(prompt, indices) {
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
        processAIResponse(data.choices[0].message.content, indices);
    } catch (error) {
        hideAILoading();
        showToast(`❌ OpenAI Error: ${error.message}`);
    }
}

async function callGeminiAPI(prompt, indices) {
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
            processAIResponse(data.candidates[0].content.parts[0].text, indices);
        } else {
            hideAILoading();
            throw new Error("No candidates returned from Gemini");
        }
    } catch (error) {
        hideAILoading();
        showToast(`❌ Gemini Error: ${error.message}`);
    }
}

function processAIResponse(content, indices) {
    try {
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        const data = JSON.parse(cleanContent);

        // Handle both single week (legacy structure) and multi-week structure
        let weeksData = [];
        if (data.weeks) {
            weeksData = data.weeks;
        } else if (data.workouts) {
            // Single week response, wrap it
            weeksData = [{ weekNumber: indices[0], workouts: data.workouts }];
        } else {
            throw new Error("Invalid JSON structure: missing 'weeks' or 'workouts' key");
        }

        weeksData.forEach(weekData => {
            // Find the index for this week number
            // Note: weekData.weekNumber is the 1-based week number
            // indices contains 0-based indices. 
            // We need to match them.
            // state.generatedPlan[idx].week === weekData.weekNumber

            const targetIndex = indices.find(idx => state.generatedPlan[idx].week === weekData.weekNumber);

            if (targetIndex !== undefined) {
                state.generatedWorkouts[targetIndex] = weekData.workouts;
                const availability = state.weeklyAvailability[targetIndex] || state.defaultAvailableDays;
                renderAIWorkouts(targetIndex, weekData.workouts, availability);
            }
        });

        hideAILoading();
        showToast("✅ AI Workout Plan Generated!");

    } catch (e) {
        console.error("JSON Parse Error:", e);
        console.log("Raw Content:", content);
        hideAILoading();
        showToast("❌ Failed to parse AI response.");
    }
}

// renderAIWorkouts is defined in weekly-ui.js

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

function getZonePaceStrings() {
    if (!state.lthrPace) return "Lactate Threshold Pace: Not synced (please sync with Intervals.icu)";

    let zStr = `Lactate Threshold Pace: ${state.lthrPace}\n`;
    if (state.lthrBpm) {
        zStr += `Lactate Threshold HR: ${state.lthrBpm} bpm\n`;
    }

    return zStr;
}
