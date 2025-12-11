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
        lastWeekSummary: lastWeekSummary
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
                    { role: "system", content: "You are an expert endurance coach. You output ONLY valid JSON." },
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
                    { role: "system", content: "You are an expert endurance coach. You output ONLY valid JSON." },
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
                    { role: "system", content: "You are an expert endurance coach. You output ONLY valid JSON." },
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
    // 2. CALCULATE DERIVED METRICS (See Hoisted Section Above)
    // -------------------------------------------------------------------------
    // basePace is defined at top of function

    // -------------------------------------------------------------------------
    // 3. CONTEXTS
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
You are an elite endurance sports physiologist and coach. Your goal is to generate a highly specific, periodized training week for a user based on their unique physiological profile, constraints, and the scientific principles of Polarized (80/20) and Pyramidal training.

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
7. **Gym Access:** ${params.preferences}
8. **Training Preferences:** ${params.preferences}
9. **Race Date/Goal:** ${params.goalAssessment ? `Target: ${params.goalTime} on ${params.raceDate}` : "General Fitness"}

# BLOCK SCHEDULE (CRITICAL INSTRUCTIONS)
Create workouts for the following weeks. STRICTLY follow the volume and long run targets for EACH specific week.

${params.weeks.map(w => `
Week: ${w.weekNumber} (${w.blockPosition})
- Target Volume: ${isCycling ? w.targetTSS + " TSS" : w.targetDistance + " km"}
- Target TSS: ${w.targetTSS || 0}
- Target Long Run: ${w.targetLong} ${isCycling ? "hours" : "km"}
- Long Run Preferred Day: ${params.longRunDayName}
- Available Days: ${w.availableDays}
- Primary Focus: ${w.focus}
`).join('\n')}


# SCIENTIFIC LOGIC MODULES

## 1. INTENSITY DISTRIBUTION ALGORITHM
Select the distribution model based on *Weekly Volume*:
- **< 4h (Run) / < 6h (Bike):** **Pyramidal Model.** Focus on Sweet Spot/Tempo to compensate for low volume. (Target: 50%-60% Z1 / 40%-50% Z2+Z3).
- **4-7h (Run) / 6-12h (Bike):** **Hybrid Model.** Transition phase. (Target: 70% Z1 / 30% Z2+Z3).
- **> 7h (Run) / > 12h (Bike):** **Polarized Model.** Strict differentiation. (Target: 80% Z1 / 20% Z2+Z3).

## 2. CONCURRENT TRAINING (GYM) RULES
- **Placement:** Place strength sessions on the *same day* as Hard/Interval sessions (after the cardio) or on days with short aerobic rides.
- **Avoid:** Do NOT place heavy leg days on strict Rest Days. Rest days must be passive recovery.

## 3. RECOVERY MODIFIERS (Age/History)
- **Masters (45+):** Ensure at least 2 full rest days per week. Long intervals should have longer rest ratios (1:1).
- **Beginner (<1 year):** Cap high intensity at 1 session per week.

### SYSTEM CONTEXT: ENDURANCE TRAINING ZONE STANDARDS
You must strictly adhere to the specific zone definitions provided below using the "Friel-to-Scientific" mapping.

#### 1. ZONE MAPPING LOGIC (HIERARCHY)
* **SCIENTIFIC ZONE 1 (Low Intensity)**
    * **Friel Zones:** Zone 1 (Recovery) AND Zone 2 (Aerobic).
    * **Guidance:** Easy, conversational.
* **SCIENTIFIC ZONE 2 (Moderate Intensity)**
    * **Friel Zones:** Zone 3 (Tempo) AND Zone 4 (Sub-Threshold/Threshold).
    * **Guidance:** "Comfortably hard."
* **SCIENTIFIC ZONE 3 (High Intensity)**
    * **Friel Zones:** Zone 5a (SuperThreshold), Zone 5b (Anaerobic Capacity), Zone 5c (Sprint).
    * **Guidance:** Non-steady state.

#### 2. REFERENCE DATA: INTENSITY RANGES
* **FTP (Cycling):** % of FTP.

| Friel Zone | Scientific | Cycling (% FTP) | Running Speed (% Threshold Speed) |
| :--- | :--- | :--- | :--- |
| **1. Recovery** | Sci Z1 | < 55% | < 75% |
| **2. Aerobic** | Sci Z1 | 55% – 74% | 75% – 89% |
| **3. Tempo** | Sci Z2 | 75% – 89% | 90% – 95% |
| **4. Threshold** | Sci Z2 | 90% – 104% | 96% – 104% |
| **5a. SuperThreshold** | Sci Z3 | 105% – 120% | 105% – 110% |
| **5b. Anaerobic**| Sci Z3 | 121% – 150% | 111% – 130% |
| **5c. Sprint** | Sci Z3 | > 150% | > 130% |

