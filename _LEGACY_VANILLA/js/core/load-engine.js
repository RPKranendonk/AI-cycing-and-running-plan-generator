// ============================================================================
// DYNAMIC LOAD CALCULATION ENGINE
// 3-Layer Architecture: Baseline → Readiness → User Override
// ============================================================================

/**
 * Calculate the target weekly training load using 3-layer architecture
 * 
 * Layer 1: Deterministic Baseline (The Plan)
 * Layer 2: Readiness Multiplier (The Governor)
 * Layer 3: User Override (Life/Camp Slider)
 * 
 * @param {number} prevLoad - Previous week's load in km
 * @param {Object} settings - Plan settings
 * @param {number} settings.progressionRate - e.g. 1.05, 1.10
 * @param {number} settings.allTimeMaxLoad - User's historical max weekly volume
 * @param {Object} readiness - Current readiness state
 * @param {number} readiness.score - Normalized 0-10 score
 * @param {string} readiness.zone - 'prime' | 'tired' | 'strained' | 'danger'
 * @param {number} userOverride - User adjustment factor (0.5-1.2)
 * @returns {Object} { targetDistance, warnings[], recommendation, multipliers }
 */
function calculateTargetLoad(prevLoad, settings = {}, readiness = {}, userOverride = 1.0) {
    const {
        progressionRate = 1.05,
        allTimeMaxLoad = prevLoad * 1.2, // Default: 20% above previous
        phase = 'Base',
        isRecoveryWeek = false
    } = settings;

    const warnings = [];
    let recommendation = '';

    // =========================================================================
    // LAYER 1: DETERMINISTIC BASELINE (The Plan)
    // =========================================================================
    let baseline;

    if (isRecoveryWeek) {
        // Recovery weeks: -30% from previous
        baseline = prevLoad * 0.7;
    } else {
        baseline = prevLoad * progressionRate;
    }

    // =========================================================================
    // LAYER 2: READINESS MULTIPLIER (The Governor)
    // =========================================================================
    const readinessScore = readiness.score ?? 8; // Default: Prime
    let readinessMultiplier;
    let readinessZone;

    if (readinessScore >= 8) {
        readinessMultiplier = 1.0;
        readinessZone = 'prime';
    } else if (readinessScore >= 5) {
        readinessMultiplier = 0.85;
        readinessZone = 'tired';
        warnings.push('⚡ Fatigue detected: Volume reduced 15%');
    } else if (readinessScore >= 3) {
        readinessMultiplier = 0.70;
        readinessZone = 'strained';
        warnings.push('⚠️ High fatigue: Volume reduced 30%');
    } else {
        readinessMultiplier = 0.40;
        readinessZone = 'danger';
        warnings.push('🛑 Recovery mode: Volume reduced 60%');
    }

    const readinessAdjusted = baseline * readinessMultiplier;

    // =========================================================================
    // LAYER 3: USER OVERRIDE (Life/Camp Slider)
    // =========================================================================
    const clampedOverride = Math.max(0.5, Math.min(1.2, userOverride));
    const finalTargetLoad = readinessAdjusted * clampedOverride;

    // =========================================================================
    // SAFETY & BOUNDARY CHECKS (Ghost Coach)
    // =========================================================================

    // Check #1: New Territory Warning
    const newTerritoryThreshold = allTimeMaxLoad * 1.05;
    if (finalTargetLoad > newTerritoryThreshold) {
        warnings.push(`🆕 NEW TERRITORY: ${Math.round(finalTargetLoad)}km exceeds your all-time max (${Math.round(allTimeMaxLoad)}km). Injury risk elevated.`);
        recommendation = 'Consider backing off to ' + Math.round(allTimeMaxLoad * 0.95) + 'km or ensure recovery week follows.';
    }

    // Check #2: Camp/Overreach Validation
    if (clampedOverride > 1.15) {
        warnings.push('🏕️ OVERREACH BLOCK: +' + Math.round((clampedOverride - 1) * 100) + '% manual increase. Must be followed by recovery week.');
    }

    // Check #3: Dangerous combination - fatigued + pushing
    if (readinessZone !== 'prime' && clampedOverride > 1.0) {
        warnings.push('⚠️ Pushing volume while fatigued increases injury risk.');
    }

    // =========================================================================
    // FREQUENCY RECOMMENDATION
    // =========================================================================
    const idealFrequency = getIdealRunFrequency ? getIdealRunFrequency(finalTargetLoad) : 4;

    return {
        targetDistance: Math.round(finalTargetLoad * 10) / 10,
        baseline: Math.round(baseline * 10) / 10,
        readinessAdjusted: Math.round(readinessAdjusted * 10) / 10,
        warnings,
        recommendation,
        multipliers: {
            progression: progressionRate,
            readiness: readinessMultiplier,
            userOverride: clampedOverride,
            total: progressionRate * readinessMultiplier * clampedOverride
        },
        readinessZone,
        idealFrequency,
        isRecoveryWeek
    };
}

/**
 * Get readiness multiplier from score
 */
function getReadinessMultiplier(score) {
    if (score >= 8) return { multiplier: 1.0, zone: 'prime' };
    if (score >= 5) return { multiplier: 0.85, zone: 'tired' };
    if (score >= 3) return { multiplier: 0.70, zone: 'strained' };
    return { multiplier: 0.40, zone: 'danger' };
}

/**
 * Get ideal run frequency based on volume (used by frequency optimizer)
 */
function getIdealRunFrequency(volumeKm) {
    if (volumeKm < 35) return 3;
    if (volumeKm < 55) return 4;
    if (volumeKm < 85) return 5;
    return 6;
}

// ============================================================================
// EXPORTS
// ============================================================================
window.calculateTargetLoad = calculateTargetLoad;
window.getReadinessMultiplier = getReadinessMultiplier;

console.log('[LoadEngine] Dynamic Load Calculation Engine loaded');
