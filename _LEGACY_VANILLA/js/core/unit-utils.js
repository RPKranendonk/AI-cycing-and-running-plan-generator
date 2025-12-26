// ==========================================
// UNIT UTILITIES
// Canonical unit conversions for scheduling pipeline
// ==========================================

/**
 * Canonical Units Standard:
 * - Duration: SECONDS (for workouts, training rules)
 * - Availability: HOURS (for scheduling)
 * - Distance: METERS (for CSV), KM (for display)
 * - Pace: MIN/KM (for user-facing)
 */

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = 3600;
const METERS_PER_KM = 1000;

/**
 * Convert minutes to seconds
 * @param {number} minutes 
 * @returns {number} seconds (rounded)
 */
function minutesToSeconds(minutes) {
    if (typeof minutes !== 'number' || isNaN(minutes)) return 0;
    return Math.round(minutes * SECONDS_PER_MINUTE);
}

/**
 * Convert seconds to minutes
 * @param {number} seconds 
 * @returns {number} minutes (rounded)
 */
function secondsToMinutes(seconds) {
    if (typeof seconds !== 'number' || isNaN(seconds)) return 0;
    return Math.round(seconds / SECONDS_PER_MINUTE);
}

/**
 * Convert hours to minutes
 * @param {number} hours 
 * @returns {number} minutes (rounded)
 */
function hoursToMinutes(hours) {
    if (typeof hours !== 'number' || isNaN(hours)) return 0;
    return Math.round(hours * MINUTES_PER_HOUR);
}

/**
 * Convert hours to seconds
 * @param {number} hours 
 * @returns {number} seconds (rounded)
 */
function hoursToSeconds(hours) {
    if (typeof hours !== 'number' || isNaN(hours)) return 0;
    return Math.round(hours * SECONDS_PER_HOUR);
}

/**
 * Convert kilometers to meters
 * @param {number} km 
 * @returns {number} meters (rounded)
 */
function kmToMeters(km) {
    if (typeof km !== 'number' || isNaN(km)) return 0;
    return Math.round(km * METERS_PER_KM);
}

/**
 * Convert meters to kilometers
 * @param {number} meters 
 * @returns {number} km (1 decimal)
 */
function metersToKm(meters) {
    if (typeof meters !== 'number' || isNaN(meters)) return 0;
    return Math.round((meters / METERS_PER_KM) * 10) / 10;
}

/**
 * Runtime assertion for duration validation
 * @param {number} durationSeconds - Duration to validate
 * @param {string} context - Where this check is called from
 * @param {number} minExpected - Minimum expected seconds (default 1200 = 20min)
 */
function assertDurationSeconds(durationSeconds, context, minExpected = 1200) {
    if (durationSeconds > 0 && durationSeconds < minExpected) {
        console.warn(`[Units:${context}] Duration ${durationSeconds}s seems too short. Expected >= ${minExpected}s (${secondsToMinutes(minExpected)}min).`);
    }
    if (durationSeconds > 0 && durationSeconds < 60) {
        console.error(`[Units:${context}] Duration ${durationSeconds}s looks like MINUTES, not SECONDS! This is likely a unit mismatch.`);
    }
}

/**
 * Runtime assertion for distance validation
 * @param {number} distanceMeters - Distance to validate
 * @param {string} context - Where this check is called from
 */
function assertDistanceMeters(distanceMeters, context) {
    if (distanceMeters > 0 && distanceMeters < 1000) {
        console.warn(`[Units:${context}] Distance ${distanceMeters}m might be in KM instead of METERS.`);
    }
}

// Export to window
window.Units = {
    minutesToSeconds,
    secondsToMinutes,
    hoursToMinutes,
    hoursToSeconds,
    kmToMeters,
    metersToKm,
    assertDurationSeconds,
    assertDistanceMeters,
    // Constants
    SECONDS_PER_MINUTE,
    MINUTES_PER_HOUR,
    SECONDS_PER_HOUR,
    METERS_PER_KM
};

// Also expose directly for convenience
window.minutesToSeconds = minutesToSeconds;
window.secondsToMinutes = secondsToMinutes;
window.hoursToMinutes = hoursToMinutes;
window.hoursToSeconds = hoursToSeconds;
window.kmToMeters = kmToMeters;
window.metersToKm = metersToKm;

console.log('[Units] Unit conversion utilities loaded');
