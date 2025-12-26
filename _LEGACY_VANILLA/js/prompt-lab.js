// ==========================================
// PROMPT LAB - Developer Testing Harness
// Rapid AI prompt iteration with preset scenarios
// ==========================================

/**
 * Test Scenarios for Prompt Lab
 * Each scenario represents a different athlete archetype
 */
const PROMPT_LAB_SCENARIOS = {
    'beginner-runner': {
        name: 'Beginner Runner',
        description: '10K goal, new to structured training',
        sportType: 'Running',
        raceType: '10k',
        goalTime: '0:55:00',
        lthrPace: '6:00',  // LT pace in min/km
        lthrBpm: '165',
        trainingHistory: 'New to structured running, occasional 5K parkruns',
        injuries: 'None',
        gymAccess: 'basic',
        experience: 'fresh_start',
        currentFitness: 'Beginner runner, can run 5K comfortably',
        // Time-crunched availability
        dailyAvailability: {
            0: { hours: 3.0, split: false, amHours: 1.5, pmHours: 1.5 },  // Sunday - long run
            1: { hours: 1.0, split: false, amHours: 0.5, pmHours: 0.5 },  // Monday
            2: { hours: 1.0, split: true, amHours: 0.5, pmHours: 0.5 },   // Tuesday - can split
            3: { hours: 0.0, split: false, amHours: 0, pmHours: 0 },      // Wednesday - rest
            4: { hours: 1.0, split: true, amHours: 0.5, pmHours: 0.5 },   // Thursday - can split
            5: { hours: 0.5, split: false, amHours: 0.5, pmHours: 0 },    // Friday - easy
            6: { hours: 2.0, split: false, amHours: 2.0, pmHours: 0 }     // Saturday
        },
        longRunDay: 0,  // Sunday
        weeksOut: 12
    },

    'sub3-marathoner': {
        name: 'Sub-3 Marathoner',
        description: 'Marathon < 3:00, advanced runner',
        sportType: 'Running',
        raceType: 'Marathon',
        goalTime: '2:55:00',
        lthrPace: '4:15',  // Fast LT pace
        lthrBpm: '175',
        trainingHistory: 'Multiple marathons, PB 3:12. Consistent 60-80km weeks.',
        injuries: 'Previous Achilles issue, fully recovered',
        gymAccess: 'full',
        experience: 'high_performance',
        currentFitness: 'Strong aerobic base, recent half marathon in 1:25',
        // Time-crunched but can double
        dailyAvailability: {
            0: { hours: 3.0, split: false, amHours: 3.0, pmHours: 0 },    // Sunday - long run
            1: { hours: 1.5, split: true, amHours: 0.75, pmHours: 0.75 }, // Monday - doubles
            2: { hours: 1.5, split: true, amHours: 0.75, pmHours: 0.75 }, // Tuesday
            3: { hours: 1.0, split: false, amHours: 1.0, pmHours: 0 },    // Wednesday
            4: { hours: 1.5, split: true, amHours: 0.75, pmHours: 0.75 }, // Thursday
            5: { hours: 0.5, split: false, amHours: 0.5, pmHours: 0 },    // Friday - easy
            6: { hours: 2.5, split: false, amHours: 2.5, pmHours: 0 }     // Saturday
        },
        longRunDay: 0,  // Sunday
        weeksOut: 16
    },

    'beginner-cyclist': {
        name: 'Beginner Cyclist',
        description: 'Century ride goal, building base',
        sportType: 'Cycling',
        raceType: 'Gran Fondo',
        goalTime: '6:00:00',
        ftp: '180',
        lthrBpm: '160',
        trainingHistory: 'Casual weekend rides, new to indoor training',
        injuries: 'None',
        gymAccess: 'basic',
        experience: 'fresh_start',
        currentFitness: 'Can ride 50km at easy pace',
        // Time-crunched, weekends available
        dailyAvailability: {
            0: { hours: 3.5, split: false, amHours: 3.5, pmHours: 0 },    // Sunday - long ride
            1: { hours: 1.0, split: false, amHours: 1.0, pmHours: 0 },    // Monday
            2: { hours: 1.0, split: true, amHours: 0.5, pmHours: 0.5 },   // Tuesday
            3: { hours: 0.0, split: false, amHours: 0, pmHours: 0 },      // Wednesday - rest
            4: { hours: 1.0, split: true, amHours: 0.5, pmHours: 0.5 },   // Thursday
            5: { hours: 0.5, split: false, amHours: 0.5, pmHours: 0 },    // Friday
            6: { hours: 3.0, split: false, amHours: 3.0, pmHours: 0 }     // Saturday
        },
        longRunDay: 0,  // Sunday for long ride
        weeksOut: 14
    },

    'tt-champion': {
        name: 'TT Champion',
        description: 'Time trial racer, elite FTP',
        sportType: 'Cycling',
        raceType: 'Time Trial',
        goalTime: '0:55:00',  // 40km TT
        ftp: '320',
        lthrBpm: '178',
        trainingHistory: 'Cat 2 racer, 10+ years cycling, multiple TT wins',
        injuries: 'Lower back tightness from TT position',
        gymAccess: 'full',
        experience: 'high_performance',
        currentFitness: 'Peak form, recent FTP test confirmed 320W',
        // Time-crunched pro schedule
        dailyAvailability: {
            0: { hours: 4.0, split: false, amHours: 4.0, pmHours: 0 },    // Sunday - long ride
            1: { hours: 1.5, split: true, amHours: 0.75, pmHours: 0.75 }, // Monday
            2: { hours: 2.0, split: true, amHours: 1.0, pmHours: 1.0 },   // Tuesday - key workout
            3: { hours: 1.0, split: false, amHours: 1.0, pmHours: 0 },    // Wednesday - recovery
            4: { hours: 2.0, split: true, amHours: 1.0, pmHours: 1.0 },   // Thursday - key workout
            5: { hours: 0.5, split: false, amHours: 0.5, pmHours: 0 },    // Friday - easy spin
            6: { hours: 3.0, split: false, amHours: 3.0, pmHours: 0 }     // Saturday
        },
        longRunDay: 0,  // Sunday
        weeksOut: 12
    }
};

