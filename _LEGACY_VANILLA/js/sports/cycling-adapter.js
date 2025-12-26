class CyclingAdapter extends SportAdapter {
    constructor() {
        super("Cycling", "cycling");
    }

    getConfigContainerId() {
        return "cycling-config-container";
    }

    getPlanStartDateInputId() {
        return "planStartDateInputCycle";
    }

    getVolumeUnit() {
        return "TSS";
    }

    getLongSessionLabel() {
        return "Long Ride";
    }

    generatePlan(inputs, globalSettings) {
        // Extract inputs specific to Cycling
        const startTss = inputs.startTss || 300;
        const currentCtl = inputs.currentCtl || 40;
        const rampRate = inputs.rampRate || 5;
        const taperDuration = inputs.taperDuration || 1;
        const startLongRide = inputs.startLongRide || 2.0;

        const raceDateStr = globalSettings.raceDate;
        const planStartDate = globalSettings.planStartDate;

        const options = {
            rampRate,
            taperDuration,
            planStartDate,
            customRestWeeks: globalSettings.customRestWeeks || [],
            forceBuildWeeks: globalSettings.forceBuildWeeks || [],
            startWithRestWeek: globalSettings.startWithRestWeek
        };

        return this.calculateAdvancedCyclingPlan(startTss, currentCtl, raceDateStr, options, startLongRide);
    }

    // --- MIGRATED LOGIC FROM planning-cycling.js ---
    calculateAdvancedCyclingPlan(startTss, currentCtl, raceDateStr, options = {}, startLongRideHours = 2.0) {
        // Input Validation
        let startLoad = parseFloat(startTss); // This is essentially the starting weekly load (TSS)
        let fitness = parseFloat(currentCtl); // CTL

        // Options Extraction
        const rampRate = options.rampRate || 5; // CTL ramp per week

        // If startLoad looks like CTL (e.g. < 150), calculate implied weekly load to achieve ramp
        if (!isNaN(startLoad) && startLoad < 150) {
            startLoad = 7 * (startLoad + (6 * rampRate));
        }

        if (isNaN(startLoad) || startLoad < 0) startLoad = 300;
        if (isNaN(fitness) || fitness < 0) fitness = 40;

        // Helper to parse "YYYY-MM-DD" as local date
        const parseLocal = (dateStr) => {
            if (!dateStr) return null;
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        const raceDate = parseLocal(raceDateStr);
        if (!raceDate || isNaN(raceDate.getTime())) {
            console.error("Invalid race date for cycling plan");
            return [];
        }

        // Options Extraction
        const taperDuration = options.taperDuration || 1;
        const customRestWeeks = options.customRestWeeks || [];
        const forceBuildWeeks = options.forceBuildWeeks || [];
        const startWithRestWeek = options.startWithRestWeek || false;
        const longRideCap = options.longRideCap || 4.0;

        // SAFETY RAIL: Max weekly TSS (prevent impossible loads)
        const MAX_WEEKLY_TSS = 1200;

        // SAFETY RAIL: Max TSS per hour (realistic IF ~0.80)
        const MAX_TSS_PER_HOUR = 75;

        // Use Plan Start Date if provided, otherwise default to Today
        let planStartDate;
        if (options.planStartDate) {
            planStartDate = parseLocal(options.planStartDate);
        } else {
            planStartDate = new Date();
            planStartDate.setHours(0, 0, 0, 0);
        }

        if (!planStartDate || isNaN(planStartDate.getTime())) {
            // Fallback just in case
            planStartDate = new Date();
            planStartDate.setHours(0, 0, 0, 0);
        }

        // Force Start Date to Monday of Current Week (if not already)
        const day = planStartDate.getDay() || 7; // 1=Mon, 7=Sun
        if (day !== 1) {
            planStartDate.setDate(planStartDate.getDate() - day + 1);
        }
        planStartDate.setHours(0, 0, 0, 0);

        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        const weeksUntilRace = Math.ceil((raceDate - planStartDate) / msPerWeek);

        if (weeksUntilRace < 1) return [];

        let plan = [];

        // Initial State
        let currentFitness = fitness; // CTL
        let currentWeeklyLoad = startLoad; // TSS
        let currentLongRide = Math.max(2.0, Math.min(6, startLongRideHours));
        let currentBlockNum = 1;

        for (let i = 0; i < weeksUntilRace; i++) {
            const weekNum = i + 1;
            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + (i * 7));

            // Determine Phase/Block based on weeks remaining
            const weeksRemaining = weeksUntilRace - i; // 1 means Race Week

            let rawPhaseName = "Base Phase";
            let blockType = "Base";
            let isRaceWeek = (weeksRemaining === 1);

            if (isRaceWeek) {
                rawPhaseName = "Race Week";
                blockType = "Race";
            } else if (weeksRemaining <= taperDuration) {
                rawPhaseName = "Taper Phase";
                blockType = "Taper";
            } else if (weeksRemaining <= taperDuration + 3) {
                rawPhaseName = "Peak Phase";
                blockType = "Peak";
            } else if (weeksRemaining <= taperDuration + 3 + 4) {
                rawPhaseName = "Build Phase";
                blockType = "Build";
            } else {
                // If it's the very last block before Build, call it Base/Build
                if (weeksRemaining <= taperDuration + 3 + 4 + 4) {
                    rawPhaseName = "Base/Build Phase";
                } else {
                    rawPhaseName = "Base Phase";
                }
                blockType = "Base";
            }

            // BLOCK PHASE ALIGNMENT
            // Ensure the phase name is consistent for the entire block (to avoid UI splitting)
            // We store the phase name for each block index.
            if (!plan._blockPhases) plan._blockPhases = {};

            let phaseName = rawPhaseName;

            // Only override if NOT Race or Taper (those should be specific)
            if (blockType !== "Race" && blockType !== "Taper") {
                if (!plan._blockPhases[currentBlockNum]) {
                    plan._blockPhases[currentBlockNum] = rawPhaseName;
                }
                phaseName = plan._blockPhases[currentBlockNum];
            }

            // --- VOLUME & LONG RIDE ---
            let weeklyLoad = 0;
            let longRideDuration = 0;
            let isRecoveryWeek = false;

            if (blockType === "Race") {
                weeklyLoad = currentWeeklyLoad * 0.4;
                longRideDuration = 0;
            } else if (blockType === "Taper") {
                // Taper Logic
                const weeksOut = weeksRemaining - 1;
                let factor = 0.60 + (0.15 * (weeksOut - 1));
                if (factor > 0.90) factor = 0.90;

                weeklyLoad = currentWeeklyLoad * factor;
                longRideDuration = currentLongRide * factor;
            } else {
                // Training Block

                // Custom/Force Logic
                if (customRestWeeks.includes(weekNum)) isRecoveryWeek = true;
                else if (forceBuildWeeks.includes(weekNum)) isRecoveryWeek = false;
                else {
                    // Default Logic
                    if (blockType !== "Peak") {
                        if (startWithRestWeek) {
                            if ((weekNum - 1) % 4 === 0) isRecoveryWeek = true;
                        } else {
                            if (weekNum % 4 === 0) isRecoveryWeek = true;
                        }
                    }
                }

                if (isRecoveryWeek) {
                    // Recovery Week: Drop load
                    const restWeekFactor = 0.60;
                    weeklyLoad = currentWeeklyLoad * restWeekFactor;
                    longRideDuration = currentLongRide * restWeekFactor;
                } else {
                    // Check if previous week was Recovery
                    const lastWeekIndex = plan.length - 1;
                    const lastWeek = lastWeekIndex >= 0 ? plan[lastWeekIndex] : null;

                    if (lastWeek && (lastWeek.weekName.includes("Recovery") || lastWeek.weekName === "Recovery Start")) {
                        // RESTART LOGIC
                        currentFitness += rampRate;
                        currentWeeklyLoad = currentWeeklyLoad * 1.02; // Small bump
                        currentLongRide = currentLongRide; // Maintain long ride
                    } else {
                        // NORMAL PROGRESSION
                        if (i > 0) {
                            currentWeeklyLoad = currentWeeklyLoad * 1.05; // 5% increase per week
                            currentLongRide = Math.min(longRideCap, currentLongRide + 0.25); // +15 mins
                        }
                    }

                    // Peak Week Logic
                    if (blockType === "Peak" && weeksRemaining === taperDuration + 1) {
                        longRideDuration = currentLongRide - 0.5; // Reduce slightly
                        weeklyLoad = currentWeeklyLoad;
                    } else {
                        longRideDuration = currentLongRide;
                        weeklyLoad = currentWeeklyLoad;
                    }
                }
            }

            // Caps
            if (longRideDuration > longRideCap) longRideDuration = longRideCap;
            if (longRideDuration < 1.5 && !isRaceWeek && !isRecoveryWeek) longRideDuration = 1.5;

            // SAFETY RAIL: TSS cap (prevent impossible weekly loads)
            if (weeklyLoad > MAX_WEEKLY_TSS) weeklyLoad = MAX_WEEKLY_TSS;

            // Rounding
            weeklyLoad = Math.round(weeklyLoad);
            longRideDuration = parseFloat(longRideDuration.toFixed(1));

            // Block Number
            const blockNum = currentBlockNum;

            // Focus
            let focus = "Endurance";
            if (isRaceWeek) focus = "Race Day";
            else if (blockType === "Taper") focus = "Recovery & Sharpening";
            else if (blockType === "Peak") focus = "Race Specific";
            else if (blockType === "Build") focus = "Threshold";
            else if (isRecoveryWeek) focus = "Active Recovery";

            plan.push({
                week: weekNum,
                blockNum: blockNum,
                weekName: isRaceWeek ? "Race Week" : (blockType === "Taper" ? "Taper Week" : (isRecoveryWeek ? "Recovery Week" : "Build Week")),
                phaseName: phaseName,
                blockType: blockType,
                startDateObj: weekStart,
                startDate: weekStart.toISOString(),
                date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                rawKm: weeklyLoad, // Storing TSS in rawKm for compatibility with UI
                mileage: weeklyLoad, // Display TSS
                targetDistance: 0,   // Explicit Running Volume (km) - 0 for Bike
                targetTSS: weeklyLoad, // Explicit Cycling Load (TSS)
                longRun: longRideDuration, // Display Hours
                isRaceWeek: isRaceWeek,
                focus: focus,
                isRecovery: isRecoveryWeek
            });

            if (isRecoveryWeek || (weeklyLoad < currentWeeklyLoad * 0.7 && !isRaceWeek && blockType !== "Taper")) {
                currentBlockNum++;
            }
        }

        return plan;
    }
}

window.CyclingAdapter = CyclingAdapter;
