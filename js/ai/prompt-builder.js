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
        continuityContext
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

    dayOrder.forEach(d => {
        const dayData = dailyAvailability[d];
        if (!dayData) return;

        const hours = dayData.hours || 0;
        totalHours += hours;

        if (hours === 0) {
            lines.push(`   - ${dayNames[d]}: REST (0h available)`);
        } else if (dayData.split) {
            lines.push(`   - ${dayNames[d]}: ${hours}h total (☀️ Morning: ${dayData.amHours}h + 🌙 Evening: ${dayData.pmHours}h) **[DUAL SESSION DAY]**`);
            splitDays.push(dayNames[d]);
        } else {
            lines.push(`   - ${dayNames[d]}: ${hours}h`);
        }
    });

    lines.push(`   **Weekly Training Time Budget: ${totalHours.toFixed(1)}h**`);

    if (splitDays.length > 0) {
        lines.push(`   **Split Session Days:** ${splitDays.join(', ')} - Schedule 2 workouts (Morning + Evening) on these days.`);
    }

    return lines.join('\n');
}

/**
 * Build the main prompt body
 */
function buildMainPrompt({ sport, isCycling, params, basePace, sportInstructions, goalContext, progressionContext, continuityContext }) {
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
10. **Daily Time Availability:**
${buildDailyAvailabilityDisplay(params.dailyAvailability)}


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
\`DayIndex, Type, Distance, Duration, Title, Slot, StepsString\`

1. **DayIndex**: Cumulative day from start of block (0 = Day 1 of Week 1, 7 = Day 1 of Week 2, etc).
2. **Type**: "Run", "Ride", "Rest", "Swim", "Gym".
   - *Note:* Use "Gym" for Strength/Mobility.
3. **Distance**: Integer (meters). 0 for Rest/Gym.
4. **Duration**: Integer (seconds). 0 for Rest.
5. **Title**: String. No commas.
6. **Slot**: "morning" or "evening". Required for split days, optional otherwise.
   - *Rule:* On days marked as **DUAL SESSION DAY** in availability, output TWO rows with same DayIndex but different Slots.
   - *Best Practice:* Schedule Gym/Strength in morning, harder cardio in evening.
7. **StepsString**: 
   - Format: \`Code~Duration(sec)~Intensity\`
   - Codes: \`w\` (Warmup), \`c\` (Cooldown), \`r\` (Run), \`rec\` (Recover).
   - Repeats: \`Nx(r~90~Z5+rec~90~Z1)\`

## DUAL SESSION DAYS (SPLIT SCHEDULING)
If a day is marked as **DUAL SESSION DAY** in the Daily Time Availability section, you MUST output TWO separate workout rows for that day:
- One with **Slot=morning** (shorter/strength focused)  
- One with **Slot=evening** (primary cardio session)

**Example for Split Day (same DayIndex, two Slots):**
\`\`\`
3,Gym,0,2400,Morning Strength,morning,w~600~Mobility|r~1800~Strength
3,Run,8000,3600,Evening Tempo,evening,w~600~Z2|3x(r~480~Z4+rec~180~Z2)|c~600~Z2
\`\`\`

## EXAMPLES
# WEEK 1 CHECK
# Target Volume: 40 km | Actual Scheduled: 40.5 km | Status: PASS
# Target Long Run: 12 km | Actual Scheduled: 12 km | Status: PASS
# Rest Days Required: 2 | Actual Scheduled: 2 | Status: PASS
0,Run,10000,3600,Easy Run,morning,r~3600~Z2
1,Gym,0,2700,Strength & Core,morning,w~600~Mobility|r~2100~Strength
2,Rest,0,0,Rest Day,morning,
3,Run,12000,4200,Threshold Intervals,morning,w~900~Z1|5x(r~360~Z4+rec~120~Z1)|c~900~Z1

**FINAL CHECK:**
- Does the "Actual Scheduled" match the constraints?
- Did you schedule a REST DAY as required?
- Did you output the # Check lines?
- For split days, did you output TWO rows with matching DayIndex but different Slots?
`;
}

// Expose to window
window.buildAIWorkoutPrompt = buildAIWorkoutPrompt;
