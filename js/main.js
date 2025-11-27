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
    const raceDate = state.raceDate;
    const planStartInput = document.getElementById('planStartDateInput');
    const planStartDate = planStartInput && planStartInput.value ? planStartInput.value : new Date().toISOString().split('T')[0];

    if (!raceDate) return;

    if (sportType === "Cycling") {
        // Cycling Logic
        // Map UI inputs to Cycling Parameters
        // target-volume -> Start TSS
        // target-long-run -> Start Long Ride (Hours)
        // progressionRate -> Ramp Rate (e.g. 5)

        const volInput = document.getElementById('target-volume');
        const lrInput = document.getElementById('target-long-run');
        const progInput = document.getElementById('progressionRateInput');

        const startTss = volInput && volInput.value ? parseFloat(volInput.value) : (state.startTss || 300);
        const startLongRide = lrInput && lrInput.value ? parseFloat(lrInput.value) : 1.5;
        const rampRate = progInput && progInput.value ? parseFloat(progInput.value) : (state.rampRate || 5);
        const currentCtl = state.currentFitness || 40;

        // Options
        const options = {
            rampRate: rampRate,
            raceDistance: 100, // Default
            planStartDate: planStartDate // Pass explicit start date
        };

        state.generatedPlan = calculateCyclingPlan(startTss, currentCtl, raceDate, options, startLongRide);
    } else {
        // Running Logic
        const startVol = state.startingVolume || 30;
        const startLR = state.startingLongRun || 10;

        const options = {
            progressionRate: state.progressionRate,
            taperDuration: state.taperDuration,
            longRunProgression: state.longRunProgression,
            raceType: state.raceType,
            startWithRestWeek: state.startWithRestWeek,
            customRestWeeks: state.customRestWeeks || [],
            forceBuildWeeks: state.forceBuildWeeks || []
        };

        state.generatedPlan = calculateMarathonPlan(startVol, startLR, raceDate, planStartDate, options);
    }
}

function init() {
    // Initialize Inputs
    if (document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = state.apiKey;
    if (document.getElementById('athleteIdInput')) document.getElementById('athleteIdInput').value = state.athleteId;

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
    const planStartInput = document.getElementById('planStartDateInput');
    if (planStartInput && !planStartInput.value) {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        const nextMonday = new Date(today.setDate(diff + (day === 1 ? 0 : 7)));
        planStartInput.value = nextMonday.toISOString().split('T')[0];
    }

    if (document.getElementById('aiApiKeyInput')) document.getElementById('aiApiKeyInput').value = state.aiApiKey || '';
    if (document.getElementById('geminiApiKeyInput')) document.getElementById('geminiApiKeyInput').value = state.geminiApiKey || '';
    if (document.getElementById('aiProviderSelect')) document.getElementById('aiProviderSelect').value = state.aiProvider || 'openai';

    toggleProviderFields();

    if (!state.apiKey) {
        openSetup();
    }

    const dayIds = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'];
    dayIds.forEach((id, index) => {
        const dayValue = index === 6 ? 0 : index + 1;
        const checkbox = document.getElementById(id);
        if (checkbox) {
            checkbox.checked = state.defaultAvailableDays.includes(dayValue);
        }
    });

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

    // Standard behavior: Only open if no API key (handled above)

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

// ... (renderWeeklyPlan moved to weekly-ui.js) ...