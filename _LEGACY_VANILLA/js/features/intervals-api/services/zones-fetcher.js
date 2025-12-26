/**
 * @file zones-fetcher.js
 * @description Fetches athlete settings (Zones, LTHR, FTP) from Intervals.icu and updates local state.
 * @usedBy js/week-ui.js (init), js/settings-ui.js
 * @responsibilities
 * - Pulls HrZones and PaceZones from the API
 * - Calculates zone ranges (min/max) for display
 * - Updates the global `state.zones` object used by the rest of the app
 * @why Ensures the app's intensity calculations match the user's actual settings in Intervals.icu.
 */

// ==========================================
// ZONES FETCHER
// Fetch and calculate training zones from Intervals.icu
// ==========================================

/**
 * Fetch zones from Intervals.icu athlete settings
 * @param {number} retryCount - Current retry attempt
 */
async function fetchZones(retryCount = 0) {
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

                // Display Raw Pace Data
                const rawPaceEl = document.getElementById('rawPaceOutput');
                if (rawPaceEl) {
                    rawPaceEl.innerText = JSON.stringify(runSettings.pace_zones, null, 2);
                }

                const srcEl = document.getElementById('zoneSource');
                if (srcEl) srcEl.innerText = "Synced: Intervals.icu";

                if (runSettings.lthr) state.lthrBpm = runSettings.lthr;
                if (runSettings.threshold_pace) {
                    state.thresholdSpeed = runSettings.threshold_pace;
                    let val = runSettings.threshold_pace;
                    let sec = (val < 20) ? (1000 / val) : val;
                    state.lthrPace = secondsToTime(sec);

                    state.thresholdPaceSecPerKm = sec;
                    localStorage.setItem('elite_thresholdPace', sec.toString());

                    if (window.ZoneService?.calculateZonesFromLT) {
                        window.ZoneService.calculateZonesFromLT(sec);
                        console.log('[Zones] Updated ZoneService with LT pace:', secondsToTime(sec));
                    }
                }
            }

            const rideSettings = data.sportSettings.find(s => s.types.includes('Ride'));
            if (rideSettings) {
                if (rideSettings.ftp) state.ftp = rideSettings.ftp;
            }
        }
    } catch (e) {
        const maxRetries = 2;
        if (retryCount < maxRetries && (e.message.includes('Failed to fetch') || e.message.includes('NetworkError'))) {
            const delay = Math.pow(2, retryCount) * 1000;
            console.warn(`[Zones] Network error, retrying in ${delay}ms... (attempt ${retryCount + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchZones(retryCount + 1);
        }
        console.error("[Zones] Zone fetch error:", e);
    }
}

/**
 * Calculate and display zones in UI
 * Handles both absolute and percentage-based zone configs
 */
function calculateZones() {
    let zones = { z1: "--", z2: "--", z3: "--", z4: "--", z5: "--" };
    const fmt = window.secondsToTime || ((sec) => {
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    });

    // --- PACE ZONES ---
    if (state.fetchedZones && state.fetchedZones.pace && state.fetchedZones.pace.length > 0) {
        let p = state.fetchedZones.pace;
        let cleanPace = p.map(x => (typeof x === 'object' && x.min) ? x.min : x);

        const isPercentage = cleanPace.some(x => x > 60 && x < 130) && state.thresholdSpeed;
        let pSec = [];

        if (isPercentage && state.thresholdSpeed) {
            pSec = cleanPace.map(pct => {
                if (pct > 500) return 0;
                const speedMs = (pct / 100) * state.thresholdSpeed;
                return 1000 / speedMs;
            });

            if (cleanPace.length >= 4) {
                state.zonePcts = {
                    z2: `${cleanPace[0]}-${cleanPace[1]}% Pace`,
                    z3: `${cleanPace[1]}-${cleanPace[2]}% Pace`,
                    z5: `${cleanPace[3]}-115% Pace`
                };
            }
        } else {
            pSec = cleanPace.map(val => {
                if (val === 0 || val > 900) return 0;
                if (val < 25) return (1000 / val);
                return val;
            });
            pSec = pSec.map(x => x === 0 || x === Infinity ? 99999 : x);
            pSec.sort((a, b) => b - a);
            const v = pSec.filter(x => x < 50000);

            if (v.length >= 4) {
                state.zonePcts = {
                    z2: `${fmt(v[0])}-${fmt(v[1])}`,
                    z3: `${fmt(v[1])}-${fmt(v[2])}`,
                    z5: `${fmt(v[3])}-${fmt(v[3] * 0.95)}`
                };
            }
        }

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
        // Fallback Pace from LT
        const lthrSec = window.timeToSeconds ? window.timeToSeconds(state.lthrPace) : 0;
        if (lthrSec > 0) {
            zones.z1 = `${fmt(lthrSec * 1.29)}+`;
            zones.z2 = `${fmt(lthrSec * 1.14)}-${fmt(lthrSec * 1.29)}`;
            zones.z3 = `${fmt(lthrSec * 1.06)}-${fmt(lthrSec * 1.13)}`;
            zones.z4 = `${fmt(lthrSec * 1.00)}-${fmt(lthrSec * 1.05)}`;
            zones.z5 = `<${fmt(lthrSec * 0.98)}`;
        }
    }

    // Update Debugger
    const dbgZ2 = document.getElementById('dbg-z2');
    const dbgZ5 = document.getElementById('dbg-z5');
    if (dbgZ2 && state.zonePcts) dbgZ2.innerText = state.zonePcts.z2;
    if (dbgZ5 && state.zonePcts) dbgZ5.innerText = state.zonePcts.z5;

    // Update LT Threshold Display
    const ltPaceEl = document.getElementById('disp-lthr-pace');
    const ltBpmEl = document.getElementById('disp-lthr-bpm');
    if (ltPaceEl) ltPaceEl.innerText = state.lthrPace || "--:--";
    if (ltBpmEl) ltBpmEl.innerText = state.lthrBpm || "--";
    const lthrPaceDisplay = document.getElementById('inputLthrPaceDisplay');
    if (lthrPaceDisplay) lthrPaceDisplay.innerText = state.lthrPace || "--";

    // Update Zone Table
    state.zones = zones;
    const tbody = document.getElementById('zoneTableBody');
    if (tbody) {
        tbody.innerHTML = '';
        renderZoneTable(tbody, zones, fmt);
    }
}

/**
 * Render zone table with HR and Pace zones
 * @param {HTMLElement} tbody - Table body element
 * @param {Object} zones - Pace zones object
 * @param {Function} fmt - Time formatter function
 */
function renderZoneTable(tbody, zones, fmt) {
    const zoneNames = ["Z1 Rec", "Z2 End", "Z3 Tmp", "Z4 Thr", "Z5a Sup", "Z5b VO2", "Z5c Ana"];

    const getZoneStyle = (i) => {
        if (i <= 1) return { bg: 'bg-green-900/20', border: 'border-green-500', text: 'text-green-200' };
        if (i <= 3) return { bg: 'bg-orange-900/20', border: 'border-orange-500', text: 'text-orange-200' };
        return { bg: 'bg-red-900/20', border: 'border-red-500', text: 'text-red-200' };
    };

    // Build HR Zones
    let hrZones = [];
    let rhr = 30;
    if (state.wellness && state.wellness.length > 0) {
        const sorted = [...state.wellness].sort((a, b) => new Date(b.id) - new Date(a.id));
        if (sorted[0].restingHR) rhr = sorted[0].restingHR;
    }

    if (state.fetchedZones && state.fetchedZones.hr && state.fetchedZones.hr.length > 0) {
        const h = state.fetchedZones.hr;
        let start = rhr;
        h.forEach((endPoint, i) => {
            const style = getZoneStyle(i);
            hrZones.push({
                name: zoneNames[i] || `Z${i + 1}`,
                range: `${start} - ${endPoint}`,
                colorClass: `${style.bg} border-l-4 ${style.border}`,
                textClass: style.text
            });
            start = endPoint + 1;
        });
    } else {
        // Fallback HR
        const lthr = parseInt(state.lthrBpm) || 170;
        const fallbackRanges = [
            `<${Math.round(lthr * 0.81)}`,
            `${Math.round(lthr * 0.81)}-${Math.round(lthr * 0.89)}`,
            `${Math.round(lthr * 0.90)}-${Math.round(lthr * 0.93)}`,
            `${Math.round(lthr * 0.94)}-${Math.round(lthr * 0.99)}`,
            `>${lthr}`
        ];

        fallbackRanges.forEach((range, i) => {
            const style = getZoneStyle(i);
            hrZones.push({
                name: zoneNames[i] || `Z${i + 1}`,
                range: range,
                colorClass: `${style.bg} border-l-4 ${style.border}`,
                textClass: style.text
            });
        });
    }

    // Build Pace Zones
    let paceZones = [];
    if (state.fetchedZones && state.fetchedZones.pace && state.fetchedZones.pace.length > 0) {
        let p = state.fetchedZones.pace;
        let cleanPace = p.map(x => (typeof x === 'object' && x.min) ? x.min : x);

        const isPercentage = cleanPace.some(x => x > 60 && x < 130) && state.thresholdSpeed;
        let pSec = [];
        if (isPercentage && state.thresholdSpeed) {
            pSec = cleanPace.map(pct => {
                if (pct > 500) return 0;
                const speedMs = (pct / 100) * state.thresholdSpeed;
                return 1000 / speedMs;
            });
        } else {
            pSec = cleanPace.map(val => {
                if (val === 0 || val > 900) return 0;
                if (val < 25) return (1000 / val);
                return val;
            });
        }

        pSec = pSec.map(x => x === 0 || x === Infinity ? 99999 : x);
        pSec.sort((a, b) => b - a);
        const validSecs = pSec.filter(x => x < 50000);

        if (validSecs.length > 0) {
            paceZones.push(`> ${fmt(validSecs[0])}`);
            for (let i = 0; i < validSecs.length - 1; i++) {
                paceZones.push(`${fmt(validSecs[i])} - ${fmt(validSecs[i + 1])}`);
            }
            paceZones.push(`< ${fmt(validSecs[validSecs.length - 1])}`);
        }
    } else {
        paceZones = [zones.z1, zones.z2, zones.z3, zones.z4, zones.z5];
    }

    // Render Table
    const maxRows = Math.max(hrZones.length, paceZones.length);
    for (let i = 0; i < maxRows; i++) {
        const hrz = hrZones[i] || { name: `Z${i + 1}`, range: '--', colorClass: '', textClass: '' };
        const paceRange = paceZones[i] || '--';

        let colorClass = hrz.colorClass || "border-b border-slate-800 last:border-0";
        if (!hrz.colorClass) {
            if (i === 0 || i === 1) colorClass += " bg-green-900/10 text-green-200";
            else if (i === 2 || i === 3) colorClass += " bg-yellow-900/10 text-yellow-200";
            else colorClass += " bg-red-900/10 text-red-200";
        }

        const row = `
            <tr class="${colorClass}">
                <td class="${hrz.textClass || 'font-bold'} px-2 py-1">${hrz.name}</td>
                <td class="px-2 py-1 font-mono text-right">${paceRange}</td>
                <td class="px-2 py-1 font-mono text-right">${hrz.range}</td>
            </tr>
        `;
        tbody.innerHTML += row;
    }
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.fetchZones = fetchZones;
window.calculateZones = calculateZones;

window.ZonesFetcher = {
    fetchZones,
    calculateZones,
    renderZoneTable
};
