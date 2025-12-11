// ==========================================
// UI LOGIC: DOM MANIPULATION & INTERACTION
// ==========================================
// NOTE: Modal functions (openSetup, closeSetup, showToast, showAILoading, etc.)
// have been moved to js/ui/modals.js
// TRAINING_TIPS moved to js/core/constants.js
// ==========================================
console.log("UI.js: Loading...");

// --- TIME AVAILABILITY SLIDER FUNCTIONS ---

/**
 * Updates the display when a day's hour slider changes
 */
function updateDayHours(dayNum) {
    const slider = document.getElementById(`hoursDay${dayNum}`);
    const display = document.getElementById(`hoursDisplay${dayNum}`);
    if (slider && display) {
        const val = parseFloat(slider.value);
        display.textContent = `${val.toFixed(1)}h`;

        // If split is enabled, distribute between AM/PM
        const splitCheckbox = document.getElementById(`splitDay${dayNum}`);
        if (splitCheckbox && splitCheckbox.checked) {
            const amInput = document.getElementById(`amHours${dayNum}`);
            const pmInput = document.getElementById(`pmHours${dayNum}`);
            if (amInput && pmInput) {
                // Keep AM as is, adjust PM
                const amVal = parseFloat(amInput.value) || 0;
                const pmVal = Math.max(0, val - amVal);
                pmInput.value = pmVal.toFixed(1);
            }
        }
    }
    updateWeeklyTotal();
}
window.updateDayHours = updateDayHours;

/**
 * Toggles the AM/PM split inputs for a day
 */
function toggleSplitDay(dayNum) {
    const splitInputs = document.getElementById(`splitInputs${dayNum}`);
    const splitCheckbox = document.getElementById(`splitDay${dayNum}`);
    const slider = document.getElementById(`hoursDay${dayNum}`);

    if (splitInputs && splitCheckbox) {
        if (splitCheckbox.checked) {
            splitInputs.classList.remove('hidden');
            splitInputs.classList.add('flex');

            // Initialize AM/PM values based on total
            if (slider) {
                const total = parseFloat(slider.value) || 0;
                const amInput = document.getElementById(`amHours${dayNum}`);
                const pmInput = document.getElementById(`pmHours${dayNum}`);
                if (amInput && pmInput) {
                    // Default: 1/3 AM, 2/3 PM
                    const amVal = Math.min(1.0, total * 0.33);
                    amInput.value = amVal.toFixed(1);
                    pmInput.value = (total - amVal).toFixed(1);
                }
            }
        } else {
            splitInputs.classList.add('hidden');
            splitInputs.classList.remove('flex');
        }
    }
}
window.toggleSplitDay = toggleSplitDay;

/**
 * Updates the main slider when AM/PM inputs change
 */
function updateSplitHours(dayNum) {
    const amInput = document.getElementById(`amHours${dayNum}`);
    const pmInput = document.getElementById(`pmHours${dayNum}`);
    const slider = document.getElementById(`hoursDay${dayNum}`);
    const display = document.getElementById(`hoursDisplay${dayNum}`);

    if (amInput && pmInput && slider && display) {
        const amVal = parseFloat(amInput.value) || 0;
        const pmVal = parseFloat(pmInput.value) || 0;
        const total = amVal + pmVal;

        // Cap at max slider value
        const maxVal = parseFloat(slider.max);
        const finalTotal = Math.min(total, maxVal);

        slider.value = finalTotal;
        display.textContent = `${finalTotal.toFixed(1)}h`;
    }
    updateWeeklyTotal();
}
window.updateSplitHours = updateSplitHours;

/**
 * Calculates and displays the weekly total hours
 */
function updateWeeklyTotal() {
    let total = 0;
    for (let day = 0; day <= 6; day++) {
        const slider = document.getElementById(`hoursDay${day}`);
        if (slider) {
            total += parseFloat(slider.value) || 0;
        }
    }
    const display = document.getElementById('weeklyTotalHours');
    if (display) {
        display.textContent = `${total.toFixed(1)}h`;
    }
}
window.updateWeeklyTotal = updateWeeklyTotal;

/**
 * Collects all availability data from the UI into an object
 * @returns {Object} dailyAvailability object
 */
function collectDailyAvailability() {
    const availability = {};
    for (let day = 0; day <= 6; day++) {
        const slider = document.getElementById(`hoursDay${day}`);
        const splitCheckbox = document.getElementById(`splitDay${day}`);
        const amInput = document.getElementById(`amHours${day}`);
        const pmInput = document.getElementById(`pmHours${day}`);

        const hours = slider ? parseFloat(slider.value) || 0 : 0;
        const split = splitCheckbox ? splitCheckbox.checked : false;
        const amHours = amInput ? parseFloat(amInput.value) || 0 : 0;
        const pmHours = pmInput ? parseFloat(pmInput.value) || 0 : 0;

        availability[day] = {
            hours,
            split,
            amHours: split ? amHours : hours,
            pmHours: split ? pmHours : 0
        };
    }
    return availability;
}
window.collectDailyAvailability = collectDailyAvailability;

function toggleProviderFields() {
    const provider = document.getElementById('aiProviderSelect').value;
    const openaiField = document.getElementById('openai-field');
    const geminiField = document.getElementById('gemini-field');
    const deepseekField = document.getElementById('deepseek-field');
    const openrouterField = document.getElementById('openrouter-field');
    const mistralField = document.getElementById('mistral-field');

    openaiField.classList.add('hidden');
    geminiField.classList.add('hidden');
    deepseekField.classList.add('hidden');
    if (openrouterField) openrouterField.classList.add('hidden');
    if (mistralField) mistralField.classList.add('hidden');

    if (provider === 'openai') {
        openaiField.classList.remove('hidden');
    } else if (provider === 'gemini') {
        geminiField.classList.remove('hidden');
    } else if (provider === 'deepseek') {
        deepseekField.classList.remove('hidden');
    } else if (provider === 'openrouter') {
        document.getElementById('openrouter-field').classList.remove('hidden');
    } else if (provider === 'mistral') {
        document.getElementById('mistral-field').classList.remove('hidden');
    }
}

// --- HELPER: Safe DOM Access ---
function getVal(id, defaultVal = "") {
    const el = document.getElementById(id);
    return el ? el.value : defaultVal;
}