// Prompt Lab State
let promptLabState = {
    currentScenario: null,
    lastPrompt: '',
    lastResponse: '',
    lastParsedWorkouts: [],
    isExecuting: false
};

/**
 * Initialize Prompt Lab
 */
function initPromptLab() {
    console.log('[PromptLab] Initializing...');

    // Check if we should show prompt lab
    if (window.location.hash === '#prompt-lab') {
        showPromptLab();
    }

    // Listen for hash changes
    window.addEventListener('hashchange', () => {
        if (window.location.hash === '#prompt-lab') {
            showPromptLab();
        } else {
            hidePromptLab();
        }
    });

    // Pre-configure API keys for dev mode
    if (!state.apiKey) {
        state.apiKey = '3k65dka97nooel671y9gv1m3b';
        state.athleteId = 'i11395';
    }
    if (!state.mistralApiKey) {
        state.mistralApiKey = '12IO6Hhdos7HDsS93NBok2GIV0QJvEHl';
    }
    if (!state.geminiApiKey) {
        state.geminiApiKey = 'AIzaSyDVsmcps5-YE9dlRd3j6KAQx2bjMIUQo6Q';
    }

    console.log('[PromptLab] Ready. Navigate to #prompt-lab to open.');
}

/**
 * Show the Prompt Lab panel
 */
function showPromptLab() {
    const lab = document.getElementById('promptLabPanel');
    if (lab) {
        lab.classList.remove('hidden');
        lab.classList.add('flex');
        // Hide main content
        document.getElementById('planContainer')?.classList.add('hidden');
        document.getElementById('emptyStateContainer')?.classList.add('hidden');
    }
}

/**
 * Hide the Prompt Lab panel
 */
function hidePromptLab() {
    const lab = document.getElementById('promptLabPanel');
    if (lab) {
        lab.classList.add('hidden');
        lab.classList.remove('flex');
        // Show main content
        document.getElementById('planContainer')?.classList.remove('hidden');
    }
}

/**
 * Load a scenario into the application state
 */
