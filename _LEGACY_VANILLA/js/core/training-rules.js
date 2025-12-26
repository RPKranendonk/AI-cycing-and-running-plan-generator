// ==========================================
// TRAINING RULES ENGINE
// Centralized, sport-specific rule definitions
// ==========================================

/**
 * Training Rules by Sport
 * All durations in SECONDS for consistency with workout data
 */
const TRAINING_RULES = {
    Running: {
        // Minimum session durations (seconds)
        minSessionDuration: 35 * 60,      // 35 minutes
        minLongRunDuration: 60 * 60,      // 1 hour
        minRecoveryDuration: 20 * 60,     // 20 min (shakeout only)

        // Gym limits by phase
        maxGymPerWeek: {
            Base: 2,
            "Base/Build": 2,
            Build: 2,
            Peak: 1,
            Taper: 0,
            Race: 0
        },

        // Recovery rules
        restAfterLongRun: true,           // Day after Long Run = Rest/Easy
        hardDayBuffer: 48 * 60 * 60,      // 48 hours between hard sessions

        // Volume constraints
        volumeUnit: "km",
        volumeTolerance: 0.03,            // ±3% of target
        minVolPerSession: 5,              // Minimum 5km per run (avoid junk miles)

        // SAFETY RAIL: Max weekly volume caps (prevent exponential growth)
        maxWeeklyVolume: {
            "Marathon": 120,
            "Half Marathon": 80,
            "10k": 60,
            "5k": 50,
            "General Fitness": 70
        },

        // SAFETY RAIL: Long run cannot exceed this ratio of weekly volume
        longRunMaxRatio: 0.50,

        // Intensity distribution (Scientific 3-Zone)
        // P0 DEFERRED v2: Not currently enforced by scheduler.
        // WARNING: Documentation says low=pyramidal, high=polarized but this is reversed.
        // Will implement as "intensity minutes budget" constraint in v2.
        /*
        intensityModel: {
            low: { Z1: 0.80, Z2: 0.00, Z3: 0.20 },      // Polarized (>7h/week)
            medium: { Z1: 0.65, Z2: 0.25, Z3: 0.10 },   // Hybrid (4-7h/week)
            high: { Z1: 0.50, Z2: 0.40, Z3: 0.10 }      // Pyramidal (<4h/week)
        },
        */

        // Long Run caps by race type
        maxLongRun: {
            "Marathon": 36,
            "Half Marathon": 22,
            "10k": 16,
            "5k": 12,
            "General Fitness": 20
        }
    },

    Cycling: {
        // Minimum session durations (seconds)
        minSessionDuration: 45 * 60,      // 45 minutes
        minLongRideDuration: 90 * 60,     // 1.5 hours
        minRecoveryDuration: 30 * 60,     // 30 min recovery spin

        // Gym limits by phase
        maxGymPerWeek: {
            Base: 2,
            "Base/Build": 2,
            Build: 2,
            Peak: 1,
            Taper: 0,
            Race: 0
        },

        // Recovery rules
        restAfterLongRun: true,
        hardDayBuffer: 48 * 60 * 60,

        // Volume constraints
        volumeUnit: "TSS",
        volumeTolerance: 0.05,            // ±5% of target (TSS harder to hit exactly)
        minVolPerSession: 30,             // Minimum 30 TSS per session

        // SAFETY RAIL: Max weekly TSS (prevent impossible loads)
        maxWeeklyTSS: 1200,

        // SAFETY RAIL: Max TSS per hour (realistic IF limit ~0.80)
        maxTssPerHour: 75,

        // Intensity distribution
        intensityModel: {
            low: { Z1: 0.80, Z2: 0.00, Z3: 0.20 },
            medium: { Z1: 0.70, Z2: 0.20, Z3: 0.10 },
            high: { Z1: 0.50, Z2: 0.40, Z3: 0.10 }
        },

        // Long Ride caps by race type (hours)
        maxLongRide: {
            "Century": 6,
            "Gran Fondo": 5,
            "Crit": 2,
            "General Fitness": 3
        }
    },

    Gym: {
        minSessionDuration: 30 * 60,      // 30 minutes
        maxSessionDuration: 75 * 60,      // 75 minutes (diminishing returns)
    },

    // Common rules (apply to all sports)
    Common: {
        warmupDuration: 10 * 60,          // 10 min standard warmup
        cooldownDuration: 5 * 60,         // 5 min standard cooldown
        minRestDaysPerWeek: 1,            // At least 1 full rest
        maxRestDaysPerWeek: 3,            // Don't rest too much
        recoveryWeekVolumeFactor: 0.60,   // 60% of normal volume

        // Scheduler robustness constants (Dec 2024)
        minLongRunSlotHours: 1.5,         // Minimum slot for Long Run (psychological benefit)
        defaultEasyPace: 6.0,             // Fallback pace in min/km if no user data
        hardDayBufferHours: 48,           // Hours between KEY sessions

        // Stress budget thresholds
        stressBudgetThresholds: {
            lowVolume: 30,                // km/week - only 1 KEY allowed
            mediumVolume: 50,             // km/week - 2 KEYs but downgrade 2nd
            highVolume: 70                // km/week - full 2 KEYs
        },

        // Long Run Ratio: Formula-Based (Marathon Valve)
        // Baseline: ratio = 0.45 - ((volume - 30) * 0.0025)
        longRunFormula: {
            baseVolume: 30,           // Starting point (km)
            baseRatio: 0.45,          // Starting ratio at 30km
            decayRate: 0.0025,        // Ratio decrease per km above 30
            absoluteCeiling: 0.50,    // Max ratio for Base/Build
            absoluteFloor: 0.20       // Min ratio (never go below)
        },

        // Peak Phase Exceptions (Marathon Valve)
        peakExceptions: {
            marathon: { maxRatio: 0.60, minFloor: 28 },   // 60%, min 28km
            halfMarathon: { maxRatio: 0.55, minFloor: 16 }, // 55%, min 16km
            recovery: { maxRatio: 0.40 }  // Recovery weeks capped at 40%
        },

        // High Ratio Rule: If LR > 50% of volume
        highRatioThreshold: 0.50  // Triggers polarized week rules
    }
};

