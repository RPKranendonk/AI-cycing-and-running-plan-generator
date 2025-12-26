/**
 * Connection Manager
 * Handles the authentication and connection process with Intervals.icu
 */
window.ConnectionManager = {
    /**
     * Connect to Intervals.icu, validate athlete ID, and fetch initial data
     */
    connect: async function () {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        let athleteId = document.getElementById('athleteIdInput').value.trim();

        // [Fix] Detect and fix double-entry bug (e.g. "i11395i11395")
        if (athleteId.length > 3 && athleteId.length % 2 === 0) {
            const half = athleteId.substring(0, athleteId.length / 2);
            if (half === athleteId.substring(athleteId.length / 2)) {
                console.log(`[Connection] Fixed double ID '${athleteId}' -> '${half}'`);
                athleteId = half;
                document.getElementById('athleteIdInput').value = athleteId;
            }
        }

        if (!apiKey) {
            showToast("❌ Please enter API Key");
            return;
        }

        // UI Update
        const statusBox = document.getElementById('connectionStatus');
        if (statusBox) {
            statusBox.classList.remove('hidden');
            statusBox.innerHTML = '<div class="text-blue-400"><i class="fa-solid fa-spinner fa-spin"></i> Connecting...</div>';
        }

        try {
            const auth = btoa(`API_KEY:${apiKey}`);
            const targetId = athleteId || '0';

            const res = await fetch(`https://intervals.icu/api/v1/athlete/${targetId}`, {
                headers: { 'Authorization': `Basic ${auth}` }
            });

            if (!res.ok) {
                if (res.status === 401) throw new Error("Invalid API Key");
                if (res.status === 404) throw new Error("Athlete not found");
                if (res.status === 403) throw new Error("Access Denied (403). Check 'ACCESS_ATHLETE_DATA' scope or ID.");
                throw new Error(`Connection Failed (${res.status})`);
            }

            const data = await res.json();
            console.log("Intervals.icu Athlete Data:", data);

            // [Agent] Inject defaults
            if (!state.mistralApiKey) {
                state.mistralApiKey = "";
                if (!state.aiProvider) state.aiProvider = "Mistral";
            }

            // Validation
            const hasName = data.firstname && data.lastname;
            const dobString = data.icu_date_of_birth || data.dateOfBirth || data.dob;
            const hasDob = !!dobString;

            if (!hasName || !hasDob) {
                if (statusBox) {
                    statusBox.innerHTML = `
                        <div class="text-amber-400 font-bold mb-2"><i class="fa-solid fa-triangle-exclamation"></i> Missing Profile Info</div>
                        <div class="text-sm text-slate-300 mb-2">We could not find your Name/DOB. Update Intervals.icu settings.</div>
                    `;
                }
                return;
            }

            // State Updates
            state.athleteName = `${data.firstname} ${data.lastname}`;
            state.athleteId = data.id;
            state.gender = data.sex;

            // Age config
            if (dobString) {
                const dobDate = new Date(dobString);
                const today = new Date();
                let age = today.getFullYear() - dobDate.getFullYear();
                const m = today.getMonth() - dobDate.getMonth();
                if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
                state.athleteAge = age;
            }

            // Sport Settings Extraction
            this._extractSportSettings(data);

            // Update UI
            document.getElementById('athleteIdInput').value = data.id;

            if (statusBox) {
                const ageText = state.athleteAge ? ` (${state.athleteAge} years old)` : '';
                statusBox.innerHTML = `
                    <div class="text-green-400 font-bold"><i class="fa-solid fa-check"></i> Connected as ${state.athleteName}${ageText}</div>
                `;
            }

            // Update Athlete Panel
            if (window.AthletePanel) window.AthletePanel.update(data);
            else if (window.updateAthleteInfoPanel) window.updateAthleteInfoPanel(data); // Fallback

            // Fetch History (Smart Planner)
            try {
                if (window.calculateSmartBlock) await window.calculateSmartBlock();
            } catch (e) {
                console.warn("Smart Planner failed:", e);
            }

            // Reveal Next Form Steps
            const step4 = document.getElementById('step-4-inputs');
            const step5 = document.getElementById('step-5-plan-action');
            if (step4) step4.classList.remove('hidden');
            if (step5) step5.classList.remove('hidden');

            this._prefillDefaults();

        } catch (e) {
            console.error(e);
            if (statusBox) statusBox.innerHTML = `<div class="text-red-400 font-bold">Error: ${e.message}</div>`;
            showToast(`❌ ${e.message}`);
        }
    },

    _extractSportSettings: function (data) {
        if (!data.sportSettings || !Array.isArray(data.sportSettings)) return;

        const findSport = (types) => data.sportSettings.find(s =>
            (s.types && types.some(t => s.types.includes(t))) ||
            (s.type && types.includes(s.type))
        );

        const strength = data.sportSettings.find(s =>
            (s.types && s.types.includes('WeightTraining')) ||
            s.type === 'WeightTraining' ||
            (s.types && s.types.some(t => t.toLowerCase().includes('weight') || t.toLowerCase().includes('strength')))
        );

        if (strength) state.sportSettingsIdStrength = strength.id;

        const run = findSport(['Run']);
        if (run) state.sportSettingsIdRun = run.id;

        const ride = findSport(['Ride']);
        if (ride) state.sportSettingsIdRide = ride.id;

        const yoga = findSport(['Yoga']);
        if (yoga) state.sportSettingsIdYoga = yoga.id;

        const swim = findSport(['Swim']);
        if (swim) state.sportSettingsIdSwim = swim.id;
    },

    _prefillDefaults: function () {
        // Pre-fill Plan Start Date (Nearest Monday)
        const today = new Date();
        const day = today.getDay();
        const diff = (1 + 7 - day) % 7;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + diff);

        const planStartRun = document.getElementById('planStartDateInputRun');
        const planStartCycle = document.getElementById('planStartDateInputCycle');

        if (planStartRun && !planStartRun.value) planStartRun.valueAsDate = targetDate;
        if (planStartCycle && !planStartCycle.value) planStartCycle.valueAsDate = targetDate;

        // Pre-fill Race Date (Default 12 weeks out)
        const raceDateInput = document.getElementById('raceDateInput');
        if (raceDateInput && !raceDateInput.value) {
            const defaultRaceDate = new Date(targetDate);
            defaultRaceDate.setDate(defaultRaceDate.getDate() + (12 * 7));
            raceDateInput.valueAsDate = defaultRaceDate;
        }

        // Check AI Keys
        if (!state.geminiApiKey && !state.aiApiKey && !state.deepseekApiKey && !state.mistralApiKey) {
            setTimeout(() => showToast("ℹ️ AI Key missing! Check Settings.", "info", 5000), 1000);
        }
    }
};
