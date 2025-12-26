/**
 * @file deterministic-scheduler.js
 * @description Rule-based weekly schedule builder using backward scheduling (Big Rocks First).
 * @usedBy js/weekly-ui.js, js/features/scheduling/services/template-generator.js
 * @responsibilities
 * - Places long runs + key workouts first based on availability
 * - Fills remaining volume with easy runs
 * - Applies phase-specific logic (Base vs Build vs Peak)
 * @why Extracted from weekly-ui.js to decouple scheduling logic from UI rendering.
 */

// ============================================================================
// DETERMINISTIC SCHEDULER
// Rule-based weekly schedule builder using backward scheduling
// ============================================================================

/**
 * Build a weekly schedule using backward scheduling (Big Rocks First)
 * 
 * Priority Order:
 * 1. Long Run (biggest rock) - placed on day with most hours
 * 2. Key Workout (intervals/tempo) - placed on day with second-most hours
 * 3. Strength sessions - placed on remaining high-availability days
 * 4. Easy runs - fill remaining volume
 * 
 * @param {Object} weekData - Week targets from macro planner
 * @param {Object} availability - { 0: hours, 1: hours, ..., 6: hours } (0=Sun)
 * @param {Object} options - Additional options
 * @returns {Object} { schedule: Array, usedVolume: number, warnings: Array }
 */
