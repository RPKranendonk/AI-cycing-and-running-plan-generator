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

function getStartingTSS() {
    let maxTss = 0;
    if (state.activities && state.activities.length > 0) {
        // Look at last 4 weeks
        const now = new Date();
        const fourWeeksAgo = new Date(now);
        fourWeeksAgo.setDate(now.getDate() - 28);

        const weeklyTss = {};
        state.activities.forEach(act => {
            if (act.type === 'Ride' || act.type === 'VirtualRide') {
                const d = new Date(act.start_date_local);
                if (d >= fourWeeksAgo && d <= now) {
                    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
                    if (!weeklyTss[weekKey]) weeklyTss[weekKey] = 0;
                    weeklyTss[weekKey] += (act.icu_intensity || 0); // Assuming icu_intensity is TSS-like or load
                }
            }
        });

        // Find max
        Object.values(weeklyTss).forEach(tss => {
            if (tss > maxTss) maxTss = tss;
        });
    }
    return maxTss > 0 ? maxTss : 300; // Default fallback
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

    // Force Start Date to Monday of Current Week
    const today = new Date();
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

function calculateCyclingPlan(startTss, currentCtl, raceDateStr, options = {}, startLongRideHours = 1.5) {
    const raceDate = new Date(raceDateStr);
    const today = new Date();
    const day = today.getDay() || 7;
    if (day !== 1) today.setDate(today.getDate() - day + 1);
    today.setHours(0, 0, 0, 0);

    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const weeksUntilRace = Math.ceil((raceDate - today) / msPerWeek);

    if (weeksUntilRace < 1) return [];

    const rampRate = options.rampRate || 5;
    const taperDuration = 1; // Fixed 1 week taper for cycling per request

    let plan = [];
    let currentFitness = currentCtl || 40; // Default CTL
    let currentBlockNum = 1;
    let weekInBlock = 1;
    let currentLongRide = startLongRideHours;

    for (let i = 0; i < weeksUntilRace; i++) {
        const weekNum = i + 1;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + (i * 7));
        const weeksRemaining = weeksUntilRace - i;
        let isRaceWeek = (weeksRemaining === 1);
        let isTaperWeek = (weeksRemaining <= taperDuration + 1 && !isRaceWeek); // Taper is 1 week before race

        let targetTss = 0;
        let weekName = "Build Week";
        let focus = "Load";
        let blockType = "Build";
        let longRideDuration = currentLongRide;

        if (isRaceWeek) {
            weekName = "Race Week";
            blockType = "Race";
            focus = "Race";
            // Race week TSS is low, mostly from the race itself + openers
            targetTss = 150 + (options.raceDistance || 100); // Rough estimate
            longRideDuration = 0; // Race day
        } else if (isTaperWeek) {
            weekName = "Taper Week";
            blockType = "Taper";
            focus = "Freshness";
            // Taper: Drop volume significantly
            targetTss = (plan[plan.length - 1].rawKm || 300) * 0.6; // 60% of previous week
            longRideDuration = currentLongRide * 0.6;
        } else {
            // Standard 3:1 Block Structure

            if (weekInBlock === 4) {
                // Recovery Week
                weekName = "Recovery Week";
                focus = "Shed Fatigue";
                // 50-60% of previous week (Week 3)
                const prevWeekTss = plan.length > 0 ? plan[plan.length - 1].rawKm : startTss;
                targetTss = prevWeekTss * 0.55;
                longRideDuration = currentLongRide * 0.7; // Reduced long ride

                // End of block
                weekInBlock = 0; // Will increment to 1 next loop
                currentBlockNum++;
            } else {
                // Load Week
                if (i === 0) {
                    targetTss = startTss;
                    longRideDuration = startLongRideHours;
                } else {
                    const prevTss = plan[plan.length - 1].rawKm;

                    if (weekInBlock === 1 && i > 0) {
                        // Start of new block.
                        // Look at Week 3 of prev block (last load week)
                        let lastLoadTss = startTss;
                        let lastLoadLR = startLongRideHours;
                        for (let k = plan.length - 1; k >= 0; k--) {
                            if (plan[k].weekName === "Build Week") {
                                lastLoadTss = plan[k].rawKm;
                                lastLoadLR = plan[k].longRun;
                                break;
                            }
                        }
                        targetTss = lastLoadTss + (rampRate * 5);
                        // Increase Long Ride slightly for new block
                        currentLongRide = lastLoadLR + 0.5; // Add 30 mins per block? Or just keep steady?
                        // User said "long run progression, take this one out".
                        // Maybe just keep it steady or very slow build.
                        // Let's assume steady for now or very small increment.
                        longRideDuration = currentLongRide;
                    } else {
                        targetTss = prevTss + (rampRate * 7);
                        longRideDuration = currentLongRide;
                    }
                }
            }
            weekInBlock++;
        }

        plan.push({
            week: weekNum,
            blockNum: currentBlockNum,
            weekName: weekName,
            phaseName: "Build Phase",
            blockType: blockType,
            startDateObj: weekStart,
            startDate: weekStart.toISOString(),
            date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rawKm: Math.round(targetTss), // Using rawKm field to store TSS for now
            mileage: Math.round(targetTss), // Display TSS
            longRun: parseFloat(longRideDuration.toFixed(1)), // Hours
            isRaceWeek: isRaceWeek,
            focus: focus
        });
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
        forceBuildWeeks: state.forceBuildWeeks || [],
        rampRate: state.rampRate,
        raceDistance: parseFloat(state.raceType) || 100 // Extract distance for cycling
    };

    let plan = [];
    if (state.sportType === "Cycling") {
        // Map generic inputs to cycling specific ones
        let startTss = parseFloat(state.startingVolume);
        if (isNaN(startTss)) startTss = getStartingTSS();

        // Ramp Rate comes from progressionRate input (values 3, 5, 7)
        // Ensure we have a valid integer for ramp rate
        options.rampRate = parseInt(state.progressionRate) || 5;

        // Long Ride comes from startingLongRun input (Hours)
        let startLongRideHours = parseFloat(state.startingLongRun) || 1.5;

        // Get CTL from wellness if available
        let currentCtl = 40;
        if (state.wellness && state.wellness.length > 0) {
            // Sort by date
            const sorted = [...state.wellness].sort((a, b) => new Date(b.id) - new Date(a.id));
            if (sorted[0].ctl) currentCtl = sorted[0].ctl;
        }

        // Calculate total weeks
        const msPerWeek = 1000 * 60 * 60 * 24 * 7;
        const today = new Date();
        const raceDate = new Date(state.raceDate);
        const totalWeeks = Math.ceil((raceDate - today) / msPerWeek);

        // Long Ride Cap (User requested 4h)
        const longRideCapHours = 4.0;

        // Use new advanced logic
        const advancedPlan = calculateAdvancedCyclingPlan(
            currentCtl,
            options.rampRate,
            startLongRideHours,
            longRideCapHours,
            totalWeeks,
            totalWeeks,
            options.customRestWeeks,
            options.taperDuration || 1,
            options.forceBuildWeeks || [],
            options.startWithRestWeek
        );

        // Map advanced plan to existing structure for UI compatibility
        plan = advancedPlan.map(w => {
            const weekStart = new Date(today);
            weekStart.setDate(today.getDate() + ((w.weekNumber - 1) * 7));

            return {
                week: w.weekNumber,
                blockNum: Math.ceil(w.weekNumber / 4), // Rough block mapping
                weekName: w.weekName,
                phaseName: w.phase,
                blockType: w.isRecovery ? "Recovery" : "Build",
                startDateObj: weekStart,
                startDate: weekStart.toISOString(),
                date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                rawKm: w.goalLoad,
                mileage: w.goalLoad, // TSS
                longRun: w.longRideDuration, // Hours
                isRaceWeek: false,
                focus: w.isRecovery ? "Recovery" : "Load"
            };
        });

        if (plan.length > 0) {
            const lastWeek = plan[plan.length - 1];
            lastWeek.weekName = "Race Week";
            lastWeek.blockType = "Race";
            lastWeek.focus = "Race";
            lastWeek.isRaceWeek = true;
        }

    } else {
        plan = calculateMarathonPlan(startVol, startLR, state.raceDate, options);
    }

    state.generatedPlan = plan;
    return plan;
}

