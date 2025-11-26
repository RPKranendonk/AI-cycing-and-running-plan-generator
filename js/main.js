// --- MAIN INITIALIZATION ---

async function fetchData(showMsg = false) {
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };
    try {
        if (showMsg) showToast("Fetching...");
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


function init() {
    // Initialize Inputs
    if (document.getElementById('apiKeyInput')) document.getElementById('apiKeyInput').value = state.apiKey;
    if (document.getElementById('athleteIdInput')) document.getElementById('athleteIdInput').value = state.athleteId;

    if (document.getElementById('historyInput')) document.getElementById('historyInput').value = state.trainingHistory || '';
    if (document.getElementById('injuriesInput')) document.getElementById('injuriesInput').value = state.injuries || '';
    if (document.getElementById('gymAccessInput')) document.getElementById('gymAccessInput').value = state.gymAccess || 'none';
    if (document.getElementById('preferencesInput')) document.getElementById('preferencesInput').value = state.trainingPreferences || '';

    if (document.getElementById('inputLthrPace')) document.getElementById('inputLthrPace').value = state.lthrPace;
    if (document.getElementById('inputLthrBpm')) document.getElementById('inputLthrBpm').value = state.lthrBpm;

    if (document.getElementById('raceDateInput')) document.getElementById('raceDateInput').value = state.raceDate;
    if (document.getElementById('goalTimeInput')) document.getElementById('goalTimeInput').value = state.goalTime;

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

    // Always open setup on load as per user request
    openSetup();
}

function renderWeeklyPlan() {
    const container = document.getElementById('planContainer');
    if (!container) return;

    container.innerHTML = '';

    if (state.generatedPlan && state.generatedPlan.length > 0) {
        // Group weeks into blocks
        const blockMap = new Map();

        state.generatedPlan.forEach(week => {
            const blockNum = week.blockNum || 1;
            if (!blockMap.has(blockNum)) {
                blockMap.set(blockNum, []);
            }
            blockMap.get(blockNum).push(week);
        });

        // Convert map to array and SORT ASCENDING (Block 1 first)
        const blocks = Array.from(blockMap.entries())
            .sort((a, b) => a[0] - b[0]) // FIX: Changed from b-a to a-b
            .map(([blockNum, weeks]) => weeks);

        blocks.forEach((blockWeeks, blockIndex) => {
            const firstWeek = blockWeeks[0];
            const blockNum = firstWeek.blockNum;
            const phaseName = firstWeek.phaseName;
            const blockType = firstWeek.blockType; // "Base", "Build", "Peak", "Taper"

            // UI Color coding for Block Label
            let blockColor = "text-slate-400";
            if (blockType === "Peak") blockColor = "text-purple-400";
            if (blockType === "Taper") blockColor = "text-green-400";

            // Create Block Container
            const blockContainer = document.createElement('div');
            blockContainer.className = 'flex gap-4 mb-6';

            // 1. Left Sidebar (Block Info)
            const sidebar = document.createElement('div');
            sidebar.className = 'w-24 sm:w-32 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity';
            sidebar.innerHTML = `
                <div class="text-2xl font-bold text-slate-700">BLOCK ${blockNum}</div>
                <div class="text-xs font-bold uppercase tracking-wider ${blockColor}">${phaseName}</div>
                <div class="text-[10px] text-slate-500 mt-1 mb-3">${blockWeeks.length} Weeks</div>
                
                <!-- Block Actions -->
                <div class="space-y-2" onclick="event.stopPropagation()">
                    <button onclick="prepareBlockPlanWithAI(${blockNum}, [${blockWeeks.map(w => w.week - 1).join(',')}])" 
                            class="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 text-[10px] font-bold py-1.5 rounded border border-blue-500/30 transition-colors">
                        <i class="fa-solid fa-robot"></i> AI Plan
                    </button>
                    <button onclick="pushBlockToIntervalsICU([${blockWeeks.map(w => w.week - 1).join(',')}])" 
                            class="w-full bg-green-600/20 hover:bg-green-600/40 text-green-400 text-[10px] font-bold py-1.5 rounded border border-green-500/30 transition-colors">
                        <i class="fa-solid fa-upload"></i> Push
                    </button>
                    <button onclick="deleteBlockWorkouts([${blockWeeks.map(w => w.week - 1).join(',')}])" 
                            class="w-full bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[10px] font-bold py-1.5 rounded border border-red-500/30 transition-colors">
                        <i class="fa-solid fa-trash"></i> Clear
                    </button>
                </div>
            `;

            sidebar.onclick = () => {
                const firstWeekId = `week-detail-${blockWeeks[0].week - 1}`;
                const firstWeekDiv = document.getElementById(firstWeekId);
                const isFirstOpen = firstWeekDiv && !firstWeekDiv.classList.contains('hidden');

                blockWeeks.forEach(week => {
                    const detailId = `week-detail-${week.week - 1}`;
                    const detailDiv = document.getElementById(detailId);

                    if (isFirstOpen) {
                        if (detailDiv && !detailDiv.classList.contains('hidden')) {
                            toggleWeekDetail(week.week - 1);
                        }
                    } else {
                        if (!detailDiv || detailDiv.classList.contains('hidden')) {
                            toggleWeekDetail(week.week - 1);
                        }
                    }
                });
            };

            // 2. Right Content (Weeks)
            const weeksContainer = document.createElement('div');
            weeksContainer.className = 'flex-1 space-y-2 p-4 bg-slate-900/30 rounded-xl border border-slate-700/50';

            blockWeeks.forEach(week => {
                const d = new Date(week.startDate);
                const dateStr = `${d.getDate()}.${d.getMonth() + 1}`;

                const card = document.createElement('div');
                card.className = 'p-3 rounded-lg border border-slate-700 bg-slate-800/50 hover:border-slate-600 transition-colors';
                card.setAttribute('data-week-index', week.week - 1);

                // Sub-text for Week focus
                let focusColor = 'text-slate-500';
                if (week.weekName === 'Recovery') focusColor = 'text-green-500';
                if (week.weekName === 'Race Week') focusColor = 'text-red-500';

                card.innerHTML = `
                    <div class="flex justify-between items-center cursor-pointer" id="week-header-${week.week - 1}">
                        <div class="flex items-center gap-4">
                            <div class="text-xs font-mono text-slate-500 w-8">W${week.week}</div>
                            <div class="text-xs font-mono text-slate-400 w-12">${dateStr}</div>
                            <div>
                                <div class="text-[11px] font-bold text-slate-300">${week.weekName}</div>
                                <div class="text-[10px] ${focusColor}">${week.focus}</div>
                            </div>
                        </div>
                        <div class="text-right flex items-center gap-4">
                            <div class="hidden sm:block text-right">
                                <div class="text-[10px] text-slate-400">${state.sportType === 'Cycling' ? 'Long Ride' : 'Long Run'}</div>
                                <div class="text-sm font-mono text-slate-300">${week.longRun}${state.sportType === 'Cycling' ? 'h' : 'km'}</div>
                            </div>
                            <div class="text-right pl-2 border-l border-slate-700">
                                <div class="text-xl font-bold text-white font-mono">${week.mileage}${state.sportType === 'Cycling' ? ' TSS' : 'km'}</div>
                                <div class="text-[9px] text-slate-500 uppercase tracking-wider">Total</div>
                            </div>
                        </div>
                    </div>
                `;
                weeksContainer.appendChild(card);

                const header = card.querySelector(`#week-header-${week.week - 1}`);
                if (header) {
                    header.onclick = (e) => {
                        toggleWeekDetail(week.week - 1);
                    };
                }
            });

            blockContainer.appendChild(sidebar);
            blockContainer.appendChild(weeksContainer);
            container.appendChild(blockContainer);
        });

    } else {
        container.innerHTML = '<div class="text-center text-slate-500 p-4">No plan generated. Check your Race Date in Settings.</div>';
    }
}

document.addEventListener('DOMContentLoaded', init);