/**
 * Get rules for a specific sport
 * @param {string} sport - "Running", "Cycling", etc.
 * @returns {Object} Rules object with Common merged in
 */
function getTrainingRules(sport) {
    const sportRules = TRAINING_RULES[sport] || TRAINING_RULES.Running;
    return {
        ...TRAINING_RULES.Common,
        ...sportRules,
        gym: TRAINING_RULES.Gym
    };
}

/**
 * Get minimum duration for a workout type
 * @param {string} sport - Sport type
 * @param {string} workoutType - "Run", "Ride", "Gym", "LongRun"
 * @returns {number} Duration in seconds
 */
function getMinDuration(sport, workoutType) {
    const rules = getTrainingRules(sport);

    switch (workoutType.toLowerCase()) {
        case 'longrun':
        case 'long run':
        case 'long ride':
            return sport === 'Cycling' ? rules.minLongRideDuration : rules.minLongRunDuration;
        case 'recovery':
        case 'shakeout':
            return rules.minRecoveryDuration || 20 * 60;
        case 'gym':
        case 'strength':
            return rules.gym.minSessionDuration;
        default:
            return rules.minSessionDuration;
    }
}

/**
 * Get max gym sessions for a phase
 * @param {string} sport - Sport type
 * @param {string} phase - Phase name (Base, Build, Peak, Taper, Race)
 * @returns {number} Max gym sessions per week
 */
function getMaxGymForPhase(sport, phase) {
    const rules = getTrainingRules(sport);
    // Normalize phase name
    const normalizedPhase = Object.keys(rules.maxGymPerWeek).find(
        p => phase.toLowerCase().includes(p.toLowerCase())
    );
    return rules.maxGymPerWeek[normalizedPhase] || 2;
}

/**
 * Convert rules to human-readable format for AI prompt
 * @param {string} sport - Sport type
 * @returns {string} Formatted rules string
 */
function formatRulesForPrompt(sport) {
    const rules = getTrainingRules(sport);
    const minSession = Math.round(rules.minSessionDuration / 60);
    const minGym = Math.round(rules.gym.minSessionDuration / 60);

    return `
## MINIMUM DURATION RULES (ENFORCED BY SYSTEM)
- **${sport}:** Minimum ${minSession} minutes per session.
  - *Exception:* "Shakeout/Recovery" (20 min) allowed only day before race.
- **Gym:** Minimum ${minGym} minutes.
- **Warmup:** ${Math.round(rules.warmupDuration / 60)} minutes standard.
- **Cooldown:** ${Math.round(rules.cooldownDuration / 60)} minutes standard.

## GYM SESSION LIMITS (ENFORCED BY SYSTEM)
- Base/Build: Max ${rules.maxGymPerWeek.Build} sessions/week
- Peak: Max ${rules.maxGymPerWeek.Peak} session/week
- Taper/Race: ${rules.maxGymPerWeek.Taper} sessions
`;
}

// Expose to window
window.TRAINING_RULES = TRAINING_RULES;
window.getTrainingRules = getTrainingRules;
window.getMinDuration = getMinDuration;
window.getMaxGymForPhase = getMaxGymForPhase;
window.formatRulesForPrompt = formatRulesForPrompt;
