// ==========================================
// CORE LOGIC: MARATHON SCHEDULE GENERATOR v5.0
// ==========================================

function getStartingVolume() {
    let currentKm = 30;
    if (state.activities && state.activities.length > 0) {
        const now = new Date();
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
        const lastWeekStart = new Date(lastSunday);
        lastWeekStart.setDate(lastSunday.getDate() - 6);

        let vol = 0;
        state.activities.forEach(act => {
            if (act.type === 'Run') {
                const d = new Date(act.start_date_local);
                if (d >= lastWeekStart && d <= lastSunday) {
                    vol += (act.distance || 0) / 1000;
                }
            }
        });
        if (vol > 0) currentKm = vol;
    }
    return currentKm;
}

function applyModifications() {
    if (!state.modifications) return;
    for (const key in state.modifications) {
        const [w, d] = key.split('_').map(Number);
        if (state.generatedPlan[w] && state.generatedPlan[w].schedule[d]) {
            state.generatedPlan[w].schedule[d] = { ...state.generatedPlan[w].schedule[d], ...state.modifications[key] };
        }
    }
}

function calculateScheduleStructure(totalWeeks, taperWeeksInput = 3) {
    // I. INPUT VARIABLE: Total_Weeks

    // II. STEP 1: CALCULATE TAPER (T)
    const T = taperWeeksInput;

    // III. STEP 2: SET THE ANCHOR (A)
    const A = 3; // Fixed final training block before taper

    // IV. STEP 3: CALCULATE EARLIER TRAINING POOL (P)
    const P = totalWeeks - T - A;

    // Safety fallback for very short plans
    if (P <= 0) {
        return {
            taperWeeks: T,
            anchorWeeks: Math.max(1, totalWeeks - T),
            earlyBlockLengths: []
        };
    }

    // V. STEP 4: DETERMINE EARLIER BLOCKS STRATEGY (N)
    let N = 1;
    if (P >= 6 && P <= 10) N = 2;
    else if (P >= 11 && P <= 14) N = 3;
    else if (P >= 15) N = 4;

    // Distribute the Pool
    const baseSize = Math.floor(P / N);
    const remainder = P % N;

    let earlyBlockLengths = [];
    for (let i = 0; i < N; i++) {
        // Add 1 week to the first 'remainder' blocks (Front-loading)
        let len = baseSize + (i < remainder ? 1 : 0);
        earlyBlockLengths.push(len);
    }

    // Return the structural blueprint
    return {
        taperWeeks: T,
        anchorWeeks: A,
        earlyBlockLengths: earlyBlockLengths
    };
}