function buildWeekSchedule(weekData, availability, options = {}) {
    const {
        targetVolume = 30,          // km for running
        longRunDistance = 12,       // km
        phase = window.PHASES.BASE, // Base, Build, Peak, Taper, Race
        isRecoveryWeek = false,
        gymTarget = 2               // Strength sessions per week
    } = weekData;

    const {
        thresholdPace = 300,        // sec/km default (~5:00/km)
        easyPace = 375,             // sec/km default (~6:15/km)
        preferredLongRunDay = null  // 0=Sun, 6=Sat
    } = options;

    const warnings = [];
    const schedule = new Array(7).fill(null).map((_, i) => ({
        day: i,
        dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i],
        availableHours: availability[i] || 0,
        workout: null,
        secondary: null
    }));

    let usedVolume = 0;
    const usedWorkoutIds = [];

    // =========================================================================
    // STEP 1: Place Long Run (Big Rock #1)
    // =========================================================================
    let longRunDurationMin;
    if (window.DurationService && window.DurationService.calculateDurationForWorkout) {
        const durSec = window.DurationService.calculateDurationForWorkout('LongRun', longRunDistance);
        longRunDurationMin = Math.ceil(durSec / 60);
    } else {
        longRunDurationMin = Math.ceil(longRunDistance / (60 / easyPace));
    }
    const longRunDay = findBestDay(schedule, availability, longRunDurationMin, preferredLongRunDay);

    if (longRunDay !== -1) {
        const longRunWorkout = buildWorkout(
            { ...RUNNING_LIBRARY.LONG[0] },
            thresholdPace,
            longRunDurationMin
        );
        longRunWorkout.totalDistance = longRunDistance;
        schedule[longRunDay].workout = longRunWorkout;
        schedule[longRunDay].type = 'LongRun';
        schedule[longRunDay].priority = 'KEY';
        usedVolume += longRunDistance;
        usedWorkoutIds.push('long_run');
    } else {
        warnings.push({
            type: 'NO_LONG_RUN_SLOT',
            message: `No day with enough time for ${longRunDistance}km Long Run (needs ${Math.round(longRunDurationMin)}min)`
        });
    }

    // Mark day after long run as recovery
    if (longRunDay !== -1) {
        const recoveryDay = (longRunDay + 1) % 7;
        if (schedule[recoveryDay].availableHours > 0 && !schedule[recoveryDay].workout) {
            schedule[recoveryDay].type = 'Recovery';
            schedule[recoveryDay].priority = 'RECOVERY';
        }
    }

    // =========================================================================
    // STEP 2: Place Key Workout (Big Rock #2) - Skip for Recovery weeks
    // =========================================================================
    if (!isRecoveryWeek) {
        let keyCategory = 'INTERVALS';
        let forcedId = null;

        // Phase-Specific Logic
        if (phase === window.PHASES.BASE) {
            // weekNumber should be passed in weekData, default to 1
            const wNum = weekData.weekNumber || 1;
            const cycle = (wNum - 1) % 4 + 1; // 1,2,3,4

            if (cycle === 1) { keyCategory = 'INTERVALS'; forcedId = 'hill_sprints'; }
            else if (cycle === 2) { keyCategory = 'TEMPO'; forcedId = 'progressive_run'; }
            else if (cycle === 3) { keyCategory = 'INTERVALS'; forcedId = 'strides_8x20s'; }
            else { keyCategory = 'TEMPO'; } // Fallback

            console.log(`[DEBUG_SCHEDULER] Phase: ${phase}, WeekNum: ${wNum}, Cycle: ${cycle}, ForcedID: ${forcedId}`);
        } else if (phase === window.PHASES.RECOVERY) {
            keyCategory = 'TEMPO';
        } else {
            // Build, Peak, Race -> Intervals default
            keyCategory = 'INTERVALS';
        }

        const keyDay = findSecondBestDay(schedule, availability, 45, longRunDay);

        if (keyDay !== -1) {
            const availableMinutes = availability[keyDay] * 60;
            let keyWorkout = null;

            if (forcedId) {
                // Find specific workout
                const catWorkouts = window.RUNNING_LIBRARY[keyCategory] || [];
                keyWorkout = catWorkouts.find(w => w.id === forcedId);
                // Fallback if not found
                if (!keyWorkout) keyWorkout = selectWorkout(keyCategory, phase, availableMinutes, usedWorkoutIds);
            } else {
                keyWorkout = selectWorkout(keyCategory, phase, availableMinutes, usedWorkoutIds);
            }

            if (keyWorkout) {
                // Taper Logic: Reduce volume/reps while maintaining intensity
                let intensityScale = 1.0;
                if (phase === window.PHASES.RACE || weekData.isRaceWeek) intensityScale = 0.5;
                else if (phase === window.PHASES.TAPER || phase === 'Taper Phase') intensityScale = 0.75;

                const builtKey = buildWorkout(keyWorkout, thresholdPace, { scale: intensityScale });
                schedule[keyDay].workout = builtKey;
                schedule[keyDay].type = keyCategory === 'INTERVALS' ? 'Intervals' : 'Tempo';
                schedule[keyDay].priority = 'KEY';
                usedVolume += builtKey.totalDistance || 0;
                usedWorkoutIds.push(keyWorkout.id);
            }
        } else {
            warnings.push({
                type: 'NO_KEY_SLOT',
                message: 'Could not place Key workout - insufficient availability'
            });
        }
    }

    // =========================================================================
    // STEP 3: Place Strength Sessions (Hard Day Stacking & Pre-hab)
    // =========================================================================
    // RULES:
    // 1. Session A (Neural): MUST be on Hard Day (Intervals/Tempo). Ideal PM.
    // 2. Session B (Stability): Low fatigue. Ideal on Easy Day or Day Before Long Run.

    let gymPlaced = 0;
    const maxGym = weekData.gymTarget || 0;

    // Helper: Is day safe for gym?
    const isSafeForGym = (dayIndex) => {
        // 1. Not on Long Run Day
        if (dayIndex === longRunDay) return false;

        // 2. Not consecutive strength days (unless we explicitly stack)
        const prevDay = (dayIndex + 6) % 7;
        const nextDay = (dayIndex + 1) % 7;
        if (schedule[prevDay]?.secondary?.sport === 'Strength' || schedule[prevDay]?.sport === 'Strength') return false;
        if (schedule[nextDay]?.secondary?.sport === 'Strength' || schedule[nextDay]?.sport === 'Strength') return false;

        return true;
    };

    // --- PRIORITY 1: SESSION A (NEURAL) ON HARD DAY ---
    if (gymPlaced < maxGym) {
        // Find Hard Days (Intervals, Tempo, Threshold)
        // Sort by availability to ensure we have room
        const hardDays = schedule
            .filter(s => (['Intervals', 'Tempo', 'Threshold', 'VO2 Max'].includes(s.type) || s.priority === 'KEY') && s.type !== 'LongRun')
            .sort((a, b) => b.availableHours - a.availableHours);

        if (hardDays.length > 0) {
            const bestHardDay = hardDays[0];
            const slot = bestHardDay; // Alias
            const workoutDurHours = (slot.workout?.totalDuration || 3600) / 3600;
            const remainingHours = slot.availableHours - workoutDurHours;

            // Neural needs ~45-60m. 
            // We stack it even if tight, but prefer ample time.
            if (remainingHours >= 0.5) { // Minimum 30m buffer space effectively
                const neuralWorkout = RUNNING_LIBRARY.STRENGTH.find(w => w.id === 'gym_neural') || RUNNING_LIBRARY.STRENGTH[0];
                const gymWorkout = buildWorkout(neuralWorkout, thresholdPace);
                gymWorkout.sport = 'Strength';

                // Place as Secondary (PM)
                slot.secondary = gymWorkout;
                gymPlaced++;
            }
        }
    }

    // --- PRIORITY 2: SESSION B (STABILITY) ON EASY DAY / PRE-LONG RUN ---
    if (gymPlaced < maxGym) {
        let stabilityPlaced = false;

        // Sub-strategy 2a: Day Before Long Run (if not Hard)
        const dayBeforeLong = (longRunDay + 6) % 7;
        const slotBL = schedule[dayBeforeLong];

        if (slotBL && !stabilityPlaced) {
            const isHard = ['Intervals', 'Tempo', 'Threshold'].includes(slotBL.type);
            const isRestOrEasy = !slotBL.workout || slotBL.type === 'Easy' || slotBL.type === 'Recovery';
            const hasStrength = slotBL.secondary?.sport === 'Strength' || slotBL.sport === 'Strength';

            if (!isHard && isRestOrEasy && !hasStrength && isSafeForGym(dayBeforeLong)) {
                // Check time
                const workoutDurHours = (slotBL.workout?.totalDuration || 0) / 3600;
                if ((slotBL.availableHours - workoutDurHours) >= 0.5) {
                    const stabilityWorkout = RUNNING_LIBRARY.STRENGTH.find(w => w.id === 'gym_stability') || RUNNING_LIBRARY.STRENGTH[1] || RUNNING_LIBRARY.STRENGTH[0];
                    const gymWorkout = buildWorkout(stabilityWorkout, thresholdPace);
                    gymWorkout.sport = 'Strength';

                    if (slotBL.workout) {
                        slotBL.secondary = gymWorkout;
                        slotBL.type += ' + Strength';
                    } else {
                        slotBL.workout = gymWorkout;
                        slotBL.type = 'WeightTraining'; // Primary
                        slotBL.sport = 'Strength';
                    }
                    gymPlaced++;
                    stabilityPlaced = true;
                }
            }
        }

        // Sub-strategy 2b: Any Easy Day
        if (!stabilityPlaced && gymPlaced < maxGym) {
            const easyDays = schedule
                .filter(s => (s.type === 'Easy' || s.type === 'Recovery') && !s.secondary && isSafeForGym(s.day))
                .sort((a, b) => b.availableHours - a.availableHours);

            if (easyDays.length > 0) {
                const target = easyDays[0];
                const stabilityWorkout = RUNNING_LIBRARY.STRENGTH.find(w => w.id === 'gym_stability') || RUNNING_LIBRARY.STRENGTH[1];
                const gymWorkout = buildWorkout(stabilityWorkout, thresholdPace);
                gymWorkout.sport = 'Strength';

                target.secondary = gymWorkout;
                target.type += ' + Strength';
                gymPlaced++;
                stabilityPlaced = true;
            }
        }

        // Sub-strategy 2c: Empty Day
        if (!stabilityPlaced && gymPlaced < maxGym) {
            const emptyDays = schedule
                .filter(s => !s.workout && isSafeForGym(s.day) && s.availableHours >= 0.75);

            if (emptyDays.length > 0) {
                const target = emptyDays[0];
                const stabilityWorkout = RUNNING_LIBRARY.STRENGTH.find(w => w.id === 'gym_stability') || RUNNING_LIBRARY.STRENGTH[1];
                const gymWorkout = buildWorkout(stabilityWorkout, thresholdPace);
                gymWorkout.sport = 'Strength';

                target.workout = gymWorkout;
                target.type = 'WeightTraining';
                target.sport = 'Strength';
                gymPlaced++;
                stabilityPlaced = true;
            }
        }
    }

    // =========================================================================
    // STEP 4: Fill Remaining Volume with Easy Runs
    // =========================================================================
    const remainingVolume = Math.max(0, targetVolume - usedVolume);
    const emptyDays = schedule.filter(s => !s.workout && s.availableHours > 0.5 && s.type !== 'Recovery');

    if (emptyDays.length > 0 && remainingVolume > 0) {
        // Initial distribution
        let volumeToDistribute = remainingVolume;

        emptyDays.forEach(slot => {
            if (volumeToDistribute <= 0) return;

            // GUARDRAIL: Max Easy Run = 60% of Long Run (Scientific constraint)
            // Long run is typically 25-30% of weekly volume. 
            // A normal run shouldn't be close to the long run.
            const longRunDist = weekData.longRunDistance || (targetVolume * 0.3);
            const maxAllowedDist = longRunDist * 0.6;

            // Per day share vs remaining needs
            // We divide remaining by remaining days to smooth it out
            const daysLeft = emptyDays.filter(d => !d.workout).length; // current included
            let targetDist = volumeToDistribute / daysLeft;

            const availableMinutes = slot.availableHours * 60;
            const timeCapDist = calculateDistance(availableMinutes - 10, 'Z2', thresholdPace);

            // Apply caps
            targetDist = Math.min(targetDist, timeCapDist, maxAllowedDist);

            if (targetDist >= 3) { // Min 3km for a run
                // Use DurationService for accurate duration (seconds -> minutes)
                // Fallback to manual calc if service unavailable
                let easyDurationMin;
                if (window.DurationService && window.DurationService.calculateDurationForWorkout) {
                    const durSec = window.DurationService.calculateDurationForWorkout('Easy', targetDist);
                    easyDurationMin = Math.ceil(durSec / 60);
                } else {
                    // Fallback: (dist / (60/pace))
                    easyDurationMin = Math.ceil(targetDist / (60 / easyPace));
                }

                const easyWorkout = buildWorkout(
                    { ...RUNNING_LIBRARY.EASY[0] },
                    thresholdPace,
                    easyDurationMin // Pass minutes
                );
                easyWorkout.totalDistance = Math.round(targetDist * 10) / 10;
                slot.workout = easyWorkout;
                slot.type = 'Easy';
                usedVolume += easyWorkout.totalDistance;
                volumeToDistribute -= easyWorkout.totalDistance;
            }
        });
    }

    // =========================================================================
    // STEP 5: Mark Rest Days
    // =========================================================================
    schedule.forEach(slot => {
        if (!slot.workout && !slot.type) {
            slot.type = slot.availableHours > 0 ? 'Rest' : 'Blocked';
        }
    });

    // Calculate final volume
    const actualVolume = schedule.reduce((sum, s) => {
        return sum + (s.workout?.totalDistance || 0);
    }, 0);

    return {
        schedule,
        usedVolume: Math.round(actualVolume * 10) / 10,
        targetVolume,
        warnings
    };
}

