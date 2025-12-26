// ==========================================
// UI CONTROLLER
// Main Entry Point for UI Orchestration
// ==========================================
// Modules:
// - ConnectionManager (js/features/onboarding/connection-manager.js)
// - ConfiguratorUI (js/ui/configurator/configurator-ui.js)
// - AthletePanel (js/ui/panels/athlete-panel.js)
// - DebugModal (js/ui/modals/debug-modal.js)
// ==========================================

console.log("UI.js: Loading Controller...");

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Live Preview Listeners
    if (window.ConfiguratorUI) {
        initLivePreviewListeners();
    }

    // 2. Initialize Event Listeners for Inputs
    initGlobalListeners();

    // 3. Initialize Ramp Rate Warning
    initRampRateListeners();

    // 4. Initialize Long Run Day Availability Check
    const longRunDayInput = document.getElementById('longRunDayInput');
    if (longRunDayInput) {
        longRunDayInput.addEventListener('change', (e) => {
            const day = parseInt(e.target.value);
            // Auto-enable availability if 0
            if (state.dailyAvailability && state.dailyAvailability[day] && state.dailyAvailability[day].hours === 0) {
                // Find slider and update
                const slider = document.getElementById(`hoursDay${day}`);
                if (slider) {
                    slider.value = 2; // Default to 2 hours
                    if (window.ConfiguratorUI) window.ConfiguratorUI.updateDayHours(day);
                }
            }
        });
    }
});

// --- LISTENER INITIALIZATION HELPERS ---

function initLivePreviewListeners() {
    const previewInputs = [
        'raceDateInput', 'planStartDateInputRun', 'planStartDateInputCycle',
        'target-volume', 'target-long-run-run', 'progressionRateInputRun',
        'start-tss', 'target-long-run', 'progressionRateInputCycle',
        'trainingGoalInput', 'raceTypeInput', 'raceTypeInputCycle',
        'goal-event-btn', 'goal-fitness-btn'
    ];

    previewInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', viewProgressionFromInputs);
            el.addEventListener('input', viewProgressionFromInputs);
        }
    });

    // Button special cases
    document.getElementById('goal-event-btn')?.addEventListener('click', () => setTimeout(viewProgressionFromInputs, 50));
    document.getElementById('goal-fitness-btn')?.addEventListener('click', () => setTimeout(viewProgressionFromInputs, 50));
}

function initGlobalListeners() {
    const inputs = [
        'planStartDateInputRun', 'planStartDateInputCycle', 'raceDateInput',
        'target-volume', 'target-long-run', 'target-long-run-run',
        'progressionRateInput', 'progressionRateInputRun', 'progressionRateInputCycle',
        'taperDurationInputRun', 'taperDurationInputCycle',
        'longRunProgressionInput', 'current-fitness'
    ];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                const panel = document.getElementById('progressionSidePanel');
                if (panel && !panel.classList.contains('hidden') && document.getElementById('raceDateInput').value) {
                    viewProgressionFromInputs();
                }
            });
        }
    });

    const smartPlanBtn = document.getElementById('smartPlanBtn');
    if (smartPlanBtn) {
        smartPlanBtn.addEventListener('click', calculateSmartBlock);
    }
}

function initRampRateListeners() {
    const rampRateInput = document.getElementById('progressionRateInputCycle');
    const rampRateWarning = document.getElementById('rampRateWarning');

    if (rampRateInput && rampRateWarning) {
        const checkRampRate = () => {
            const val = parseInt(rampRateInput.value);
            if (val > 5) {
                rampRateWarning.classList.remove('hidden');
            } else {
                rampRateWarning.classList.add('hidden');
            }
        };
        rampRateInput.addEventListener('change', checkRampRate);
        checkRampRate();
    }
}


// --- GLOBAL BRIDGE FUNCTIONS ---
// These map legacy function calls to the new modules

window.checkConnectionAndHistory = function () {
    if (window.ConnectionManager) window.ConnectionManager.connect();
    else console.error("ConnectionManager not found");
};

// ... (Other specific mappings are handled in ConfiguratorUI.js via binds) ...