function loadScenario(scenarioKey) {
    const scenario = PROMPT_LAB_SCENARIOS[scenarioKey];
    if (!scenario) {
        console.error('[PromptLab] Unknown scenario:', scenarioKey);
        return;
    }

    console.log('[PromptLab] Loading scenario:', scenario.name);
    promptLabState.currentScenario = scenarioKey;

    // Calculate race date based on weeksOut
    const raceDate = new Date();
    raceDate.setDate(raceDate.getDate() + (scenario.weeksOut * 7));
    const raceDateStr = raceDate.toISOString().split('T')[0];

    // Calculate plan start date (next Monday)
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    const planStartDate = new Date(today);
    planStartDate.setDate(today.getDate() + daysUntilMonday);
    const planStartStr = planStartDate.toISOString().split('T')[0];

    // Update state
    state.sportType = scenario.sportType;
    state.raceDate = raceDateStr;
    state.goalTime = scenario.goalTime;
    state.trainingHistory = scenario.trainingHistory;
    state.injuries = scenario.injuries;
    state.gymAccess = scenario.gymAccess;
    state.currentFitness = scenario.currentFitness;
    state.dailyAvailability = scenario.dailyAvailability;
    state.longRunDay = scenario.longRunDay;

    // Sport-specific
    if (scenario.sportType === 'Running') {
        state.lthrPace = scenario.lthrPace;
        state.lthrBpm = scenario.lthrBpm;
        // Update raceType in relevant input if exists
        const raceTypeInput = document.getElementById('raceTypeInput');
        if (raceTypeInput) raceTypeInput.value = scenario.raceType;
    } else if (scenario.sportType === 'Cycling') {
        state.ftp = scenario.ftp;
        state.lthrBpm = scenario.lthrBpm;
    }

    // Update plan start date inputs
    const runStartInput = document.getElementById('planStartDateInputRun');
    const cycleStartInput = document.getElementById('planStartDateInputCycle');
    if (runStartInput) runStartInput.value = planStartStr;
    if (cycleStartInput) cycleStartInput.value = planStartStr;

    // Update race date input
    const raceDateInput = document.getElementById('raceDateInput');
    if (raceDateInput) raceDateInput.value = raceDateStr;

    // Update UI display
    updateLabScenarioDisplay(scenario);

    // Generate training plan based on scenario
    if (window.generateTrainingPlan) {
        generateTrainingPlan();
        console.log('[PromptLab] Training plan generated for scenario');
    }

    showToast(`✅ Loaded: ${scenario.name}`);
}

/**
 * Update the Lab UI with scenario details
 */
function updateLabScenarioDisplay(scenario) {
    const descEl = document.getElementById('labScenarioDesc');
    if (descEl) {
        descEl.innerHTML = `
            <div class="text-sm font-bold text-white mb-1">${scenario.name}</div>
            <div class="text-xs text-slate-400">${scenario.description}</div>
            <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
                <div><span class="text-slate-500">Sport:</span> <span class="text-cyan-400">${scenario.sportType}</span></div>
                <div><span class="text-slate-500">Goal:</span> <span class="text-cyan-400">${scenario.goalTime}</span></div>
                ${scenario.sportType === 'Running'
                ? `<div><span class="text-slate-500">LT Pace:</span> <span class="text-cyan-400">${scenario.lthrPace}/km</span></div>`
                : `<div><span class="text-slate-500">FTP:</span> <span class="text-cyan-400">${scenario.ftp}W</span></div>`
            }
                <div><span class="text-slate-500">Race:</span> <span class="text-cyan-400">${scenario.weeksOut} weeks</span></div>
            </div>
        `;
    }
}

/**
 * Generate and display the AI prompt for review
 */
async function generateLabPrompt() {
    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        showToast('⚠️ Generate a training plan first');
        return;
    }

    console.log('[PromptLab] Generating prompt preview...');

    // Get week 0 (first week) for testing
    const weekIndex = 0;
    const week = state.generatedPlan[weekIndex];

    // Build the prompt using existing function
    const prompt = buildAIWorkoutPrompt({
        scope: 'week',
        weeks: [week],
        sportType: state.sportType,
        ltRunningPace: state.lthrPace,
        lthrBpm: state.lthrBpm,
        ftp: state.ftp,
        history: state.trainingHistory,
        injuries: state.injuries,
        gymAccess: state.gymAccess,
        weeklyAvailability: state.weeklyAvailability,
        goalAssessment: null,
        progressionHistory: [],
        lastWeekSummary: null
    });

    promptLabState.lastPrompt = prompt;

    // Display in UI
    const promptPreview = document.getElementById('labPromptPreview');
    if (promptPreview) {
        promptPreview.textContent = prompt;
    }

    // Update character count
    const charCount = document.getElementById('labPromptCharCount');
    if (charCount) {
        charCount.textContent = `${prompt.length.toLocaleString()} chars`;
    }

    console.log('[PromptLab] Prompt generated:', prompt.length, 'chars');
    return prompt;
}

/**
 * Execute AI call and display response
 */