${params.zones}

${progressionContext}

# INSTRUCTIONS
1. **GOLDEN RULE: LONG RUN / RIDE ADHERENCE**:
   - **MANDATORY DAY**: You MUST schedule the "Long Run" / "Long Ride" on **${params.longRunDayName}**.
   - If ${params.longRunDayName} is NOT available in "Availability", you MUST move it to the closest available day, but prefer the Weekend, Saturday or Sunday.
   - **TARGET DURATION/DISTANCE**: It MUST be approx **${firstWeek.targetLong} ${isCycling ? 'hours' : 'km'}**.
   - **PRIORITY**: This is the most important session. Schedule this first.

2. **GOLDEN RULE: VOLUME & MATH CHECK**:
   - **TOTAL VOLUME**: The sum of all workout distances MUST strictly equal **${isCycling ? firstWeek.targetTSS : firstWeek.targetDistance}** (± 5%).
   - **DURATION CALCULATION (CRITICAL)**: 
     - **PRIORITIZE DURATION**: Calculate specific duration based on Pace.
     - Formula: Duration (sec) = Distance (m) / Speed (m/s).
     - **BASE AEROBIC PACE**: Use **${basePace}** for ALL easy/recovery runs.
     - **EXAMPLE**: 
        - Goal: 10km Easy Run. 
        - Base Pace: 5:00/km.
        - Duration: 50 minutes (3000s).
     - **ERROR PREVENTION**: Do NOT produce a "10km run" with "duration: 1800" (30mins). That is impossible. 
     - **Constraint**: The AI output MUST specify realistic durations for the assigned distances.

