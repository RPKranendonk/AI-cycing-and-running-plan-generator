// ==========================================
// AI PROMPT BUILDER
// Constructs the AI prompt for workout generation
// ==========================================

/**
 * Builds the complete AI workout prompt
 * @param {Object} params - Parameters for prompt construction
 * @returns {string} The complete prompt string
 */
function buildAIWorkoutPrompt(params) {
    const isBlock = params.scope === 'block';
    const firstWeek = params.weeks[0];
    const sport = params.sportType || "Running";
    const isCycling = sport === "Cycling";

    // -------------------------------------------------------------------------
    // 0. CALCULATE DERIVED METRICS
    // -------------------------------------------------------------------------
    const basePace = calculateBasePace(params.ltRunningPace, isCycling);

    // -------------------------------------------------------------------------
    // 1. SPORT SPECIFIC SYNTAX & LOGIC
    // -------------------------------------------------------------------------
    const sportInstructions = isCycling
        ? buildCyclingInstructions(firstWeek)
        : buildRunningInstructions(basePace, params.ltRunningPace);

    // -------------------------------------------------------------------------
    // 2. CONTEXTS
    // -------------------------------------------------------------------------
    const goalContext = buildGoalContext(params.goalAssessment);
    const progressionContext = buildProgressionContext(params.progressionHistory);
    const continuityContext = buildContinuityContext(params.lastWeekSummary);

    // [NEW] Regeneration Feedback
    const feedbackContext = buildFeedbackContext(params.regenerationFeedback, params.weeks);

    // -------------------------------------------------------------------------
    // 3. MAIN PROMPT
    // -------------------------------------------------------------------------
    return buildMainPrompt({
        sport,
        isCycling,
        params,
        basePace,
        sportInstructions,
        goalContext,
        progressionContext,
        continuityContext,
        feedbackContext
    });
}

/**
 * Calculate base aerobic pace from threshold pace
 */
function calculateBasePace(ltRunningPace, isCycling) {
    if (isCycling || !ltRunningPace) return "5:30/km";

    const cleanPace = ltRunningPace.replace('/km', '').trim();
    if (!cleanPace.includes(':')) return "5:30/km";

    try {
        const [m, s] = cleanPace.split(':').map(Number);
        const thresholdSec = (m * 60) + s;
        const baseSec = Math.round(thresholdSec * 1.25);
        const bm = Math.floor(baseSec / 60);
        const bs = baseSec % 60;
        return `${bm}:${bs.toString().padStart(2, '0')}/km`;
    } catch (e) {
        console.warn("Could not calculate base pace, using default");
        return "5:30/km";
    }
}

/**
 * Build cycling-specific instructions
 */