/**
 * Advanced Cycling Coaching Engine
 * Generates a weekly training schedule using Intervals.icu terminology.
 * 
 *
 * @param {number} startFitness - Starting CTL (e.g., 40)
 * @param {number} targetRampRate - Desired weekly ramp rate (e.g., 3, 5, 7)
 * @param {number} longRideStartHours - Starting duration for long ride (e.g., 1.5)
 * @param {number} longRideCapHours - Max duration for long ride (e.g., 6.0)
 * @param {number} totalWeeks - Total duration of the plan
 * @param {Array} customRestWeeks - Array of week numbers to force as recovery
 * @param {number} taperDuration - Number of taper weeks (1 or 2)
 * @param {Array} forceBuildWeeks - Array of week numbers to force as build (skip recovery)
 * @param {boolean} startWithRestWeek - Whether to start with a recovery week
 * @returns {Array} Array of weekly plan objects
 */
function calculateAdvancedCyclingPlan(startFitness, targetRampRate, longRideStartHours, longRideCapHours, totalWeeks, customRestWeeks = [], taperDuration = 1, forceBuildWeeks = [], startWithRestWeek = false) {
    // Safety Checks for Arrays
    if (!Array.isArray(customRestWeeks)) customRestWeeks = [];
    if (!Array.isArray(forceBuildWeeks)) forceBuildWeeks = [];

    let plan = [];
    let currentFitness = startFitness;

    // Enforce Min Long Ride (2h) per user request
    let currentLongRideDuration = Math.max(longRideStartHours, 2.0);

    // Cycle: 4 weeks (3 Load : 1 Recovery)
    let peakLoad = 0; // Store load of the 3rd week of every block

    for (let week = 1; week <= totalWeeks; week++) {
        const weeksRemaining = totalWeeks - week;
        const isTaper = weeksRemaining < taperDuration; // Last 1 or 2 weeks

        // Determine if Recovery
        let isRecovery = false;

        if (customRestWeeks.includes(week)) {
            isRecovery = true;
        } else if (forceBuildWeeks.includes(week)) {
            isRecovery = false;
        } else if (!isTaper) {
            // Fixed 4-Week Cycle Logic (Matches Running)
            if (startWithRestWeek) {
                if ((week - 1) % 4 === 0) isRecovery = true;
            } else {
                if (week % 4 === 0) isRecovery = true;
            }
        }

        let goalLoad = 0;
        let weekName = "";
        let phase = "";
        let longRideDuration = 0;
        let longRideLoad = 0;

        // Determine Week Type in Block based on previous week
        const prevWeek = plan.length > 0 ? plan[plan.length - 1] : null;
        const isPostRecovery = prevWeek && prevWeek.isRecovery && !isRecovery && !isTaper;

        if (isTaper) {
            weekName = "Taper Week";
            phase = "Taper";
            // Taper: Drop volume based on weeks out (similar to running)
            // But here we just use fixed 65% for the 1 week taper
            const prevLoad = prevWeek ? prevWeek.goalLoad : (startFitness * 7);
            goalLoad = prevLoad * 0.65;
            longRideDuration = currentLongRideDuration * 0.60;
            currentFitness -= 1; // Slight decay
        } else if (isRecovery) {
            weekName = "Recovery Week";
            phase = "Recovery";

            // Recovery Logic (Matches Running):
            // Drop load to 60% of CURRENT fitness capacity
            // Do NOT decay currentFitness here, so we can resume from it
            const baseLoad = 7 * currentFitness;
            goalLoad = baseLoad * 0.60;

            // Long Ride: Cut by 50%
            longRideDuration = currentLongRideDuration * 0.50;

        } else {
            weekName = "Build Week";
            phase = "Build";

            if (isPostRecovery) {
                // RESTART LOGIC (Matches Running):
                // Reduce Fitness slightly to account for the rest week
                // Running uses: currentCapacity * (1 - progressionRate)
                // We'll use a fixed factor or the ramp rate logic inverted
                // Let's step back 1 week of fitness? Or just hold steady?
                // Running: currentCapacity = currentCapacity * (1 - progressionRate);
                // Cycling equivalent: currentFitness -= targetRampRate;
                currentFitness -= targetRampRate; // Step back slightly

                // Long Ride: Step back slightly too? Running does.
                // Running: currentLongRun = currentLongRun - longRunProgression;
                // Cycling: currentLongRideDuration -= 0.5;
                currentLongRideDuration = Math.max(longRideStartHours, currentLongRideDuration - 0.5);
                longRideDuration = currentLongRideDuration;

            } else {
                // NORMAL PROGRESSION (Matches Running)
                // Increase Fitness
                currentFitness += targetRampRate;

                // Increase Long Ride
                if (week > 1) {
                    currentLongRideDuration = Math.min(currentLongRideDuration + 0.5, longRideCapHours);
                }
                longRideDuration = currentLongRideDuration;
            }

            // Calculate Load based on updated Fitness
            goalLoad = 7 * currentFitness;
        }
        // Calculate Long Ride Load
        // Formula: durationHours * 100 * 0.65^2 (assuming 0.65 IF)
        longRideLoad = longRideDuration * 100 * Math.pow(0.65, 2);

        // Remaining Budget
        let remainingLoadBudget = goalLoad - longRideLoad - 60;
        if (remainingLoadBudget < 0) remainingLoadBudget = 0;

        plan.push({
            weekNumber: week,
            weekName: weekName,
            phase: phase,
            goalLoad: Math.round(goalLoad),
            predictedFitness: Math.round(currentFitness),
            longRideDuration: parseFloat(longRideDuration.toFixed(1)),
            longRideLoad: Math.round(longRideLoad),
            remainingLoadBudget: Math.round(remainingLoadBudget),
            isRecovery: isRecovery,
            isTaper: isTaper
        });
    }

    return plan;
}