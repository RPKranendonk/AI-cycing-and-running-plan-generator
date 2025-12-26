// ==========================================
// FITNESS FETCHER
// Fetch athlete data, wellness, activities from Intervals.icu
// Updates application state with fetched data
// ==========================================

/**
 * Fetch athlete settings from Intervals.icu
 * Updates state with FTP, weight, LTHR
 */
async function fetchAthleteSettings() {
    if (!state.apiKey || !state.athleteId) return;
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}`, { headers });
        if (!res.ok) throw new Error("Athlete settings fetch fail");
        const data = await res.json();

        if (data.ftp) {
            state.ftp = data.ftp;
            localStorage.setItem('elite_ftp', data.ftp);
        }

        if (data.weight) {
            state.weight = data.weight;
        }

        if (data.icu_lthr) {
            state.lthrBpm = data.icu_lthr;
            localStorage.setItem('elite_lthrBpm', data.icu_lthr);
            if (document.getElementById('inputLthrBpm')) {
                document.getElementById('inputLthrBpm').value = data.icu_lthr;
            }
        }

        if (data.icu_max_hr) {
            state.maxHr = data.icu_max_hr;
        }

        console.log("[Fitness] Fetched Athlete Settings:", { ftp: state.ftp, lthr: state.lthrBpm, weight: state.weight });

    } catch (e) {
        console.error("[Fitness] Athlete settings fetch error:", e);
    }
}

/**
 * Fetch recent activities from Intervals.icu
 * Updates state.activities and triggers weekly volume update
 */
async function fetchActivities() {
    if (!state.apiKey) return;
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 40);
    const oldest = start.toISOString().split('T')[0];
    const newest = end.toISOString().split('T')[0];

    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/activities?oldest=${oldest}&newest=${newest}`, { headers });
        if (!res.ok) throw new Error("Activities fetch fail");
        const data = await res.json();
        state.activities = data;
        updateWeeklyVolume();
    } catch (e) {
        console.error("[Fitness] Activities fetch error:", e);
    }
}

/**
 * Fetch activities for a specific date range
 * @param {string} oldest - Start date YYYY-MM-DD
 * @param {string} newest - End date YYYY-MM-DD
 * @returns {Promise<Array>} Activities
 */
async function fetchActivitiesForRange(oldest, newest) {
    if (!state.apiKey || !state.athleteId) return [];

    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        const res = await fetch(
            `https://intervals.icu/api/v1/athlete/${state.athleteId}/activities?oldest=${oldest}&newest=${newest}`,
            { headers }
        );
        if (!res.ok) throw new Error(`Activities fetch failed: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("[Fitness] Activities range fetch error:", e);
        return [];
    }
}

/**
 * Fetch planned events from Intervals.icu
 * @param {string} oldest - Start date YYYY-MM-DD
 * @param {string} newest - End date YYYY-MM-DD
 * @returns {Promise<Array>} Planned workout events
 */
async function fetchPlannedEvents(oldest, newest) {
    if (!state.apiKey || !state.athleteId) {
        console.warn('[Fitness] Missing API credentials');
        return [];
    }

    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        const res = await fetch(
            `https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${oldest}&newest=${newest}`,
            { headers }
        );
        if (!res.ok) throw new Error(`Events fetch failed: ${res.status}`);
        const data = await res.json();
        console.log(`[Fitness] Fetched ${data.length} planned events for ${oldest} to ${newest}`);
        return data;
    } catch (e) {
        console.error("[Fitness] Events fetch error:", e);
        return [];
    }
}

/**
 * Fetch fitness data (CTL, ATL, TSB) from Intervals.icu
 * @returns {Promise<Object>} { ctl, atl, tsb, rampRate }
 */
async function fetchFitness() {
    if (!state.apiKey || !state.athleteId) {
        console.warn('[Fitness] Missing API credentials');
        return null;
    }

    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    try {
        const res = await fetch(
            `https://intervals.icu/api/v1/athlete/${state.athleteId}`,
            { headers }
        );
        if (!res.ok) throw new Error(`Athlete fetch failed: ${res.status}`);
        const data = await res.json();

        const fitness = {
            ctl: data.ctl || 0,
            atl: data.atl || 0,
            tsb: data.tsb || 0,
            rampRate: data.ramp_rate || 0
        };

        state.fitness = fitness;
        console.log('[Fitness] Updated:', fitness);
        return fitness;
    } catch (e) {
        console.error("[Fitness] Fetch error:", e);
        return null;
    }
}

/**
 * Fetch wellness data from Intervals.icu
 * Updates state.wellness and triggers biometrics update
 */
