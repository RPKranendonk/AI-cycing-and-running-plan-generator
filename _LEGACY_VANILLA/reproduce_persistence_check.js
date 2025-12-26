
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock dependencies
const window = {
    WORKOUT_TYPES: { WEIGHT_TRAINING: 'WeightTraining' },
    PHASES: { BASE: 'Base', BUILD: 'Build', PEAK: 'Peak', TAPER: 'Taper', RACE: 'Race', RECOVERY: 'Recovery' },
    UIConstants: { getWorkoutTitle: (id) => id },
    WorkoutBuilder: {
        buildStrengthDescription: () => 'Strength Description',
        calculateAccurateDuration: (type, dist) => dist * 300,
        buildWorkoutSteps: () => []
    },
    DurationService: {
        calculateDurationForWorkout: () => 3600
    },
    state: {
        zones: { ltPaceSecPerKm: 300 }
    }
};

const context = vm.createContext({
    window: window,
    console: console,
    Math: Math,
    Date: Date,
    parseInt: parseInt,
    parseFloat: parseFloat
});

function loadScript(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, context);
}

const BASE_DIR = '/Users/rkrane/.gemini/antigravity/Simple_AI_coach';

// Load Converter
loadScript(path.join(BASE_DIR, 'js/features/weekly-plan/services/TemplateConverter.js'));

// Test Data: 
// Day 0: Intervals + Neural Power (Stacked)
// Day 2: Stability (Primary)
const template = new Array(7).fill(null).map((_, i) => ({
    day: i,
    type: i === 0 ? 'Intervals' : null,
    distance: i === 0 ? 10 : 0,
    secondary: i === 0 ? { id: 'gym_neural', name: 'Strength Training A', sport: 'Strength' } : null,
    // Day 2: Primary Stability
    ...(i === 2 ? {
        type: 'WeightTraining',
        workout: { id: 'gym_stability', name: 'Strength Training B', sport: 'Strength' }
    } : {})
}));

const weekData = { startDate: '2025-01-01', phaseName: 'Base' };
const appState = { sportType: 'Running' };

// Run Conversion
const workouts = context.window.TemplateConverter.convert(0, template, weekData, appState);

console.log(`Generated ${workouts.length} workouts.`);

// Verify Neural
const neural = workouts.find(w => w.type === 'WeightTraining' && w.dayIndex === 0);
if (neural && neural.title === 'Strength Training A') {
    console.log('✅ PASSED: Neural Power (Stacked) found with correct title.');
} else {
    console.log(`❌ FAILED: Neural Power (Stacked) mismatch. Title: ${neural?.title}`);
}

// Verify Stability
const stability = workouts.find(w => w.type === 'WeightTraining' && w.dayIndex === 2);
if (stability && stability.title === 'Strength Training B') {
    console.log('✅ PASSED: Stability (Primary) found with correct title.');
} else {
    console.log(`❌ FAILED: Stability (Primary) mismatch. Title: ${stability?.title}`);
}

if (!neural || neural.title !== 'Strength Training A' || !stability || stability.title !== 'Strength Training B') process.exit(1);