// --- GOAL TOGGLE LOGIC ---
function toggleGoalType(type) {
    const eventBtn = document.getElementById('goal-event-btn');
    const fitnessBtn = document.getElementById('goal-fitness-btn');
    const raceDateContainer = document.getElementById('raceDateContainer');
    const fitnessDurationContainer = document.getElementById('fitnessDurationContainer');
    const input = document.getElementById('trainingGoalInput');

    if (type === 'event') {
        eventBtn.classList.add('bg-cyan-500/20', 'text-cyan-400', 'shadow-lg');
        eventBtn.classList.remove('text-slate-400', 'hover:text-white');

        fitnessBtn.classList.remove('bg-cyan-500/20', 'text-cyan-400', 'shadow-lg');
        fitnessBtn.classList.add('text-slate-400', 'hover:text-white');

        raceDateContainer.classList.remove('hidden');
        fitnessDurationContainer.classList.add('hidden');
        input.value = 'event';
    } else {
        fitnessBtn.classList.add('bg-cyan-500/20', 'text-cyan-400', 'shadow-lg');
        fitnessBtn.classList.remove('text-slate-400', 'hover:text-white');

        eventBtn.classList.remove('bg-cyan-500/20', 'text-cyan-400', 'shadow-lg');
        eventBtn.classList.add('text-slate-400', 'hover:text-white');

        raceDateContainer.classList.add('hidden');
        fitnessDurationContainer.classList.remove('hidden');
        input.value = 'fitness';
    }
}
window.toggleGoalType = toggleGoalType;

function initLivePreviewListeners() {
    const previewInputs = [
        'raceDateInput', 'planStartDateInputRun', 'planStartDateInputCycle',
        'target-volume', 'target-long-run-run', 'progressionRateInputRun',
        'start-tss', 'target-long-run', 'progressionRateInputCycle',
        'trainingGoalInput', 'raceTypeInput', 'raceTypeInputCycle',
        'goal-event-btn', 'goal-fitness-btn' // Also trigger on buttons if they change hidden input
    ];

    previewInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', viewProgressionFromInputs);
            el.addEventListener('input', viewProgressionFromInputs);
        }
    });

    // Special case for buttons since they don't fire input events directly on the hidden field
    document.getElementById('goal-event-btn')?.addEventListener('click', () => setTimeout(viewProgressionFromInputs, 50));
    document.getElementById('goal-fitness-btn')?.addEventListener('click', () => setTimeout(viewProgressionFromInputs, 50));
}

// Call on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLivePreviewListeners);
} else {
    initLivePreviewListeners();
}

// --- CONFIGURATOR FLOW LOGIC ---

async function checkConnectionAndHistory() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const athleteId = document.getElementById('athleteIdInput').value.trim();

    if (!apiKey) {
        showToast("❌ Please enter API Key");
        return;
    }

    // 1. Check Connection
    const statusBox = document.getElementById('connectionStatus');
    if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = '<div class="text-blue-400"><i class="fa-solid fa-spinner fa-spin"></i> Connecting...</div>';
    }

    try {
        const auth = btoa(`API_KEY:${apiKey}`);
        // Default to '0' (self) if no ID provided, but warn if empty
        const targetId = athleteId || '0';

        const res = await fetch(`https://intervals.icu/api/v1/athlete/${targetId}`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!res.ok) {
            if (res.status === 401) throw new Error("Invalid API Key");
            if (res.status === 404) throw new Error("Athlete not found");
            throw new Error(`Connection Failed (${res.status})`);
        }

        const data = await res.json();

        // DEBUG: Log full data to verify fields
        console.log("Intervals.icu Athlete Data:", data);

        // VALIDATION: Check for Name and DOB
        const hasName = data.firstname && data.lastname;
        // User found 'icu_date_of_birth' in docs. We check that first, then fallbacks.
        const dobString = data.icu_date_of_birth || data.dateOfBirth || data.dob;
        const hasDob = !!dobString;

        if (!hasName || !hasDob) {
            if (statusBox) {
                statusBox.innerHTML = `
                    <div class="text-amber-400 font-bold mb-2"><i class="fa-solid fa-triangle-exclamation"></i> Missing Profile Info</div>
                    <div class="text-sm text-slate-300 mb-2">
                        We could not find your <b>${!hasName ? 'Name' : ''} ${!hasName && !hasDob ? 'and' : ''} ${!hasDob ? 'Birthdate' : ''}</b> in Intervals.icu.
                    </div>
                    <div class="text-xs text-slate-400 mb-4">
                        Please go to <a href="https://intervals.icu/settings" target="_blank" class="text-blue-400 underline">Intervals.icu Settings</a>, update your profile, and try again.
                    </div>
                `;
            }
            return; // Stop execution
        }

        state.athleteName = `${data.firstname} ${data.lastname}`;
        state.athleteId = data.id;

        // Calculate Age from DOB (yyyy-MM-dd)
        let age = null;
        if (dobString) {
            const dobDate = new Date(dobString);
            const today = new Date();
            age = today.getFullYear() - dobDate.getFullYear();
            const m = today.getMonth() - dobDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                age--;
            }
        }
        state.athleteAge = age;
        state.gender = data.sex; // Capture Gender

        // Update UI with resolved ID
        const idInput = document.getElementById('athleteIdInput');
        if (idInput) idInput.value = data.id;

        if (statusBox) {
            const ageText = state.athleteAge ? ` (${state.athleteAge} years old)` : '';
            statusBox.innerHTML = `
                <div class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> Connected as ${state.athleteName}${ageText}</div>
            `;
        }

        // 2. Fetch History (Smart Planner)
        // Wrap in try-catch to prevent blocking the flow if history fails
        try {
            await calculateSmartBlock();
        } catch (smartError) {
            console.warn("Smart Planner failed:", smartError);
            showToast("⚠️ Could not load history for Smart Planner");
        }

        // 3. Reveal Next Steps
        const step4 = document.getElementById('step-4-inputs');
        const step5 = document.getElementById('step-5-plan-action');
        if (step4) step4.classList.remove('hidden');
        if (step5) step5.classList.remove('hidden');

        // Pre-fill Plan Start Date (Nearest Monday)
        const today = new Date();
        const day = today.getDay();
        const diff = (1 + 7 - day) % 7; // Days to add to reach next Monday
        const daysToAdd = diff;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysToAdd);

        const planStartRun = document.getElementById('planStartDateInputRun');
        const planStartCycle = document.getElementById('planStartDateInputCycle');

        if (planStartRun && !planStartRun.value) planStartRun.valueAsDate = targetDate;
        if (planStartCycle && !planStartCycle.value) planStartCycle.valueAsDate = targetDate;

        // Pre-fill Race Date (Default 12 weeks out)
        const raceDateInput = document.getElementById('raceDateInput');
        if (raceDateInput && !raceDateInput.value) {
            const defaultRaceDate = new Date(targetDate);
            defaultRaceDate.setDate(defaultRaceDate.getDate() + (12 * 7)); // 12 weeks
            raceDateInput.valueAsDate = defaultRaceDate;
        }

        // Pre-fill Start Long Run (Max from last 4 weeks)
        if (state.activities && state.activities.length > 0) {
            let maxRun = 0;
            const fourWeeksAgo = new Date();
            fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

            state.activities.forEach(act => {
                if (act.type === 'Run' || act.type === 'VirtualRun') {
                    const actDate = new Date(act.start_date_local);
                    if (actDate >= fourWeeksAgo) {
                        const km = (act.distance || 0) / 1000;
                        if (km > maxRun) maxRun = km;
                    }
                }
            });

            console.log("Calculated Max Long Run:", maxRun);

            const longRunInputRun = document.getElementById('target-long-run-run');
            if (longRunInputRun && maxRun > 0) {
                longRunInputRun.value = maxRun.toFixed(1);
            }
        }

    } catch (e) {
        console.error(e);
        if (statusBox) statusBox.innerHTML = `<div class="text-red-400 font-bold">Error: ${e.message}</div>`;
        showToast(`❌ ${e.message}`);
    }
}

