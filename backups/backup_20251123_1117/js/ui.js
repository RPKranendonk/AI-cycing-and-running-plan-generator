// ==========================================
// UI LOGIC: DOM MANIPULATION & INTERACTION
// ==========================================

// --- SETUP MODAL HELPERS ---
function openSetup() { document.getElementById('setupModal').classList.remove('hidden'); document.getElementById('setupModal').classList.add('flex'); }
function closeSetup() { document.getElementById('setupModal').classList.add('hidden'); }
function showToast(msg) {
    const t = document.getElementById('toast');
    if (t) {
        document.getElementById('toastMsg').innerText = msg;
        t.classList.remove('translate-x-full');
        setTimeout(() => t.classList.add('translate-x-full'), 3000);
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
    state.aiApiKey = document.getElementById('aiApiKeyInput').value;
    state.geminiApiKey = document.getElementById('geminiApiKeyInput').value;
    state.aiProvider = document.getElementById('aiProviderSelect').value;
    state.raceDate = document.getElementById('raceDateInput').value;
    state.goalTime = document.getElementById('goalTimeInput').value;

    localStorage.setItem('elite_apiKey', state.apiKey);
    localStorage.setItem('elite_athleteId', state.athleteId);
    localStorage.setItem('elite_raceDate', state.raceDate);
    localStorage.setItem('elite_goalTime', state.goalTime);
    localStorage.setItem('elite_aiApiKey', state.aiApiKey);
    localStorage.setItem('elite_geminiApiKey', state.geminiApiKey);
    localStorage.setItem('elite_aiProvider', state.aiProvider);
    localStorage.setItem('elite_trainingHistory', state.trainingHistory);
    localStorage.setItem('elite_injuries', state.injuries);
    localStorage.setItem('elite_gymAccess', state.gymAccess);
    localStorage.setItem('elite_trainingPreferences', state.trainingPreferences);

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