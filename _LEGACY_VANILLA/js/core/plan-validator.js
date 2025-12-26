// ==========================================
// PLAN VALIDATION SYSTEM
// Bulletproof validation for training plans
// Catches edge cases BEFORE and AFTER AI generation
// ==========================================

/**
 * Validation severity levels
 */
const VALIDATION_SEVERITY = {
    ERROR: 'error',      // Cannot proceed - fatal issue
    WARNING: 'warning',  // Risky but allowed - user should acknowledge
    INFO: 'info'         // Informational - no action required
};

/**
 * Helper: Get ISO week number from date
 */
function getISOWeek(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

/**
 * All validation rules with detection logic
 */
const VALIDATION_RULES = {

    // =========================================
    // PRE-GENERATION VALIDATIONS
    // Run BEFORE calling AI
    // =========================================

    /**
     * Check if weekly volume fits in available time
     */
    volumeExceedsTime: {
        id: 'VOLUME_EXCEEDS_TIME',
        severity: VALIDATION_SEVERITY.ERROR,
        category: 'pre',
        title: '⚠️ Volume Exceeds Available Time',
        check: (config, rules) => {
            const { targetVolume, totalAvailableHours, sport } = config;
            if (!targetVolume || !totalAvailableHours) return null;

            // Estimate time needed for volume (running: ~6 min/km average including warmup)
            const avgPaceMinPerKm = sport === 'Cycling' ? 2.5 : 6;
            const hoursNeeded = (targetVolume * avgPaceMinPerKm) / 60;

            if (hoursNeeded > totalAvailableHours) {
                return {
                    message: `You want ${targetVolume}km but only have ${totalAvailableHours.toFixed(1)}h available. ` +
                        `At ${avgPaceMinPerKm} min/km, you need ~${hoursNeeded.toFixed(1)}h.`,
                    suggestion: `Reduce target to ${Math.floor(totalAvailableHours * 60 / avgPaceMinPerKm)}km ` +
                        `or add ${(hoursNeeded - totalAvailableHours).toFixed(1)}h more training time.`
                };
            }
            return null;
        }
    },

    /**
     * Check if Long Run fits in its scheduled day's available time
     */
    longRunExceedsDayTime: {
        id: 'LONG_RUN_EXCEEDS_DAY',
        severity: VALIDATION_SEVERITY.ERROR,
        category: 'pre',
        title: '⚠️ Long Run Too Long for Available Time',
        check: (config, rules) => {
            const { longRunDistance, longRunDayHours, basePace, sport } = config;
            if (!longRunDistance || !longRunDayHours) return null;

            // Calculate Long Run duration
            const paceMinPerKm = basePace ? parsePaceToMinutes(basePace) : (sport === 'Cycling' ? 2.5 : 5.5);
            const longRunHours = (longRunDistance * paceMinPerKm) / 60;

            if (longRunHours > longRunDayHours) {
                return {
                    message: `Your ${longRunDistance}km Long Run needs ~${longRunHours.toFixed(1)}h ` +
                        `but you only have ${longRunDayHours}h available on that day.`,
                    suggestion: `Either increase available time on Long Run day to ${Math.ceil(longRunHours * 2) / 2}h, ` +
                        `or reduce Long Run to ${Math.floor(longRunDayHours * 60 / paceMinPerKm)}km.`
                };
            }
            return null;
        }
    },

    /**
     * Check if Long Run day is marked as REST
     */
    longRunOnRestDay: {
        id: 'LONG_RUN_ON_REST',
        severity: VALIDATION_SEVERITY.ERROR,
        category: 'pre',
        title: '🚫 Long Run Scheduled on Rest Day',
        check: (config, rules) => {
            const { longRunDay, restDays } = config;
            if (longRunDay === undefined || !restDays) return null;

            if (restDays.includes(longRunDay)) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                return {
                    message: `You want your Long Run on ${dayNames[longRunDay]}, but that day is marked as REST (0h).`,
                    suggestion: `Either change Long Run day, or add time to ${dayNames[longRunDay]}.`
                };
            }
            return null;
        }
    },

    /**
     * Check if there are enough training days for the sessions needed
     */
    insufficientTrainingDays: {
        id: 'INSUFFICIENT_TRAINING_DAYS',
        severity: VALIDATION_SEVERITY.WARNING,
        category: 'pre',
        title: '⚠️ Very Few Training Days',
        check: (config, rules) => {
            const { availableDays, targetVolume, sport } = config;
            if (!availableDays) return null;

            const minDaysForVolume = sport === 'Cycling'
                ? Math.ceil(targetVolume / 150) // ~150 TSS per day max for cycling
                : Math.ceil(targetVolume / 20);  // ~20km per day max for running

            if (availableDays.length < minDaysForVolume) {
                return {
                    message: `You have ${availableDays.length} training days but need at least ${minDaysForVolume} ` +
                        `for ${targetVolume}${sport === 'Cycling' ? ' TSS' : 'km'}.`,
                    suggestion: `Add ${minDaysForVolume - availableDays.length} more training days, ` +
                        `or reduce weekly volume.`
                };
            }
            return null;
        }
    },

    /**
     * Check if consecutive hard days are planned
     */
    noRestDays: {
        id: 'NO_REST_DAYS',
        severity: VALIDATION_SEVERITY.WARNING,
        category: 'pre',
        title: '⚠️ No Rest Days Scheduled',
        check: (config, rules) => {
            const { restDays } = config;
            if (!restDays) return null;

            if (restDays.length === 0) {
                return {
                    message: `You have no rest days scheduled. Recovery is essential for adaptation.`,
                    suggestion: `Add at least 1 full rest day per week. Most athletes need 1-2.`
                };
            }
            return null;
        }
    },

    // =========================================
    // POST-GENERATION VALIDATIONS
    // Run AFTER AI returns workouts
    // =========================================

    /**
     * Detect back-to-back Long Runs (Sunday → Monday)
     */
    backToBackLongRuns: {
        id: 'BACK_TO_BACK_LONG_RUNS',
        severity: VALIDATION_SEVERITY.ERROR,
        category: 'post',
        title: '🚫 Back-to-Back Long Runs Detected',
        check: (workouts, rules) => {
            const violations = [];

            // Sort workouts by date
            const sorted = [...workouts].sort((a, b) =>
                new Date(a.start_date_local) - new Date(b.start_date_local)
            );

            // Find Long Runs
            const longRuns = sorted.filter(w =>
                w.title && (w.title.toLowerCase().includes('long') ||
                    w.totalDistance > 15000) // 15km+
            );

            // Check each pair for consecutive days
            for (let i = 0; i < longRuns.length - 1; i++) {
                const d1 = new Date(longRuns[i].start_date_local);
                const d2 = new Date(longRuns[i + 1].start_date_local);
                const daysDiff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

                if (daysDiff <= 1) {
                    violations.push({
                        message: `Long Runs on ${d1.toDateString()} and ${d2.toDateString()} are only ${daysDiff} day(s) apart.`,
                        suggestion: `Move one Long Run to create at least 2-3 days buffer.`,
                        affectedWorkouts: [longRuns[i], longRuns[i + 1]]
                    });
                }
            }

            return violations.length > 0 ? violations : null;
        }
    },

    /**
     * Detect no recovery after Long Run
     */
    noRecoveryAfterLongRun: {
        id: 'NO_RECOVERY_AFTER_LONG_RUN',
        severity: VALIDATION_SEVERITY.WARNING,
        category: 'post',
        title: '⚠️ Hard Session After Long Run',
        check: (workouts, rules) => {
            const violations = [];

            const sorted = [...workouts].sort((a, b) =>
                new Date(a.start_date_local) - new Date(b.start_date_local)
            );

            for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i];
                const next = sorted[i + 1];

                // Is current a Long Run?
                const isLongRun = current.title &&
                    (current.title.toLowerCase().includes('long') || current.totalDistance > 15000);

                if (!isLongRun) continue;

                // Check if next day has hard workout
                const d1 = new Date(current.start_date_local);
                const d2 = new Date(next.start_date_local);
                const daysDiff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

                if (daysDiff === 1 && next.type !== 'Rest') {
                    const isHardNext = next.title &&
                        (next.title.toLowerCase().includes('interval') ||
                            next.title.toLowerCase().includes('threshold') ||
                            next.title.toLowerCase().includes('tempo') ||
                            next.title.toLowerCase().includes('speed'));

                    if (isHardNext) {
                        violations.push({
                            message: `"${next.title}" is scheduled the day after Long Run.`,
                            suggestion: `Replace with Rest or Easy Recovery run.`,
                            affectedWorkouts: [current, next]
                        });
                    }
                }
            }

            return violations.length > 0 ? violations : null;
        }
    },

    /**
     * Detect workouts shorter than minimum duration
     */
    belowMinDuration: {
        id: 'BELOW_MIN_DURATION',
        severity: VALIDATION_SEVERITY.INFO,
        category: 'post',
        title: 'ℹ️ Short Workouts Auto-Adjusted',
        check: (workouts, rules) => {
            const violations = [];
            const sport = (typeof state !== 'undefined' && state.sportType) || 'Running';

            if (typeof getMinDuration !== 'function') return null;

            workouts.forEach(w => {
                if (w.type === 'Rest' || w.type === 'Gym' || w.type === 'WeightTraining' || w.type === 'Yoga') return;

                const minDuration = getMinDuration(sport, w.type);
                if (w.totalDuration > 0 && w.totalDuration < minDuration) {
                    violations.push({
                        message: `"${w.title}" was ${Math.round(w.totalDuration / 60)}min (below ${Math.round(minDuration / 60)}min minimum).`,
                        suggestion: `Auto-adjusted to ${Math.round(minDuration / 60)} minutes.`,
                        affectedWorkouts: [w]
                    });
                }
            });

            return violations.length > 0 ? violations : null;
        }
    },

    /**
     * Detect too many gym sessions PER WEEK (max 2)
     */
    tooManyGymSessions: {
        id: 'TOO_MANY_GYM',
        severity: VALIDATION_SEVERITY.WARNING,
        category: 'post',
        title: '⚠️ Too Many Gym Sessions',
        check: (workouts, rules) => {
            const gymSessions = workouts.filter(w => w.type === 'Gym' || w.type === 'WeightTraining');
            const maxPerWeek = 2;

            // Group by week (using ISO week number)
            const weekMap = {};
            gymSessions.forEach(w => {
                const date = new Date(w.start_date_local || w.date);
                const weekKey = getISOWeek(date);
                weekMap[weekKey] = (weekMap[weekKey] || 0) + 1;
            });

            // Find weeks that exceed the limit
            const overWeeks = Object.entries(weekMap)
                .filter(([_, count]) => count > maxPerWeek)
                .map(([week, count]) => `Week ${week}: ${count} sessions`);

            if (overWeeks.length > 0) {
                return {
                    message: `Some weeks have too many gym sessions (max ${maxPerWeek}/week): ${overWeeks.join(', ')}.`,
                    suggestion: `Reduce to ${maxPerWeek} or fewer per week. Gym supports endurance, not replaces it.`,
                    affectedWorkouts: gymSessions
                };
            }
            return null;
        }
    },

    /**
     * Detect back-to-back high intensity days
     */
    backToBackIntensity: {
        id: 'BACK_TO_BACK_INTENSITY',
        severity: VALIDATION_SEVERITY.WARNING,
        category: 'post',
        title: '⚠️ Consecutive High-Intensity Days',
        check: (workouts, rules) => {
            const violations = [];

            const sorted = [...workouts].sort((a, b) =>
                new Date(a.start_date_local) - new Date(b.start_date_local)
            );

            const intensityKeywords = ['interval', 'threshold', 'tempo', 'speed', 'vo2', 'fartlek', 'hills'];

            for (let i = 0; i < sorted.length - 1; i++) {
                const current = sorted[i];
                const next = sorted[i + 1];

                const d1 = new Date(current.start_date_local);
                const d2 = new Date(next.start_date_local);
                const daysDiff = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));

                if (daysDiff !== 1) continue;

                const isCurrentHard = current.title &&
                    intensityKeywords.some(k => current.title.toLowerCase().includes(k));
                const isNextHard = next.title &&
                    intensityKeywords.some(k => next.title.toLowerCase().includes(k));

                if (isCurrentHard && isNextHard) {
                    violations.push({
                        message: `"${current.title}" and "${next.title}" are on consecutive days.`,
                        suggestion: `Insert Easy/Rest day between high-intensity sessions.`,
                        affectedWorkouts: [current, next]
                    });
                }
            }

            return violations.length > 0 ? violations : null;
        }
    },

    /**
     * Check volume matches target
     */
    volumeMismatch: {
        id: 'VOLUME_MISMATCH',
        severity: VALIDATION_SEVERITY.WARNING,
        category: 'post',
        title: '⚠️ Volume Target Mismatch',
        check: (workouts, rules, weekTarget) => {
            if (!weekTarget) return null;

            const totalDistance = workouts
                .filter(w => w.type === 'Run' || w.type === 'Ride')
                .reduce((sum, w) => sum + (w.totalDistance || 0), 0) / 1000; // Convert to km

            const tolerance = 0.05; // 5%
            const diff = Math.abs(totalDistance - weekTarget) / weekTarget;

            if (diff > tolerance) {
                const direction = totalDistance > weekTarget ? 'over' : 'under';
                return {
                    message: `Total volume ${totalDistance.toFixed(1)}km is ${direction} target ${weekTarget}km (${(diff * 100).toFixed(0)}% off).`,
                    suggestion: direction === 'over'
                        ? `Reduce Easy Run durations or remove a session.`
                        : `Add time to Easy Runs or add an extra session.`
                };
            }
            return null;
        }
    },

    /**
     * Detect workouts scheduled on unavailable days
     */
    workoutOnUnavailableDay: {
        id: 'WORKOUT_ON_UNAVAILABLE_DAY',
        severity: VALIDATION_SEVERITY.INFO,  // INFO - user intentionally allows overflow
        category: 'post',
        title: '📝 Extra Workout on Low-Availability Day',
        check: (workouts, rules) => {
            const violations = [];
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            // Get availability from state
            const defaultAvail = (typeof state !== 'undefined' && state.defaultAvailableDays) || [1, 2, 3, 4, 5, 0];

            workouts.forEach(w => {
                if (w.type === 'Rest') return; // Rest days are fine anywhere

                const d = new Date(w.start_date_local);
                const dayNum = d.getDay();
                const dayName = dayNames[dayNum];

                // Get week-specific availability if available
                const weekIndex = w.weekIndex !== undefined ? w.weekIndex :
                    Math.floor((d - new Date(state.generatedPlan[0]?.startDate)) / (7 * 24 * 60 * 60 * 1000));
                const weekAvail = (typeof state !== 'undefined' && state.weeklyAvailability && state.weeklyAvailability[weekIndex])
                    || defaultAvail;

                if (!weekAvail.includes(dayNum)) {
                    violations.push({
                        message: `"${w.title}" added on ${dayName} to meet volume targets.`,
                        suggestion: `Optional session to achieve your ambitious goals. Skip if needed.`,
                        affectedWorkouts: [w]
                    });
                }
            });

            return violations.length > 0 ? violations : null;
        }
    }
};

