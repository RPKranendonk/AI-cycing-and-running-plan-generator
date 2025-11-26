// ==========================================
// INTERVALS.ICU SERVICE
// Handles all interactions with the Intervals.icu API
// ==========================================

async function pushToIntervalsICU(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return showToast("Error: Week not found");

    const workouts = state.generatedWorkouts[weekIndex];
    if (!workouts || workouts.length === 0) {
        return showToast("No workouts generated yet.");
    }

    const pushBtn = document.getElementById(`push-btn-${weekIndex}`);
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }

    showToast("Pushing to Intervals.icu...");

    try {
        // Only delete from Intervals.icu, DO NOT clear local state
        await deleteRemoteWorkouts(weekIndex);

        const events = [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const availability = state.weeklyAvailability[weekIndex] || state.defaultAvailableDays;

        workouts.forEach(workout => {
            let dateStr = "";
            let dayName = "";

            if (workout.start_date_local) {
                // Use the explicit date provided by AI
                dateStr = workout.start_date_local.split('T')[0];
                const d = new Date(workout.start_date_local); // Use full datetime for correct day
                const dayNum = d.getDay();

                // Check availability
                if (!availability.includes(dayNum)) return;
                dayName = dayNames[dayNum];

            } else {
                return; // Skip if no start_date_local (legacy data not supported)
            }

            // Construct Description
            let desc = workout.description_export || workout.description_ui || "";

            // If we have structured steps, use them to build the Intervals.icu text
            if (workout.steps && Array.isArray(workout.steps)) {
                desc = formatStepsForIntervals(workout.steps);
            }

            events.push({
                category: "WORKOUT",
                start_date_local: `${dateStr}T06:00:00`,
                type: "Run",
                name: workout.type || "Run",
                description: desc,
                external_id: `elite_coach_w${week.week}_${dayName}`
            });
        });

        // Bulk create
        const response = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/bulk?upsert=true`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`API_KEY:${state.apiKey}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(events)
        });

        if (!response.ok) throw new Error("API Error");
        showToast(`✅ Pushed ${events.length} workouts!`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "📤 Push to Intervals.icu"; }
    }
}

async function resetWeeklyWorkouts(weekIndex) {
    if (!confirm("Delete workouts for this week from Intervals.icu?")) return;

    showToast("Deleting...");
    try {
        // Delete from both local state and remote
        delete state.generatedWorkouts[weekIndex];
        await deleteRemoteWorkouts(weekIndex);

        // Clear UI
        const container = document.getElementById(`workout-summary-${weekIndex}`);
        if (container) {
            container.innerHTML = '<div class="text-xs text-slate-500 italic">No workouts generated yet. Click "Prepare Week Plan" to generate AI-powered workouts.</div>';
        }
        showToast("✅ Workouts cleared.");
    } catch (e) {
        showToast(`❌ Error: ${e.message}`);
    }
}

async function deleteRemoteWorkouts(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return;

    const start = new Date(week.startDate);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const sStr = start.toISOString().split('T')[0];
    const eStr = end.toISOString().split('T')[0];
    const auth = btoa("API_KEY:" + state.apiKey);

    const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${sStr}&newest=${eStr}`, {
        headers: { 'Authorization': `Basic ${auth}` }
    });

    const events = await res.json();
    const appEvents = events.filter(e => e.external_id && e.external_id.includes(`elite_coach_w${week.week}`));

    for (const e of appEvents) {
        await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/${e.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Basic ${auth}` }
        });
    }
}

// Helper: Create target promise for a single week
function createTargetPromise(apiKey, athleteId, startDate, type, value) {
    const payload = [{
        category: "TARGET",
        start_date_local: `${startDate}T00:00:00`,
        type: type,
        name: `Weekly ${type} Target`,
        external_id: `target_${type.toLowerCase()}_${startDate}`,
    }];

    if (type === "Run") payload[0].distance_target = Math.round(value * 1000);
    if (type === "Ride") payload[0].load_target = value;

    return sendTargetPayload(apiKey, athleteId, payload, type === "Run" ? "Run" : "Cycling");
}

