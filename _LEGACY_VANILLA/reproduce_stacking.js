
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ==========================================
// MOCK ENVIRONMENT
// ==========================================
const mockBuildWorkout = (template, pace, options) => ({ ...template, totalDuration: 3600, totalDistance: template.totalDistance || 5, id: template.id || 'mock_id' });
const mockSelectWorkout = (category) => ({ id: 'mock_workout', totalDistance: 8 });
const mockCalculateDistance = (min) => min / 6;

const windowMock = {
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
    },
    PHASES: { BASE: 'Base', BUILD: 'Build', RECOVERY: 'Recovery', PEAK: 'Peak', TAPER: 'Taper', RACE: 'Race' },
    RUNNING_LIBRARY: {
        LONG: [{ id: 'long_run', totalDistance: 15 }],
        EASY: [{ id: 'easy_run', totalDistance: 5 }],
        STRENGTH: [{ id: 'gym_strength', totalDuration: 45 }],
        INTERVALS: [{ id: 'intervals', totalDistance: 8 }],
        TEMPO: [{ id: 'tempo', totalDistance: 8 }]
    },
    DurationService: {
        calculateDurationForWorkout: (type, dist) => dist * 300,
    },
    UIConstants: {
        getWorkoutTitle: (id) => id
    },
    buildWorkout: mockBuildWorkout,
    selectWorkout: mockSelectWorkout,
    calculateDistance: mockCalculateDistance
};

const context = vm.createContext({
    window: windowMock,
    console: console,
    Math: Math,
    Date: Date,
    buildWorkout: mockBuildWorkout,
    selectWorkout: mockSelectWorkout,
    calculateDistance: mockCalculateDistance,
    RUNNING_LIBRARY: windowMock.RUNNING_LIBRARY,
    WORKOUT_TYPES: windowMock.WORKOUT_TYPES,
    PHASES: windowMock.PHASES
});

const BASE_DIR = '/Users/rkrane/.gemini/antigravity/Simple_AI_coach';
function loadScript(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    vm.runInContext(code, context);
}

loadScript(path.join(BASE_DIR, 'js/core/deterministic-scheduler.js'));

const buildWeekSchedule = context.window.buildWeekSchedule;

console.log('--- TEST: HARD DAY STACKING ---');

// Scenario: Key Workout on Tuesday (Day 2).
// Availability: 
// - Tue: 2 hours (Enough for Intervals + Strength?)
// - Thu: 2 hours (Also Key)
const weekData = {
    targetVolume: 55,
    longRunDistance: 17,
    phase: 'Build', // Triggers Intervals
    gymTarget: 2,
    weekNumber: 1
};

// Availability allow stacking on Tue (2) and Thu (4)
const availability = { 0: 2, 1: 1, 2: 2, 3: 1, 4: 2, 5: 0, 6: 0 };

console.log('Generating Schedule...');
const result = buildWeekSchedule(weekData, availability);

let stackedCount = 0;
let badStackingCount = 0; // Gym before Intervals

result.schedule.forEach(day => {
    const isGym = day.type === 'WeightTraining' || day.secondary?.sport === 'Strength' || day.secondary?.id === 'WeightTraining' || day.type === 'Easy + Strength';
    const isKey = day.priority === 'KEY' && day.type !== 'LongRun';
    const isLongRun = day.type === 'LongRun';

    let label = `Day ${day.day} (${day.type})`;
    if (day.secondary) label += ` + ${day.secondary.id || day.secondary.sport}`;

    // Check Next Day for Bad Stacking
    const nextDay = result.schedule[(day.day + 1) % 7];
    const nextIsKey = nextDay.priority === 'KEY' && nextDay.type !== 'LongRun';

    if (isGym && isKey) {
        console.log(`${label} -> ✅ STACKED (Strength on Key Day)`);
        stackedCount++;
    } else if (isGym && nextIsKey) {
        console.log(`${label} -> ❌ BAD STACK (Strength day before Key Day)`);
        badStackingCount++;
    } else if (isGym && isLongRun) {
        console.log(`${label} -> ❌ BAD STACK (Strength on Long Run)`);
        badStackingCount++;
    } else if (isGym) {
        console.log(`${label} -> Spread (Normal)`);
    } else {
        // console.log(`${label}`);
    }
});

console.log(`\nTotal Stacked: ${stackedCount}`);
console.log(`Total Bad Placements: ${badStackingCount}`);

// Count actual Key Days in schedule
const totalKeyDays = result.schedule.filter(d => d.priority === 'KEY' && d.type !== 'LongRun').length;
console.log(`Total Key Days found: ${totalKeyDays}`);

if (stackedCount === totalKeyDays && badStackingCount === 0) {
    console.log('PASS: Hard Day Stacking achieved (All Key Days have Strength).');
} else {
    console.log('FAIL: Stacking criteria not met.');
}
