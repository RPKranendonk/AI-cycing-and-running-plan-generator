/**
 * @file workout-builder.js
 * @description Factory for creating structured workout descriptions and steps for Intervals.icu.
 * @usedBy js/weekly-ui.js, js/features/weekly-plan/services/TemplateConverter.js
 * @responsibilities
 * - Converts abstract workout types (e.g., "Tempo") into specific steps (e.g., "2x20m @ Threshold")
 * - Generates human-readable descriptions for workouts
 * - Handles detailed step formatting (warmup, main set, cooldown)
 * @why Centralizes the knowledge of "what a workout looks like" to ensure consistency between UI and API.
 */

// ==========================================
// WORKOUT BUILDER
// Converts scheduler templates to Intervals.icu-compatible workouts
// ==========================================

/**
 * Build structured workout description for Intervals.icu
 * Uses the WORKOUT LIBRARY for structured sessions
 * @param {string} typeId - Workout type ID
 * @param {number} distance - Target distance in km
 * @param {number} duration - Duration in seconds
 * @param {string} phase - Training phase
 * @param {boolean} isCycling - If cycling sport
 * @returns {string} Formatted workout description
 */
function buildWorkoutDescription(typeId, distance, duration, phase, isCycling) {
    const sport = isCycling ? 'Cycling' : 'Running';
    const durationMin = Math.ceil(duration / 60);
    const suffix = isCycling ? 'W' : 'Pace';

    // Check if workout library is available
    if (window.WorkoutLibrary && window.WorkoutLibrary[sport]) {
        const lib = window.WorkoutLibrary[sport];
        const workout = lib[typeId] || lib[typeId.toUpperCase()] || lib[typeId.toLowerCase()];

        if (workout) {
            return formatLibraryWorkout(workout, durationMin, suffix);
        }
    }

    // Fallback
    return formatFallbackWorkout(typeId, durationMin, suffix, sport);
}

/**
 * Format a structured library workout into Intervals.icu description
 * @param {Object} workout - Library workout object
 * @param {number} availableMin - Available minutes
 * @param {string} suffix - Intensity suffix (Pace or W)
 * @returns {string} Formatted description
 */
function formatLibraryWorkout(workout, availableMin, suffix) {
    const minDuration = workout.minDuration || 30;
    const extraTime = Math.max(0, availableMin - minDuration);

    let desc = '';

    // Warmup
    const warmupTime = (workout.warmup?.duration || 10) + Math.floor(extraTime / 2);
    const warmupZone = workout.warmup?.zone || 'Z2';
    desc += `- ${warmupTime}m ${zoneToPercent(warmupZone)} ${suffix}\n`;

    // Main Set
    if (workout.mainSet) {
        if (workout.mainSet.type === 'intervals') {
            const reps = workout.mainSet.reps || 5;
            const intervalDur = workout.mainSet.intervalDuration || 3;
            const restDur = workout.mainSet.restDuration || 2;
            const intervalZone = workout.mainSet.intervalZone || 'Z5';
            const restZone = workout.mainSet.restZone || 'Z1';

            desc += `- ${reps}x\n`;
            desc += `  - ${intervalDur}m ${zoneToPercent(intervalZone)} ${suffix}\n`;
            desc += `  - ${restDur}m ${zoneToPercent(restZone)} ${suffix}\n`;
        } else if (workout.mainSet.type === 'continuous') {
            const mainDur = workout.mainSet.duration || 20;
            const mainZone = workout.mainSet.zone || 'Z3';
            desc += `- ${mainDur}m ${zoneToPercent(mainZone)} ${suffix}\n`;
        } else if (workout.mainSet.type === 'progression') {
            // Progression run: zones increase
            const segments = workout.mainSet.segments || [
                { duration: 15, zone: 'Z2' },
                { duration: 10, zone: 'Z3' },
                { duration: 5, zone: 'Z4' }
            ];
            segments.forEach(seg => {
                desc += `- ${seg.duration}m ${zoneToPercent(seg.zone)} ${suffix}\n`;
            });
        }
    }

    // Cooldown
    const cooldownTime = (workout.cooldown?.duration || 10) + Math.ceil(extraTime / 2);
    const cooldownZone = workout.cooldown?.zone || 'Z1';
    desc += `- ${cooldownTime}m ${zoneToPercent(cooldownZone)} ${suffix}`;

    return desc;
}