/**
 * Find the best day for a workout based on available hours
 * @param {Array} schedule - Current schedule
 * @param {Object} availability - Availability object
 * @param {number} requiredMinutes - Required time in minutes
 * @param {number} preferred - Preferred day (optional)
 * @returns {number} Day index or -1
 */
function findBestDay(schedule, availability, requiredMinutes, preferred = null) {
    const requiredHours = requiredMinutes / 60;

    // Try preferred first
    if (preferred !== null && availability[preferred] >= requiredHours && !schedule[preferred]?.workout) {
        return preferred;
    }

    // Weekend preference for long runs (Sun, Sat)
    const weekendDays = [0, 6];
    for (const day of weekendDays) {
        if (availability[day] >= requiredHours && !schedule[day]?.workout) {
            return day;
        }
    }

    // Any day with enough time
    let bestDay = -1;
    let maxHours = 0;

    for (let day = 0; day < 7; day++) {
        if (availability[day] >= requiredHours && availability[day] > maxHours && !schedule[day]?.workout) {
            bestDay = day;
            maxHours = availability[day];
        }
    }

    return bestDay;
}

/**
 * Find second-best day (for key workout)
 * @param {Array} schedule - Current schedule
 * @param {Object} availability - Availability object
 * @param {number} requiredMinutes - Required time in minutes
 * @param {number} excludeDay - Day to exclude (long run day)
 * @returns {number} Day index or -1
 */
