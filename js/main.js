console.log("Main.js: Module loaded. Initializing...");

// Expose Registry and Functions to Window immediately
window.sportRegistry = sportRegistry;
window.generateTrainingPlan = generateTrainingPlan;
window.fetchData = fetchData;
window.init = init;

// Modal Functions
window.toggleSettings = function () {
    const modal = document.getElementById('setupModal');
    if (modal) {
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        } else {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
    }
};
window.closeSetup = window.toggleSettings;
window.openSetup = function () {
    const modal = document.getElementById('setupModal');
    if (modal && modal.classList.contains('hidden')) {
        window.toggleSettings();
    }
};

// --- MAIN INITIALIZATION ---

async function fetchData(showMsg = false) {
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };
    try {
        if (showMsg) showToast("Fetching...");

        // Ensure we have a valid Athlete ID
        if (!state.athleteId || state.athleteId === '0' || state.athleteId === 0) {
            try {
                // Fetch self/current athlete using ID '0' (Intervals.icu convention for 'me')
                const res = await fetch(`https://intervals.icu/api/v1/athlete/0`, { headers });
                if (res.ok) {
                    const data = await res.json();
                    state.athleteId = data.id;
                    state.athleteName = `${data.firstname} ${data.lastname}`;
                    state.gender = data.sex;

                    // Calculate Age
                    const dobString = data.icu_date_of_birth || data.dateOfBirth || data.dob;
                    if (dobString) {
                        const dobDate = new Date(dobString);
                        const today = new Date();
                        let age = today.getFullYear() - dobDate.getFullYear();
                        const m = today.getMonth() - dobDate.getMonth();
                        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                            age--;
                        }
                        state.athleteAge = age;
                        localStorage.setItem('elite_athleteAge', age);
                    }

                    // Persist Gender
                    if (state.gender) {
                        localStorage.setItem('elite_gender', state.gender);
                    }

                    // Update UI inputs
                    if (document.getElementById('athleteIdInput')) document.getElementById('athleteIdInput').value = state.athleteId;

                    // Update Connection Status if visible
                    const statusBox = document.getElementById('connectionStatus');
                    if (statusBox) {
                        statusBox.classList.remove('hidden');
                        statusBox.innerHTML = `
                            <div class="space-y-1">
                                <div class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> Connected as ${state.athleteName}</div>
                            </div>
                        `;
                    }
                }
            } catch (err) {
                console.warn("Could not auto-fetch athlete ID:", err);
            }
        }

        if (!state.fetchedZones) await fetchZones();
        await fetchWellness();
        await fetchActivities();
        calculateZones();

        generateTrainingPlan();

        if (typeof applyModifications === 'function') {
            applyModifications();
        }

        if (showMsg) showToast("Data Synced");

        renderWeeklyPlan();

    } catch (e) {
        console.error(e);
        if (showMsg) showToast("Fetch Error: " + e.message);
    }
}

