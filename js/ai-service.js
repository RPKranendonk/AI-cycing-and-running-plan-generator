// ==========================================
// AI SERVICE
// Handles AI prompt generation and API calls
// ==========================================

const msPerDay = 86400000;

/**
 * Prepares workout plan using AI
 * @param {string} scope - 'week' or 'block'
 * @param {Array<number>} indices - Array of week indices to generate for
 */
async function preparePlanWithAI(scope, indices) {
    try {
        // 1. Sort indices to ensure chronological order
        indices.sort((a, b) => a - b);

        console.log(`[AI Debug] preparePlanWithAI called. Scope: ${scope}, Indices:`, indices);

        // [FIX] Robust Sport Detection
        if (!state.sportType) {
            const cycContainer = document.getElementById('cycling-config-container');
            state.sportType = (cycContainer && cycContainer.style.display !== 'none') ? "Cycling" : "Running";
        }

        if (!state.aiProvider) {
            showToast("❌ No AI provider selected. Please select OpenAI or Gemini in Settings.");
            return;
        }

        // [FIX] Validate Plan State
        if (!state.generatedPlan || !Array.isArray(state.generatedPlan)) {
            console.error("state.generatedPlan is missing or invalid:", state.generatedPlan);
            showToast("❌ No plan found. Please generate a plan first.");
            return;
        }

        // BATCH GENERATION LOGIC (Chunking for Token Safety)
        if (indices.length > 1) {
            showAILoading(`Generating Block Plan...`);

            let progressionContext = []; // Stores summaries, not full JSON
            let lastWeekSummary = null; // Stores the very last workout of the previous batch

            // Split indices into batches
            const batches = [];
            // [OPTIMIZATION] Batch Size = 4 Weeks (approx 3500 tokens output)
            // Most models (GPT-4o, Gemini) have a max OUTPUT limit of 4096 tokens.
            // 52 weeks would require ~40,000 output tokens, which causes the API to fail/timeout.
            const chunkSize = 4;
            for (let i = 0; i < indices.length; i += chunkSize) {
                batches.push(indices.slice(i, i + chunkSize));
            }

            for (let i = 0; i < batches.length; i++) {
                const batchIndices = batches[i];

                // [FIX] Safe Access to Week Data
                const firstWeekIdx = batchIndices[0];
                const lastWeekIdx = batchIndices[batchIndices.length - 1];

                if (!state.generatedPlan[firstWeekIdx] || !state.generatedPlan[lastWeekIdx]) {
                    console.error(`Missing week data for indices: ${firstWeekIdx} or ${lastWeekIdx}`);
                    continue; // Skip this batch if data is missing
                }

                const startWeek = state.generatedPlan[firstWeekIdx].week;
                const endWeek = state.generatedPlan[lastWeekIdx].week;
                const rangeLabel = startWeek === endWeek ? `Week ${startWeek}` : `Weeks ${startWeek}-${endWeek}`;

                updateAILoadingText(`Generating ${rangeLabel} (${i + 1}/${batches.length})...`);

                try {
                    // Generate for batch
                    // Pass lastWeekSummary for continuity (e.g. if Sunday was Long Run, Mon needs rest)
                    const batchResults = await _generateBatch(batchIndices, scope, progressionContext, lastWeekSummary);

                    // HELPER: Convert "MM:SS/km" to seconds, apply factor, return new string
                    function getEstimatedBasePace(ltPaceStr) {
                        if (!ltPaceStr) return "6:00/km"; // Default fallback

                        // 1. Parse "4:00/km" -> 240 seconds
                        const parts = ltPaceStr.split(":");
                        const min = parseInt(parts[0]);
                        const sec = parseInt(parts[1].replace("/km", "").replace("/mi", "")); // handle units
                        const totalSeconds = (min * 60) + sec;

                        // 2. Apply the "Easy Run Factor" (1.25x slower than LT)
                        const baseSeconds = Math.round(totalSeconds * 1.25);

                        // 3. Convert back to MM:SS/km
                        const newMin = Math.floor(baseSeconds / 60);
                        const newSec = baseSeconds % 60;
                        const padSec = newSec < 10 ? "0" + newSec : newSec;

                        return `${newMin}:${padSec}/km`;
                    }

                    // USAGE IN PROMPT BUILDER
                    const basePace = getEstimatedBasePace(state.lthrPace);
                    // Pass 'basePace' into the prompt string below...

                    // [FIX] EXTRACT SUMMARY for next batch (Token Saving)
                    // We only save the "Key Session" to history, not the whole JSON
                    if (batchResults && batchResults.length > 0) {
                        batchResults.forEach(res => {
                            const keySession = res.workouts.find(w =>
                                w.title.includes("Interval") ||
                                w.title.includes("Long") ||
                                (w.description_export && w.description_export.includes("Z4"))
                            );

                            if (keySession) {
                                progressionContext.push({
                                    week: res.weekNumber,
                                    key_session: keySession.title,
                                    // Summarize structure to save tokens
                                    structure: keySession.description_export
                                        ? keySession.description_export.split('\n').filter(l => l.trim().startsWith('-')).join(', ').substring(0, 150)
                                        : "No details"
                                });
                            }
                        });

                        // Verify continuity for next batch: Get LAST workout of LAST week in this batch
                        const lastWeekOfBatch = batchResults[batchResults.length - 1];
                        if (lastWeekOfBatch && lastWeekOfBatch.workouts && lastWeekOfBatch.workouts.length > 0) {
                            const lastWorkout = lastWeekOfBatch.workouts[lastWeekOfBatch.workouts.length - 1];
                            lastWeekSummary = {
                                date: lastWorkout.start_date_local,
                                type: lastWorkout.type,
                                title: lastWorkout.title,
                                isLongRun: lastWorkout.title.toLowerCase().includes('long') || lastWorkout.duration > 5400 // >90mins
                            };
                        }
                    }

                } catch (e) {
                    console.error(`Error generating batch ${rangeLabel}:`, e);
                    showToast(`❌ Failed to generate ${rangeLabel}`);
                    break; // Stop if a batch fails
                }
            }

            hideAILoading();
            showToast("✅ Block Plan Generated!");
            return;
        }

        // Single week case
        showAILoading(`Generating Week Plan...`);
        try {
            await _generateBatch(indices, scope, [], null);
            hideAILoading();
            showToast("✅ AI Workout Plan Generated!");
        } catch (e) {
            hideAILoading();
            showToast(`❌ Error: ${e.message}`);
        }
    } catch (err) {
        console.error("Critical Error in preparePlanWithAI:", err);
        hideAILoading();
        showToast(`❌ System Error: ${err.message}`);
    }
}

