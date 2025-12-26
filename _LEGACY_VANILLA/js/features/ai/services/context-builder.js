// Using global msPerDay from constants.js


/**
 * Get last 4 weeks activity summary for AI context
 * @returns {string} Summary of recent activities
 */
function getLast4WeeksSummary() {
    if (!state.activities || state.activities.length === 0) return "No recent activity data available.";

    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);

    const weeklyData = {};
    state.activities.forEach(act => {
        if (['Run', 'Ride', 'VirtualRide'].includes(act.type)) {
            const actDate = new Date(act.start_date_local);
            if (actDate >= fourWeeksAgo && actDate <= now) {
                const weekKey = `${actDate.getFullYear()}-W${getWeekNumber(actDate)}`;
                if (!weeklyData[weekKey]) weeklyData[weekKey] = { totalKm: 0, totalSeconds: 0, runs: [] };

                const km = (act.distance || 0) / 1000;
                weeklyData[weekKey].totalKm += km;
                weeklyData[weekKey].totalSeconds += (act.moving_time || 0);
                weeklyData[weekKey].runs.push({ day: actDate.getDay() });
            }
        }
    });

    let summary = "Last 4 weeks activity:\n";
    Object.keys(weeklyData).sort().forEach(week => {
        const data = weeklyData[week];
        const hours = (data.totalSeconds / 3600).toFixed(1);
        summary += `${week}: ${hours}h (${data.totalKm.toFixed(1)}km) over ${data.runs.length} sessions\n`;
    });
    return summary;
}

/**
 * Get zone/pace strings for AI context
 * @returns {string} Formatted zone information
 */
function getZonePaceStrings() {
    let zStr = "";

    // Synced Zones from Intervals.icu (Priority)
    if (state.zonePcts) {
        zStr += "### YOUR SPECIFIC TRAINING ZONES (Use these exact ranges):\n";
        if (state.zonePcts.z2) zStr += `- Zone 2 (Endurance): ${state.zonePcts.z2}\n`;
        if (state.zonePcts.z3) zStr += `- Zone 3 (Tempo): ${state.zonePcts.z3}\n`;
        if (state.zonePcts.z5) zStr += `- Zone 5 (VO2Max): ${state.zonePcts.z5}\n`;
        zStr += "\n";
    }

    if (state.lthrPace) zStr += `Lactate Threshold Pace: ${state.lthrPace}\n`;
    if (state.lthrBpm) zStr += `Lactate Threshold HR: ${state.lthrBpm} bpm\n`;

    return zStr.length > 0 ? zStr : "Lactate Threshold Pace: Not synced.";
}

/**
 * Get ISO week number for a date
 * @param {Date} d - Date to get week number for
 * @returns {number} ISO week number
 */
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / msPerDay) + 1) / 7);
}

/**
 * Convert LT pace to estimated base pace
 * @param {string} ltPaceStr - LT pace string (e.g. "4:00/km")
 * @returns {string} Estimated base pace
 */
function getEstimatedBasePace(ltPaceStr) {
    if (!ltPaceStr) return "6:00/km";

    const parts = ltPaceStr.split(":");
    const min = parseInt(parts[0]);
    const sec = parseInt(parts[1].replace("/km", "").replace("/mi", ""));
    const totalSeconds = (min * 60) + sec;

    // Apply the "Easy Run Factor" (1.25x slower than LT)
    const baseSeconds = Math.round(totalSeconds * 1.25);

    const newMin = Math.floor(baseSeconds / 60);
    const newSec = baseSeconds % 60;
    const padSec = newSec < 10 ? "0" + newSec : newSec;

    return `${newMin}:${padSec}/km`;
}

/**
 * Build weeks context for AI prompt
 * @param {Array} indices - Week indices to build context for
 * @returns {Array} Week context objects
 */
function buildWeeksContext(indices) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return indices.map((index, i) => {
        const week = state.generatedPlan[index];
        if (!week) throw new Error(`Week data not found for index ${index}`);

        const availability = state.weeklyAvailability[index] || state.defaultAvailableDays;
        const availableDays = availability.map(d => dayNames[d]).join(', ');

        const restDaysRequired = Math.max(1, 7 - availability.length);

        // GYM LOGIC
        let gymTarget = "Optional";
        if (state.gymAccess === "Yes" || state.gymAccess === true) {
            if (week.phaseName.includes("Base") || week.phaseName.includes("Build")) {
                gymTarget = "2 sessions (Strength/Power focus)";
            } else if (week.phaseName.includes("Peak")) {
                gymTarget = "1 session (Maintenance)";
            } else {
                gymTarget = "None (Focus on recovery)";
            }
        }

        const tDist = week.targetDistance !== undefined ? week.targetDistance : (state.sportType === "Cycling" ? 0 : week.rawKm);
        const tTSS = week.targetTSS !== undefined ? week.targetTSS : (state.sportType === "Cycling" ? week.rawKm : 0);

        // Block positioning
        const currentPhase = week.phaseName || "Base";
        const weeksInPhase = state.generatedPlan.filter(w => w.phaseName === currentPhase);
        const totalWeeksInPhase = weeksInPhase.length;
        const relativeWeekNum = weeksInPhase.findIndex(w => w.week === week.week) + 1;

        return {
            weekNumber: week.week,
            phase: currentPhase,
            focus: week.focus,
            targetTotal: week.rawKm,
            targetDistance: tDist,
            targetTSS: tTSS,
            targetLong: week.longRun,
            availableDays: availableDays,
            weekStartDate: week.startDate,
            gymFocus: gymTarget,
            restDays: restDaysRequired,
            blockPosition: `Week ${relativeWeekNum} of ${totalWeeksInPhase} in ${currentPhase}`
        };
    });
}

/**
 * Build plan overview string for AI context
 * @returns {string} Plan overview
 */
function buildPlanOverview() {
    return state.generatedPlan.map(w => {
        const vol = state.sportType === "Cycling" ? `${w.targetTSS || 0} TSS` : `${w.targetDistance || 0} km`;
        const weekIndex = w.week - 1;
        const avail = state.weeklyAvailability[weekIndex] ? state.weeklyAvailability[weekIndex].length : (state.defaultAvailableDays ? state.defaultAvailableDays.length : '?');
        return `Week ${w.week}: ${w.phaseName} (${vol}, ${avail} days avail)`;
    }).join('\n');
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.getLast4WeeksSummary = getLast4WeeksSummary;
window.getZonePaceStrings = getZonePaceStrings;
window.getWeekNumber = getWeekNumber;
window.getEstimatedBasePace = getEstimatedBasePace;
window.buildWeeksContext = buildWeeksContext;
window.buildPlanOverview = buildPlanOverview;

window.AIContextBuilder = {
    getLast4WeeksSummary,
    getZonePaceStrings,
    getWeekNumber,
    getEstimatedBasePace,
    buildWeeksContext,
    buildPlanOverview
};
