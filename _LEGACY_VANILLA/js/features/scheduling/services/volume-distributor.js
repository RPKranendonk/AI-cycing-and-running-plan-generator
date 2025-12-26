/**
 * @file volume-distributor.js
 * @description Logic for filling "Easy Run" gaps to meet weekly volume targets.
 * @usedBy js/features/scheduling/services/template-generator.js
 * @responsibilities
 * - Fills remaining available days with Easy Runs
 * - Distributes volume using a weighted role-based system (Medium Long Run vs Recovery)
 * - Assigns purposes to easy runs (e.g., "Aerobic Base", "Shakeout")
 * @why Ensures total weekly volume goals are met smarty, not just dividing by days.
 */

// ==========================================
// VOLUME DISTRIBUTOR
// Fills remaining days with easy runs using role-based allocation
// ==========================================

/**
 * Fill remaining days with easy runs - SCHEDULER V2.0 WEIGHTED LOGIC
 * Role-Based allocation:
 * 1. Medium Long Run (Anchor): ~45% of remaining volume
 * 2. Aerobic Base (Standard): ~35% of remaining volume
 * 3. Recovery Runs: ~20% of remaining volume
 * 
 * @param {Array} template - Weekly schedule template
 * @param {number} remainingVolume - Volume left to distribute
 * @param {Object} availability - Daily availability
 * @param {number} minDuration - Minimum session duration in minutes
 * @param {number} userEasyPace - User's easy pace in min/km
 * @param {boolean} isRecoveryWeek - If recovery week
 * @param {string} phase - Training phase
 * @param {number} longRunDistance - Long run distance for reference
 */
function fillEasyRuns(template, remainingVolume, availability, minDuration, userEasyPace = 6.0, isRecoveryWeek = false, phase = 'Base', longRunDistance = 0) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    if (remainingVolume <= 0) return;

    const minKmForMeaningful = (minDuration / 60) / (userEasyPace / 60) || 5;
    const RECOVERY_MAX_DURATION_MINS = 50;
    const recoveryMaxKm = RECOVERY_MAX_DURATION_MINS / userEasyPace;

    const availableSlots = template.filter(s => {
        if (s.type !== null) return false;
        if (s.availableHours < 0.5) return false;
        const possibleKm = (s.availableHours * 60) / userEasyPace;
        return possibleKm >= minKmForMeaningful;
    }).sort((a, b) => b.availableHours - a.availableHours);

    // Taper Consolidation Rule
    if (phase === 'Taper') {
        const potentialDailyAvg = remainingVolume / availableSlots.length;
        if (potentialDailyAvg < 6 && availableSlots.length > 1) {
            availableSlots.pop();
        }
    }

    if (availableSlots.length === 0) return;

    // Define Weights based on Count
    const allocations = [];
    if (availableSlots.length === 1) {
        allocations.push({ pct: 1.0, label: 'Easy Run', note: 'Aerobic Base' });
    } else if (availableSlots.length === 2) {
        allocations.push({ pct: 0.60, label: 'Aerobic Base', note: 'General Aerobic' });
        allocations.push({ pct: 0.40, label: 'Recovery', note: 'Recovery Run' });
    } else {
        allocations.push({ pct: 0.45, label: 'Medium Long Run', note: 'Endurance Anchor' });
        allocations.push({ pct: 0.35, label: 'Aerobic Base', note: 'General Aerobic' });
        const recoveryShare = 0.20 / (availableSlots.length - 2);
        for (let k = 2; k < availableSlots.length; k++) {
            allocations.push({ pct: recoveryShare, label: 'Recovery', note: 'Shakeout' });
        }
    }

    // Assign Distances
    for (let i = 0; i < availableSlots.length; i++) {
        const slot = availableSlots[i];
        const alloc = allocations[i];

        let targetDist = remainingVolume * alloc.pct;
        const slotMaxDist = (slot.availableHours * 60) / userEasyPace;

        let finalDist = Math.min(targetDist, slotMaxDist);
        if (isRecoveryWeek) finalDist = Math.min(finalDist, recoveryMaxKm);

        if (finalDist < minKmForMeaningful && finalDist < slotMaxDist) {
            finalDist = Math.min(minKmForMeaningful, slotMaxDist);
        }

        template[slot.day].type = WORKOUT_TYPES.EASY;
        template[slot.day].distance = parseFloat(finalDist.toFixed(1));

        // DEBUG LOGGING
        const useDurationService = !!window.DurationService;
        const durServiceCalc = useDurationService ? window.DurationService.calculateDurationForWorkout('Easy', finalDist) : null;
        const fallbackCalc = window.estimateDurationSeconds ? window.estimateDurationSeconds(finalDist, 'easy', userEasyPace) : finalDist * userEasyPace * 60;

        console.log(`[VolumeDistributor] Easy Run ${finalDist}km. DurationService: ${useDurationService}, userEasyPace: ${userEasyPace}`);
        console.log(`[VolumeDistributor] Calc comparison - Service: ${durServiceCalc}, Fallback: ${fallbackCalc}`);

        template[slot.day].duration = useDurationService ? durServiceCalc : fallbackCalc;
        template[slot.day].priority = 'FILL';
        template[slot.day].note = alloc.note;
        template[slot.day].secondary = { label: alloc.label };
        template[slot.day].editable = true;
    }
}

/**
 * Distribute remaining volume to key sessions and long run
 * @param {Array} template - Weekly schedule template
 * @param {number} remainingVolume - Volume left to distribute
 * @param {Object} options - Distribution options
 */
function distributeOverflow(template, remainingVolume, options = {}) {
    const { userEasyPace = 6.0, longRunDay = -1 } = options;
    const WORKOUT_TYPES = window.WORKOUT_TYPES;

    if (remainingVolume <= 1) return remainingVolume;

    // Distribute to Key Sessions (Warmup/Cooldown extension)
    const keySlots = template.filter(s =>
        s.type === WORKOUT_TYPES.INTERVALS || s.type === WORKOUT_TYPES.TEMPO
    );

    keySlots.forEach(slot => {
        if (remainingVolume <= 0) return;
        const add = Math.min(remainingVolume, 3);
        const currentDist = slot.distance;
        const maxDist = (slot.availableHours * 60) / userEasyPace;
        const actualAdd = Math.min(add, maxDist - currentDist);

        if (actualAdd > 0.5) {
            slot.distance += actualAdd;
            slot.duration = window.DurationService
                ? window.DurationService.calculateDurationForWorkout(slot.type?.id || 'Tempo', slot.distance)
                : window.estimateDurationSeconds ? window.estimateDurationSeconds(slot.distance, 'key', userEasyPace) : slot.distance * userEasyPace * 60;
            slot.note += ` (+${actualAdd.toFixed(1)}km warmup/cool)`;
            remainingVolume -= actualAdd;
        }
    });

    // If STILL remaining, add to Long Run
    if (remainingVolume > 1 && longRunDay !== -1) {
        template[longRunDay].distance += remainingVolume;
        template[longRunDay].duration = window.DurationService
            ? window.DurationService.calculateDurationForWorkout('LongRun', template[longRunDay].distance)
            : window.estimateDurationSeconds ? window.estimateDurationSeconds(template[longRunDay].distance, 'long', userEasyPace) : template[longRunDay].distance * (userEasyPace * 1.1) * 60;
        remainingVolume = 0;
    }

    return remainingVolume;
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.fillEasyRuns = fillEasyRuns;
window.distributeOverflow = distributeOverflow;

window.VolumeDistributor = {
    fillEasyRuns,
    distributeOverflow
};
