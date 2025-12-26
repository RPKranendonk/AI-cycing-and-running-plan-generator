/**
 * @file template-generator.js
 * @description Master orchestrator for weekly schedule generation.
 * @usedBy js/core/deterministic-scheduler.js, js/weekly-ui.js (legacy)
 * @responsibilities
 * - Orchestrates the entire weekly build process
 * - Calls sub-services: FrequencyOptimizer, VolumeDistributor, ProgressionEngine
 * - Places "Big Rocks" (Long Run, Key Workouts) first
 * @why Breaks down the massive scheduling logic into a coordinate step-by-step process.
 */

// ==========================================
// TEMPLATE GENERATOR
// Generates weekly workout templates with rule-based scheduling
// ==========================================

/**
 * Generate a weekly workout template based on targets and rules
 * @param {Object} weekData - Weekly targets from macro planner
 * @param {Object} availability - Daily availability { 0: hours, 1: hours, ... } (0=Sun)
 * @param {Object} options - Additional options
 * @returns {Object} { template: Array, warnings: Array }
 */
function generateWeeklyTemplate(weekData, availability, options = {}) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    const calculateProgression = window.calculateProgression;
    const optimizeFrequency = window.optimizeFrequency;

    const {
        targetVolume = 30,
        longRunDistance = 12,
        phase = window.PHASES.BASE,
        preferredLongRunDay = 0,
        gymTarget = 2,
        sport = 'Running',
        userEasyPace = 6.0,
        isRecoveryWeek = false,
        weekInPhase = 1,
        focus = ''
    } = weekData;

    // Robust Recovery Week Detection
    // Trust the flag if true, otherwise check the phase name or focus
    const effectiveIsRecovery = isRecoveryWeek ||
        phase.toLowerCase().includes('recovery') ||
        (focus && focus.toLowerCase().includes('recovery'));

    const {
        minSessionDuration = 30,
        includeYoga = false
    } = options;

    const warnings = [];

    // 1. INITIALIZE TEMPLATE
    const template = [];
    for (let day = 0; day < 7; day++) {
        const hours = availability[day] || 0;
        template.push({
            day,
            dayName: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
            type: hours === 0 ? WORKOUT_TYPES.BLOCKED : null,
            secondary: null,
            duration: 0,
            distance: 0,
            priority: hours === 0 ? 'BLOCKED' : null,
            editable: hours > 0,
            availableHours: hours
        });
    }

    // 1b. SANITIZE AVAILABILITY (Round down to 15m, Floor 30m)
    template.forEach(slot => {
        if (slot.availableHours > 0) {
            // Round down to nearest 0.25
            let rounded = Math.floor(slot.availableHours * 4) / 4;
            // Apply hard floor of 30 mins
            if (rounded < 0.5) {
                rounded = 0;
            }
            slot.availableHours = rounded;

            // Sync other props if it became 0
            if (rounded === 0) {
                slot.type = WORKOUT_TYPES.BLOCKED;
                slot.priority = 'BLOCKED';
                slot.editable = false;
            }
        }
    });

    // 1c. DETECT WEEKEND WARRIOR
    // Definition: Weekday volume capacity < 35% of target volume
    const weekdayCapacity = template.reduce((sum, slot) => {
        const isWeekend = slot.day === 0 || slot.day === 6;
        return isWeekend ? sum : sum + slot.availableHours;
    }, 0);

    // Estimate max potential weekday km (approx 6:00/km -> 10km/h)
    const potentialWeekdayKm = weekdayCapacity * 10;
    const isWeekendWarrior = potentialWeekdayKm < (targetVolume * 0.35);

    if (isWeekendWarrior) {
        warnings.push({
            type: 'WEEKEND_WARRIOR_MODE',
            message: 'Weekend Warrior detected. Enabling Block Training (Sat/Sun) to meet volume targets.'
        });
    }

    // 2. PLACE LONG RUN
    const isCrunchTime = phase === window.PHASES.PEAK || targetVolume > 60;
    const availabilityMultiplier = isCrunchTime ? 1.25 : 1.0;

    let finalLRDist = longRunDistance;
    const estDuration = window.DurationService
        ? window.DurationService.calculateDurationForWorkout('LongRun', longRunDistance)
        : estimateDurationSecondsLocal(longRunDistance, 'long', userEasyPace);
    let capApplied = false;

    const MARATHON_SIM_MAX_DIST = 34;

    if (phase === window.PHASES.PEAK) {
        if (longRunDistance > MARATHON_SIM_MAX_DIST) {
            finalLRDist = MARATHON_SIM_MAX_DIST;
            warnings.push({ type: 'MARATHON_SIM_CAP', message: `Peak Long Run capped at ${MARATHON_SIM_MAX_DIST}km (marathon simulation max).` });
            capApplied = true;
        }
    } else if (estDuration > 10800) {
        const maxDist = 180 / (userEasyPace * 1.1);
        finalLRDist = parseFloat(maxDist.toFixed(1));
        warnings.push({ type: 'SLOW_RUNNER_CAP', message: `Long Run capped at 3 hours (${finalLRDist}km) to prevent breakdown.` });
        capApplied = true;
    }

    // 2b. RATIO SAFETY CAP (Rule: LR <= 35% of Weekly Volume)
    // Robustness: Check against availability-constrained max volume, not just target.
    // Exception: Low volume weeks (<30km) can hold up to 50% in LR

    // Estimate total capacity
    const totalAvailableHours = template.reduce((sum, slot) => sum + slot.availableHours, 0);
    const estPaceVal = userEasyPace || 6.0;
    const maxPotentialVolume = (totalAvailableHours * 60) / estPaceVal;

    // Use the lower of Target or Potential as the basis for the safety cap
    const safeVolumeBasis = Math.min(targetVolume, maxPotentialVolume);

    if (safeVolumeBasis >= 30) {
        const maxRatioDist = safeVolumeBasis * 0.35;
        if (finalLRDist > maxRatioDist) {
            console.warn(`[TemplateGenerator] Long Run (${finalLRDist}km) > 35% of effective volume (${safeVolumeBasis.toFixed(1)}km). Capping at ${maxRatioDist.toFixed(1)}km.`);
            finalLRDist = parseFloat(maxRatioDist.toFixed(1));
            capApplied = true;
            warnings.push({ type: 'RATIO_CAP', message: `Long Run capped at 35% of effective weekly volume (${finalLRDist}km).` });
        }
    }

    const requiredLRHours = Math.max(1.5, (finalLRDist * (userEasyPace * 1.1)) / 60);
    const longRunDay = findBestLongRunDay(template, preferredLongRunDay, availability, requiredLRHours, availabilityMultiplier);

    if (longRunDay !== -1) {
        template[longRunDay].type = WORKOUT_TYPES.LONG_RUN;
        template[longRunDay].distance = finalLRDist;
        template[longRunDay].duration = window.DurationService
            ? window.DurationService.calculateDurationForWorkout('LongRun', finalLRDist)
            : estimateDurationSecondsLocal(finalLRDist, 'long', userEasyPace);
        template[longRunDay].priority = 'KEY';
        template[longRunDay].editable = false;

        // Post-Long Run recovery
        const postLongRunDay = (longRunDay + 1) % 7;

        // Weekend Warrior Override: Allow Sunday run even if Long Run is big
        // Standard Rule: If LR > 35% volume, next day is REST.
        // WW Rule: If LR > 35%, next day can be Zone 2 (Block Training), subject to caps.

        if (template[postLongRunDay].type !== WORKOUT_TYPES.BLOCKED) {
            const longRunRatio = finalLRDist / targetVolume;
            const longRunDuration = template[longRunDay].duration;

            const standardRestTrigger = longRunRatio > 0.35 || longRunDuration > 120;

            if (standardRestTrigger && !isWeekendWarrior) {
                template[postLongRunDay].type = WORKOUT_TYPES.REST;
                template[postLongRunDay].priority = 'RECOVERY';
                template[postLongRunDay].note = 'Rest after Long Run';
            } else {
                // Determine duration for recovery/block run
                // Safety Cap: Sunday <= 80% of Saturday.
                // Min Target: Sunday >= 60% of Saturday (for effective Block).
                const maxNextDayDist = finalLRDist * 0.8;
                const minNextDayDist = finalLRDist * 0.6;

                // For WW, target the floor (60%) initially, or 60m, whichever is higher, but cap at 80%
                let nextDayType = isWeekendWarrior ? WORKOUT_TYPES.EASY : WORKOUT_TYPES.ACTIVE_RECOVERY;

                let targetDist = isWeekendWarrior ? minNextDayDist : parseFloat((30 / userEasyPace).toFixed(1));

                // If WW, try to fit at least 60m if the 60% floor is tiny
                if (isWeekendWarrior) {
                    const dist60m = parseFloat((60 / userEasyPace).toFixed(1));
                    targetDist = Math.max(targetDist, dist60m);
                }

                // Apply constraints
                if (targetDist > maxNextDayDist) targetDist = maxNextDayDist;

                // Combined Weekend Cap: Weekend <= 65% of Total Target Volume
                const maxWeekendVol = targetVolume * 0.65;
                const remainingWeekendVol = maxWeekendVol - finalLRDist;
                if (targetDist > remainingWeekendVol) {
                    targetDist = remainingWeekendVol;
                    // If this pushes it below reasonable recovery run (e.g. < 4km), we might warn or just accept short run
                }

                // Check availability
                const availableDist = (template[postLongRunDay].availableHours * 60) / userEasyPace;
                if (targetDist > availableDist) targetDist = availableDist;

                // Recalculate duration
                let nextDayDuration = estimateDurationSecondsLocal(targetDist, 'easy', userEasyPace);

                template[postLongRunDay].type = nextDayType;
                template[postLongRunDay].duration = nextDayDuration;
                template[postLongRunDay].distance = parseFloat(targetDist.toFixed(1));
                template[postLongRunDay].priority = isWeekendWarrior ? 'KEY' : 'RECOVERY'; // WW treats Sunday as Key volume

                if (isWeekendWarrior && standardRestTrigger) {
                    template[postLongRunDay].note = 'Block Training (Zone 2 Strict)';
                }
            }
        }

        if (isRecoveryWeek) {
            template[longRunDay].note = 'Zone 1/2 Strict (Recovery Week)';
            template[longRunDay].priority = 'SUPPORT';
        }
    } else {
        warnings.push({ type: 'NO_LONG_RUN_SLOT', message: `No day with ${requiredLRHours.toFixed(1)}h+ for Long Run.` });
    }

    // 3. PLACE KEY WORKOUT
    let placedKeyCount = longRunDay !== -1 ? 1 : 0;
    let allowedKeyCount = (targetVolume < 30) ? 1 : (targetVolume > 80 ? 3 : 2);

    while (placedKeyCount < allowedKeyCount) {
        const keyWorkoutDay = findKeyWorkoutDay(template, longRunDay, availability, warnings, availabilityMultiplier);

        if (keyWorkoutDay !== -1) {
            let keyType = WORKOUT_TYPES.TEMPO;
            let progression = { duration: 3600, label: '', note: '' };

            const phaseLC = (phase || '').toLowerCase();
            const isBase = phaseLC.includes('base') && !phaseLC.includes('build');
            const isBuild = phaseLC.includes('build');
            const isPeak = phaseLC.includes('peak');
            const isTaper = phaseLC.includes('taper') || phaseLC.includes('race');

            if (isRecoveryWeek) {
                keyType = WORKOUT_TYPES.EASY;
                progression = { duration: 2700, label: 'Recovery', note: 'Recovery Flush' };
            } else if (placedKeyCount === 2) {
                keyType = WORKOUT_TYPES.TEMPO;
                progression = calculateProgression('TEMPO', weekInPhase, phase);
            } else {
                let type = 'STRIDES';

                if (isBase) {
                    const baseWeek3 = ((weekInPhase - 1) % 3) + 1;
                    if (baseWeek3 === 1) { type = 'HILL_SPRINTS'; keyType = WORKOUT_TYPES.HILL_SPRINTS; }
                    else if (baseWeek3 === 2) { type = 'PROGRESSION'; keyType = WORKOUT_TYPES.PROGRESSION; }
                    else { type = 'FARTLEK'; keyType = WORKOUT_TYPES.FARTLEK; }
                } else if (isBuild) {
                    type = 'VO2MAX';
                    keyType = WORKOUT_TYPES.INTERVALS;
                } else if (isPeak) {
                    type = 'TEMPO';
                    keyType = WORKOUT_TYPES.TEMPO;
                } else if (isTaper) {
                    type = 'TEMPO';
                    keyType = WORKOUT_TYPES.TEMPO;
                }

                progression = calculateProgression(type, weekInPhase, phase);
            }

            template[keyWorkoutDay].type = keyType;
            template[keyWorkoutDay].duration = progression.duration;
            template[keyWorkoutDay].distance = parseFloat((progression.duration / 60 / userEasyPace).toFixed(1));
            template[keyWorkoutDay].note = progression.note;
            template[keyWorkoutDay].steps = progression.steps || [];
            template[keyWorkoutDay].secondary = { label: progression.label };
            template[keyWorkoutDay].priority = isRecoveryWeek ? 'FILL' : 'KEY';
            placedKeyCount++;
        } else {
            break;
        }
    }

    // 4. PLACE STRENGTH TRAINING (Hard Day Stacking Only)
    // Goal: Prioritize stacking on Key Days first. Leave empty days for Running Volume (Step 5).
    let gymPlaced = 0;
    const maxGym = window.getMaxGymForPhase ? window.getMaxGymForPhase(phase) : 2;
    const effectiveGymTarget = Math.min(gymTarget, maxGym);

    const isSafeForGym = (dayIndex) => {
        const nextDay = (dayIndex + 1) % 7;
        const nextSlot = template[nextDay];

        // 1. Not Long Run Day
        if (template[dayIndex].type === WORKOUT_TYPES.LONG_RUN) return false;

        // 2. Not Day Before Key Session (Intervals/Tempo)
        // Check priority 'KEY' but ignore Long Run
        const isNextKey = nextSlot.priority === 'KEY' && nextSlot.type !== WORKOUT_TYPES.LONG_RUN;
        if (isNextKey) return false;

        // 3. Not consecutive strength
        const prevDay = (dayIndex + 6) % 7;
        const prevIsGym = template[prevDay].type === WORKOUT_TYPES.WEIGHT_TRAINING || template[prevDay].secondary === WORKOUT_TYPES.WEIGHT_TRAINING || template[prevDay].secondary?.id === 'WeightTraining';
        const nextIsGym = template[nextDay].type === WORKOUT_TYPES.WEIGHT_TRAINING || template[nextDay].secondary === WORKOUT_TYPES.WEIGHT_TRAINING || template[nextDay].secondary?.id === 'WeightTraining';
        if (prevIsGym || nextIsGym) return false;

        return true;
    };

    // STRATEGY 1: STACK ON KEY DAYS (Priority 'KEY')
    if (gymPlaced < effectiveGymTarget) {
        // Find Key Days (Intervals, Tempo, or Weekend Warrior Sunday)
        const keyDays = template
            .map((s, i) => (s.priority === 'KEY' && s.type !== WORKOUT_TYPES.LONG_RUN) ? i : -1)
            .filter(i => i !== -1);

        for (const day of keyDays) {
            if (gymPlaced >= effectiveGymTarget) break;
            const slot = template[day];

            const workoutDurHours = (slot.duration || 3600) / 3600;
            const remainingHours = slot.availableHours - workoutDurHours;

            // Relaxed availability check: 0.5h (30m) minimum
            if (remainingHours >= 0.5 && isSafeForGym(day)) {
                slot.secondary = WORKOUT_TYPES.WEIGHT_TRAINING;
                slot.secondaryDuration = remainingHours >= 0.75 ? 2700 : 1800; // 45m or 30m
                gymPlaced++;
            }
        }
    }

    // Note: Removed Strategy 2 (Empty Days) from here. We want Step 5 to fill Volume first.

    // 5. SMART VOLUME DISTRIBUTION
    const usedVolume = window.calculateUsedVolume ? window.calculateUsedVolume(template) : calculateUsedVolumeLocal(template);
    let remainingVolume = Math.max(0, targetVolume - usedVolume);
    const minRunDist = minSessionDuration / userEasyPace;

    const emptySlots = template.filter(s => s.type === null && s.availableHours >= (minSessionDuration / 60));

    if (remainingVolume > 0 && emptySlots.length > 0) {
        const maxPossibleRuns = emptySlots.length;
        const sustainableRuns = Math.floor(remainingVolume / minRunDist);
        const runsToSchedule = Math.min(maxPossibleRuns, sustainableRuns);

        if (runsToSchedule > 0) {
            const distPerRun = remainingVolume / runsToSchedule;

            for (let i = 0; i < runsToSchedule; i++) {
                const slot = emptySlots[i];
                let dist = distPerRun;

                const MAX_EASY_DIST = 12;
                dist = Math.min(dist, MAX_EASY_DIST);

                const maxTimeDist = (slot.availableHours * 60) / userEasyPace;
                dist = Math.min(dist, maxTimeDist);

                if (effectiveIsRecovery) dist = Math.min(dist, 8);

                template[slot.day].type = WORKOUT_TYPES.EASY;
                template[slot.day].distance = parseFloat(dist.toFixed(1));
                template[slot.day].duration = window.DurationService
                    ? window.DurationService.calculateDurationForWorkout('Easy', dist)
                    : estimateDurationSecondsLocal(dist, 'easy', userEasyPace);
                template[slot.day].priority = 'FILL';

                if (!effectiveIsRecovery) {
                    template[slot.day].note = (template[slot.day].note || '') + ' + 6x20s Strides';
                    template[slot.day].steps = [
                        { type: 'Run', duration: template[slot.day].duration - 720, intensity: '60-85% Pace' },
                        {
                            name: 'Strides',
                            reps: 6,
                            steps: [
                                { type: 'Run', duration: 20, intensity: '106-130% Pace' },
                                { type: 'Recover', duration: 100, intensity: '60-85% Pace', press_lap: true }
                            ]
                        }
                    ];
                }

                remainingVolume -= dist;
            }
        }
    }

    // 6. GYM FALLBACK (Combine with Easy/Recovery -> then Empty slots)
    if (gymPlaced < effectiveGymTarget) {
        // Strategy 2: Attach to Easy/Recovery Runs
        // This targets the newly created Easy runs from Step 5 + existing Recovery run
        const easySlots = template.filter(s =>
            (s.type === WORKOUT_TYPES.EASY || s.type === WORKOUT_TYPES.ACTIVE_RECOVERY) &&
            !s.secondary &&
            s.availableHours >= 0.5 // Relaxed 30m
        );

        for (const slot of easySlots) {
            if (gymPlaced >= effectiveGymTarget) break;
            const day = slot.day;

            if (slot.type === WORKOUT_TYPES.LONG_RUN) continue;
            if (!isSafeForGym(day)) continue;

            template[day].secondary = WORKOUT_TYPES.WEIGHT_TRAINING;
            const runHours = (slot.duration || 0) / 3600;
            const remaining = slot.availableHours - runHours;
            template[day].secondaryDuration = remaining >= 0.75 ? 2700 : 1800;
            gymPlaced++;
        }
    }

    if (gymPlaced < effectiveGymTarget) {
        // Strategy 3: Remaining Empty Days (that weren't used for running)
        for (let i = 0; i < 7; i++) {
            if (gymPlaced >= effectiveGymTarget) break;
            const day = (i + 1) % 7; // Prefer Mon start
            const slot = template[day];

            if (slot.type !== null) continue;
            if (slot.availableHours < 0.5) continue; // Relaxed 30m
            if (!isSafeForGym(day)) continue;

            slot.type = WORKOUT_TYPES.WEIGHT_TRAINING;
            slot.duration = slot.availableHours >= 0.75 ? 2700 : 1800;
            slot.distance = 0;
            slot.priority = 'SUPPORT';
            gymPlaced++;
        }
    }

    // Long Run Flavors
    if (longRunDay !== -1) {
        let flavor = 'LSD (Zone 2)';
        if (phase === 'Build') flavor = 'Progression (Last 20m Mod)';
        if (phase === 'Peak') flavor = 'Specific (30% @ MP)';
        if (phase === 'Taper') flavor = 'Taper (Zone 2)';
        template[longRunDay].note = template[longRunDay].note ? `${template[longRunDay].note} | ${flavor}` : flavor;
    }

    // 7. OPTIMIZE FREQUENCY
    const optimizerResult = optimizeFrequency(template, targetVolume, {
        longRunCap: targetVolume * 0.35,
        minWorthwhileKm: 5,
        phase: phase
    });
    if (optimizerResult.warnings) warnings.push(...optimizerResult.warnings);

    // Mark remaining empty slots as Rest
    template.forEach(slot => {
        if (slot.type === null) {
            slot.type = WORKOUT_TYPES.REST;
            slot.priority = 'RECOVERY';
        }
    });

    // --- STEP 6: SAFETY CLAMP (FINAL GUARDRAIL) ---
    // Ensure no Easy Run exceeds 12km (or 8km for recovery)
    // This catches crazy volume distribution artifacts or huge available slots
    // ----------------------------------------------------
    const FINAL_MAX_EASY = effectiveIsRecovery ? 8 : 12;

    template.forEach(day => {
        if (day.type === WORKOUT_TYPES.EASY && day.distance > FINAL_MAX_EASY) {
            console.warn(`[TemplateGenerator] Clamping Day ${day.dayName} Easy Run from ${day.distance}km to ${FINAL_MAX_EASY}km`);
            day.distance = FINAL_MAX_EASY;

            // Recalculate duration to match clamped distance
            if (window.DurationService) {
                day.duration = window.DurationService.calculateDurationForWorkout('Easy', day.distance);
            } else {
                day.duration = day.distance * userEasyPace * 60;
            }

            day.note = (day.note || '') + ' (Capped)';
        }
    });



    // --- STEP 7: FINAL RATIO SAFETY CHECK (Retrospective) ---
    // Ensure LR is valid against the ACTUAL final volume (which may be lower than target)
    if (longRunDay !== -1 && template[longRunDay].distance > 0) {
        let finalTotalVol = 0;
        template.forEach(d => { if (d.distance) finalTotalVol += d.distance; });

        // Skip check for very low volume weeks (<30km) as per rule exception
        if (finalTotalVol >= 30) {
            const currentRatio = template[longRunDay].distance / finalTotalVol;
            if (currentRatio > 0.35) {
                // Correct Math: L' <= 0.35 * (Rest + L') -> L' <= Rest * (0.35/0.65)
                const restVolume = finalTotalVol - template[longRunDay].distance;
                const maxAllowedLR = restVolume * (0.35 / 0.65);

                const reduceAmount = template[longRunDay].distance - maxAllowedLR;

                console.warn(`[TemplateGenerator] Final Safety Check: Long Run (${template[longRunDay].distance}km) > 35% of actual volume (${(currentRatio * 100).toFixed(1)}%). Reducing by ${reduceAmount.toFixed(1)}km to match ratio.`);

                template[longRunDay].distance = parseFloat(maxAllowedLR.toFixed(1));

                // Recalculate duration
                if (window.DurationService) {
                    template[longRunDay].duration = window.DurationService.calculateDurationForWorkout('LongRun', template[longRunDay].distance);
                } else {
                    template[longRunDay].duration = estimateDurationSecondsLocal(template[longRunDay].distance, 'long', userEasyPace);
                }

                template[longRunDay].note = (template[longRunDay].note || '') + ' (Ratio Capped)';
            }
        }
    }

    return { template, warnings };
}

