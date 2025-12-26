/**
 * @file PlanValidator.js
 * @description Deterministic validation layer that runs immediately after scheduling.
 * Responsibilities:
 * 1. Calculate Effective Time in Zone (TiZ).
 * 2. Validate against Pyramidal/Hybrid/Polarized models.
 * 3. Auto-Correct (Mutate) the schedule if intensity is lacking.
 */

const PlanValidator = {

    // =========================================================================
    // 1. THE LOGIC SPECIFICATIONS
    // =========================================================================

    // A. Intensity Models (The Rules)
    IDM_MODELS: {
        LOW_VOLUME: {
            name: 'Pyramidal (Low Vol)',
            targets: { SCI_Z1: 50, SCI_Z2: 40, SCI_Z3: 10 },
            tolerance: 10 // +/- 10%
        },
        MID_VOLUME: {
            name: 'Hybrid (Mid Vol)',
            targets: { SCI_Z1: 65, SCI_Z2: 25, SCI_Z3: 10 },
            tolerance: 10
        },
        HIGH_VOLUME: {
            name: 'Polarized (High Vol)',
            targets: { SCI_Z1: 80, SCI_Z2: 5, SCI_Z3: 15 }, // Adjusted Z2 to 5% as per request "0-5%"
            tolerance: 10
        }
    },

    // B. The Translation Layer (Friel to Science)
    MAP_FRIEL_TO_SCIENCE: {
        // Sci Z1 (Low) = Friel 1, 2
        'Z1': 'SCI_Z1',
        'Z2': 'SCI_Z1',
        // Sci Z2 (Mod) = Friel 3, 4
        'Z3': 'SCI_Z2',
        'Z4': 'SCI_Z2',
        // Sci Z3 (High) = Friel 5a, 5b, 5c
        'Z5a': 'SCI_Z3',
        'Z5b': 'SCI_Z3',
        'Z5c': 'SCI_Z3'
    },

    /**
     * Helper to map Friel string to Scientific Zone Key
     */
    mapFrielToScience(frielZone) {
        if (!frielZone) return 'SCI_Z1';
        // Handle "Zone 2" or "Z2" or "z2"
        const normalized = frielZone.toString().toUpperCase().replace(/ONE\s?/, 'Z').replace('ZONE ', 'Z');

        // Exact match
        if (this.MAP_FRIEL_TO_SCIENCE[normalized]) return this.MAP_FRIEL_TO_SCIENCE[normalized];

        // Prefix match fallback
        if (normalized.startsWith('Z5')) return 'SCI_Z3';
        if (normalized.startsWith('Z1') || normalized.startsWith('Z2')) return 'SCI_Z1';
        if (normalized.startsWith('Z3') || normalized.startsWith('Z4')) return 'SCI_Z2';

        return 'SCI_Z1'; // Default
    },

    // =========================================================================
    // 2. THE CALCULATION ENGINE
    // =========================================================================

    /**
     * Calculate Time in Zone (TiZ) for the entire week
     * @param {Array} weekSchedule - Array of day objects { workout: {...} }
     * @returns {Object} { SCI_Z1, SCI_Z2, SCI_Z3, Z1, Z2, Z3, Z4, Z5A, Z5B, Z5C } (minutes)
     */
    calculateWeeklyTiZ(weekSchedule) {
        const tiz = {
            SCI_Z1: 0, SCI_Z2: 0, SCI_Z3: 0,
            Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5A: 0, Z5B: 0, Z5C: 0
        };

        weekSchedule.forEach(slot => {
            const w = slot.workout;
            if (!w) return;

            // Constraint: Exclude strength
            if (w.sport === 'Strength' || w.type === 'WeightTraining' || w.id?.includes('gym')) return;

            // Parse steps
            const steps = w.steps || [];

            // If no steps, fallback to main duration (assume Z1 if Easy/Recovery, else analyze type)
            if (steps.length === 0) {
                // Fallback for simple objects
                const dur = w.totalDuration || 0; // minutes
                if (w.type === 'Easy' || w.type === 'Recovery' || w.type === 'LongRun') {
                    tiz.SCI_Z1 += dur;
                    tiz.Z2 += dur; // Default easy to Friel Z2
                } else if (w.type === 'Tempo') {
                    // Rough guess: 20% Z1 (WU/CD), 80% Z2
                    tiz.SCI_Z1 += (dur * 0.2);
                    tiz.Z1 += (dur * 0.2);
                    tiz.SCI_Z2 += (dur * 0.8);
                    tiz.Z3 += (dur * 0.4); // split across Z3/Z4
                    tiz.Z4 += (dur * 0.4);
                } else if (w.type === 'Intervals') {
                    // Rough guess: 50% Z1, 50% Z3
                    tiz.SCI_Z1 += (dur * 0.5);
                    tiz.Z1 += (dur * 0.5);
                    tiz.SCI_Z3 += (dur * 0.5);
                    tiz.Z5A += (dur * 0.5);
                } else {
                    tiz.SCI_Z1 += dur;
                    tiz.Z2 += dur;
                }
                return;
            }

            // Iterate steps
            this._parseStepsRecursively(steps, tiz);
        });

        return tiz;
    },

    _parseStepsRecursively(steps, tizAccumulator) {
        steps.forEach(step => {
            // Check for nested 'steps' (Intervals.icu format often has `steps: [...]` inside a main set)
            if (step.steps && Array.isArray(step.steps)) {
                // Determine repetitions
                const reps = step.reps || 1;
                for (let i = 0; i < reps; i++) {
                    this._parseStepsRecursively(step.steps, tizAccumulator);
                }
                return;
            }

            // Determine Duration
            let durationMin = 0;
            if (typeof step.duration === 'number') {
                durationMin = step.duration / 60;
            } else {
                return; // No duration, skip
            }

            // Determine Type / Zone
            const type = step.type ? step.type.toLowerCase() : 'run';
            // WARMUP / COOLDOWN / RECOVER -> Sci Z1
            if (type === 'warmup' || type === 'cooldown' || type === 'recover' || type === 'rest') {
                tizAccumulator.SCI_Z1 += durationMin;
                tizAccumulator.Z1 += durationMin; // Map to Friel Z1
            } else {
                // It's a work step (Run, Interval, etc.)
                // Look at intensity/zone
                const zone = step.intensity || step.zone || 'Z2';
                const sciZone = this.mapFrielToScience(zone);
                tizAccumulator[sciZone] += durationMin;

                // Map to Friel Key
                let frielKey = zone.toString().toUpperCase().replace(/ONE\s?/, 'Z').replace('ZONE ', 'Z');
                if (frielKey === 'Z5') frielKey = 'Z5A'; // Default Z5 to Z5A

                if (tizAccumulator[frielKey] !== undefined) {
                    tizAccumulator[frielKey] += durationMin;
                } else {
                    // Fallback for cases like 'Z4/5' or 'Threshold'
                    if (frielKey.includes('Z1') || frielKey.includes('Z2')) tizAccumulator.Z2 += durationMin;
                    else if (frielKey.includes('Z3') || frielKey.includes('Z4')) tizAccumulator.Z4 += durationMin;
                    else if (frielKey.includes('Z5')) tizAccumulator.Z5A += durationMin;
                }
            }
        });
    },

    // =========================================================================
    // 3. THE OPTIMIZATION LOGIC (Auto-Correct)
    // =========================================================================

    /**
     * Main Entry Point: Validate and Fix the schedule
     * @param {Array} weekSchedule - the schedule array
     * @param {Object} volumeProfile - { volume: number, sport: string }
     */
    validateAndFix(weekSchedule, volumeProfile) {
        const { volume, sport } = volumeProfile;

        // 1. Determine Model
        let model = this.IDM_MODELS.HIGH_VOLUME;
        if (sport === 'Running') {
            if (volume < 50) model = this.IDM_MODELS.LOW_VOLUME; // using km? user said <5h. 5h * 10kph = 50km.
            else if (volume < 80) model = this.IDM_MODELS.MID_VOLUME;
        } else {
            // Cycling (Hours usually)
            if (volume < 8) model = this.IDM_MODELS.LOW_VOLUME;
            else if (volume < 12) model = this.IDM_MODELS.MID_VOLUME;
        }

        // 2. Calculate Current TiZ
        const currentTiZ = this.calculateWeeklyTiZ(weekSchedule);
        const totalMin = currentTiZ.SCI_Z1 + currentTiZ.SCI_Z2 + currentTiZ.SCI_Z3;

        if (totalMin === 0) return weekSchedule; // Empty week

        const pct = {
            SCI_Z1: (currentTiZ.SCI_Z1 / totalMin) * 100,
            SCI_Z2: (currentTiZ.SCI_Z2 / totalMin) * 100,
            SCI_Z3: (currentTiZ.SCI_Z3 / totalMin) * 100
        };

        console.log(`[PlanValidator] Analysis (${model.name}):`, pct);

        // 3. Diagnose
        const tolerance = 10; // +/- 10%

        // Check Z2 Deficit (Common in Low Vol)
        if (model.targets.SCI_Z2 > 0) {
            const deficitZ2 = model.targets.SCI_Z2 - pct.SCI_Z2;
            if (deficitZ2 > tolerance) {
                console.log(`[PlanValidator] Detected Z2 Deficit (${deficitZ2.toFixed(1)}%). optimizing...`);
                return this.optimizeSchedule(weekSchedule, 'UPGRADE_TO_TEMPO');
            }
        }

        // Check Z3 Deficit
        if (model.targets.SCI_Z3 > 0) {
            const deficitZ3 = model.targets.SCI_Z3 - pct.SCI_Z3;
            if (deficitZ3 > tolerance) {
                console.log(`[PlanValidator] Detected Z3 Deficit (${deficitZ3.toFixed(1)}%). optimizing...`);
                return this.optimizeSchedule(weekSchedule, 'UPGRADE_TO_INTERVALS');
            }
        }

        return weekSchedule;
    },

    /**
     * Mutate the schedule to fix deficits
     */
    optimizeSchedule(weekSchedule, action) {
        // Deep copy to allow mutation without side-effects if needed, but we essentially mutate the plan in place
        // passed from main.

        // FIND CANDIDATE
        // 1. Identify "Heavy Days" (Intervals, Tempo, Neural Strength)
        // We map by Day Index (0-6)
        const heavyDaysBitmask = [];
        weekSchedule.forEach(slot => {
            const w = slot.workout;
            const s = slot.secondary;

            // Primary Workout Heavy?
            let isHeavy = false;
            if (w) {
                if (['Intervals', 'Tempo', 'VO2 Max', 'Threshold'].includes(w.type)) isHeavy = true;
                if (w.id === 'gym_neural') isHeavy = true;
            }

            // Secondary Workout Heavy? (Rare for secondary to be key run, but Strength A is heavy)
            if (s) {
                if (s.id === 'gym_neural' || s.sport === 'Strength') {
                    // Assume Strength A (Neural) is heavy. Strength B (Stability) is not.
                    // If we can't distinguish, assume Strength on hard day is OK (as per Scheduler), 
                    // but does it block the NEXT day? Yes, Neural does.
                    if (s.id === 'gym_neural') isHeavy = true;
                }
            }

            heavyDaysBitmask[slot.day] = isHeavy;
        });

        // 2. Filter Candidate Days
        // Look for: Run, Easy, NOT Long Run
        const candidates = weekSchedule.filter(slot => {
            const w = slot.workout;
            if (!w) return false;

            // Must be Run
            if (w.sport === 'Strength') return false;

            // Must be Easy (Target to upgrade)
            const isEasy = w.type === 'Easy' || w.type === 'Recovery' || (w.id && w.id.includes('easy'));
            if (!isEasy) return false;

            // CRITICAL RULE: The Long Run Buffer
            // Do NOT upgrade if it is the Long Run (Sunday or identified as LongRun)
            if (w.type === 'LongRun' || w.id === 'long_run') return false;

            // CRITICAL RULE: The 24h Buffer (Recovery)
            // Do NOT upgrade if the previous day was Heavy
            const prevDayIndex = (slot.day + 6) % 7;
            const isBlockedByYesterday = heavyDaysBitmask[prevDayIndex];

            if (isBlockedByYesterday) {
                // Determine if we should log this rejection for debug? 
                // console.log(`[PlanValidator] Rejected ${slot.dayName} for upgrade (Blocked by Yesterday)`);
                return false;
            }

            return true;
        });

        if (candidates.length === 0) {
            console.warn("[PlanValidator] No optimization candidates found.");
            return weekSchedule;
        }

        // Pick the longest easy run (best to convert to workout) or just the first?
        // First available is usually fine.
        candidates.sort((a, b) => b.availableHours - a.availableHours);
        const targetSlot = candidates[0];

        // PERFORM UPGRADE
        if (action === 'UPGRADE_TO_TEMPO') {
            console.log(`[PlanValidator] Upgrading ${targetSlot.dayName} (${targetSlot.workout.title}) to Tempo.`);

            // Fetch Template
            let template = null;
            if (window.RUNNING_LIBRARY && window.RUNNING_LIBRARY.TEMPO) {
                template = window.RUNNING_LIBRARY.TEMPO[0]; // Default Tempo
            }

            if (template && window.buildWorkout) {
                // DURATION LOGIC (Corrected):
                // 1. Original Scheduled Duration (e.g. 30-45m)
                // 2. Subtract Overhead (WU + CD) to get "Main Set Budget"

                const originalDur = targetSlot.workout.totalDuration || 45;
                const availMin = targetSlot.availableHours * 60;

                // Effective Budget: Min of Original Plan or Available Time
                let timeBudget = Math.min(originalDur, availMin);

                // Calculate Overhead from Template
                const wu = template.structure?.warmup?.duration || 0;
                const cd = template.structure?.cooldown?.duration || 0;
                const overhead = wu + cd;

                // Ensure budget covers at least overhead + minimal main set (e.g. 15m)
                timeBudget = Math.max(timeBudget, overhead + 15);

                const pace = window.getLTPace ? window.getLTPace() : 300;

                // Pass "Main Set Duration" to buildWorkout
                // buildWorkout applies this to the 'main' block
                const mainSetDuration = timeBudget - overhead;

                const built = window.buildWorkout(template, pace, mainSetDuration);

                // Mutate Slot
                targetSlot.workout = {
                    ...built,
                    date: targetSlot.workout.date, // Preserve date
                    start_date_local: targetSlot.workout.start_date_local,
                    dayIndex: targetSlot.day,
                    type: 'Tempo',
                    title: built.name,
                    steps: built.steps
                };
            }
        }
        else if (action === 'UPGRADE_TO_INTERVALS') {
            console.log(`[PlanValidator] Upgrading ${targetSlot.dayName} (${targetSlot.workout.title}) to Intervals.`);
            // Fetch Template
            let template = null;
            if (window.RUNNING_LIBRARY && window.RUNNING_LIBRARY.INTERVALS) {
                template = window.RUNNING_LIBRARY.INTERVALS[0];
            }

            if (template && window.buildWorkout) {
                const availMin = targetSlot.availableHours * 60;
                const duration = Math.min(availMin, template.minDuration || 60);
                const pace = window.getLTPace ? window.getLTPace() : 300;

                const built = window.buildWorkout(template, pace, duration);

                targetSlot.workout = {
                    ...built,
                    date: targetSlot.workout.date,
                    start_date_local: targetSlot.workout.start_date_local,
                    dayIndex: targetSlot.day,
                    type: 'Intervals',
                    title: built.name,
                    steps: built.steps
                };
            }
        }

        return weekSchedule;
    }
};

// Expose
window.PlanValidator = PlanValidator;
console.log("[PlanValidator] Module loaded.");