function buildCyclingInstructions(firstWeek) {
    return `
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
}

/**
 * Build running-specific instructions
 */
function buildRunningInstructions(basePace, ltRunningPace) {
    return `
### 7. RUNNING SPECIFIC RULES & SYNTAX
**A. THE "BASE PACE" ANCHOR (CRITICAL MATH)**
- You have been provided a calculated **Base Aerobic Pace: ${basePace}**.
- **RULE:** Use this ${basePace} to calculate the Duration for ALL Warmups, Cooldowns, Recovery Runs, and Long Runs.
- **DO NOT** use the user's Threshold pace (${ltRunningPace}) to calculate duration for easy miles.
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

/**
 * Build goal assessment context
 */
function buildGoalContext(goalAssessment) {
    if (!goalAssessment) return "";

    return `
GOAL ASSESSMENT (Athlete Context):
- **Feasibility:** ${goalAssessment.timeStatus} (${goalAssessment.timeMessage})
- **Difficulty Rating:** ${goalAssessment.difficulty}
- **Recommended Training Frequency:** ${goalAssessment.minDays} sessions/week 
- **Coach Warnings:** ${goalAssessment.warnings.join('; ')}
`;
}

/**
 * Build progression history context
 */
function buildProgressionContext(progressionHistory) {
    if (!progressionHistory || progressionHistory.length === 0) return "";

    return `
# PROGRESSION HISTORY (PREVIOUS WEEKS)
Use this history to ensure PROGRESSIVE OVERLOAD. 
- If Week 1 had 3x8min intervals, Week 2 should have 4x8min or 3x10min.
- Do NOT repeat the exact same key workout. Make it slightly harder.

${JSON.stringify(progressionHistory, null, 2)}

# VARIATION INSTRUCTION (CRITICAL)
- **DO NOT** simply copy-paste workouts from Week to Week.
- **CHANGE THE STIMULUS:**
  - If Week 1 is "4x8min Threshold", Week 2 MUST be different (e.g., "5x8min" or "3x12min").
  - If Week 1 Long Run is Flat, suggest "Rolling Hills" for Week 2.
- **AVOID MONOTONY:** The athlete will get bored if every Tuesday is identical. VARY the interval structures.
`;
}

/**
 * Build continuity context from last week
 */
function buildContinuityContext(lastWeekSummary) {
    if (!lastWeekSummary) return "";

    return `
# CONTINUITY CHECK (CRITICAL)
The previous week ended on ${lastWeekSummary.date} (${lastWeekSummary.title}).
${lastWeekSummary.isLongRun ? "**CRITICAL:** The last day was a LONG RUN. Therefore, Monday of the next week MUST be a REST DAY or very short Active Recovery (Z1)." : ""}
`;
}

/**
 * Build daily availability display for the AI prompt
 */
function buildDailyAvailabilityDisplay(dailyAvailability) {
    if (!dailyAvailability || Object.keys(dailyAvailability).length === 0) {
        return "   - No specific availability data provided.";
    }

    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    let lines = [];
    let totalHours = 0;
    let splitDays = [];
    let restDays = [];
    let availableDays = [];

    dayOrder.forEach(d => {
        const dayData = dailyAvailability[d];
        if (!dayData) return;

        const hours = dayData.hours || 0;
        totalHours += hours;

        if (hours === 0) {
            lines.push(`   - ${dayNames[d]}: ⛔ **MANDATORY REST** (0h available) → Output REST row`);
            restDays.push(dayNames[d]);
        } else if (dayData.split) {
            lines.push(`   - ${dayNames[d]}: ${hours}h total (☀️ Morning: ${dayData.amHours}h + 🌙 Evening: ${dayData.pmHours}h) **[DUAL SESSION OPTION]**`);
            splitDays.push(dayNames[d]);
            availableDays.push(dayNames[d]);
        } else {
            lines.push(`   - ${dayNames[d]}: ${hours}h`);
            availableDays.push(dayNames[d]);
        }
    });

    lines.push(`   **Weekly Training Time Budget: ${totalHours.toFixed(1)}h**`);

    // Explicitly list REST days
    if (restDays.length > 0) {
        lines.push(`   ⚠️ **MANDATORY REST DAYS: ${restDays.join(', ')}** - You MUST output a REST row for each of these days in the CSV.`);
    }

    // Explicitly list available days
    if (availableDays.length > 0) {
        lines.push(`   ✅ **AVAILABLE FOR TRAINING: ${availableDays.join(', ')}** - Schedule workouts ONLY on these days.`);
    }

    if (splitDays.length > 0) {
        lines.push(`   **Split Session Option:** ${splitDays.join(', ')}`);
        lines.push(`     - **RULE:** ONLY split if: (a) weekly volume > 70km, OR (b) combining DIFFERENT types (Gym+Run, Yoga+Run).`);
        lines.push(`     - **PREFERENCE:** If total daily availability <= 2 hours, KEEP IT AS ONE SESSION (don't split short blocks).`);
    }

    return lines.join('\n');
}

/**
 * Build compact availability display for a specific week in the block schedule
 * Shows each day with Morning/Evening breakdown
 */
function buildWeekAvailabilityCompact(dailyAvailability) {
    if (!dailyAvailability || Object.keys(dailyAvailability).length === 0) {
        return "  (No specific availability data)";
    }

    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayNamesLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    let lines = [];
    let blockedDays = [];
    let availableDays = [];

    dayOrder.forEach(d => {
        const dayData = dailyAvailability[d];
        if (!dayData) return;

        const hours = dayData.hours || 0;
        if (hours === 0) {
            lines.push(`  - ${dayNames[d]}: ⛔ REST (BLOCKED - NO WORKOUTS ALLOWED)`);
            blockedDays.push(dayNamesLong[d]);
        } else if (dayData.split) {
            lines.push(`  - ${dayNames[d]}: ☀️${dayData.amHours}h Morning + 🌙${dayData.pmHours}h Evening`);
            availableDays.push(dayNamesLong[d]);
        } else {
            lines.push(`  - ${dayNames[d]}: ${hours}h`);
            availableDays.push(dayNamesLong[d]);
        }
    });

    // Add explicit block for CRITICAL emphasis
    let result = lines.join('\n');

    if (blockedDays.length > 0) {
        result += `\n  **🚫 BLOCKED DAYS (CANNOT SCHEDULE ANY WORKOUTS):** ${blockedDays.join(', ')}`;
        result += `\n  **✅ AVAILABLE DAYS (CAN SCHEDULE WORKOUTS):** ${availableDays.join(', ')}`;
        result += `\n  **⚠️ CRITICAL:** If you schedule ANY workout on ${blockedDays.join(' or ')}, YOUR PLAN IS INVALID.`;
    }

    return result;
}

/**
 * Build explicit date mapping for each day of a week
 * This eliminates AI confusion about day indices
 */
function buildWeekDatesDisplay(weekStartDate, dailyAvailability) {
    if (!weekStartDate) return "  (No date data)";

    const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun order
    const dayNamesLong = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Parse the week start date - assume it's a Monday
    const startDate = new Date(weekStartDate + "T12:00:00");
    if (isNaN(startDate.getTime())) return "  (Invalid date)";

    let lines = [];

    dayOrder.forEach((dayNum, idx) => {
        // Calculate date for this day (Mon=0, Tue=1, ..., Sun=6 in our loop)
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + idx);

        const dateStr = dayDate.toISOString().split('T')[0]; // YYYY-MM-DD format
        const dayName = dayNamesLong[dayNum];

        // Check availability
        const dayData = dailyAvailability?.[dayNum];
        const isBlocked = !dayData || dayData.hours === 0;
        const status = isBlocked ? "❌ REST" : "✅ AVAILABLE";

        lines.push(`  ${dayName}: ${dateStr} → ${status}`);
    });

    return lines.join('\n');
}

/**
 * Build the main prompt body
 */