function calculateAndShowPlan() {
    // Legacy wrapper if called from HTML
    generateAndCloseModal();
}

// --- Sport Selection ---
function populateSportDropdown() {
    console.log("UI: populateSportDropdown called");
    const select = document.getElementById('sportTypeInput');
    if (!select) {
        console.error("UI: #sportTypeInput not found");
        return;
    }

    // Retry if registry not ready
    if (!window.sportRegistry || window.sportRegistry.getAllAdapters().length === 0) {
        console.warn("UI: Registry empty or missing, retrying in 100ms...");
        setTimeout(populateSportDropdown, 100);
        return;
    }

    select.innerHTML = '';
    const sports = window.sportRegistry.getSports();

    if (sports.length === 0) {
        console.warn("UI: No sports found in registry even after check");
        return;
    }

    sports.forEach(sport => {
        const option = document.createElement('option');
        option.value = sport;
        option.textContent = sport;
        select.appendChild(option);
    });

    // Set selected value if in state, otherwise default to 'Running'
    if (state.sportType && sports.includes(state.sportType)) {
        select.value = state.sportType;
    } else {
        select.value = 'Running';
        state.sportType = 'Running';
    }

    console.log(`UI: Sports populated. Selected: ${select.value}`);

    // Ensure fields are toggled for the default/current selection
    toggleSportFields(select.value);

    // Remove existing listeners to avoid duplicates (naive approach, better to use named function)
    const newSelect = select.cloneNode(true);
    select.parentNode.replaceChild(newSelect, select);

    newSelect.addEventListener('change', (e) => {
        toggleSportFields(e.target.value);

        // Auto-reload Smart Analysis if API keys are present
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const athleteId = document.getElementById('athleteIdInput').value.trim();

        if (apiKey && athleteId && window.calculateSmartBlock) {
            // Clear previous results to indicate reload
            document.getElementById('weekly-breakdown').textContent = 'Switching sport...';
            // Small delay to allow UI to update
            setTimeout(() => {
                window.calculateSmartBlock();
            }, 100);
        }
    });
}

function toggleSportFields() {
    const sport = document.getElementById('sportTypeInput').value;

    // Update State
    state.sportType = sport;
    localStorage.setItem('elite_sportType', sport);

    // Dynamic Toggle using Registry
    if (window.sportRegistry) {
        const adapters = window.sportRegistry.getAllAdapters();
        const activeAdapter = window.sportRegistry.getAdapter(sport);

        // Hide all containers first
        adapters.forEach(adapter => {
            const containerId = adapter.getConfigContainerId();
            const el = document.getElementById(containerId);
            if (el) el.classList.add('hidden');
        });

        // Update UI for Sport
        const runContainer = document.getElementById('running-config-container');
        const cycleContainer = document.getElementById('cycling-config-container');

        if (sport === 'Cycling') {
            if (runContainer) runContainer.classList.add('hidden');
            if (cycleContainer) cycleContainer.classList.remove('hidden');
        } else {
            // Default to Running for any other sport for now (or specific logic)
            if (cycleContainer) cycleContainer.classList.add('hidden');
            if (runContainer) runContainer.classList.remove('hidden');
        }

        // Trigger preview update if available
        if (typeof viewProgressionFromInputs === 'function') {
            viewProgressionFromInputs();
        }

        // Update Experience Label
        const expLabel = document.getElementById('lbl-selected-sport');
        if (expLabel) expLabel.textContent = sport;

        // Re-apply experience settings for the new sport
        applyExperienceSettings();
    }
}

function applyExperienceSettings() {
    const sport = document.getElementById('sportTypeInput').value;
    const experience = document.querySelector('input[name="athleteExperience"]:checked')?.value;

    if (!experience) return;

    // Running Inputs
    const progRateRun = document.getElementById('progressionRateInputRun');
    const longRunProg = document.getElementById('longRunProgressionInput');

    // Cycling Inputs
    const rampRateCycle = document.getElementById('progressionRateInputCycle');

    if (sport === 'Running') {
        if (progRateRun && longRunProg) {
            switch (experience) {
                case 'fresh_start':
                case 'transfer':
                    progRateRun.value = "0.05";
                    longRunProg.value = "1.0";
                    break;
                case 'consistent':
                    progRateRun.value = "0.075";
                    longRunProg.value = "1.5";
                    break;
                case 'high_performance':
                    progRateRun.value = "0.10";
                    longRunProg.value = "2.0";
                    break;
            }
        }
    } else if (sport === 'Cycling') {
        if (rampRateCycle) {
            switch (experience) {
                case 'fresh_start':
                    rampRateCycle.value = "3";
                    break;
                case 'transfer':
                    rampRateCycle.value = "5";
                    break;
                case 'consistent':
                    rampRateCycle.value = "4"; // Note: 6 is not in the original options (3,5,8), but I added 3-10.
                    break;
                case 'high_performance':
                    rampRateCycle.value = "6";
                    break;
            }
            // Trigger change event to update warning visibility
            rampRateCycle.dispatchEvent(new Event('change'));
        }
    }
}

// --- GOAL FEEDBACK LOGIC ---
// Note: This relies on assessMarathonGoal() from goal-assessment.js

function updateGoalFeedback() {
    const goalTime = document.getElementById('goalTimeInput').value.trim();
    const raceDate = document.getElementById('raceDateInput').value;
    const feedbackContainer = document.getElementById('goalFeedback');

    if (!feedbackContainer) return;

    const goalType = document.getElementById('trainingGoalInput') ? document.getElementById('trainingGoalInput').value : 'event';
    if (goalType === 'fitness') {
        feedbackContainer.classList.add('hidden');
        return;
    }

    if (!goalTime || !raceDate) {
        feedbackContainer.classList.add('hidden');
        return;
    }

    // Call external function from goal-assessment.js
    const assessment = assessMarathonGoal(goalTime, raceDate);

    if (!assessment.isValid && assessment.warnings.length === 0) {
        // If invalid but no specific warnings yet (e.g. empty inputs being typed)
        return;
    }

    feedbackContainer.classList.remove('hidden');
    const statusEl = document.getElementById('feedbackStatus');
    const messageEl = document.getElementById('feedbackMessage');
    const warningsEl = document.getElementById('feedbackWarnings');

    if (statusEl) {
        statusEl.className = `text-sm font-bold mb-1 ${assessment.statusColor}`;
        statusEl.textContent = assessment.timeStatus || assessment.difficulty || 'Analyzing...';
    }
    if (messageEl) messageEl.textContent = assessment.timeMessage || '';

    if (warningsEl) {
        warningsEl.innerHTML = '';
        if (assessment.warnings && assessment.warnings.length > 0) {
            assessment.warnings.forEach(warning => {
                const warningDiv = document.createElement('div');
                warningDiv.className = 'text-xs text-slate-400';
                warningDiv.textContent = warning;
                warningsEl.appendChild(warningDiv);
            });
        }
    }
    const sportType = state.sportType || 'Running';
    const isCycling = sportType === 'Cycling';

    // Get Inputs based on sport
    let startDateInputId = isCycling ? 'planStartDateInputCycle' : 'planStartDateInputRun';
    const startDateStr = document.getElementById(startDateInputId).value;
    const raceDateStr = document.getElementById('raceDateInput').value;

    if (!startDateStr || !raceDateStr) return;

    // Call external function from goal-assessment.js
    const assessment2 = assessMarathonGoal(goalTime, raceDate);
    const minDays = assessment2.minDays || 3;
    checkMinimumDays();
}

