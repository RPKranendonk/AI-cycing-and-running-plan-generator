/**
 * @file frequency-optimizer.js
 * @description Service for managing running frequency (days per week) based on volume.
 * @usedBy js/features/scheduling/services/template-generator.js
 * @responsibilities
 * - Determines ideal running frequency for a given volume (e.g., <35km = 3 days)
 * - Prunes "Junk Volume" runs if frequency is too high
 * - Redistributes volume from pruned runs to remaining quality sessions
 * @why Prevents unrealistic schedules (e.g., 7 days of short runs for low volume) and ensures recovery.
 */

// ==========================================
// FREQUENCY OPTIMIZER
// Prunes low-value runs and redistributes volume
// ==========================================

/**
 * Get ideal running frequency based on weekly volume
 * @param {number} volumeKm - Target weekly volume in km
 * @returns {number} Ideal number of running days
 */
function getIdealRunFrequency(volumeKm) {
    if (volumeKm < 35) return 3;       // Minimum effective dose
    if (volumeKm <= 55) return 4;      // Balance load/recovery
    if (volumeKm <= 85) return 5;      // Increasing capacity
    return 6;                           // Elite volume management
}

/**
 * Main Frequency Optimizer - prunes low-value runs and redistributes volume
 * @param {Array} template - Weekly schedule template
 * @param {number} targetVolume - Target weekly volume in km
 * @param {Object} options - Configuration options
 * @returns {Object} { template, warnings, prunedRuns }
 */
function optimizeFrequency(template, targetVolume, options = {}) {
    const {
        longRunCap = targetVolume * 0.35,
        minWorthwhileKm = 5,
        phase = 'Base'
    } = options;

    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    const warnings = [];
    const prunedRuns = [];

    // 1. Count current running days
    const runningDays = template.filter(s =>
        s.distance > 0 &&
        s.type &&
        ['LongRun', 'Easy', 'Intervals', 'Tempo', 'Progression', 'Fartlek', 'HillSprints', 'ActiveRecovery'].includes(s.type.id)
    );

    const currentFrequency = runningDays.length;
    const idealFrequency = getIdealRunFrequency(targetVolume);

    console.log(`[FrequencyOptimizer] Weekly volume: ${targetVolume}km → Ideal: ${idealFrequency} days, Current: ${currentFrequency} days`);

    // 2. Check if we need to prune
    if (currentFrequency <= idealFrequency) {
        applyMinimumRunFloor(template, minWorthwhileKm, targetVolume, longRunCap);
        return { template, warnings, prunedRuns };
    }

    // 3. Prune loop (Shower Cost Optimization)
    // Goal: Consolidate volume if sessions are too short (Shower Cost)
    // Rule: If AvgDuration < 45 mins AND Frequency > 3, prune shortest to consolidate.
    // Also respects ideal frequency from volume tiers.

    let toPrune = currentFrequency - idealFrequency;

    // Check Shower Cost
    const totalDist = runningDays.reduce((sum, r) => sum + r.distance, 0);
    const estPace = 6.0; // Assume 6:00/km if unknown for estimation
    const totalMinutes = totalDist * estPace;
    const avgDuration = totalMinutes / currentFrequency;

    if (toPrune <= 0 && currentFrequency > 3 && avgDuration < 45) {
        console.log(`[FrequencyOptimizer] Shower Cost Triggered: Avg Duration ${avgDuration.toFixed(0)}m < 45m. Attempting consolidation.`);
        toPrune = 1; // Try pruning one session
    }

    while (toPrune > 0) {
        // Safety check: Don't drop below 3 days unless volume is tiny
        if (currentFrequency <= 3 && targetVolume > 15) {
            console.log(`[FrequencyOptimizer] Pruning stopped. Min frequency (3) reached.`);
            break;
        }
        const candidate = findPruneCandidate(template);

        if (!candidate) {
            warnings.push({
                type: 'PRUNE_BLOCKED',
                message: `Cannot reduce running days further. All remaining runs are KEY workouts.`
            });
            break;
        }

        const prunedKm = template[candidate.day].distance;
        prunedRuns.push({
            day: candidate.day,
            dayName: template[candidate.day].dayName,
            distance: prunedKm,
            reason: candidate.reason
        });

        console.log(`[FrequencyOptimizer] Pruning: ${template[candidate.day].dayName} Easy (${prunedKm}km) - reason: ${candidate.reason}`);

        if (template[candidate.day].secondary?.id === 'WeightTraining') {
            template[candidate.day].type = WORKOUT_TYPES.WEIGHT_TRAINING;
            template[candidate.day].distance = 0;
            template[candidate.day].duration = template[candidate.day].secondaryDuration || 2700;
            template[candidate.day].priority = 'SUPPORT';
            template[candidate.day].secondary = null;
            template[candidate.day].note = 'Strength Only (optimized)';
        } else {
            template[candidate.day].type = WORKOUT_TYPES.REST;
            template[candidate.day].distance = 0;
            template[candidate.day].duration = 0;
            template[candidate.day].priority = 'RECOVERY';
            template[candidate.day].secondary = null;
            template[candidate.day].note = 'Rest (volume optimized)';
        }

        redistributeVolume(template, prunedKm, longRunCap);
        toPrune--;
    }

    // 4. Apply minimum run floor
    applyMinimumRunFloor(template, minWorthwhileKm, targetVolume, longRunCap);

    // 5. Summary
    if (prunedRuns.length > 0) {
        const totalPruned = prunedRuns.reduce((sum, r) => sum + r.distance, 0);
        console.log(`[FrequencyOptimizer] Pruned ${prunedRuns.length} runs (${totalPruned.toFixed(1)}km) → redistributed to remaining runs`);
    }

    return { template, warnings, prunedRuns };
}

