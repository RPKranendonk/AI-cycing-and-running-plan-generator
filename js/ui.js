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
    if (t) {
        document.getElementById('toastMsg').innerText = msg;
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

function toggleSportFields() {
    const sport = document.getElementById('sportTypeInput').value;
    const runContainer = document.getElementById('runDistanceContainer');
    const cycleContainer = document.getElementById('cycleDistanceContainer');
    const fitnessContainer = document.getElementById('currentFitnessContainer');

    // Labels to update
    const lblStartVol = document.getElementById('lbl-start-vol');
    const lblProgression = document.getElementById('lbl-progression');
    const lblStartLR = document.getElementById('lbl-start-lr');
    const progSelect = document.getElementById('progressionRateInput');
    const lrProgContainer = document.getElementById('lr-progression-container');
    const taperContainer = document.getElementById('taperContainer');

    // Update State
    state.sportType = sport;
    localStorage.setItem('elite_sportType', sport);

    if (sport === 'Cycling') {
        // Show/Hide Containers
        if (runContainer) runContainer.classList.add('hidden');
        if (cycleContainer) cycleContainer.classList.remove('hidden');
        if (fitnessContainer) fitnessContainer.classList.remove('hidden'); // Show CTL for cycling
        if (lrProgContainer) lrProgContainer.classList.add('hidden'); // Hide LR Prog for cycling (auto-calc)
        if (taperContainer) taperContainer.classList.add('hidden'); // Fixed taper for now

        // Update Labels
        if (lblStartVol) lblStartVol.innerText = "Start Load (TSS)";
        if (lblProgression) lblProgression.innerText = "Ramp Rate (TSS/wk)";
        if (lblStartLR) lblStartLR.innerText = "Start Long Ride (Hours)";

        // Update Progression Options (Ramp Rate)
        if (progSelect) {
            progSelect.innerHTML = `
                <option value="3">3 pts (Conservative)</option>
                <option value="5" selected>5 pts (Optimal)</option>
                <option value="7">7 pts (Aggressive)</option>
            `;
        }

    } else {
        // Running
        if (runContainer) runContainer.classList.remove('hidden');
        if (cycleContainer) cycleContainer.classList.add('hidden');
        if (fitnessContainer) fitnessContainer.classList.add('hidden');
        if (lrProgContainer) lrProgContainer.classList.remove('hidden');
        if (taperContainer) taperContainer.classList.remove('hidden');

        // Update Labels
        if (lblStartVol) lblStartVol.innerText = "Start Volume (km)";
        if (lblProgression) lblProgression.innerText = "Weekly Progression";
        if (lblStartLR) lblStartLR.innerText = "Start Long Run (km)";

        // Update Progression Options (Percentage)
        if (progSelect) {
            progSelect.innerHTML = `
                <option value="0.05">5% (Easy)</option>
                <option value="0.075">7.5% (Normal)</option>
                <option value="0.10" selected>10% (Aggr.)</option>
            `;
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
        const planStartInput = document.getElementById('planStartDateInput');
        if (planStartInput) {
            // Default to next Monday
            const day = today.getDay();
            const diff = (1 + 7 - day) % 7;
            const daysToAdd = diff === 0 ? 7 : diff; // If today is Monday (0), add 7 days

            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + daysToAdd);

            planStartInput.valueAsDate = targetDate;
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
    const vol = parseFloat(document.getElementById('target-volume').value) || 0;
    const lr = parseFloat(document.getElementById('target-long-run').value) || 0;
    const raceDate = document.getElementById('raceDateInput').value;

    if (!raceDate) {
        showToast("ℹ️ Please set a Race Date first.");
        return;
    }

    generateProgressionCalendar(vol, lr, raceDate);
    toggleProgressionSidePanel(true);
}

function generateProgressionCalendar(startVol, startLR, raceDateStr) {
    const container = document.getElementById('progression-calendar-content');
    if (!container) {
        console.error("progression-calendar-content container not found!");
        return;
    }

    // Get options from UI
    const startWithRestWeek = document.getElementById('use-rest-week') ? document.getElementById('use-rest-week').checked : false;
    const taperDuration = document.getElementById('taperDurationInput') ? parseInt(document.getElementById('taperDurationInput').value) : 3;
    const longRunProgression = document.getElementById('longRunProgressionInput') ? parseFloat(document.getElementById('longRunProgressionInput').value) : 2.0;
    const progressionRate = document.getElementById('progressionRateInput') ? parseFloat(document.getElementById('progressionRateInput').value) : 0.10;
    const raceType = document.getElementById('raceTypeInput') ? document.getElementById('raceTypeInput').value : "Marathon";
    const sportType = document.getElementById('sportTypeInput') ? document.getElementById('sportTypeInput').value : "Running";
    const isCycling = sportType === "Cycling";

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
    const planStartInput = document.getElementById('planStartDateInput');
    const planStartDate = planStartInput && planStartInput.value ? new Date(planStartInput.value) : new Date();

    // Calculate Total Weeks based on Plan Start Date
    const msPerWeek = 1000 * 60 * 60 * 24 * 7;
    const rDate = new Date(raceDateStr);

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
        const rampRate = parseInt(document.getElementById('progressionRateInput').value) || 5;
        const startLongRide = parseFloat(document.getElementById('target-long-run').value) || 1.5;
        const longRideCap = 4.0;
        const taperDuration = parseInt(document.getElementById('taperDurationInput').value) || 1;

        const advancedPlan = calculateAdvancedCyclingPlan(
            currentCtl,
            rampRate,
            startLongRide,
            longRideCap,
            totalWeeks,
            state.customRestWeeks || [],
            taperDuration,
            state.forceBuildWeeks || [],
            startWithRestWeek,
            planStartDate
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
                mileage: w.goalLoad,
                rawKm: w.goalLoad, // Added for API upload compatibility
                longRun: w.longRideDuration,
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
    html += `<div>Week</div><div>Date</div><div>Phase</div><div>Rest?</div><div>${isCycling ? 'Load' : 'Volume'}</div><div>${isCycling ? 'Long Ride' : 'Long Run'}</div><div>Action</div></div>`;

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
        <div class="grid grid-cols-7 gap-1 text-[10px] items-center text-center p-1 rounded hover:bg-slate-800 transition-colors ${rowClass}">
            <div class="font-bold text-slate-300">W${week.week}</div>
            <div class="text-slate-500">${dateStr}</div>
            <div class="${phaseClass}">${week.phaseName || week.blockType}</div>
            <div>${checkboxHtml}</div>
            <div class="font-mono text-slate-300">${week.mileage} ${isCycling ? 'TSS' : 'km'}</div>
            <div class="font-mono text-slate-300">${week.longRun} ${isCycling ? 'h' : 'km'}</div>
            <div>
                <button id="push-week-btn-${index}" onclick="pushSingleWeekTarget(${index})" 
                    class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-[9px] transition-colors"
                    title="Push this week's target to Intervals.icu">
                    Push
                </button>
            </div>
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
    const inputs = ['target-volume', 'target-long-run', 'raceDateInput', 'planStartDateInput', 'taperDurationInput', 'longRunProgressionInput', 'progressionRateInput', 'raceTypeInput'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', () => {
                // Only update if the panel is visible (or we want it to be)
                // For now, let's update if we have enough info
                if (document.getElementById('raceDateInput').value) {
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
            sportType: getVal('sportTypeInput'),
            raceDate: getVal('raceDateInput'),
            goalTime: getVal('goalTimeInput'),
            raceType: getVal('raceTypeInput', 'Marathon'),

            // Running Inputs
            runDistance: getVal('runDistanceInput'),

            // Cycling Inputs
            cycleDistance: getVal('cycleDistanceInput'),

            // Smart Planning Inputs
            targetVolume: getVal('target-volume'),
            targetLongRun: getVal('target-long-run'),
            progressionRate: getVal('progressionRateInput'),
            longRunProgression: getVal('longRunProgressionInput'),
            taperDuration: getVal('taperDurationInput'),
            currentFitness: getVal('current-fitness'),

            // State Arrays
            customRestWeeks: state.customRestWeeks || [],
            forceBuildWeeks: state.forceBuildWeeks || []
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

        if (config.sportType) document.getElementById('sportTypeInput').value = config.sportType;
        toggleSportFields(); // Trigger UI update

        if (config.raceDate) document.getElementById('raceDateInput').value = config.raceDate;
        if (config.goalTime) document.getElementById('goalTimeInput').value = config.goalTime;
        if (config.raceType && document.getElementById('raceTypeInput')) document.getElementById('raceTypeInput').value = config.raceType;

        if (config.runDistance && document.getElementById('runDistanceInput')) document.getElementById('runDistanceInput').value = config.runDistance;
        if (config.cycleDistance && document.getElementById('cycleDistanceInput')) document.getElementById('cycleDistanceInput').value = config.cycleDistance;

        if (config.targetVolume) document.getElementById('target-volume').value = config.targetVolume;
        if (config.targetLongRun) document.getElementById('target-long-run').value = config.targetLongRun;
        if (config.progressionRate) document.getElementById('progressionRateInput').value = config.progressionRate;
        if (config.longRunProgression && document.getElementById('longRunProgressionInput')) document.getElementById('longRunProgressionInput').value = config.longRunProgression;
        if (config.taperDuration) document.getElementById('taperDurationInput').value = config.taperDuration;
        if (config.currentFitness) document.getElementById('current-fitness').value = config.currentFitness;

        // Restore State
        state.customRestWeeks = config.customRestWeeks || [];
        state.forceBuildWeeks = config.forceBuildWeeks || [];

        // Sync State from Config/Inputs
        state.sportType = getVal('sportTypeInput');
        state.raceDate = getVal('raceDateInput');
        state.goalTime = getVal('goalTimeInput');
        state.raceType = getVal('raceTypeInput', 'Marathon');

        // Persist to LocalStorage (like saveSettings)
        localStorage.setItem('elite_raceDate', state.raceDate);
        localStorage.setItem('elite_goalTime', state.goalTime);
        localStorage.setItem('elite_raceType', state.raceType);
        localStorage.setItem('elite_sportType', state.sportType);

        showToast("✅ Configuration Loaded!");

        // Regenerate and Render
        generateTrainingPlan();
        renderWeeklyPlan();

        // Auto-refresh preview if possible
        if (config.raceDate) {
            viewProgressionFromInputs();
        }

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