function checkMinimumDays() {
    const goalTime = document.getElementById('goalTimeInput').value.trim();
    const raceDate = document.getElementById('raceDateInput').value;
    if (!goalTime || !raceDate) return;

    // Call external function from goal-assessment.js
    const assessment = assessMarathonGoal(goalTime, raceDate);
    const minDays = assessment.minDays || 3;

    let selectedCount = 0;
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(d => {
        const cb = document.getElementById(`day${d}`);
        if (cb && cb.checked) selectedCount++;
    });

    const notif = document.getElementById('minDaysNotification');
    const msg = document.getElementById('minDaysMessage');

    if (notif && msg) {
        if (selectedCount < minDays) {
            notif.classList.remove('hidden');
            msg.innerHTML = `Your goal suggests running <b>${minDays} days/week</b>, but you only selected <b>${selectedCount}</b>.`;
        } else {
            notif.classList.add('hidden');
        }
    }
}

// --- EVENT LISTENERS ---
document.addEventListener('DOMContentLoaded', () => {
    const goalTimeInput = document.getElementById('goalTimeInput');
    const raceDateInput = document.getElementById('raceDateInput');

    if (goalTimeInput && raceDateInput) {
        goalTimeInput.addEventListener('input', updateGoalFeedback);
        raceDateInput.addEventListener('change', updateGoalFeedback);
        if (goalTimeInput.value && raceDateInput.value) updateGoalFeedback();
    }

    const dayCheckboxes = document.querySelectorAll('input[id^="day"]');
    dayCheckboxes.forEach(cb => {
        cb.addEventListener('change', checkMinimumDays);
    });

    // ESC Key to dismiss AI Loading
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const overlay = document.getElementById('aiLoadingOverlay');
            if (overlay && !overlay.classList.contains('hidden')) {
                hideAILoading();
            }
        }
    });

    // Initialize UI State
    toggleSportFields();

    // Ramp Rate Warning Logic
    const rampRateInput = document.getElementById('progressionRateInputCycle');
    const rampRateWarning = document.getElementById('rampRateWarning');

    if (rampRateInput && rampRateWarning) {
        const checkRampRate = () => {
            const val = parseInt(rampRateInput.value);
            if (val >= 8) {
                rampRateWarning.classList.remove('hidden');
            } else {
                rampRateWarning.classList.add('hidden');
            }
        };

        rampRateInput.addEventListener('change', checkRampRate);
        // Check on load
        checkRampRate();
    }

    // Athlete Experience Listeners
    const experienceRadios = document.querySelectorAll('input[name="athleteExperience"]');
    experienceRadios.forEach(radio => {
        radio.addEventListener('change', applyExperienceSettings);
    });
});

// --- API TESTS ---
async function testIntervalsConnection() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const athleteId = document.getElementById('athleteIdInput').value.trim() || '0';
    const statusBox = document.getElementById('connectionStatus');

    if (!apiKey) return showToast("Please enter an API Key");

    statusBox.classList.remove('hidden');
    statusBox.innerHTML = '<div class="text-blue-400"><i class="fa-solid fa-spinner fa-spin"></i> Connecting...</div>';

    const auth = btoa("API_KEY:" + apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, { headers });
        if (!res.ok) throw new Error("Connection Failed");
        const data = await res.json();

        // DEBUG: Log full data to verify fields
        console.log("Intervals.icu Athlete Data:", data);

        // VALIDATION: Check for Name and DOB
        const hasName = data.firstname && data.lastname;
        // User found 'icu_date_of_birth' in docs. We check that first, then fallbacks.
        const dobString = data.icu_date_of_birth || data.dateOfBirth || data.dob;
        const hasDob = !!dobString;

        if (!hasName || !hasDob) {
            statusBox.innerHTML = `
                <div class="text-amber-400 font-bold mb-2"><i class="fa-solid fa-triangle-exclamation"></i> Missing Profile Info</div>
                <div class="text-sm text-slate-300 mb-2">
                    We could not find your <b>${!hasName ? 'Name' : ''} ${!hasName && !hasDob ? 'and' : ''} ${!hasDob ? 'Birthdate' : ''}</b> in Intervals.icu.
                </div>
                <div class="text-xs text-slate-400 mb-4">
                    Please go to <a href="https://intervals.icu/settings" target="_blank" class="text-blue-400 underline">Intervals.icu Settings</a>, update your profile, and try again.
                </div>
            `;
            return; // Stop execution
        }

        state.athleteName = `${data.firstname} ${data.lastname}`;
        state.apiKey = apiKey;
        state.athleteId = data.id;

        // Calculate Age from DOB (yyyy-MM-dd)
        let age = null;
        if (dobString) {
            const dobDate = new Date(dobString);
            const today = new Date();
            age = today.getFullYear() - dobDate.getFullYear();
            const m = today.getMonth() - dobDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                age--;
            }
        }
        state.athleteAge = age;
        state.gender = data.sex; // Capture Gender

        // Set Default Dates
        const today = new Date();
        const planStartInputRun = document.getElementById('planStartDateInputRun');
        const planStartInputCycle = document.getElementById('planStartDateInputCycle');
        if (planStartInputRun || planStartInputCycle) {
            // Default to next Monday
            const day = today.getDay();
            const diff = (1 + 7 - day) % 7;
            const daysToAdd = diff === 0 ? 7 : diff; // If today is Monday (0), add 7 days

            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);

            if (planStartInputRun) planStartInputRun.valueAsDate = targetDate;
            if (planStartInputCycle) planStartInputCycle.valueAsDate = targetDate;
        }

        const raceDate = new Date();
        raceDate.setDate(today.getDate() + (16 * 7)); // Default 16 weeks out
        document.getElementById('raceDateInput').valueAsDate = raceDate;
        document.getElementById('athleteIdInput').value = data.id;

        const ageText = state.athleteAge ? ` (${state.athleteAge} years old)` : '';
        statusBox.innerHTML = `
            <div class="space-y-1">
                <div class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> Connected as ${state.athleteName}${ageText}</div>
            </div>
        `;

        // Trigger data load
        await fetchZones();
        await fetchWellness();
    } catch (e) {
        statusBox.innerHTML = `<div class="text-red-400 font-bold">Error: ${e.message}</div>`;
    }
}