/**
 * Find the best candidate for pruning
 * @param {Array} template - Weekly schedule template
 * @returns {Object|null} { day, reason } or null if nothing to prune
 */
function findPruneCandidate(template) {
    const candidates = template
        .map((slot, day) => ({ ...slot, day }))
        .filter(s =>
            s.priority === 'FILL' &&
            s.type?.id === 'Easy' &&
            s.distance > 0
        );

    if (candidates.length === 0) return null;

    // Priority 1: Easy run with Strength Training
    const withStrength = candidates.find(c => c.secondary?.id === 'WeightTraining');
    if (withStrength) {
        return { day: withStrength.day, reason: 'has strength training (→ strength-only day)' };
    }

    // Priority 2: Shortest run
    candidates.sort((a, b) => a.distance - b.distance);
    const shortest = candidates[0];

    // Priority 3: Sandwiched between easy runs
    for (const c of candidates) {
        const prevDay = (c.day + 6) % 7;
        const nextDay = (c.day + 1) % 7;
        const prevIsEasy = template[prevDay].type?.id === 'Easy';
        const nextIsEasy = template[nextDay].type?.id === 'Easy';

        if (prevIsEasy && nextIsEasy) {
            return { day: c.day, reason: 'sandwiched between easy runs' };
        }
    }

    return { day: shortest.day, reason: 'shortest run' };
}

/**
 * Redistribute pruned volume to remaining runs
 * Handles caps (Long Run) by flowing leftover volume to Easy runs
 * @param {Array} template - Weekly schedule template
 * @param {number} prunedKm - Volume to redistribute
 * @param {number} longRunCap - Maximum Long Run distance
 */
function redistributeVolume(template, prunedKm, longRunCap) {
    const recipients = template.filter(s =>
        s.distance > 0 &&
        s.type &&
        ['Easy', 'LongRun'].includes(s.type.id)
    );

    if (recipients.length === 0) {
        console.warn('[FrequencyOptimizer] No recipients for volume redistribution');
        return;
    }

    let pool = prunedKm;
    const redistributionLog = [];

    // 1. Identify Recipients
    const longRun = recipients.find(s => s.type.id === 'LongRun');
    const easyRuns = recipients.filter(s => s.type.id === 'Easy');
    const totalDist = recipients.reduce((sum, r) => sum + r.distance, 0);

    // 2. Pass 1: Proportional distribution to Long Run (with cap)
    if (longRun && pool > 0) {
        const lrProportion = longRun.distance / totalDist;
        const lrTargetAddition = prunedKm * lrProportion;
        const lrMaxAddition = Math.max(0, longRunCap - longRun.distance);

        const lrActualAddition = Math.min(lrTargetAddition, lrMaxAddition);
        if (lrActualAddition > 0) {
            longRun.distance = parseFloat((longRun.distance + lrActualAddition).toFixed(1));
            longRun.duration = window.DurationService
                ? window.DurationService.calculateDurationForWorkout('LongRun', longRun.distance)
                : estimateDurationSeconds(longRun.distance, 'long', 6.0);

            redistributionLog.push(`${longRun.dayName} LongRun +${lrActualAddition.toFixed(1)}km`);
            pool -= lrActualAddition;
        } else if (lrTargetAddition > 0) {
            console.log(`[FrequencyOptimizer] Long Run capped at ${longRunCap.toFixed(1)}km, ${lrTargetAddition.toFixed(1)}km redirected to Easy runs`);
        }
    }

    // 3. Pass 2: Distribute remaining pool to Easy runs
    if (pool > 0 && easyRuns.length > 0) {
        const totalEasyDist = easyRuns.reduce((sum, r) => sum + r.distance, 0);
        for (const slot of easyRuns) {
            // Recalculate proportion based ONLY on easy runs for the remaining pool
            const proportion = totalEasyDist > 0 ? (slot.distance / totalEasyDist) : (1 / easyRuns.length);
            const addition = pool * proportion;

            if (addition > 0) {
                const oldDist = slot.distance;
                slot.distance = parseFloat((oldDist + addition).toFixed(1));
                slot.duration = window.DurationService
                    ? window.DurationService.calculateDurationForWorkout('Easy', slot.distance)
                    : estimateDurationSeconds(slot.distance, 'easy', 6.0);

                redistributionLog.push(`${slot.dayName} Easy +${addition.toFixed(1)}km`);
            }
        }
        pool = 0; // All pool should be distributed now
    }

    if (redistributionLog.length > 0) {
        console.log(`[FrequencyOptimizer] Redistributed ${prunedKm.toFixed(1)}km → ${redistributionLog.join(', ')}`);
    } else if (prunedKm > 0) {
        console.warn(`[FrequencyOptimizer] Failed to redistribute ${prunedKm.toFixed(1)}km - no eligible runs found`);
    }
}