function findSecondBestDay(schedule, availability, requiredMinutes, excludeDay) {
    const requiredHours = requiredMinutes / 60;
    let bestDay = -1;
    let maxHours = 0;

    // Prefer midweek (Tue, Wed, Thu)
    const midweekDays = [2, 3, 4];
    for (const day of midweekDays) {
        if (day === excludeDay) continue;
        if (schedule[day]?.workout) continue;
        if (availability[day] >= requiredHours && availability[day] > maxHours) {
            bestDay = day;
            maxHours = availability[day];
        }
    }

    if (bestDay !== -1) return bestDay;

    // Fallback to any available day
    for (let day = 0; day < 7; day++) {
        if (day === excludeDay) continue;
        if (schedule[day]?.workout) continue;
        if (availability[day] >= requiredHours && availability[day] > maxHours) {
            bestDay = day;
            maxHours = availability[day];
        }
    }

    return bestDay;
}

/**
 * Convert schedule to display format
 * @param {Object} result - Result from buildWeekSchedule
 * @returns {Array} Schedule in display format
 */
function formatScheduleForDisplay(result) {
    return result.schedule.map(slot => ({
        day: slot.day,
        dayName: slot.dayName,
        type: slot.type,
        workout: slot.workout ? {
            name: slot.workout.name,
            duration: slot.workout.totalDuration,
            distance: slot.workout.totalDistance,
            description: slot.workout.description
        } : null,
        secondary: slot.secondary ? {
            name: slot.secondary.name,
            duration: slot.secondary.totalDuration
        } : null,
        availableHours: slot.availableHours
    }));
}

