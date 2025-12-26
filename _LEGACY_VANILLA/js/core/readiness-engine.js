/**
 * @file readiness-engine.js
 * @description Bio-feedback interpreter implementing the "Traffic Light" algorithm for adaptive training.
 * @usedBy js/features/scheduling/services/progression-engine.js, js/ui/renderers/ProgressionRenderer.js
 * @responsibilities
 * - Analyzes user feedback (RPE, Soreness, Sleep, HRV)
 * - Returns a Traffic Light status (Red/Yellow/Green)
 * - Calculates load modifiers for the next week
 * @why Logic for adjusting training load based on user feedback was getting lost in UI code.
 */

// ==========================================
// READINESS ENGINE
// Bio-feedback interpreter for adaptive training
// Implements Traffic Light algorithm → ProgressionModifier
// ==========================================

/**
 * Readiness Status Levels (Traffic Light)
 */
const READINESS_STATUS = {
    GREEN: 'GREEN',   // Aggressive/Standard progression
    YELLOW: 'YELLOW', // Maintenance/Plateau
    RED: 'RED'        // Recovery/Reset
};

/**
 * Readiness Thresholds
 */
const READINESS_THRESHOLDS = {
    // Compliance thresholds
    COMPLIANCE_GOOD: 0.90,    // >= 90% = good
    COMPLIANCE_LOW: 0.80,     // < 80% = concern
    COMPLIANCE_CRITICAL: 0.50, // < 50% = RED

    // Sleep baseline deviation (hours)
    SLEEP_POOR_DELTA: -1.5,   // 1.5h below baseline = poor

    // RHR elevation threshold (beats above baseline)
    RHR_ELEVATED_DELTA: 8,    // 8+ bpm above = concern

    // HRV drop threshold (percentage below baseline)
    HRV_LOW_PERCENT: 0.15     // 15% below baseline = concern
};

/**
 * Progression Modifiers by Status
 */
const PROGRESSION_MODIFIERS = {
    GREEN_AGGRESSIVE: 1.0,    // Apply full progression rate
    GREEN_STANDARD: 0.75,     // 75% of progression rate
    YELLOW: 0.0,              // No progression (maintenance)
    RED: -0.35                // Negative 35% (forced recovery)
};

/**
 * Calculate Readiness Score from user feedback and objective metrics
 * @param {Object} feedback - User feedback data
 * @returns {Object} Readiness assessment with status and modifier
 */