3. **AVAILABILITY vs TRAINING (Mon-Sun)**:
   - You MUST generate a JSON object for **EVERY DAY** of the week (Mon-Sun).
   - If a day is NOT listed in "Availability", you must generate a \`{ "type": "Rest" }\` object.
   - If a day *is* listed in "Availability" but you do not schedule the main sport (${isCycling ? "Ride" : "Run"}), you MUST schedule one of: Rest, Strength, Yoga, or Cross Training.
   - **Rest Days**: At least 1 full **passive** Rest day per week (no Strength or Cross Training).

4. **RECOVERY PROTOCOL (STRICT)**:
   - **Ideal Scenario**: After a Long Run or Key Interval session, the next day should be a **Rest Day**.
   - **Availability Exception**: If the user's "Availability" does not allow for a Rest Day (e.g., they only have 3 consecutive days), you MUST schedule an **Active Recovery** session (Zone 1, Short Duration) instead of a Rest Day.
   - **Rule**: Never schedule two "Hard" (Interval/Long) sessions back-to-back. Always buffer with Rest or Active Recovery.
   - **EXCEPTION**: If weekly volume is very high or available time is limited, workouts can be scheduled, but prefer easy **Active Recovery** sessions.

5. **MINIMUM SESSION LENGTH (STRICT)**:
   - Cycling sessions ("type": "Ride") must be **≥ 45 minutes**, unless explicitly a short recovery ride.
   - Running sessions ("type": "Run") must be **≥ 40 minutes**.
   - **FORBIDDEN**: Do NOT schedule runs of 20, 25, or 30 minutes unless the user is injured or explicitly tapering. Even "easy" runs should be 40-45 mins minimum.

6. **STRENGTH & CORE TRAINING**:
   - Check "gymFocus". If it says "2 sessions", you MUST schedule at least 2 sessions.
   - **COMBINABILITY**: You CAN combine short runs with Core/Strength (e.g., "Run + Core").
   - **VARIETY**: Use "Strength", "Core", "Pilates", or "Mobility" based on the phase.
   - Place Strength on the same day as hard intervals (later in the day) or on short aerobic days.

7. **PROGRESSIVE OVERLOAD (CRITICAL)**:
   - Every week should contian at least 1 interval session. These should increase in either reps or duration. So if Week 1 had 3x8min, Week 2 must have 4x8min or 3x10min and week 3 must have 5x8min or 4x10min, continue this pattern for subsequent weeks.
   - **NEVER REGRESS**: Do not drop reps or duration in Week 3 unless it is explicitly a "Recovery Week".
   - Review the "PROGRESSION HISTORY" above and ensure step-up.

${continuityContext}
7. **DESCRIPTIONS (UI vs EXPORT)**:
   - **description_ui**: Must be a human-readable SUMMARY (e.g., "Intervals: 5x1km @ Threshold"). Do not just say "Intervals".
   - **description_export**: Must be the exact structured text for Intervals.icu (Warmup, Main Set, Cooldown).
   - **consistency**: The UI summary must match the content of the Export description.
8. **STRUCTURED WORKOUTS**: You must provide a "steps" array for each workout.
   - Every workout MUST have a "steps" array.
   - Steps MUST include: "type", and either "duration" OR "distance", plus "intensity".

${sportInstructions}
${goalContext}

# INSPIRATION LIBRARY
Use the following examples as structural inspiration. Adapt intensity and duration to the specific user constraints above.
${typeof WORKOUT_LIBRARY !== 'undefined' ? WORKOUT_LIBRARY : "No library available."}

DATE HANDLING:
- You MUST use "start_date_local" for every workout (Mon-Sun).
- Format: "YYYY-MM-DDTHH:MM:SS" (T06:00:00).
- Use "weekStartDate" provided in context.

WEEKS TO PLAN:
${JSON.stringify(params.weeks, null, 2)}

383: OUTPUT JSON FORMAT ONLY:
384: {
385:   "weeks": [
386:     {
387:       "weekNumber": ${firstWeek.weekNumber},
388:       "workouts": [
389:         {
390:           "start_date_local": "2025-12-01T06:00:00",
391:           "type": "${isCycling ? "Ride" : "Run"}",
392:           "title": "${isCycling ? "Endurance + Spin-ups" : "Intervals"}",
393:           "description_export": "Warmup...",
394:           "distance": 8000,
395:           "duration": 3600,
396:           "steps": [
397:              { "type": "Warmup", "duration": 600, "intensity": "60-70% ${isCycling ? "" : "Pace"}", "press_lap": true },
             {
               "reps": 4,
               "steps": [
                 { "type": "${isCycling ? "Ride" : "Run"}", "duration": 120, "intensity": "105% ${isCycling ? "" : "Pace"}" },
                 { "type": "Recover", "duration": 120, "intensity": "60% ${isCycling ? "" : "Pace"}" }
               ]
             },
             { "type": "Cooldown", "duration": 600, "intensity": "50-60% ${isCycling ? "" : "Pace"}" }
          ]
407:         },
408:         {
409:           "start_date_local": "2025-12-02T06:00:00",
410:           "type": "Rest",
411:           "title": "Rest Day",
412:           "description_ui": "Passive Recovery or Mobility",
413:           "description_export": "Rest Day",
414:           "steps": []
415:         }
416:       ]
417:     }
418:   ]
419: }
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
                    { role: "system", content: "You are an expert endurance coach. You output ONLY valid JSON." },
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
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    response_mime_type: "application/json"
                }
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
        console.log("AI Response Content:", content);
        let cleanContent = content.replace(/```json\n?|```/g, '').trim();

        // Aggressive JSON extraction
        const firstBrace = cleanContent.indexOf('{');
        const lastBrace = cleanContent.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
            cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
        }

        let data;
        try {
            data = JSON.parse(cleanContent);
        } catch (e) {
            throw new Error(`JSON Syntax Error: ${e.message}`);
        }

        // Handle array vs object responses
        let weeksData = [];
        if (data.weeks) {
            weeksData = Array.isArray(data.weeks) ? data.weeks : Object.values(data.weeks);
        } else if (data.workouts) {
            const weekNum = state.generatedPlan[indices[0]].week;
            weeksData = [{ weekNumber: weekNum, workouts: data.workouts }];
        } else {
            throw new Error("Invalid JSON structure");
        }

        const results = [];
        weeksData.forEach((weekData, i) => {
            let targetIndex = indices.find(idx => state.generatedPlan[idx].week == weekData.weekNumber);
            if (targetIndex === undefined && i < indices.length) targetIndex = indices[i];

            if (targetIndex !== undefined) {
                // Date Safeguard
                const planWeek = state.generatedPlan[targetIndex];
                if (weekData.workouts && weekData.workouts.length > 0) {
                    weekData.workouts.forEach(workout => {
                        if (!workout.start_date_local && planWeek.startDate) {
                            workout.start_date_local = planWeek.startDate + "T06:00:00";
                        }
                    });
                }

                // Store in State
                state.generatedWorkouts[targetIndex] = weekData.workouts;
                results.push({ weekNumber: weekData.weekNumber, workouts: weekData.workouts });

                // Update UI (only if function exists)
                const availability = state.weeklyAvailability[targetIndex] || state.defaultAvailableDays;
                if (typeof renderAIWorkouts === 'function') {
                    renderAIWorkouts(targetIndex, weekData.workouts, availability);
                }
            }
        });

        // If part of a loop, return the data to the caller
        if (returnObject) return results;

        // Only show success toast if NOT in a loop
        if (!returnObject) {
            hideAILoading();
            showToast("✅ AI Workout Plan Generated!");
        }

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
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}