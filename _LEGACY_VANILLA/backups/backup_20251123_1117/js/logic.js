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

function calculateScheduleStructure(totalWeeks) {
    // I. INPUT VARIABLE: Total_Weeks

    // II. STEP 1: CALCULATE TAPER (T)
    const T = totalWeeks >= 18 ? 3 : 2;

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

function generateTrainingPlan() {
    // 1. Setup Dates
    const planStart = new Date();
    const day = planStart.getDay() || 7;
    if (day !== 1) planStart.setHours(-24 * (day - 1));
    planStart.setHours(0, 0, 0, 0);

    if (!state.raceDate) {
        console.warn("No race date set");
        return [];
    }

    const raceDate = new Date(state.raceDate);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((raceDate - planStart) / msPerWeek);

    // 2. Get Logic Structure v5.0
    const structure = calculateScheduleStructure(totalWeeks);

    // 3. Setup Volume
    let currentCapacity = getStartingVolume();
    let currentLongRun = Math.ceil(state.lastWeekLongRun || 10);
    const progressionRate = state.progressionRate || 0.10;
    const restWeekFactor = 0.60;

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

            // --- VOLUME CALCULATION ---
            let vol, longRun;

            if (blockType === "Taper") {
                const weeksOut = length - i;
                if (weeksOut === 0) { // Race
                    vol = peakKm * 0.40;
                    longRun = 42.2;
                } else if (weeksOut === 1) { // 1 week out
                    vol = peakKm * 0.60;
                    longRun = 12;
                } else { // 2 weeks out
                    vol = peakKm * 0.80;
                    longRun = peakLongRun * 0.75;
                }
            } else {
                if (isRecoveryWeek) {
                    // Recovery Week: Drop volume
                    vol = currentCapacity * restWeekFactor;
                    longRun = currentLongRun * restWeekFactor;
                    // Do not update currentCapacity/currentLongRun base variables (preserve high water mark)
                } else {
                    // --- STEP BACK LOGIC START ---
                    // Check if the previous week was a Recovery week
                    const lastWeekIndex = plan.length - 1;
                    const lastWeek = lastWeekIndex >= 0 ? plan[lastWeekIndex] : null;

                    if (lastWeek && lastWeek.weekName === "Recovery") {
                        // RESTART LOGIC: "Same as 3 weeks before"
                        // Look back 3 weeks in the plan to find the restart volume
                        const lookbackIndex = plan.length - 3;

                        if (lookbackIndex >= 0) {
                            currentCapacity = plan[lookbackIndex].rawKm;
                            currentLongRun = plan[lookbackIndex].longRun;
                        } else {
                            // Fallback if not enough history
                            currentCapacity = currentCapacity * (1 + progressionRate);
                            currentLongRun = currentLongRun + 1.5;
                        }
                    } else {
                        // NORMAL PROGRESSION
                        currentCapacity = currentCapacity * (1 + progressionRate);
                        currentLongRun = currentLongRun + 2;
                    }
                    // --- STEP BACK LOGIC END ---

                    // Caps
                    if (currentLongRun > 34) currentLongRun = 34;
                    if (currentLongRun > currentCapacity * 0.55) currentLongRun = currentCapacity * 0.55;

                    vol = currentCapacity;
                    longRun = currentLongRun;

                    // Update peaks
                    if (vol > peakKm) peakKm = vol;
                    if (longRun > peakLongRun) peakLongRun = longRun;
                }
            }

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
                startDate: weekStartDate.toISOString(),

                rawKm: vol,
                mileage: Math.round(vol),
                longRun: Math.round(longRun),
                remaining: Math.round(vol - longRun),
                schedule: []
            });
            currentWeek++;
        }
        currentBlockNum++;
    };

    // --- EXECUTE V5.0 GENERATION SEQUENCE (Chronological Order) ---

    // 1. Early Blocks (Phase 1 & 2)
    structure.earlyBlockLengths.forEach((len, index) => {
        // Naming the phases based on how early they are
        let pName = "Base Phase";
        if (index >= structure.earlyBlockLengths.length / 2) pName = "Build Phase";

        addBlock(len, pName, "Build");
    });

    // 2. Anchor Block (Phase 3: Specificity)
    addBlock(structure.anchorWeeks, "Peak Phase", "Peak");

    // 3. Taper (Phase 4)
    addBlock(structure.taperWeeks, "Taper Phase", "Taper");

    state.generatedPlan = plan;
    return plan;
}