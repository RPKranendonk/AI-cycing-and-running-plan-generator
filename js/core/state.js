// ==========================================
// APPLICATION STATE
// Centralized state management
// ==========================================

const TODAY = new Date();
let START_DATE = new Date(TODAY);

/**
 * Application state object
 * Contains all shared state across the application
 */
let state = {
    // API Keys & Provider
    apiKey: localStorage.getItem('elite_apiKey') || '',
    athleteName: localStorage.getItem('elite_athleteName') || '',
    aiApiKey: localStorage.getItem('elite_aiApiKey') || '',
    geminiApiKey: localStorage.getItem('elite_geminiApiKey') || '',
    deepseekApiKey: localStorage.getItem('elite_deepseekApiKey') || '',
    openRouterApiKey: localStorage.getItem('elite_openRouterApiKey') || '',
    mistralApiKey: localStorage.getItem('elite_mistralApiKey') || '',
    aiProvider: localStorage.getItem('elite_aiProvider') || 'openai',
    athleteId: localStorage.getItem('elite_athleteId') || '0',

    // Athlete Profile
    trainingHistory: localStorage.getItem('elite_trainingHistory') || '',
    injuries: localStorage.getItem('elite_injuries') || '',
    gymAccess: localStorage.getItem('elite_gymAccess') || 'none',
    gender: localStorage.getItem('elite_gender') || 'N/A',
    athleteAge: localStorage.getItem('elite_athleteAge') || '',
    trainingPreferences: localStorage.getItem('elite_trainingPreferences') || '',
    currentFitness: localStorage.getItem('elite_currentFitness') || '',

    // Fitness Metrics
    lthrPace: localStorage.getItem('elite_lthrPace') || '',
    lthrBpm: localStorage.getItem('elite_lthrBpm') || '',
    ftp: localStorage.getItem('elite_ftp') || '',

    // Goals & Dates
    raceDate: localStorage.getItem('elite_raceDate') || '2026-04-12',
    goalTime: localStorage.getItem('elite_goalTime') || '',
    rampFactor: parseFloat(localStorage.getItem('elite_rampFactor')) || 1.10,

    // Sport Type
    sportType: localStorage.getItem('elite_sportType') || 'Running',

    // Data from Intervals.icu
    wellness: [],
    activities: [],
    zones: null,
    zonePcts: { z2: "Z2 Pace", z3: "Z3 Pace", z5: "Z5 Pace" },
    fetchedZones: null,
    thresholdSpeed: null,

    // Plan State
    modifications: {},
    selectedWorkout: null,
    generatedPlan: [],
    progressionRate: parseFloat(localStorage.getItem('elite_progressionRate')) || 0.10,
    lastWeekLongRun: 0,

    // Availability
    defaultAvailableDays: JSON.parse(localStorage.getItem('elite_defaultDays') || '[1,3,5,0]'),
    longRunDay: parseInt(localStorage.getItem('elite_longRunDay') || '0'),
    weeklyAvailability: JSON.parse(localStorage.getItem('elite_weeklyAvail') || '{}'),

    // Daily Availability (hours per day with split AM/PM support)
    dailyAvailability: JSON.parse(localStorage.getItem('elite_dailyAvail') || JSON.stringify({
        0: { hours: 3.0, split: false, amHours: 3.0, pmHours: 0 },  // Sunday
        1: { hours: 1.5, split: false, amHours: 1.5, pmHours: 0 },  // Monday
        2: { hours: 1.5, split: false, amHours: 1.5, pmHours: 0 },  // Tuesday
        3: { hours: 1.5, split: false, amHours: 1.5, pmHours: 0 },  // Wednesday
        4: { hours: 1.5, split: false, amHours: 1.5, pmHours: 0 },  // Thursday
        5: { hours: 1.0, split: false, amHours: 1.0, pmHours: 0 },  // Friday
        6: { hours: 2.0, split: false, amHours: 2.0, pmHours: 0 }   // Saturday
    })),

    // Generated Workouts
    generatedWorkouts: {},

    // Weekly Notes (AI-generated training notes for each week)
    weeklyNotes: {},

    // Custom Week Overrides
    customRestWeeks: [],
    forceBuildWeeks: []
};

// Load modifications from localStorage
try {
    state.modifications = JSON.parse(localStorage.getItem('elite_plan_mods') || '{}');
} catch (e) {
    state.modifications = {};
    localStorage.setItem('elite_plan_mods', '{}');
}

/**
 * Helper function to safely get a value from state
 * @param {string} key - The state key
 * @param {*} defaultVal - Default value if not found
 * @returns {*} The state value or default
 */
function getStateValue(key, defaultVal = null) {
    return state[key] !== undefined ? state[key] : defaultVal;
}

/**
 * Helper function to update state and optionally persist to localStorage
 * @param {string} key - The state key
 * @param {*} value - The new value
 * @param {boolean} persist - Whether to save to localStorage
 */
function setStateValue(key, value, persist = false) {
    state[key] = value;
    if (persist) {
        const storageKey = `elite_${key}`;
        if (typeof value === 'object') {
            localStorage.setItem(storageKey, JSON.stringify(value));
        } else {
            localStorage.setItem(storageKey, value);
        }
    }
}

// Expose to window
window.state = state;
window.TODAY = TODAY;
window.START_DATE = START_DATE;
window.getStateValue = getStateValue;
window.setStateValue = setStateValue;