/**
 * Map zone to % range for Intervals.icu
 * @param {string} zone - Zone identifier (Z1, Z2, etc.)
 * @returns {string} Percentage range string
 */
function zoneToPercent(zone) {
    const zoneMap = {
        'Z1': '0-60%',
        'Z2': '60-70%',
        'Z3': '70-80%',
        'Z4': '80-90%',
        'Z5': '90-100%',
        'Z5a': '95-100%',
        'Z5b': '100-105%',
        'Z5c': '105-120%'
    };
    return zoneMap[zone] || zone;
}

/**
 * Fallback workout format when library not available
 * @param {string} typeId - Workout type ID
 * @param {number} durationMin - Duration in minutes
 * @param {string} suffix - Intensity suffix
 * @param {string} sport - Sport type
 * @returns {string} Formatted description
 */
function formatFallbackWorkout(typeId, durationMin, suffix, sport) {
    const warmup = Math.min(10, Math.floor(durationMin * 0.2));
    const cooldown = Math.min(10, Math.floor(durationMin * 0.15));
    const mainTime = durationMin - warmup - cooldown;

    let desc = `- ${warmup}m 60-70% ${suffix}\n`;

    switch (typeId) {
        case 'LongRun':
            desc += `- ${mainTime}m 65-75% ${suffix}\n`;
            break;
        case 'Easy':
        case 'ActiveRecovery':
            desc += `- ${mainTime}m 60-70% ${suffix}\n`;
            break;
        case 'Tempo':
            desc += `- ${mainTime}m 85-90% ${suffix}\n`;
            break;
        case 'Intervals':
        case 'VO2Max':
            const reps = Math.floor(mainTime / 5);
            desc += `- ${reps}x\n`;
            desc += `  - 3m 95-105% ${suffix}\n`;
            desc += `  - 2m 60% ${suffix}\n`;
            break;
        case 'HillSprints':
            desc += `- 8x\n  - 10s 106-130% ${suffix}\n  - 90s 60-85% ${suffix}\n`;
            break;
        case 'Progression':
            desc += `- ${Math.floor(mainTime * 0.5)}m 70-75% ${suffix}\n`;
            desc += `- ${Math.floor(mainTime * 0.3)}m 80-85% ${suffix}\n`;
            desc += `- ${Math.floor(mainTime * 0.2)}m 90-95% ${suffix}\n`;
            break;
        case 'Fartlek':
            desc += `- ${mainTime}m Variable 70-90% ${suffix}\n`;
            break;
        default:
            desc += `- ${mainTime}m 65-75% ${suffix}\n`;
    }

    desc += `- ${cooldown}m 60% ${suffix}`;
    return desc;
}

/**
 * Calculate accurate duration required to hit a target distance
 * @param {string} typeId - Workout type ID
 * @param {number} targetDistanceKm - Target distance in km
 * @param {number} thresholdPace - Threshold pace in sec/km
 * @param {boolean} isCycling - If cycling sport
 * @returns {number} Duration in seconds
 */
