class RunningAdapter {
    constructor() {
        this.name = "Running";
        this.id = "Running";
    }

    getConfigContainerId() {
        return "running-config-container";
    }

    getPlanStartDateInputId() {
        return "planStartDateInputRun";
    }

    getVolumeUnit() {
        return "km";
    }

    getLongSessionLabel() {
        return "Long Run";
    }

    generatePlan(inputs, globalSettings) {
        // Extract inputs specific to Running
        const startVol = inputs.startVolume || 30;
        const startLR = inputs.startLongRun || 10;
        const progressionRate = inputs.progressionRate || 0.07; // P2: Default 7% (was 10%)
        const taperDuration = inputs.taperDuration || 3;
        const longRunProgression = inputs.longRunProgression || 2.0;
        const raceType = inputs.raceType || "Marathon";

        const raceDateStr = globalSettings.raceDate;
        const planStartDate = globalSettings.planStartDate;

        const options = {
            progressionRate,
            taperDuration,
            longRunProgression,
            raceType,
            startWithRestWeek: globalSettings.startWithRestWeek,
            customRestWeeks: globalSettings.customRestWeeks || [],
            forceBuildWeeks: globalSettings.forceBuildWeeks || []
        };

        return this.calculateMarathonPlan(startVol, startLR, raceDateStr, planStartDate, options);
    }

