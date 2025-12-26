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
    state.apiKey = document.getElementById('apiKeyInput').value.trim();
    state.athleteId = document.getElementById('athleteIdInput').value.trim();
    state.trainingHistory = document.getElementById('historyInput').value;
    state.injuries = document.getElementById('injuriesInput').value;
    state.gymAccess = document.getElementById('gymAccessInput').value;
    state.trainingPreferences = document.getElementById('preferencesInput').value;

    // New Smart Planner Inputs
    state.startingVolume = document.getElementById('target-volume').value;
    state.startingLongRun = document.getElementById('target-long-run').value;
    state.startWithRestWeek = document.getElementById('use-rest-week') ? document.getElementById('use-rest-week').checked : false;

    state.aiApiKey = document.getElementById('aiApiKeyInput').value;
    state.geminiApiKey = document.getElementById('geminiApiKeyInput').value;
    state.aiProvider = document.getElementById('aiProviderSelect').value;
    state.raceDate = document.getElementById('raceDateInput').value;
    state.goalTime = document.getElementById('goalTimeInput').value;
    state.goalTime = document.getElementById('goalTimeInput').value;
    state.raceType = document.getElementById('raceTypeInput') ? document.getElementById('raceTypeInput').value : "Marathon";

    // Sync Configurator Inputs
    state.taperDuration = document.getElementById('taperDurationInput') ? parseInt(document.getElementById('taperDurationInput').value) : 3;
    state.longRunProgression = document.getElementById('longRunProgressionInput') ? parseFloat(document.getElementById('longRunProgressionInput').value) : 2.0;
    state.progressionRate = document.getElementById('progressionRateInput') ? parseFloat(document.getElementById('progressionRateInput').value) : 0.10;

    localStorage.setItem('elite_apiKey', state.apiKey);
    localStorage.setItem('elite_athleteId', state.athleteId);
    localStorage.setItem('elite_raceDate', state.raceDate);
    localStorage.setItem('elite_goalTime', state.goalTime);
    localStorage.setItem('elite_raceType', state.raceType);
    localStorage.setItem('elite_aiApiKey', state.aiApiKey);
    localStorage.setItem('elite_geminiApiKey', state.geminiApiKey);
    localStorage.setItem('elite_aiProvider', state.aiProvider);
    localStorage.setItem('elite_trainingHistory', state.trainingHistory);
    localStorage.setItem('elite_injuries', state.injuries);
    localStorage.setItem('elite_gymAccess', state.gymAccess);
    localStorage.setItem('elite_trainingPreferences', state.trainingPreferences);
    localStorage.setItem('elite_taperDuration', state.taperDuration);
    localStorage.setItem('elite_longRunProgression', state.longRunProgression);
    localStorage.setItem('elite_progressionRate', state.progressionRate);

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