/**
 * Internal helper to generate a batch of weeks
 */
/**
 * Internal helper to generate a batch of weeks
 */
async function _generateBatch(indices, scope, historyContext = [], lastWeekSummary = null) {
    // 1. Build Context for ALL weeks in this batch
    const weeksContext = indices.map((index, i) => {
        const week = state.generatedPlan[index];
        if (!week) throw new Error(`Week data not found for index ${index}`);

        const availability = state.weeklyAvailability[index] || state.defaultAvailableDays;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availableDays = availability.map(d => dayNames[d]).join(', ');

        // [FIX] Explicit Rest Day Target
        // If 7 days available, need 1 rest. If 3 days available, need 4 rest.
        // User Logic: "Available for training". Unlisted = Rest.
        // But we enforce ALWAYS 1 rest day minimum even if 7 days available.
        const restDaysRequired = Math.max(1, 7 - availability.length);

        // GYM LOGIC
        let gymTarget = "Optional";
        if (state.gymAccess === "Yes" || state.gymAccess === true) {
            if (week.phaseName.includes("Base") || week.phaseName.includes("Build")) {
                gymTarget = "2 sessions (Strength/Power focus)";
            } else if (week.phaseName.includes("Peak")) {
                gymTarget = "1 session (Maintenance)";
            } else {
                gymTarget = "None (Focus on recovery)";
            }
        }

        // DEBUG: Volume Metrics
        const tDist = week.targetDistance !== undefined ? week.targetDistance : (state.sportType === "Cycling" ? 0 : week.rawKm);
        const tTSS = week.targetTSS !== undefined ? week.targetTSS : (state.sportType === "Cycling" ? week.rawKm : 0);
        console.log(`[AI Debug] Week ${week.week}: Target Distance=${tDist}, Target TSS=${tTSS}, Raw=${week.rawKm}`);

        // BLOCK/PHASE POSITIONING LOGIC
        // Calculate "Week X of Y" for the current phase
        const currentPhase = week.phaseName || "Base";
        const weeksInPhase = state.generatedPlan.filter(w => w.phaseName === currentPhase);
        const totalWeeksInPhase = weeksInPhase.length;
        const relativeWeekNum = weeksInPhase.findIndex(w => w.week === week.week) + 1;

        return {
            weekNumber: week.week,
            phase: currentPhase,
            focus: week.focus,
            targetTotal: week.rawKm, // Keep for legacy
            targetDistance: tDist,
            targetTSS: tTSS,
            targetLong: week.longRun,
            availableDays: availableDays,
            weekStartDate: week.startDate,
            gymFocus: gymTarget,
            restDays: restDaysRequired,
            // [FIX] Context: "Week 2 of 4 in Base 1"
            blockPosition: `Week ${relativeWeekNum} of ${totalWeeksInPhase} in ${currentPhase}`
        };
    });

    // Resolve Long Run Day Name
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const longRunDayName = dayNames[state.longRunDay] || 'Sunday';

    const last4WeeksSummary = getLast4WeeksSummary();
    const zones = getZonePaceStrings();

    // Goal Assessment
    let goalAssessment = null;
    if (typeof assessMarathonGoal === 'function' && state.goalTime && state.raceDate) {
        goalAssessment = assessMarathonGoal(state.goalTime, state.raceDate);
    }

    // Generate Plan Overview (Whole Plan Context)
    const planOverview = state.generatedPlan.map(w => {
        const vol = state.sportType === "Cycling" ? `${w.targetTSS || 0} TSS` : `${w.targetDistance || 0} km`;
        // Find availability for this specific week index usually matching week number - 1
        const weekIndex = w.week - 1;
        const avail = state.weeklyAvailability[weekIndex] ? state.weeklyAvailability[weekIndex].length : (state.defaultAvailableDays ? state.defaultAvailableDays.length : '?');
        return `Week ${w.week}: ${w.phaseName} (${vol}, ${avail} days avail)`;
    }).join('\n');

    // Build Prompt
    const prompt = buildAIWorkoutPrompt({
        scope: scope,
        weeks: weeksContext,
        totalWeeks: state.generatedPlan.length,
        goalAssessment: goalAssessment,
        last4Weeks: last4WeeksSummary,
        zones: zones,
        athleteHistory: state.trainingHistory || "Not provided",
        injuries: state.injuries || "None",
        preferences: state.trainingPreferences || "None",
        sportType: state.sportType || "Running",
        age: state.athleteAge,
        gender: state.gender,
        goalTime: state.goalTime,
        raceDate: state.raceDate,
        rampRate: state.rampRate || 5,
        progressionHistory: historyContext, // [FIX] Passing the summary, not full JSON
        ftp: state.ftp,
        ltRunningPace: state.lthrPace,
        lthrBpm: state.lthrBpm,
        longRunDayName: longRunDayName,
        lastWeekSummary: lastWeekSummary,
        planOverview: planOverview,
        dailyAvailability: state.dailyAvailability || {}  // Hours per day with AM/PM split info
    });

    // Call AI and [FIX] Return data
    let resultData = null;

    // [DEBUG] Update UI with Prompt
    if (typeof window.updateDebugPrompt === 'function') {
        window.updateDebugPrompt(prompt);
    }

    const provider = state.aiProvider || 'gemini';

    if (provider === 'gemini') {
        if (!state.geminiApiKey) throw new Error("Gemini API Key is missing.");
        resultData = await callGeminiAPI(prompt, indices);
    } else if (provider === 'deepseek') {
        if (!state.deepseekApiKey) throw new Error("DeepSeek API Key is missing.");
        resultData = await callDeepSeekAPI(prompt, indices);
    } else if (provider === 'openrouter') {
        if (!state.openRouterApiKey) throw new Error("OpenRouter API Key is missing.");
        resultData = await callOpenRouterAPI(prompt, indices);
    } else if (provider === 'mistral') {
        if (!state.mistralApiKey) throw new Error("Mistral API Key is missing.");
        resultData = await callMistralAPI(prompt, indices);
    } else {
        resultData = await callOpenAI(prompt, indices);
    }

    return resultData; // Return results so loop can build history
}

