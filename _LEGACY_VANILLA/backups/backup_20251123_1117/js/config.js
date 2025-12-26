// --- STATE & CONFIG ---
const TODAY = new Date();
let START_DATE = new Date(TODAY);

let state = {
    apiKey: localStorage.getItem('elite_apiKey') || '3k65dka97nooel671y9gv1m3b',
    athleteName: localStorage.getItem('elite_athleteName') || '',
    aiApiKey: localStorage.getItem('elite_aiApiKey') || '',
    geminiApiKey: localStorage.getItem('elite_geminiApiKey') || '',
    aiProvider: localStorage.getItem('elite_aiProvider') || 'openai',
    athleteId: localStorage.getItem('elite_athleteId') || '0',
    // Profile
    trainingHistory: localStorage.getItem('elite_trainingHistory') || '',
    injuries: localStorage.getItem('elite_injuries') || '',
    gymAccess: localStorage.getItem('elite_gymAccess') || 'none',
    trainingPreferences: localStorage.getItem('elite_trainingPreferences') || '',

    lthrPace: localStorage.getItem('elite_lthrPace') || '',
    lthrBpm: localStorage.getItem('elite_lthrBpm') || '',
    raceDate: localStorage.getItem('elite_raceDate') || '2026-04-12',
    goalTime: localStorage.getItem('elite_goalTime') || '',
    rampFactor: parseFloat(localStorage.getItem('elite_rampFactor')) || 1.10,
    wellness: [], activities: [], zones: null,
    zonePcts: { z2: "Z2 Pace", z3: "Z3 Pace", z5: "Z5 Pace" }, // Defaults
    fetchedZones: null,
    thresholdSpeed: null,
    modifications: JSON.parse(localStorage.getItem('elite_plan_mods') || '{ }'),
    selectedWorkout: null,
    generatedPlan: [],
    progressionRate: parseFloat(localStorage.getItem('elite_progressionRate')) || 0.10,
    lastWeekLongRun: 0,
    defaultAvailableDays: JSON.parse(localStorage.getItem('elite_defaultDays') || '[1,3,5,0]'), // Mon, Wed, Fri, Sun
    longRunDay: parseInt(localStorage.getItem('elite_longRunDay') || '0'), // Sunday
    weeklyAvailability: JSON.parse(localStorage.getItem('elite_weeklyAvail') || '{}') // Per-week overrides
};

try { state.modifications = JSON.parse(localStorage.getItem('elite_plan_mods') || '{}'); }
catch (e) { state.modifications = {}; localStorage.setItem('elite_plan_mods', '{ }'); }

const STRENGTH_A = `STRENGTH SESSION A – Neural Power\nWarm-Up (10–12 min)\n• 3min Cardio\n• Dynamic mobility (swings, rocks)\n• Activation (clamshells, glute bridge)\n\nMain Lifts\n• Overhead Press: 4x5 @ RPE 8\n• High-Bar Back Squat: 4x6 @ RPE 8\n• Trap Bar Deadlift: 4x5 @ RPE 8\n\nAccessories\n• Bulgarian Split Squat: 3x8/leg\n• SA Row: 3x8/side\n• Side Plank: 3x30s\n• Farmer’s Carry: 3x20m`;
const STRENGTH_B = `STRENGTH SESSION B – Stability\nWarm-Up (10 min)\n• 3min Cardio\n• Leg swings, monster walks\n\nMain Work\n• Box Step-Downs: 3x12/leg\n• SL RDL: 3x12/leg\n• Wall Sit w/ Squeeze: 3x30s\n• Side-Lying Abductions: 3x15/leg\n• Pallof Press: 3x12/side\n• Bird Dog: 3x6 (3s hold)`;
