/**
 * @file workout-library-structured.js
 * @description Single source of truth for all structured workout definitions.
 * @usedBy js/core/deterministic-scheduler.js, js/features/weekly-plan/services/TemplateConverter.js
 * @responsibilities
 * - Defines the "Blueprints" for every workout type (Intervals, Tempo, Long Run, Strength)
 * - Contains the specific steps, duration, and intensity rules for each session
 * - Stores detailed descriptions for Strength Training sessions (Neural Power, Stability)
 * @why Separates "What a workout is" (Library) from "When to do it" (Scheduler).
 */

// ============================================================================
// STRUCTURED WORKOUT LIBRARY
// Deterministic workout blueprints for rule-based scheduling
// ============================================================================
//
// ZONE PACES: This file uses window.getZonePace() from js/core/zone-service.js
// The SINGLE SOURCE OF TRUTH for all pace zones is window.state.zones,
// calculated from the user's LT pace via ThresholdEstimator.
//
// DO NOT define zone percentages or multipliers here - use ZoneService.
// ============================================================================

/**
 * Zone Definitions - LEGACY FALLBACK ONLY
 * These are only used if ZoneService is not loaded.
 * The canonical zone definitions are in js/core/zone-service.js
 * 
 * FRIEL 7-ZONE MODEL:
 * - Percentages are % of LT pace (higher % = faster)
 * - paceMultiplier = 1 / (centerPct / 100), used to get pace from LT pace
 *   e.g., 85% LT → multiplier = 1/0.85 = 1.18 (Z2 center is ~85%)
 */
const ZONE_DEFINITIONS = {
    // Zone boundaries: minPct - maxPct (% of LT pace)
    // Center used for pace calculation
    Z1: { name: 'Recovery', minPct: 0, maxPct: 80, paceMultiplier: 1.33, description: '0-80% LT' },      // Center ~75%
    Z2: { name: 'Endurance', minPct: 80, maxPct: 90, paceMultiplier: 1.18, description: '80-90% LT' },   // Center 85%
    Z3: { name: 'Tempo', minPct: 90, maxPct: 95, paceMultiplier: 1.08, description: '90-95% LT' },       // Center 92.5%
    Z4: { name: 'Sub-Threshold', minPct: 95, maxPct: 100, paceMultiplier: 1.03, description: '95-100% LT' }, // Center 97.5%
    Z5a: { name: 'Threshold', minPct: 100, maxPct: 102, paceMultiplier: 0.99, description: '100-102% LT' }, // Center 101%
    Z5b: { name: 'VO2 Max', minPct: 102, maxPct: 106, paceMultiplier: 0.96, description: '102-106% LT' }, // Center 104%
    Z5c: { name: 'Anaerobic', minPct: 106, maxPct: 130, paceMultiplier: 0.85, description: '106-130% LT' } // Center 118%
};

/**
 * Calculate actual pace for a zone in seconds/km
 * PREFERS ZoneService (single source of truth)
 * Falls back to local calculation if ZoneService not available
 * 
 * @param {string} zone - Zone key (Z1-Z5c)
 * @param {number} thresholdPace - User's threshold pace in sec/km (fallback only)
 * @returns {number} Pace in seconds/km
 */
function getZonePace(zone, thresholdPace) {
    // PREFER ZoneService (single source of truth)
    // IMPORTANT: Use window.ZoneService.getZonePace, NOT window.getZonePace
    // to avoid infinite recursion with this local function
    if (window.ZoneService && window.ZoneService.getZonePace && window.state?.zones) {
        return window.ZoneService.getZonePace(zone);
    }

    // Fallback to local calculation
    const zoneDef = ZONE_DEFINITIONS[zone];
    if (!zoneDef) return thresholdPace || 300;
    return Math.round((thresholdPace || 300) * zoneDef.paceMultiplier);
}

/**
 * Calculate distance from duration and pace
 * @param {number} durationMin - Duration in minutes
 * @param {string} zone - Zone key
 * @param {number} thresholdPace - User's threshold pace in sec/km
 * @returns {number} Distance in km
 */