function generateTrainingPlan() {
    const sportType = state.sportType || "Running";
    const adapter = sportRegistry.getAdapter(sportType);

    if (!adapter) {
        console.error(`No adapter found for sport: ${sportType}`);
        return;
    }

    // Gather Inputs
    // We can let the adapter extract what it needs, or pass a standardized object.
    // The adapter.generatePlan expects (inputs, globalSettings).

    // Global Settings
    const globalSettings = {
        raceDate: document.getElementById('raceDateInput').value,
        planStartDate: document.getElementById(adapter.getPlanStartDateInputId()).value,
        startWithRestWeek: state.startWithRestWeek,
        customRestWeeks: state.customRestWeeks || [],
        forceBuildWeeks: state.forceBuildWeeks || []
    };

    const goalType = document.getElementById('trainingGoalInput') ? document.getElementById('trainingGoalInput').value : 'event';

    if (goalType === 'event' && (!globalSettings.planStartDate || !globalSettings.raceDate)) {
        // Only alert if we are actually trying to generate (sometimes called on init with empty dates)
        console.warn("Missing dates for plan generation:", globalSettings);
        showToast("Please set both Plan Start Date and Race Date.");
        return;
    } else if (goalType === 'fitness' && !globalSettings.planStartDate) {
        console.warn("Missing start date for fitness plan");
        showToast("Please set Plan Start Date.");
        return;
    }

    // Safety Check: Max Duration (1 year)
    if (globalSettings.planStartDate && globalSettings.raceDate) {
        const start = new Date(globalSettings.planStartDate);
        const end = new Date(globalSettings.raceDate);
        const diffTime = Math.abs(end - start);
        const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));

        if (diffWeeks > 52) {
            showToast("⚠️ Plan duration too long (Max 52 weeks). Please check dates.");
            return;
        }
    }

    // Inputs - We pass the entire state/DOM values that might be relevant
    // Ideally, we'd have a cleaner way to get these, but for now we grab from DOM/State
    const inputs = {
        // Running
        startVolume: document.getElementById('target-volume') ? parseFloat(document.getElementById('target-volume').value) : (state.startingVolume || 30),
        startLongRun: document.getElementById('target-long-run-run') ? parseFloat(document.getElementById('target-long-run-run').value) : (state.startingLongRun || 10),
        progressionRate: document.getElementById('progressionRateInputRun') ? parseFloat(document.getElementById('progressionRateInputRun').value) : state.progressionRate,
        taperDuration: document.getElementById('taperDurationInputRun') ? parseInt(document.getElementById('taperDurationInputRun').value) : state.taperDuration,
        longRunProgression: state.longRunProgression,
        raceType: state.raceType,

        // Cycling
        startTss: document.getElementById('start-tss') ? parseFloat(document.getElementById('start-tss').value) : (state.startTss || 300),
        currentCtl: document.getElementById('current-fitness') ? parseFloat(document.getElementById('current-fitness').value) : (state.currentFitness || 40),
        startLongRide: document.getElementById('target-long-run') ? parseFloat(document.getElementById('target-long-run').value) : 1.5,
        rampRate: document.getElementById('progressionRateInput') ? parseFloat(document.getElementById('progressionRateInput').value) : (state.rampRate || 5),
        // Cycling taper might use a different input ID in existing HTML? 
        // Checked HTML: taperDurationInputCycle vs taperDurationInputRun
        // We can pass both or let adapter pick.
    };

    // Refine inputs based on specific IDs if needed (Adapter handles defaults)
    if (sportType === 'Cycling') {
        inputs.taperDuration = document.getElementById('taperDurationInputCycle') ? parseInt(document.getElementById('taperDurationInputCycle').value) : 1;
        inputs.rampRate = document.getElementById('progressionRateInputCycle') ? parseFloat(document.getElementById('progressionRateInputCycle').value) : 5;
        inputs.raceType = document.getElementById('raceTypeInputCycle') ? document.getElementById('raceTypeInputCycle').value : 'General Fitness';
    }

    state.generatedPlan = adapter.generatePlan(inputs, globalSettings);
}