// Helper: Send target payload to Intervals.icu (Matches test page logic)
async function sendTargetPayload(apiKey, athleteId, payload, type) {
    const auth = btoa(`API_KEY:${apiKey}`);

    // Calculate week start/end dates for deletion
    const startDate = payload[0].start_date_local.split('T')[0];
    const d = new Date(startDate);
    const endDate = new Date(d);
    endDate.setDate(d.getDate() + 6);
    const endDateStr = endDate.toISOString().split('T')[0];

    // 1. Delete existing targets for this week
    try {
        const getRes = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${startDate}&newest=${endDateStr}&category=TARGET`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (getRes.ok) {
            const existingEvents = await getRes.json();
            const targetType = payload[0].type;
            const targetsToDelete = existingEvents.filter(e => e.category === 'TARGET' && e.type === targetType);

            if (targetsToDelete.length > 0) {
                console.log(`Deleting ${targetsToDelete.length} existing ${type} targets for ${startDate}...`);
                for (const t of targetsToDelete) {
                    await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/${t.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Basic ${auth}` }
                    });
                }
            }
        }
    } catch (err) {
        console.warn("Error deleting existing targets:", err);
    }

    // 2. Push new target
    const response = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk?upsert=true`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response;
}

async function pushWeeklyTargetsToIntervals() {
    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        return showToast("No plan generated yet.");
    }

    if (!confirm("Push weekly targets to Intervals.icu? This will update your goals.")) return;

    const pushBtn = document.getElementById('push-targets-btn');
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }
    showToast("Pushing targets...");

    try {
        const isCycling = state.sportType === 'Cycling';

        // 1. Get Credentials
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKey = apiKeyInput && apiKeyInput.value ? apiKeyInput.value.trim() : state.apiKey;

        const athleteIdInput = document.getElementById('athleteIdInput');
        let athleteId = athleteIdInput && athleteIdInput.value ? athleteIdInput.value.trim() : state.athleteId;

        if (!apiKey || !athleteId) throw new Error("API Key or Athlete ID missing.");

        // 2. Determine Date Range for the Whole Plan
        const planStartInput = document.getElementById('planStartDateInput');
        const planStartDate = planStartInput && planStartInput.value ? new Date(planStartInput.value) : new Date();

        // Find start of first week and end of last week
        const firstWeek = state.generatedPlan[0];
        const lastWeek = state.generatedPlan[state.generatedPlan.length - 1];

        if (!firstWeek || !lastWeek) throw new Error("Invalid plan data.");

        const startD = new Date(planStartDate);
        startD.setDate(planStartDate.getDate() + ((firstWeek.week - 1) * 7));
        // Adjust to Monday
        const day = startD.getDay();
        const diff = startD.getDate() - day + (day == 0 ? -6 : 1);
        const planStartMonday = new Date(startD);
        planStartMonday.setDate(diff);

        const endD = new Date(planStartMonday);
        endD.setDate(planStartMonday.getDate() + (state.generatedPlan.length * 7)); // End of last week

        const sStr = planStartMonday.toISOString().split('T')[0];
        const eStr = endD.toISOString().split('T')[0];

        const auth = btoa(`API_KEY:${apiKey}`);
        const targetType = isCycling ? "Ride" : "Run";

        // 3. Fetch Existing Targets (Single Request)
        console.log(`Fetching existing targets from ${sStr} to ${eStr}...`);
        const getRes = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events?oldest=${sStr}&newest=${eStr}&category=TARGET`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (getRes.ok) {
            const existingEvents = await getRes.json();
            const targetsToDelete = existingEvents.filter(e => e.category === 'TARGET' && e.type === targetType);

            // 4. Delete Existing Targets (Sequential to be safe)
            if (targetsToDelete.length > 0) {
                showToast(`Cleaning up ${targetsToDelete.length} old targets...`);
                for (const t of targetsToDelete) {
                    await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/${t.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Basic ${auth}` }
                    });
                }
            }
        }

        // 5. Prepare Bulk Payload
        const bulkPayload = [];

        state.generatedPlan.forEach(week => {
            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + ((week.week - 1) * 7));

            const d = weekStart.getDay();
            const diff = weekStart.getDate() - d + (d == 0 ? -6 : 1);
            const monday = new Date(weekStart);
            monday.setDate(diff);

            if (isNaN(monday.getTime())) return;
            const dateStr = monday.toISOString().split('T')[0];

            const value = week.rawKm || week.mileage || 0;
            if (!value) return;

            const event = {
                category: "TARGET",
                start_date_local: `${dateStr}T00:00:00`,
                type: targetType,
                name: `Weekly ${targetType} Target`,
                external_id: `target_${targetType.toLowerCase()}_${dateStr}`,
            };

            if (targetType === "Run") event.distance_target = Math.round(value * 1000);
            if (targetType === "Ride") event.load_target = Math.round(value);

            bulkPayload.push(event);
        });

        // 6. Send Single Bulk Request
        if (bulkPayload.length > 0) {
            showToast(`Uploading ${bulkPayload.length} targets...`);
            const response = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk?upsert=true`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bulkPayload)
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`API Error: ${response.status} - ${errText}`);
            }
            showToast(`✅ Successfully pushed ${bulkPayload.length} weeks!`);
        } else {
            showToast("⚠️ No targets to push.");
        }

    } catch (e) {
        console.error(e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "🎯 Push Weekly Targets"; }
    }
}