async function callDeepSeekAPI(prompt, indices) {
    try {
        const cleanKey = state.deepseekApiKey ? state.deepseekApiKey.trim() : "";

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                stream: false
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from DeepSeek");
        }

        // DeepSeek returns content in data.choices[0].message.content
        return processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("DeepSeek Call Failed:", error);
        showToast(`❌ DeepSeek Error: ${error.message}`);
        throw error;
    }
}

async function callOpenRouterAPI(prompt, indices) {
    try {
        const cleanKey = state.openRouterApiKey ? state.openRouterApiKey.trim() : "";
        // [USER REQUEST] Use DeepSeek-R1 via OpenRouter
        const model = "deepseek/deepseek-r1";

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`,
                'HTTP-Referer': window.location.href, // Optional: for OpenRouter rankings
                'X-Title': 'Simple AI Coach'          // Optional: for OpenRouter rankings
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from OpenRouter");
        }

        return processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("OpenRouter Call Failed:", error);
        showToast(`❌ OpenRouter Error: ${error.message}`);
        throw error;
    }
}

async function callMistralAPI(prompt, indices) {
    try {
        const cleanKey = state.mistralApiKey ? state.mistralApiKey.trim() : "";

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(60000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error ${response.status}`); // Mistral error format might vary
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from Mistral");
        }

        return processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("Mistral Call Failed:", error);
        showToast(`❌ Mistral Error: ${error.message}`);
        throw error;
    }
}

