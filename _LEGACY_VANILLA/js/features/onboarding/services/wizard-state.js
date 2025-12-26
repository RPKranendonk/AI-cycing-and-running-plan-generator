// ==========================================
// ONBOARDING WIZARD STATE
// Handles wizard state, navigation, and constants
// ==========================================

/**
 * Onboarding Wizard State
 */
const wizardState = {
    currentStep: 1,
    // Dynamic: 8 steps for Running/Cycling (includes new steps), Summary is step 8
    get totalSteps() {
        // If "Longevity" or "Cycling", we might skip some runner specific steps like LT Pace?
        // Plan says 8 steps. Let's assume 8 for now.
        // Step 5 is LT Pace (Running only). If Cycling, skip step 5?
        // User design didn't explicitly show Cycling Pace, but code for 'Threshold Pace' was labelled "Onboarding: LT Pace".
        // Let's assume 8 for Running, 7 for Cycling/Longevity if we skip Pace.
        return this.data.sport === 'Running' ? 8 : 7;
    },
    data: {
        sport: null, // 'Running', 'Cyclist', 'Longevity'
        experience_level: 'intermediate', // 'beginner', 'intermediate', 'advanced'
        goal: null, // 'faster', 'weight', 'event', 'wellness'
        raceDate: null, // "YYYY-MM-DD"
        trainingGoal: 'event', // 'event' or 'fitness'
        thresholdPace: null, // { min: 0, sec: 0 } or single value? User UI has separate inputs. Storing as object.
        time_preference: 'morning', // 'morning', 'evening'
        avg_session_duration: 45, // minutes
        gymAccess: 'commercial', // 'commercial', 'home', 'none'

        // Legacy/Computed fields needed for generator
        currentVolume: 30,
        startLongRun: 10,
        fitnessContext: 'current',
        startDate: null,
        trainingDays: 4, // Derived from availability?
        weeklySchedule: null,
        apiKey: null,
        athleteId: null
    }
};

/**
 * Default weekly schedules by training days (Monday = day 0)
 */
const DEFAULT_SCHEDULES = {
    3: [
        { day: 0, type: 'Rest', label: 'Rest' },       // Mon (0)
        { day: 1, type: 'Intervals', label: 'Intervals' }, // Tue (1)
        { day: 2, type: 'Rest', label: 'Rest' },       // Wed (2)
        { day: 3, type: 'WeightTraining', label: 'Strength' }, // Thu (3)
        { day: 4, type: 'Easy', label: 'Easy' },       // Fri (4)
        { day: 5, type: 'Rest', label: 'Rest' },       // Sat (5)
        { day: 6, type: 'LongRun', label: 'Long Run' } // Sun (6)
    ],
    4: [
        { day: 0, type: 'Rest', label: 'Rest' },
        { day: 1, type: 'Intervals', label: 'Intervals' },
        { day: 2, type: 'WeightTraining', label: 'Strength' },
        { day: 3, type: 'Easy', label: 'Easy' },
        { day: 4, type: 'Easy', label: 'Easy', secondary: { id: 'WeightTraining', label: 'Strength' } },
        { day: 5, type: 'Rest', label: 'Rest' },
        { day: 6, type: 'LongRun', label: 'Long Run' }
    ],
    5: [
        { day: 0, type: 'Rest', label: 'Rest' },
        { day: 1, type: 'Intervals', label: 'Intervals' },
        { day: 2, type: 'Easy', label: 'Easy', secondary: { id: 'WeightTraining', label: 'Strength' } },
        { day: 3, type: 'Easy', label: 'Easy' },
        { day: 4, type: 'Tempo', label: 'Tempo' },
        { day: 5, type: 'WeightTraining', label: 'Strength' },
        { day: 6, type: 'LongRun', label: 'Long Run' }
    ],
    6: [
        { day: 0, type: 'Easy', label: 'Easy' },
        { day: 1, type: 'Intervals', label: 'Intervals' },
        { day: 2, type: 'Easy', label: 'Easy', secondary: { id: 'WeightTraining', label: 'Strength' } },
        { day: 3, type: 'Easy', label: 'Easy' },
        { day: 4, type: 'Tempo', label: 'Tempo' },
        { day: 5, type: 'WeightTraining', label: 'Strength' },
        { day: 6, type: 'LongRun', label: 'Long Run' }
    ]
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TYPE_ICONS = {
    'LongRun': '🏃‍♂️',
    'Intervals': '⚡',
    'Tempo': '🔥',
    'Easy': '🌿',
    'WeightTraining': '💪',
    'Yoga': '🧘',
    'Rest': '😴',
    'Ride': '🚴'
};

const TYPE_COLORS = {
    'LongRun': 'from-orange-500/30 to-orange-600/20 border-orange-500/40',
    'Intervals': 'from-red-500/30 to-red-600/20 border-red-500/40',
    'Tempo': 'from-amber-500/30 to-amber-600/20 border-amber-500/40',
    'Easy': 'from-emerald-500/30 to-emerald-600/20 border-emerald-500/40',
    'WeightTraining': 'from-purple-500/30 to-purple-600/20 border-purple-500/40',
    'Yoga': 'from-teal-500/30 to-teal-600/20 border-teal-500/40',
    'Rest': 'from-slate-600/30 to-slate-700/20 border-slate-500/40',
    'Ride': 'from-blue-500/30 to-blue-600/20 border-blue-500/40'
};

/**
 * Navigation Helpers
 */

function wizardNext() {
    const nextStep = wizardState.currentStep + 1;
    if (nextStep <= wizardState.totalSteps) {
        if (typeof window.renderWizardStep === 'function') {
            window.renderWizardStep(nextStep);
        }
    }
}

function wizardBack() {
    const prevStep = wizardState.currentStep - 1;
    if (prevStep >= 1) {
        if (typeof window.renderWizardStep === 'function') {
            window.renderWizardStep(prevStep);
        }
    }
}

function skipWizard() {
    const wizard = document.getElementById('quick-setup-wizard');
    if (wizard) wizard.remove();
}

/**
 * Date Helpers
 */

function getNextMonday(fromDate) {
    const date = new Date(fromDate);
    const day = date.getDay();
    const diff = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
    date.setDate(date.getDate() + diff);
    return date;
}

function formatDateLocal(dateStr) {
    if (!dateStr) return 'Not set';
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// --- EXPOSE TO WINDOW ---
window.wizardState = wizardState;
window.DEFAULT_SCHEDULES = DEFAULT_SCHEDULES;
window.DAY_NAMES = DAY_NAMES;
window.TYPE_ICONS = TYPE_ICONS;
window.TYPE_COLORS = TYPE_COLORS;
window.wizardNext = wizardNext;
window.wizardBack = wizardBack;
window.skipWizard = skipWizard;
window.getNextMonday = getNextMonday;
window.formatDateLocal = formatDateLocal;
window.formatDateForInput = formatDateForInput;

window.OnboardingState = {
    wizardState,
    DEFAULT_SCHEDULES,
    DAY_NAMES,
    TYPE_ICONS,
    TYPE_COLORS,
    wizardNext,
    wizardBack,
    skipWizard,
    getNextMonday,
    formatDateLocal,
    formatDateForInput
};
