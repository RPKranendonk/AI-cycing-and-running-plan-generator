// ==========================================
// RUNNING PLANNING LOGIC
// ==========================================

function calculateMarathonPlan(startVol, startLR, raceDateStr, planStartDate, options = {}) {
    // Input Validation
    startVol = parseFloat(startVol);
    startLR = parseFloat(startLR);

    // Robust fallbacks
    if (isNaN(startVol) || startVol < 0) startVol = 30;
    if (isNaN(startLR) || startLR < 0) startLR = 10;

    const raceDate = new Date(raceDateStr);
    if (isNaN(raceDate.getTime())) {
        console.error("Invalid race date");
        return [];
    }

    // Use Plan Start Date if provided, otherwise default to Today
    const today = planStartDate ? new Date(planStartDate) : new Date();
    if (isNaN(today.getTime())) {
        console.error("Invalid plan start date");
        return [];
    }

    // Force Start Date to Monday of Current Week (if not already)
    const day = today.getDay() || 7; // 1=Mon, 7=Sun
    if (day !== 1) {
        today.setDate(today.getDate() - day + 1);
    }
    today.setHours(0, 0, 0, 0);

    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksUntilRace = Math.ceil((raceDate - today) / msPerWeek);

    if (weeksUntilRace < 1) return [];

    // Options
    const progressionRate = options.progressionRate || 0.10;
    const startWithRestWeek = options.startWithRestWeek || false;
    const customRestWeeks = options.customRestWeeks || [];
    const forceBuildWeeks = options.forceBuildWeeks || [];
    const raceType = options.raceType || "Marathon";

    // --- RACE TYPE CONFIGURATION ---
    const RACE_CONFIG = {
        "Half Marathon": { maxLongRun: 22.0, taper: 2, lrProg: 1.5, raceDist: 21.1 },
        "10k": { maxLongRun: 16.0, taper: 1, lrProg: 1.0, raceDist: 10.0 },
        "Marathon": { maxLongRun: 36.0, taper: 3, lrProg: 2.0, raceDist: 42.2 }
    };

    const config = RACE_CONFIG[raceType] || RACE_CONFIG["Marathon"];

    // Allow override from options, but default to race-type specific defaults
    const taperDuration = options.taperDuration !== undefined ? options.taperDuration : config.taper;
    const longRunProgression = options.longRunProgression !== undefined ? options.longRunProgression : config.lrProg;
    const maxLongRunCap = config.maxLongRun;

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