function init() {
    console.log("Main: init() called");
    // Initialize Inputs
    if (typeof populateSportDropdown === 'function') {
        console.log("Main: calling populateSportDropdown immediately");
        populateSportDropdown();
    } else {
        console.warn("Main: populateSportDropdown not found, retrying...");
        // Retry if ui.js hasn't loaded yet
        setTimeout(() => {
            if (typeof populateSportDropdown === 'function') {
                console.log("Main: calling populateSportDropdown after retry");
                populateSportDropdown();
            } else {
                console.error("Main: populateSportDropdown STILL not found after retry");
            }
        }, 500);
    }

    if (document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = state.apiKey;
    if (document.getElementById('athleteIdInput')) document.getElementById('athleteIdInput').value = state.athleteId;

    // Auto-open settings if new user (no API key or no plan)
    // Also check if we are not already on a specific hash (deep link)
    if ((!state.apiKey || !state.generatedPlan || state.generatedPlan.length === 0) && !window.location.hash) {
        console.log("Main: New user detected (or no plan), opening settings modal...");

        // Use a slightly longer delay to ensure UI is fully painted and event listeners attached
        setTimeout(() => {
            if (typeof openSetup === 'function') {
                openSetup();
            } else {
                // Fallback if openSetup not globally available yet
                const modal = document.getElementById('setupModal');
                if (modal) {
                    modal.classList.remove('hidden');
                    modal.classList.add('flex');
                }
            }
        }, 1000);
    } else {
        // If we have a plan, render it
        if (window.renderWeeklyPlan) {
            window.renderWeeklyPlan();
        }
    }
    if (document.getElementById('historyInput')) document.getElementById('historyInput').value = state.trainingHistory || '';
    if (document.getElementById('injuriesInput')) document.getElementById('injuriesInput').value = state.injuries || '';
    if (document.getElementById('gymAccessInput')) document.getElementById('gymAccessInput').value = state.gymAccess || 'none';
    if (document.getElementById('preferencesInput')) document.getElementById('preferencesInput').value = state.trainingPreferences || '';
    if (document.getElementById('current-fitness')) document.getElementById('current-fitness').value = state.currentFitness || '';

    if (document.getElementById('inputLthrPace')) document.getElementById('inputLthrPace').value = state.lthrPace;
    if (document.getElementById('inputLthrBpm')) document.getElementById('inputLthrBpm').value = state.lthrBpm;

    if (document.getElementById('raceDateInput')) document.getElementById('raceDateInput').value = state.raceDate;
    if (document.getElementById('goalTimeInput')) document.getElementById('goalTimeInput').value = state.goalTime;

    // Pre-fill Plan Start Date with next Monday (or today if Monday)
    const planStartInput = document.getElementById('planStartDateInput'); // Legacy ID?
    // We should update both Run and Cycle inputs
    const inputsToUpdate = ['planStartDateInputRun', 'planStartDateInputCycle'];

    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    const nextMonday = new Date(today.setDate(diff + (day === 1 ? 0 : 7)));
    const nextMondayStr = nextMonday.toISOString().split('T')[0];

    inputsToUpdate.forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) {
            el.value = nextMondayStr;
        }
    });

    if (document.getElementById('aiApiKeyInput')) document.getElementById('aiApiKeyInput').value = state.aiApiKey || '';
    if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = state.geminiApiKey || '';
    if (document.getElementById('deepseekApiKeyInput')) document.getElementById('deepseekApiKeyInput').value = state.deepseekApiKey || '';
    if (document.getElementById('openRouterApiKeyInput')) document.getElementById('openRouterApiKeyInput').value = state.openRouterApiKey || '';
    if (document.getElementById('mistralApiKeyInput')) document.getElementById('mistralApiKeyInput').value = state.mistralApiKey || '';
    if (document.getElementById('aiProviderSelect')) document.getElementById('aiProviderSelect').value = state.aiProvider || 'openai';

    toggleProviderFields();

    if (!state.apiKey) {
        openSetup();
    }

    // Restore time availability sliders from state
    if (state.dailyAvailability) {
        for (let day = 0; day <= 6; day++) {
            const dayData = state.dailyAvailability[day];
            if (!dayData) continue;

            const slider = document.getElementById(`hoursDay${day}`);
            const display = document.getElementById(`hoursDisplay${day}`);
            const splitCheckbox = document.getElementById(`splitDay${day}`);
            const splitInputs = document.getElementById(`splitInputs${day}`);
            const amInput = document.getElementById(`amHours${day}`);
            const pmInput = document.getElementById(`pmHours${day}`);

            if (slider) slider.value = dayData.hours;
            if (display) display.textContent = `${dayData.hours.toFixed(1)}h`;
            if (splitCheckbox) splitCheckbox.checked = dayData.split;

            if (dayData.split && splitInputs) {
                splitInputs.classList.remove('hidden');
                splitInputs.classList.add('flex');
                if (amInput) amInput.value = dayData.amHours;
                if (pmInput) pmInput.value = dayData.pmHours;
            }
        }
        // Update weekly total display
        if (typeof updateWeeklyTotal === 'function') {
            updateWeeklyTotal();
        }
    }


    if (document.getElementById('longRunDayInput')) document.getElementById('longRunDayInput').value = state.longRunDay;


    if (state.apiKey) {
        fetchZones().then(async () => {
            await fetchWellness();
            await fetchActivities();
            calculateZones();
            generateTrainingPlan();
            if (typeof applyModifications === 'function') applyModifications();
            renderWeeklyPlan();
        });
    } else {
        generateTrainingPlan();
        renderWeeklyPlan();
    }

    // Event Listener for Athlete ID
    const athleteIdInput = document.getElementById('athleteIdInput');
    if (athleteIdInput) {
        athleteIdInput.addEventListener('change', (e) => {
            state.athleteId = e.target.value;
            localStorage.setItem('elite_athleteId', state.athleteId);
            console.log('Athlete ID updated:', state.athleteId);
        });
    }
}

// Auto-run init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}