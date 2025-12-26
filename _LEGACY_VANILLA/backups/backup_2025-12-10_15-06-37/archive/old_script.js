// --- STATE & CONFIG ---
const TODAY = new Date();
let START_DATE = new Date(TODAY);


let state = {
    apiKey: localStorage.getItem('elite_apiKey') || '3k65dka97nooel671y9gv1m3b',
    athleteId: localStorage.getItem('elite_athleteId') || '0',
    est5k: localStorage.getItem('elite_5k') || '',
    est10k: localStorage.getItem('elite_10k') || '',
    lthrPace: localStorage.getItem('elite_lthrPace') || '',
    lthrBpm: localStorage.getItem('elite_lthrBpm') || '',
    raceDate: localStorage.getItem('elite_raceDate') || '2026-04-12',
    goalTime: localStorage.getItem('elite_goalTime') || '',
    rampFactor: parseFloat(localStorage.getItem('elite_rampFactor')) || 1.10,
    wellness: [], activities: [], zones: null,
    zonePcts: { z2: "Z2 Pace", z3: "Z3 Pace", z5: "Z5 Pace" }, // Defaults
    fetchedZones: null,
    thresholdSpeed: null,
    modifications: JSON.parse(localStorage.getItem('elite_plan_mods') || '{ }'),
    selectedWorkout: null,
    generatedPlan: []
};

try { state.modifications = JSON.parse(localStorage.getItem('elite_plan_mods') || '{}'); }
catch (e) { state.modifications = {}; localStorage.setItem('elite_plan_mods', '{ }'); }


const STRENGTH_A = `STRENGTH SESSION A – Neural Power\nWarm-Up (10–12 min)\n• 3min Cardio\n• Dynamic mobility (swings, rocks)\n• Activation (clamshells, glute bridge)\n\nMain Lifts\n• Overhead Press: 4x5 @ RPE 8\n• High-Bar Back Squat: 4x6 @ RPE 8\n• Trap Bar Deadlift: 4x5 @ RPE 8\n\nAccessories\n• Bulgarian Split Squat: 3x8/leg\n• SA Row: 3x8/side\n• Side Plank: 3x30s\n• Farmer’s Carry: 3x20m`;
const STRENGTH_B = `STRENGTH SESSION B – Stability\nWarm-Up (10 min)\n• 3min Cardio\n• Leg swings, monster walks\n\nMain Work\n• Box Step-Downs: 3x12/leg\n• SL RDL: 3x12/leg\n• Wall Sit w/ Squeeze: 3x30s\n• Side-Lying Abductions: 3x15/leg\n• Pallof Press: 3x12/side\n• Bird Dog: 3x6 (3s hold)`;


// --- CORE FUNCTIONS ---


function timeToSeconds(str) {
    if (!str || typeof str !== 'string' || !str.includes(':')) return 0;
    const [m, s] = str.split(':').map(Number);
    return (m * 60) + s;
}


function secondsToTime(sec) {
    if (!sec || sec === Infinity || sec > 36000) return "--:--";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}


// --- ZONE LOGIC ---