function calculateMarathonPlan(startVol, startLR, raceDateStr, options = {}) {
    const raceDate = new Date(raceDateStr);
    const today = new Date();
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksUntilRace = Math.ceil((raceDate - today) / msPerWeek);

    if (weeksUntilRace < 1) return [];

    // Options
    const progressionRate = options.progressionRate || 0.10;
    const startWithRestWeek = options.startWithRestWeek || false;
    const customRestWeeks = options.customRestWeeks || [];
    const forceBuildWeeks = options.forceBuildWeeks || [];
    const raceType = options.raceType || "Marathon"; // Default to Marathon

    // --- RACE TYPE CONFIGURATION ---
    let maxLongRunCap, taperDefault, longRunProgressionDefault;

    if (raceType === "Half Marathon") {
        maxLongRunCap = 22.0;
        taperDefault = 2;
        longRunProgressionDefault = 1.5;
    } else if (raceType === "10k") {
        maxLongRunCap = 16.0;
        taperDefault = 1;
        longRunProgressionDefault = 1.0;
    } else {
        // Marathon
        maxLongRunCap = 36.0;
        taperDefault = 3;
        longRunProgressionDefault = 2.0;
    }

    // Allow override from options, but default to race-type specific defaults if not provided
    const taperDuration = options.taperDuration !== undefined ? options.taperDuration : taperDefault;
    const longRunProgression = options.longRunProgression !== undefined ? options.longRunProgression : longRunProgressionDefault;

    // --- FORWARD GENERATION RE-IMPLEMENTATION ---
    let plan = [];
    let currentCapacity = parseFloat(startVol);
    let currentLongRun = parseFloat(startLR);
    let currentBlockNum = 1;

    // Adjust starting capacity if starting with a rest week
    // (Logic handled inside the loop)

    for (let i = 0; i < weeksUntilRace; i++) {
        const weekNum = i + 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + (i * 7));

        // Determine Phase/Block based on weeks remaining
        const weeksRemaining = weeksUntilRace - i; // 1 means Race Week

        let phaseName = "Base Phase";
        let blockType = "Base";
        let isRaceWeek = (weeksRemaining === 1);

        if (isRaceWeek) {
            phaseName = "Race Week";
            blockType = "Race";
        } else if (weeksRemaining <= taperDuration) {
            phaseName = "Taper Phase";
            blockType = "Taper";
        } else if (weeksRemaining <= taperDuration + 3) {
            phaseName = "Peak Phase";
            blockType = "Peak";
        } else if (weeksRemaining <= taperDuration + 3 + 4) {
            phaseName = "Build Phase";
            blockType = "Build";
        } else {
            // If it's the very last block before Build, call it Base/Build
            if (weeksRemaining <= taperDuration + 3 + 4 + 4) {
                phaseName = "Base/Build Phase";
            } else {
                phaseName = "Base Phase";
            }
            blockType = "Base";
        }

        // --- VOLUME & LONG RUN ---
        let vol, longRun;
        let isRecoveryWeek = false;

        if (blockType === "Race") {
            vol = currentCapacity * 0.4;
            longRun = (raceType === "Marathon") ? 42.2 : (raceType === "Half Marathon") ? 21.1 : 10.0;
        } else if (blockType === "Taper") {
            // Taper Logic
            const weeksOut = weeksRemaining - 1; // 1, 2, 3
            // 1 week out (last taper week): 60%
            // 3 weeks out (first taper week): 90%
            let factor = 0.60 + (0.15 * (weeksOut - 1));
            if (factor > 0.90) factor = 0.90;

            vol = currentCapacity * factor;
            longRun = currentLongRun * factor;
        } else {
            // Training Block
            // let isRecoveryWeek = false; // Moved to top of loop

            // Custom/Force Logic
            if (customRestWeeks.includes(weekNum)) isRecoveryWeek = true;
            else if (forceBuildWeeks.includes(weekNum)) isRecoveryWeek = false;
            else {
                // Default Logic
                // Only apply default recovery if NOT in Peak phase
                if (blockType !== "Peak") {
                    if (startWithRestWeek) {
                        if ((weekNum - 1) % 4 === 0) isRecoveryWeek = true;
                    } else {
                        if (weekNum % 4 === 0) isRecoveryWeek = true;
                    }
                }
            }

            if (isRecoveryWeek) {
                // Recovery Week: Drop volume
                // STRICT 60% of previous week (which is currentCapacity)
                const restWeekFactor = 0.60;
                vol = currentCapacity * restWeekFactor;
                longRun = currentLongRun * restWeekFactor;
            } else {
                // Check if the previous week was a Recovery week
                const lastWeekIndex = plan.length - 1;
                const lastWeek = lastWeekIndex >= 0 ? plan[lastWeekIndex] : null;

                if (lastWeek && (lastWeek.weekName.includes("Recovery") || lastWeek.weekName === "Recovery Start")) {
                    // RESTART LOGIC: 
                    // Volume: Previous Peak * (1 - progressionRate)
                    // Long Run: Previous Peak - longRunProgression

                    // Note: currentCapacity holds the "Peak" from before the rest week.
                    currentCapacity = currentCapacity * (1 - progressionRate);
                    currentLongRun = currentLongRun - longRunProgression;
                } else {
                    // NORMAL PROGRESSION
                    // Only increase if it's not the very first week (unless we want to jump start)
                    if (i > 0) {
                        currentCapacity = currentCapacity * (1 + progressionRate);
                        currentLongRun = currentLongRun + longRunProgression;
                    }
                }

                // Peak Week Logic (Last week of Peak Phase)
                // Peak Phase ends when weeksRemaining == taperDuration + 1.
                // So the last week of Peak is when weeksRemaining == taperDuration + 1.
                if (blockType === "Peak" && weeksRemaining === taperDuration + 1) {
                    // "Last week of peak should reduce long run significantly"
                    // "Longest run should occur one week earlier"
                    // So this week (Last Peak Week) has REDUCED long run.

                    // Reduce Long Run for this specific week
                    // But do NOT update currentLongRun, as we want Taper to base off the high?
                    // Actually Taper usually bases off the Peak volume.

                    // Let's just set the local 'longRun' variable lower.
                    longRun = currentLongRun - (4 * longRunProgression);
                    vol = currentCapacity; // Keep volume high
                } else {
                    longRun = currentLongRun;
                    vol = currentCapacity;
                }
            }
        }

        // Caps
        if (longRun > maxLongRunCap) longRun = maxLongRunCap;

        // Rounding
        vol = parseFloat(vol.toFixed(1));
        longRun = parseFloat(longRun.toFixed(1));

        // Calculate Block Number (Dynamic: New block after recovery)
        const blockNum = currentBlockNum;

        // Determine Focus
        let focus = "Aerobic Endurance";
        if (isRaceWeek) focus = "Race Day";
        else if (blockType === "Taper") focus = "Recovery & Sharpening";
        else if (blockType === "Peak") focus = "Race Specific";
        else if (blockType === "Build") focus = "Threshold & Strength";
        else if (isRecoveryWeek) focus = "Active Recovery";

        plan.push({
            week: weekNum,
            blockNum: blockNum,
            weekName: isRaceWeek ? "Race Week" : (blockType === "Taper" ? "Taper Week" : (vol < currentCapacity * 0.7 ? "Recovery Week" : "Build Week")),
            phaseName: phaseName,
            blockType: blockType,
            startDateObj: weekStart,
            startDate: weekStart.toISOString(), // Fix for NaN.NaN
            date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rawKm: vol,
            mileage: vol.toFixed(1),
            longRun: longRun,
            isRaceWeek: isRaceWeek,
            focus: focus // Fix for undefined week definition
        });

        // Increment block number AFTER a recovery week, so the NEXT week starts a new block
        // We check for explicit isRecoveryWeek OR if the volume is low enough to be visually marked as "Recovery Week"
        // BUT we exclude Taper weeks, as the user specified Taper is not a Recovery Week and Race Week should not be a separate block.
        if (isRecoveryWeek || (vol < currentCapacity * 0.7 && !isRaceWeek && blockType !== "Taper")) {
            currentBlockNum++;
        }
    }

    return plan;
}

function generateTrainingPlan() {
    if (!state.raceDate) {
        console.warn("No race date set");
        return [];
    }

    // Determine Starting Values
    // Priority: 1. User Input (state.startingVolume) 2. Calculated (getStartingVolume) 3. Default (30)
    let startVol = parseFloat(state.startingVolume);
    if (isNaN(startVol)) startVol = getStartingVolume();

    let startLR = parseFloat(state.startingLongRun);
    if (isNaN(startLR)) startLR = Math.ceil(state.lastWeekLongRun || 10);

    const options = {
        progressionRate: state.progressionRate || 0.10,
        startWithRestWeek: state.startWithRestWeek || false,
        raceType: state.raceType || (document.getElementById('raceTypeInput') ? document.getElementById('raceTypeInput').value : "Marathon"),
        taperDuration: state.taperDuration,
        longRunProgression: state.longRunProgression,
        customRestWeeks: state.customRestWeeks || [],
        forceBuildWeeks: state.forceBuildWeeks || []
    };

    const plan = calculateMarathonPlan(startVol, startLR, state.raceDate, options);
    state.generatedPlan = plan;
    return plan;
}