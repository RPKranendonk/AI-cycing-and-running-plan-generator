/**
 * @file main.js
 * @description Main application entry point and orchestrator.
 * @usedBy index.html
 * @responsibilities
 * - Initializes the application state and services
 * - Orchestrates the "Generate Plan" workflow (calling Scheduler -> Converter -> UI)
 * - Manages global state (gym access, dates, phases)
 * - Handles user inputs from the configuration modal
 * @why Central hub for wiring together the Scheduling Engine, UI, and Data Services.
 */

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

window.showUpgradeModal = function (featureName) {
    const modal = document.getElementById('upgradeModal');
    const label = document.getElementById('upgradeFeatureName');
    if (modal) {
        if (label && featureName) label.textContent = featureName + " Locked";
        modal.classList.remove('hidden');
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

                    // Payment verification now handled by success.html
                    // which sets the localStorage before redirecting here.

                    // Load State Age
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

        // 1. Fetch Core Settings (FTP, Weight, MaxHR)
        await fetchAthleteSettings();

        // 2. Fetch Zones & Wellness
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
        // Don't show toast during initial setup - just log and return silently
        console.warn("Missing dates for plan generation:", globalSettings);
        // Toast suppressed during configurator setup to avoid annoying users
        return;
    } else if (goalType === 'fitness' && !globalSettings.planStartDate) {
        console.warn("Missing start date for fitness plan");
        // Toast suppressed during configurator setup
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

    // --- RULE-BASED ENGINE INTEGRATION ---
    if ((window.RuleBasedScheduler || window.DeterministicScheduler) && state.generatedPlan && state.generatedPlan.length > 0) {
        generateDeterministicWorkouts();
        console.log(`Main: Generated workouts for ${Object.keys(state.generatedWorkouts).length} weeks.`);
    }
}

/**
 * [NEW] Core Workout Generation Engine
 * Generates deterministic workouts for a specific week or all weeks.
 * Replaces older TemplateGenerator logic for consistency.
 * @param {number|null} weekIndex - Index of the week to regenerate, or null for all
 */
function generateDeterministicWorkouts(weekIndex = null) {
    if (!state.generatedPlan || state.generatedPlan.length === 0) return;

    const Scheduler = window.RuleBasedScheduler || window.DeterministicScheduler;
    if (!Scheduler) {
        console.error("Scheduler not found");
        return;
    }

    const sportType = state.sportType || "Running";
    const user = state.user || {};
    const options = {
        thresholdPace: user.thresholdPace || (window.getLTPace ? window.getLTPace() : 300), // Default 5:00/km or use actual LT
        easyPace: (function () {
            // Priority: User Override -> Dynamic Calc (Modified Friel) -> Default
            if (user.easyPace) return user.easyPace;

            // Try Dynamic Calculation
            const lt = window.getLTPace ? window.getLTPace() : 300;
            if (window.getWorkoutPaceRange) {
                const range = window.getWorkoutPaceRange(lt, 'EASY');
                // Use mean of the range: (287 + 316) / 2 = 301.5
                if (range && range.raw) {
                    return Math.round((range.raw.slow + range.raw.fast) / 2);
                }
            }

            return 375; // Fallback 6:15/km
        })(),
        preferSundayLongRun: state.longRunDay !== undefined ? state.longRunDay === 0 : true
    };

    if (!state.generatedWorkouts) state.generatedWorkouts = {};

    // Determine which weeks to process
    let indices = [];
    if (weekIndex !== null) {
        indices = [weekIndex];
    } else {
        indices = Array.from({ length: state.generatedPlan.length }, (_, i) => i);
    }

    console.log(`[DeterministicGenerator] Processing ${indices.length} weeks...`);

    indices.forEach(index => {
        const weekData = state.generatedPlan[index];
        if (!weekData) return;

        // 1. Normalize Phase
        let phase = weekData.phaseName || window.PHASES.BASE;
        phase = phase.replace(/ Phase/i, '').trim();
        phase = phase.charAt(0).toUpperCase() + phase.slice(1);

        // 2. Build Scheduler Inputs
        const schedulerInput = {
            targetVolume: weekData.rawKm || weekData.mileage || 30,
            longRunDistance: weekData.longRun || 10,
            phase: phase,
            gymTarget: (state.gymAccess === 'basic' || state.gymAccess === 'full' || state.gymAccess === 'gym') ? 2 : 0,
            sport: sportType,
            weekNumber: index + 1,
            isRecoveryWeek: weekData.isRecoveryWeek || (weekData.weekName && weekData.weekName.includes('Recovery'))
        };
        console.log(`[DeterministicGenerator] W${index + 1} Gym Access: ${state.gymAccess} -> Target: ${schedulerInput.gymTarget}`);

        // 3. Resolve Availability (Prefer Overrides)
        const availability = {};
        const baseAvail = state.weekAvailabilityOverrides?.[index] || state.dailyAvailability;

        if (baseAvail) {
            for (let d = 0; d < 7; d++) {
                if (typeof baseAvail[d] === 'number') {
                    availability[d] = baseAvail[d];
                } else if (typeof baseAvail[d] === 'object' && baseAvail[d] !== null) {
                    availability[d] = baseAvail[d].hours || 0;
                } else {
                    availability[d] = 0;
                }
            }
        } else {
            for (let d = 0; d < 7; d++) availability[d] = (d === 0 || d === 6) ? 2 : 1;
        }

        // 4. Run Scheduler
        const result = Scheduler.buildWeekSchedule(schedulerInput, availability, options);

        // 5. VALIDATION & OPTIMIZATION (PlanValidator)
        if (window.PlanValidator) {
            // Convert Volume to consistent metric (km for run, hours for bike?)
            // IDM_MODELS use volume thresholds. 
            // Validator expects { volume: number, sport: string }
            // Run: volume is km. Bike: volume is... could be TSS or hours?
            // The Validator logic uses: Run < 50 (km?). 
            // My implementation in PlanValidator used: if (volume < 50) for Low Vol running.
            // Ensure we pass km for running.

            result.schedule = window.PlanValidator.validateAndFix(result.schedule, {
                volume: schedulerInput.targetVolume, // km for running
                sport: sportType
            });
        }

        // 6. Persist Schedule/Template
        state.generatedPlan[index].schedule = result.schedule;

        // 6. Transform to Workouts with Absolute Dates
        const workouts = [];
        const weekStartParts = weekData.startDate.split('-');
        const weekStart = new Date(parseInt(weekStartParts[0]), parseInt(weekStartParts[1]) - 1, parseInt(weekStartParts[2]), 6, 0, 0);

        result.schedule.forEach(slot => {
            const daysToAdd = (slot.day + 6) % 7; // Map 0=Sun to 6 days offset from Monday start
            const wDate = new Date(weekStart);
            wDate.setDate(weekStart.getDate() + daysToAdd);
            const dateStr = wDate.toISOString().split('T')[0];

            if (slot.workout) {
                workouts.push({
                    ...slot.workout,
                    date: dateStr,
                    start_date_local: `${dateStr}T06:00:00`,
                    dayIndex: slot.day,
                    type: slot.type,
                    title: slot.workout.name,
                    steps: slot.workout.steps || slot.steps,
                    slot: 'morning'
                });
            }

            if (slot.secondary) {
                workouts.push({
                    ...slot.secondary,
                    date: dateStr,
                    start_date_local: `${dateStr}T17:00:00`,
                    dayIndex: slot.day,
                    type: 'WeightTraining',
                    title: slot.secondary.name,
                    slot: 'evening'
                });
            }
        });

        state.generatedWorkouts[index] = workouts;
    });
}
window.generateDeterministicWorkouts = generateDeterministicWorkouts;

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
        console.log("Main: New user detected (or no plan), will open Quick Setup Wizard...");

        // Use a slightly longer delay to ensure UI is fully painted and event listeners attached
        // The quick-setup-wizard.js will handle auto-opening for first-time users
        // TEMPORARILY DISABLED - opening advanced setup directly for development
        setTimeout(() => {
            // Quick Setup enabled
            if (typeof openQuickSetup === 'function') {
                openQuickSetup();
                return;
            }

            // Fallback Logic
            const modal = document.getElementById('setupModal');
            if (modal) {
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            }
        }, 800);
    } else {
        // If we have a plan, render it
        if (window.renderWeeklyPlan) {
            window.renderWeeklyPlan();
        }

        // Render mobile today view if on mobile
        if (window.innerWidth < 1024 && typeof renderMobileTodayView === 'function') {
            renderMobileTodayView();
        }

        // [FIX] Ensure we sync data (Biometrics/Profile) on load if we have a key
        if (state.apiKey) {
            console.log("Main: Auto-syncing data...");
            fetchData(false); // false = no toast to avoid spam
        }

        // DEV BYPASS: Ensure setup is marked complete
        localStorage.setItem('aiCoachConfig', JSON.stringify({ setupComplete: true }));
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
    if (document.getElementById('trainingGoalInput')) document.getElementById('trainingGoalInput').value = state.trainingGoal || 'event';

    // Pre-fill Sport Specifics
    if (document.getElementById('raceTypeInput')) document.getElementById('raceTypeInput').value = state.raceType || 'Marathon';
    if (document.getElementById('target-volume')) document.getElementById('target-volume').value = state.startingVolume || 30;
    if (document.getElementById('target-long-run-run')) document.getElementById('target-long-run-run').value = state.startingLongRun || 10;
    if (document.getElementById('progressionRateInputRun')) document.getElementById('progressionRateInputRun').value = state.progressionRate || 0.075;
    if (document.getElementById('longRunProgressionInput')) document.getElementById('longRunProgressionInput').value = state.longRunProgression || 2.0;

    if (document.getElementById('raceTypeInputCycle')) document.getElementById('raceTypeInputCycle').value = state.raceType || 'General Fitness';
    if (document.getElementById('start-tss')) document.getElementById('start-tss').value = state.startTss || 300;
    if (document.getElementById('target-long-run')) document.getElementById('target-long-run').value = state.startLongRide || 1.5;
    if (document.getElementById('progressionRateInputCycle')) document.getElementById('progressionRateInputCycle').value = state.rampRate || 5;

    // Pre-fill Athlete Experience Radio
    if (state.athleteExperience) {
        const radio = document.querySelector(`input[name="athleteExperience"][value="${state.athleteExperience}"]`);
        if (radio) radio.checked = true;
    }

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

    // Note: openSetup() already called above at lines 211-226 for new users without API key

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


    if (document.getElementById('longRunDayInput')) document.getElementById('longRunDayInput').value = state.longRunDay || 0;


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