    // --- Logic migrated from planning-running.js ---
    calculateMarathonPlan(startVol, startLR, raceDateStr, planStartDate, options = {}) {
        // Input Validation
        startVol = parseFloat(startVol);
        startLR = parseFloat(startLR);

        // Robust fallbacks
        if (isNaN(startVol) || startVol < 0) startVol = 30;
        if (isNaN(startLR) || startLR < 0) startLR = 10;

        // Helper to parse "YYYY-MM-DD" as local date (00:00:00) to avoid UTC shifts
        const parseLocal = (dateStr) => {
            if (!dateStr) return null;
            const [y, m, d] = dateStr.split('-').map(Number);
            return new Date(y, m - 1, d);
        };

        const raceDate = parseLocal(raceDateStr);
        if (!raceDate || isNaN(raceDate.getTime())) {
            console.error("Invalid race date");
            return [];
        }

        // Use Plan Start Date if provided, otherwise default to Today
        // For "Today", we just take new Date(), but zero out time.
        let today;
        if (planStartDate) {
            today = parseLocal(planStartDate);
        } else {
            today = new Date();
            today.setHours(0, 0, 0, 0);
        }

        if (!today || isNaN(today.getTime())) {
            console.error("Invalid plan start date");
            return [];
        }

        // Force Start Date to Monday of Current Week (if not already)
        const day = today.getDay() || 7; // 1=Mon, 7=Sun
        if (day !== 1) {
            today.setDate(today.getDate() - day + 1);
        }
        // Ensure strictly midnight
        today.setHours(0, 0, 0, 0);

        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        const weeksUntilRace = Math.ceil((raceDate - today) / msPerWeek);

        if (weeksUntilRace < 1) return [];

        // Options
        const progressionRate = options.progressionRate || 0.07; // P2: Default 7% (was 10%)
        const startWithRestWeek = options.startWithRestWeek || false;
        const customRestWeeks = options.customRestWeeks || [];
        const forceBuildWeeks = options.forceBuildWeeks || [];
        const raceType = options.raceType || "Marathon";

        // --- RACE TYPE CONFIGURATION ---
        const RACE_CONFIG = {
            "Half Marathon": { maxLongRun: 22.0, taper: 1, lrProg: 1.5, raceDist: 21.1 },
            "10k": { maxLongRun: 16.0, taper: 1, lrProg: 1.0, raceDist: 10.0 },
            "Marathon": { maxLongRun: 36.0, taper: 3, lrProg: 2.0, raceDist: 42.2 }
        };

        const config = RACE_CONFIG[raceType] || RACE_CONFIG["Marathon"];

        // SAFETY RAIL: Max weekly volume caps (prevent exponential growth)
        const MAX_WEEKLY_VOL = {
            "Marathon": 120,
            "Half Marathon": 80,
            "10k": 60,
            "5k": 50,
            "General Fitness": 70
        };
        const maxWeeklyVolume = MAX_WEEKLY_VOL[raceType] || 70;

        // SAFETY RAIL: Long run cannot exceed this ratio of weekly volume
        const LONG_RUN_MAX_RATIO = 0.50;

        // Allow override from options, but default to race-type specific defaults
        const taperDuration = options.taperDuration !== undefined ? options.taperDuration : config.taper;
        const longRunProgression = options.longRunProgression !== undefined ? options.longRunProgression : config.lrProg;
        const maxLongRunCap = config.maxLongRun;

        // --- FORWARD GENERATION RE-IMPLEMENTATION ---
        let plan = [];
        let currentCapacity = parseFloat(startVol);
        let currentLongRun = parseFloat(startLR);
        let currentBlockNum = 1;

        for (let i = 0; i < weeksUntilRace; i++) {
            const weekNum = i + 1;
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() + (i * 7));

            // Determine Phase/Block based on weeks remaining
            const weeksRemaining = weeksUntilRace - i; // 1 means Race Week

            let phaseName = window.PHASES.BASE;
            let blockType = "Base";
            let isRaceWeek = (weeksRemaining === 1);

            if (isRaceWeek) {
                phaseName = window.PHASES.RACE;
                blockType = "Race";
            } else if (weeksRemaining <= config.taper + 1) {
                // Taper Phase
                phaseName = window.PHASES.TAPER;
                blockType = "Taper";
            } else if (weeksRemaining <= taperDuration + 3) {
                phaseName = window.PHASES.PEAK;
                blockType = "Peak";
            } else if (weeksRemaining === taperDuration + 4) {
                // RECOVERY WEEK BEFORE PEAK - Force recovery before entering Peak phase
                phaseName = window.PHASES.RECOVERY;
                blockType = "Base"; // Treat as recovery, not Peak
            } else if (weeksRemaining <= taperDuration + 3 + 4) {
                phaseName = window.PHASES.BUILD;
                blockType = "Build";
            } else {
                // If it's the very last block before Build, call it Base
                // formerly 'Base/Build Phase', now simplified to Base to avoid ambiguity
                phaseName = window.PHASES.BASE;
                blockType = "Base";
            }

            // --- 3-HOUR CAP LOGIC (Gap 2) ---
            const userEasyPace = options.userEasyPace || 6.0; // Default 6min/km if missing
            const MAX_DURATION_MINS = 180; // 3 Hours
            const estDuration = currentLongRun * userEasyPace;

            if (estDuration > MAX_DURATION_MINS) {
                currentLongRun = MAX_DURATION_MINS / userEasyPace;
                // Optional: Log/Warn about capping?
            }
            // --- VOLUME & LONG RUN ---
            let vol, longRun;
            let isRecoveryWeek = false;

            // FORCE RECOVERY: Pre-Peak Recovery week
            if (phaseName === window.PHASES.RECOVERY) {
                isRecoveryWeek = true;
            }

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
                            const previousVolume = currentCapacity;
                            currentCapacity = currentCapacity * (1 + progressionRate);

                            // FIX #6: Cap long run progression by volume increase
                            // Long run cannot grow faster than 40% of volume increase
                            const volumeIncrease = currentCapacity - previousVolume;
                            const maxLRIncrease = volumeIncrease * 0.40;
                            const cappedLRProgression = Math.min(longRunProgression, maxLRIncrease);
                            currentLongRun = currentLongRun + cappedLRProgression;
                        }
                    }

                    // Peak Week Logic (Last week of Peak Phase)
                    if (blockType === "Peak" && weeksRemaining === taperDuration + 1) {
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

            // SAFETY RAIL 1: Volume cap (prevent exponential growth)
            if (vol > maxWeeklyVolume) vol = maxWeeklyVolume;

            // SAFETY RAIL 2: Formula-Based Long Run Constraints (Marathon Valve)
            // Uses getLongRunConstraints() for linear decay + race-specific exceptions
            const constraints = getLongRunConstraints(vol, raceType, blockType, isRecoveryWeek);

            // Apply ratio cap
            let targetLongRun = vol * constraints.maxRatio;

            // Apply minimum floor (Marathon/HM peak exception)
            // P0 FIX: NO VOLUME BUMP - availability is king
            if (targetLongRun < constraints.minDistanceFloor) {
                // Check if floor exceeds availability
                if (constraints.minDistanceFloor > vol * 0.65) {
                    // Cap at 65% max, warn user
                    targetLongRun = vol * 0.65;
                    console.warn(`[Marathon Valve] LR floor ${constraints.minDistanceFloor}km exceeds safe ratio. Capped to ${targetLongRun.toFixed(1)}km.`);
                } else {
                    targetLongRun = constraints.minDistanceFloor;
                }
            }

            // Cap by race-specific max long run
            if (targetLongRun > maxLongRunCap) {
                targetLongRun = maxLongRunCap;
            }

            // P1 FIX: Don't let the ratio-based target overwrite the reduced recovery distance if it's higher
            if (isRecoveryWeek) {
                // If the specific recovery calculation (line 232) is considerably smaller than the generic allowed ratio, keep it.
                // We basically want the smaller of the two to ensure it's actually a cutback.
                longRun = Math.min(longRun, targetLongRun);
            } else {
                longRun = targetLongRun;
            }

            // LONG RUN DOMINANT WEEK: If LR > 50% of volume, skip 2nd KEY
            // (Renamed from 'polarizedWeek' - this is safety logic, not training model)
            const isLongRunDominantWeek = (longRun / vol) > 0.50;
            let longRunDominantWeek = false;
            if (isLongRunDominantWeek && !isRecoveryWeek) {
                longRunDominantWeek = true;
                // Note: This flag will be passed to AI to enforce no KEY intervals
            }

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
                startDate: weekStart.toISOString(),
                date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                rawKm: vol,
                mileage: vol.toFixed(1),
                targetDistance: vol,
                targetTSS: 0,
                longRun: longRun,
                isRaceWeek: isRaceWeek,
                isRecoveryWeek: isRecoveryWeek,  // P1 Fix: For KEY intensity downgrade
                focus: focus,
                // LONG RUN DOMINANT: If true, no KEY intervals - only Long Run as intensity
                longRunDominantWeek: longRunDominantWeek,
                longRunRatio: parseFloat((longRun / vol).toFixed(2)),
                // Race Day Details (only for Race Week)
                raceDetails: isRaceWeek ? {
                    raceType: raceType,
                    distance: config.raceDist,
                    raceDate: raceDateStr,
                    goalTime: options.goalTime || null // User's goal time if set
                } : null
            });

            if (isRecoveryWeek || (vol < currentCapacity * 0.7 && !isRaceWeek && blockType !== "Taper")) {
                currentBlockNum++;
            }
        }

        return plan;
    }
}

