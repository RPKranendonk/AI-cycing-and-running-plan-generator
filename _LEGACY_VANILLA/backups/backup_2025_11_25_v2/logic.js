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
    const planStart = new Date();
    const day = planStart.getDay();
    const diff = planStart.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    planStart.setDate(diff);
    planStart.setHours(0, 0, 0, 0);

    if (!raceDateStr) return [];

    const raceDate = new Date(raceDateStr);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((raceDate - planStart) / msPerWeek);

    // 2. Get Logic Structure v5.0
    const taperDuration = parseInt(options.taperDuration) || 3;
    const structure = calculateScheduleStructure(totalWeeks, taperDuration);

    // 3. Setup Volume
    let currentCapacity = startVol;
    let currentLongRun = startLR;
    const progressionRate = options.progressionRate || 0.10;
    const restWeekFactor = 0.60;
    const startWithRestWeek = options.startWithRestWeek || false;
    const customRestWeeks = options.customRestWeeks || [];
    const longRunProgression = options.longRunProgression || 2.0;

    let peakKm = 0;
    let peakLongRun = 0;

    const plan = [];
    let currentWeek = 1;
    let currentBlockNum = 1;

    // --- HELPER TO ADD A BLOCK ---
    const addBlock = (length, phaseName, blockType) => {
        if (length <= 0) return;

        for (let i = 1; i <= length; i++) {
            let isRecoveryWeek = false;
            let isRaceWeek = false;
            let weekName = "Build";
            let focus = "Volume & Strength";

            // LOGIC VI: Structure Rules

            // 1. TAPER BLOCK RULES
            if (blockType === "Taper") {
                weekName = (i === length) ? "Race Week" : `Taper Week ${i}`;
                focus = (i === length) ? "The Marathon" : "Glycogen Loading & Recovery";
                isRaceWeek = (i === length);
            }
            // 2. ANCHOR BLOCK RULES (Specificity)
            else if (blockType === "Peak") {
                // Structure: ALL BUILD (No recovery week in Anchor)
                weekName = "Peak Build";
                focus = "Race Pace Specificity";
                isRecoveryWeek = false;
            }
            // 3. EARLY BLOCKS RULES
            else {
                // Structure: (Length-1) Build + 1 Recovery
                if (i === length) {
                    isRecoveryWeek = true;
                    weekName = "Recovery";
                    focus = "Adaptation & Absorption";
                } else {
                    weekName = "Accumulation"; // Default build name
                    if (i === 1) weekName = "Acclimation";
                    if (i === length - 1) weekName = "Overreach";
                }
            }

            // FORCE START WITH REST WEEK (User Option)
            if (currentWeek === 1 && startWithRestWeek) {
                isRecoveryWeek = true;
                weekName = "Recovery Start";
                focus = "Fresh Start";
            }

            // CUSTOM REST WEEK OVERRIDE
            if (customRestWeeks.includes(currentWeek) && !isRaceWeek && blockType !== "Taper") {
                isRecoveryWeek = true;
                weekName = "Custom Recovery";
                focus = "Planned Rest";
            }

            // FORCE BUILD WEEK OVERRIDE
            if (options.forceBuildWeeks && options.forceBuildWeeks.includes(currentWeek)) {
                isRecoveryWeek = false;
                weekName = "Forced Build";
                focus = "User Override";
            }

            // --- VOLUME CALCULATION ---
            let vol, longRun;

            if (blockType === "Taper") {
                const weeksOut = length - i;
                if (weeksOut === 0) { // Race Week (0 weeks out)
                    vol = peakKm * 0.40;
                    longRun = 42.2;
                } else if (weeksOut === 1) { // 1 week out
                    if (length === 2) {
                        vol = peakKm * 0.70;
                        longRun = peakLongRun * 0.60;
                    } else {
                        vol = peakKm * 0.60;
                        longRun = 12;
                    }
                } else { // 2 weeks out
                    vol = peakKm * 0.80;
                    longRun = peakLongRun * 0.75;
                }
                if (length === 1 && weeksOut === 0) {
                    vol = peakKm * 0.50;
                }

            } else {
                if (isRecoveryWeek) {
                    // Recovery Week: Drop volume & LR to 60% of LAST WEEK
                    // Note: We use the values from the *previous* iteration (which are stored in currentCapacity/currentLongRun before update)
                    // Wait, currentCapacity holds the *target* for the *current* week if it were a build week.
                    // Actually, let's look at how we update.
                    // We update currentCapacity at the END of the loop for the NEXT week.
                    // So currentCapacity entering this loop IS the value for this week (if it were normal progression).

                    // But the requirement is: Rest week = Last week x 0.6.
                    // "Last week" implies the actual volume of the previous week.
                    // If previous week was Build, currentCapacity is (LastWeek * 1.1).
                    // So we should take (currentCapacity / 1.1) * 0.6? 
                    // Or just currentCapacity * 0.6?
                    // Let's assume currentCapacity tracks the "Build Baseline".

                    // Let's use a separate tracker for "Previous Peak" to be safe?
                    // Or just use currentCapacity.

                    // Let's apply the logic directly to the output `vol` and `longRun`, 
                    // but NOT update `currentCapacity` yet (or update it specifically for next week).

                    // If we are in a recovery week, we want to drop.
                    // But we want the *next* week to be calculated correctly.

                    // Let's calculate the "Potential Build" for this week first.
                    const potentialBuildVol = currentCapacity;
                    const potentialBuildLR = currentLongRun;

                    // Get Last Week's Actuals (if available)
                    const lastWeekIndex = plan.length - 1;
                    const lastWeek = lastWeekIndex >= 0 ? plan[lastWeekIndex] : null;
                    const lastWeekVol = lastWeek ? lastWeek.rawKm : startVol;
                    const lastWeekLR = lastWeek ? lastWeek.longRun : startLR;

                    // Requirement: Rest Week = Last Week * 0.6
                    vol = lastWeekVol * 0.60;
                    longRun = lastWeekLR * 0.60;

                    // Special Case: Week 1 Recovery
                    if (currentWeek === 1) {
                        vol = startVol * 0.60;
                        longRun = startLR * 0.60;
                    }

                } else {
                    // BUILD WEEK

                    // Check if Previous Week was Recovery
                    const lastWeekIndex = plan.length - 1;
                    const lastWeek = lastWeekIndex >= 0 ? plan[lastWeekIndex] : null;

                    if (lastWeek && (lastWeek.weekName.includes("Recovery") || lastWeek.weekName === "Recovery Start" || weekName === "Custom Recovery")) {
                        // RESTART LOGIC (Week After Rest)
                        // Vol = (Rest Week / 0.6) * (1 - rate)
                        // LR = (Rest Week LR / 0.6) - LR_Progression

                        // Rest Week / 0.6 should theoretically be the "Previous Peak" (or the week before rest).
                        const prevPeakVol = lastWeek.rawKm / 0.60;
                        const prevPeakLR = lastWeek.longRun / 0.60;

                        currentCapacity = prevPeakVol * (1 - progressionRate);
                        currentLongRun = prevPeakLR - longRunProgression;

                        // Safety: If Week 1 was rest, we just start at startVol?
                        if (currentWeek === 2 && startWithRestWeek) {
                            currentCapacity = startVol;
                            currentLongRun = startLR;
                        }

                    } else if (currentWeek > 1) {
                        // NORMAL PROGRESSION (Next weeks = last week * (1 + rate))
                        // We need to update based on *Last Week's* capacity.
                        // Since we are in the loop, `currentCapacity` holds the value for *this* week 
                        // (calculated at end of last loop).
                        // So we just use it.
                    }

                    // Set Volume
                    vol = currentCapacity;
                    longRun = currentLongRun;

                    // PEAK WEEK LOGIC (Longest Run 1 week earlier)
                    // If this is the LAST week of the Peak Block (which is `length` of Peak block)
                    // We want to reduce the long run.
                    if (blockType === "Peak" && i === length) {
                        // Reduce by 4x LR Progression
                        longRun = currentLongRun - (4 * longRunProgression);
                        // Add significant MP (handled in workout details, but here we just set distance)
                    }

                    // Caps
                    if (currentLongRun > 36) currentLongRun = 36; // Hard cap
                    if (currentLongRun > currentCapacity * 0.55) currentLongRun = currentCapacity * 0.55;

                    // Update peaks
                    if (vol > peakKm) peakKm = vol;
                    if (longRun > peakLongRun) peakLongRun = longRun;

                    // PREPARE FOR NEXT WEEK
                    // Next week = This Week * (1 + rate)
                    currentCapacity = vol * (1 + progressionRate);
                    currentLongRun = longRun + longRunProgression;
                }
            }

            // Rounding (1 decimal place)
            // Ensure Long Run has 1 decimal
            longRun = Math.round(longRun * 10) / 10;
            vol = Math.round(vol * 10) / 10;

            // Date Calc
            let weekStartDate = new Date(planStart);
            weekStartDate.setDate(planStart.getDate() + ((currentWeek - 1) * 7));

            plan.push({
                week: currentWeek,
                // Hierarchy: Phase -> Block -> Week
                phaseName: phaseName,
                blockNum: currentBlockNum,
                blockType: blockType,
                blockLength: length,
                positionInBlock: i,

                weekName: weekName,
                focus: focus,

                isRaceWeek: isRaceWeek,
                startDate: `${weekStartDate.getFullYear()}-${String(weekStartDate.getMonth() + 1).padStart(2, '0')}-${String(weekStartDate.getDate()).padStart(2, '0')}`,
                startDateObj: weekStartDate,

                rawKm: vol,
                mileage: vol.toFixed(1), // String for display
                longRun: longRun.toFixed(1), // String for display
                remaining: (vol - longRun).toFixed(1),
                schedule: []
            });
            currentWeek++;
        }
        currentBlockNum++;
    };

    // --- EXECUTE V5.0 GENERATION SEQUENCE (Chronological Order) ---

    // 1. Early Blocks (Phase 1 & 2)
    structure.earlyBlockLengths.forEach((len, index) => {
        // Naming the phases
        let pName = "Base Phase";
        // If it's the LAST base block, name it "Base/Build"
        if (index === structure.earlyBlockLengths.length - 1) {
            pName = "Base/Build Phase";
        } else if (index >= structure.earlyBlockLengths.length / 2) {
            pName = "Build Phase";
        }

        addBlock(len, pName, "Build");
    });

    // 2. Anchor Block (Phase 3: Specificity)
    addBlock(structure.anchorWeeks, "Peak Phase", "Peak");

    // 3. Taper (Phase 4)
    addBlock(structure.taperWeeks, "Taper Phase", "Taper");

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
        startWithRestWeek: state.startWithRestWeek || false
    };

    const plan = calculateMarathonPlan(startVol, startLR, state.raceDate, options);
    state.generatedPlan = plan;
    return plan;
}