async function fetchWellness() {
    if (!state.apiKey) return;
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 28); // 4 weeks
    const oldest = start.toISOString().split('T')[0];
    const newest = end.toISOString().split('T')[0];

    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/wellness?oldest=${oldest}&newest=${newest}`, { headers });
        if (!res.ok) throw new Error("Wellness fetch fail");
        const data = await res.json();
        state.wellness = data;
        updateBiometrics();
    } catch (e) { console.error("Wellness fetch error:", e); }
}

function updateBiometrics() {
    if (!state.wellness || state.wellness.length === 0) return;

    // Sort by date descending (newest first)
    const sorted = [...state.wellness].sort((a, b) => new Date(b.id) - new Date(a.id));
    const latest = sorted[0];

    // Calculate averages (last 28 days)
    const rhrSum = sorted.reduce((acc, curr) => acc + (curr.restingHR || 0), 0);
    const rhrCount = sorted.filter(x => x.restingHR).length;
    const rhrAvg = rhrCount > 0 ? Math.round(rhrSum / rhrCount) : '--';

    const hrvSum = sorted.reduce((acc, curr) => acc + (curr.hrv || 0), 0);
    const hrvCount = sorted.filter(x => x.hrv).length;
    const hrvAvg = hrvCount > 0 ? Math.round(hrvSum / hrvCount) : '--';

    // Update UI
    const rhrEl = document.getElementById('bio-rhr');
    if (rhrEl) rhrEl.innerHTML = `${latest.restingHR || '--'} <span class="text-[10px] text-slate-500 font-normal">/ ${rhrAvg} avg</span>`;

    const hrvEl = document.getElementById('bio-hrv');
    if (hrvEl) hrvEl.innerHTML = `${latest.hrv || '--'} <span class="text-[10px] text-slate-500 font-normal">/ ${hrvAvg} avg</span>`;
}

async function fetchZones() {
    if (!state.apiKey) return;
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}`, { headers });
        if (!res.ok) throw new Error("Settings fetch fail");
        const data = await res.json();

        if (data.sportSettings) {
            const runSettings = data.sportSettings.find(s => s.types.includes('Run'));
            if (runSettings) {
                state.fetchedZones = {
                    hr: runSettings.hr_zones || [],
                    pace: runSettings.pace_zones || []
                };

                // Display Raw HR Data
                const rawHrEl = document.getElementById('rawHrOutput');
                if (rawHrEl) {
                    rawHrEl.innerText = JSON.stringify(runSettings.hr_zones, null, 2);
                }

                const srcEl = document.getElementById('zoneSource');
                if (srcEl) srcEl.innerText = "Synced: Intervals.icu";

                if (runSettings.lthr) state.lthrBpm = runSettings.lthr;
                if (runSettings.threshold_pace) {
                    state.thresholdSpeed = runSettings.threshold_pace;
                    let val = runSettings.threshold_pace;
                    let sec = (val < 20) ? (1000 / val) : val;
                    state.lthrPace = secondsToTime(sec);
                }
            }
        }
    } catch (e) { console.error("Zone fetch error:", e); }
}