function buildMainPrompt({ sport, isCycling, params, basePace, sportInstructions, goalContext, progressionContext, continuityContext, feedbackContext }) {
    // Calculate Block Start Day Name
    let blockStartMap = "";
    if (params.weeks && params.weeks[0] && params.weeks[0].startDate) {
        const startStr = params.weeks[0].startDate;
        // Parse safely as local date (midday to avoid timezone shifts)
        const d = new Date(startStr + "T12:00:00");
        if (!isNaN(d.getTime())) {
            const startDayName = d.toLocaleDateString('en-US', { weekday: 'long' });

            // Create a temporary date object to calculate the next day's name
            const nextDayDate = new Date(d);
            nextDayDate.setDate(d.getDate() + 1);
            const nextDayName = nextDayDate.toLocaleDateString('en-US', { weekday: 'long' });

            blockStartMap = `
11. **CALENDAR ANCHOR (CRITICAL):**
    - **Block Start Date:** ${startStr}
    - **DayIndex 0 corresponds to:** **${startDayName}**
    - **DayIndex Mapping:**
      - DayIndex 0, 7, 14, 21 = ${startDayName}
      - DayIndex 1, 8, 15, 22 = ${nextDayName}
      - ... and so on.
    - **RULE:** You MUST verify that your DayIndex aligns with the user's availability for that specific day name.
`;
        }
    }

    return `
# ROLE & OBJECTIVE
You are an **Elite Endurance Sports Physiologist & Sports Psychologist**.
Your training philosophy is grounded in the **Norwegian Method** (High Volume, Controlled Intensity, Double Thresholds), **Polarized Training** and **Pyramidal Training** for athletes with less time.
You believe in a **Holistic Approach**: Strength, Mobility, and Rest are not "optional add-ons" but **integral performance multipliers**.
Your goal is to generate a highly specific, periodized workout schedule that respects the user's physiology while pushing for optimal adaptation.

${feedbackContext || ""}

# INPUT VARIABLES
1. **Sport:** ${sport}
2. **Age & Gender:** ${params.age || 'N/A'}, ${params.gender || 'N/A'}
3. **Training History:** ${params.athleteHistory}
4. **Recent Volume (Last 4 weeks):** ${params.last4Weeks}
5. **Fitness Metrics:**
   - FTP: ${params.ftp || 'Not set'}
   - LTHR Pace (Threshold): ${params.ltRunningPace || 'Not set'}
   - **BASE AEROBIC PACE: ${basePace}** ← USE THIS for Easy/Long Run duration calculations
   - LTHR BPM: ${params.lthrBpm || 'Not set'}
6. **Injury Profile:** ${params.injuries}
   - *CRITICAL:* If injuries are present, REDUCE high-impact intensity and Prioritize consistency over peak load.
7. **Gym Access:** ${params.gymAccess || params.preferences}
   - *CONTEXT:* Strength training is ESSENTIAL for running economy and injury prevention. It is NOT optional.
8. **Training Preferences (USER OVERRIDES):** ${params.preferences}
   - **⚠️ USER PREFERENCES ALWAYS TAKE PRIORITY** over general rules (e.g., if user prefers Friday gym, allow it even if it conflicts with 48h pre-Long Run rule).
9. **Race Date/Goal:** ${params.goalAssessment ? `Target: ${params.goalTime} on ${params.raceDate}` : "General Fitness"}
10. **Daily Time Availability:**
${buildDailyAvailabilityDisplay(params.dailyAvailability)}
${blockStartMap}

# PLAN CONTEXT (READ THIS CAREFULLY)
The following plan was calculated using proven training science principles. **Do NOT deviate from these targets.** Your role is to fill in the DETAILS (workout structure, pacing), not to change the VOLUME or LONG RUN targets.

${params.planOverview || "No plan context available."}

---

# MANDATORY ANCHOR SESSIONS (SCHEDULE THESE FIRST)

## ⚠️⚠️⚠️ CRITICAL: Long Run / Ride ⚠️⚠️⚠️
- **REQUIRED DAY:** ${params.longRunDayName} (USER SELECTED - This is the preferred day)
- **Flexibility:** 
  - If ${params.longRunDayName} is a weekend day (Sat/Sun): Perfect, this is ideal.
  - If ${params.longRunDayName} is a weekday: Respect the user's preference, but ensure they have enough time available that day.
- **Distance/Duration:** Must EXACTLY match Target Long Run for each week
- **Priority:** Schedule the Long Run FIRST before any other workout, then fill other days around it
- **Override Rule:** Even if ${params.longRunDayName} is NOT in "Available Days", schedule the Long Run on ${params.longRunDayName} ANYWAY.
- **Time Check:** Ensure the Long Run fits within the available time for that day. If a 22km run at 5:16/km (~2h) is scheduled but only 1.5h is available, FLAG THIS IN VERIFICATION.

---

# BLOCK SCHEDULE & WEEKLY TARGETS
Create workouts for the following weeks. STRICTLY follow the volume and long run targets.

${params.weeks.map(w => {
        // Use per-week long run day if available, otherwise fall back to params default
        const weekLongRunDay = w.longRunDayName || params.longRunDayName;
        // Build per-week availability display
        const weekAvailability = buildWeekAvailabilityCompact(w.dailyAvailability || params.dailyAvailability);
        // Build day-by-day date mapping
        const dateMapping = buildWeekDatesDisplay(w.startDate, w.dailyAvailability || params.dailyAvailability);
        // Check if recovery week
        const isRecovery = w.phase?.toLowerCase().includes('recovery') || w.blockPosition?.toLowerCase().includes('recovery');
        const recoveryRules = isRecovery ? `
  **⚠️ RECOVERY WEEK SPECIAL RULES:**
  - NO long runs over ${Math.round(w.targetLong * 0.6)} km - keep it SHORT
  - NO threshold/tempo/interval workouts - all runs must be EASY (Z1-Z2)
  - Minimum run duration can be 20-25 minutes (not 35min)
  - DO NOT combine workouts - split into separate, easy sessions
  - Focus on recovery: light mobility, easy jogs, rest` : '';

        // [USER REQUIREMENT] Base Phase Intensity Injection
        // Replace one endurance run with specific intensity types for Weeks 1-3 of Base
        let baseIntensityInstructions = "";
        const isBase = w.phase?.includes("Base");

        if (isBase && !isRecovery && !isCycling) {
            // Apply mainly to Running for now as user descriptions were run-specific ("Hill Sprints", "Run", "Fartlek")
            // But principles could apply to cycling if translated. User specifically mentioned "RunningAdapter" context in history, and descriptions are run-specific.

            if (w.blockPosition?.startsWith("Week 1")) {
                baseIntensityInstructions = `
- **🚀 REQUIRED QUALITY SESSION (Hill Sprints):**
  - **Action:** Replace one standard Easy/Endurance run (preferably mid-week) with this session.
  - **Type:** "Run" (Label title as "Hill Sprints")
  - **Goal:** Neuromuscular Power & Running Economy (recruit fast-twitch fibers).
  - **Structure:** 
    1. Warmup: Standard easy running.
    2. **Main:** Find a steep hill (6-10%). Perform **4-8 x 8-10sec Uphill Sprints @ Near-Max Effort**.
    3. **Rest:** Full recovery (1-2 min walk/jog down) between reps.
    4. Cooldown: Easy running.
  - **Why:** Strengthens tendons/glutes/hamstrings with less impact than flat sprinting.`;
            } else if (w.blockPosition?.startsWith("Week 2")) {
                baseIntensityInstructions = `
- **🚀 REQUIRED QUALITY SESSION (Progression Run):**
  - **Action:** Replace one standard Easy/Endurance run with this session.
  - **Type:** "Run" (Label title as "Progression Run")
  - **Goal:** Aerobic Strength (teach body to increase effort as it fatigues).
  - **Structure:** Choose ONE option:
    - **Option A (Thirds):** 1/3 Easy, 1/3 Steady/Moderate, 1/3 Comfortably Hard (Marathon Pace).
    - **Option B (Fast Finish):** Majority easy, final 5-10min @ Tempo effort.
  - **Why:** Moderately hard stimulus without the recovery cost of a full tempo run.`;
            } else if (w.blockPosition?.startsWith("Week 3")) {
                baseIntensityInstructions = `
- **🚀 REQUIRED QUALITY SESSION (Fartlek / Speed Play):**
  - **Action:** Replace one standard Easy/Endurance run with this session.
  - **Type:** "Run" (Label title as "Fartlek")
  - **Goal:** Anaerobic engagement & Turnover.
  - **Structure:** 45-60min total. Insert "pickups" by feel / landmarks.
    - **Example:** 6-8 x (1 min ON / 1 min OFF).
    - **Intensity:** "ON" = ~5k/10k effort. "OFF" = Slow jog.
  - **Why:** Move through gears without track pressure.`;
            }
        }
        return `
### Week ${w.weekNumber}: ${w.phase}
- ** Block Position:** ${w.blockPosition}
- ** Primary Focus:** ${w.focus}
- ** Target Volume:** ${isCycling ? w.targetTSS + " TSS" : w.targetDistance + " km"}
- **🏃 MANDATORY LONG RUN:** ${w.targetLong} ${isCycling ? "hours" : "km"} on ** ${weekLongRunDay}** ⚠️ NON - NEGOTIABLE
            - You MUST schedule a workout with exactly ${w.targetLong} ${isCycling ? "hours" : "km"} on ${weekLongRunDay}
        - Do NOT skip, reduce, or move to another day
            - ** Required Rest Days:** ${w.restDays} (Minimum)
                - ** Gym Target:** ${w.gymFocus}${recoveryRules}
${baseIntensityInstructions}

**📅 EXACT DATES FOR THIS WEEK(use these in CSV output):**
            ${dateMapping}
- ** Weekly Availability:**
            ${weekAvailability}
        `;
    }).join('\n')}

**CRITICAL CONTINUITY INSTRUCTION:**
- The AI must look at the **PLAN CONTEXT** above.
- If Week N ends with a Long Run (Sunday), Week N+1 (Monday) can be a rest day if the schedule and availability allows this, or an easy recovery session. 
- **VERIFY** this in the "Post-Long Run Recovery" check for every week transition.

---

# INSTRUCTIONS & PRIORITIES

## 1. PRIORITY HIERARCHY (STRICT)
When in conflict, follow this order of operations:
1. **LONG RUN ADHERENCE**: The specific Long Run day and distance/duration is Non-Negotiable.
2. **VOLUME CAP**: Do NOT exceed the Weekly Target Volume by more than 3%. It is better to be slightly under than over.
   - *Correction:* If planned runs exceed volume, REDUCE the duration of "Easy Runs" (down to the 35m minimum) to fit.
   - *Frequency:* If reducing duration isn't enough, remove a short recovery run.
3. **INJURY PREVENTION**: If an injury risk is high (based on history), reduce intensity, never volume.
4. **TRAINING PREFERENCES**: User habit patterns, for instance friday gym session, respect these.
5. **AVAILABILITY (CRITICAL - STRICT ENFORCEMENT):**
   - **⚠️ UNAVAILABLE DAYS = REST (MANDATORY):** If a day is NOT listed in "Available Days", you MUST output a REST row for that day. NO EXCEPTIONS.
   - **FATAL ERROR:** If you schedule ANY workout (Run, Gym, or otherwise) on a day NOT in Available Days, your plan is INVALID.
   - *Long Run Exception ONLY:* If ${params.longRunDayName} is NOT in Available Days, schedule the Long Run on ${params.longRunDayName} ANYWAY (this is the ONLY override).
   - *Validation:* Count training days in your CSV. They must equal the number of Available Days (plus Long Run day if it wasn't in the list).

## 1.5 CROSS-WEEK CONTINUITY (MANDATORY - NOT OPTIONAL)
You are planning a **BLOCK**, not isolated weeks. The AI MUST treat weeks as connected:

### ⚠️ WEEK TRANSITION RULES (HARD CONSTRAINTS):
1. **Sunday Long Run → Monday REST:** If Week N has a Long Run on Sunday, Week N+1 Monday MUST be REST or Active Recovery (Z1, max 30min). NO EXCEPTIONS.
2. **Saturday Hard Session → Sunday:** If Saturday has Intervals, Sunday should be Easy (not another hard session).
3. **No "Fresh Start" Thinking:** DO NOT treat Monday of each week as a clean slate. LOOK at what happened on Saturday/Sunday of the previous week.
4. **Fatigue Carryover:** - Week 2 carries residual fatigue from Week 1
   - Week 3 and 4 carry even more accumulated fatigue
   - Adjust by: reducing intensity slightly, not adding extra sessions
5. **VERIFICATION:** For each week after Week 1, you MUST check: "What was the last workout of the previous week? Is my Monday appropriate?"

**THIS IS A HARD RULE, NOT A GUIDELINE. Violations will cause plan rejection.**

## 2. SCIENTIFIC LOGIC MODULES

### A. INTENSITY DISTRIBUTION
- **< 5h (Run) / < 8h (Bike):** **Pyramidal Model.** Focus on Sweet Spot/Tempo to compensate for low volume. (Target: 50% Z1 / 40% Z2 / 10% Z3).
- **5-8h (Run) / 8-12h (Bike):** **Hybrid Model.** Transition phase. (Target: 65% Z1 / 25% Z2 / 10% Z3).
- **> 8h (Run) / > 12h (Bike):** **Polarized Model.** Strict differentiation. (Target: 80% Z1 / 0% Z2 / 20% Z3).

### B. CONCURRENT TRAINING (STRENGTH & MOBILITY) LOGIC MODULE

**PHILOSOPHY:** Strength, Mobility, and Rest are not "optional add-ons" but **integral performance multipliers**. Proper scheduling of these sessions is CRITICAL to prevent interference effects and maximize adaptation.
- **Protocol:** plan the following amount in the different phases.
  - **Base:** **2x/week** (Heavy Resistance/Plyometrics).
  - **Base/Build:** **2x/week** (Heavy Resistance/Plyometrics).
  - **Peak:** **1x/week** (Maintenance/Activation).
  - **Race/Taper:** **0x/week** (Recovery).

#### B.1 THE "CONSOLIDATION" RULE (HARD DAYS HARD)
- **Principle:** Keep hard days hard to maximize recovery on easy days.
- **Scheduling:** Schedule primary **Strength Training** sessions on the SAME day as **High-Intensity Interval** (Endurance) sessions.
- **Ideal Sequence:** Endurance (Morning) → 6+ hour gap → Strength (Evening).
- **Rationale:** Mitigates the "interference effect" (mTOR vs AMPK signaling conflict) and consolidates nervous system fatigue into fewer days.
- **Application:** If Tuesday has "Threshold Intervals", schedule "Gym: Strength" in the Evening slot on Tuesday.

#### B.2 THE "PARASYMPATHETIC" RULE (EASY DAYS)
- **Principle:** Low-intensity inputs to aid recovery and activate rest & digest.
- **Scheduling:** Pair **Zone 2 (Easy/Base)** endurance days with **Restorative Yoga**, **Mobility Flow**, or **Mat Pilates**.
- **Timing:** Schedule these recovery sessions in the EVENING to downregulate the nervous system.
- **Categories:** Use Type="WeightTraining" with titles like:
  - "Restorative Yoga" - 30-45min, focus on breathing and stretching
  - "Mobility Flow" - 20-30min, dynamic movement for joint health
  - "Mat Pilates" - 30-45min, core stability and body awareness
- **Application:** If Monday is "Easy Run 45min", consider adding "Evening Mobility Flow" if a split day.

#### B.3 THE "LONG RUN" BUFFER (CRITICAL PROTECTION)
- **PRE-BUFFER (48 Hours):** NO heavy lower-body loading (Squats, Deadlifts, Lunges with weight) within **48 hours BEFORE** the Long Run/Ride.
  - *Allowed:* Upper body, Core, Mobility are OK in the 48-hour window.
  - *Example:* If Long Run is Sunday, NO leg-focused Gym sessions on Friday or Saturday.
- **POST-BUFFER (24 Hours):** The day AFTER a Long Run/Ride MUST be:
  - **Option A:** Passive Rest (rest row)
  - **Option B:** Restorative Yoga ONLY
  - **FORBIDDEN:** No lifting, no intensity. The body needs time to repair muscle damage.

#### B.4 GYM SESSION LIMITS (STRICT - DO NOT EXCEED)
**⚠️ MAXIMUM GYM SESSIONS PER WEEK:**
- **Regular Weeks (Build Phase):** **MINIMUM 2, MAXIMUM 3 Gym sessions** per week.
  - **MANDATORY:** You MUST schedule at least 2 Strength sessions (unless user has 0 Gym Access).
  - 2x Heavy Strength (legs, upper body)
  - 1-2x Mobility/Yoga (optional, recovery focused)
- **Recovery Week (Week 4 of block):** **MAXIMUM 1-2 sessions** per week.
  - 1x Light Strength or Bodyweight
  - 1-2x Mobility/Yoga
- **FATAL ERROR:** If you schedule FEWER than 2 Strength sessions in a Build week, OR more than 3, your plan is INVALID.
- **Remember:** Gym supports endurance, it's NOT the main focus. Runners run, cyclists ride. Gym is supplementary.

#### B.5 PERIODIZATION (THE 4TH WEEK DELOAD)
- **Weeks 1-3 (Build Phase):**
  - Strength focus: Hypertrophy, Power, Progressive Overload
  - Target: 2x/week Heavy Resistance
- **Week 4 (Recovery Week - MANDATORY DELOAD):**
  - **REDUCE** Strength volume by **50%** OR switch entirely to Bodyweight/Mobility
  - Focus: Joint health, inflammation reduction, nervous system recovery
  - Target: 1x/week Light Strength or 2x/week Mobility Only
  - *Example Gym Session:* "Bodyweight Circuit + Foam Rolling" instead of "Heavy Squats"

#### B.6 TIME-CRUNCHED & CONSTRAINT LOGIC (OVERRIDES)

**Scenario 1: "Morning Only" Gym Access (Split Day Reverse Order)**
- If user MUST Lift in the Morning and Run in the Evening:
- **CONSTRAINT:** The Evening Run MUST be capped at **Tempo/Zone 3** intensity maximum.
- **FORBIDDEN:** Do NOT schedule "Sprints" or "VO2 Max" intervals in the evening if heavy legs were trained in the morning.
- **Rationale:** High injury risk running fast on pre-fatigued muscles.

**Scenario 2: "Single Session" Window (The Brick Workout)**
- If user has only ONE block of time for both Endurance + Strength:
- **SEQUENCE:** Endurance (First) → Strength (Second, immediately after)
- **Rationale:** Prioritize run mechanics while fresh. Lifting on pre-fatigued legs forces lighter weights, which is safer.
- *StepsString Example:* 'w~600~Z2|r~2400~Z2|r~1800~Strength|c~300~Mobility'

**Scenario 3: "No Gym" / Home Equipment Only**
- If no gym access (params.preferences includes "none" or "home"):
- **Option A:** Prescribe "Integrated Strength" runs with bodyweight stops
  - *Example:* "5 min Run → 1 min Lunges/Squats → Repeat"
- **Option B:** Prescribe "Bodyweight Strength" Gym sessions
  - *Exercises:* Push-ups, Planks, Air Squats, Single-Leg Deadlifts, Glute Bridges

#### B.7 FORBIDDEN COMBINATIONS (SAFETY CHECKS - UNLESS USER PREFERENCE OVERRIDES)
1. **NEVER** schedule Strength Training immediately BEFORE a Quality Run (Intervals/Long Run), unless it is a specific "Pre-Fatigue" block for advanced athletes (rare).
2. **NEVER** schedule "Heavy Leg Day" and "Hill Sprints" on back-to-back days. ALWAYS buffer with an Easy/Rest day.
3. **NEVER** schedule two high-intensity sessions (Intervals + Heavy Strength) on an Easy/Recovery day. This defeats the purpose of recovery.
4. **CONDITIONAL:** Lower-body strength within 48 hours before Long Run is discouraged, BUT if user explicitly prefers it (e.g., "Friday gym"), **USER PREFERENCE WINS**.
5. **NEVER** schedule more than 3 Gym/Strength sessions in a single week.

#### B.8 USER PREFERENCE HIERARCHY (CRITICAL)
**When rules conflict with user preferences, ALWAYS prioritize the user's stated preference.**
- *Example:* If user says "Friday morning strength session" and Long Run is Sunday, allow Friday gym even though it's within 48 hours.
- *Rationale:* Consistency and habit formation trump theoretical perfection. A user who can only gym on Friday will skip gym entirely if we don't schedule it.
- *Adjustment:* If allowing a "suboptimal" placement, reduce the intensity/volume of that session to mitigate risk.

**⚠️ CONFLICT WARNING REQUIREMENT:**
When a user preference conflicts with standard training rules, you MUST add a warning to the \`week_notes\` field explaining:
1. What the conflict is
2. Why the user preference was honored anyway
3. What adjustment was made to reduce risk in the future (if any)

*Example week_notes warning:*
"⚠️ NOTE: Friday strength placed 48h before Long Run (user preference). Reduced to upper-body focus and lighter volume to minimize leg fatigue impact on Sunday's Long Run."

---

### C. RECOVERY PROTOCOL
- **Rest Days:** Minimum 1 full passive rest day per week, 2 for athletes over 45.
- **Post-Long Run:** The day after a Long Run must be Rest or Active Recovery (Short, Z1).
- **Recovery Weeks:** If the schedule (above) says "Recovery", reduce intensity significantly (No Z4/Z5). Trust the schedule's volume target.

## 3. ZONE DEFINITIONS & INTENSITY LANGUAGE

### IMPORTANT: Unified Intensity System
To avoid confusion, follow this hierarchy:
1. **Scientific 3-Zone Model** (for training distribution): Z1 (Easy), Z2 (Threshold), Z3 (VO2max+)
2. **Friel 7-Zone Model** (for workout specificity): Maps to the 3 zones as shown below
3. **Output Format**: Use **% of Threshold** in StepsString (e.g., "85-95% Pace" for running, "85-95%" for cycling FTP)

For training distribution, use the following distribution based on the scientific 3-zone model:
- **< 4h (Run) / < 6h (Bike):** **Pyramidal Model.** Focus on Sweet Spot/Tempo to compensate for low volume. (Target: 50% Z1 / 40% Z2 / 10% Z3).
- **4-7h (Run) / 6-12h (Bike):** **Hybrid Model.** Transition phase. (Target: 70% Z1 / 20% Z2 / 10% Z3).
- **> 7h (Run) / > 12h (Bike):** **Polarized Model.** Strict differentiation. (Target: 80% Z1 / 0% Z2 / 20% Z3).

| Friel Zone | Scientific | Cycling (% FTP) | Running Speed (% Threshold Speed) | Feeling |
| **1. Recovery** | Sci Z1 | < 55% | < 78% | Very Easy, can breathe through nose |
| **2. Aerobic** | Sci Z1 | 55% – 74% | 78% – 87% | Conversational, "All day" pace |
| **3. Tempo** | Sci Z2 | 75% – 89% | 88% – 94% | Comfortably Hard, requires focus |
| **4. Threshold** | Sci Z2 | 90% – 104% | 95% – 100% | Hard, sustainable for 30-60m |
| **5a. SuperThreshold** | Sci Z3 | 105% – 120% | 100% – 103% | Very Hard, gasping for air |
| **5b. Anaerobic**| Sci Z3 | 121% – 150% | 104% – 111% | Severe effort, finding limits |
| **5c. Sprint** | Sci Z3 | > 150% | > 111% | Max Effort, <30s |

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
   - **DESCRIPTION REQUIRED (NEW):** You MUST write a 1-sentence motivating description in the correct field.
   - *Instruction:* "Write clear, motivating descriptions explaining WHY this workout is assigned."
   - *Example:* "Focus on maintaining consistent cadence during the main set to build endurance."
   - Do NOT write descriptions in the StepsString. The system parses them separately.

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
4. Compare to Target Volume (must be ±3%)
5. Mark PASS/FAIL for each check
6. Only output CSV if ALL checks pass

**Format (one block per week):**
# WEEK [N] CHECK
# Long Run Distance: Target=${isCycling ? '[X] hours' : '[X] km'} | Scheduled=${isCycling ? '[Y] hours' : '[Y] km'} | Status: [PASS/FAIL]
# Long Run Day: Required=${params.longRunDayName} | Scheduled=[DayName] | Is Weekend (Sat/Sun)=[Yes/No] | Status: [PASS/FAIL] ⚠️ FAIL if NOT on ${params.longRunDayName}/Saturday/Sunday
# Volume: Target=[X] ${isCycling ? 'TSS' : 'km'} | Scheduled=[Y] ${isCycling ? 'TSS' : 'km'} (math: workout1 + workout2 + ...) | Status: [PASS/FAIL] (±2%)
# Rest Days: Required=[X] | Scheduled=[Y] | Status: [PASS/FAIL]
# Gym Sessions: Count=[X] | Min Required=2 | Max Allowed=3 | Status: [PASS/FAIL] ⚠️ FAIL if < 2 (Build) or > 3
# Unavailable Days as REST: [List unavailable days and confirm they are REST] | Status: [PASS/FAIL]
# Post-Long Run: Day after Long Run=[Rest/Easy] | Status: [PASS/FAIL]
# Week Transition (if not Week 1): Previous week ended with=[workout type] on [day] | This week starts with=[workout type] | Appropriate=[Yes/No] | Status: [PASS/FAIL]
(Repeat for all weeks)

## 1.5 WEEKLY NOTES (Output after verification, before CSV)
For EACH week, output a note explaining the training focus. This will be displayed to the athlete.
**Format:**
\`NOTE_WEEK_N: [Title] - [1-2 sentence explanation]\`

**Example:**
NOTE_WEEK_1: Base Building - Focus on aerobic development with easy miles. Building foundation for harder work ahead.
NOTE_WEEK_2: Introducing Speed - First threshold session this week. Keep easy days truly easy to recover.


## 2. CSV FORMAT (STRICT)
Output **ONLY** a raw CSV string. No JSON. No Markdown. No headers.

**CRITICAL UNIT CONVERSION:**
- All volume targets above are in KILOMETERS
- The Distance column in CSV must be in METERS
- **CONVERSION:** Target km × 1000 = Distance (meters)
- Example: Target Long Run 15 km → Output 15000 in Distance column

## COLUMNS
\`Date, Type, Distance, Duration, Title, Slot, StepsString\`

1. **Date**: Full date in **YYYY-MM-DD** format (e.g., 2026-01-05). Use the EXACT dates from "📅 EXACT DATES FOR THIS WEEK" above.
2. **Type**: "Run", "Ride", "Rest", "Swim", "WeightTraining", "Yoga".
   - **⚠️ CYCLING PLANS:** Use "Ride" NOT "Run" for all cycling workouts!
   - **Strength/Weights:** Use "WeightTraining" (not "Gym")
   - **Yoga/Flexibility/Mobility:** Use "Yoga"
   - **⚠️ CRITICAL:** Use "Rest" for ALL unavailable days (marked ❌ REST above).
3. **Distance**: Integer (meters). 0 for Rest/WeightTraining/Yoga.
4. **Duration**: Integer (seconds). 0 for Rest.
5. **Title**: String. No commas. For Rest days use "Rest Day".
6. **Slot**: "morning" or "evening". Required for split days, optional otherwise.
   - *Rule:* On days marked as **DUAL SESSION OPTION** in availability, output TWO rows with same Date but different Slots.
   - *Best Practice:* Schedule WeightTraining/Strength in morning, harder cardio in evening.
7. **StepsString**: 
   - Format: \`Code~Duration(sec)~Intensity\`
   - Codes: \`w\` (Warmup), \`c\` (Cooldown), \`r\` (Run), \`rec\` (Recover).
   - Repeats: \`Nx(r~90~Z5+rec~90~Z1)\` ← **IMPORTANT: Use + NOT | inside parentheses!**
   - **For Rest days:** Leave empty or use empty string.

## ⛔ MANDATORY REST DAY OUTPUT (CRITICAL)

**For EVERY day marked as "MANDATORY REST" or "0h available" in the availability section, you MUST output a REST row:**

**Example REST row format:**
\`\`\`
3,Rest,0,0,Rest Day,morning,
\`\`\`

**Rules:**
1. **Every unavailable day MUST appear as a REST row** in your CSV output
2. Count the REST days in your output - it MUST match the number of unavailable days listed above
3. **A missing REST row = INVALID output** that will be rejected
4. Days with 0h available are NOT optional - they are MANDATORY REST

## DUAL SESSION DAYS (SPLIT SCHEDULING) - CONDITIONAL RULES

**⚠️ CRITICAL: "Dual Session" does NOT mean "must schedule two workouts."**
It means the athlete HAS the option to split if conditions warrant.

### WHEN TO USE DUAL SESSIONS (All conditions must apply):
1. **Volume Threshold:** Weekly running volume > **70km** (or cycling > 12h)
   - OR splitting **different workout types** (e.g., Gym + Run, Yoga + Run, Pilates + Run)
2. **Quality Preservation:** The split allows for better execution (e.g., intervals fresh in Morning, easy run in Evening)
3. **Availability:** User has > 2 hours total availability for the day. If <= 2 hours, prioritize SINGLE session.

### WHEN TO USE SINGLE SESSION (Default):
- If weekly volume ≤ 70km, **COMBINE into ONE session** on available days
- If daily availability ≤ 2 hours, **KEEP AS ONE SESSION** (unless Types differ, e.g. Gym+Run)
- **DO NOT create "junk miles"** just to fill a split window

### ✅ ALLOWED Dual Sessions:
1. **Different Workout Types (HIGHLY RECOMMENDED):** 
   - **Gym + Run, Yoga + Run, Pilates + Run:** Schedule Gym/Yoga/Pilates in Morning, Run in Evening (or vice versa).
   - **Note:** For these different types, IGNORE duration limits. Short runs + Gym is allowed.
2. **Very High Volume Weeks (>70km):** You MAY split cardio into two runs/rides.

### ❌ NOT ALLOWED:
1. **Two Short Runs on Low Volume:** If weekly volume ≤ 70km, DON'T split a 60min run into 2x30min.
2. **Junk Miles:** DO NOT create short filler runs just because a split window exists.

## VOLUME FLOOR LOGIC (CRITICAL - PREVENTS JUNK MILES)

**The Math Problem:** If remaining weekly volume (after Long Run) is insufficient to support 35+ minute runs on all available days, you have a conflict.

**Resolution - REDUCE FREQUENCY, NOT QUALITY:**
1. Calculate: Remaining Volume ÷ Available Days = Volume per session
2. If Volume per session < 6km (approx 35 min at base pace):
   - **DO NOT** create multiple tiny runs
   - **DO** reduce the number of run days
   - **Prioritize:** 1 Quality Interval session + Long Run + 1-2 Easy runs (40-50 min each)
3. **Leave days empty (REST)** rather than scheduling "junk" 20-minute runs
4. **Statement:** "It is better to run 3 proper sessions than 6 tiny ones."

## MINIMUM DURATION RULES (ENFORCED BY SYSTEM)
${typeof formatRulesForPrompt === 'function' ? formatRulesForPrompt(sport) : `
- **Running:** MINIMUM 35 minutes per session.
  - *Exception:* "Shakeout Run" (20 min) allowed ONLY the day before a race.
- **Cycling:** Minimum 45 minutes for any ride.
- **WeightTraining:** Minimum 30 minutes.
`}

### Example: When TO Split (Different Types)
\`\`\`
3,WeightTraining,0,2400,Morning Strength,morning,w~600~Mobility|r~1800~Strength
3,Run,8000,3600,Evening Tempo,evening,w~600~Z2|3x(r~480~Z4+rec~180~Z2)|c~600~Z2
\`\`\`

### Example: When NOT to Split (Combine Instead)
❌ WRONG: Two short runs
\`\`\`
3,Run,4000,2040,Morning Easy,morning,r~2040~Z2
3,Run,3000,1560,Evening Easy,evening,r~1560~Z2
\`\`\`
✅ CORRECT: One proper session
\`\`\`
3,Run,7000,3600,Easy Run,morning,r~3600~Z2
\`\`\`

---

## WEEKLY NOTES FORMAT (Enhanced Context)

For EACH week, output a comprehensive note that will help the athlete understand their training:

**Format:**
\`NOTE_WEEK_N: [Title] | [Focus] | [Key Session Tip] | [Learning Point]\`

**Include:**
1. **Title:** Brief phase description (e.g., "Base Building Week 2")
2. **Focus:** What physiological adaptation we're targeting
3. **Key Session Tip:** Execution advice for the hardest workout
4. **Learning Point:** Something educational about training science

**Example:**
NOTE_WEEK_1: Base Building | Focus: Aerobic development via Zone 2 volume. Key: Long run at conversational pace - you should be able to speak full sentences. Learn: Base training builds mitochondrial density - the foundation for all speed work later.
NOTE_WEEK_3: Speed Introduction | Focus: Neuromuscular activation via strides and threshold touches. Key: Tempo run should feel "comfortably hard" - sustainable for 30-60min. Learn: Threshold training raises lactate clearance capacity.

---

## EXAMPLES
# WEEK 1 CHECK
# Target Volume: 40 km | Actual Scheduled: 40.5 km | Status: PASS
# Target Long Run: 12 km | Actual Scheduled: 12 km | Status: PASS
# Rest Days Required: 2 | Actual Scheduled: 2 | Status: PASS
NOTE_WEEK_1: Base Building | Focus: Aerobic foundation with easy miles. Key: Keep all runs conversational. Learn: Zone 2 training develops fat oxidation and running economy.
0,Run,10000,3600,Easy Run,morning,r~3600~Z2
1,WeightTraining,0,2700,Strength & Core,morning,w~600~Mobility|r~2100~Strength
2,Rest,0,0,Rest Day,morning,
3,Run,12000,4200,Threshold Intervals,morning,w~900~Z1|5x(r~360~Z4+rec~120~Z1)|c~900~Z1

**FINAL CHECK:**
- Does the "Actual Scheduled" match the constraints?
- Did you schedule a REST DAY as required?
- Did you output the # Check lines and NOTE_WEEK_N line?
- For split days, did you verify DIFFERENT workout types and MINIMUM DURATION?
`;
}


/**
 * Build regeneration feedback context
 */
function buildFeedbackContext(feedback, weeks) {
    if (!feedback) return "";

    let context = `
# ⚠️ REGENERATION INSTRUCTION (USER FEEDBACK) ⚠️
The user has requested changes to the plan. You MUST prioritize this feedback over standard rules.

## USER FEEDBACK:
"${feedback}"
`;

    // Add specific block context if available
    if (weeks && weeks.length > 0) {
        context += `
## CONTEXT:
This feedback applies to Weeks ${weeks[0].weekNumber}-${weeks[weeks.length - 1].weekNumber}.
Review the previously generated plan and apply the requested changes strictly to these weeks.
`;
    }

    return context;
}

// Expose to window
window.buildAIWorkoutPrompt = buildAIWorkoutPrompt;