function calculateAccurateDuration(typeId, targetDistanceKm, thresholdPace, isCycling) {
    if (isCycling) {
        // For cycling, use TSS-based estimation instead
        return targetDistanceKm * 60; // Rough estimate: 1 TSS per minute
    }

    // Use ZoneService for accurate zone paces
    function getZonePace(zone) {
        if (window.ZoneService && window.ZoneService.getZonePace) {
            const pace = window.ZoneService.getZonePace(zone);
            if (pace) return pace;
        }
        // Fallback multipliers
        const multipliers = {
            'Z1': 1.35, 'Z2': 1.20, 'Z3': 1.05,
            'Z4': 0.95, 'Z5': 0.92, 'Z5a': 0.95,
            'Z5b': 1.00, 'Z5c': 0.92
        };
        return thresholdPace * (multipliers[zone] || 1.0);
    }

    // Different calculations per workout type
    const workoutConfigs = {
        'LongRun': { warmup: 600, cooldown: 300, mainZone: 'Z2' },
        'Easy': { warmup: 300, cooldown: 300, mainZone: 'Z2' },
        'Tempo': { warmup: 900, cooldown: 600, mainZone: 'Z4' },
        'Intervals': { warmup: 900, cooldown: 600, mainZone: 'Z5' },
        'Progression': { warmup: 600, cooldown: 300, mainZone: 'Z3' }
    };

    const config = workoutConfigs[typeId] || workoutConfigs['Easy'];
    const mainPace = getZonePace(config.mainZone);
    const warmupPace = getZonePace('Z2');
    const cooldownPace = getZonePace('Z1');

    // Calculate distances for warmup/cooldown
    const warmupDist = config.warmup / warmupPace;
    const cooldownDist = config.cooldown / cooldownPace;
    const mainDist = Math.max(0, targetDistanceKm - warmupDist - cooldownDist);

    const mainDuration = mainDist * mainPace;
    const totalDuration = config.warmup + mainDuration + config.cooldown;

    return Math.ceil(totalDuration / 60) * 60; // Round up to nearest whole minute in seconds
}

/**
 * Build strength training description
 * @returns {string} Formatted strength workout description
 */
function buildStrengthDescription() {
    return `Strength Training Session

**Focus:** Lower Body Power & Core Stability

**Exercises:**
- Squats: 3x10 @ RPE 7-8
- Romanian Deadlifts: 3x10 @ RPE 7-8
- Lunges: 2x12 each leg
- Calf Raises: 3x15
- Planks: 3x45s
- Side Planks: 2x30s each side

**Notes:**
- Rest 60-90s between sets
- Focus on form over weight
- Stop if sharp pain`;
}

/**
 * Get workout color for UI display
 * @param {string} typeId - Workout type ID
 * @returns {string} Hex color code
 */
