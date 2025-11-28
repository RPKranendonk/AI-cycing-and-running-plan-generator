// ==========================================
// UI LOGIC: DOM MANIPULATION & INTERACTION
// ==========================================

// --- SETUP MODAL HELPERS ---
function openSetup() {
    document.getElementById('setupModal').classList.remove('hidden');
    document.getElementById('setupModal').classList.add('flex');
    if (typeof toggleProgressionSidePanel === 'function') toggleProgressionSidePanel(false);
}
function closeSetup() { document.getElementById('setupModal').classList.add('hidden'); }
function showToast(msg) {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    if (t && msgEl) {
        msgEl.innerText = msg;
        t.classList.remove('translate-x-full');
        setTimeout(() => t.classList.add('translate-x-full'), 3000);
    }
}

function showAILoading(message = "Generating AI Plan...") {
    const overlay = document.getElementById('aiLoadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    if (overlay) {
        if (messageEl) messageEl.textContent = message;
        overlay.classList.remove('hidden');
    }
}

function hideAILoading() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

function toggleProviderFields() {
    const provider = document.getElementById('aiProviderSelect').value;
    const openaiField = document.getElementById('openai-field');
    const geminiField = document.getElementById('gemini-field');

    if (provider === 'openai') {
        openaiField.classList.remove('hidden');
        geminiField.classList.add('hidden');
    } else {
        openaiField.classList.add('hidden');
        geminiField.classList.remove('hidden');
    }
}