function calculateReadiness(feedback) {
    const {
        // Subjective (required for full assessment)
        rpe = null,              // 1-10 (perceived exertion last week)
        motivation = 'Normal',   // 'Low', 'Normal', 'High'
        soreness = 'None',       // 'None', 'Sore', 'Pain'

        // Compliance (calculated from plan vs actual)
        compliance = null,       // 0.0 - 1.0 (actual/planned volume)

        // Objective (optional, from Intervals.icu)
        restingHR = null,        // Current RHR
        baselineRHR = null,      // Normal RHR baseline
        sleepHours = null,       // Last night's sleep
        baselineSleep = 7.5,     // User's typical sleep
        hrv = null,              // Current HRV
        baselineHRV = null       // Normal HRV baseline
    } = feedback;

    // Initialize scoring
    let redFlags = 0;
    let yellowFlags = 0;
    let greenFlags = 0;
    const reasons = [];

    // =========================================
    // RULE 1: Pain/Injury Check (Immediate RED + INTENSITY BLOCK)
    // =========================================
    if (soreness === 'Pain') {
        return {
            status: READINESS_STATUS.RED,
            modifier: PROGRESSION_MODIFIERS.RED,
            reasons: ['⛔ PAIN/INJURY: All intensity BLOCKED until resolved'],
            recommendation: 'REST or EASY only. No intervals/tempo. Consider cross-training (cycling/swimming) if running is painful.',
            flags: {
                red: 1,
                yellow: 0,
                green: 0,
                intensityBlocked: true  // Hard gate - no KEY workouts
            },
            allowedWorkoutTypes: ['Rest', 'Easy', 'ActiveRecovery', 'Yoga'],
            blockedWorkoutTypes: ['Intervals', 'Tempo', 'LongRun', 'WeightTraining']
        };
    }

    // =========================================
    // RULE 2: Critical Compliance (RED if missed >50%)
    // =========================================
    if (compliance !== null && compliance < READINESS_THRESHOLDS.COMPLIANCE_CRITICAL) {
        redFlags++;
        reasons.push(`🔴 Only ${Math.round(compliance * 100)}% compliance - missed too many workouts`);
    }

    // =========================================
    // RULE 3: Low Motivation (RED trigger)
    // =========================================
    if (motivation === 'Low') {
        if (rpe && rpe >= 8) {
            // Low motivation + high RPE = burnt out
            redFlags++;
            reasons.push('🔴 Low motivation + high fatigue = burnout signs');
        } else {
            yellowFlags++;
            reasons.push('🟡 Low motivation - maintain load, monitor');
        }
    }

    // =========================================
    // RULE 4: Compliance Check (YELLOW if <80%)
    // =========================================
    if (compliance !== null && compliance < READINESS_THRESHOLDS.COMPLIANCE_LOW && compliance >= READINESS_THRESHOLDS.COMPLIANCE_CRITICAL) {
        yellowFlags++;
        reasons.push(`🟡 Compliance at ${Math.round(compliance * 100)}% - maintaining load`);
    }

    // =========================================
    // RULE 5: Soreness Check (YELLOW if sore)
    // =========================================
    if (soreness === 'Sore') {
        yellowFlags++;
        reasons.push('🟡 Muscle soreness reported');
    }

    // =========================================
    // RULE 6: Sleep Quality (if provided)
    // =========================================
    if (sleepHours !== null) {
        const sleepDelta = sleepHours - baselineSleep;
        if (sleepDelta <= READINESS_THRESHOLDS.SLEEP_POOR_DELTA) {
            yellowFlags++;
            reasons.push(`🟡 Poor sleep (${sleepHours}h vs ${baselineSleep}h baseline)`);
        } else if (sleepDelta >= 0.5) {
            greenFlags++;
            reasons.push(`🟢 Good sleep (${sleepHours}h)`);
        }
    }

    // =========================================
    // RULE 7: RHR Elevation (if provided)
    // =========================================
    if (restingHR !== null && baselineRHR !== null) {
        const rhrDelta = restingHR - baselineRHR;
        if (rhrDelta >= READINESS_THRESHOLDS.RHR_ELEVATED_DELTA) {
            yellowFlags++;
            reasons.push(`🟡 Elevated RHR (+${rhrDelta} bpm above baseline)`);
        } else if (rhrDelta <= 0) {
            greenFlags++;
            reasons.push(`🟢 RHR normal/low (${restingHR} bpm)`);
        }
    }

    // =========================================
    // RULE 8: HRV Drop (if provided)
    // =========================================
    if (hrv !== null && baselineHRV !== null) {
        const hrvDropPercent = (baselineHRV - hrv) / baselineHRV;
        if (hrvDropPercent >= READINESS_THRESHOLDS.HRV_LOW_PERCENT) {
            yellowFlags++;
            reasons.push(`🟡 HRV below baseline (${hrv} vs ${baselineHRV})`);
        } else if (hrvDropPercent < 0) {
            greenFlags++;
            reasons.push(`🟢 HRV above baseline (${hrv})`);
        }
    }

    // =========================================
    // RULE 9: Good Compliance (GREEN trigger)
    // =========================================
    if (compliance !== null && compliance >= READINESS_THRESHOLDS.COMPLIANCE_GOOD) {
        greenFlags++;
        reasons.push(`🟢 Excellent compliance (${Math.round(compliance * 100)}%)`);
    }

    // =========================================
    // RULE 10: High Motivation (GREEN boost)
    // =========================================
    if (motivation === 'High' && (soreness === 'None' || soreness === null)) {
        greenFlags++;
        reasons.push('🟢 High motivation');
    }

    // =========================================
    // DETERMINE FINAL STATUS
    // =========================================
    let status, modifier, recommendation;

    if (redFlags > 0) {
        status = READINESS_STATUS.RED;
        modifier = PROGRESSION_MODIFIERS.RED;
        recommendation = 'Forced recovery week: -35% volume, no intensity. Focus on rest.';
    } else if (yellowFlags >= 2 || (yellowFlags >= 1 && greenFlags === 0)) {
        status = READINESS_STATUS.YELLOW;
        modifier = PROGRESSION_MODIFIERS.YELLOW;
        recommendation = 'Maintenance week: Repeat previous load. No progression.';
    } else if (greenFlags >= 2 && yellowFlags === 0) {
        status = READINESS_STATUS.GREEN;
        modifier = PROGRESSION_MODIFIERS.GREEN_AGGRESSIVE;
        recommendation = 'Full progression: Apply standard increase.';
    } else {
        status = READINESS_STATUS.GREEN;
        modifier = PROGRESSION_MODIFIERS.GREEN_STANDARD;
        recommendation = 'Standard progression: Apply 75% of increase rate.';
    }

    // =========================================
    // INTELLIGENT DEFAULTS (when no feedback provided)
    // =========================================
    const hasObjectiveData = (sleepHours !== null || restingHR !== null || hrv !== null);
    const noSubjectiveFeedback = (compliance === null && rpe === null && motivation === 'Normal' && soreness === 'None');

    if (noSubjectiveFeedback) {
        if (hasObjectiveData && yellowFlags === 0) {
            // Objective data is clean → GREEN_STANDARD
            status = READINESS_STATUS.GREEN;
            modifier = PROGRESSION_MODIFIERS.GREEN_STANDARD;
            reasons.push('ℹ️ No subjective feedback. Using objective data (looks good).');
            recommendation = 'Objective metrics look healthy. Applying standard progression.';
        } else if (!hasObjectiveData) {
            // No data at all → First 2 weeks YELLOW, then GREEN_STANDARD
            // Calculate weeks since plan start (if available)
            const weeksSinceStart = window.state?.generatedPlan?.length > 0 ?
                Math.floor((Date.now() - new Date(window.state.generatedPlan[0].startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) : 0;

            if (weeksSinceStart <= 2) {
                status = READINESS_STATUS.YELLOW;
                modifier = PROGRESSION_MODIFIERS.YELLOW;
                reasons.push('⚠️ No feedback yet. Defaulting to maintenance for first 2 weeks.');
                recommendation = 'Please provide weekly feedback for optimal progression.';
            } else {
                status = READINESS_STATUS.GREEN;
                modifier = PROGRESSION_MODIFIERS.GREEN_STANDARD;
                reasons.push('ℹ️ No feedback (week 3+). Assuming standard progression.');
                recommendation = 'Continuing with standard progression. Feedback still recommended.';
            }
        } else {
            // Has objective data but has yellow flags
            status = READINESS_STATUS.YELLOW;
            modifier = PROGRESSION_MODIFIERS.YELLOW;
            reasons.push('⚠️ No subjective feedback + some concerning objective metrics.');
            recommendation = 'Please provide feedback to help assess readiness accurately.';
        }
    }

    return {
        status,
        modifier,
        reasons,
        recommendation,
        flags: { red: redFlags, yellow: yellowFlags, green: greenFlags }
    };
}

/**
 * Calculate compliance from planned vs actual volume
 * @param {number} plannedVolume - Target volume (km or TSS)
 * @param {number} actualVolume - Completed volume
 * @returns {number} Compliance ratio (0.0 - 1.0+)
 */
function calculateCompliance(plannedVolume, actualVolume) {
    if (!plannedVolume || plannedVolume === 0) return 1.0;
    return Math.min(actualVolume / plannedVolume, 1.5); // Cap at 150%
}

/**
 * Apply readiness modifier to next week's targets
 * @param {Object} baseTargets - Original plan targets
 * @param {number} modifier - Readiness modifier (-0.35 to 1.0)
 * @param {number} standardProgressionRate - Default progression (e.g., 0.10 for 10%)
 * @returns {Object} Modified targets with safety caps applied
 */
function applyReadinessToTargets(baseTargets, modifier, standardProgressionRate = 0.10) {
    const {
        volume,        // km or TSS
        longRunKm,     // Long run distance
        longRunMins,   // Long run duration
        sport = 'Running'
    } = baseTargets;

    // Calculate scaled progression
    const effectiveRate = standardProgressionRate * modifier;

    // Apply to volume
    let newVolume = volume * (1 + effectiveRate);

    // Apply to long run
    let newLongRunKm = longRunKm * (1 + effectiveRate);
    let newLongRunMins = longRunMins * (1 + effectiveRate);

    // =========================================
    // SAFETY RAILS: Cap weekly increases
    // =========================================
    const maxWeeklyVolumeIncrease = sport === 'Cycling' ? 0.15 : 0.12; // 15% cycling, 12% running
    const maxLongRunKmIncrease = 2;  // +2km max
    const maxLongRunMinIncrease = 15; // +15 min max

    // Cap volume increase
    const volumeIncrease = newVolume - volume;
    const maxVolumeIncrease = volume * maxWeeklyVolumeIncrease;
    if (volumeIncrease > maxVolumeIncrease) {
        newVolume = volume + maxVolumeIncrease;
    }

    // Cap long run km increase
    const longKmIncrease = newLongRunKm - longRunKm;
    if (longKmIncrease > maxLongRunKmIncrease) {
        newLongRunKm = longRunKm + maxLongRunKmIncrease;
    }

    // Cap long run mins increase
    const longMinIncrease = newLongRunMins - longRunMins;
    if (longMinIncrease > maxLongRunMinIncrease) {
        newLongRunMins = longRunMins + maxLongRunMinIncrease;
    }

    // Handle RED status (negative modifier)
    if (modifier < 0) {
        // For recovery, apply percentage reduction
        newVolume = volume * (1 + modifier);
        newLongRunKm = longRunKm * (1 + modifier);
        newLongRunMins = longRunMins * (1 + modifier);
    }

    return {
        volume: Math.round(newVolume * 10) / 10,
        longRunKm: Math.round(newLongRunKm * 10) / 10,
        longRunMins: Math.round(newLongRunMins),
        appliedModifier: modifier,
        effectiveProgressionRate: effectiveRate
    };
}

/**
 * Get status color class for UI
 */
function getReadinessColorClass(status) {
    switch (status) {
        case READINESS_STATUS.GREEN: return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/40';
        case READINESS_STATUS.YELLOW: return 'text-amber-400 bg-amber-500/20 border-amber-500/40';
        case READINESS_STATUS.RED: return 'text-red-400 bg-red-500/20 border-red-500/40';
        default: return 'text-slate-400 bg-slate-500/20 border-slate-500/40';
    }
}

/**
 * Get status icon
 */
function getReadinessIcon(status) {
    switch (status) {
        case READINESS_STATUS.GREEN: return '🟢';
        case READINESS_STATUS.YELLOW: return '🟡';
        case READINESS_STATUS.RED: return '🔴';
        default: return '⚪';
    }
}

/**
 * Auto-fetch compliance data for current week from Intervals.icu
 * @returns {Object|null} { compliance, plannedVolume, actualVolume } or null
 */
async function getAutoCompliance() {
    if (!window.state?.generatedPlan || window.state.generatedPlan.length === 0) {
        console.log('[Readiness] No plan available for auto-compliance');
        return null;
    }

    // Find current week index
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentWeekIndex = -1;
    for (let i = 0; i < window.state.generatedPlan.length; i++) {
        const week = window.state.generatedPlan[i];
        if (!week.startDate) continue;

        const weekStart = new Date(week.startDate + 'T00:00:00');
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        if (today >= weekStart && today <= weekEnd) {
            currentWeekIndex = i;
            break;
        }
    }

    if (currentWeekIndex < 0) {
        console.log('[Readiness] No current week found in plan');
        return null;
    }

    // Use intervals-service calculateWeekCompliance
    if (typeof window.calculateWeekCompliance === 'function') {
        try {
            const result = await window.calculateWeekCompliance(currentWeekIndex);
            console.log('[Readiness] Auto-compliance fetched:', result);
            return result;
        } catch (err) {
            console.error('[Readiness] Auto-compliance fetch error:', err);
            return null;
        }
    }

    console.warn('[Readiness] calculateWeekCompliance not available');
    return null;
}

/**
 * Calculate readiness with auto-fetched compliance
 * Convenience wrapper that fetches compliance before calculating
 * @param {Object} feedback - User feedback (rpe, motivation, soreness, biometrics)
 * @returns {Object} Readiness assessment with auto-fetched compliance
 */
async function calculateReadinessWithAuto(feedback = {}) {
    // Auto-fetch compliance if not provided
    if (feedback.compliance === undefined || feedback.compliance === null) {
        const autoComplianceData = await getAutoCompliance();
        if (autoComplianceData && autoComplianceData.compliance !== null) {
            feedback.compliance = autoComplianceData.compliance;
            feedback._autoComplianceData = autoComplianceData; // Store for UI
        }
    }

    // Merge in biometrics from state if available
    if (window.state?.biometrics) {
        const bio = window.state.biometrics;
        if (bio.rhr?.current && !feedback.restingHR) {
            feedback.restingHR = bio.rhr.current;
            feedback.baselineRHR = bio.rhr.avg;
        }
        if (bio.hrv?.current && !feedback.hrv) {
            feedback.hrv = bio.hrv.current;
            feedback.baselineHRV = bio.hrv.avg;
        }
        if (bio.sleep?.current && !feedback.sleepHours) {
            feedback.sleepHours = parseFloat(bio.sleep.current);
            feedback.baselineSleep = parseFloat(bio.sleep.avg);
        }
    }

    // Call original sync function
    return calculateReadiness(feedback);
}

// Expose to window
window.READINESS_STATUS = READINESS_STATUS;
window.READINESS_THRESHOLDS = READINESS_THRESHOLDS;
window.PROGRESSION_MODIFIERS = PROGRESSION_MODIFIERS;
window.calculateReadiness = calculateReadiness;
window.calculateReadinessWithAuto = calculateReadinessWithAuto;
window.getAutoCompliance = getAutoCompliance;
window.calculateCompliance = calculateCompliance;
window.applyReadinessToTargets = applyReadinessToTargets;
window.getReadinessColorClass = getReadinessColorClass;
window.getReadinessIcon = getReadinessIcon;

console.log('[ReadinessEngine] Loaded - Traffic Light algorithm ready (with auto-compliance)');

