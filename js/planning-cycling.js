// ==========================================
// CYCLING PLANNING LOGIC
// ==========================================

function calculateCyclingPlan(startTss, currentCtl, raceDateStr, options = {}, startLongRideHours = 1.5) {
    // Input Validation
    startTss = parseFloat(startTss);
    currentCtl = parseFloat(currentCtl);
    if (isNaN(startTss)) startTss = 300; // Default fallback
    if (isNaN(currentCtl)) currentCtl = 40; // Default fallback

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

    // 2. Generate Base Plan
    let currentTss = startTss;
    let currentLongRide = startLongRideHours;

    // Determine Plan Start Date
    // If passed in options, use it, otherwise default to today (next Monday logic handled in main.js)
    const planStartDate = options.planStartDate ? new Date(options.planStartDate) : today;

    for (let i = 0; i < weeksUntilRace; i++) {
        const weekNum = i + 1;
        const weekStart = new Date(planStartDate);
        weekStart.setDate(planStartDate.getDate() + (i * 7));
        const dateStr = weekStart.toISOString().split('T')[0];

        // Determine Phase
        let phase = "Base 1";
        let focus = "Endurance";

        if (i > weeksUntilRace - 4) { phase = "Taper"; focus = "Recovery"; }
        else if (i > weeksUntilRace - 8) { phase = "Peak"; focus = "Intervals"; }
        else if (i > weeksUntilRace - 12) { phase = "Build 2"; focus = "Threshold"; }
        else if (i > weeksUntilRace - 16) { phase = "Build 1"; focus = "Tempo"; }
        else if (i > 8) { phase = "Base 3"; focus = "Endurance"; }
        else if (i > 4) { phase = "Base 2"; focus = "Endurance"; }

        // Calculate Weekly Load (TSS)
        // Week 1 should start exactly at startTss
        let weeklyTss = currentTss;

        // Apply Ramp Rate for subsequent weeks
        if (i > 0) {
            weeklyTss = currentTss + rampRate;
        }

        // Calculate Long Ride
        // Enforce Limits: Min 2h, Max 6h
        let longRide = currentLongRide;
        if (i > 0 && i % 4 !== 3) { // Increase every week except recovery
            longRide += 0.25; // +15 mins
        }

        // Hard Constraints
        if (longRide < 2) longRide = 2;
        if (longRide > 6) longRide = 6;

        // Recovery Weeks (every 4th week)
        let isRecovery = (weekNum % 4 === 0);
        if (isRecovery) {
            weeklyTss *= 0.6;
            longRide *= 0.7;
            if (longRide < 1.5) longRide = 1.5; // Allow slightly shorter for recovery
            phase = "Recovery";
            focus = "Recovery";
        }

        // Store for next iteration (unmodified by recovery)
        if (!isRecovery) {
            currentTss = weeklyTss;
            currentLongRide = longRide;
        }

        plan.push({
            week: weekNum,
            phaseName: phase,
            focus: focus,
            date: dateStr,
            weekName: `${phase} - Week ${weekNum}`,
            mileage: Math.round(weeklyTss), // Display TSS as "mileage" for now (UI will label it Load)
            longRun: longRide.toFixed(1),   // Display Hours
            rawKm: weeklyTss, // Store TSS in rawKm for compatibility
            rawLongRun: longRide
        });
    }

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
function calculateAdvancedCyclingPlan(startFitness, targetRampRate, longRideStartHours, longRideCapHours, totalWeeks, customRestWeeks = [], taperDuration = 1, forceBuildWeeks = [], startWithRestWeek = false, planStartDate = null) {
    // Safety Checks for Arrays
    if (!Array.isArray(customRestWeeks)) customRestWeeks = [];
    if (!Array.isArray(forceBuildWeeks)) forceBuildWeeks = [];

    let plan = [];
    let currentFitness = startFitness;

    // Enforce Min Long Ride (2h) per user request
    let currentLongRideDuration = Math.max(longRideStartHours, 2.0);

    // Cycle: 4 weeks (3 Load : 1 Recovery)
    let peakLoad = 0; // Store load of the 3rd week of every block

    // Default start date if not provided
    const startDate = planStartDate ? new Date(planStartDate) : new Date();

    for (let week = 1; week <= totalWeeks; week++) {
        const weeksRemaining = totalWeeks - week;
        const isRaceWeek = (weeksRemaining === 0);
        const isTaper = (weeksRemaining < taperDuration) && !isRaceWeek; // Last 1 or 2 weeks, excluding race week

        // Calculate Week Start Date
        const weekStart = new Date(startDate);
        weekStart.setDate(startDate.getDate() + ((week - 1) * 7));

        // Determine if Recovery
        let isRecovery = false;

        if (customRestWeeks.includes(week)) {
            isRecovery = true;
        } else if (forceBuildWeeks.includes(week)) {
            isRecovery = false;
        } else if (!isTaper && !isRaceWeek) {
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
        let focus = "Load";
        let longRideDuration = 0;
        let longRideLoad = 0;

        // Determine Week Type in Block based on previous week
        const prevWeek = plan.length > 0 ? plan[plan.length - 1] : null;
        const isPostRecovery = prevWeek && prevWeek.isRecovery && !isRecovery && !isTaper && !isRaceWeek;

        if (isRaceWeek) {
            weekName = "Race Week";
            phase = "Race";
            focus = "Race Day";
            // Race Week Logic
            // Low volume, high intensity (race)
            const prevLoad = prevWeek ? prevWeek.goalLoad : (startFitness * 7);
            goalLoad = prevLoad * 0.4; // Significant drop
            longRideDuration = 0; // No long ride on race week (race is the long ride)
            currentFitness -= 2; // Taper/Race decay
        } else if (isTaper) {
            weekName = "Taper Week";
            phase = "Taper";
            focus = "Freshness";
            // Taper: Drop volume based on weeks out (similar to running)
            // But here we just use fixed 65% for the 1 week taper
            const prevLoad = prevWeek ? prevWeek.goalLoad : (startFitness * 7);
            goalLoad = prevLoad * 0.65;
            longRideDuration = currentLongRideDuration * 0.60;
            currentFitness -= 1; // Slight decay
        } else if (isRecovery) {
            weekName = "Recovery Week";
            phase = "Recovery";
            focus = "Shed Fatigue";

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
            focus = "Load";

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
            week: week,
            weekName: weekName,
            phaseName: phase,
            goalLoad: Math.round(goalLoad),
            predictedFitness: Math.round(currentFitness),
            longRideDuration: parseFloat(longRideDuration.toFixed(1)),
            longRideLoad: Math.round(longRideLoad),
            remainingLoadBudget: Math.round(remainingLoadBudget),
            isRecovery: isRecovery,
            isTaper: isTaper,
            startDateObj: weekStart,
            startDate: weekStart.toISOString(),
            date: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            rawKm: Math.round(goalLoad), // Using rawKm field to store TSS for now
            mileage: Math.round(goalLoad), // Display TSS
            longRun: parseFloat(longRideDuration.toFixed(1)), // Hours
            isRaceWeek: isRaceWeek,
            focus: focus
        });
    }

    return plan;
}   