async function executeLabAI() {
    if (promptLabState.isExecuting) {
        showToast('⚠️ Already executing...');
        return;
    }

    const provider = document.getElementById('labAiProvider')?.value || 'mistral';
    console.log('[PromptLab] Executing AI call with provider:', provider);

    // Generate prompt if not already
    if (!promptLabState.lastPrompt) {
        await generateLabPrompt();
    }

    promptLabState.isExecuting = true;
    updateLabStatus('Calling AI...', 'loading');

    try {
        let response;

        if (provider === 'mistral') {
            response = await callMistralAPI(promptLabState.lastPrompt, [0]);
        } else if (provider === 'gemini') {
            response = await callGeminiAPI(promptLabState.lastPrompt, [0]);
        } else {
            throw new Error('Unknown provider: ' + provider);
        }

        promptLabState.lastResponse = response;

        // Display response
        const responseEl = document.getElementById('labAiResponse');
        if (responseEl) {
            responseEl.textContent = response;
        }

        // Parse the response
        const parsedData = await processAIResponse(response, [0], true);
        promptLabState.lastParsedWorkouts = parsedData?.workouts || [];

        updateLabStatus('✅ Response received', 'success');
        console.log('[PromptLab] AI response received:', response.length, 'chars');

    } catch (error) {
        console.error('[PromptLab] AI call failed:', error);
        updateLabStatus('❌ Error: ' + error.message, 'error');

        const responseEl = document.getElementById('labAiResponse');
        if (responseEl) {
            responseEl.textContent = 'ERROR: ' + error.message;
        }
    } finally {
        promptLabState.isExecuting = false;
    }
}

/**
 * Push generated workouts to Intervals.icu
 */
async function pushLabWorkouts() {
    if (!promptLabState.lastParsedWorkouts || promptLabState.lastParsedWorkouts.length === 0) {
        showToast('⚠️ No workouts to push. Generate first.');
        return;
    }

    console.log('[PromptLab] Pushing workouts to Intervals.icu...');
    updateLabStatus('Pushing to Intervals.icu...', 'loading');

    try {
        // Use existing push function
        await pushWorkoutsToIntervals(promptLabState.lastParsedWorkouts);
        updateLabStatus('✅ Pushed to Intervals.icu', 'success');
        showToast('✅ Workouts pushed to Intervals.icu');
    } catch (error) {
        console.error('[PromptLab] Push failed:', error);
        updateLabStatus('❌ Push failed: ' + error.message, 'error');
    }
}

/**
 * Delete recent workouts from Intervals.icu (cleanup)
 */
async function clearLabWorkouts() {
    console.log('[PromptLab] Clearing workouts from Intervals.icu...');
    updateLabStatus('Deleting workouts...', 'loading');

    try {
        // Calculate date range (next 4 weeks from today)
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 28);

        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        // Fetch existing events
        const response = await fetch(
            `https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${startStr}&newest=${endStr}`,
            {
                headers: {
                    'Authorization': 'Basic ' + btoa('API_KEY:' + state.apiKey)
                }
            }
        );

        if (!response.ok) throw new Error('Failed to fetch events');

        const events = await response.json();
        const workoutEvents = events.filter(e => e.category === 'WORKOUT');

        console.log(`[PromptLab] Found ${workoutEvents.length} workouts to delete`);

        if (workoutEvents.length === 0) {
            updateLabStatus('No workouts to delete', 'success');
            return;
        }

        // Delete each workout
        for (const event of workoutEvents) {
            await fetch(
                `https://intervals.icu/api/v1/athlete/${state.athleteId}/events/${event.id}`,
                {
                    method: 'DELETE',
                    headers: {
                        'Authorization': 'Basic ' + btoa('API_KEY:' + state.apiKey)
                    }
                }
            );
        }

        updateLabStatus(`✅ Deleted ${workoutEvents.length} workouts`, 'success');
        showToast(`🗑️ Deleted ${workoutEvents.length} workouts`);

    } catch (error) {
        console.error('[PromptLab] Clear failed:', error);
        updateLabStatus('❌ Clear failed: ' + error.message, 'error');
    }
}

/**
 * Update status indicator in Lab UI
 */
function updateLabStatus(message, type = 'info') {
    const statusEl = document.getElementById('labStatus');
    if (!statusEl) return;

    const colors = {
        info: 'text-slate-400',
        loading: 'text-yellow-400',
        success: 'text-emerald-400',
        error: 'text-red-400'
    };

    statusEl.className = `text-xs ${colors[type] || colors.info}`;
    statusEl.textContent = message;
}

/**
 * Copy prompt to clipboard
 */
function copyLabPrompt() {
    if (promptLabState.lastPrompt) {
        navigator.clipboard.writeText(promptLabState.lastPrompt);
        showToast('📋 Prompt copied to clipboard');
    }
}