/**
 * Validation: Check if a move is valid
 * @param {Array} schedule - The full weekly schedule array
 * @param {number} fromDay - Origin day index (0-6)
 * @param {number} toDay - Target day index (0-6)
 * @param {string} slotType - 'workout' (AM) or 'secondary' (PM)
 * @returns {Object} { valid: boolean, warnings: Array<string> }
 */
function validateMove(schedule, fromDay, toDay, slotType = 'workout') {
    const warnings = [];
    const targetSlot = schedule[toDay];
    const sourceSlot = schedule[fromDay];

    // Determine what is being moved
    const workout = slotType === 'workout' ? sourceSlot.workout : sourceSlot.secondary;

    if (!workout) return { valid: true, warnings: [] };

    // RULE 1: Strength Training Validation
    if (workout.sport === 'Strength' || workout.type === 'WeightTraining') {
        const isNeural = workout.id === 'gym_neural';
        const isStability = workout.id === 'gym_stability';

        // 1.1 Neural (Heavy) MUST be on Hard Day or Empty Day. NOT with recovery.
        if (isNeural) {
            const dayIsHard = ['Intervals', 'Tempo', 'Threshold', 'VO2 Max'].includes(targetSlot.type);
            const dayIsEasy = targetSlot.type === 'Easy' || targetSlot.type === 'Recovery';

            if (dayIsEasy) {
                warnings.push("Neural Strength (Heavy) should be done on Hard Days (Hard/Hard rule) to keep easy days easy.");
            }
            if (targetSlot.type === 'LongRun') {
                warnings.push("Avoid Heavy Strength on Long Run days.");
            }
        }

        // 1.2 Interference: 6 Hour Gap (Implied by AM/PM split, but warn if moving to secondary on a hard day?)
        // If moving Neural to same day as Hard Run, it's good (as per rules), but gap is needed.
        // We assume User knows this if they manually stack, but maybe warn "Ensure 6h gap".

        // 1.3 Stability: Flexible, but preferably Easy Days/Pre-Long Run

        // 1.4 General: No Consecutive Strength
        const prevDay = (toDay + 6) % 7;
        const nextDay = (toDay + 1) % 7;
        const prevStrength = schedule[prevDay]?.secondary?.sport === 'Strength' || schedule[prevDay]?.sport === 'Strength';
        const nextStrength = schedule[nextDay]?.secondary?.sport === 'Strength' || schedule[nextDay]?.sport === 'Strength'; // Check next too?

        if (prevStrength) {
            warnings.push("Consecutive strength days are not optimal for recovery.");
        }
    }

    // RULE 2: High Intensity Stacking (Two Hard Workouts)
    const movingIsHard = ['Intervals', 'Tempo', 'VO2 Max', 'Threshold'].includes(workout.type) || workout.priority === 'KEY';
    const targetHasHard = targetSlot.workout && (['Intervals', 'Tempo', 'LongRun'].includes(targetSlot.workout.type) || targetSlot.priority === 'KEY');

    if (movingIsHard && targetHasHard && slotType === 'secondary') {
        warnings.push("Stacking two hard running workouts on the same day increases injury risk.");
    }

    // RULE 3: Recovery Day Protection
    if (targetSlot.type === 'Recovery' && movingIsHard) {
        warnings.push("This day is marked for Recovery. Adding a hard workout breaks the cycle.");
    }

    return {
        valid: warnings.length === 0,
        warnings
    };
}

window.validateMove = validateMove; // Expose globally

window.RuleBasedScheduler = {
    buildWeekSchedule: buildWeekSchedule,
    formatScheduleForDisplay: formatScheduleForDisplay,
    validateMove: validateMove
};

console.log('[RuleBasedScheduler] Module loaded');