function calculateZones() {
    let zones = { z1: "--", z2: "--", z3: "--", z4: "--", z5: "--" };
    let hrs = { z1: "--", z2: "--", z3: "--", z4: "--", z5: "--" };
    const fmt = secondsToTime;


    if (state.fetchedZones && state.fetchedZones.pace && state.fetchedZones.pace.length > 0) {
        let p = state.fetchedZones.pace;
        let cleanPace = p.map(x => (typeof x === 'object' && x.min) ? x.min : x);


        // Detect Percentage (Values 60-130) vs Absolute
        const isPercentage = cleanPace.some(x => x > 60 && x < 130) && state.thresholdSpeed;
        let pSec = [];


        if (isPercentage && state.thresholdSpeed) {
            // 1. DISPLAY LOGIC (Absolute Times)
            pSec = cleanPace.map(pct => {
                if (pct > 500) return 0;
                const speedMs = (pct / 100) * state.thresholdSpeed;
                return 1000 / speedMs;
            });

            // 2. EXPORT LOGIC (Percentages)
            // Intervals likes: "90-100% Pace"
            // cleanPace array = [EndZ1, EndZ2, EndZ3, EndZ4, EndZ5]
            if (cleanPace.length >= 4) {
                state.zonePcts = {
                    z2: `${cleanPace[0]}-${cleanPace[1]}% Pace`,
                    z3: `${cleanPace[1]}-${cleanPace[2]}% Pace`,
                    z5: `${cleanPace[3]}-115% Pace` // Explicit Range! Fixes "< 4:11" error
                };
            }

        } else {
            // Absolute Mode Fallback
            pSec = cleanPace.map(val => {
                if (val === 0 || val > 900) return 0;
                if (val < 25) return (1000 / val);
                return val;
            });
            pSec = pSec.map(x => x === 0 || x === Infinity ? 99999 : x);
            pSec.sort((a, b) => b - a); // Slow -> Fast
            const v = pSec.filter(x => x < 50000);

            if (v.length >= 4) {
                // Construct Absolute Ranges (MM:SS-MM:SS)
                state.zonePcts = {
                    z2: `${fmt(v[0])}-${fmt(v[1])}`,
                    z3: `${fmt(v[1])}-${fmt(v[2])}`,
                    z5: `${fmt(v[3])}-${fmt(v[3] * 0.95)}` // Explicit Range!
                };
            }
        }


        // DISPLAY LOGIC CONTINUED
        pSec = pSec.map(x => x === 0 || x === Infinity ? 99999 : x);
        pSec.sort((a, b) => b - a);
        const validSecs = pSec.filter(x => x < 50000);

        if (validSecs.length >= 4) {
            zones.z1 = `> ${fmt(validSecs[0])}`;
            zones.z2 = `${fmt(validSecs[0])} - ${fmt(validSecs[1])}`;
            zones.z3 = `${fmt(validSecs[1])} - ${fmt(validSecs[2])}`;
            zones.z4 = `${fmt(validSecs[2])} - ${fmt(validSecs[3])}`;
            zones.z5 = `< ${fmt(validSecs[3])}`;
        }
    } else {
        // Fallback
        const lthrSec = timeToSeconds(state.lthrPace);
        if (lthrSec > 0) {
            zones.z1 = `${fmt(lthrSec * 1.29)}+`;
            zones.z2 = `${fmt(lthrSec * 1.14)}-${fmt(lthrSec * 1.29)}`;
            zones.z3 = `${fmt(lthrSec * 1.06)}-${fmt(lthrSec * 1.13)}`;
            zones.z4 = `${fmt(lthrSec * 1.00)}-${fmt(lthrSec * 1.05)}`;
            zones.z5 = `<${fmt(lthrSec * 0.98)}`;
        }
    }


    // Update Debugger
    document.getElementById('dbg-z2').innerText = state.zonePcts.z2;
    document.getElementById('dbg-z5').innerText = state.zonePcts.z5;


    // Update Table
    state.zones = zones;
    const tbody = document.getElementById('zoneTableBody');
    if (tbody) {
        // HR Logic (simplified for display)
        const lthr = parseInt(state.lthrBpm) || 170;
        let hrs = { z1: `<${Math.round(lthr * 0.81)}`, z2: `${Math.round(lthr * 0.81)}-${Math.round(lthr * 0.89)}`, z3: `${Math.round(lthr * 0.90)}-${Math.round(lthr * 0.93)}`, z4: `${Math.round(lthr * 0.94)}-${Math.round(lthr * 0.99)}`, z5: `>${lthr}` };

        if (state.fetchedZones && state.fetchedZones.hr && state.fetchedZones.hr.length >= 5) {
            const h = state.fetchedZones.hr;
            hrs.z1 = `${h[0]}-${h[1] - 1}`; hrs.z2 = `${h[1]}-${h[2] - 1}`; hrs.z3 = `${h[2]}-${h[3] - 1}`; hrs.z4 = `${h[3]}-${h[4] - 1}`; hrs.z5 = `>${h[4]}`;
        }


        tbody.innerHTML = `
                <tr class="zone-row-z1 border-b border-slate-700/50"><td class="text-green-300 font-bold">Z1 Rec</td><td>${zones.z1}</td><td>${hrs.z1}</td></tr>
                <tr class="zone-row-z2 border-b border-slate-700/50"><td class="text-green-400 font-bold">Z2 Easy</td><td>${zones.z2}</td><td>${hrs.z2}</td></tr>
                <tr class="zone-row-z3 border-b border-slate-700/50"><td class="text-blue-400 font-bold">Z3 Tempo</td><td>${zones.z3}</td><td>${hrs.z3}</td></tr>
                <tr class="zone-row-z4 border-b border-slate-700/50"><td class="text-yellow-400 font-bold">Z4 Thr</td><td>${zones.z4}</td><td>${hrs.z4}</td></tr>
                <tr class="zone-row-z5"><td class="text-red-400 font-bold">Z5 VO2</td><td>${zones.z5}</td><td>${hrs.z5}</td></tr>
                `;
    }
    document.getElementById('inputLthrPaceDisplay').innerText = state.lthrPace || "--";
}