/**
 * Apply minimum worthwhile run floor - merge tiny runs into larger ones
 * @param {Array} template - Weekly schedule template
 * @param {number} minKm - Minimum worthwhile distance
 * @param {number} weeklyVolume - Total weekly volume
 * @param {number} longRunCap - Maximum Long Run distance
 */
function applyMinimumRunFloor(template, minKm, weeklyVolume, longRunCap) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    if (weeklyVolume <= 30) return;

    const tinyRuns = template
        .map((slot, day) => ({ ...slot, day }))
        .filter(s =>
            s.distance > 0 &&
            s.distance < minKm &&
            s.type?.id === 'Easy'
        );

    for (const tiny of tinyRuns) {
        console.log(`[FrequencyOptimizer] Tiny run detected: ${tiny.dayName} (${tiny.distance}km < ${minKm}km)`);

        const prevDay = (tiny.day + 6) % 7;
        const nextDay = (tiny.day + 1) % 7;

        let mergeTarget = null;

        if (template[prevDay].type?.id === 'Easy' && template[prevDay].distance >= minKm) {
            mergeTarget = prevDay;
        } else if (template[nextDay].type?.id === 'Easy' && template[nextDay].distance >= minKm) {
            mergeTarget = nextDay;
        } else {
            const longRunSlot = template.find(s => s.type?.id === 'LongRun');
            if (longRunSlot && longRunSlot.distance + tiny.distance <= longRunCap) {
                mergeTarget = longRunSlot.day;
            }
        }

        if (mergeTarget !== null) {
            const targetSlot = template[mergeTarget];
            const newDist = targetSlot.distance + tiny.distance;
            template[mergeTarget].distance = parseFloat(newDist.toFixed(1));
            template[mergeTarget].duration = window.DurationService
                ? window.DurationService.calculateDurationForWorkout(targetSlot.type.id, newDist)
                : estimateDurationSeconds(newDist, targetSlot.type.id === 'LongRun' ? 'long' : 'easy', 6.0);

            template[tiny.day].type = WORKOUT_TYPES.REST;
            template[tiny.day].distance = 0;
            template[tiny.day].duration = 0;
            template[tiny.day].priority = 'RECOVERY';
            template[tiny.day].note = 'Rest (merged tiny run)';

            console.log(`[FrequencyOptimizer] Merged ${tiny.dayName} (${tiny.distance}km) → ${template[mergeTarget].dayName} (now ${template[mergeTarget].distance}km)`);
        } else {
            console.warn(`[FrequencyOptimizer] Cannot merge ${tiny.dayName} (${tiny.distance}km) - deleting volume`);
            template[tiny.day].type = WORKOUT_TYPES.REST;
            template[tiny.day].distance = 0;
            template[tiny.day].duration = 0;
            template[tiny.day].priority = 'RECOVERY';
        }
    }
}

/**
 * Estimate duration from distance in SECONDS (legacy fallback)
 */
function estimateDurationSeconds(distance, type, userEasyPace = 6.0) {
    if (window.DurationService?.estimateDurationSeconds) {
        return window.DurationService.estimateDurationSeconds(distance, type, userEasyPace);
    }
    const pacePerKm = type === 'long' ? userEasyPace * 1.1 : userEasyPace;
    const durationMinutes = distance * pacePerKm;
    return Math.round(durationMinutes * 60);
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.getIdealRunFrequency = getIdealRunFrequency;
window.optimizeFrequency = optimizeFrequency;
window.findPruneCandidate = findPruneCandidate;
window.redistributeVolume = redistributeVolume;
window.applyMinimumRunFloor = applyMinimumRunFloor;
window.estimateDurationSeconds = estimateDurationSeconds;

window.FrequencyOptimizer = {
    getIdealRunFrequency,
    optimizeFrequency,
    findPruneCandidate,
    redistributeVolume,
    applyMinimumRunFloor,
    estimateDurationSeconds
};