function testAIContext() {
    const zoneStr = getZonePaceStrings();
    alert(`Context loaded for ${state.athleteName}. Zones: \n${zoneStr}`);
}

function saveSettings() {
    try {
        state.apiKey = getVal('apiKeyInput').trim();
        state.athleteId = getVal('athleteIdInput').trim();
        state.trainingHistory = getVal('historyInput');
        state.injuries = getVal('injuriesInput');
        state.gymAccess = getVal('gymAccessInput');
        state.trainingPreferences = getVal('preferencesInput');

        // New Smart Planner Inputs
        state.startingVolume = getVal('target-volume');
        // Fix: Read correct Long Run input
        state.startingLongRun = state.sportType === 'Cycling' ? getVal('target-long-run') : getVal('target-long-run-run');
        state.startWithRestWeek = document.getElementById('use-rest-week') ? document.getElementById('use-rest-week').checked : false;

        state.aiApiKey = getVal('aiApiKeyInput');
        state.geminiApiKey = getVal('geminiApiKeyInput');
        state.deepseekApiKey = getVal('deepseekApiKeyInput');
        state.openRouterApiKey = getVal('openRouterApiKeyInput');
        state.mistralApiKey = getVal('mistralApiKeyInput');
        state.aiProvider = getVal('aiProviderSelect');
        state.goalTime = getVal('goalTimeInput');

        // Sport & Distance Logic
        state.sportType = getVal('sportTypeInput', 'Running');

        // Goal Type Logic
        const goalType = document.getElementById('trainingGoalInput').value;
        let raceDateVal = getVal('raceDateInput');

        if (goalType === 'fitness') {
            // Calculate 16 weeks from Plan Start
            let startDateInputId = state.sportType === 'Cycling' ? 'planStartDateInputCycle' : 'planStartDateInputRun';
            const startDateStr = getVal(startDateInputId);

            if (startDateStr) {
                const start = new Date(startDateStr);
                const end = new Date(start);
                end.setDate(start.getDate() + (16 * 7)); // 16 weeks
                raceDateVal = end.toISOString().split('T')[0];
                // Update input so other functions see it
                document.getElementById('raceDateInput').value = raceDateVal;
            }
        }
        state.raceDate = raceDateVal;

        if (state.sportType === "Cycling") {
            state.raceType = getVal('raceTypeInputCycle', 'General Fitness');
        } else {
            state.raceType = getVal('raceTypeInput', 'Marathon');
        }

        // Sync Configurator Inputs
        // Sync Configurator Inputs
        state.taperDuration = document.getElementById('taperDurationInput') ? parseInt(document.getElementById('taperDurationInput').value) : 3;
        state.longRunProgression = document.getElementById('longRunProgressionInput') ? parseFloat(document.getElementById('longRunProgressionInput').value) : 2.0;

        if (state.sportType === 'Cycling') {
            state.rampRate = document.getElementById('progressionRateInputCycle') ? parseInt(document.getElementById('progressionRateInputCycle').value) : 5;
            state.progressionRate = null;
        } else {
            state.progressionRate = document.getElementById('progressionRateInputRun') ? parseFloat(document.getElementById('progressionRateInputRun').value) : 0.075;
            state.rampRate = null;
        }

        state.startTss = document.getElementById('start-tss') ? parseInt(document.getElementById('start-tss').value) : null;

        localStorage.setItem('elite_apiKey', state.apiKey);
        localStorage.setItem('elite_athleteId', state.athleteId);
        localStorage.setItem('elite_raceDate', state.raceDate);
        localStorage.setItem('elite_goalTime', state.goalTime);
        localStorage.setItem('elite_raceType', state.raceType);
        localStorage.setItem('elite_sportType', state.sportType);
        localStorage.setItem('elite_rampRate', state.rampRate);
        localStorage.setItem('elite_startTss', state.startTss);
        localStorage.setItem('elite_aiApiKey', state.aiApiKey);
        localStorage.setItem('elite_geminiApiKey', state.geminiApiKey);
        localStorage.setItem('elite_deepseekApiKey', state.deepseekApiKey);
        localStorage.setItem('elite_openRouterApiKey', state.openRouterApiKey);
        localStorage.setItem('elite_mistralApiKey', state.mistralApiKey);
        localStorage.setItem('elite_aiProvider', state.aiProvider);
        localStorage.setItem('elite_trainingHistory', state.trainingHistory);
        localStorage.setItem('elite_injuries', state.injuries);
        localStorage.setItem('elite_gymAccess', state.gymAccess);
        localStorage.setItem('elite_trainingPreferences', state.trainingPreferences);
        localStorage.setItem('elite_taperDuration', state.taperDuration);
        localStorage.setItem('elite_longRunProgression', state.longRunProgression);
        localStorage.setItem('elite_longRunProgression', state.longRunProgression);
        localStorage.setItem('elite_progressionRate', state.progressionRate);
        localStorage.setItem('elite_gender', state.gender); // Persist Gender

        const cfEl = document.getElementById('current-fitness');
        state.currentFitness = cfEl ? cfEl.value : (state.currentFitness || 40);
        localStorage.setItem('elite_currentFitness', state.currentFitness);

        // Persist Smart Planner Inputs
        localStorage.setItem('elite_startingVolume', state.startingVolume);
        localStorage.setItem('elite_startingLongRun', state.startingLongRun);
        localStorage.setItem('elite_startWithRestWeek', state.startWithRestWeek);

        // Collect and persist daily availability (new slider-based system)
        if (typeof collectDailyAvailability === 'function') {
            state.dailyAvailability = collectDailyAvailability();
            localStorage.setItem('elite_dailyAvail', JSON.stringify(state.dailyAvailability));

            // Also compute defaultAvailableDays from days with hours > 0
            const days = [];
            for (let d = 0; d <= 6; d++) {
                if (state.dailyAvailability[d] && state.dailyAvailability[d].hours > 0) {
                    days.push(d);
                }
            }
            state.defaultAvailableDays = days;
            localStorage.setItem('elite_defaultDays', JSON.stringify(days));
        }


        const lrDayEl = document.getElementById('longRunDayInput');
        state.longRunDay = lrDayEl ? parseInt(lrDayEl.value) : 0;
        localStorage.setItem('elite_longRunDay', state.longRunDay);

        showToast("Configuration Saved");

        // Generate and Close
        generateAndCloseModal();
    } catch (e) {
        console.error("Error saving settings:", e);
        showToast("Error saving settings: " + e.message);
    }
}

// ==========================================
// SMART BLOCK PLANNER LOGIC
// ==========================================

// ... (Smart Planner logic moved to smart-planner.js) ...

