// --- MARATHON GOAL ASSESSMENT ---

/**
 * Assesses marathon goal feasibility based on goal time and race date
 * @param {string} goalTimeStr - Target time in "HH:MM" format (e.g., "3:30")
 * @param {string} raceDateStr - Race date in "YYYY-MM-DD" format
 * @returns {Object} Assessment object with status, messages, and warnings
 */
function assessMarathonGoal(goalTimeStr, raceDateStr) {
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
        // Parse goal time
        const timeParts = goalTimeStr.trim().split(':');
        if (timeParts.length !== 2) {
            result.warnings.push("Please use HH:MM format for goal time (e.g., 3:30)");
            return result;
        }

        const h = parseInt(timeParts[0]);
        const m = parseInt(timeParts[1]);

        if (isNaN(h) || isNaN(m) || m >= 60 || m < 0) {
            result.warnings.push("Invalid time format. Use HH:MM (e.g., 3:30)");
            return result;
        }

        const goalMinutes = h * 60 + m;

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

        // 3. Determine Minimum Training Days (Frequency Logic)
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

        // 4. Determine Timeframe Feasibility (Duration Logic)
        if (weeksUntilRace < 8) {
            result.timeStatus = "CRITICAL";
            result.timeMessage = `You only have ${weeksUntilRace.toFixed(1)} weeks. This is extremely risky unless you are already in marathon shape.`;
            result.statusColor = 'text-red-400';
            result.warnings.push("⚠️ URGENT: Please consult a coach or doctor before attempting a marathon with less than 8 weeks prep.");
        } else if (weeksUntilRace < 12) {
            result.timeStatus = "Ambitious";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks. This is a tight schedule; you'll need to jump straight into training.`;
            result.statusColor = 'text-orange-400';
        } else if (weeksUntilRace <= 20) {
            result.timeStatus = "Ideal";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks. This is the perfect amount of time for a full training cycle.`;
            result.statusColor = 'text-green-400';
        } else {
            result.timeStatus = "Early";
            result.timeMessage = `You have ${weeksUntilRace.toFixed(1)} weeks. You have plenty of time to build a base before starting specific work.`;
            result.statusColor = 'text-blue-400';
        }

        // 5. Add Reality Check Warnings
        if (result.difficulty === "Elite") {
            result.warnings.push(`⚠️ A sub-${goalTimeStr} is an elite standard. To reach this safely, you must be willing to run at least ${result.minDays}-6 times per week.`);
        } else if (result.difficulty === "Advanced") {
            result.warnings.push(`💡 That is a fast time! We advise you to train at least ${result.minDays} times per week (preferably 5) to safely reach this goal.`);
        } else {
            result.warnings.push(`💡 To achieve this comfortably, you will need to commit to running at least ${result.minDays} times per week.`);
        }

        result.isValid = true;
        return result;

    } catch (error) {
        console.error("Assessment error:", error);
        result.warnings.push("Error parsing inputs. Please check your goal time and race date.");
        return result;
    }
}
