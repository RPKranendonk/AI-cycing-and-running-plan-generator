// ==========================================
// TARGETS SERVICE
// Push and delete weekly targets to Intervals.icu
// ==========================================

/**
 * Parse YYYY-MM-DD as local date to prevent timezone shift
 * @param {string} val - Date string
 * @returns {Date} Local date
 */
function parseLocalDate(val) {
    if (!val) return new Date();
    const [y, m, d] = val.split('-').map(Number);
    return new Date(y, m - 1, d);
}

/**
 * Format date as YYYY-MM-DD using local timezone
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Send target payload to Intervals.icu
 * @param {string} apiKey - API Key
 * @param {string} athleteId - Athlete ID
 * @param {Array} payload - Target payload
 * @param {string} type - Target type (Run/Ride)
 * @returns {Promise} API Response
 */
async function sendTargetPayload(apiKey, athleteId, payload, type) {
    const auth = btoa(`API_KEY:${apiKey}`);

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
                console.log(`[Targets] Deleting ${targetsToDelete.length} existing ${type} targets for ${startDate}...`);
                for (const t of targetsToDelete) {
                    await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/${t.id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Basic ${auth}` }
                    });
                }
            }
        }
    } catch (err) {
        console.warn("[Targets] Error deleting existing targets:", err);
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
        console.error('[Targets] API Error Response:', errorText);
        throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    return response;
}

/**
 * Create target promise for a single week
 * @param {string} apiKey - API Key
 * @param {string} athleteId - Athlete ID
 * @param {string} startDate - Week start date
 * @param {string} type - Target type (Run/Ride)
 * @param {number} value - Target value (km or TSS)
 */
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

/**
 * Execute push of all weekly targets
 * @param {HTMLElement} pushBtn - Button element
 */
async function executePushTargets(pushBtn) {
    try {
        const isCycling = state.sportType === 'Cycling';

        // Get Credentials
        const apiKeyInput = document.getElementById('apiKeyInput');
        const apiKey = apiKeyInput && apiKeyInput.value ? apiKeyInput.value.trim() : state.apiKey;

        const athleteIdInput = document.getElementById('athleteIdInput');
        let athleteId = athleteIdInput && athleteIdInput.value ? athleteIdInput.value.trim() : state.athleteId;

        if (!apiKey || !athleteId) throw new Error("API Key or Athlete ID missing.");

        // Prepare ALL events for bulk upload
        const events = [];
        const targetType = isCycling ? "Ride" : "Run";

        // Determine Plan Start Date
        let planStartInput = isCycling
            ? document.getElementById('planStartDateInputCycle')
            : document.getElementById('planStartDateInputRun');
        if (!planStartInput) planStartInput = document.getElementById('planStartDateInput');

        const planStartDate = planStartInput && planStartInput.value ? parseLocalDate(planStartInput.value) : new Date();

        state.generatedPlan.forEach(week => {
            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + ((week.week - 1) * 7));

            // Adjust to Monday
            const d = weekStart.getDay();
            const diff = weekStart.getDate() - d + (d == 0 ? -6 : 1);
            const monday = new Date(weekStart);
            monday.setDate(diff);

            if (isNaN(monday.getTime())) return;

            const dateStr = formatLocalDate(monday);
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
            if (targetType === "Ride") event.load_target = value;

            events.push(event);
        });

        if (events.length === 0) {
            showToast("No targets to push.");
            return;
        }

        // Execute bulk upload
        const auth = btoa(`API_KEY:${apiKey}`);
        try {
            const response = await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events/bulk?upsert=true`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(events)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Bulk API Error: ${response.status} - ${errorText}`);
            }

            showToast(`✅ Pushed ${events.length} weekly targets!`);
        } catch (bulkError) {
            console.warn("[Targets] Bulk upload failed, falling back to sequential:", bulkError);
            showToast("⚠️ Bulk upload failed. Retrying sequentially...");

            // Fallback: Sequential Upload
            let successCount = 0;
            for (const event of events) {
                try {
                    await fetch(`https://intervals.icu/api/v1/athlete/${athleteId}/events`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Basic ${auth}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(event)
                    });
                    successCount++;
                } catch (seqError) {
                    console.error("[Targets] Sequential upload error:", seqError);
                }
                await new Promise(r => setTimeout(r, 300));
            }

            if (successCount > 0) {
                showToast(`✅ Pushed ${successCount}/${events.length} targets (Sequential)`);
            } else {
                throw new Error("All upload attempts failed.");
            }
        }

    } catch (e) {
        console.error(e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "🎯 Push Weekly Targets"; }
    }
}

/**
 * Push weekly targets with confirmation
 */
async function pushWeeklyTargetsToIntervals() {
    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        return showToast("No plan generated yet.");
    }

    showConfirm("Push Targets", "Push weekly targets to Intervals.icu? This will update your goals.", async () => {
        const pushBtn = document.getElementById('push-targets-btn');
        if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }
        showToast("Pushing targets...");

        try {
            await executePushTargets(pushBtn);
        } catch (e) {
            console.error(e);
            showToast(`❌ Push Error: ${e.message}`);
        }
    });
}

/**
 * Push target for a single week
 * @param {number} weekIndex - Week index
 */
async function pushSingleWeekTarget(weekIndex) {
    const week = state.generatedPlan[weekIndex];
    if (!week) return showToast("Error: Week not found");

    showConfirm("Push Target", `Push target for Week ${week.week} to Intervals.icu?`, async () => {
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
            const apiKey = state.apiKey;
            const athleteId = state.athleteId;

            if (!apiKey || !athleteId) throw new Error("Missing API Key or Athlete ID");

            let planStartInput = isCycling
                ? document.getElementById('planStartDateInputCycle')
                : document.getElementById('planStartDateInputRun');
            if (!planStartInput) planStartInput = document.getElementById('planStartDateInput');

            const planStartDate = planStartInput && planStartInput.value ? new Date(planStartInput.value) : new Date();

            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + ((week.week - 1) * 7));

            const day = weekStart.getDay();
            const diff = weekStart.getDate() - day + (day == 0 ? -6 : 1);
            const monday = new Date(weekStart);
            monday.setDate(diff);

            const dateStr = formatLocalDate(monday);
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
    });
}

/**
 * Delete all future targets
 */
async function deleteFutureTargets() {
    showConfirm("Delete Targets", "Delete ALL future targets from today onwards? This cannot be undone.", async () => {
        const delBtn = document.getElementById('delete-targets-btn');
        if (delBtn) { delBtn.disabled = true; delBtn.textContent = "Deleting..."; }
        showToast("Deleting future targets...");

        try {
            const today = new Date().toISOString().split('T')[0];
            const nextYear = new Date();
            nextYear.setFullYear(nextYear.getFullYear() + 1);
            const nextYearStr = nextYear.toISOString().split('T')[0];

            const auth = btoa(`API_KEY:${state.apiKey}`);

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
    });
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.pushWeeklyTargetsToIntervals = pushWeeklyTargetsToIntervals;
window.deleteFutureTargets = deleteFutureTargets;
window.pushSingleWeekTarget = pushSingleWeekTarget;
window.createTargetPromise = createTargetPromise;
window.sendTargetPayload = sendTargetPayload;

window.TargetsService = {
    pushWeeklyTargetsToIntervals,
    deleteFutureTargets,
    pushSingleWeekTarget,
    executePushTargets,
    createTargetPromise,
    sendTargetPayload,
    parseLocalDate,
    formatLocalDate
};
