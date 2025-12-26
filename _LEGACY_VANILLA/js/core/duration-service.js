// ============================================================================
// DURATION SERVICE - Centralized Duration Calculation
// ============================================================================
// 
// This service calculates workout durations from distances using accurate
// zone-based pacing derived from the LT threshold pace.
//
// KEY PRINCIPLE: Use AVERAGE pace of zone boundaries (not center percentage)
// Formula: avg_pace = (min_pace + max_pace) / 2
//          duration = distance_km * avg_pace_sec_per_km
//
// ============================================================================

/**
 * 7-Zone Model with LT-derived percentages
 * Zone boundaries as pace multipliers relative to LT pace (1.0 = LT pace)
 * 
 * Derived from user's example with LT = 4:14/km (254 sec/km):
 * - Z1 (Recovery): 5:17-6:37 → multipliers 1.25-1.56 → avg 1.41
 * - Z2 (Endurance): 4:42-5:17 → multipliers 1.11-1.25 → avg 1.18
 * - Z3 (Tempo): 4:27-4:42 → multipliers 1.05-1.11 → avg 1.08
 * - Z4 (Sub-Threshold): 4:14-4:27 → multipliers 1.00-1.05 → avg 1.03
 * - Z5 (Threshold): 4:09-4:14 → multipliers 0.98-1.00 → avg 0.99
 * - Z6 (VO2 Max): 4:00-4:09 → multipliers 0.94-0.98 → avg 0.96
 * - Z7 (Anaerobic): 3:38-4:00 → multipliers 0.86-0.94 → avg 0.90
 */
const ZONE_PACE_MULTIPLIERS = {
    // Verified multipliers from user's LT pace example (4:14/km)
    'Z1': { minMult: 1.25, maxMult: 1.56, avgMult: 1.41, name: 'Recovery' },
    'Z2': { minMult: 1.11, maxMult: 1.25, avgMult: 1.18, name: 'Endurance' },
    'Z3': { minMult: 1.05, maxMult: 1.11, avgMult: 1.08, name: 'Tempo' },
    'Z4': { minMult: 1.00, maxMult: 1.05, avgMult: 1.03, name: 'Sub-Threshold' },
    'Z5': { minMult: 0.98, maxMult: 1.00, avgMult: 0.99, name: 'Threshold' },
    'Z5a': { minMult: 0.98, maxMult: 1.00, avgMult: 0.99, name: 'Threshold' },  // Alias
    'Z6': { minMult: 0.94, maxMult: 0.98, avgMult: 0.96, name: 'VO2 Max' },
    'Z5b': { minMult: 0.94, maxMult: 0.98, avgMult: 0.96, name: 'VO2 Max' },    // Alias
    'Z7': { minMult: 0.86, maxMult: 0.94, avgMult: 0.90, name: 'Anaerobic' },
    'Z5c': { minMult: 0.86, maxMult: 0.94, avgMult: 0.90, name: 'Anaerobic' }   // Alias
};

/**
 * Workout type to zone mapping for default calculations
 */
const WORKOUT_ZONE_MAP = {
    'LongRun': 'Z2',
    'long': 'Z2',
    'Easy': 'Z2',
    'easy': 'Z2',
    'Tempo': 'Z3',
    'tempo': 'Z3',
    'Intervals': 'Z5',
    'key': 'Z4',
    'ActiveRecovery': 'Z1',
    'recovery': 'Z1',
    'Warmup': 'Z1',
    'Cooldown': 'Z1'
};

// ============================================================================
// CORE CALCULATION FUNCTIONS
// ============================================================================

/**
 * Get the AVERAGE pace for a zone in seconds per km
 * Uses average of zone min/max boundaries for accuracy
 * 
 * @param {string} zoneId - Zone ID (Z1, Z2, Z3, Z4, Z5, Z5a, Z5b, Z5c, Z6, Z7)
 * @returns {number} Average pace in seconds per km
 */
function getZoneAveragePace(zoneId) {
    const ltPace = getLTThresholdPace();
    const zone = ZONE_PACE_MULTIPLIERS[zoneId];

    if (!zone) {
        console.warn(`[DurationService] Unknown zone: ${zoneId}, using Z2`);
        return ltPace * ZONE_PACE_MULTIPLIERS['Z2'].avgMult;
    }

    return Math.round(ltPace * zone.avgMult);
}

/**
 * Get the minimum (fastest) pace for a zone in seconds per km
 * @param {string} zoneId - Zone ID
 * @returns {number} Min pace in seconds per km
 */
function getZoneMinPace(zoneId) {
    const ltPace = getLTThresholdPace();
    const zone = ZONE_PACE_MULTIPLIERS[zoneId];

    if (!zone) return ltPace;
    return Math.round(ltPace * zone.minMult);
}

/**
 * Get the maximum (slowest) pace for a zone in seconds per km
 * @param {string} zoneId - Zone ID
 * @returns {number} Max pace in seconds per km
 */