/**
 * Copy response to clipboard
 */
function copyLabResponse() {
    if (promptLabState.lastResponse) {
        navigator.clipboard.writeText(promptLabState.lastResponse);
        showToast('📋 Response copied to clipboard');
    }
}

/**
 * Toggle Prompt Lab Visibility
 */
function togglePromptLab() {
    // Feature Gating
    if (window.PaymentService && !window.PaymentService.guardFeature('Prompt Lab')) return;

    const lab = document.getElementById('promptLabPanel');
    if (lab && lab.classList.contains('hidden')) {
        showPromptLab();
    } else {
        hidePromptLab();
    }
}

/**
 * Push Manual Builder Workout
 */
async function pushBuilderWorkout() {
    if (!state.apiKey || !state.athleteId) {
        showToast("⚠️ Connect to Intervals.icu first!");
        return;
    }

    const type = document.getElementById('builderType').value;
    const color = document.getElementById('builderColor').value;
    const duration = document.getElementById('builderDuration').value;
    const desc = document.getElementById('builderDescription').value;
    const notes = document.getElementById('builderNotes').value;

    showToast("Pushing manually...");

    console.log("[PromptLab] Builder Inputs:", { type, color, duration, desc, notes });

    // Construct Event
    const today = new Date().toISOString().split('T')[0];

    // Determine Sport Settings ID
    let sportSettingsId = null;
    if (type === 'WeightTraining' && state.sportSettingsIdStrength) sportSettingsId = state.sportSettingsIdStrength;
    if (type === 'Ride' && state.sportSettingsIdRide) sportSettingsId = state.sportSettingsIdRide;
    if (type === 'Run' && state.sportSettingsIdRun) sportSettingsId = state.sportSettingsIdRun;
    if (type === 'Yoga' && state.sportSettingsIdYoga) sportSettingsId = state.sportSettingsIdYoga;
    if (type === 'Swim' && state.sportSettingsIdSwim) sportSettingsId = state.sportSettingsIdSwim;
    if (type === 'Rowing' && state.sportSettingsIdRowing) sportSettingsId = state.sportSettingsIdRowing;
    if (type === 'RockClimbing' && state.sportSettingsIdRockClimbing) sportSettingsId = state.sportSettingsIdRockClimbing;

    // Map Colors to Hex
    const colorMap = {
        "Green": "#2ecc71",
        "Red": "#e74c3c",
        "Blue": "#3498db",
        "Yellow": "#f1c40f",
        "Purple": "#9b59b6",
        "Orange": "#e67e22",
        "Teal": "#1abc9c",
        "Pink": "#e91e63",
        "Grey": "#95a5a6"
    };

    let finalColor = color;
    if (colorMap[color]) {
        finalColor = colorMap[color];
    }

    const event = {
        category: "WORKOUT",
        start_date_local: `${today}T12:00:00`,
        type: type,
        name: `${type} Builder Session`,
        description: desc + (notes ? `\n\n📝 NOTES:\n${notes}` : ""),
        color: finalColor, // Use mapped color
        moving_time: parseInt(duration) * 60,
        icua_id: state.athleteId
    };

    if (sportSettingsId) event.sport_settings_id = sportSettingsId;

    try {
        const response = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`API_KEY:${state.apiKey}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
        });

        if (response.ok) {
            showToast("✅ Workout Pushed to Today!");
        } else {
            console.error(await response.text());
            showToast("❌ Push Failed (check console)");
        }
    } catch (e) {
        showToast("❌ Error: " + e.message);
    }
}

// Expose to window
window.PROMPT_LAB_SCENARIOS = PROMPT_LAB_SCENARIOS;
window.promptLabState = promptLabState;
window.initPromptLab = initPromptLab;
window.showPromptLab = showPromptLab;
window.hidePromptLab = hidePromptLab;
window.loadScenario = loadScenario;
window.generateLabPrompt = generateLabPrompt;
window.executeLabAI = executeLabAI;
window.pushLabWorkouts = pushLabWorkouts;
window.clearLabWorkouts = clearLabWorkouts;
window.copyLabPrompt = copyLabPrompt;
window.copyLabResponse = copyLabResponse;
window.togglePromptLab = togglePromptLab;
window.pushBuilderWorkout = pushBuilderWorkout;

console.log("[PromptLab] Exports attached to window object.");

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    // Backup: ensure global access
    window.togglePromptLab = togglePromptLab;
    initPromptLab();
});