function buildAIWorkoutPrompt(params) {
    const isBlock = params.scope === 'block';
    const firstWeek = params.weeks[0];
    const sport = params.sportType || "Running";
    const isCycling = sport === "Cycling";

    // -------------------------------------------------------------------------
    // 0. CALCULATE DERIVED METRICS (HOISTED)
    // -------------------------------------------------------------------------
    let basePace = "5:30/km"; // Default
    if (!isCycling && params.ltRunningPace) {
        // Simple parsing: "4:00/km" -> "4:00"
        const cleanPace = params.ltRunningPace.replace('/km', '').trim();
        if (cleanPace.includes(':')) {
            try {
                const [m, s] = cleanPace.split(':').map(Number);
                const thresholdSec = (m * 60) + s;
                // Base Aerobic = ~1.25 - 1.35 slower than threshold
                const baseSec = Math.round(thresholdSec * 1.25);
                const bm = Math.floor(baseSec / 60);
                const bs = baseSec % 60;
                basePace = `${bm}:${bs.toString().padStart(2, '0')}/km`;
            } catch (e) {
                console.warn("Could not calculate base pace, using default");
            }
        }
    }

    // -------------------------------------------------------------------------
    // 1. SPORT SPECIFIC SYNTAX & LOGIC
    // -------------------------------------------------------------------------
    let sportInstructions = "";
    if (isCycling) {
        sportInstructions = `
### 7. CYCLING SPECIFIC RULES & SYNTAX
**A. STRICT INTERVALS.ICU SYNTAX:**
- **REPEATS:** Write multiplier (e.g. "4x") on its own line. NO DASH.
- **CLOSING REPEATS:** You MUST put an EMPTY LINE (\\n\\n) after the last step of a repeat block.
- **INTENSITY:** Use "%" to denote %FTP. (e.g. "85-95%").
- **TIME:** Always use duration (m/s).

**B. PHYSIOLOGICAL & MATH RULES:**
- **Intensity Basis:** Percentage of FTP.
- **VOLUME GOAL:** Target approximately **${Math.round(firstWeek.targetTSS / 50)} to ${Math.round(firstWeek.targetTSS / 45)} HOURS** of total riding.
- **TSS ESTIMATION:** Do not calculate exact TSS (it is complex). Instead, assume:
    - 1h Endurance = ~45 TSS
    - 1h Interval Session = ~70-80 TSS
- **PRIORITY:** Hit the target **DURATION** first. The TSS will follow.
- **STRUCTURE:** - Warmup: 10-15 mins @ 50-60% FTP (Friel Z1/Z2).
    - Endurance Variety: For long Z2 rides, insert "Spin-ups" (e.g., 3x 1min @ 100rpm) every 20mins to break monotony.
    - Intervals: Low Intensity (Z1/Z2) ~80% of time; High Intensity (Z4/Z5) ~20%.
`;
    } else {
        sportInstructions = `
### 7. RUNNING SPECIFIC RULES & SYNTAX
**A. THE "BASE PACE" ANCHOR (CRITICAL MATH)**
- You have been provided a calculated **Base Aerobic Pace: ${basePace}**.
- **RULE:** Use this ${basePace} to calculate the Duration for ALL Warmups, Cooldowns, Recovery Runs, and Long Runs.
- **DO NOT** use the user's Threshold pace (${params.ltRunningPace}) to calculate duration for easy miles.
- **CALCULATION:** - If scheduling a 10km Easy Run: 10 * ${basePace} = Duration.
    - If ${basePace} is "5:00/km", then 10km = 50 minutes (3000 seconds).
    - If you output "10km" with "3000 seconds", you are correct.

**B. INTENSITY & STEPS**
- **Intervals:** Only the "Main Set" steps should use faster paces (e.g., 90-110% Pace).
- **Rest Steps:** Must be slower than Base Pace (Jog/Walk).
- **Structure:** - Warmup (10-15m @ Base Pace)
    - Main Set (Specific Intervals)
    - Cooldown (5-10m @ Base Pace)
    
**C. STRICT INTERVALS.ICU SYNTAX:**
- **REPEATS:** Write multiplier (e.g. "6x") on its own line. NO DASH.
- **CLOSING REPEATS:** You MUST put an EMPTY LINE (\\n\\n) after the last step of a repeat block.
- **INTENSITY:** You MUST append "Pace" after the % (e.g., "80-90% Pace").
- **UNITS:** Use "km" or "m" for distance, "min" or "s" for time.

**D. PHYSIOLOGICAL & MATH RULES:**
- **Warmup/Cooldown:** STRICTLY 10m or 600s.
- **Run Pace Logic:** **SPEED BASED**.
    - 60-70% Pace = Slow/Easy (Warmup/Recovery).
    - 100% Pace = Threshold.
    - 105%+ Pace = Fast/Intervals.
- **Press Lap Logic:** - Warmup step: "press_lap": true.
    - Short intervals (<=60s or <=400m): Recovery step MUST have "recovery_press_lap": true.
- **Endurance Variety:** For steady runs, add "Strides" (e.g., 4x20s fast / 40s jog) near the end to maintain neuromuscular engagement.
`;
    }

    // -------------------------------------------------------------------------
    // 2. CONTEXTS
    // -------------------------------------------------------------------------
    let goalContext = "";
    if (params.goalAssessment) {
        goalContext = `
GOAL ASSESSMENT (Athlete Context):
- **Feasibility:** ${params.goalAssessment.timeStatus} (${params.goalAssessment.timeMessage})
- **Difficulty Rating:** ${params.goalAssessment.difficulty}
- **Recommended Training Frequency:** ${params.goalAssessment.minDays} sessions/week 
- **Coach Warnings:** ${params.goalAssessment.warnings.join('; ')}
`;
    }

    let progressionContext = "";
    if (params.progressionHistory && params.progressionHistory.length > 0) {
        progressionContext = `
# PROGRESSION HISTORY (PREVIOUS WEEKS)
Use this history to ensure PROGRESSIVE OVERLOAD. 
- If Week 1 had 3x8min intervals, Week 2 should have 4x8min or 3x10min.
- Do NOT repeat the exact same key workout. Make it slightly harder.

${JSON.stringify(params.progressionHistory, null, 2)}
`;
    }

    // Continuity Context
    let continuityContext = "";
    if (params.lastWeekSummary) {
        continuityContext = `
# CONTINUITY CHECK (CRITICAL)
The previous week ended on ${params.lastWeekSummary.date} (${params.lastWeekSummary.title}).
${params.lastWeekSummary.isLongRun ? "**CRITICAL:** The last day was a LONG RUN. Therefore, Monday of the next week MUST be a REST DAY or very short Active Recovery (Z1)." : ""}
`;
    }

    // -------------------------------------------------------------------------
    // 3. MAIN PROMPT
    // -------------------------------------------------------------------------
    return `
# ROLE & OBJECTIVE
You are an **Elite Endurance Sports Physiologist & Sports Psychologist**.
Your training philosophy is grounded in the **Norwegian Method** (High Volume, Controlled Intensity, Double Thresholds), **Polarized Training** (80/20) and **Pyramidal Training** for athletes with less time.
You believe in a **Holistic Approach**: Strength, Mobility, and Rest are not "optional add-ons" but **integral performance multipliers**.
Your goal is to generate a highly specific, periodized workout schedule that respects the user's physiology while pushing for optimal adaptation.

# INPUT VARIABLES
1. **Sport:** ${sport}
2. **Age & Gender:** ${params.age || 'N/A'}, ${params.gender || 'N/A'}
3. **Training History:** ${params.athleteHistory}
4. **Recent Volume (Last 4 weeks):** ${params.last4Weeks}
5. **Fitness Metrics:**
   - FTP: ${params.ftp || 'Not set'}
   - LTHR Pace: ${params.ltRunningPace || 'Not set'}
   - LTHR BPM: ${params.lthrBpm || 'Not set'}
6. **Injury Profile:** ${params.injuries}
   - *CRITICAL:* If injuries are present, REDUCE high-impact intensity and Prioritize consistency over peak load.
7. **Gym Access:** ${params.preferences}
   - *CONTEXT:* Strength training is ESSENTIAL for running economy and injury prevention. It is NOT optional.
8. **Training Preferences:** ${params.preferences}
9. **Race Date/Goal:** ${params.goalAssessment ? `Target: ${params.goalTime} on ${params.raceDate}` : "General Fitness"}

# PLAN CONTEXT (THE BIG PICTURE)
Use this overview to understand the progression. This plan has been calculated with specific Ramp Rates to safely build fitness. **Trust these volumes.**
${params.planOverview || "No plan context available."}

---

# MANDATORY ANCHOR SESSIONS (SCHEDULE THESE FIRST)

## Long Run / Ride
- **Day:** ${params.longRunDayName} (FIXED - Do NOT move to another day under any circumstances)
- **Distance/Duration:** Must EXACTLY match Target Long Run for each week
- **Priority:** Schedule this FIRST, then fill other days around it
- **Rule:** Even if ${params.longRunDayName} is NOT in "Available Days", schedule the Long Run on ${params.longRunDayName} ANYWAY.

---

# BLOCK SCHEDULE & WEEKLY TARGETS
Create workouts for the following weeks. STRICTLY follow the volume and long run targets.

${params.weeks.map(w => `
### Week ${w.weekNumber}: ${w.phase}
- **Block Position:** ${w.blockPosition}
- **Primary Focus:** ${w.focus}
- **Target Volume:** ${isCycling ? w.targetTSS + " TSS" : w.targetDistance + " km"}
- **Target Long Run:** ${w.targetLong} ${isCycling ? "hours" : "km"} **[MUST be on ${params.longRunDayName} - NON-NEGOTIABLE]**
  - *Remaining Volume via other runs:* ~${Math.max(0, (w.targetDistance || 0) - (w.targetLong || 0)).toFixed(1)} ${isCycling ? "TSS" : "km"}
- **Available Days:** ${w.availableDays}
- **Required Rest Days:** ${w.restDays} (Minimum)
- **Gym Target:** ${w.gymFocus}
`).join('\n')}

**CRITICAL CONTINUITY INSTRUCTION:**
- The AI must look at the **PLAN CONTEXT** above.
- If Week N ends with a Long Run (Sunday), Week N+1 (Monday) can be a rest day if the schedule and availability allows this, or an easy recovery session. 
- **VERIFY** this in the "Post-Long Run Recovery" check for every week transition.

---

# INSTRUCTIONS & PRIORITIES

## 1. PRIORITY HIERARCHY (STRICT)
When in conflict, follow this order of operations:
1. **LONG RUN ADHERENCE**: The specific Long Run day and distance/duration is Non-Negotiable.
2. **INJURY PREVENTION**: If an injury risk is high (based on history), reduce intensity, never volume.
3. **TRAINING PREFERENCES**: User habit patterns (e.g. days available).
4. **TRAINING VOLUME**: Hit the target volume via aerobic fillers if needed.
5. **AVAILABILITY (Use with Discretion):**
   - *Standard:* Adhere to "Available Days" strictly.
   - *Long Run Exception:* If ${params.longRunDayName} is NOT in Available Days, schedule the Long Run on ${params.longRunDayName} ANYWAY. The Long Run day is non-negotiable and overrides availability.
   - *Conflict Rule:* If the user is available for **>2 days LESS** than what is required to safely meet the Target Volume/Load, you MUST **IGNORE** the availability constraint.
   - *Reasoning:* It is unsafe to compress high volume into too few days. Schedule the necessary sessions to meet volume safely, even if it exceeds stated availability.

## 2. SCIENTIFIC LOGIC MODULES

### A. INTENSITY DISTRIBUTION
- **< 4h (Run) / < 6h (Bike):** **Pyramidal Model.** Focus on Sweet Spot/Tempo to compensate for low volume. (Target: 50%-60% Z1 / 40%-50% Z2+Z3).
- **4-7h (Run) / 6-12h (Bike):** **Hybrid Model.** Transition phase. (Target: 70% Z1 / 30% Z2+Z3).
- **> 7h (Run) / > 12h (Bike):** **Polarized Model.** Strict differentiation. (Target: 80% Z1 / 20% Z2+Z3).
- **No Gray Zone:** Avoid "Moderately Hard" (Zone 3) unless it is a specific "Tempo" block.


### B. STRENGTH & MOBILITY (Mandatory Context)
- **Why?** Strength training improves running economy (energy cost) and structural resilience. It is the primary defense against overuse injuries.
- **Protocol:**
  - **Base/Build:** **2x/week** (Heavy Resistance/Plyometrics).
  - **Peak:** **1x/week** (Maintenance/Activation).
  - **Race/Taper:** **0x/week** (Recovery).
  - *Placement:* PM after hard sessions (to keep hard days hard) or separate days. Never compromise the Long Run.


### C. RECOVERY PROTOCOL
- **Rest Days:** Minimum 1 full passive rest day per week, 2 for athletes over 45.
- **Post-Long Run:** The day after a Long Run must be Rest or Active Recovery (Short, Z1).
- **Recovery Weeks:** If the schedule (above) says "Recovery", reduce intensity significantly (No Z4/Z5). Trust the schedule's volume target.

## 3. ZONE DEFINITIONS (Detailed Mapping)
You MUST use this table to map the user's Friel Zones to modern scientific intensity.
**Instruction:** Focus on the 'Feeling' column to select the correct zone description for workouts.
**Note:** Friel Zone 5 is split into a, b, and c to allow for higher granularity in intervals.

| Friel Zone | Scientific | Cycling (% FTP) | Running Speed (% Threshold Speed) | Feeling |
| :--- | :--- | :--- | :--- | :--- |
| **1. Recovery** | Sci Z1 | < 55% | < 75% | Very Easy, can breathe through nose |
| **2. Aerobic** | Sci Z1 | 55% – 74% | 75% – 89% | Conversational, "All day" pace |
| **3. Tempo** | Sci Z2 | 75% – 89% | 90% – 95% | Comfortably Hard, requires focus |
| **4. Threshold** | Sci Z2 | 90% – 104% | 96% – 104% | Hard, sustainable for 30-60m |
| **5a. SuperThreshold** | Sci Z3 | 105% – 120% | 105% – 110% | Very Hard, gasping for air |
| **5b. Anaerobic**| Sci Z3 | 121% – 150% | 111% – 130% | Severe effort, finding limits |
| **5c. Sprint** | Sci Z3 | > 150% | > 130% | Max Effort, <30s |

${params.zones}

${progressionContext}

---

# WORKOUT GENERATION RULES

1. **LONG RUN / RIDE (Anchor Session)**
   - MUST be scheduled on **${params.longRunDayName}** (or nearest weekend day if unavailable).
   - Distance/Duration MUST match the target.

2. **VOLUME MATH (Detailed)**
   - **Total Volume** = Warmup + Main Set + Cooldown + Recovery + Long Run.
   - The sum of all CSV Distance columns MUST equal the Target Volume (± 2%).

3. **MINIMUM DURATION**
   - **Run:** Minimum 40 mins (unless Taper/Injury).
   - **Ride:** Minimum 60 mins.


   
4. **DESCRIPTION & TITLE**
   - Keep titles short (e.g. "Threshold 4x8'").
   - Do NOT write descriptions. The system parses them from "StepsString".

${continuityContext}

${sportInstructions}

${goalContext}

# INSPIRATION
${typeof WORKOUT_LIBRARY !== 'undefined' ? WORKOUT_LIBRARY : ""}

---

# OUTPUT FORMAT: VERIFICATION BLOCK + CSV
First: Output a Verification Block (lines starting with #).
Second: Output the Raw CSV.

## 1. VERIFICATION BLOCK (Mandatory - Output FIRST)
You MUST output this block FIRST. Do NOT output any CSV until all checks PASS.

**Step-by-Step Process:**
1. Plan all workouts mentally: List (Day, Type, Distance in km)
2. Confirm Long Run is on ${params.longRunDayName} with exact target distance
3. Sum distances: Workout1 + Workout2 + ... = Total km
4. Compare to Target Volume (must be ±5%)
5. Mark PASS/FAIL for each check
6. Only output CSV if ALL checks pass

**Format (one block per week):**
# WEEK [N] CHECK
# Long Run: Target=${isCycling ? '[X] hours' : '[X] km'} | Scheduled=${isCycling ? '[Y] hours' : '[Y] km'} | Day=${params.longRunDayName} | Status: [PASS/FAIL]
# Volume: Target=[X] ${isCycling ? 'TSS' : 'km'} | Scheduled=[Y] ${isCycling ? 'TSS' : 'km'} (math: workout1 + workout2 + ...) | Status: [PASS/FAIL] (±5%)
# Rest Days: Required=[X] | Scheduled=[Y] | Status: [PASS/FAIL]
# Post-Long Run: Day after ${params.longRunDayName}=[Rest/Easy] | Status: [PASS/FAIL]
(Repeat for all weeks)

## 2. CSV FORMAT (STRICT)
Output **ONLY** a raw CSV string. No JSON. No Markdown. No headers.

**CRITICAL UNIT CONVERSION:**
- All volume targets above are in KILOMETERS
- The Distance column in CSV must be in METERS
- **CONVERSION:** Target km × 1000 = Distance (meters)
- Example: Target Long Run 15 km → Output 15000 in Distance column

## COLUMNS
\`DayIndex, Type, Distance, Duration, Title, StepsString\`

1. **DayIndex**: Cumulative day from start of block (0 = Day 1 of Week 1, 7 = Day 1 of Week 2, etc).
2. **Type**: "Run", "Ride", "Rest", "Swim", "Gym".
   - *Note:* Use "Gym" for Strength/Mobility.
3. **Distance**: Integer (meters). 0 for Rest/Gym.
4. **Duration**: Integer (seconds). 0 for Rest.
5. **Title**: String. No commas.
6. **StepsString**: 
   - Format: \`Code~Duration(sec)~Intensity\`
   - Codes: \`w\` (Warmup), \`c\` (Cooldown), \`r\` (Run), \`rec\` (Recover).
   - Repeats: \`Nx(r~90~Z5+rec~90~Z1)\`

## EXAMPLES
# WEEK 1 CHECK
# Target Volume: 40 km | Actual Scheduled: 40.5 km | Status: PASS
# Target Long Run: 12 km | Actual Scheduled: 12 km | Status: PASS
# Rest Days Required: 2 | Actual Scheduled: 2 | Status: PASS
0,Run,10000,3600,Easy Run,r~3600~Z2
1,Gym,0,2700,Strength & Core,w~600~Mobility|r~2100~Strength
2,Rest,0,0,Rest Day,
3,Run,12000,4200,Threshold Intervals,w~900~Z1|5x(r~360~Z4+rec~120~Z1)|c~900~Z1

**FINAL CHECK:**
- Does the "Actual Scheduled" match the constraints?
- Did you schedule a REST DAY as required?
- Did you output the # Check lines?
`;
}

