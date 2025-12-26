/**
 * @file endurance-validator.js
 * @description Core logic for validating endurance plans based on physiological math.
 * Handles Friel -> Scientific zone translation, TiZ calculation, and IDM targets.
 */

const EnduranceValidator = {
    // ========================================================================
    // CONSTANTS & MAPPINGS
    // ========================================================================

    // Map Friel Zones (Input) -> Scientific Buckets (Math)
    ZONE_MAPPING: {
        'Z1': 'SCI_Z1',  // Recovery
        'Z2': 'SCI_Z1',  // Aerobic
        'Z3': 'SCI_Z2',  // Tempo
        'Z4': 'SCI_Z2',  // Threshold
        'Z5a': 'SCI_Z3', // SuperThreshold
        'Z5b': 'SCI_Z3', // Anaerobic
        'Z5c': 'SCI_Z3'  // Sprint
    },

    // Readable names for Scientific Buckets
    BUCKET_NAMES: {
        'SCI_Z1': 'Low Intensity (Recovery/Aerobic)',
        'SCI_Z2': 'Threshold (Tempo/Sweet Spot)',
        'SCI_Z3': 'High Intensity (VO2/Anaerobic)'
    },

    // IDM Targets based on Sport & Volume
    IDM_MODELS: {
        LOW_VOLUME: {
            name: 'Pyramidal (Low Vol)',
            targets: { SCI_Z1: 50, SCI_Z2: 40, SCI_Z3: 10 },
            rules: { run: 5, bike: 8 } // < Hours
        },
        MID_VOLUME: {
            name: 'Hybrid (Mid Vol)',
            targets: { SCI_Z1: 65, SCI_Z2: 25, SCI_Z3: 10 },
            rules: { run: 8, bike: 12 } // < Hours (but > Low)
        },
        HIGH_VOLUME: {
            name: 'Polarized (High Vol)',
            targets: { SCI_Z1: 80, SCI_Z2: 0, SCI_Z3: 20 },
            rules: { run: 999, bike: 999 } // > Mid
        }
    },

    // ========================================================================
    // CORE METHODS
    // ========================================================================

    /**
     * Determine the target IDM based on volume and sport
     * @param {number} weeklyVolumeHours 
     * @param {string} sport 'Running' or 'Cycling'
     * @returns {Object} The IDM Model (name, targets)
     */
    determineIDM(weeklyVolumeHours, sport) {
        const isRun = sport.toLowerCase() === 'running';
        const limits = this.IDM_MODELS;

        // Check Low Volume
        const lowLimit = isRun ? limits.LOW_VOLUME.rules.run : limits.LOW_VOLUME.rules.bike;
        if (weeklyVolumeHours < lowLimit) {
            return limits.LOW_VOLUME;
        }

        // Check Mid Volume
        const midLimit = isRun ? limits.MID_VOLUME.rules.run : limits.MID_VOLUME.rules.bike;
        if (weeklyVolumeHours < midLimit) {
            return limits.MID_VOLUME;
        }

        // Default to High Volume
        return limits.HIGH_VOLUME;
    },

    /**
     * Calculate Time in Zone (TiZ) for a single workout
     * @param {Object} workout - Must have 'steps' array or 'structure' object
     * @returns {Object} { SCI_Z1: mins, SCI_Z2: mins, SCI_Z3: mins }
     */
    calculateWorkoutTiZ(workout) {
        const tiz = { SCI_Z1: 0, SCI_Z2: 0, SCI_Z3: 0 };

        let steps = [];

        // Normalize steps source
        if (Array.isArray(workout.steps)) {
            steps = workout.steps;
        } else if (workout.structure) {
            // Convert simple structure object to steps array for consistent processing
            if (workout.structure.warmup) steps.push({ ...workout.structure.warmup, type: 'Warmup' });

            if (workout.structure.main) {
                if (Array.isArray(workout.structure.main)) {
                    steps.push(...workout.structure.main);
                } else {
                    // Single main block? usually main is array of intervals
                    // If it's complex, we might need to handle recursiveness if 'main' has sub-steps
                    // For now assume flat structure or simple main
                    steps.push(workout.structure.main);
                }
            }

            if (workout.structure.cooldown) steps.push({ ...workout.structure.cooldown, type: 'Cooldown' });
        }

        // Iterate steps
        steps.forEach(step => {
            // Handle array of steps (nested structure) if main was just an array
            if (Array.isArray(step)) {
                step.forEach(subStep => this._addStepToTiZ(subStep, tiz));
            } else {
                this._addStepToTiZ(step, tiz);
            }
        });

        return tiz;
    },

    /**
     * Helper to add a step's duration to the TiZ accumulator
     * @param {Object} step 
     * @param {Object} tizAccumulator 
     */
    _addStepToTiZ(step, tizAccumulator) {
        if (!step) return;
        if (!step.duration && !step.reps) return; // Must have duration OR be a rep block

        // Strength / Other logic? 
        // Request says: "Strength sessions contribute 0 minutes to TiZ calculations"
        // We assume filtering happens before or we check type.
        // But if passed here, we check zone.

        // If it's a "repetition" loop
        if (step.reps && step.active && step.recovery) {
            const reps = parseInt(step.reps) || 1;

            // Add Active
            const activeZone = this.mapFrielToSci(step.active.zone);
            const activeDur = this._parseDuration(step.active.duration);
            if (activeZone) tizAccumulator[activeZone] += (activeDur * reps);

            // Add Recovery
            const recZone = this.mapFrielToSci(step.recovery.zone);
            const recDur = this._parseDuration(step.recovery.duration);
            if (recZone) tizAccumulator[recZone] += (recDur * reps);

            return;
        }

        const zone = step.zone || 'Z1'; // Default to Z1 if missing
        const sciBucket = this.mapFrielToSci(zone);
        const duration = this._parseDuration(step.duration); // Ensure minutes

        if (sciBucket && duration > 0) {
            tizAccumulator[sciBucket] += duration;
        }
    },

    /**
     * Map Friel Zone to Scientific Bucket
     * @param {string} frielZone 
     * @returns {string} SCI_Z1 | SCI_Z2 | SCI_Z3
     */
    mapFrielToSci(frielZone) {
        // Handle variations (e.g. "Zone 2", "z2")
        const normalized = frielZone.toString().replace(/one\s?/i, '').replace('z', 'Z');

        // Direct match
        if (this.ZONE_MAPPING[normalized]) return this.ZONE_MAPPING[normalized];

        // Fallback for sub-zones if not explicitly mapped (e.g. Z5a -> Z5)
        if (normalized.startsWith('Z5')) return 'SCI_Z3';
        if (normalized.startsWith('Z1') || normalized.startsWith('Z2')) return 'SCI_Z1';

        return 'SCI_Z1'; // Default safe fallback
    },

    /**
     * Parse duration to minutes
     * @param {number|string} duration 
     * @returns {number} minutes
     */
    _parseDuration(duration) {
        if (typeof duration === 'number') return duration;
        // If string "100s" or "1:00:00" - simplistic handling for now
        // Assuming the app mostly uses minutes as number in structure
        return parseFloat(duration) || 0;
    },

    /**
     * Validate a full week of workouts against IDM and Rules
     * @param {Array} weekWorkouts - Array of workout objects
     * @param {number} weeklyVolumeHours 
     * @param {string} sport 
     * @returns {Object} Validation Result { passed: bool, warnings: [], suggestions: [] }
     */
    validateWeek(weekWorkouts, weeklyVolumeHours, sport) {
        const idm = this.determineIDM(weeklyVolumeHours, sport);
        const totalTiZ = { SCI_Z1: 0, SCI_Z2: 0, SCI_Z3: 0 };

        let totalDuration = 0;

        // 1. Calculate Grand Total TiZ
        weekWorkouts.forEach(workout => {
            // Skip Strength for TiZ
            if (workout.type === 'Strength' || workout.sportType === 'StrengthTraining') return;

            const wTiZ = this.calculateWorkoutTiZ(workout);
            totalTiZ.SCI_Z1 += wTiZ.SCI_Z1;
            totalTiZ.SCI_Z2 += wTiZ.SCI_Z2;
            totalTiZ.SCI_Z3 += wTiZ.SCI_Z3;
            totalDuration += (wTiZ.SCI_Z1 + wTiZ.SCI_Z2 + wTiZ.SCI_Z3);
        });

        if (totalDuration === 0) return { passed: true, message: "No volume to validate", corrections: [] };

        // 2. Calculate Percentages
        const actuals = {
            SCI_Z1: (totalTiZ.SCI_Z1 / totalDuration) * 100,
            SCI_Z2: (totalTiZ.SCI_Z2 / totalDuration) * 100,
            SCI_Z3: (totalTiZ.SCI_Z3 / totalDuration) * 100
        };

        const corrections = [];

        // 3. Logic Checks

        // RULE: Low Volume & Sci Z2 < 35% -> Too Easy
        if (idm.name.includes('Low Vol') && actuals.SCI_Z2 < 35) {
            corrections.push({
                type: 'INTENSITY_UPGRADE',
                diagnosis: "Plan is too easy. The 'Easy Runs' are creating a caloric black hole in a low volume week.",
                action: "Upgrade a General Aerobic (Z2) session to Tempo/Sweet Spot (Z3/Z4).",
                targetMetric: 'SCI_Z2',
                current: actuals.SCI_Z2,
                target: 40
            });
        }

        // RULE: Insufficient High Intensity (Generic)
        // IF (Any Profile) AND (Sci Z3 < Target - 3%)
        if (actuals.SCI_Z3 < (idm.targets.SCI_Z3 - 3)) {
            corrections.push({
                type: 'INTENSITY_BOOST',
                diagnosis: "Insufficient High-Intensity Stimulus.",
                action: "Increase intervals or work duration in the key high-intensity session.",
                targetMetric: 'SCI_Z3',
                current: actuals.SCI_Z3,
                target: idm.targets.SCI_Z3
            });
        }

        return {
            passed: corrections.length === 0,
            idmUsed: idm.name,
            totalDuration,
            distribution: actuals,
            targets: idm.targets,
            corrections
        };
    }
};

// Expose globally
// Expose globally
if (typeof window !== 'undefined') {
    window.EnduranceValidator = EnduranceValidator;
}
if (typeof module !== 'undefined') {
    module.exports = EnduranceValidator;
}
if (typeof global !== 'undefined') {
    global.EnduranceValidator = EnduranceValidator;
}
console.log('[EnduranceValidator] Service loaded.');
