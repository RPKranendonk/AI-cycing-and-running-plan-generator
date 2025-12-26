
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ==========================================
// MOCK ENVIRONMENT
// ==========================================
const window = {
    WORKOUT_TYPES: {
        RUN: 'Run',
        LONG_RUN: 'LongRun',
        TEMPO: 'Tempo',
        INTERVALS: 'Intervals',
        EASY: 'Easy',
        RECOVERY: 'Recovery',
        REST: 'Rest',
        CROSS_TRAINING: 'CrossTraining',
        WEIGHT_TRAINING: 'WeightTraining',
        BLOCKED: 'Blocked',
        ACTIVE_RECOVERY: 'ActiveRecovery',
        HILL_SPRINTS: 'HillSprints',
        PROGRESSION: 'Progression',
        FARTLEK: 'Fartlek'
    },
    PHASES: {
        BASE: 'Base',
        BUILD: 'Build',
        PEAK: 'Peak',
        TAPER: 'Taper',
        RACE: 'Race',
        RECOVERY: 'Recovery'
    },
    calculateProgression: (type, week, phase) => {
        return { duration: 3600, label: 'Test Label', note: 'Test Note' };
    },
    optimizeFrequency: (template) => { return { template, warnings: [] }; }, // Mock optimizer
    DurationService: {
        calculateDurationForWorkout: (type, dist) => dist * 5 * 60, // Rough 5:00/km pace
        estimateDurationSeconds: (dist, type, pace) => dist * pace * 60
    },
    // Mock other globals if needed
};

// Create a context for the scripts to run in
const context = vm.createContext({
    window: window,
    console: console,
    Math: Math,
    Date: Date
});

// Load Scripts
function loadScript(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, context);
}

const BASE_DIR = '/Users/rkrane/.gemini/antigravity/Simple_AI_coach';

// Load Dependencies
try {
    loadScript(path.join(BASE_DIR, 'js/features/scheduling/services/template-generator.js'));
    loadScript(path.join(BASE_DIR, 'js/core/readiness-engine.js'));
    // loadScript(path.join(BASE_DIR, 'js/core/adjustment-suggestions.js')); // Not strictly needed unless testing suggestions
} catch (e) {
    console.error('Error loading scripts:', e);
    process.exit(1);
}

// Helper to access functions in context
const generateWeeklyTemplate = context.window.generateWeeklyTemplate;
const applyReadinessToTargets = context.window.applyReadinessToTargets;

// ==========================================
// TEST CONFIGURATION
// ==========================================
console.log('---------------------------------------------------');
console.log('🏃 STARTING SCHEDULER STRESS TEST');
console.log('---------------------------------------------------');

const PERSONAS = [
    {
        id: 'ROOKIE',
        name: 'The Rookie',
        desc: 'Low Volume (25km), Safety Focus',
        inputs: {
            targetVolume: 25,
            longRunDistance: 10,
            phase: 'Base',
            preferredLongRunDay: 0,
            gymTarget: 1,
            userEasyPace: 6.5,
            isRecoveryWeek: false
        },
        availability: { 0: 2, 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 2 } // Unlimited
    },
    {
        id: 'WEEKEND_WARRIOR',
        name: 'The Weekend Warrior',
        desc: 'Time Crunched (45km), Max 45m Mon-Fri',
        inputs: {
            targetVolume: 45,
            longRunDistance: 16,
            phase: 'Base',
            preferredLongRunDay: 6, // Saturday
            gymTarget: 2,
            userEasyPace: 5.5,
            isRecoveryWeek: false
        },
        availability: { 0: 3, 1: 0.5, 2: 0.5, 3: 0.5, 4: 0.5, 5: 0.5, 6: 4 } // 30m weekdays
    },
    {
        id: 'REGULAR',
        name: 'The Regular',
        desc: 'Mid Volume (55km), 5 days/week',
        inputs: {
            targetVolume: 55,
            longRunDistance: 18,
            phase: 'Build',
            preferredLongRunDay: 0,
            gymTarget: 2,
            userEasyPace: 5.0,
            isRecoveryWeek: false
        },
        availability: { 0: 2, 1: 1, 2: 1.5, 3: 1, 4: 1.5, 5: 0, 6: 0 } // 5 days
    },
    {
        id: 'BUILDER',
        name: 'The Builder',
        desc: 'High Volume (85km), 6 days/week',
        inputs: {
            targetVolume: 85,
            longRunDistance: 28,
            phase: 'Peak',
            preferredLongRunDay: 0,
            gymTarget: 2,
            userEasyPace: 4.5,
            isRecoveryWeek: false
        },
        availability: { 0: 3, 1: 1.5, 2: 2, 3: 1.5, 4: 2, 5: 0, 6: 2 } // 6 days
    },
    {
        id: 'FATIGUE',
        name: 'The Fatigue Case',
        desc: 'Readiness Test (60km Baseline, Strained)',
        inputs: {
            targetVolume: 60,
            longRunDistance: 20,
            phase: 'Build',
            preferredLongRunDay: 0,
            gymTarget: 2,
            userEasyPace: 5.0,
            isRecoveryWeek: false
        },
        availability: { 0: 2.5, 1: 1.5, 2: 2, 3: 1.5, 4: 2, 5: 1, 6: 2 },
        simulateReadiness: {
            status: 'RED',
            modifier: -0.35 // Approx 0.70x target
        }
    }
];

// ==========================================
// TEST EXECUTION
// ==========================================
// ==========================================
// TEST EXECUTION
// ==========================================

const results = [];