async function calculateSmartBlock() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const athleteId = document.getElementById('athleteIdInput').value.trim();

    if (!apiKey || !athleteId) {
        showToast('❌ Please enter API Key and Athlete ID');
        return;
    }

    const resultDiv = document.getElementById('smart-plan-result');
    resultDiv.classList.remove('hidden');
    document.getElementById('weekly-breakdown').textContent = 'Fetching and analyzing...';

    try {
        // 1. Fetch Activities (Last Full 4 Weeks)
        // Logic: Find the most recent Sunday, then go back 28 days from there.
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)

        // Calculate days to subtract to get to the previous Sunday
        // If today is Sunday (0), we want last Sunday (7 days ago) to ensure a full week? 
        // User said "grab the last full week (Mon - Sun)".
        // If today is Monday (1), last Sunday was yesterday (1 day ago).
        // If today is Sunday (0), last Sunday was 7 days ago (to exclude today's partial week).
        const daysToLastSunday = dayOfWeek === 0 ? 7 : dayOfWeek;

        const endDate = new Date(today);
        endDate.setDate(today.getDate() - daysToLastSunday);

        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 28); // 4 weeks back

        const sStr = startDate.toISOString().split('T')[0];
        const eStr = endDate.toISOString().split('T')[0];
        const auth = btoa(`API_KEY:${apiKey}`);

        const url = `https://intervals.icu/api/v1/athlete/${athleteId}/activities?oldest=${sStr}&newest=${eStr}`;

        const res = await fetch(url, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!res.ok) {
            throw new Error(`Failed to fetch activities: ${res.status}`);
        }

        const activities = await res.json();
        const runActivities = activities.filter(a => a.type === 'Run');

        if (runActivities.length === 0) {
            document.getElementById('weekly-breakdown').textContent = 'No running activities found in the last 4 full weeks.';
            document.getElementById('target-volume').value = 0;
            document.getElementById('target-long-run').value = 0;
            showToast('⚠️ No running data found');
            return;
        }

        // 2. Group by Week
        const weeks = {};
        runActivities.forEach(act => {
            const d = new Date(act.start_date_local);
            const weekNum = getWeekNumber(d);
            const year = d.getFullYear();
            const key = `${year}-W${weekNum}`;

            if (!weeks[key]) weeks[key] = { vol: 0, longRun: 0, count: 0, weekNum: weekNum };

            const km = (act.distance || 0) / 1000;
            weeks[key].vol += km;
            weeks[key].count++;
            if (km > weeks[key].longRun) weeks[key].longRun = km;
        });

        const sortedWeeks = Object.keys(weeks).sort().map(k => weeks[k]);
        const weeksToAnalyze = sortedWeeks.slice(-4);

        // 3. Generate Breakdown & Stats
        let breakdownHtml = '';
        let totalIncrease = 0;
        let increaseCount = 0;
        let maxVol = 0;
        let maxLR = 0;

        weeksToAnalyze.forEach((week, index) => {
            let increaseStr = '';
            let pctIncrease = 0;

            const weekIndexInFullList = sortedWeeks.indexOf(week);
            if (weekIndexInFullList > 0) {
                const prevWeek = sortedWeeks[weekIndexInFullList - 1];
                if (prevWeek.vol > 0) {
                    pctIncrease = ((week.vol - prevWeek.vol) / prevWeek.vol) * 100;
                    increaseStr = `(${pctIncrease > 0 ? '+' : ''}${pctIncrease.toFixed(1)}%)`;
                    totalIncrease += pctIncrease;
                    increaseCount++;
                }
            }

            if (week.vol > maxVol) maxVol = week.vol;
            if (week.longRun > maxLR) maxLR = week.longRun;

            breakdownHtml += `<div style="margin-bottom: 4px;">Week ${week.weekNum}: Longest Run <strong>${week.longRun.toFixed(1)}km</strong> and Total Volume <strong>${week.vol.toFixed(1)}km</strong> <span style="color: ${pctIncrease > 5 ? '#facc15' : '#94a3b8'}">${increaseStr}</span></div>`;
        });

        document.getElementById('weekly-breakdown').innerHTML = breakdownHtml || "No recent running data found.";

        // 4. Summary & Recommendations
        let avgIncrease = 0;
        if (increaseCount > 0) avgIncrease = totalIncrease / increaseCount;

        const summaryText = `You peaked at <strong>${maxVol.toFixed(1)}km</strong> after a <strong>${avgIncrease.toFixed(1)}%</strong> volume surge over the last 4 weeks.`;
        document.getElementById('history-summary-text').innerHTML = summaryText;

        // Populate Peak Stats Panel
        document.getElementById('history-peak-stats').innerHTML = `
            <div class="flex justify-between text-[10px] text-slate-400">
                <span>Peak Vol:</span>
                <span class="font-mono text-white">${maxVol.toFixed(1)}km</span>
            </div>
            <div class="flex justify-between text-[10px] text-slate-400">
                <span>Longest Run:</span>
                <span class="font-mono text-white">${maxLR.toFixed(1)}km</span>
            </div>
            <div class="flex justify-between text-[10px] text-slate-400">
                <span>Avg Increase:</span>
                <span class="font-mono ${avgIncrease > 10 ? 'text-yellow-400' : 'text-green-400'}">${avgIncrease.toFixed(1)}%</span>
            </div>
        `;

        // Targets
        const aggressiveVol = (maxVol * 1.10).toFixed(1);
        // New Formula: 30% of Volume, rounded up to nearest 0.5
        const aggressiveLRRaw = aggressiveVol * 0.30;
        const aggressiveLR = (Math.ceil(aggressiveLRRaw * 2) / 2).toFixed(1);

        const conservativeVol = (maxVol * 0.90).toFixed(1);
        const conservativeLRRaw = conservativeVol * 0.30;
        const conservativeLR = (Math.ceil(conservativeLRRaw * 2) / 2).toFixed(1);

        const lastWeek = weeksToAnalyze[weeksToAnalyze.length - 1] || { vol: 0, longRun: 0 };
        const restVol = (lastWeek.vol * 0.60).toFixed(1);
        const restLR = (lastWeek.longRun * 0.70).toFixed(1);

        // Set Initial Values (Aggressive by default)
        document.getElementById('target-volume').value = aggressiveVol;
        document.getElementById('target-long-run').value = aggressiveLR;

        // Taper Selector is now static in index.html, no injection needed.
        // Add Listener for Taper Warning
        const taperInput = document.getElementById('taperDurationInput');
        const taperWarning = document.getElementById('taper-warning');

        const updateTaperWarning = () => {
            if (taperInput.value === "1") {
                taperWarning.classList.remove('hidden');
            } else {
                taperWarning.classList.add('hidden');
            }
            viewProgressionFromInputs();
        };

        taperInput.addEventListener('change', updateTaperWarning);
        // Initial check
        updateTaperWarning();

        // Rest Week Logic
        const restDiv = document.getElementById('rest-week-suggestion');
        let needRest = avgIncrease > 5;

        if (needRest) {
            restDiv.classList.remove('hidden');

            // Compact Layout:
            // Line 1: Header + Explanation
            // Line 2: Suggested Values + Checkbox

            restDiv.innerHTML = `
                <div class="flex items-center justify-between mb-1">
                    <div class="font-bold text-yellow-400">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i> Rest Week Recommended!
                    </div>
                    <div class="text-[10px] text-yellow-200/80">
                        Avg increase ${avgIncrease.toFixed(1)}% > 5%. Absorb training.
                    </div>
                </div>
                
                <div class="flex items-center justify-between bg-yellow-900/20 rounded p-2 border border-yellow-500/20">
                    <div id="suggested-rest-text" class="font-mono font-bold text-yellow-100">
                        Suggested Rest: ...
                    </div>
                    <label class="flex items-center gap-2 cursor:pointer hover:text-white transition-colors">
                        <input type="checkbox" id="use-rest-week" class="accent-yellow-500 w-4 h-4">
                        <span class="font-bold text-yellow-200">Start plan with this Rest Week?</span>
                    </label>
                </div>
            `;

            const checkbox = document.getElementById('use-rest-week');
            const volInput = document.getElementById('target-volume');
            const lrInput = document.getElementById('target-long-run');

            // Auto-check if recommended
            checkbox.checked = true;

            // If checked (which it is now), set conservative values immediately
            volInput.value = conservativeVol;
            lrInput.value = conservativeLR;

            // Helper to update text
            const updateRestText = () => {
                const currentVol = parseFloat(volInput.value) || 0;
                const restVol = (currentVol * 0.60).toFixed(1);
                const restLR = (parseFloat(lrInput.value || 0) * 0.60).toFixed(1);
                document.getElementById('suggested-rest-text').innerText = `Suggested Rest: ${restVol} km (LR: ${restLR} km)`;
            };

            // Listen for changes
            volInput.addEventListener('input', updateRestText);
            lrInput.addEventListener('input', updateRestText);

            // Initial update
            updateRestText();

            checkbox.addEventListener('change', (e) => {
                if (!e.target.checked) {
                    // User trying to uncheck - Warn them
                    const confirmSkip = confirm("⚠️ Skipping this rest week increases injury risk. Are you sure?");
                    if (!confirmSkip) {
                        e.target.checked = true; // Re-check
                        return; // Stop here
                    }
                    // If confirmed, switch to Aggressive
                    volInput.value = aggressiveVol;
                    lrInput.value = aggressiveLR;
                } else {
                    // User checking it back on
                    volInput.value = conservativeVol;
                    lrInput.value = conservativeLR;
                }

                // Update text and progression
                updateRestText();
                viewProgressionFromInputs();
            });
        } else {
            restDiv.classList.add('hidden');
        }

        showToast("✅ Analysis Complete!");

        // 5. Trigger Progression Popup (Auto-Show)
        const raceDate = document.getElementById('raceDateInput').value;
        if (raceDate) {
            viewProgressionFromInputs();
        } else {
            showToast("ℹ️ Set a Race Date to see the progression calendar.");
        }

    } catch (e) {
        console.error(e);
        showToast(`❌ Error: ${e.message}`);
        document.getElementById('weekly-breakdown').textContent = `Error: ${e.message}`;
    }
}

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

    // Get options from UI
    const startWithRestWeek = document.getElementById('use-rest-week') ? document.getElementById('use-rest-week').checked : false;
    const taperDuration = document.getElementById('taperDurationInput') ? parseInt(document.getElementById('taperDurationInput').value) : 3;
    const longRunProgression = document.getElementById('longRunProgressionInput') ? parseFloat(document.getElementById('longRunProgressionInput').value) : 2.0;
    const progressionRate = document.getElementById('progressionRateInput') ? parseFloat(document.getElementById('progressionRateInput').value) : 0.10;
    const raceType = document.getElementById('raceTypeInput') ? document.getElementById('raceTypeInput').value : "Marathon";

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

    const plan = calculateMarathonPlan(startVol, startLR, raceDateStr, options);

    // Save the plan to state so it can be used by the final generation step
    state.generatedPlan = plan;

    if (!plan || plan.length === 0) {
        container.innerHTML = '<div class="text-red-400 text-center p-4">Race date is in the past or too close!</div>';
        return;
    }

    // Pre-fill customRestWeeks based on the plan's suggestions (only on first run/reset)
    // Actually, better to just let the checkboxes reflect the plan state.

    let html = '<div class="grid grid-cols-6 gap-1 text-[10px] font-bold text-slate-400 border-b border-slate-700 pb-1 mb-1 text-center">';
    html += '<div>Week</div><div>Date</div><div>Phase</div><div>Rest?</div><div>Volume</div><div>Long Run</div></div>';

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

        if (week.isRaceWeek) {
            phaseDisplay = "RACE";
            rowClass += " bg-purple-900/20 text-purple-200";
        } else if (week.blockType === "Taper") {
            rowClass += " text-blue-200";
        } else if (week.weekName.includes("Recovery") || week.weekName === "Recovery Start" || week.weekName === "Custom Recovery") {
            phaseDisplay = "Recov";
            rowClass += " text-green-200";
            isRest = true;
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

        html += `<div class="${rowClass} grid grid-cols-6 gap-1 items-center text-[10px]">`;
        html += `<div>${week.week}</div>`;
        html += `<div class="text-[9px] text-slate-500">${dateStr}</div>`;
        html += `<div>${phaseDisplay}</div>`;
        html += `<div>${checkboxHtml}</div>`;
        html += `<div class="font-mono">${week.mileage} km</div>`;
        html += `<div class="font-mono">${week.longRun} km</div>`;
        html += `</div>`;
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
                    // Trigger the change event on the startRestCheckbox to update inputs (Conservative/Aggressive)
                    startRestCheckbox.dispatchEvent(new Event('change'));
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
    const inputs = ['target-volume', 'target-long-run', 'raceDateInput', 'taperDurationInput', 'longRunProgressionInput', 'progressionRateInput', 'raceTypeInput'];
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