function toggleProgressionSidePanel(show) {
    const panel = document.getElementById('progressionSidePanel');
    if (show) {
        panel.classList.remove('hidden');
        panel.classList.add('flex');
    } else {
        panel.classList.add('hidden');
        panel.classList.remove('flex');
    }
}

function generateAndCloseModal() {
    console.log("generateAndCloseModal called");
    try {
        // 1. Generate the plan (updates state.generatedPlan)
        if (window.generateTrainingPlan) {
            console.log("Calling generateTrainingPlan...");
            window.generateTrainingPlan();
            console.log("generateTrainingPlan returned. Plan length:", state.generatedPlan ? state.generatedPlan.length : "null");
        } else {
            console.error("generateTrainingPlan not found");
            showToast("Error: Generator not found");
            return;
        }

        // 2. Render the main weekly view
        if (window.renderWeeklyPlan) {
            console.log("Calling renderWeeklyPlan...");
            window.renderWeeklyPlan();
        }

        // 3. Close setup modal
        closeSetup();
    } catch (e) {
        console.error("Error generating plan:", e);
        showToast("Error generating plan: " + e.message);
        // Optional: Close anyway? Or let user fix inputs?
        // Let's keep it open so they can see the error and fix it.
    }
}

// NOTE: Modal functions (closeSetup, openSetup) are now in ui/modals.js
// Debug functions (updateDebugPrompt, etc.) are defined at the bottom of this file
window.saveSettings = saveSettings;


function viewProgressionFromInputs() {
    // Generate plan in memory
    if (window.generateTrainingPlan) window.generateTrainingPlan();

    // Render the preview inside the modal
    if (typeof renderProgressionSidePanel === 'function') {
        renderProgressionSidePanel();
    }
}

function renderProgressionSidePanel() {
    const sportType = state.sportType || 'Running';
    const isCycling = (sportType === 'Cycling');

    // Target correct container based on sport
    const containerId = isCycling ? 'progression-preview-cycle' : 'progression-preview-run';
    const container = document.getElementById(containerId);

    if (!container) {
        console.warn(`Progression container #${containerId} not found`);
        return;
    }

    let adapter = null;
    if (window.sportRegistry) {
        adapter = window.sportRegistry.getAdapter(sportType);
    }

    // const isCycling = (sportType === 'Cycling'); // Already defined above
    const volUnit = adapter ? adapter.getVolumeUnit() : (isCycling ? 'TSS' : 'km');
    const lrLabel = adapter ? adapter.getLongSessionLabel() : (isCycling ? 'Long Ride' : 'Long Run');
    const lrUnit = isCycling ? 'h' : 'km';

    const plan = state.generatedPlan;
    if (!plan || plan.length === 0) return;

    let html = '<div class="grid grid-cols-6 gap-1 text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 mb-1 text-center">';
    html += `<div>Week</div><div>Date</div><div>Phase</div><div>Rest?</div><div>${volUnit}</div><div>${lrLabel}</div></div>`;

    // Track gaps
    let lastRestWeek = 0;
    let maxGap = 0;

    // Identify Mandatory Weeks
    // 1. Taper Weeks (blockType === "Taper")
    // 2. Peak Weeks (blockType === "Peak")
    // 3. Last Recovery Week (The recovery week BEFORE the Peak block)

    // Find Peak Block Start
    const peakBlockStart = plan.findIndex(w => w.blockType === "Peak");
    let lastRecoveryWeekIndex = -1;

    if (peakBlockStart > 0) {
        // Look backwards from Peak for the first Recovery week
        for (let i = peakBlockStart - 1; i >= 0; i--) {
            if (plan[i].weekName.includes("Recovery")) {
                lastRecoveryWeekIndex = i;
                break;
            }
        }
    }

    plan.forEach((week, index) => {
        let rowClass = "border-b border-slate-800 py-1 text-center";
        let phaseDisplay = week.phaseName.replace(" Phase", ""); // Shorten name
        let isRest = false;
        let phaseClass = "";
        let restBadge = "";

        if (week.isRaceWeek) {
            phaseDisplay = "RACE";
            rowClass += " bg-purple-900/20 text-purple-200";
            phaseClass = "text-purple-200";
        } else if (week.blockType === "Taper") {
            rowClass += " text-blue-200";
            phaseClass = "text-blue-200";
        } else if (week.weekName.includes("Recovery") || week.weekName === "Recovery Start" || week.weekName === "Custom Recovery") {
            phaseDisplay = "Recov";
            rowClass += " text-green-200";
            phaseClass = "text-green-200";
            isRest = true;
            restBadge = `<span class="inline-block bg-green-600 text-white text-[8px] px-1 rounded-full">R</span>`;
        } else if (week.blockType === "Peak") {
            phaseClass = "text-orange-200";
        } else {
            phaseClass = "text-slate-300";
        }

        // Gap Check
        if (isRest) {
            const gap = week.week - lastRestWeek - 1;
            if (gap > maxGap) maxGap = gap;
            lastRestWeek = week.week;
        }

        // Format Date (e.g., "Nov 25")
        const dateStr = week.startDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

        // Checkbox Logic
        let checkboxHtml = '';
        let isDisabled = false;

        // Mandatory Checks
        if (week.isRaceWeek || week.blockType === "Taper" || week.blockType === "Peak") {
            isDisabled = true;
        }

        if (!week.isRaceWeek) {
            const isChecked = isRest ? 'checked' : '';
            const disabledAttr = isDisabled ? 'disabled style="opacity: 0.3;"' : '';
            checkboxHtml = `<input type="checkbox" class="rest-week-toggle accent-green-500" data-week="${week.week}" ${isChecked} ${disabledAttr}>`;
        }

        html += `
        <div class="grid grid-cols-6 gap-1 text-[10px] items-center text-center p-1 rounded hover:bg-slate-800 transition-colors ${rowClass}">
            <div class="font-bold text-slate-300">W${week.week}</div>
            <div class="text-slate-500">${dateStr}</div>
            <div class="${phaseClass}">${week.phaseName || week.blockType}</div>
            <div>${checkboxHtml}</div>
            <div class="font-mono text-slate-300">${week.mileage} ${isCycling ? 'TSS' : 'km'}</div>
            <div class="font-mono text-slate-300">${week.longRun} ${isCycling ? 'h' : 'km'}</div>
        </div>`;
    });

    container.innerHTML = html;

    // Warning for Gaps
    if (maxGap > 5) {
        showToast("⚠️ Warning: >5 weeks without rest. Recommended: 3-4 weeks.");
    }

    // Attach Event Listeners to Checkboxes
    const checkboxes = container.querySelectorAll('.rest-week-toggle');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', (e) => {
            const weekNum = parseInt(e.target.dataset.week);

            // LINK WEEK 1 Checkbox
            if (weekNum === 1) {
                const startRestCheckbox = document.getElementById('use-rest-week');
                if (startRestCheckbox) {
                    startRestCheckbox.checked = e.target.checked;
                }
            }

            if (e.target.checked) {
                // Add to custom list
                if (!state.customRestWeeks) state.customRestWeeks = [];
                if (!state.customRestWeeks.includes(weekNum)) {
                    state.customRestWeeks.push(weekNum);
                }
                // Remove from forceBuildWeeks
                state.forceBuildWeeks = state.forceBuildWeeks.filter(w => w !== weekNum);
            } else {
                // Remove from custom list
                state.customRestWeeks = state.customRestWeeks.filter(w => w !== weekNum);

                // Add to forceBuildWeeks
                if (!state.forceBuildWeeks) state.forceBuildWeeks = [];
                if (!state.forceBuildWeeks.includes(weekNum)) {
                    state.forceBuildWeeks.push(weekNum);
                }
            }
            // Re-calculate and show
            viewProgressionFromInputs();
        });
    });
}