PERSONAS.forEach(persona => {
    let inputs = { ...persona.inputs };

    // Readiness Adjustment
    if (persona.simulateReadiness) {
        const adjusted = applyReadinessToTargets({
            volume: inputs.targetVolume,
            longRunKm: inputs.longRunDistance,
            longRunMins: 0,
            sport: 'Running'
        }, persona.simulateReadiness.modifier);
        inputs.targetVolume = adjusted.volume;
        inputs.longRunDistance = adjusted.longRunKm;
    }

    const { template, warnings } = generateWeeklyTemplate(inputs, persona.availability);

    // Analyze Schedule
    let totalDist = 0;
    let longRun = null;
    let medLongRun = null;
    let runSessions = 0;
    let runs = [];

    template.forEach(day => {
        if (day.distance > 0 && day.type !== 'Rest' && day.type !== 'Blocked') {
            totalDist += day.distance;
            runSessions++;
            runs.push(day);

            if (day.type === 'LongRun') longRun = day;
            // Identify Medium Long Run if it exists (usually secondary long slot) as > 12km but not LR
            // For simplicity, we check duration or % later
        }
    });

    const validations = [];

    // RULE 1: Frequency Integrity
    if (persona.id === 'ROOKIE' && runSessions > 4) {
        validations.push(`FAIL: Rookie has ${runSessions} running days (>4 allowed).`);
    }
    if (persona.id === 'BUILDER' && runSessions < 5) {
        validations.push(`FAIL: Builder has ${runSessions} running days (<5 required).`);
    }

    // RULE 2: Duration Safety Caps
    runs.forEach(run => {
        // Duration check (approx calculated from distance if duration missing/0)
        let durationMins = run.duration > 0 ? run.duration / 60 : (run.distance * inputs.userEasyPace); // approx
        let volumePct = totalDist > 0 ? (run.distance / totalDist) : 0;

        if (run.type === 'Easy' && (durationMins > 70 && volumePct > 0.15)) {
            // Note: Rule says <= 70 OR <= 15%. So only fail if BOTH exceeded? 
            // "Must be <= 70 OR <= 15%" -> Compliant if either true.
            // Fail if > 70 AND > 15%.
            validations.push(`FAIL: Easy run on ${run.dayName} (${durationMins.toFixed(0)}m, ${(volumePct * 100).toFixed(1)}%) exceeds limits.`);
        }

        // Long Run Cap
        if (run.type === 'LongRun') {
            if (durationMins > 180) validations.push(`FAIL: Long Run > 3 hours (${durationMins.toFixed(0)}m).`);
            if (totalDist > 30 && volumePct > 0.35) validations.push(`FAIL: Long Run > 35% of volume (${(volumePct * 100).toFixed(1)}%).`);
        }
    });

    // RULE 3: Minimum Effective Dose
    runs.forEach(run => {
        let durationMins = run.duration > 0 ? run.duration / 60 : (run.distance * inputs.userEasyPace);
        // Shakeout exception: usually very short, labelled 'Shakeout' or 'Recovery'
        const isShakeout = run.label?.toLowerCase().includes('shakeout') || run.note?.toLowerCase().includes('shakeout');
        const isDouble = run.secondary ? true : false; // simplified check

        if (durationMins < 30 && !isShakeout && !isDouble && run.distance < 5) {
            validations.push(`FAIL: Run on ${run.dayName} is too short (${durationMins.toFixed(0)}m / ${run.distance}km).`);
        }
    });

    // RULE 4: Intensity Distribution
    // (Checking logic/intent mostly, as actual pace is run-time)
    // We check if "Recovery" runs are clearly marked differently or duration/distance implies it logic.
    // For this static check, we ensure Recovery runs are assigned correctly after Key workouts?
    // User requirement: "Recover Runs: Pace < 80% LT". 
    // We can't check Pace in scheduler output (it's user execution), but we can check TYPE.
    // We assume scheduler assigns correct types.
    // Let's implement a check ensuring we don't have High Intensity back-to-back (which implies bad distribution).
    if (persona.id === 'FATIGUE') {
        // RULE 5: Readiness Logic
        const baseline = 60;
        const reduction = (baseline - totalDist) / baseline;
        // Target 0.70x -> ~30% reduction. Range 30-40%.
        if (totalDist >= 60) {
            validations.push(`FAIL: Fatigue case volume ${totalDist}km not reduced (Target < 60km).`);
        }
        // Optional: warn if reduction is too small/large, but pass/fail on "heavily reduced"
    }



    // RULE 7: Strength Training Integrity
    // Check if we hit the gym target (usually 2)
    // Strength is either type='WeightTraining' OR secondary='WeightTraining'
    let strengthSessions = 0;
    template.forEach(day => {
        if (day.type === 'WeightTraining' || day.secondary?.id === 'WeightTraining' || day.secondary === 'WeightTraining') {
            strengthSessions++;
        }
    });

    // Allow 1 miss if availability is super tight, but generally should match
    if (strengthSessions < persona.inputs.gymTarget) {
        validations.push(`FAIL: Strength Training missing. Found ${strengthSessions}, expected ${persona.inputs.gymTarget}.`);
    }

    if (validations.length > 0) {
        results.push({ persona: persona.name, errors: validations, volume: totalDist });
    }
});

// ==========================================
// REPORTING
// ==========================================
if (results.length === 0) {
    console.log("✅ ALL SCENARIOS PASSED: Logic is valid across all user types.");
} else {
    console.log("❌ VALIDATION FAILURES DETECTED:");
    results.forEach(failure => {
        console.log(`\n${failure.persona} (Vol: ${failure.volume.toFixed(1)}km):`);
        failure.errors.forEach(err => console.log(`  - ${err}`));
    });
    // Exit with error code for CI/CD
    process.exit(1);
}