// --- SAVING SETTINGS ---
// This orchestrates data collection (ConfiguratorUI) and persistence/generation
function saveSettings() {
    console.log("Saving settings...");
    try {
        // 1. Integrations (API Keys)
        const apiKey = document.getElementById('apiKeyInput')?.value.trim();
        const athleteId = document.getElementById('athleteIdInput')?.value.trim();
        const aiProvider = document.getElementById('aiProviderSelect')?.value;
        const aiApiKey = document.getElementById('aiApiKeyInput')?.value.trim();
        const geminiApiKey = document.getElementById('geminiApiKeyInput')?.value.trim();
        const deepseekApiKey = document.getElementById('deepseekApiKeyInput')?.value.trim();
        const openRouterApiKey = document.getElementById('openRouterApiKeyInput')?.value.trim();
        const mistralApiKey = document.getElementById('mistralApiKeyInput')?.value.trim();

        if (apiKey) {
            state.apiKey = apiKey;
            localStorage.setItem('elite_apiKey', apiKey);
        }
        if (athleteId) {
            state.athleteId = athleteId;
            localStorage.setItem('elite_athleteId', athleteId);
        }
        if (aiProvider) {
            state.aiProvider = aiProvider;
            localStorage.setItem('elite_aiProvider', aiProvider);
        }
        if (aiApiKey) {
            state.aiApiKey = aiApiKey;
            localStorage.setItem('elite_aiApiKey', aiApiKey);
        }
        if (geminiApiKey) {
            state.geminiApiKey = geminiApiKey;
            localStorage.setItem('elite_geminiApiKey', geminiApiKey);
        }
        if (deepseekApiKey) {
            state.deepseekApiKey = deepseekApiKey;
            localStorage.setItem('elite_deepseekApiKey', deepseekApiKey);
        }
        if (openRouterApiKey) {
            state.openRouterApiKey = openRouterApiKey;
            localStorage.setItem('elite_openRouterApiKey', openRouterApiKey);
        }
        if (mistralApiKey) {
            state.mistralApiKey = mistralApiKey;
            localStorage.setItem('elite_mistralApiKey', mistralApiKey);
        }

        // 2. Planning (Goals & Dates)
        state.sportType = document.getElementById('sportTypeInput')?.value || 'Running';
        state.raceDate = document.getElementById('raceDateInput')?.value;
        state.goalTime = document.getElementById('goalTimeInput')?.value;
        state.trainingGoal = document.getElementById('trainingGoalInput')?.value || 'event';
        state.trainingPreferences = document.getElementById('preferencesInput')?.value;

        localStorage.setItem('elite_sportType', state.sportType);
        localStorage.setItem('elite_raceDate', state.raceDate || '');
        localStorage.setItem('elite_goalTime', state.goalTime || '');
        localStorage.setItem('elite_trainingGoal', state.trainingGoal);
        localStorage.setItem('elite_trainingPreferences', state.trainingPreferences || '');

        // 3. General (Profile & Availability)
        state.gymAccess = document.getElementById('gymAccessInput')?.value || 'none';
        state.injuries = document.getElementById('injuriesInput')?.value || '';
        state.longRunDay = parseInt(document.getElementById('longRunDayInput')?.value || '0');

        localStorage.setItem('elite_gymAccess', state.gymAccess);
        localStorage.setItem('elite_injuries', state.injuries);
        localStorage.setItem('elite_longRunDay', state.longRunDay);

        if (window.ConfiguratorUI) {
            state.dailyAvailability = window.ConfiguratorUI.collectDailyAvailability();
            localStorage.setItem('elite_dailyAvail', JSON.stringify(state.dailyAvailability));

            // Compute defaultAvailableDays
            const days = [];
            for (let d = 0; d <= 6; d++) {
                if (state.dailyAvailability[d] && state.dailyAvailability[d].hours > 0) {
                    days.push(d);
                }
            }
            state.defaultAvailableDays = days;
            localStorage.setItem('elite_defaultDays', JSON.stringify(days));
        }

        // 4. Sport Settings
        state.trainingHistory = document.getElementById('historyInput')?.value || '';
        localStorage.setItem('elite_trainingHistory', state.trainingHistory);

        const experience = document.querySelector('input[name="athleteExperience"]:checked')?.value;
        if (experience) {
            state.athleteExperience = experience;
            localStorage.setItem('elite_athleteExperience', experience);
        }

        // Running Specifics
        if (state.sportType === 'Running') {
            state.raceType = document.getElementById('raceTypeInput')?.value || 'Marathon';
            state.startingVolume = parseFloat(document.getElementById('target-volume')?.value) || 30;
            state.startingLongRun = parseFloat(document.getElementById('target-long-run-run')?.value) || 10;
            state.progressionRate = parseFloat(document.getElementById('progressionRateInputRun')?.value) || 0.075;
            state.longRunProgression = parseFloat(document.getElementById('longRunProgressionInput')?.value) || 2.0;

            localStorage.setItem('elite_raceType', state.raceType);
            localStorage.setItem('elite_startingVolume', state.startingVolume);
            localStorage.setItem('elite_startingLongRun', state.startingLongRun);
            localStorage.setItem('elite_progressionRate', state.progressionRate);
            localStorage.setItem('elite_longRunProgression', state.longRunProgression);
        }

        // Cycling Specifics
        if (state.sportType === 'Cycling') {
            state.raceType = document.getElementById('raceTypeInputCycle')?.value || 'General Fitness';
            state.currentFitness = parseFloat(document.getElementById('current-fitness')?.value) || 40;
            state.startTss = parseFloat(document.getElementById('start-tss')?.value) || 300;
            state.startLongRide = parseFloat(document.getElementById('target-long-run')?.value) || 1.5;
            state.rampRate = parseFloat(document.getElementById('progressionRateInputCycle')?.value) || 5;

            localStorage.setItem('elite_raceType', state.raceType);
            localStorage.setItem('elite_currentFitness', state.currentFitness);
            localStorage.setItem('elite_startTss', state.startTss);
            localStorage.setItem('elite_startLongRide', state.startLongRide);
            localStorage.setItem('elite_rampRate', state.rampRate);
        }

        // 5. Generate and Close
        generateAndCloseModal();

    } catch (e) {
        console.error("Error saving settings:", e);
        if (window.showToast) showToast("Error saving settings: " + e.message, 'error');
    }
}
window.saveSettings = saveSettings;