function getZoneMaxPace(zoneId) {
    const ltPace = getLTThresholdPace();
    const zone = ZONE_PACE_MULTIPLIERS[zoneId];

    if (!zone) return ltPace * 1.25;
    return Math.round(ltPace * zone.maxMult);
}

/**
 * Get the LT threshold pace from state
 * @returns {number} LT pace in seconds per km (default 300 = 5:00/km)
 */
function getLTThresholdPace() {
    // Priority: ZoneService > state.thresholdPaceSecPerKm > state.lthrPace > default
    if (window.ZoneService?.getLTPace) {
        return window.ZoneService.getLTPace();
    }
    if (window.state?.thresholdPaceSecPerKm) {
        return window.state.thresholdPaceSecPerKm;
    }
    if (window.state?.lthrPace) {
        // Handle MM:SS format
        if (typeof window.state.lthrPace === 'string' && window.state.lthrPace.includes(':')) {
            const parts = window.state.lthrPace.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        }
        let pace = parseInt(window.state.lthrPace);
        // Safety check: if pace is < 120 (2 min/km, world record territory), assume it's in parsed minutes
        if (pace < 120) {
            return pace * 60;
        }
        return pace;
    }
    return 300; // Default 5:00/km
}

// ============================================================================
// DURATION CALCULATION FUNCTIONS
// ============================================================================

/**
 * Calculate duration from distance using zone-specific average pace
 * 
 * @param {number} distanceKm - Distance in kilometers
 * @param {string} zoneId - Zone ID (Z1-Z7 or Z5a/Z5b/Z5c)
 * @returns {number} Duration in SECONDS
 */
function calculateDurationFromDistance(distanceKm, zoneId) {
    if (!distanceKm || distanceKm <= 0) return 0;

    const avgPace = getZoneAveragePace(zoneId);
    const durationSec = distanceKm * avgPace;

    return Math.ceil(durationSec / 60) * 60; // Round up to nearest whole minute in seconds
}

/**
 * Calculate distance from duration using zone-specific average pace
 * 
 * @param {number} durationSec - Duration in seconds
 * @param {string} zoneId - Zone ID
 * @returns {number} Distance in kilometers
 */
function calculateDistanceFromDuration(durationSec, zoneId) {
    if (!durationSec || durationSec <= 0) return 0;

    const avgPace = getZoneAveragePace(zoneId);
    const distanceKm = durationSec / avgPace;

    return parseFloat(distanceKm.toFixed(2));
}

/**
 * Calculate duration for a workout type based on target distance
 * Uses workout-type-specific zone mapping
 * 
 * @param {string} workoutType - Workout type (LongRun, Easy, Intervals, etc.)
 * @param {number} distanceKm - Target distance in km
 * @returns {number} Duration in SECONDS
 */
function calculateDurationForWorkout(workoutType, distanceKm) {
    const zoneId = WORKOUT_ZONE_MAP[workoutType] || 'Z2';
    return calculateDurationFromDistance(distanceKm, zoneId);
}

/**
 * Calculate accurate duration for a structured workout
 * Accounts for warmup, main set (with intervals), and cooldown
 * Each segment uses its appropriate zone pace
 * 
 * @param {Object} structure - Workout structure { warmup, main, cooldown }
 * @param {number} targetDistanceKm - Total target distance in km
 * @param {boolean} isCycling - Whether this is a cycling workout
 * @returns {number} Duration in SECONDS
 */
function calculateStructuredWorkoutDuration(structure, targetDistanceKm, isCycling = false) {
    if (isCycling) {
        // Cycling: approx 25 km/h average
        return Math.round(targetDistanceKm * 144); // 144 sec/km = 25 km/h
    }

    if (!structure) {
        // No structure, use Z2 for entire distance
        return calculateDurationFromDistance(targetDistanceKm, 'Z2');
    }

    let totalDurationSec = 0;
    let coveredDistanceKm = 0;

    // WARMUP
    if (structure.warmup?.duration) {
        const warmupDurSec = structure.warmup.duration * 60;
        const warmupZone = structure.warmup.zone || 'Z1';
        const warmupDistKm = calculateDistanceFromDuration(warmupDurSec, warmupZone);

        totalDurationSec += warmupDurSec;
        coveredDistanceKm += warmupDistKm;
    }

    // COOLDOWN
    if (structure.cooldown?.duration) {
        const cooldownDurSec = structure.cooldown.duration * 60;
        const cooldownZone = structure.cooldown.zone || 'Z1';
        const cooldownDistKm = calculateDistanceFromDuration(cooldownDurSec, cooldownZone);

        totalDurationSec += cooldownDurSec;
        coveredDistanceKm += cooldownDistKm;
    }

    // MAIN SET
    if (structure.main) {
        if (structure.main.reps && structure.main.work) {
            // Interval workout
            const reps = structure.main.reps;
            const work = structure.main.work;
            const rest = structure.main.rest;
            const workZone = work.zone || 'Z5';
            const restZone = rest?.zone || 'Z1';

            // Work intervals
            let workDurSec = 0;
            let workDistKm = 0;

            if (work.distance) {
                // Distance-based intervals
                workDistKm = (work.distance / 1000) * reps;
                workDurSec = calculateDurationFromDistance(workDistKm, workZone);
            } else if (work.duration) {
                // Time-based intervals
                workDurSec = work.duration * 60 * reps;
                workDistKm = calculateDistanceFromDuration(workDurSec, workZone);
            }

            // Rest intervals
            const restDurSec = (rest?.duration || 2) * 60 * reps;
            const restDistKm = calculateDistanceFromDuration(restDurSec, restZone);

            totalDurationSec += workDurSec + restDurSec;
            coveredDistanceKm += workDistKm + restDistKm;
        } else if (structure.main.duration) {
            // Simple main set with fixed duration
            const mainDurSec = structure.main.duration * 60;
            const mainZone = structure.main.zone || 'Z2';
            const mainDistKm = calculateDistanceFromDuration(mainDurSec, mainZone);

            totalDurationSec += mainDurSec;
            coveredDistanceKm += mainDistKm;
        }
    }

    // GAP FILL: If target distance > covered, add Z2 running to fill gap
    const gapKm = Math.max(0, targetDistanceKm - coveredDistanceKm);
    if (gapKm > 0.1) {
        const fillDurSec = calculateDurationFromDistance(gapKm, 'Z2');
        totalDurationSec += fillDurSec;
    }

    return Math.ceil(totalDurationSec / 60) * 60; // Round up to nearest whole minute in seconds
}