// Add Global Listeners for Auto-Update
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners for auto-update
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
                // Only update if the panel is visible
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
});

// --- CONFIGURATION STORAGE ---
function exportConfiguration() {
    try {
        const config = {
            apiKey: state.apiKey,
            athleteId: state.athleteId,
            athleteName: state.athleteName, // Added
            gender: state.gender, // Added

            // AI Config
            aiProvider: state.aiProvider,
            aiApiKey: state.aiApiKey,
            geminiApiKey: state.geminiApiKey,
            deepseekApiKey: state.deepseekApiKey,
            openRouterApiKey: state.openRouterApiKey,
            mistralApiKey: state.mistralApiKey,

            sportType: getVal('sportTypeInput'),
            raceDate: getVal('raceDateInput'),
            goalTime: getVal('goalTimeInput'),
            raceType: getVal('raceTypeInput', 'Marathon'),

            // Profile & Preferences
            trainingHistory: getVal('historyInput'),
            injuries: getVal('injuriesInput'),
            gymAccess: getVal('gymAccessInput'),
            trainingPreferences: getVal('preferencesInput'),
            defaultAvailableDays: state.defaultAvailableDays,
            longRunDay: state.longRunDay,

            // Bio / Zones
            lthrPace: state.lthrPace,
            lthrBpm: state.lthrBpm,

            // Running Inputs
            runDistance: getVal('runDistanceInput'),
            planStartDateRun: getVal('planStartDateInputRun'), // Added

            // Cycling Inputs
            cycleDistance: getVal('cycleDistanceInput'),
            planStartDateCycle: getVal('planStartDateInputCycle'), // Added

            // Smart Planning Inputs
            targetVolume: getVal('target-volume'),
            targetLongRun: getVal('target-long-run'),
            targetLongRunRun: getVal('target-long-run-run'), // Added specific run input
            progressionRate: getVal('progressionRateInput'),
            progressionRateRun: getVal('progressionRateInputRun'), // Added
            progressionRateCycle: getVal('progressionRateInputCycle'), // Added
            longRunProgression: getVal('longRunProgressionInput'),
            taperDuration: getVal('taperDurationInput'),
            taperDurationRun: getVal('taperDurationInputRun'), // Added
            taperDurationCycle: getVal('taperDurationInputCycle'), // Added
            currentFitness: getVal('current-fitness'),

            // State Arrays
            customRestWeeks: state.customRestWeeks || [],
            forceBuildWeeks: state.forceBuildWeeks || [],
            weeklyAvailability: state.weeklyAvailability || {} // Added
        };

        const configStr = btoa(JSON.stringify(config));
        navigator.clipboard.writeText(configStr).then(() => {
            showToast("✅ Config copied to clipboard!");
        });
    } catch (e) {
        console.error("Export failed:", e);
        showToast("❌ Export failed");
    }
}