async function callOpenAI(prompt, indices) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.aiApiKey || state.openAIApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(60000)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }
        const data = await response.json();
        // [FIX] Return parsed data
        return processAIResponse(data.choices[0].message.content, indices, true);
    } catch (error) {
        hideAILoading();
        console.error("OpenAI Call Failed:", error);
        showToast(`❌ OpenAI Error: ${error.message}`);
        throw error; // Re-throw to stop execution
    }
}

async function callGeminiAPI(prompt, indices) {
    // Rate Limiting Check (Simple 1-minute window)
    if (!state._geminiRateLimit) state._geminiRateLimit = { count: 0, start: Date.now() };

    const RATE_LIMIT_RPM = 5; // Conservative limit for Pro model
    const now = Date.now();
    if (now - state._geminiRateLimit.start > 60000) {
        state._geminiRateLimit.count = 0;
        state._geminiRateLimit.start = now;
    }

    if (state._geminiRateLimit.count >= RATE_LIMIT_RPM) {
        const waitSec = 60 - Math.floor((now - state._geminiRateLimit.start) / 1000);
        showToast(`⚠️ Rate Limit: Please wait ${waitSec}s`);
        throw new Error(`Gemini Rate Limit Exceeded. Please wait ${waitSec} seconds.`);
    }

    state._geminiRateLimit.count++;

    try {
        const cleanKey = state.geminiApiKey ? state.geminiApiKey.trim() : "";
        // Switching to the requested Gemini 2.5 Flash model
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
            signal: AbortSignal.timeout(180000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = `API Error ${response.status}`;
            try {
                const errObj = JSON.parse(errorText);
                if (errObj.error && errObj.error.message) errorMsg = errObj.error.message;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            // [FIX] Return parsed data
            return processAIResponse(data.candidates[0].content.parts[0].text, indices, true);
        } else {
            throw new Error("No candidates returned from Gemini");
        }
    } catch (error) {
        hideAILoading();
        showToast(`❌ Gemini Error: ${error.message}`);
        throw error; // Re-throw to stop execution
    }
}

/**
 * Process AI response and optionally return data
 * @param {string} content 
 * @param {Array} indices 
 * @param {boolean} returnObject - If true, returns the parsed object instead of just rendering
 */
function processAIResponse(content, indices, returnObject = false) {
    try {
        console.log("AI Response Content (Raw):", content);

        // Strip markdown code blocks if present
        let cleanContent = content.replace(/```csv\n?|```/g, '').trim();

        // [WEEKLY NOTES] Extract notes from AI response
        // Format: NOTE_WEEK_N: Title - Description
        const noteRegex = /NOTE_WEEK_(\d+):\s*(.+)/g;
        let match;
        while ((match = noteRegex.exec(cleanContent)) !== null) {
            const weekNum = parseInt(match[1]);
            const noteText = match[2].trim();
            const weekIndex = weekNum - 1; // Convert to 0-based index

            if (!state.weeklyNotes) state.weeklyNotes = {};
            state.weeklyNotes[weekIndex] = {
                weekNum: weekNum,
                note: noteText,
                createdAt: new Date().toISOString()
            };
            console.log(`[Weekly Notes] Week ${weekNum}: ${noteText}`);
        }

        // [HYDRATION] Parse CSV using the global service
        if (!window.WorkoutHydrationService) {
            throw new Error("WorkoutHydrationService is not loaded.");
        }


        // [MANUAL DATE CALCULATION FIX]
        // Trusting `state.generatedPlan` for future weeks is risky if dates aren't initialized correctly.
        // We will ALWAYS anchor to Week 1 (Plan Start) and manually adjust the DayIndex if needed.

        // 1. Get Plan Start Date (Week 1)
        const planStartData = state.generatedPlan[0];
        if (!planStartData || !planStartData.startDate) throw new Error("Missing Plan Start Date");

        let planStartDate;
        if (planStartData.startDate.includes('T')) {
            planStartDate = new Date(planStartData.startDate);
        } else {
            planStartDate = new Date(planStartData.startDate + "T00:00:00");
        }
        if (isNaN(planStartDate.getTime())) throw new Error("Invalid Plan Start Date");

        // 2. Determine if AI output is Relative or Cumulative
        // [FIX] Filter out Comment Lines (starting with #) for Index Detection
        const dataLines = cleanContent.split('\n').filter(l => l.trim().length > 0 && !l.trim().startsWith('#'));
        const firstLine = dataLines[0];
        const firstIndex = firstLine ? parseInt(firstLine.split(',')[0]) : 0;

        const batchStartIndex = indices[0]; // e.g. 5 (Week 6)
        const expectedCumulativeStart = batchStartIndex * 7; // e.g. 35

        let offsetToAdd = 0;

        // If AI gives ~0 but we expect ~35, it's Relative. We must shift it manually.
        // Relaxed threshold: Check if firstIndex is significantly smaller than expected start
        if (firstIndex < (expectedCumulativeStart - 2)) {
            console.log(`[Hydration] Detected RELATIVE indexing. Manually shifting by ${expectedCumulativeStart} days.`);
            offsetToAdd = expectedCumulativeStart;
        } else {
            console.log(`[Hydration] Detected CUMULATIVE indexing. No shift needed.`);
            offsetToAdd = 0;
        }

        // 3. Hydrate with MANUAL offset
        // We pass the "raw" start date (Plan Start) to the service, 
        // BUT we need to tell the service to add `offsetToAdd` to every line?
        // Actually, `hydrateWeek` just does `startDate + dayIndex`.
        // So if we pass `PlanStart` and `DayIndex` is 0, we get Week 1.
        // We need to modify the CSV content OR pass a shifted Date?

        // EASIEST: If we need to add 35 days, just pass `PlanStart + 35 days` as the anchor!
        // Wait, if AI output is MIXED (rare/impossible), this fails.
        // Assumption: AI output is consistent within a batch.

        // If output is Relative (0..27), we pass `PlanStart + Offset`. 
        // Then `0` becomes `PlanStart + Offset`. Correct.

        // If output is Cumulative (35..62), we pass `PlanStart`.
        // Then `35` becomes `PlanStart + 35`. Correct.

        // DEBUG LOGGING
        console.log(`[Hydration Debug] Plan Start Date (Raw):`, planStartData.startDate);
        console.log(`[Hydration Debug] Plan Start Date (Obj):`, planStartDate.toISOString());
        console.log(`[Hydration Debug] Indices: ${indices}, BatchStart: ${batchStartIndex}, ExpCumulative: ${expectedCumulativeStart}`);
        console.log(`[Hydration Debug] First Index found in CSV: ${firstIndex}`);
        console.log(`[Hydration Debug] Offset To Add: ${offsetToAdd}`);

        let anchorDate = new Date(planStartDate);
        console.log(`[Hydration Debug] Anchor Pre-Shift: ${anchorDate.toISOString()}`);

        if (offsetToAdd > 0) {
            anchorDate.setDate(anchorDate.getDate() + offsetToAdd);
        }

        console.log(`[Hydration Debug] Anchor Post-Shift: ${anchorDate.toISOString()}`);

        const hydratedWeek = window.WorkoutHydrationService.hydrateWeek(cleanContent, anchorDate);

        // Special Case: If using Relative Indexing for multiple weeks, `hydrateWeek` will create dates
        // starting from `blockStartDate`. This works fine if the AI outputs DayIndex 0-27.
        // But if AI outputs 0-6 repeatedly for each week (resetting), we might have collisions/overwrites 
        // if we processed them linearly.
        // HOWEVER, the `DayIndex` column is the *only* thing `hydrateWeek` uses.
        // If AI outputs: 
        // 0... (Week 6)
        // 7... (Week 7) 
        // Then `hydrateWeek` adds 7 days to `blockStartDate` (Week 6 start). -> Correctly lands in Week 7.

        // If AI reset to 0 for Week 7?
        // 0... (Week 7 block?) -> NO, CSV string is one block. 
        // If CSV has duplicate 0s, `hydrateWeek` will produce duplicate dates.
        // We assume AI is smart enough to count 0-27 if asked for a batch, OR 35-63.
        // The check above handles the starting offset shift.

        // Map the single hydrated week to the target indices
        // Note: The compressed format currently outputs ONE week (7 days). 
        // If we are batching multiple weeks, the AI should have outputted multiple chunks or strict day indices.
        // CURRENT PROMPT asks for 7 lines (0-6). This implies it generates ONE week at a time or we need to handle DayIndex > 6.
        // The Prompt says "0=Monday...6=Sunday".

        // If the prompt was built for multiple weeks, the AI might output lines for Week 1 (0-6) and Week 2 (0-6) separated? 
        // OR the prompts are sent one by one?
        // Checking `preparePlanWithAI`: It loops batches. 
        // If batch size > 1, prompt includes multiple weeks.
        // I need to update the prompt to be clear about DayIndex if multiple weeks. 
        // OR simpler: strictly generate one week at a time for now to ensure this new format works safely.
        // The CSV logic `0,Run...` maps to `blockStartDate + 0 days`.
        // If we prompt for Week 2, `blockStartDate` should be Week 2's start.

        // Let's look at `_generateBatch`. It sends a prompt with `params.weeks`.
        // If `weeks` has multiple items, the AI needs to know how to index them.
        // The current prompt says: "One line per day. 7 lines total." -> This implies SINGLE WEEK generation per prompt.
        // BUT `preparePlanWithAI` sets chunk size to 4.

        // [CRITICAL ADJUSTMENT]:
        // If we want to support batches, we must tell AI to output continuous DayIndices (0-27) OR grouped by week?
        // The simplest fix for "Small Token Amount" is to actully stick to 1 week per prompt OR 
        // Update the prompt to say "DayIndex: 0-6 for Week 1, 7-13 for Week 2 etc" is risky.
        // BETTER: "WeekNumber, DayIndex (0-6), ..."

        // HOWEVER, to satisfy the user request immediately with the defined `hydrateWeek` (which reads 0-6),
        // I should treat the response as corresponding to the weeks requested.
        // If `hydratedWeek` has say 28 items, `hydrateWeek` logic `blockStartDate + dayIndex` works IF dayIndex goes up to 27.
        // My `hydrateWeek` implementation: `workoutDate.setDate(blockStartDate.getDate() + dayIndex)`.
        // YES, it supports DayIndex > 6 safely.

        // SO, I must update PROMPT to say "DayIndex: Cumulative from start of block (0 = Day 1 of Week 1)".
        // OR, handle the mapping here.

        // Let's stick to the Hydration Service logic. It returns a flat array of workouts.
        // We need to group them back into weeks for the `state.generatedWorkouts` structure.

        const results = [];

        // Group by week
        // We iterate through the hydrated workouts and assign them to the correct week index
        hydratedWeek.forEach((workout, i) => {
            // Find which week this workout belongs to based on date
            const wDate = new Date(workout.date);

            // Calculate difference in whole days
            // Use UTC to avoid DST handling issues approx, or just round?
            // Since we anchored both to simple dates, mismatch in hours shouldn't affect Day diff if we round.

            const diffTime = wDate.getTime() - planStartDate.getTime();
            const diffDays = Math.round(diffTime / msPerDay);

            const weekIndex = Math.floor(diffDays / 7);

            // Check if this weekIndex is one of the ones we requested
            if (indices.includes(weekIndex)) {
                if (!state.generatedWorkouts[weekIndex]) state.generatedWorkouts[weekIndex] = [];

                // Ensure result structure exists
                let resultItem = results.find(r => r.weekIndex === weekIndex);
                if (!resultItem) {
                    // Start date for this result is PlanStart + weekIndex*7
                    const resultDate = new Date(planStartDate);
                    resultDate.setDate(resultDate.getDate() + (weekIndex * 7));

                    resultItem = {
                        weekIndex: weekIndex,
                        weekNumber: weekIndex + 1, // 0-based index -> 1-based Label
                        workouts: [],
                        startDate: resultDate.toISOString() // Explicitly provide correct date
                    };
                    results.push(resultItem);
                }

                // Add workout
                // Update generatedWorkouts State
                state.generatedWorkouts[weekIndex].push(workout);

                // Add to Result Array (for UI render)
                // Avoid duplicates in result array if logic runs multiple times (it shouldn't)
                resultItem.workouts.push(workout);
            }
        });

        // Store in State for all processed weeks
        results.forEach(res => {
            state.generatedWorkouts[res.weekIndex] = res.workouts;

            // Update UI (only if function exists)
            const availability = state.weeklyAvailability[res.weekIndex] || state.defaultAvailableDays;
            if (typeof renderAIWorkouts === 'function') {
                renderAIWorkouts(res.weekIndex, res.workouts, availability);
            }
        });

        if (returnObject) return results;

        hideAILoading();
        showToast("✅ AI Workout Plan Generated!");

    } catch (e) {
        console.error("Parse Error:", e);
        if (!returnObject) {
            hideAILoading();
            showToast("❌ Failed to parse AI response.");
        }
        throw e;
    }
}

function getLast4WeeksSummary() {
    if (!state.activities || state.activities.length === 0) return "No recent activity data available.";
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);

    const weeklyData = {};
    state.activities.forEach(act => {
        if (['Run', 'Ride', 'VirtualRide'].includes(act.type)) {
            const actDate = new Date(act.start_date_local);
            if (actDate >= fourWeeksAgo && actDate <= now) {
                const weekKey = `${actDate.getFullYear()}-W${getWeekNumber(actDate)}`;
                if (!weeklyData[weekKey]) weeklyData[weekKey] = { totalKm: 0, totalSeconds: 0, runs: [] };

                const km = (act.distance || 0) / 1000;
                weeklyData[weekKey].totalKm += km;
                weeklyData[weekKey].totalSeconds += (act.moving_time || 0);
                weeklyData[weekKey].runs.push({ day: actDate.getDay() });
            }
        }
    });

    let summary = "Last 4 weeks activity:\n";
    Object.keys(weeklyData).sort().forEach(week => {
        const data = weeklyData[week];
        const hours = (data.totalSeconds / 3600).toFixed(1);
        summary += `${week}: ${hours}h (${data.totalKm.toFixed(1)}km) over ${data.runs.length} sessions\n`;
    });
    return summary;
}

function getZonePaceStrings() {
    if (!state.lthrPace) return "Lactate Threshold Pace: Not synced.";
    let zStr = `Lactate Threshold Pace: ${state.lthrPace}\n`;
    if (state.lthrBpm) zStr += `Lactate Threshold HR: ${state.lthrBpm} bpm\n`;
    return zStr;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / msPerDay) + 1) / 7);
}