async function fetchWellness() {
    if (!state.apiKey) return;
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 28);
    const oldest = start.toISOString().split('T')[0];
    const newest = end.toISOString().split('T')[0];

    try {
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/wellness?oldest=${oldest}&newest=${newest}`, { headers });
        if (!res.ok) {
            if (res.status === 403) {
                console.warn("[Fitness] 403 Forbidden. Likely missing 'WELLNESS' scope.");
                showToast("⚠️ Wellness access denied. Checked API Key permissions?", "warning");
                return;
            }
            throw new Error(`Wellness fetch fail (${res.status})`);
        }
        const data = await res.json();
        state.wellness = data;
        console.log(`[Fitness] Fetched ${data.length} wellness entries`);
        updateBiometrics();
    } catch (e) {
        console.error("[Fitness] Wellness fetch error:", e);
    }
}

/**
 * Calculate compliance for a specific week
 * @param {number} weekIndex - Index of week in generated plan
 * @returns {Promise<Object>} { compliance, plannedVolume, actualVolume, details }
 */
async function calculateWeekCompliance(weekIndex) {
    const weekPlan = state.generatedPlan?.[weekIndex];
    if (!weekPlan) {
        console.warn(`[Fitness] No plan found for week ${weekIndex}`);
        return { compliance: null, plannedVolume: 0, actualVolume: 0, details: [] };
    }

    const weekStart = weekPlan.startDate;
    if (!weekStart) {
        console.warn(`[Fitness] No start date for week ${weekIndex}`);
        return { compliance: null, plannedVolume: 0, actualVolume: 0, details: [] };
    }

    const startDate = new Date(weekStart + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    const oldest = weekStart;
    const newest = endDate.toISOString().split('T')[0];

    const [plannedEvents, activities] = await Promise.all([
        fetchPlannedEvents(oldest, newest),
        fetchActivitiesForRange(oldest, newest)
    ]);

    const sportType = state.sportType || 'Running';
    let plannedVolume = weekPlan.rawKm || 0;

    let actualVolume = 0;
    const details = [];

    activities.forEach(act => {
        const actType = act.type?.toLowerCase() || '';
        const isRun = actType.includes('run');
        const isRide = actType.includes('ride') || actType.includes('cycling');

        if ((sportType === 'Running' && isRun) || (sportType === 'Cycling' && isRide)) {
            const distanceKm = (act.distance || 0) / 1000;
            actualVolume += distanceKm;
            details.push({
                date: act.start_date_local?.split('T')[0],
                name: act.name,
                distance: distanceKm.toFixed(1),
                type: act.type
            });
        }
    });

    const compliance = plannedVolume > 0 ? Math.min(actualVolume / plannedVolume, 1.5) : 1.0;

    console.log(`[Fitness] Week ${weekIndex}: ${actualVolume.toFixed(1)}/${plannedVolume.toFixed(1)} km = ${(compliance * 100).toFixed(0)}%`);

    return {
        compliance: parseFloat(compliance.toFixed(2)),
        plannedVolume: parseFloat(plannedVolume.toFixed(1)),
        actualVolume: parseFloat(actualVolume.toFixed(1)),
        details
    };
}

/**
 * Update weekly volume display from fetched activities
 */
function updateWeeklyVolume() {
    if (!state.activities || state.activities.length === 0) return;

    const getWeek = window.getWeekNumber || ((d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    });

    const fmtDate = (dStr) => {
        const d = new Date(dStr);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const now = new Date();
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
    lastSunday.setHours(23, 59, 59, 999);

    const weeks = [];
    for (let i = 0; i < 4; i++) {
        const end = new Date(lastSunday);
        end.setDate(lastSunday.getDate() - (i * 7));
        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        weeks.push({ start, end, totalKm: 0, id: i });
    }

    let lastWeekActs = [];
    let maxRunLastWeek = 0;

    state.activities.forEach(act => {
        if (act.type === 'Run') {
            const d = new Date(act.start_date_local);
            weeks.forEach((w, index) => {
                if (d >= w.start && d <= w.end) {
                    const km = (act.distance || 0) / 1000;
                    w.totalKm += km;
                    if (index === 0) {
                        lastWeekActs.push(km.toFixed(2));
                        if (km > maxRunLastWeek) maxRunLastWeek = km;
                    }
                }
            });
        }
    });

    state.lastWeekLongRun = maxRunLastWeek;

    // Update UI
    const lastWeek = weeks[0];
    const dateRange = `${fmtDate(lastWeek.start)}-${fmtDate(lastWeek.end)}`;

    const labelEl = document.getElementById('vol-last-week-label');
    if (labelEl) labelEl.innerText = `Last Week`;

    const datesEl = document.getElementById('vol-last-week-dates');
    if (datesEl) datesEl.innerText = dateRange;

    const kmEl = document.getElementById('vol-last-week-km');
    if (kmEl) kmEl.innerText = lastWeek.totalKm.toFixed(1);

    const total4Wk = weeks.reduce((acc, curr) => acc + curr.totalKm, 0);
    const avg4Wk = total4Wk / 4;

    const avgEl = document.getElementById('vol-4wk-avg');
    if (avgEl) avgEl.innerText = avg4Wk.toFixed(1);

    const baseVol = lastWeek.totalKm > 0 ? lastWeek.totalKm : avg4Wk;

    const aggEl = document.getElementById('vol-sugg-agg');
    if (aggEl) aggEl.innerText = (baseVol * 1.10).toFixed(1) + ' km';

    const normEl = document.getElementById('vol-sugg-norm');
    if (normEl) normEl.innerText = (baseVol * 1.075).toFixed(1) + ' km';

    const easyEl = document.getElementById('vol-sugg-easy');
    if (easyEl) easyEl.innerText = (baseVol * 1.05).toFixed(1) + ' km';

    const dbgActs = document.getElementById('dbg-last-week-acts');
    if (dbgActs) {
        dbgActs.innerText = lastWeekActs.length > 0 ? lastWeekActs.join(' + ') : "No runs";
    }
}

/**
 * Update biometrics display from wellness data
 */
function updateBiometrics() {
    if (!state.wellness || state.wellness.length === 0) {
        console.warn("[Fitness] No wellness data to update biometrics");
        return;
    }

    const sorted = [...state.wellness].sort((a, b) => new Date(b.id) - new Date(a.id));
    const latest = sorted[0];

    const calcAvg = (field) => {
        const sum = sorted.reduce((acc, curr) => acc + (curr[field] || 0), 0);
        const count = sorted.filter(x => x[field]).length;
        return count > 0 ? Math.round(sum / count) : 0;
    };

    const withWeight = sorted.find(w => w.weight);
    if (withWeight && withWeight.weight) {
        state.weight = withWeight.weight;
        localStorage.setItem('elite_weight', withWeight.weight);
        console.log(`[Fitness] Weight extracted: ${withWeight.weight} kg`);
    }

    const stats = {
        rhr: { current: latest.restingHR || 0, avg: calcAvg('restingHR') },
        hrv: { current: latest.hrv || 0, avg: calcAvg('hrv') },
        sleep: { current: latest.sleepSecs ? (latest.sleepSecs / 3600).toFixed(1) : 0, avg: (calcAvg('sleepSecs') / 3600).toFixed(1) },
        soreness: { current: latest.soreness || 0, avg: calcAvg('soreness') },
        bodyBattery: { current: latest.bodyBattery || 0, avg: calcAvg('bodyBattery') }
    };

    state.biometrics = stats;
    console.log("[Fitness] Biometrics updated:", stats);

    // Update UI
    const rhrEl = document.getElementById('bio-rhr');
    if (rhrEl) rhrEl.innerHTML = `${stats.rhr.current || '--'} <span class="text-[10px] text-slate-500 font-normal">/ ${stats.rhr.avg || '--'} avg</span>`;

    const hrvEl = document.getElementById('bio-hrv');
    if (hrvEl) hrvEl.innerHTML = `${stats.hrv.current || '--'} <span class="text-[10px] text-slate-500 font-normal">/ ${stats.hrv.avg || '--'} avg</span>`;

    const sleepEl = document.getElementById('bio-sleep');
    if (sleepEl) sleepEl.innerHTML = `${stats.sleep.current}h <span class="text-[10px] text-slate-500 font-normal">/ ${stats.sleep.avg}h avg</span>`;

    const sorenessEl = document.getElementById('bio-soreness');
    if (sorenessEl) sorenessEl.innerHTML = `${stats.soreness.current || '--'} <span class="text-[10px] text-slate-500 font-normal">/ ${stats.soreness.avg || '--'} avg</span>`;
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.fetchAthleteSettings = fetchAthleteSettings;
window.fetchWellness = fetchWellness;
window.fetchActivities = fetchActivities;
window.fetchPlannedEvents = fetchPlannedEvents;
window.fetchFitness = fetchFitness;
window.calculateWeekCompliance = calculateWeekCompliance;
window.fetchActivitiesForRange = fetchActivitiesForRange;
window.updateWeeklyVolume = updateWeeklyVolume;
window.updateBiometrics = updateBiometrics;

window.FitnessFetcher = {
    fetchAthleteSettings,
    fetchWellness,
    fetchActivities,
    fetchPlannedEvents,
    fetchFitness,
    calculateWeekCompliance,
    fetchActivitiesForRange,
    updateWeeklyVolume,
    updateBiometrics
};