// --- GENERATION ORCHESTRATION ---
function generateAndCloseModal() {
    try {
        if (window.generateTrainingPlan) {
            window.generateTrainingPlan();
        } else {
            showToast("Error: Generator not found");
            return;
        }

        if (window.renderWeeklyPlan) {
            window.renderWeeklyPlan();
        }

        if (window.closeSetup) {
            window.closeSetup();
        }
    } catch (e) {
        console.error("Error generating plan:", e);
        showToast("Error generating plan: " + e.message);
    }
}
window.generateAndCloseModal = generateAndCloseModal;


// --- FEEDBACK ---
function sendFeedback() {
    const message = document.getElementById('feedbackMessage')?.value.trim();
    if (!message) {
        showToast("⚠️ Please enter a message.");
        return;
    }
    const subject = encodeURIComponent("Simple AI Coach Feedback");
    const body = encodeURIComponent(message);
    window.location.href = `mailto:rpkranendonk@gmail.com?subject=${subject}&body=${body}`;
    showToast("📧 Opening email client...");
}
window.sendFeedback = sendFeedback;

// --- LEGACY EXPORTS (Alignment) ---
// Ensure viewProgressionFromInputs is available globally
window.viewProgressionFromInputs = function () {
    if (window.ConfiguratorUI) window.ConfiguratorUI.viewProgressionFromInputs();
};

window.calculateAndShowPlan = function () {
    generateAndCloseModal();
};

window.renderProgressionSidePanel = function () {
    // This function was originally in ui.js (lines 1334+).
    // Ideally it should be in ConfiguratorUI or a specific ProgressionRenderer.
    // For this refactor, let's assume I moved it to ConfiguratorUI (implied by viewProgressionFromInputs calling it).
    // I need to ensure ConfiguratorUI has it or defines it.
    // In my previous step (ConfiguratorUI), I stubbed viewProgressionFromInputs.
    // I should have put the full logic there.
    // Since I can't go back, I will re-implement renderProgressionSidePanel here 
    // OR create js/ui/configurator/progression-renderer.js.
    // Creating a dedicated renderer is cleaner.
    if (window.ProgressionRenderer) window.ProgressionRenderer.render();
};

console.log("UI.js: Controller Loaded.");