/**
 * Run all pre-generation validations
 * @param {Object} config - Plan configuration
 * @returns {Array} Array of validation results
 */
function validatePreGeneration(config) {
    const results = [];
    const rules = typeof getTrainingRules === 'function'
        ? getTrainingRules(config.sport || 'Running')
        : {};

    Object.values(VALIDATION_RULES).forEach(rule => {
        if (rule.category !== 'pre') return;

        try {
            const result = rule.check(config, rules);
            if (result) {
                results.push({
                    id: rule.id,
                    severity: rule.severity,
                    title: rule.title,
                    ...result
                });
            }
        } catch (e) {
            console.warn(`[Validation] Rule ${rule.id} failed:`, e);
        }
    });

    return results;
}

/**
 * Run all post-generation validations
 * @param {Array} workouts - Generated workouts
 * @param {Object} weekTarget - Optional week target for volume check
 * @returns {Array} Array of validation results
 */
function validatePostGeneration(workouts, weekTarget) {
    const results = [];
    const sport = (typeof state !== 'undefined' && state.sportType) || 'Running';
    const rules = typeof getTrainingRules === 'function'
        ? getTrainingRules(sport)
        : {};

    Object.values(VALIDATION_RULES).forEach(rule => {
        if (rule.category !== 'post') return;

        try {
            const result = rule.check(workouts, rules, weekTarget);
            if (result) {
                // Handle single result or array of results
                const resultArray = Array.isArray(result) ? result : [result];
                resultArray.forEach(r => {
                    results.push({
                        id: rule.id,
                        severity: rule.severity,
                        title: rule.title,
                        ...r
                    });
                });
            }
        } catch (e) {
            console.warn(`[Validation] Rule ${rule.id} failed:`, e);
        }
    });

    return results;
}