function getWorkoutColor(typeId) {
    const colors = {
        'LongRun': '#ff9800',
        'Easy': '#4caf50',
        'Tempo': '#ffc107',
        'Intervals': '#f44336',
        'HillSprints': '#f44336',
        'Progression': '#ffc107',
        'Fartlek': '#f44336',
        'ActiveRecovery': '#10b981',
        'WeightTraining': '#9c27b0',
        'Rest': '#9e9e9e',
        'Blocked': '#616161'
    };
    return colors[typeId] || '#2196f3';
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.buildWorkoutDescription = buildWorkoutDescription;
window.formatLibraryWorkout = formatLibraryWorkout;
window.zoneToPercent = zoneToPercent;
window.formatFallbackWorkout = formatFallbackWorkout;
window.calculateAccurateDuration = calculateAccurateDuration;
window.buildStrengthDescription = buildStrengthDescription;
window.getWorkoutColor = getWorkoutColor;
// Added from weekly-ui.js refactor
window.buildWorkoutSteps = buildWorkoutSteps;

window.WorkoutBuilder = {
    buildWorkoutDescription,
    formatLibraryWorkout,
    zoneToPercent,
    formatFallbackWorkout,
    calculateAccurateDuration,
    buildStrengthDescription,
    getWorkoutColor,
    buildWorkoutSteps
};

/**
 * Build structured workout steps (Intervals.icu format)
 * Extracted from weekly-ui.js
 */
function buildWorkoutSteps(typeId, distance, duration, phase, isCycling, weekInPhase = 1) {
    const durationMin = Math.round(duration / 60);
    const durationSec = duration;
    const suffix = isCycling ? '' : ' Pace';
    const steps = [];

    // Map typeId to library category and get workout
    const categoryMap = {
        'LongRun': 'LONG',
        'long_run': 'LONG',
        'long_run_progressive': 'LONG',
        'Easy': 'EASY',
        'easy_run': 'EASY',
        'recovery_run': 'EASY',
        'Intervals': 'INTERVALS',
        'vo2_max_4x1k': 'INTERVALS',
        'vo2_max_5x800': 'INTERVALS',
        'track_400s': 'INTERVALS',
        'Tempo': 'TEMPO',
        'tempo_20m': 'TEMPO',
        'tempo_30m': 'TEMPO',
        'cruise_intervals': 'TEMPO',
        'ActiveRecovery': 'EASY',
        'HillSprints': 'INTERVALS',
        'hill_sprints': 'INTERVALS',
        'strides_8x20s': 'INTERVALS',
        'Progression': 'TEMPO',
        'progressive_run': 'TEMPO',
        'Fartlek': 'INTERVALS',
        'fartlek_10x1': 'INTERVALS'
    };
    const category = categoryMap[typeId] || 'EASY';

    let workout = null;
    if (typeof selectWorkout === 'function' && typeof RUNNING_LIBRARY !== 'undefined') {
        workout = selectWorkout(category, phase || 'Base', durationMin, []);
    }

    if (workout && workout.structure) {
        const structure = workout.structure;
        const hasFixedMain = structure.main && (structure.main.reps || structure.main.duration);
        const extraWarmupSec = hasFixedMain ? Math.max(0, durationSec - (workout.minDuration * 60)) || 0 : 0;

        if (structure.warmup?.duration) {
            const warmupDuration = structure.warmup.duration * 60 + extraWarmupSec;
            steps.push({ type: 'Warmup', duration: warmupDuration, intensity: `60-70%${suffix}`, press_lap: true });
        }

        if (structure.main) {
            if (structure.main.reps && structure.main.work) {
                const work = structure.main.work;
                const rest = structure.main.rest;
                const baseReps = structure.main.reps;
                let progressedReps = baseReps;
                let progressedWorkDuration = work.duration;

                if (workout.id && workout.id.includes('sst')) {
                    if (weekInPhase === 2) progressedWorkDuration = 12;
                    if (weekInPhase >= 3) progressedWorkDuration = 15;
                } else if (workout.id && workout.id.includes('tempo_burst')) {
                    progressedReps = Math.min(baseReps + (weekInPhase - 1), 6);
                } else {
                    progressedReps = Math.min(baseReps + (weekInPhase - 1), baseReps + 2);
                }

                steps.push({
                    type: 'Run',
                    reps: progressedReps,
                    steps: [
                        { type: 'Run', duration: progressedWorkDuration ? progressedWorkDuration * 60 : undefined, distance: work.distance || undefined, intensity: `${zoneToPercent(work.zone)}${suffix}` },
                        { type: 'Run', duration: rest?.duration ? rest.duration * 60 : 180, intensity: `${zoneToPercent(rest?.zone || 'Z1')}${suffix}` }
                    ]
                });
            } else if (structure.main.duration || structure.main.zone) {
                const thresholdPace = (window.getLTPace ? window.getLTPace() : null) ||
                    window.ZoneService?.getLTPace?.() ||
                    (window.state?.thresholdPaceSecPerKm) || 300;

                const warmupDur = (structure.warmup?.duration || 0) + (extraWarmupSec / 60);
                const cooldownDur = structure.cooldown?.duration || 0;
                const z1Pace = window.ZoneService?.getZonePace?.('Z1') || Math.round(thresholdPace * 1.33);
                const wucdDist = ((warmupDur * 60) + (cooldownDur * 60)) / z1Pace;

                let mainDuration = 0;
                if (!isCycling && distance && distance > wucdDist) {
                    const mainDist = distance - wucdDist;
                    const mainZone = structure.main.zone || 'Z2';
                    const mainPace = window.ZoneService?.getZonePace?.(mainZone) || Math.round(thresholdPace * 1.18);
                    mainDuration = (mainDist * mainPace);
                } else {
                    mainDuration = structure.main.duration ? structure.main.duration * 60 : (durationSec - 20 * 60);
                }
                steps.push({ type: 'Run', duration: Math.ceil(mainDuration / 60) * 60, intensity: `${zoneToPercent(structure.main.zone || 'Z2')}${suffix}` });
            } else if (structure.main.segments) {
                const warmupDur = (structure.warmup?.duration || 0) * 60 + extraWarmupSec;
                const cooldownDur = (structure.cooldown?.duration || 0) * 60;
                const mainSetDuration = Math.max(0, durationSec - warmupDur - cooldownDur);
                structure.main.segments.forEach(seg => {
                    let segDuration = seg.duration ? seg.duration * 60 : (seg.percent ? mainSetDuration * seg.percent : 0);
                    if (segDuration > 0) steps.push({ type: 'Run', duration: segDuration, intensity: `${zoneToPercent(seg.zone)}${suffix}` });
                });
            }
        }

        const currentTotal = steps.reduce((sum, s) => s.steps ? sum + s.steps.reduce((acc, sub) => acc + (sub.duration || 0), 0) * s.reps : sum + (s.duration || 0), 0);
        const cooldownDur = structure.cooldown?.duration ? structure.cooldown.duration * 60 : 0;
        const filledSoFar = currentTotal + cooldownDur;
        if (hasFixedMain && durationSec > filledSoFar + 60) {
            steps.push({ type: 'Run', duration: durationSec - filledSoFar, intensity: '60-70% Pace', description: 'Extra Endurance Volume' });
        }

        if (structure.cooldown?.duration) {
            steps.push({ type: 'Cooldown', duration: cooldownDur, intensity: `60-70%${suffix}` });
        }
        return steps;
    }

    // Fallback
    switch (typeId) {
        case 'LongRun':
            steps.push({ type: 'Warmup', duration: 600, intensity: `60-70%${suffix}`, press_lap: true });
            steps.push({ type: 'Run', duration: Math.max(durationSec - 900, 1800), intensity: `70-80%${suffix}` });
            steps.push({ type: 'Cooldown', duration: 300, intensity: `50-60%${suffix}` });
            break;
        case 'Easy': steps.push({ type: 'Run', duration: durationSec, intensity: `65-75%${suffix}` }); break;
        case 'Intervals':
            const intervalReps = Math.min(4 + (weekInPhase - 1), 6);
            steps.push({ type: 'Warmup', duration: 600, intensity: `60-70%${suffix}`, press_lap: true });
            steps.push({ type: 'Run', reps: intervalReps, duration: 180, intensity: `100-105%${suffix}`, recovery_duration: 180, recovery_intensity: `60-70%${suffix}` });
            steps.push({ type: 'Cooldown', duration: 600, intensity: `60-70%${suffix}` });
            break;
        case 'Tempo':
            const tempoMain = Math.max(durationSec - 1200, 900);
            steps.push({ type: 'Warmup', duration: 600, intensity: `60-70%${suffix}`, press_lap: true });
            steps.push({ type: 'Run', duration: tempoMain, intensity: `80-88%${suffix}` });
            steps.push({ type: 'Cooldown', duration: 600, intensity: `60-70%${suffix}` });
            break;
        case 'ActiveRecovery': steps.push({ type: 'Run', duration: durationSec, intensity: `50-65%${suffix}` }); break;
        default: steps.push({ type: 'Run', duration: durationSec, intensity: `65-75%${suffix}` });
    }
    return steps;
}