// --- Helper Functions ---

function findBestLongRunDay(template, preferred, availability, requiredHours = 2, multiplier = 1.0) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    if ((availability[preferred] * multiplier) >= requiredHours) {
        return preferred;
    }
    const weekendDays = [0, 6];
    for (const day of weekendDays) {
        if ((availability[day] * multiplier) >= requiredHours && template[day].type !== WORKOUT_TYPES.BLOCKED) {
            return day;
        }
    }
    for (let day = 0; day < 7; day++) {
        if ((availability[day] * multiplier) >= requiredHours && template[day].type !== WORKOUT_TYPES.BLOCKED) {
            return day;
        }
    }
    return -1;
}

function findKeyWorkoutDay(template, longRunDay, availability, warnings = [], multiplier = 1.0) {
    const dayBeforeLong = (longRunDay + 6) % 7;
    const dayAfterLong = (longRunDay + 1) % 7;

    const weekdayHours = [1, 2, 3, 4, 5].reduce((sum, d) => sum + ((availability[d] * multiplier) || 0), 0);
    const isWeekendWarrior = weekdayHours === 0;

    const idealDays = [(longRunDay + 2) % 7, (longRunDay + 3) % 7, (longRunDay + 4) % 7];
    // Sort by availability desc
    idealDays.sort((a, b) => ((availability[b] * multiplier) || 0) - ((availability[a] * multiplier) || 0));

    for (const day of idealDays) {
        if ((availability[day] * multiplier) >= 1 && template[day].type === null) {
            return day;
        }
    }

    for (let day = 0; day < 7; day++) {
        if (day === longRunDay || day === dayBeforeLong || day === dayAfterLong) continue;
        if ((availability[day] * multiplier) >= 1 && template[day].type === null) {
            return day;
        }
    }

    if (isWeekendWarrior && (availability[dayBeforeLong] * multiplier) >= 1 && template[dayBeforeLong].type === null) {
        warnings.push({
            type: 'WEEKEND_WARRIOR',
            message: '⚠️ Back-to-back intensity days (Sat/Sun) due to limited weekday availability. Intensity reduced to Tempo.',
            suggestion: 'Consider adding one weekday training slot for optimal recovery.'
        });
        return dayBeforeLong;
    }

    return -1;
}