/**
 * Format validation results for UI display
 * @param {Array} results - Validation results
 * @returns {string} HTML string for display
 */
function formatValidationResults(results) {
    if (results.length === 0) return '';

    const errors = results.filter(r => r.severity === VALIDATION_SEVERITY.ERROR);
    const warnings = results.filter(r => r.severity === VALIDATION_SEVERITY.WARNING);
    const infos = results.filter(r => r.severity === VALIDATION_SEVERITY.INFO);

    let html = '<div class="validation-results">';

    if (errors.length > 0) {
        html += `<div class="validation-errors bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-2">
            <div class="text-red-400 font-bold text-xs uppercase mb-2">🚫 Errors (Must Fix)</div>
            ${errors.map(e => `
                <div class="mb-2 last:mb-0">
                    <div class="text-red-300 text-sm">${e.message}</div>
                    <div class="text-red-200/70 text-xs italic">→ ${e.suggestion}</div>
                </div>
            `).join('')}
        </div>`;
    }

    if (warnings.length > 0) {
        html += `<div class="validation-warnings bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-2">
            <div class="text-yellow-400 font-bold text-xs uppercase mb-2">⚠️ Warnings (Review Recommended)</div>
            ${warnings.map(w => `
                <div class="mb-2 last:mb-0">
                    <div class="text-yellow-300 text-sm">${w.message}</div>
                    <div class="text-yellow-200/70 text-xs italic">→ ${w.suggestion}</div>
                </div>
            `).join('')}
        </div>`;
    }

    if (infos.length > 0) {
        html += `<div class="validation-infos bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <div class="text-blue-400 font-bold text-xs uppercase mb-2">ℹ️ Info</div>
            ${infos.map(i => `
                <div class="text-blue-300 text-sm mb-1">${i.message}</div>
            `).join('')}
        </div>`;
    }

    html += '</div>';
    return html;
}

/**
 * Show validation toast with summary
 * @param {Array} results - Validation results
 */
function showValidationToast(results) {
    if (typeof showToast !== 'function') return;

    const errors = results.filter(r => r.severity === VALIDATION_SEVERITY.ERROR);
    const warnings = results.filter(r => r.severity === VALIDATION_SEVERITY.WARNING);

    if (errors.length > 0) {
        showToast(`🚫 ${errors.length} validation error(s) - check plan`);
    } else if (warnings.length > 0) {
        showToast(`⚠️ ${warnings.length} warning(s) - review recommended`);
    }
}

/**
 * Helper: Parse pace string to minutes per km
 */
function parsePaceToMinutes(paceStr) {
    if (!paceStr) return 5.5;
    const clean = paceStr.replace('/km', '').trim();
    if (!clean.includes(':')) return 5.5;
    const [m, s] = clean.split(':').map(Number);
    return m + (s / 60);
}

// Expose to window
window.VALIDATION_RULES = VALIDATION_RULES;
window.VALIDATION_SEVERITY = VALIDATION_SEVERITY;
window.validatePreGeneration = validatePreGeneration;
window.validatePostGeneration = validatePostGeneration;
window.formatValidationResults = formatValidationResults;
window.showValidationToast = showValidationToast;