// ============================================================================
// LEGACY COMPATIBILITY WRAPPER
// ============================================================================

/**
 * Legacy wrapper for estimateDurationSeconds
 * Redirects to accurate zone-based calculation
 * 
 * @param {number} distance - Distance in km
 * @param {string} type - Workout type ('long', 'easy', 'key')
 * @param {number} userEasyPace - User's easy pace (ignored, uses zone calc)
 * @returns {number} Duration in SECONDS
 */
function estimateDurationSeconds(distance, type, userEasyPace = 6.0) {
    // Map legacy types to zones
    const typeZoneMap = {
        'long': 'Z2',
        'easy': 'Z2',
        'key': 'Z4'
    };

    const zoneId = typeZoneMap[type] || 'Z2';
    const duration = calculateDurationFromDistance(distance, zoneId);

    // Log for debugging during transition
    console.log(`[DurationService] estimateDurationSeconds(${distance}km, ${type}) → ${Math.round(duration / 60)}min (using ${zoneId})`);

    return duration;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format pace in MM:SS
 * @param {number} secPerKm - Pace in seconds per km
 * @returns {string} Formatted pace string
 */
function formatPace(secPerKm) {
    if (!secPerKm || secPerKm <= 0) return '--:--';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.round(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format duration in HH:MM:SS or MM:SS
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string
 */
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.round(seconds % 60);

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Get all zones with their current paces (for debug/display)
 * @returns {Array} Array of zone objects with pace info
 */
function getAllZonePaces() {
    const ltPace = getLTThresholdPace();

    return Object.entries(ZONE_PACE_MULTIPLIERS)
        .filter(([id]) => !id.includes('5a') && !id.includes('5b') && !id.includes('5c')) // Exclude aliases
        .map(([id, zone]) => ({
            id,
            name: zone.name,
            minPace: formatPace(ltPace * zone.minMult),
            maxPace: formatPace(ltPace * zone.maxMult),
            avgPace: formatPace(ltPace * zone.avgMult),
            avgPaceSec: Math.round(ltPace * zone.avgMult)
        }));
}

/**
 * Log all zone paces for debugging
 */
function logZonePaces() {
    const ltPace = getLTThresholdPace();
    console.log(`[DurationService] LT Pace: ${formatPace(ltPace)}/km`);
    console.log('[DurationService] Zone Paces (using average):');

    getAllZonePaces().forEach(z => {
        console.log(`  ${z.id} (${z.name}): ${z.minPace} - ${z.maxPace} → avg ${z.avgPace}/km`);
    });
}

// ============================================================================
// EXPORT TO WINDOW
// ============================================================================

window.DurationService = {
    // Zone pace getters
    getZoneAveragePace,
    getZoneMinPace,
    getZoneMaxPace,
    getLTThresholdPace,
    getAllZonePaces,

    // Core calculations
    calculateDurationFromDistance,
    calculateDistanceFromDuration,
    calculateDurationForWorkout,
    calculateStructuredWorkoutDuration,

    // Legacy wrapper
    estimateDurationSeconds,

    // Utilities
    formatPace,
    formatDuration,
    logZonePaces,

    // Constants
    ZONE_PACE_MULTIPLIERS,
    WORKOUT_ZONE_MAP
};

// Also expose legacy function globally for backwards compatibility
window.estimateDurationSeconds = estimateDurationSeconds;

console.log('[DurationService] Module loaded - Centralized duration calculation');

// Auto-log zone paces if zones are initialized
if (typeof window.state !== 'undefined' && window.state?.thresholdPaceSecPerKm) {
    setTimeout(logZonePaces, 100);
}
