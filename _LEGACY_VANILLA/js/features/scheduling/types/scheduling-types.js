// ==========================================
// SCHEDULING TYPES & CONSTANTS
// Shared types for the scheduling feature
// ==========================================

/**
 * Workout Types with priorities
 */
const WORKOUT_TYPES = {
    LONG_RUN: { id: 'LongRun', label: 'Long Run', icon: '🏃‍♂️', color: 'orange', priority: 'KEY' },
    INTERVALS: { id: 'Intervals', label: 'Intervals', icon: '⚡', color: 'red', priority: 'KEY' },
    TEMPO: { id: 'Tempo', label: 'Tempo', icon: '🔥', color: 'amber', priority: 'KEY' },
    EASY: { id: 'Easy', label: 'Easy Run', icon: '🏃‍♂️', color: 'green', priority: 'FILL' },
    ACTIVE_RECOVERY: { id: 'ActiveRecovery', label: 'Recovery', icon: '🚶', color: 'emerald', priority: 'RECOVERY', maxDuration: 30 },
    WEIGHT_TRAINING: { id: 'WeightTraining', label: 'Strength', icon: '🏋️', color: 'purple', priority: 'SUPPORT' },
    YOGA: { id: 'Yoga', label: 'Yoga', icon: '🧘', color: 'teal', priority: 'SUPPORT' },
    REST: { id: 'Rest', label: 'Rest', icon: '🛌', color: 'slate', priority: 'RECOVERY' },
    BLOCKED: { id: 'Blocked', label: 'Unavailable', icon: '🚫', color: 'gray', priority: 'BLOCKED' },
    // Base Phase Specifics
    HILL_SPRINTS: { id: 'HillSprints', label: 'Hill Sprints', icon: '⛰️', color: 'red', priority: 'KEY' },
    PROGRESSION: { id: 'Progression', label: 'Progression', icon: '📈', color: 'amber', priority: 'KEY' },
    FARTLEK: { id: 'Fartlek', label: 'Fartlek', icon: '💨', color: 'red', priority: 'KEY' }
};

/**
 * Slot Priority Levels
 */
const SLOT_PRIORITY = {
    KEY: 3,        // Non-negotiable (Long Run, Key Intervals)
    SUPPORT: 2,    // Important but flexible (Strength, Yoga)
    FILL: 1,       // Volume fillers (Easy Runs)
    RECOVERY: 0,   // Rest days (post-hard day)
    BLOCKED: -1    // Cannot schedule (0h availability)
};

/**
 * Max gym sessions per phase
 */
function getMaxGymForPhase(phase) {
    const limits = { Base: 2, 'Base/Build': 2, Build: 2, Peak: 1, Taper: 0, Race: 0 };
    return limits[phase] || 2;
}

/**
 * Calculate volume already scheduled
 */
function calculateUsedVolume(template) {
    let volume = 0;
    for (const slot of template) {
        if (slot.distance) volume += slot.distance;
    }
    return volume;
}

/**
 * Check if a recovery week
 */
function isRecoveryWeek(week) {
    return (week % 4 === 0);
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.WORKOUT_TYPES = WORKOUT_TYPES;
window.SLOT_PRIORITY = SLOT_PRIORITY;
window.getMaxGymForPhase = getMaxGymForPhase;
window.calculateUsedVolume = calculateUsedVolume;
window.isRecoveryWeek = isRecoveryWeek;

window.SchedulingTypes = {
    WORKOUT_TYPES,
    SLOT_PRIORITY,
    getMaxGymForPhase,
    calculateUsedVolume,
    isRecoveryWeek
};
