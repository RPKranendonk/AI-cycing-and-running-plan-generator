// ==========================================
// ONBOARDING CONNECTION & FINALIZATION
// Handles API connection testing and final plan generation
// ==========================================

/**
 * Test Connection in Wizard
 */
async function testWizardConnection() {
    const apiKey = document.getElementById('wizard-api-key')?.value;
    const athleteId = document.getElementById('wizard-athlete-id')?.value;
    const btn = event.target;
    const originalText = btn.innerHTML;

    if (!apiKey || !athleteId) {
        showToast('❌ Please enter API Key and Athlete ID', 'error');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';

    try {
        const auth = btoa(`API_KEY:${apiKey}`);
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!res.ok) throw new Error(`Connection failed: ${res.status}`);

        const athleteData = await res.json();

        // Save to state
        window.wizardState.data.apiKey = apiKey;
        window.wizardState.data.athleteId = athleteId;
        localStorage.setItem('elite_apiKey', apiKey);
        localStorage.setItem('elite_athleteId', athleteId);

        if (window.state) {
            window.state.apiKey = apiKey;
            window.state.athleteId = athleteId;
        }

        showToast(`✅ Connected as ${athleteData.name || athleteId}`, 'success');
        btn.innerHTML = '✅ Connected!';

        // Zone sync for Running
        if (window.wizardState.data.sport === 'Running' && window.runZoneSyncAfterConnection) {
            await window.runZoneSyncAfterConnection(apiKey, athleteId);
        }

    } catch (error) {
        showToast('❌ ' + error.message, 'error');
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

/**
 * Finalize Onboarding & Generate Plan
 */
function applyWizardSettingsAndGenerate() {
    const data = window.wizardState.data;
    if (!window.state) window.state = {};

    // 1. Core Config
    window.state.wizardScheduleTemplate = data.weeklySchedule;
    window.state.wizardTrainingDays = data.trainingDays;
    window.state.generatedPlan = null; // Clear existing

    // 2. Form Sync
    const sportEl = document.getElementById('sportTypeInput');
    if (sportEl) sportEl.value = data.sport || 'Running';

    const goalEl = document.getElementById('raceTypeInput');
    if (goalEl) goalEl.value = data.goal || 'Marathon';

    // 3. Experience & Volume Logic
    const experience = data.experience || 'Consistent';
    const volume = parseInt(data.currentVolume || 30);
    const isRunning = data.sport === 'Running';

    const expMap = {
        'Fresh': { runRate: '0.05', cycleRate: '3', modifier: 0.8 },
        'Consistent': { runRate: '0.075', cycleRate: '5', modifier: 1.0 },
        'Pro': { runRate: '0.10', cycleRate: '8', modifier: 1.2 }
    };
    const settings = expMap[experience] || expMap['Consistent'];

    if (isRunning) {
        const rateIn = document.getElementById('progressionRateInputRun');
        if (rateIn) rateIn.value = settings.runRate;
        const volIn = document.getElementById('target-volume');
        if (volIn) volIn.value = volume;
    } else {
        const rateIn = document.getElementById('progressionRateInputCycle');
        if (rateIn) rateIn.value = settings.cycleRate;
        const ctlIn = document.getElementById('current-fitness');
        if (ctlIn) ctlIn.value = Math.round(((volume * 50) / 7) * settings.modifier);
    }

    // 4. Availability Sync
    if (data.availability) {
        window.state.dailyAvailability = {};
        for (let i = 0; i < 7; i++) {
            const stateIdx = (i + 1) % 7; // Mon(0)->1, Sun(6)->0
            const hours = data.availability[i] || 0;
            window.state.dailyAvailability[stateIdx] = {
                hours: hours, split: false, amHours: hours, pmHours: 0
            };
        }
        localStorage.setItem('elite_dailyAvail', JSON.stringify(window.state.dailyAvailability));
    }

    // 5. Start Generation
    showToast('✨ Generating your personalized plan...', 'info');
    if (typeof window.generatePlan === 'function') {
        setTimeout(window.generatePlan, 500);
    }

    // Close Wizard
    const wizard = document.getElementById('quick-setup-wizard');
    if (wizard) wizard.remove();
}

// --- EXPOSE TO WINDOW ---
window.testWizardConnection = testWizardConnection;
window.applyWizardSettingsAndGenerate = applyWizardSettingsAndGenerate;

window.OnboardingFinalizer = {
    testWizardConnection,
    applyWizardSettingsAndGenerate
};