// --- HELPER: Safe DOM Access ---
function getVal(id, defaultVal = "") {
    const el = document.getElementById(id);
    return el ? el.value : defaultVal;
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

        state.athleteName = `${data.firstname} ${data.lastname}`;
        state.athleteId = data.id;

        // Update UI with resolved ID
        const idInput = document.getElementById('athleteIdInput');
        if (idInput) idInput.value = data.id;

        if (statusBox) {
            statusBox.innerHTML = `
                <div class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> Connected as ${state.athleteName}</div>
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
    // Trigger the progression view logic
    viewProgressionFromInputs();

    // Ensure side panel is visible (viewProgressionFromInputs does this, but let's be explicit if needed)
    // Also, if sport changes, we might want to hide the plan?
    // The user said: "When I change sport afterwards it should dissappear again."
    // This is handled in toggleSportFields.
}

function toggleSportFields() {
    const sport = document.getElementById('sportTypeInput').value;
    const cyclingContainer = document.getElementById('cycling-config-container');
    const runningContainer = document.getElementById('running-config-container');

    // Race Goal Distance Containers
    const runDistanceContainer = document.getElementById('runDistanceContainer');
    const cycleDistanceContainer = document.getElementById('cycleDistanceContainer');

    // Update State
    state.sportType = sport;
    localStorage.setItem('elite_sportType', sport);

    // Hide Plan Configuration (Step 4) and Action (Step 5) to force reset/re-check
    document.getElementById('step-4-inputs').classList.add('hidden');
    document.getElementById('step-5-plan-action').classList.add('hidden');
    document.getElementById('progressionSidePanel').classList.add('hidden');

    if (sport === 'Cycling') {
        if (cyclingContainer) cyclingContainer.classList.remove('hidden');
        if (runningContainer) runningContainer.classList.add('hidden');

        // Toggle Distance Fields
        if (runDistanceContainer) runDistanceContainer.classList.add('hidden');
        if (cycleDistanceContainer) cycleDistanceContainer.classList.remove('hidden');
    } else {
        if (cyclingContainer) cyclingContainer.classList.add('hidden');
        if (runningContainer) runningContainer.classList.remove('hidden');

        // Toggle Distance Fields
        if (runDistanceContainer) runDistanceContainer.classList.remove('hidden');
        if (cycleDistanceContainer) cycleDistanceContainer.classList.add('hidden');
    }
}

// --- GOAL FEEDBACK LOGIC ---
// Note: This relies on assessMarathonGoal() from goal-assessment.js

function updateGoalFeedback() {
    const goalTime = document.getElementById('goalTimeInput').value.trim();
    const raceDate = document.getElementById('raceDateInput').value;
    const feedbackContainer = document.getElementById('goalFeedback');

    if (!feedbackContainer) return;

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

        state.athleteName = `${data.firstname} ${data.lastname}`;
        state.apiKey = apiKey;
        state.athleteId = data.id;

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

        statusBox.innerHTML = `
            <div class="space-y-1">
                <div class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> Connected as ${state.athleteName}</div>
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
    state.apiKey = getVal('apiKeyInput').trim();
    state.athleteId = getVal('athleteIdInput').trim();
    state.trainingHistory = getVal('historyInput');
    state.injuries = getVal('injuriesInput');
    state.gymAccess = getVal('gymAccessInput');
    state.trainingPreferences = getVal('preferencesInput');

    // New Smart Planner Inputs
    state.startingVolume = getVal('target-volume');
    state.startingLongRun = getVal('target-long-run');
    state.startWithRestWeek = document.getElementById('use-rest-week') ? document.getElementById('use-rest-week').checked : false;

    state.aiApiKey = getVal('aiApiKeyInput');
    state.geminiApiKey = getVal('geminiApiKeyInput');
    state.aiProvider = getVal('aiProviderSelect');
    state.raceDate = getVal('raceDateInput');
    state.goalTime = getVal('goalTimeInput');

    // Sport & Distance Logic
    state.sportType = getVal('sportTypeInput', 'Running');

    if (state.sportType === "Cycling") {
        const dist = getVal('cycleDistanceInput');
        state.raceType = dist ? `${dist}km Ride` : "Cycling";
    } else {
        state.raceType = getVal('raceTypeInput', 'Marathon');
    }

    // Sync Configurator Inputs
    state.taperDuration = document.getElementById('taperDurationInput') ? parseInt(document.getElementById('taperDurationInput').value) : 3;
    state.longRunProgression = document.getElementById('longRunProgressionInput') ? parseFloat(document.getElementById('longRunProgressionInput').value) : 2.0;
    state.progressionRate = document.getElementById('progressionRateInput') ? parseFloat(document.getElementById('progressionRateInput').value) : 0.10;
    state.rampRate = document.getElementById('rampRateInput') ? parseInt(document.getElementById('rampRateInput').value) : 5;
    state.startTss = document.getElementById('startTssInput') ? parseInt(document.getElementById('startTssInput').value) : null;

    localStorage.setItem('elite_apiKey', state.apiKey);
    localStorage.setItem('elite_athleteId', state.athleteId);
    localStorage.setItem('elite_raceDate', state.raceDate);
    localStorage.setItem('elite_goalTime', state.goalTime);
    localStorage.setItem('elite_raceDate', state.raceDate);
    localStorage.setItem('elite_goalTime', state.goalTime);
    localStorage.setItem('elite_raceType', state.raceType);
    localStorage.setItem('elite_sportType', state.sportType);
    localStorage.setItem('elite_rampRate', state.rampRate);
    localStorage.setItem('elite_startTss', state.startTss);
    localStorage.setItem('elite_aiApiKey', state.aiApiKey);
    localStorage.setItem('elite_geminiApiKey', state.geminiApiKey);
    localStorage.setItem('elite_aiProvider', state.aiProvider);
    localStorage.setItem('elite_trainingHistory', state.trainingHistory);
    localStorage.setItem('elite_injuries', state.injuries);
    localStorage.setItem('elite_gymAccess', state.gymAccess);
    localStorage.setItem('elite_trainingPreferences', state.trainingPreferences);
    localStorage.setItem('elite_taperDuration', state.taperDuration);
    localStorage.setItem('elite_longRunProgression', state.longRunProgression);
    localStorage.setItem('elite_longRunProgression', state.longRunProgression);
    localStorage.setItem('elite_progressionRate', state.progressionRate);

    state.currentFitness = document.getElementById('current-fitness').value;
    localStorage.setItem('elite_currentFitness', state.currentFitness);

    // Persist Smart Planner Inputs
    localStorage.setItem('elite_startingVolume', state.startingVolume);
    localStorage.setItem('elite_startingLongRun', state.startingLongRun);
    localStorage.setItem('elite_startWithRestWeek', state.startWithRestWeek);

    const days = [];
    const dayMapping = [1, 2, 3, 4, 5, 6, 0];
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((d, i) => {
        if (document.getElementById(`day${d}`).checked) days.push(dayMapping[i]);
    });
    state.defaultAvailableDays = days;
    localStorage.setItem('elite_defaultDays', JSON.stringify(days));

    state.longRunDay = parseInt(document.getElementById('longRunDayInput').value);
    localStorage.setItem('elite_longRunDay', state.longRunDay);

    showToast("Configuration Saved");
    closeSetup();

    // Re-run the main generation logic
    generateTrainingPlan();
    renderWeeklyPlan();
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

function viewProgressionFromInputs() {
    // Get Inputs
    const sportType = state.sportType || 'Running';
    let vol, lr, startDate;

    if (sportType === 'Cycling') {
        // Cycling Inputs
        vol = parseFloat(document.getElementById('current-fitness').value) || 0;
        lr = parseFloat(document.getElementById('target-long-run').value) || 0;
        startDate = document.getElementById('planStartDateInputCycle').value;
    } else {
        // Running Inputs
        vol = parseFloat(document.getElementById('target-volume').value) || 0;
        lr = parseFloat(document.getElementById('target-long-run-run').value) || 0;
        startDate = document.getElementById('planStartDateInputRun').value;
    }

    const raceDate = document.getElementById('raceDateInput').value;

    if (!startDate || !raceDate) return;

    generateProgressionCalendar(vol, lr, raceDate, startDate);
    toggleProgressionSidePanel(true);
}

function generateProgressionCalendar(startVol, startLR, raceDateStr, planStartDateStr) {
    const container = document.getElementById('progression-calendar-content');
    if (!container) {
        console.error("progression-calendar-content container not found!");
        return;
    }

    // Get options from UI
    const startWithRestWeek = document.getElementById('use-rest-week') ? document.getElementById('use-rest-week').checked : false;
    const raceType = document.getElementById('raceTypeInput') ? document.getElementById('raceTypeInput').value : "Marathon";
    const sportType = document.getElementById('sportTypeInput') ? document.getElementById('sportTypeInput').value : "Running";
    const isCycling = sportType === "Cycling";

    let taperDuration, longRunProgression, progressionRate;

    if (isCycling) {
        taperDuration = document.getElementById('taperDurationInputCycle') ? parseInt(document.getElementById('taperDurationInputCycle').value) : 1;
        progressionRate = document.getElementById('progressionRateInputCycle') ? parseFloat(document.getElementById('progressionRateInputCycle').value) : 5;
        // longRunProgression not used for cycling
    } else {
        taperDuration = document.getElementById('taperDurationInputRun') ? parseInt(document.getElementById('taperDurationInputRun').value) : 3;
        progressionRate = document.getElementById('progressionRateInputRun') ? parseFloat(document.getElementById('progressionRateInputRun').value) : 0.10;
        longRunProgression = document.getElementById('longRunProgressionInput') ? parseFloat(document.getElementById('longRunProgressionInput').value) : 2.0;
    }

    // Initialize customRestWeeks in state if not present
    if (!state.customRestWeeks) {
        state.customRestWeeks = [];
    }
    // Initialize forceBuildWeeks in state if not present
    if (!state.forceBuildWeeks) {
        state.forceBuildWeeks = [];
    }

    const options = {
        progressionRate: progressionRate,
        startWithRestWeek: startWithRestWeek,
        taperDuration: taperDuration,
        longRunProgression: longRunProgression,
        customRestWeeks: state.customRestWeeks,
        forceBuildWeeks: state.forceBuildWeeks,
        raceType: raceType
    };

    let plan = [];

    // Get Plan Start Date (default to Today if not set)
    const planStartDate = planStartDateStr ? new Date(planStartDateStr) : new Date();
    planStartDate.setHours(0, 0, 0, 0);

    // Calculate Total Weeks based on Plan Start Date
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const rDate = new Date(raceDateStr);
    rDate.setHours(0, 0, 0, 0);

    if (isNaN(rDate.getTime()) || isNaN(planStartDate.getTime())) return;

    const totalWeeks = Math.ceil((rDate - planStartDate) / msPerWeek);

    // Safety Check: Prevent massive loops if dates are far apart (e.g. user typing year 202)
    if (totalWeeks > 104 || totalWeeks < 1) { // Max 2 years
        container.innerHTML = '<div class="text-red-400 text-center p-4">Invalid Date Range (Check Year)</div>';
        return;
    }

    if (isCycling) {
        // Calculate Total Weeks (Already done above)

        // Get Inputs
        const currentCtl = parseFloat(document.getElementById('current-fitness').value) || 40;
        const rampRate = parseInt(document.getElementById('progressionRateInputCycle').value) || 5;
        const startLongRide = parseFloat(document.getElementById('target-long-run').value) || 1.5;
        const longRideCap = 4.0;
        const taperDurationCycle = parseInt(document.getElementById('taperDurationInputCycle').value) || 1;

        const cyclingOptions = {
            rampRate: rampRate,
            taperDuration: taperDurationCycle,
            longRideCap: longRideCap,
            customRestWeeks: state.customRestWeeks || [],
            forceBuildWeeks: state.forceBuildWeeks || [],
            startWithRestWeek: startWithRestWeek,
            planStartDate: planStartDate
        };

        const advancedPlan = calculateAdvancedCyclingPlan(
            currentCtl, // startTss (using CTL as proxy for start load logic in function)
            currentCtl, // currentCtl
            raceDateStr,
            cyclingOptions,
            startLongRide
        );

        // Map to UI structure
        plan = advancedPlan.map(w => {
            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + ((w.week - 1) * 7));
            return {
                week: w.week,
                blockType: w.isRecovery ? "Recovery" : "Build",
                weekName: w.weekName,
                phaseName: w.phaseName,
                startDateObj: weekStart,
                startDate: weekStart.toISOString(),
                mileage: w.mileage, // Correct property from planning-cycling.js
                rawKm: w.rawKm, // Correct property from planning-cycling.js
                longRun: w.longRun, // Correct property from planning-cycling.js
                isRaceWeek: w.isRaceWeek // Use the calculated property
            };
        });

    } else {
        plan = calculateMarathonPlan(startVol, startLR, raceDateStr, planStartDate, options);
    }

    // Save the plan to state so it can be used by the final generation step
    state.generatedPlan = plan;

    if (!plan || plan.length === 0) {
        container.innerHTML = '<div class="text-red-400 text-center p-4">Race date is in the past or too close!</div>';
        return;
    }

    // Pre-fill customRestWeeks based on the plan's suggestions (only on first run/reset)
    // Actually, better to just let the checkboxes reflect the plan state.

    let html = '<div class="grid grid-cols-7 gap-1 text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 mb-1 text-center">';
    html += `<div>Week</div><div>Date</div><div>Phase</div><div>Rest?</div><div>${isCycling ? 'Load' : 'Volume'}</div><div>${isCycling ? 'Long Ride' : 'Long Run'}</div></div>`;

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
        // User requested to unblock the last recovery week
        // if (index === lastRecoveryWeekIndex) {
        //    isDisabled = true; // Last Recovery Week is mandatory
        // }

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
                    // Update the UI element without triggering the event listener loop
                    // We just want the visual state to match
                    startRestCheckbox.checked = e.target.checked;

                    // If we uncheck Week 1, we might want to reset the "Conservative/Aggressive" inputs?
                    // Or just let the user handle it. The main issue was the loop.
                    // Let's NOT dispatch the event here, just sync the checked state.
                }
            }

            if (e.target.checked) {
                // Add to custom list
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

            // AI Config
            aiProvider: state.aiProvider,
            aiApiKey: state.aiApiKey,
            geminiApiKey: state.geminiApiKey,

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