function canPlaceGym(template, day, longRunDay, keyDay = -1, phase = null) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    const dayBeforeLong = (longRunDay + 6) % 7;

    if (template[day].type !== null) return false;
    if (day === longRunDay) return false;
    if (day === dayBeforeLong) return false;
    if (template[day].availableHours < 0.5) return false;

    if (keyDay !== -1) {
        const dayBeforeKey = (keyDay + 6) % 7;
        const dayAfterKey = (keyDay + 1) % 7;

        if (phase === 'Peak' && day === dayAfterKey) {
            return true;
        }

        if (day === dayBeforeKey || day === dayAfterKey) return false;
    }

    const yesterday = (day + 6) % 7;
    const tomorrow = (day + 1) % 7;

    if (template[yesterday].type === WORKOUT_TYPES.WEIGHT_TRAINING ||
        template[yesterday].secondary?.id === 'WeightTraining' ||
        template[yesterday].secondary === 'WeightTraining') {
        return false;
    }

    if (template[tomorrow].type === WORKOUT_TYPES.WEIGHT_TRAINING ||
        template[tomorrow].secondary?.id === 'WeightTraining' ||
        template[tomorrow].secondary === 'WeightTraining') {
        return false;
    }

    return true;
}

function estimateDurationSecondsLocal(distance, type, userEasyPace = 6.0) {
    if (window.DurationService?.estimateDurationSeconds) {
        return window.DurationService.estimateDurationSeconds(distance, type, userEasyPace);
    }
    const pacePerKm = type === 'long' ? userEasyPace * 1.1 : userEasyPace;
    const durationMinutes = distance * pacePerKm;
    return Math.round(durationMinutes * 60);
}

function calculateUsedVolumeLocal(template) {
    let volume = 0;
    for (const slot of template) {
        if (slot.distance) volume += slot.distance;
    }
    return volume;
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.generateWeeklyTemplate = generateWeeklyTemplate;
window.findBestLongRunDay = findBestLongRunDay;
window.findKeyWorkoutDay = findKeyWorkoutDay;
window.canPlaceGym = canPlaceGym;

window.TemplateGenerator = {
    generateWeeklyTemplate,
    findBestLongRunDay,
    findKeyWorkoutDay,
    canPlaceGym
};
