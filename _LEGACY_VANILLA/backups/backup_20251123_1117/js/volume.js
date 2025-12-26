// --- VOLUME & ACTIVITIES LOGIC ---

async function fetchActivities() {
    if (!state.apiKey) return;
    const auth = btoa("API_KEY:" + state.apiKey);
    const headers = { 'Authorization': `Basic ${auth}` };

    // Fetch last 40 days to be safe (need 4 full weeks + current partial week)
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
    } catch (e) { console.error("Activities fetch error:", e); }
}

function updateWeeklyVolume() {
    if (!state.activities || state.activities.length === 0) return;

    // Helper: Get ISO Week Number
    const getWeek = (d) => {
        const date = new Date(d.getTime());
        date.setHours(0, 0, 0, 0);
        date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
        const week1 = new Date(date.getFullYear(), 0, 4);
        return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };

    // Helper: Format Date DD.MM
    const fmtDate = (dStr) => {
        const d = new Date(dStr);
        return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    // Group activities by week (Mon-Sun)
    // We need to identify "Last Full Week" and the 3 weeks before it.

    const now = new Date();
    const currentDay = now.getDay(); // 0=Sun, 1=Mon

    // Find date of last Sunday
    const lastSunday = new Date(now);
    lastSunday.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
    lastSunday.setHours(23, 59, 59, 999);

    // Start of last full week (Monday)
    const lastWeekStart = new Date(lastSunday);
    lastWeekStart.setDate(lastSunday.getDate() - 6);
    lastWeekStart.setHours(0, 0, 0, 0);

    // Define the 4-week window
    const weeks = [];
    for (let i = 0; i < 4; i++) {
        const end = new Date(lastSunday);
        end.setDate(lastSunday.getDate() - (i * 7));

        const start = new Date(end);
        start.setDate(end.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        weeks.push({ start, end, totalKm: 0, id: i });
    }

    // Sum distances & Collect Debug Info
    let lastWeekActs = [];
    let maxRunLastWeek = 0;

    state.activities.forEach(act => {
        if (act.type === 'Run') {
            const d = new Date(act.start_date_local);
            // Check which week bucket it falls into
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

    // Update UI - Last Week (Index 0)
    const lastWeek = weeks[0];
    const weekNum = getWeek(lastWeek.start);
    const dateRange = `${fmtDate(lastWeek.start)}-${fmtDate(lastWeek.end)}`;

    const labelEl = document.getElementById('vol-last-week-label');
    if (labelEl) labelEl.innerText = `Last Week`;

    const datesEl = document.getElementById('vol-last-week-dates');
    if (datesEl) datesEl.innerText = dateRange;

    const kmEl = document.getElementById('vol-last-week-km');
    if (kmEl) kmEl.innerText = lastWeek.totalKm.toFixed(1);

    // Update UI - 4 Week Avg
    const total4Wk = weeks.reduce((acc, curr) => acc + curr.totalKm, 0);
    const avg4Wk = total4Wk / 4;

    const avgEl = document.getElementById('vol-4wk-avg');
    if (avgEl) avgEl.innerText = avg4Wk.toFixed(1);

    // Suggested Volume
    const baseVol = lastWeek.totalKm > 0 ? lastWeek.totalKm : avg4Wk; // Use Last Week if available, else Avg

    const aggEl = document.getElementById('vol-sugg-agg');
    if (aggEl) aggEl.innerText = (baseVol * 1.10).toFixed(1) + ' km';

    const normEl = document.getElementById('vol-sugg-norm');
    if (normEl) normEl.innerText = (baseVol * 1.075).toFixed(1) + ' km';

    const easyEl = document.getElementById('vol-sugg-easy');
    if (easyEl) easyEl.innerText = (baseVol * 1.05).toFixed(1) + ' km';

    // Debug Info
    const dbgActs = document.getElementById('dbg-last-week-acts');
    if (dbgActs) {
        dbgActs.innerText = lastWeekActs.length > 0 ? lastWeekActs.join(' + ') : "No runs";
    }
}