function calculateDistance(durationMin, zone, thresholdPace) {
    const pace = getZonePace(zone, thresholdPace);
    const durationSec = durationMin * 60;
    return durationSec / pace; // km
}

/**
 * Calculate total workout duration from structure
 * @param {Object} structure - Workout structure
 * @returns {number} Total duration in minutes
 */
function getWorkoutDuration(structure) {
    let total = 0;

    if (structure.warmup?.duration) total += structure.warmup.duration;
    if (structure.cooldown?.duration) total += structure.cooldown.duration;

    if (structure.main) {
        if (structure.main.duration) {
            total += structure.main.duration;
        } else if (structure.main.reps) {
            // Interval workout
            const workTime = structure.main.work?.duration || 0;
            const restTime = structure.main.rest?.duration || 0;
            total += structure.main.reps * (workTime + restTime);
        }
    }

    return total;
}

// ============================================================================
// RUNNING WORKOUT LIBRARY
// ============================================================================

const RUNNING_LIBRARY = {
    // -------------------------------------------------------------------------
    // INTERVALS - High intensity, VO2 Max development
    // -------------------------------------------------------------------------
    INTERVALS: [
        {
            id: 'vo2_max_4x1k',
            name: 'VO2 Max: 4×1km',
            phase: ['Build', 'Peak'],
            minDuration: 55,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: {
                    reps: 4,
                    work: { distance: 1000, zone: 'Z5' }, // 1km @ Z5
                    rest: { duration: 3, zone: 'Z1' }     // 3min recovery
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '4 × 1km at VO2 Max effort with full recovery'
        },
        {
            id: 'vo2_max_5x800',
            name: 'VO2 Max: 5×800m',
            phase: ['Build', 'Peak'],
            minDuration: 50,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: {
                    reps: 5,
                    work: { distance: 800, zone: 'Z5' },
                    rest: { duration: 2.5, zone: 'Z1' }
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '5 × 800m at VO2 Max with 2:30 recovery jog'
        },
        {
            id: 'track_400s',
            name: 'Speed: 8×400m',
            phase: ['Build', 'Peak'],
            minDuration: 45,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: {
                    reps: 8,
                    work: { distance: 400, zone: 'Z5c' },
                    rest: { duration: 1.5, zone: 'Z1' }
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '8 × 400m at fast pace with 90s recovery'
        },
        {
            id: 'fartlek_10x1',
            name: 'Fartlek: 10×1min',
            phase: ['Base', 'Build'],
            minDuration: 45,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: {
                    reps: 10,
                    work: { duration: 1, zone: 'Z4' },
                    rest: { duration: 1, zone: 'Z1' }
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '10 × 1min hard with 1min easy - flexible intensity'
        },
        // [NEW] Base Phase Specifics
        {
            id: 'hill_sprints',
            name: 'Hill Sprints: 8x10s',
            phase: ['Base'],
            minDuration: 45,
            structure: {
                warmup: { duration: 15, zone: 'Z1', press_lap: true },
                main: {
                    reps: 8,
                    work: { duration: 0.166, zone: 'Z5c', distance: null }, // 10s
                    rest: { duration: 1.5, zone: 'Z1' } // 90s
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '8 x 10s Hill Sprints (Max Effort, Full Rest)'
        },
        {
            id: 'strides_8x20s',
            name: 'Strides: 8x20s',
            phase: ['Base'],
            minDuration: 40,
            structure: {
                warmup: { duration: 15, zone: 'Z1', press_lap: true },
                main: {
                    reps: 8,
                    work: { duration: 0.333, zone: 'Z5c' }, // 20s
                    rest: { duration: 1.666, zone: 'Z1', press_lap: true } // 100s
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '8 x 20s Strides for Neuromuscular development'
        }
    ],

    // -------------------------------------------------------------------------
    // TEMPO - Threshold development
    // -------------------------------------------------------------------------
    TEMPO: [
        {
            id: 'tempo_20m',
            name: 'Classic 20min Tempo',
            phase: ['Base', 'Build'],
            minDuration: 50,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: { duration: 20, zone: 'Z3' },
                cooldown: { duration: 15, zone: 'Z1' }
            },
            description: '20 minutes at marathon effort - comfortably hard'
        },
        {
            id: 'tempo_30m',
            name: 'Extended 30min Tempo',
            phase: ['Build', 'Peak'],
            minDuration: 60,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: { duration: 30, zone: 'Z3' },
                cooldown: { duration: 15, zone: 'Z1' }
            },
            description: 'Extended tempo for race-specific endurance'
        },
        {
            id: 'cruise_intervals',
            name: 'Cruise Intervals: 3×10min',
            phase: ['Base', 'Build'],
            minDuration: 55,
            structure: {
                warmup: { duration: 15, zone: 'Z1' },
                main: {
                    reps: 3,
                    work: { duration: 10, zone: 'Z4' },
                    rest: { duration: 2, zone: 'Z1' }
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: '3 × 10min at threshold with short recovery'
        },
        {
            id: 'progressive_run',
            name: 'Progressive Run',
            phase: ['Base', 'Build', 'Peak'],
            minDuration: 45,
            structure: {
                warmup: { duration: 10, zone: 'Z1' },
                main: {
                    segments: [
                        { duration: 15, zone: 'Z2' },
                        { duration: 10, zone: 'Z3' },
                        { duration: 5, zone: 'Z4' }
                    ]
                },
                cooldown: { duration: 5, zone: 'Z1' }
            },
            description: 'Start easy, finish hard - negative split'
        }
    ],

    // -------------------------------------------------------------------------
    // EASY - Recovery and aerobic base
    // -------------------------------------------------------------------------
    EASY: [
        {
            id: 'easy_run',
            name: 'Easy Run',
            phase: ['all'],
            minDuration: 30,
            structure: {
                warmup: { duration: 5, zone: 'Z1' },
                main: { zone: 'Z2' }, // Duration filled based on availability
                cooldown: { duration: 5, zone: 'Z1' }
            },
            description: 'Comfortable aerobic run - build the base'
        },
        {
            id: 'recovery_run',
            name: 'Recovery Run',
            phase: ['all'],
            minDuration: 25,
            structure: {
                main: { zone: 'Z1' } // All Z1, no warmup/cooldown
            },
            description: 'Very easy - promote blood flow, no stress'
        }
    ],

    // -------------------------------------------------------------------------
    // LONG - Endurance cornerstone
    // -------------------------------------------------------------------------
    LONG: [
        {
            id: 'long_run',
            name: 'Long Run',
            phase: ['all'],
            minDuration: 60,
            structure: {
                warmup: { duration: 10, zone: 'Z1' },
                main: { zone: 'Z2' }, // Duration calculated from volume target
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: 'Weekly long run - adapt to time on feet'
        },
        {
            id: 'long_run_progressive',
            name: 'Progressive Long Run',
            phase: ['Build', 'Peak'],
            minDuration: 75,
            structure: {
                warmup: { duration: 10, zone: 'Z1' },
                main: {
                    segments: [
                        { percent: 0.6, zone: 'Z2' },  // 60% easy
                        { percent: 0.3, zone: 'Z3' },  // 30% tempo
                        { percent: 0.1, zone: 'Z4' }   // 10% strong finish
                    ]
                },
                cooldown: { duration: 10, zone: 'Z1' }
            },
            description: 'Long run with tempo finish - race simulation'
        }
    ],

    // -------------------------------------------------------------------------
    // STRENGTH - Cross-training
    // -------------------------------------------------------------------------
    STRENGTH: [
        {
            id: 'gym_neural',
            name: 'Strength Training A',
            sport: 'Strength',
            phase: ['all'],
            minDuration: 45,
            structure: {
                warmup: { duration: 10, type: 'mobility' },
                main: { duration: 40, type: 'strength' },
                cooldown: { duration: 5, type: 'stretch' }
            },
            description: `STRENGTH SESSION A – Neural Power & Coordination
Focus: Maximal force production and neural recruitment. Frequency: Once per week (ideally PM on a hard interval day).

1. Warm-Up (10–12 min)

3 minutes easy cardio

Dynamic mobility: Leg swings, world’s greatest stretch, lunge with rotation, ankle rocks.

Activation: Banded clamshells (15–20/side), glute bridge (10 reps w/ 2s pause), dead bug (6/side).

2. Main Compound Lifts (Alternating Focus)

IMPORTANT – WEEKLY ROTATION: Do not go heavy on both Squat and Deadlift in the same session. Alternate your focus each week:

Week A: Heavy Squat (3 sets RPE 8) + Technique Deadlift (2 sets RPE 6).

Week B: Heavy Deadlift (3 sets RPE 8) + Technique Squat (2 sets RPE 6).

A. High-Bar Back Squat

Warm-up: 1×6 @ 50%, 1×4 @ 65%, 1×2 @ 85% of working weight.

Working sets: 3×6 at ~75–80% 1RM.

Intensity: RPE 7.5–8 (If "Technique Week": Drop weight by 15%, do 2 sets only).

Progression: Increase 2.5–5 kg when RPE drops below 7.5.

B. Trap Bar Deadlift

Warm-up: 1×5 @ 55%, 1×2–3 @ 75% of working weight.

Working sets: 3×5 at ~75–80% 1RM.

Intensity: RPE 7.5–8 (If "Technique Week": Drop weight by 15%, do 2 sets only).

Progression: Increase 5 kg when form allows.

C. Overhead Press

Warm-up: 1×10 empty bar, 1×5 @ 60%.

Working sets: 3×5 at ~75–80% 1RM.

Intensity: RPE 7.5–8.

Note: Perform after Squat/Deadlift to keep core fresh for heavy lifts.

3. Accessories

Bulgarian Split Squat: 3×8 per leg (RPE 7–8).

Single-Arm Dumbbell Row: 3×8 per side (RPE 7.5–8).

Side Plank with Top Leg Raise: 3×30 sec per side.

Farmer’s Carry: 3×20m heavy (Grip/Core focus).

4. Cool-Down (5–10 min)

Walk 2 mins, Pigeon pose, Couch stretch, Foam roll quads/glutes.`
        },
        {
            id: 'gym_stability',
            name: 'Strength Training B',
            sport: 'Strength',
            phase: ['all'],
            minDuration: 40,
            structure: {
                warmup: { duration: 10, type: 'mobility' },
                main: { duration: 30, type: 'stability' },
                cooldown: { duration: 5, type: 'stretch' }
            },
            description: `STRENGTH SESSION B – Stability & Endurance
Focus: Injury prevention, joint health, and structural integrity. Frequency: Once per week (ideally day before Long Run/Ride or on easy day).

1. Warm-Up (10 min)

3 minutes easy cardio.

Dynamic mobility: Leg swings, hip circles, ankle rocks.

Activation: Monster walks, bird dog (6/side w/ 3s hold).

2. Main Set

Step-Downs from Box: 3×12 per leg.

Focus: Knee tracking over toe, slow eccentric (lowering) phase.

Single-Leg Romanian Deadlift: 3×12 per leg.

Focus: Hip hinge and balance. Keep back flat.

Wall Sit (Standard or Single-Leg): 3×30 seconds.

Standard: Ball/towel squeeze between knees.

Advanced/Alternative: Lift one foot 2 inches off the ground. Alternate legs halfway or do full sets per leg.

Side-Lying Hip Abductions: 3×15 per leg (with band).

Pallof Press: 3×12 per side (Band or Cable).

Hanging Knee Raises: 3×8–12 reps.

Focus: Control the swing. Curl pelvis up towards ribs.

Progression: Straight leg raises.

3. Cool-Down (5–10 min)

Walk 2 mins, Hip flexor stretch, Glute stretch, Light spinal mobility (cat–cow).`
        }
    ]
};

// ============================================================================
// LIBRARY HELPERS
// ============================================================================

/**
 * Get workouts suitable for a phase and available time
 * @param {string} category - INTERVALS, TEMPO, EASY, LONG, STRENGTH
 * @param {string} phase - Base, Build, Peak, Taper, Race
 * @param {number} availableMinutes - Time available
 * @returns {Array} Suitable workouts, sorted by minDuration descending
 */
function getAvailableWorkouts(category, phase, availableMinutes) {
    const categoryWorkouts = RUNNING_LIBRARY[category];
    if (!categoryWorkouts) return [];

    // Map Taper/Race to Peak for selection purposes (we will scale them later)
    const effectivePhase = (phase === 'Taper' || phase === 'Race') ? 'Peak' : phase;

    return categoryWorkouts
        .filter(w => {
            // Phase check
            const phaseMatch = w.phase.includes('all') || w.phase.includes(effectivePhase);
            // Duration check
            const fitsTime = w.minDuration <= availableMinutes;
            return phaseMatch && fitsTime;
        })
        .sort((a, b) => b.minDuration - a.minDuration); // Prefer longer options
}

/**
 * Select best workout for given constraints
 * @param {string} category - Workout category
 * @param {string} phase - Current training phase
 * @param {number} availableMinutes - Time available
 * @param {Array} excludeIds - IDs to exclude (already used this week)
 * @returns {Object|null} Selected workout or null
 */
function selectWorkout(category, phase, availableMinutes, excludeIds = []) {
    const available = getAvailableWorkouts(category, phase, availableMinutes);
    const filtered = available.filter(w => !excludeIds.includes(w.id));
    return filtered.length > 0 ? filtered[0] : null;
}

/**
 * Build workout with calculated distances based on user paces
 * @param {Object} workout - Workout template
 * @param {number} thresholdPace - User's threshold pace (sec/km)
 * @param {number} targetDuration - Optional override for main set duration
 * @returns {Object} Workout with calculated distances
 */
/**
 * Build workout with calculated distances based on user paces
 * @param {Object} workout - Workout template
 * @param {number} thresholdPace - User's threshold pace (sec/km)
 * @param {number|Object} targetDurationOrOptions - Duration (number) or Options object { duration, scale }
 * @returns {Object} Workout with calculated distances
 */
function buildWorkout(workout, thresholdPace, targetDurationOrOptions = null) {
    const built = JSON.parse(JSON.stringify(workout)); // Deep copy
    const structure = built.structure;

    // Parse Options
    let targetDuration = null;
    let targetDistance = null; // NEW: Target total distance in km
    let scale = 1.0;

    if (typeof targetDurationOrOptions === 'object' && targetDurationOrOptions !== null) {
        targetDuration = targetDurationOrOptions.duration || null;
        targetDistance = targetDurationOrOptions.distance || null; // NEW
        scale = targetDurationOrOptions.scale || 1.0;
    } else {
        targetDuration = targetDurationOrOptions;
    }

    let totalDistance = 0;
    let totalDuration = 0;

    // Skip distance calc for non-running sports
    if (workout.sport === 'Strength') {
        built.totalDuration = getWorkoutDuration(structure);
        built.totalDistance = 0;
        return built;
    }

    // Warmup
    if (structure.warmup?.duration) {
        structure.warmup.distance = calculateDistance(
            structure.warmup.duration,
            structure.warmup.zone || 'Z1',
            thresholdPace
        );
        structure.warmup.pace = getZonePace(structure.warmup.zone || 'Z1', thresholdPace);
        totalDistance += structure.warmup.distance;
        totalDuration += structure.warmup.duration;
    }

    // Main set
    if (structure.main) {
        if (structure.main.duration) {
            // Simple duration-based
            let duration = targetDuration || structure.main.duration;
            // Apply scale
            duration = Math.ceil(duration * scale);

            structure.main.distance = calculateDistance(duration, structure.main.zone, thresholdPace);
            structure.main.pace = getZonePace(structure.main.zone, thresholdPace);
            structure.main.duration = duration;
            totalDistance += structure.main.distance;
            totalDuration += duration;
        } else if (structure.main.reps) {
            // Interval-based
            // Apply scale to REPS
            if (scale < 1.0) {
                structure.main.reps = Math.max(1, Math.ceil(structure.main.reps * scale));
            }
            let repDistance = 0;
            let repDuration = 0;

            if (structure.main.work.distance) {
                repDistance = structure.main.work.distance / 1000; // m to km
                structure.main.work.pace = getZonePace(structure.main.work.zone, thresholdPace);
                repDuration = (structure.main.work.distance / 1000) * structure.main.work.pace / 60;
            } else if (structure.main.work.duration) {
                repDuration = structure.main.work.duration;
                repDistance = calculateDistance(repDuration, structure.main.work.zone, thresholdPace);
                structure.main.work.pace = getZonePace(structure.main.work.zone, thresholdPace);
            }

            const restDuration = structure.main.rest?.duration || 0;
            structure.main.rest.pace = getZonePace(structure.main.rest.zone || 'Z1', thresholdPace);

            structure.main.totalDistance = repDistance * structure.main.reps;
            structure.main.totalDuration = (repDuration + restDuration) * structure.main.reps;

            totalDistance += structure.main.totalDistance;
            totalDuration += structure.main.totalDuration;
        } else if (structure.main.segments) {
            // Progressive/segmented
            structure.main.segments.forEach(seg => {
                if (seg.duration) {
                    seg.distance = calculateDistance(seg.duration, seg.zone, thresholdPace);
                    seg.pace = getZonePace(seg.zone, thresholdPace);
                    totalDistance += seg.distance;
                    totalDuration += seg.duration;
                }
            });
        } else if (structure.main.zone && (targetDuration || targetDistance)) {
            // Fill remaining distance/time (for easy runs and long runs)
            // VOLUME-BASED (Running): If targetDistance is provided, work backwards
            // to ensure total workout distance equals target

            // First, calculate WU+CD distances to subtract from total
            const warmupDist = structure.warmup?.distance || 0;
            const cooldownZone = structure.cooldown?.zone || 'Z1';
            const cooldownDur = structure.cooldown?.duration || 0;
            const cooldownDist = cooldownDur > 0 ? calculateDistance(cooldownDur, cooldownZone, thresholdPace) : 0;
            const wucdDistance = warmupDist + cooldownDist;

            let mainDistance = 0;
            let mainDuration = 0;

            if (targetDistance && targetDistance > wucdDistance) {
                // VOLUME-BASED: Main distance = target - warmup - cooldown
                mainDistance = targetDistance - wucdDistance;
                // Calculate duration from distance: duration(min) = distance(km) * pace(sec/km) / 60
                const mainPace = getZonePace(structure.main.zone, thresholdPace);
                mainDuration = Math.ceil((mainDistance * mainPace) / 60);
            } else if (targetDuration) {
                // DURATION-BASED: Calculate main duration from remaining time
                mainDuration = targetDuration - (structure.warmup?.duration || 0) - (structure.cooldown?.duration || 0);
                mainDistance = calculateDistance(mainDuration, structure.main.zone, thresholdPace);
            }

            structure.main.duration = mainDuration;
            structure.main.distance = mainDistance;
            structure.main.pace = getZonePace(structure.main.zone, thresholdPace);
            totalDistance += structure.main.distance;
            totalDuration += mainDuration;
        }
    }

    // Track warmup+cooldown distance separately for UI display
    let warmupCooldownDistance = 0;

    // Cooldown
    if (structure.cooldown?.duration) {
        structure.cooldown.distance = calculateDistance(
            structure.cooldown.duration,
            structure.cooldown.zone || 'Z1',
            thresholdPace
        );
        structure.cooldown.pace = getZonePace(structure.cooldown.zone || 'Z1', thresholdPace);
        totalDistance += structure.cooldown.distance;
        totalDuration += structure.cooldown.duration;
    }

    // Calculate warmup+cooldown distance for breakdown display
    warmupCooldownDistance = (structure.warmup?.distance || 0) + (structure.cooldown?.distance || 0);

    // Get main set distance (total minus WU/CD)
    const mainDistance = totalDistance - warmupCooldownDistance;

    // Round values
    built.totalDistance = Math.round(totalDistance * 100) / 100;
    built.totalDuration = Math.ceil(totalDuration);

    // NEW: Distance breakdown for UI display
    built.mainDistance = Math.round(mainDistance * 100) / 100;
    built.warmupCooldownDistance = Math.round(warmupCooldownDistance * 100) / 100;

    // [NEW] Generate flat steps array for Intervals.icu
    built.steps = convertStructureToSteps(structure, thresholdPace);

    return built;
}

/**
 * Convert internal structure object to Intervals.icu steps array
 * @param {Object} structure - Workout structure
 * @param {number} thresholdPace - For reference (not heavily used here as we stick to zones/percentages)
 * @returns {Array} Steps array
 */
function convertStructureToSteps(structure, thresholdPace) {
    const steps = [];

    // Helper: Map Zone to Intensity String (Intervals.icu format)
    // The service layer handles "Z1" -> "50-60% Pace" mapping, so we can pass Zone ID directly
    // or we can pre-convert. Pre-converting is safer for "Press Lap".

    // 1. Warmup
    if (structure.warmup) {
        steps.push({
            type: 'Warmup',
            duration: structure.warmup.duration * 60, // sec
            distance: structure.warmup.distance ? structure.warmup.distance * 1000 : undefined, // meters
            intensity: structure.warmup.zone || 'Z1',
            press_lap: true // Usually good to press lap after warmup
        });
    }

    // 2. Main Set
    if (structure.main) {
        if (structure.main.reps) {
            // Interval Set
            const mainSteps = [];

            // Work Step
            const work = structure.main.work;
            mainSteps.push({
                type: 'Run',
                duration: work.duration ? work.duration * 60 : undefined,
                distance: work.distance, // already in meters if valid? No, library uses meters for track, km for others.
                // Wait, library uses `distance` in meters for intervals?
                // Library: `work: { distance: 1000 ... }` -> 1000m.
                // Library: `work: { distance: 800 ... }` -> 800m.
                // It seems library raw structure uses meters for specific distances.
                // Let's pass it as is, or ensure it's meters.
                // calculated `distance` in helper above converts to km for total.
                // But raw structure `work.distance` is what we have here.
                intensity: work.zone,
                press_lap: false // Auto-step in interval usually
            });

            // Rest Step
            const rest = structure.main.rest;
            if (rest) {
                mainSteps.push({
                    type: 'Recover',
                    duration: rest.duration ? rest.duration * 60 : undefined,
                    distance: rest.distance,
                    intensity: rest.zone,
                    press_lap: true // Press lap after recovery/before next rep? Or auto?
                    // Usually Intervals.icu handles "Rep" blocks well.
                    // Let's behave like smart-scheduler: 
                    // { type: 'Recover', duration: ..., press_lap: true }
                });
            }

            steps.push({
                name: structure.main.name || 'Main Set', // Support section headers
                reps: structure.main.reps,
                steps: mainSteps
            });

        } else if (structure.main.segments) {
            // Segments (e.g. Progressive)
            structure.main.segments.forEach((seg, index) => {
                steps.push({
                    type: 'Run',
                    duration: seg.duration ? seg.duration * 60 : undefined,
                    intensity: seg.zone,
                    name: `Segment ${index + 1}`
                });
            });

        } else {
            // Single Block (Steady/Tempo)
            steps.push({
                type: 'Run',
                duration: structure.main.duration ? structure.main.duration * 60 : undefined,
                distance: structure.main.distance ? structure.main.distance * 1000 : undefined,
                intensity: structure.main.zone
            });
        }
    }

    // 3. Cooldown
    if (structure.cooldown) {
        steps.push({
            type: 'Cooldown',
            duration: structure.cooldown.duration * 60,
            intensity: structure.cooldown.zone || 'Z1'
        });
    }

    return steps;
}

// ============================================================================
// EXPORTS
// ============================================================================

window.RUNNING_LIBRARY = RUNNING_LIBRARY;
window.ZONE_DEFINITIONS = ZONE_DEFINITIONS;
window.getZonePace = getZonePace;
window.calculateDistance = calculateDistance;
window.getWorkoutDuration = getWorkoutDuration;
window.getAvailableWorkouts = getAvailableWorkouts;
window.selectWorkout = selectWorkout;
window.buildWorkout = buildWorkout;

console.log('[WorkoutLibrary] Structured library loaded:', {
    intervals: RUNNING_LIBRARY.INTERVALS.length,
    tempo: RUNNING_LIBRARY.TEMPO.length,
    easy: RUNNING_LIBRARY.EASY.length,
    long: RUNNING_LIBRARY.LONG.length,
    strength: RUNNING_LIBRARY.STRENGTH.length
});