function generatePlan() {
    const planStart = new Date(TODAY);
    const day = planStart.getDay() || 7;
    if (day !== 1) planStart.setHours(-24 * (day - 1));
    planStart.setHours(0, 0, 0, 0);
    START_DATE = planStart;


    const baseKm = 44; const peakKm = 90; const totalWeeks = 20;
    state.generatedPlan = [];
    let currentKm = baseKm;


    // Use the safe EXPORT STRINGS (state.zonePcts) not the display strings
    const zp = state.zonePcts;
    const zv = state.zones; // Only used for UI label, not structure


    for (let w = 0; w < totalWeeks; w++) {
        if (w > 0 && (w) % 4 !== 0) currentKm = Math.round(currentKm * state.rampFactor);
        else if (w > 0 && (w) % 4 === 0) currentKm = Math.round(currentKm * 0.65);
        if (currentKm > peakKm) currentKm = peakKm;


        let phase = w > 8 ? "Specificity" : "Base"; if (w > 16) phase = "Taper";
        let lrDist = Math.max(18, Math.round(currentKm * 0.42));
        let rem = currentKm - lrDist;
        let easy = Math.round(rem * 0.4);
        let tempo = Math.round(rem * 0.3);


        let schedule = [
            { d: "Mon", t: "Strength A", det: "Neural Power", type: "WeightTraining", structure: STRENGTH_A },
            {
                d: "Tue", t: "Run", det: `${easy}km Easy (@${zv.z2})`, type: "Run",
                structure: `Warmup\n- 10m 60-70% Pace Press lap\n\nMain Set\n- ${easy - 2}km ${zp.z2}`
            },
            {
                d: "Wed", t: "Run", det: `Tempo (${tempo}km)`, type: "Run",
                structure: `Warmup\n- 15m 60-70% Pace Press lap\n\nMain Set\n- ${tempo - 3}km ${zp.z3}\n\nCooldown\n- 10m 60-70% Pace`
            },
            { d: "Thu", t: "Strength B", det: "Stability", type: "WeightTraining", structure: STRENGTH_B },
            {
                d: "Fri", t: "Run", det: `Intervals`, type: "Run",
                structure: `Warmup\n- 15m 60-70% Pace Press lap\n\nMain Set 6x\n- 20s ${zp.z5}\n- 40s 60-70% Pace\n\nCooldown\n- 10m 60-70% Pace`
            },
            {
                d: "Sat", t: "Run", det: "Shakeout", type: "Run",
                structure: `Warmup\n- 30m 60-70% Pace`
            },
            {
                d: "Sun", t: "Long Run", det: `${lrDist}km Z2`, type: "Run",
                structure: `Warmup\n- 10m 60-70% Pace Press lap\n\nMain Set\n- ${lrDist - 2}km ${zp.z2}`
            }
        ];


        let weeklyTSS = 0;
        schedule.forEach(s => {
            let dur = 45;
            if (s.type === 'WeightTraining') dur = 60;
            s.tss = estimateTSS(dur, s.det);
            if (s.type !== 'Note') weeklyTSS += s.tss;
        });


        state.generatedPlan.push({
            week: w + 1, phase: phase, focus: (w + 1) % 4 === 0 ? "Recovery" : "Build",
            mileage: currentKm + " km", rawKm: currentKm, totalTSS: weeklyTSS,
            estHours: (currentKm * 6 / 60 + 2).toFixed(1) + "h",
            schedule: schedule, startDateStr: planStart.toISOString()
        });
    }
}


function estimateTSS(durationMin, zone) {
    if (!durationMin) return 0;
    let tssPerHour = 50;
    if (zone.includes('Z1')) tssPerHour = 40;
    else if (zone.includes('Z3')) tssPerHour = 70;
    else if (zone.includes('Z4')) tssPerHour = 85;
    else if (zone.includes('Z5')) tssPerHour = 95;
    else if (zone.includes('Strength')) return 45;
    return Math.round((durationMin / 60) * tssPerHour);
}


function applyModifications() {
    for (const key in state.modifications) {
        const [w, d] = key.split('_').map(Number);
        if (state.generatedPlan[w] && state.generatedPlan[w].schedule[d]) {
            const mod = state.modifications[key];
            state.generatedPlan[w].schedule[d] = { ...state.generatedPlan[w].schedule[d], ...mod };
        }
    }
}


// --- UI & SETUP ---
function openSetup() { document.getElementById('setupModal').classList.remove('hidden'); document.getElementById('setupModal').classList.add('flex'); }
function closeSetup() { document.getElementById('setupModal').classList.add('hidden'); }
function showToast(msg) { const t = document.getElementById('toast'); document.getElementById('toastMsg').innerText = msg; t.classList.remove('translate-x-full'); setTimeout(() => t.classList.add('translate-x-full'), 3000); }


