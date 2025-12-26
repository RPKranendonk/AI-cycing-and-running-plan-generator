/**
 * @file step-formatter.js
 * @description Formats structured workout steps into the specific text format required by Intervals.icu.
 * @usedBy js/features/intervals-api/services/workout-uploader.js, js/features/weekly-plan/services/workout-builder.js
 * @responsibilities
 * - Converts "Z2" or "Tempo" to "% Pace" or specific HR/Power strings
 * - Handles nested steps (Repeats, Warmup, Cooldown)
 * - Ensures compatibility with the Intervals.icu "Workout Builder" syntax
 * @why Intervals.icu has a strict Domain Specific Language (DSL) for defining structured workouts.
 */

// ==========================================
// STEP FORMATTER
// Formats workout steps for Intervals.icu
// ==========================================

/**
 * Zone to percentage pace mapping (based on Joe Friel 7-zone system)
 * LT = Lactate Threshold (100%). Pace slows as % decreases.
 */
const ZONE_TO_PERCENT = {
    'Z1': '60-85% Pace',
    'Z2': '85-90% Pace',
    'Z3': '90-95% Pace',
    'Z4': '95-100% Pace',
    'Z5': '100-106% Pace',
    'Z5a': '100-102% Pace',
    'Z5b': '102-106% Pace',
    'Z5c': '106-130% Pace', // Anaerobic/Strides - max effort
};

/**
 * Format duration/intensity for a single step
 * @param {Object} s - Step object
 * @returns {string} Formatted step details
 */
function formatStepDetails(s) {
    let dur = "";
    if (s.duration) {
        const roundedDuration = Math.round(s.duration);
        const mins = Math.floor(roundedDuration / 60);
        const secs = roundedDuration % 60;
        if (mins > 0) dur += `${mins}m`;
        if (secs > 0) dur += `${secs}s`;
    } else if (s.distance) {
        // Use meters for track intervals (<1km), km for longer
        if (s.distance < 1000) {
            dur += `${Math.round(s.distance)}m`;
        } else {
            const km = s.distance / 1000;
            dur += Number.isInteger(km) ? `${km}km` : `${km.toFixed(2)}km`;
        }
    }

    // Clean intensity - convert any zone references to % pace
    let intensity = s.intensity || "";
    Object.entries(ZONE_TO_PERCENT).forEach(([zone, pace]) => {
        const zoneRegex = new RegExp(`\\b${zone}\\b`, 'gi');
        intensity = intensity.replace(zoneRegex, pace);
    });

    return `${dur} ${intensity}`.trim();
}

/**
 * Formats workout steps into Intervals.icu description format
 * @param {Array} steps - Array of workout step objects
 * @returns {string} Formatted description text
 */
function formatStepsForIntervals(steps) {
    if (!steps || !Array.isArray(steps)) return "";

    let text = "";
    steps.forEach(step => {
        let line = "";

        if (step.type === "Warmup") line += "Warmup\n";
        if (step.type === "Cooldown") line += "Cooldown\n";
        if (step.type === "Rest") line += "Rest\n";

        // Handle Repeats (Nested Steps)
        if (step.reps) {
            const sectionName = step.name || step.label || '';
            if (sectionName) {
                line += `${sectionName} ${step.reps}x\n`;
            } else {
                line += `${step.reps}x\n`;
            }

            // Check for nested steps (New AI Format)
            if (step.steps && Array.isArray(step.steps) && step.steps.length > 0) {
                step.steps.forEach(subStep => {
                    const det = formatStepDetails(subStep);
                    const press = subStep.press_lap ? "Press Lap " : "";
                    line += `- ${press}${det}\n`;
                });
            }
            // Fallback for legacy flat format
            else {
                const pressLap = step.press_lap ? "Press Lap " : "";
                const det = formatStepDetails(step);
                line += `- ${pressLap}${det}\n`;

                if (step.recovery_duration || step.recovery_distance) {
                    let recDur = "";
                    if (step.recovery_duration) {
                        const rMins = Math.floor(step.recovery_duration / 60);
                        const rSecs = step.recovery_duration % 60;
                        if (rMins > 0) recDur += `${rMins}m`;
                        if (rSecs > 0) recDur += `${rSecs}s`;
                    } else if (step.recovery_distance) {
                        recDur += `${(step.recovery_distance / 1000).toFixed(2)}km`;
                    }
                    let recInt = step.recovery_intensity || "50-65% Pace";
                    let recPressLap = step.recovery_press_lap ? "Press Lap " : "";
                    line += `- ${recPressLap}${recDur} ${recInt}\n`;
                }
            }
            line += "\n"; // Closing empty line for repeats
        }
        // Single Step
        else {
            const pressLap = step.press_lap ? "Press Lap " : "";
            const det = formatStepDetails(step);

            if (step.type === "Warmup" || step.type === "Cooldown") {
                line += `- ${pressLap}${det}\n`;
            } else if (step.type === "Rest") {
                line += `- ${det}\n`;
            } else {
                line += `- ${pressLap}${det}\n`;
            }
        }

        text += line + "\n";
    });
    return text.trim();
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.formatStepsForIntervals = formatStepsForIntervals;
window.StepFormatter = {
    formatStepsForIntervals,
    formatStepDetails,
    ZONE_TO_PERCENT
};