/**
 * Calculates Long Run constraints with "Marathon Valve" logic.
 * Linear decay baseline + race-specific Peak exceptions + recovery override.
 * P0 FIX: Floors are now gated behind history prerequisites.
 * 
 * @param {number} weeklyVolumeKm - Current weekly volume target
 * @param {string} raceType - "Marathon", "Half Marathon", "10k", "5k"
 * @param {string} phase - "Base", "Build", "Peak", "Taper", "Race"
 * @param {boolean} isRecoveryWeek - Is this a recovery/deload week?
 * @param {Object} history - Optional history for floor gating { avgRecentVolume, injuryFlag, firstMarathon }
 * @returns {Object} { maxRatio: number, minDistanceFloor: number }
 */
function getLongRunConstraints(weeklyVolumeKm, raceType, phase, isRecoveryWeek, history = {}) {
    // 1. Calculate Standard Linear Safety Ratio (Baseline)
    // 30km week → 0.45 | 110km week → 0.25
    const BASE_VOLUME = 30;
    const BASE_RATIO = 0.45;
    const DECAY_RATE = 0.0025;

    let allowedRatio = BASE_RATIO - ((weeklyVolumeKm - BASE_VOLUME) * DECAY_RATE);

    // Safety Clamps for Baseline
    if (allowedRatio > 0.50) allowedRatio = 0.50;
    if (allowedRatio < 0.20) allowedRatio = 0.20;

    let minFloor = 0; // Default: No minimum distance floor

    // P0 FIX: History-gated prerequisites for peak floors
    const avgRecentVolume = history.avgRecentVolume || 0;
    const injuryFlag = history.injuryFlag || false;
    const firstMarathon = history.firstMarathon || false;

    // Only enable floors if: avg volume ≥55km AND no injury AND not first marathon
    const canApplyFloor = (
        avgRecentVolume >= 55 &&
        !injuryFlag &&
        !firstMarathon
    );

    // 2. APPLY PEAK PHASE EXCEPTIONS (Only if NOT a Recovery Week AND prerequisites met)
    if (!isRecoveryWeek && phase === "Peak") {

        // --- MARATHON PEAK EXCEPTION ---
        if (raceType === "Marathon") {
            // Allow ratio to go up to 60%
            if (allowedRatio < 0.60) allowedRatio = 0.60;
            // Absolute Floor: Only if history prerequisites are met
            if (canApplyFloor) {
                minFloor = 28.0;
            }
        }

        // --- HALF MARATHON PEAK EXCEPTION ---
        else if (raceType === "Half Marathon") {
            // Allow ratio to go up to 55%
            if (allowedRatio < 0.55) allowedRatio = 0.55;
            // Absolute Floor: Only if history prerequisites are met
            if (canApplyFloor) {
                minFloor = 16.0;
            }
        }
    }

    // 3. RECOVERY WEEK OVERRIDE
    // Force strict safety: cap at 40%, remove floors
    if (isRecoveryWeek) {
        allowedRatio = Math.min(allowedRatio, 0.40);
        minFloor = 0;
    }

    return {
        maxRatio: parseFloat(allowedRatio.toFixed(2)),
        minDistanceFloor: minFloor
    };
}

// Expose to window
window.RunningAdapter = RunningAdapter;
window.getLongRunConstraints = getLongRunConstraints;