function importConfiguration() {
    try {
        const input = document.getElementById('importConfigInput');
        const configStr = input.value.trim();

        if (!configStr) {
            showToast("⚠️ Please paste a config string");
            return;
        }

        const config = JSON.parse(atob(configStr));

        // Restore Values
        if (config.apiKey) {
            state.apiKey = config.apiKey;
            if (document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = config.apiKey;
        }
        if (config.athleteId) {
            state.athleteId = config.athleteId;
            if (document.getElementById('athleteIdInput')) document.getElementById('athleteIdInput').value = config.athleteId;
        }
        if (config.athleteName) state.athleteName = config.athleteName;
        if (config.gender) state.gender = config.gender;

        // AI Config
        if (config.aiProvider) {
            state.aiProvider = config.aiProvider;
            if (document.getElementById('aiProviderSelect')) document.getElementById('aiProviderSelect').value = config.aiProvider;
        }
        if (config.aiApiKey) {
            state.aiApiKey = config.aiApiKey;
            if (document.getElementById('aiApiKeyInput')) document.getElementById('aiApiKeyInput').value = config.aiApiKey;
        }
        if (config.geminiApiKey) {
            state.geminiApiKey = config.geminiApiKey;
            if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = config.geminiApiKey;
        }
        if (config.deepseekApiKey) {
            state.deepseekApiKey = config.deepseekApiKey;
            if (document.getElementById('deepseekApiKeyInput')) document.getElementById('deepseekApiKeyInput').value = config.deepseekApiKey;
        }
        if (config.openRouterApiKey) {
            state.openRouterApiKey = config.openRouterApiKey;
            if (document.getElementById('openRouterApiKeyInput')) document.getElementById('openRouterApiKeyInput').value = config.openRouterApiKey;
        }
        if (config.mistralApiKey) {
            state.mistralApiKey = config.mistralApiKey;
            if (document.getElementById('mistralApiKeyInput')) document.getElementById('mistralApiKeyInput').value = config.mistralApiKey;
        }
        toggleProviderFields(); // Update UI

        // Profile & Preferences
        if (config.trainingHistory) {
            state.trainingHistory = config.trainingHistory;
            if (document.getElementById('historyInput')) document.getElementById('historyInput').value = config.trainingHistory;
        }
        if (config.injuries) {
            state.injuries = config.injuries;
            if (document.getElementById('injuriesInput')) document.getElementById('injuriesInput').value = config.injuries;
        }
        if (config.gymAccess) {
            state.gymAccess = config.gymAccess;
            if (document.getElementById('gymAccessInput')) document.getElementById('gymAccessInput').value = config.gymAccess;
        }
        if (config.trainingPreferences) {
            state.trainingPreferences = config.trainingPreferences;
            if (document.getElementById('preferencesInput')) document.getElementById('preferencesInput').value = config.trainingPreferences;
        }

        // Days & Zones
        if (config.defaultAvailableDays) {
            state.defaultAvailableDays = config.defaultAvailableDays;
            // Update checkboxes
            const dayIds = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
            dayIds.forEach((id, index) => {
                const dayValue = index === 6 ? 0 : index + 1;
                const checkbox = document.getElementById(id);
                if (checkbox) checkbox.checked = state.defaultAvailableDays.includes(dayValue);
            });
        }
        if (config.longRunDay !== undefined) {
            state.longRunDay = config.longRunDay;
            if (document.getElementById('longRunDayInput')) document.getElementById('longRunDayInput').value = config.longRunDay;
        }
        if (config.lthrPace) state.lthrPace = config.lthrPace;
        if (config.lthrBpm) state.lthrBpm = config.lthrBpm;


        if (config.sportType) document.getElementById('sportTypeInput').value = config.sportType;
        toggleSportFields(); // Trigger UI update

        if (config.raceDate) document.getElementById('raceDateInput').value = config.raceDate;
        if (config.goalTime) document.getElementById('goalTimeInput').value = config.goalTime;
        if (config.raceType && document.getElementById('raceTypeInput')) document.getElementById('raceTypeInput').value = config.raceType;

        if (config.runDistance && document.getElementById('runDistanceInput')) document.getElementById('runDistanceInput').value = config.runDistance;
        if (config.cycleDistance && document.getElementById('cycleDistanceInput')) document.getElementById('cycleDistanceInput').value = config.cycleDistance;

        if (config.planStartDateRun && document.getElementById('planStartDateInputRun')) document.getElementById('planStartDateInputRun').value = config.planStartDateRun;
        if (config.planStartDateCycle && document.getElementById('planStartDateInputCycle')) document.getElementById('planStartDateInputCycle').value = config.planStartDateCycle;

        if (config.targetVolume && document.getElementById('target-volume')) document.getElementById('target-volume').value = config.targetVolume;
        if (config.targetLongRun && document.getElementById('target-long-run')) document.getElementById('target-long-run').value = config.targetLongRun;
        if (config.targetLongRunRun && document.getElementById('target-long-run-run')) document.getElementById('target-long-run-run').value = config.targetLongRunRun;

        if (config.progressionRate && document.getElementById('progressionRateInput')) document.getElementById('progressionRateInput').value = config.progressionRate;
        if (config.progressionRateRun && document.getElementById('progressionRateInputRun')) document.getElementById('progressionRateInputRun').value = config.progressionRateRun;
        if (config.progressionRateCycle && document.getElementById('progressionRateInputCycle')) document.getElementById('progressionRateInputCycle').value = config.progressionRateCycle;

        if (config.longRunProgression && document.getElementById('longRunProgressionInput')) document.getElementById('longRunProgressionInput').value = config.longRunProgression;

        if (config.taperDuration && document.getElementById('taperDurationInput')) document.getElementById('taperDurationInput').value = config.taperDuration;
        if (config.taperDurationRun && document.getElementById('taperDurationInputRun')) document.getElementById('taperDurationInputRun').value = config.taperDurationRun;
        if (config.taperDurationCycle && document.getElementById('taperDurationInputCycle')) document.getElementById('taperDurationInputCycle').value = config.taperDurationCycle;

        if (config.currentFitness && document.getElementById('current-fitness')) document.getElementById('current-fitness').value = config.currentFitness;

        // Restore State
        state.customRestWeeks = config.customRestWeeks || [];
        state.forceBuildWeeks = config.forceBuildWeeks || [];
        state.weeklyAvailability = config.weeklyAvailability || {};

        // Sync State from Config/Inputs
        state.sportType = getVal('sportTypeInput');
        state.raceDate = getVal('raceDateInput');
        state.goalTime = getVal('goalTimeInput');
        state.raceType = getVal('raceTypeInput', 'Marathon');

        // Persist to Local Storage
        localStorage.setItem('elite_raceDate', state.raceDate);
        localStorage.setItem('elite_goalTime', state.goalTime);
        localStorage.setItem('elite_raceType', state.raceType);
        localStorage.setItem('elite_sportType', state.sportType);
        localStorage.setItem('elite_gender', state.gender); // Persist Gender
        localStorage.setItem('elite_apiKey', state.apiKey);
        localStorage.setItem('elite_athleteId', state.athleteId);
        localStorage.setItem('elite_aiProvider', state.aiProvider);
        if (state.aiApiKey) localStorage.setItem('elite_aiApiKey', state.aiApiKey);
        if (state.geminiApiKey) localStorage.setItem('elite_geminiApiKey', state.geminiApiKey);

        // Persist Profile
        localStorage.setItem('elite_history', state.trainingHistory);
        localStorage.setItem('elite_injuries', state.injuries);
        localStorage.setItem('elite_gymAccess', state.gymAccess);
        localStorage.setItem('elite_preferences', state.trainingPreferences);

        // Persist Availability
        localStorage.setItem('elite_defaultAvail', JSON.stringify(state.defaultAvailableDays));
        localStorage.setItem('elite_longRunDay', state.longRunDay);
        localStorage.setItem('elite_weeklyAvail', JSON.stringify(state.weeklyAvailability));

        showToast("✅ Configuration Loaded!");

        // Trigger Plan Generation
        console.log("Import complete. Generating plan...");
        generateTrainingPlan();

        // Force render
        setTimeout(() => {
            renderWeeklyPlan();
            // Scroll to plan
            const planContainer = document.getElementById('planContainer');
            if (planContainer) {
                planContainer.scrollIntoView({ behavior: 'smooth' });
            }
        }, 500);

    } catch (e) {
        console.error("Import failed:", e);
        showToast("❌ Invalid Config String");
    }
}

// --- DEBUG PROMPT LOGIC (UPDATED) ---
let lastDebugPrompt = "";

function updateDebugPrompt(promptText) {
    lastDebugPrompt = promptText;
    const contentEl = document.getElementById('debugPromptContent');
    if (contentEl) {
        contentEl.textContent = promptText;
    }
    console.log("Debug Prompt updated (" + promptText.length + " chars)");
}

function toggleDebugPrompt(forceState) {
    const modal = document.getElementById('debugPromptModal');
    if (!modal) return;

    const isHidden = modal.classList.contains('hidden');
    const shouldShow = forceState !== undefined ? forceState : isHidden;

    if (shouldShow) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
}

function copyDebugPrompt() {
    if (!lastDebugPrompt) return;
    navigator.clipboard.writeText(lastDebugPrompt).then(() => {
        showToast("Prompt copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast("Failed to copy");
    });
}

// Expose functions to window
window.updateDebugPrompt = updateDebugPrompt;
window.toggleDebugPrompt = toggleDebugPrompt;
window.copyDebugPrompt = copyDebugPrompt;

// --- FEEDBACK ---
function sendFeedback() {
    const message = document.getElementById('feedbackMessage').value.trim();
    if (!message) {
        showToast("⚠️ Please enter a message.");
        return;
    }

    const subject = encodeURIComponent("Simple AI Coach Feedback");
    const body = encodeURIComponent(message);
    const mailtoLink = `mailto:rpkranendonk@gmail.com?subject=${subject}&body=${body}`;

    window.location.href = mailtoLink;
    showToast("📧 Opening email client...");
}

// Explicitly expose populateSportDropdown
window.populateSportDropdown = populateSportDropdown;
console.log("UI.js: Loaded successfully");