async function pushSingleWeekTarget(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return showToast("Error: Week not found");

    if (!confirm(`Push target for Week ${week.week} to Intervals.icu?`)) return;

    const btnId = `push-week-btn-${weekIndex}`;
    const btn = document.getElementById(btnId);
    let originalText = "";
    if (btn) {
        originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = "⏳";
    }

    try {
        const isCycling = state.sportType === 'Cycling';
        const targetType = isCycling ? "Ride" : "Run";

        // Get Credentials
        const apiKey = state.apiKey;
        const athleteId = state.athleteId;

        if (!apiKey || !athleteId) throw new Error("Missing API Key or Athlete ID");

        // Calculate Date
        const planStartInput = document.getElementById('planStartDateInput');
        const planStartDate = planStartInput && planStartInput.value ? new Date(planStartInput.value) : new Date();

        const weekStart = new Date(planStartDate);
        weekStart.setDate(planStartDate.getDate() + ((week.week - 1) * 7));

        const day = weekStart.getDay();
        const diff = weekStart.getDate() - day + (day == 0 ? -6 : 1);
        const monday = new Date(weekStart);
        monday.setDate(diff);
        const dateStr = monday.toISOString().split('T')[0];

        // Get Value
        const value = week.rawKm || week.mileage || 0;
        if (!value) throw new Error("No target value for this week");

        await createTargetPromise(apiKey, athleteId, dateStr, targetType, value);
        showToast(`✅ Week ${week.week} target pushed!`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Error: ${e.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

async function deleteFutureTargets() {
    if (!confirm("Delete ALL future targets from today onwards? This cannot be undone.")) return;

    const delBtn = document.getElementById('delete-targets-btn');
    if (delBtn) { delBtn.disabled = true; delBtn.textContent = "Deleting..."; }
    showToast("Deleting future targets...");

    try {
        const today = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const nextYearStr = nextYear.toISOString().split('T')[0];

        const auth = btoa(`API_KEY:${state.apiKey}`);

        // 1. Fetch Events
        const res = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events?oldest=${today}&newest=${nextYearStr}&category=TARGET`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });

        if (!res.ok) throw new Error("Failed to fetch targets");
        const events = await res.json();

        const targets = events.filter(e => e.category === 'TARGET');

        if (targets.length === 0) {
            showToast("No future targets found.");
            return;
        }

        // 2. Delete Each
        for (const t of targets) {
            await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/${t.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Basic ${auth}` }
            });
        }

        showToast(`✅ Deleted ${targets.length} targets.`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Delete Error: ${e.message}`);
    } finally {
        if (delBtn) { delBtn.disabled = false; delBtn.textContent = "🗑️ Delete Future Targets"; }
    }
}

function formatStepsForIntervals(steps) {
    if (!steps || !Array.isArray(steps)) return "";

    let text = "";
    steps.forEach(step => {
        let line = "";

        if (step.type === "Warmup") line += "Warmup\n";
        if (step.type === "Cooldown") line += "Cooldown\n";
        if (step.type === "Rest") line += "Rest\n";

        let dur = "";
        if (step.duration) {
            // Convert seconds to minutes/seconds
            const mins = Math.floor(step.duration / 60);
            const secs = step.duration % 60;
            if (mins > 0) dur += `${mins}m`;
            if (secs > 0) dur += `${secs}s`;
        } else if (step.distance) {
            // Always use km to avoid Intervals.icu interpreting meters as minutes
            dur += `${(step.distance / 1000).toFixed(2)}km`;
        }

        let intensity = step.intensity || "";

        // Handle Press Lap for main step - should go at the beginning
        let pressLap = step.press_lap ? "Press Lap " : "";

        if (step.reps) {
            line += `${step.reps}x\n`;
            line += `- ${pressLap}${dur} ${intensity}\n`;

            if (step.recovery_duration || step.recovery_distance) {
                let recDur = "";
                if (step.recovery_duration) {
                    const rMins = Math.floor(step.recovery_duration / 60);
                    const rSecs = step.recovery_duration % 60;
                    if (rMins > 0) recDur += `${rMins}m`;
                    if (rSecs > 0) recDur += `${rSecs}s`;
                } else if (step.recovery_distance) {
                    // Always use km to avoid Intervals.icu interpreting meters as minutes
                    recDur += `${(step.recovery_distance / 1000).toFixed(2)}km`;
                }
                // Use a broad range for recovery to allow for lactate flushing
                let recInt = step.recovery_intensity || "50-65% Pace";
                let recPressLap = step.recovery_press_lap ? "Press Lap " : "";
                line += `- ${recPressLap}${recDur} ${recInt}\n`;
            }
        } else {
            line += `- ${pressLap}${dur} ${intensity}\n`;
        }

        text += line + "\n";
    });
    return text.trim();
}

// --- FETCHING & DATA LOGIC (Moved from volume.js & zones.js) ---

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
                }
            }
        }
    } catch (e) { console.error("Zone fetch error:", e); }
}

function calculateZones() {
    let zones = { z1: "--", z2: "--", z3: "--", z4: "--", z5: "--" };
    const fmt = secondsToTime;

    // --- PACE ZONES (Existing Logic) ---
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
            if (cleanPace.length >= 4) {
                state.zonePcts = {
                    z2: `${cleanPace[0]}-${cleanPace[1]}% Pace`,
                    z3: `${cleanPace[1]}-${cleanPace[2]}% Pace`,
                    z5: `${cleanPace[3]}-115% Pace`
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
                state.zonePcts = {
                    z2: `${fmt(v[0])}-${fmt(v[1])}`,
                    z3: `${fmt(v[1])}-${fmt(v[2])}`,
                    z5: `${fmt(v[3])}-${fmt(v[3] * 0.95)}`
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
        // Fallback Pace
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

    // Update LT Threshold Display
    const ltPaceEl = document.getElementById('disp-lthr-pace');
    const ltBpmEl = document.getElementById('disp-lthr-bpm');
    if (ltPaceEl) ltPaceEl.innerText = state.lthrPace || "--:--";
    if (ltBpmEl) ltBpmEl.innerText = state.lthrBpm || "--";
    const lthrPaceDisplay = document.getElementById('inputLthrPaceDisplay');
    if (lthrPaceDisplay) lthrPaceDisplay.innerText = state.lthrPace || "--";


    // Update Table
    state.zones = zones;
    const tbody = document.getElementById('zoneTableBody');
    if (tbody) {
        tbody.innerHTML = ''; // Clear existing

        // --- HR ZONES (Joe Friel Logic) ---
        let hrZones = [];
        let rhr = 30;
        if (state.wellness && state.wellness.length > 0) {
            const sorted = [...state.wellness].sort((a, b) => new Date(b.id) - new Date(a.id));
            if (sorted[0].restingHR) rhr = sorted[0].restingHR;
        }

        const zoneNames = [
            "Z1 Rec",
            "Z2 End",
            "Z3 Tmp",
            "Z4 Thr",
            "Z5a Sup",
            "Z5b VO2",
            "Z5c Ana"
        ];

        const getZoneStyle = (i) => {
            if (i <= 1) return { bg: 'bg-green-900/20', border: 'border-green-500', text: 'text-green-200' }; // Z1, Z2
            if (i <= 3) return { bg: 'bg-orange-900/20', border: 'border-orange-500', text: 'text-orange-200' }; // Z3, Z4
            return { bg: 'bg-red-900/20', border: 'border-red-500', text: 'text-red-200' }; // Rest
        };

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
            // Standard 5 zones fallback
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

        // --- PACE ZONES (Dynamic Logic) ---
        let paceZones = [];
        if (state.fetchedZones && state.fetchedZones.pace && state.fetchedZones.pace.length > 0) {
            let p = state.fetchedZones.pace;
            let cleanPace = p.map(x => (typeof x === 'object' && x.min) ? x.min : x);

            // Convert to seconds if percentage
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

            // Sort Slow -> Fast (Largest Sec -> Smallest Sec)
            pSec = pSec.map(x => x === 0 || x === Infinity ? 99999 : x);
            pSec.sort((a, b) => b - a);
            const validSecs = pSec.filter(x => x < 50000);

            // Generate Zones
            // Z1: > Num1
            // Z2: Num1 - Num2
            // ...
            if (validSecs.length > 0) {
                let startStr = `> ${fmt(validSecs[0])}`;
                paceZones.push(startStr);

                for (let i = 0; i < validSecs.length - 1; i++) {
                    paceZones.push(`${fmt(validSecs[i])} - ${fmt(validSecs[i + 1])}`);
                }

                // Last Zone: < Last Num
                paceZones.push(`< ${fmt(validSecs[validSecs.length - 1])}`);
            }
        } else {
            // Fallback Pace
            paceZones = [zones.z1, zones.z2, zones.z3, zones.z4, zones.z5];
        }


        // Render Table (Merge HR and Pace)
        // Render Table (Merge HR and Pace)
        const maxRows = Math.max(hrZones.length, paceZones.length);
        for (let i = 0; i < maxRows; i++) {
            const hrz = hrZones[i] || { name: `Z${i + 1}`, range: '--', colorClass: '', textClass: '' };
            const paceRange = paceZones[i] || '--';

            // Use HR color/name if available, else generic
            // Apply new color coding logic here
            let colorClass = hrz.colorClass || "border-b border-slate-800 last:border-0";

            if (!hrz.colorClass) {
                if (i === 0 || i === 1) colorClass += " bg-green-900/10 text-green-200"; // Z1, Z2
                else if (i === 2 || i === 3) colorClass += " bg-yellow-900/10 text-yellow-200"; // Z3, Z4
                else colorClass += " bg-red-900/10 text-red-200"; // Z5+
            }

            const name = hrz.name;
            const hrRange = hrz.range;

            const row = `
                <tr class="${colorClass}">
                    <td class="${hrz.textClass || 'font-bold'} px-2 py-1">${name}</td>
                    <td class="px-2 py-1 font-mono text-right">${paceRange}</td>
                    <td class="px-2 py-1 font-mono text-right">${hrRange}</td>
                </tr>
            `;
            tbody.innerHTML += row;
        }
    }
}