async function autoDetectSettings() {
    if (!document.getElementById('apiKeyInput').value) return showToast("Enter API Key");
    const auth = btoa("API_KEY:" + document.getElementById('apiKeyInput').value);
    const id = document.getElementById('athleteIdInput').value || '0';
    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${id}`, { headers: { 'Authorization': `Basic ${auth}` } });
        const data = await res.json();
        if (data.sportSettings) {
            const run = data.sportSettings.find(s => s.types.includes('Run'));
            if (run) {
                let paceVal = run.pace_ftp || run.threshold_pace;
                if (paceVal) {
                    let secPerKm = (paceVal < 20) ? (1000 / paceVal) : paceVal;
                    document.getElementById('inputLthrPace').value = secondsToTime(secPerKm);
                }
                if (run.lthr) document.getElementById('inputLthrBpm').value = run.lthr;
            }
        }
        showToast("Settings Detected!");
        state.apiKey = document.getElementById('apiKeyInput').value;
        state.athleteId = document.getElementById('athleteIdInput').value;
        await fetchZones();
        calculateZones();
    } catch (e) { console.error(e); showToast("Error Detecting"); }
}


function saveSettings() {
    state.apiKey = document.getElementById('apiKeyInput').value.trim();
    state.athleteId = document.getElementById('athleteIdInput').value.trim();
    state.est5k = document.getElementById('input5k').value;
    state.est10k = document.getElementById('input10k').value;
    state.lthrPace = document.getElementById('inputLthrPace').value;
    state.lthrBpm = document.getElementById('inputLthrBpm').value;
    state.raceDate = document.getElementById('raceDateInput').value;
    state.goalTime = document.getElementById('goalTimeInput').value;

    localStorage.setItem('elite_apiKey', state.apiKey);
    localStorage.setItem('elite_athleteId', state.athleteId);
    localStorage.setItem('elite_5k', state.est5k);
    localStorage.setItem('elite_10k', state.est10k);
    localStorage.setItem('elite_lthrPace', state.lthrPace);
    localStorage.setItem('elite_lthrBpm', state.lthrBpm);
    localStorage.setItem('elite_raceDate', state.raceDate);
    localStorage.setItem('elite_goalTime', state.goalTime);

    closeSetup();
    init();
}

async function fetchData(showMsg = false) {
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };
    try {
        if (showMsg) showToast("Fetching...");
        if (!state.fetchedZones) await fetchZones();
        await fetchWellness();
        calculateZones();
    } catch (e) { console.error(e); if (showMsg) showToast("Fetch Error"); }
}


function init() {
    document.getElementById('apiKeyInput').value = state.apiKey;
    document.getElementById('athleteIdInput').value = state.athleteId;
    document.getElementById('input5k').value = state.est5k;
    document.getElementById('input10k').value = state.est10k;
    document.getElementById('inputLthrPace').value = state.lthrPace;
    document.getElementById('inputLthrBpm').value = state.lthrBpm;
    document.getElementById('raceDateInput').value = state.raceDate;
    document.getElementById('goalTimeInput').value = state.goalTime;


    if (!state.apiKey) {
        openSetup();
    } else {
        fetchZones().then(() => {
            fetchWellness();
            calculateZones();
            generatePlan();
            applyModifications();
            // calculateTimeline(); // Disabled in Lock Mode
            // fetchData(); // Disabled in Lock Mode

            // Render just dummy items to fill the locked view
            const container = document.getElementById('planContainer');
            container.innerHTML = `
           <div class="p-4 rounded-lg border border-slate-700 bg-slate-800 mb-4 h-32 flex items-center justify-center text-slate-500">Week 1</div>
           <div class="p-4 rounded-lg border border-slate-700 bg-slate-800 mb-4 h-32 flex items-center justify-center text-slate-500">Week 2</div>
           <div class="p-4 rounded-lg border border-slate-700 bg-slate-800 mb-4 h-32 flex items-center justify-center text-slate-500">Week 3</div>
       `;
        });
    }
}


document.addEventListener('DOMContentLoaded', init);
