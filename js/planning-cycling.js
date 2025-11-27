// ==========================================
// CYCLING PLANNING LOGIC
// ==========================================

function calculateAdvancedCyclingPlan(startTss, currentCtl, raceDateStr, options = {}, startLongRideHours = 1.5) {
    // Input Validation
    let startLoad = parseFloat(startTss); // This is essentially the starting weekly load
    let fitness = parseFloat(currentCtl); // CTL

    // Options Extraction
    const rampRate = options.rampRate || 5; // CTL ramp per week

    // If startLoad looks like CTL (e.g. < 100), calculate implied weekly load to achieve ramp
    if (!isNaN(startLoad) && startLoad < 100) {
        startLoad = 7 * (startLoad + (6 * rampRate));
    }

    if (isNaN(startLoad)) startLoad = 300;
    if (isNaN(fitness)) fitness = 40;

    const raceDate = new Date(raceDateStr);

    // Options Extraction
    const taperDuration = options.taperDuration || 1;
    const customRestWeeks = options.customRestWeeks || [];
    const forceBuildWeeks = options.forceBuildWeeks || [];
    const startWithRestWeek = options.startWithRestWeek || false;
    const longRideCap = options.longRideCap || 4.0;

    // Use Plan Start Date if provided, otherwise default to Today
    const planStartDate = options.planStartDate ? new Date(options.planStartDate) : new Date();

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
    let currentFitness = fitness;
    let currentLongRide = Math.max(2, Math.min(6, startLongRideHours)); // Enforce 2h-6h limits immediately

    for (let i = 0; i < weeksUntilRace; i++) {
        const weekNum = i + 1;
        const weekStart = new Date(planStartDate);
        weekStart.setDate(planStartDate.getDate() + (i * 7));
        const dateStr = weekStart.toISOString().split('T')[0];
        const weeksRemaining = weeksUntilRace - i;

        // Determine Phase & Type
        let phase = "Base 1";
        let focus = "Endurance";
        let isRecovery = false;
        let isTaper = false;
        let isRaceWeek = false;

        // Phase Logic
        if (weeksRemaining === 1) {
            isRaceWeek = true;
            phase = "Race";
            focus = "Race";
        } else if (weeksRemaining <= taperDuration + 1) {
            isTaper = true;
            phase = "Taper";
            focus = "Freshness";
        } else {
            // Check for Custom Rest Weeks
            if (customRestWeeks.includes(weekNum)) {
                isRecovery = true;
                phase = "Custom Recovery";
                focus = "Recovery";
            } else if (forceBuildWeeks.includes(weekNum)) {
                // Force Build (skip recovery check)
                isRecovery = false;
            } else if (startWithRestWeek && weekNum === 1) {
                isRecovery = true;
                phase = "Recovery Start";
                focus = "Recovery";
            } else if (weekNum % 4 === 0) {
                // Standard Recovery Week Logic (Every 4th week)
                isRecovery = true;
                phase = "Recovery";
                focus = "Recovery";
            }

            if (!isRecovery) {
                // Standard Blocks
                if (weeksRemaining <= 5) phase = "Peak";
                else if (weeksRemaining <= 9) phase = "Build 2";
                else if (weeksRemaining <= 13) phase = "Build 1";
                else if (weeksRemaining <= 17) phase = "Base 3";
                else phase = "Base 2";
            }
        }

        // Calculate Weekly Load (TSS) using User's Formula
        // goalLoad = 7 * (currentFitness + (6 * targetRampRate))

        let weeklyLoad = 0;
        let longRideDuration = currentLongRide;

        if (isRaceWeek) {
            weeklyLoad = (plan.length > 0 ? plan[plan.length - 1].rawKm : startLoad) * 0.4;
            longRideDuration = 0;
        } else if (isTaper) {
            weeklyLoad = (plan.length > 0 ? plan[plan.length - 1].rawKm : startLoad) * 0.65;
            longRideDuration = currentLongRide * 0.6;
        } else if (isRecovery) {
            // Recovery: Drop load significantly
            weeklyLoad = (plan.length > 0 ? plan[plan.length - 1].rawKm : startLoad) * 0.6;
            longRideDuration = currentLongRide * 0.7; // Reduced long ride

            // Do NOT increase fitness during recovery
        } else {
            // Build Week
            if (i === 0) {
                weeklyLoad = startLoad;
            } else {
                // Check if previous week was recovery
                const prevWeek = plan[plan.length - 1];
                if (prevWeek.isRecovery) {
                    // "reduce this by 1 hour after a recovery week"
                    currentLongRide = Math.max(2, currentLongRide - 1);
                    longRideDuration = currentLongRide;
                } else {
                    // Normal progression
                    // Increase Long Ride
                    currentLongRide = Math.min(6, currentLongRide + 0.25); // +15 mins
                    longRideDuration = currentLongRide;
                }

                // Calculate Load
                weeklyLoad = 7 * (currentFitness + (6 * rampRate));
            }

            // Update Fitness for NEXT week
            currentFitness += rampRate;
        }

        // Hard Constraints on Long Ride
        if (longRideDuration < 2 && !isRaceWeek) longRideDuration = 2;
        if (longRideDuration > longRideCap) longRideDuration = longRideCap;

        plan.push({
            week: weekNum,
            phaseName: phase,
            focus: focus,
            date: dateStr,
            weekName: `${phase} - Week ${weekNum}`,
            mileage: Math.round(weeklyLoad), // Display TSS
            longRun: longRideDuration.toFixed(1), // Display Hours
            rawKm: weeklyLoad, // Store TSS
            rawLongRun: longRideDuration,
            isRecovery: isRecovery,
            isRaceWeek: isRaceWeek
        });
    }

    return plan;
}
