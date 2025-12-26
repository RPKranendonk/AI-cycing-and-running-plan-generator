// --- MARATHON GOAL ASSESSMENT ---

/**
 * Assesses marathon goal feasibility based on goal time and race date
 * @param {string} goalTimeStr - Target time in "HH:MM" format (e.g., "3:30")
 * @param {string} raceDateStr - Race date in "YYYY-MM-DD" format
 * @returns {Object} Assessment object with status, messages, and warnings
 */
/**
 * Assesses goal feasibility based on goal time, race date, and distance/sport
 * @param {string} goalTimeStr - Target time in "HH:MM" format (e.g., "3:30")
 * @param {string} raceDateStr - Race date in "YYYY-MM-DD" format
 * @param {string} raceType - "Marathon", "Half Marathon", "10k", or custom string
 * @param {string} sportType - "Running" or "Cycling"
 * @returns {Object} Assessment object with status, messages, and warnings
 */
function assessMarathonGoal(goalTimeStr, raceDateStr, raceType = "Marathon", sportType = "Running") {
    const result = {
        isValid: false,
        timeStatus: '',
        timeMessage: '',
        difficulty: '',
        minDays: 0,
        warnings: [],
        statusColor: ''
    };

    // 1. Parse Inputs
    try {
        // Parse race date
        const raceDate = new Date(raceDateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        raceDate.setHours(0, 0, 0, 0);

        if (isNaN(raceDate.getTime())) {
            result.warnings.push("Invalid race date format");
            return result;
        }

        // 2. Calculate Weeks Available
        const daysUntilRace = Math.floor((raceDate - today) / (1000 * 60 * 60 * 24));
        const weeksUntilRace = daysUntilRace / 7;

        if (daysUntilRace < 0) {
            result.warnings.push("This race date has already passed!");
            result.statusColor = 'text-red-400';
            return result;
        }

        // CYCLING CHECK
        if (sportType === "Cycling") {
            result.isValid = true;
            result.timeStatus = "Cycling";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks to prepare for your ride.`;
            result.statusColor = 'text-blue-400';
            result.minDays = 3; // Default minimum
            return result;
        }

        // RUNNING TIME CHECK
        // Parse goal time
        const timeParts = goalTimeStr.trim().split(':');
        if (timeParts.length !== 2) {
            // Allow loose format if just typing
            // result.warnings.push("Please use HH:MM format for goal time (e.g., 3:30)");
            return result;
        }

        const h = parseInt(timeParts[0]);
        const m = parseInt(timeParts[1]);

        if (isNaN(h) || isNaN(m) || m >= 60 || m < 0) {
            result.warnings.push("Invalid time format. Use HH:MM (e.g., 3:30)");
            return result;
        }

        const goalMinutes = h * 60 + m;

        // 3. Determine Minimum Training Days (Frequency Logic)
        if (raceType === "Marathon") {
            if (goalMinutes < 180) {      // Sub 3:00
                result.minDays = 5;
                result.difficulty = "Elite";
            } else if (goalMinutes < 210) {    // Sub 3:30
                result.minDays = 4;
                result.difficulty = "Advanced";
            } else if (goalMinutes < 240) {    // Sub 4:00
                result.minDays = 4;
                result.difficulty = "Intermediate";
            } else {                       // 4:00+
                result.minDays = 3;
                result.difficulty = "Beginner/Finish";
            }
        } else if (raceType === "Half Marathon") {
            if (goalMinutes < 90) {       // Sub 1:30
                result.minDays = 5;
                result.difficulty = "Elite";
            } else if (goalMinutes < 105) {    // Sub 1:45
                result.minDays = 4;
                result.difficulty = "Advanced";
            } else if (goalMinutes < 120) {    // Sub 2:00
                result.minDays = 4;
                result.difficulty = "Intermediate";
            } else {
                result.minDays = 3;
                result.difficulty = "Beginner";
            }
        } else if (raceType === "10k") {
            if (goalMinutes < 40) {       // Sub 40
                result.minDays = 5;
                result.difficulty = "Elite";
            } else if (goalMinutes < 50) {    // Sub 50
                result.minDays = 4;
                result.difficulty = "Advanced";
            } else if (goalMinutes < 60) {    // Sub 60
                result.minDays = 3;
                result.difficulty = "Intermediate";
            } else {
                result.minDays = 3;
                result.difficulty = "Beginner";
            }
        }

        // 4. Determine Timeframe Feasibility (Duration Logic)
        // Adjust thresholds slightly for shorter distances? For now keeping standard block lengths.
        if (weeksUntilRace < 6) {
            result.timeStatus = "CRITICAL";
            result.timeMessage = `You only have ${weeksUntilRace.toFixed(1)} weeks. This is very short for a full training cycle.`;
            result.statusColor = 'text-red-400';
            result.warnings.push("⚠️ URGENT: Very short preparation time.");
        } else if (weeksUntilRace < 10) {
            result.timeStatus = "Ambitious";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks. A bit tight, but doable if you start immediately.`;
            result.statusColor = 'text-orange-400';
        } else if (weeksUntilRace <= 20) {
            result.timeStatus = "Ideal";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks. Great timeframe for a solid build.`;
            result.statusColor = 'text-green-400';
        } else {
            result.timeStatus = "Early";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks. Plenty of time for base building.`;
            result.statusColor = 'text-blue-400';
        }

        // 5. Add Reality Check Warnings
        if (result.difficulty === "Elite") {
            result.warnings.push(`⚠️ A ${goalTimeStr} ${raceType} is an elite standard. Ensure you can train ${result.minDays}+ times/week.`);
        } else if (result.difficulty === "Advanced") {
            result.warnings.push(`💡 That is a fast time! Recommended training: ${result.minDays}-5 times/week.`);
        } else {
            result.warnings.push(`💡 To achieve this comfortably, aim for at least ${result.minDays} sessions per week.`);
        }

        result.isValid = true;
        return result;

    } catch (error) {
        console.error("Assessment error:", error);
        result.warnings.push("Error parsing inputs.");
        return result;
    }
}
