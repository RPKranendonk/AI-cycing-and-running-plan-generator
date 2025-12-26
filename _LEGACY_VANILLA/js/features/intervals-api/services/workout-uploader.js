/**
 * @file workout-uploader.js
 * @description Service for pushing and deleting workouts from the Intervals.icu Calendar API.
 * @usedBy js/features/weekly-plan/services/week-actions.js
 * @responsibilities
 * - Constructs the JSON payload for "Create Event" API calls
 * - Handles bulk uploads (Push Week / Push Block)
 * - Manages deletion of remote workouts (to prevent duplicates)
 * @why Centralizes all "Write" operations to the external API.
 */

// ==========================================
// WORKOUT UPLOADER
// Push and delete workouts to/from Intervals.icu
// ==========================================

/**
 * Maps sport settings IDs to workout types
 * @param {string} apiType - Workout type 
 * @returns {number|null} Sport settings ID or null
 */
function getSportSettingsId(apiType) {
    const mapping = {
        'WeightTraining': state.sportSettingsIdStrength,
        'Run': state.sportSettingsIdRun,
        'Ride': state.sportSettingsIdRide,
        'Yoga': state.sportSettingsIdYoga,
        'Swim': state.sportSettingsIdSwim,
        'Rowing': state.sportSettingsIdRowing,
        'RockClimbing': state.sportSettingsIdRockClimbing
    };
    return mapping[apiType] || null;
}

/**
 * Normalizes workout type for Intervals.icu API
 * @param {string} type - Original workout type
 * @returns {string} Normalized API type
 */
function normalizeWorkoutType(type) {
    if (!type || type === 'Rest') return null;
    if (type === 'Gym' || type === 'Strength') return 'WeightTraining';
    return type;
}

/**
 * Builds an event object for Intervals.icu
 * @param {Object} workout - Workout object
 * @param {Object} week - Week object with week number
 * @param {string} dayName - Full day name
 * @returns {Object|null} Event object or null if should skip
 */
function buildEventObject(workout, week, dayName) {
    const apiType = normalizeWorkoutType(workout.type);
    if (!apiType) return null;

    const dateStr = workout.start_date_local.split('T')[0];
    const timeOfDay = workout.slot === 'evening' ? 'T18:00:00' : 'T06:00:00';

    // Build description
    let desc = "";
    if (workout.steps && Array.isArray(workout.steps) && workout.steps.length > 0) {
        desc = window.formatStepsForIntervals(workout.steps);
    } else {
        desc = workout.description_export || workout.description_ui || "";
    }

    const event = {
        category: "WORKOUT",
        start_date_local: `${dateStr}${timeOfDay}`,
        type: apiType,
        name: workout.title || workout.type,
        description: desc,
        external_id: `elite_coach_w${week.week}_${dayName}_${workout.slot || 'am'}`
    };

    // Attach sport settings ID if available
    const sportSettingsId = getSportSettingsId(apiType);
    if (sportSettingsId) {
        event.sport_settings_id = sportSettingsId;
    }

    return event;
}

/**
 * Push workouts for a single week to Intervals.icu
 * @param {number} weekIndex - Index of week in plan
 */
async function pushToIntervalsICU(weekIndex) {
    // PRO GATE: Sync requires Pro subscription
    if (typeof checkProFeature === 'function' && !checkProFeature('sync')) {
        return;
    }

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
            if (!workout.start_date_local) {
                console.log('[Push] Skipping workout without start_date_local:', workout);
                return;
            }

            const d = new Date(workout.start_date_local);
            const dayNum = d.getDay();

            // Check availability
            if (!availability.includes(dayNum)) {
                console.log(`[Push] Skipping workout on unavailable day ${dayNames[dayNum]}: ${workout.title || workout.type}`);
                return;
            }

            const dayName = dayNames[dayNum];

            // Build and add enhanced data if available
            let desc = "";
            const enhancedData = state.weeklyEnhancedData?.[weekIndex];
            if (enhancedData) {
                const shortDay = dayName.substring(0, 3);
                const enhancedInfo = enhancedData.workouts?.find(w =>
                    w.day === shortDay &&
                    (w.type === workout.type || (w.type === 'Strength' && workout.type === 'Gym'))
                );

                if (enhancedInfo) {
                    if (enhancedInfo.description) desc += `${enhancedInfo.description}\n\n`;
                    if (enhancedInfo.coachNote) desc += `💡 Coach Note: ${enhancedInfo.coachNote}\n\n`;
                }
            }

            const event = buildEventObject(workout, week, dayName);
            if (event) {
                // Prepend enhanced description
                event.description = desc + event.description;
                events.push(event);
            }
        });

        if (events.length === 0) {
            showToast("No workouts to push (all skipped)");
            return;
        }

        console.log(`[Push] Uploading ${events.length} events:`, events);

        // Bulk create
        const response = await fetch(`https://intervals.icu/api/v1/athlete/${state.athleteId}/events/bulk?upsert=true`, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa(`API_KEY:${state.apiKey}`),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(events)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Push] API Error Response:', errorText);
            throw new Error(`API Error: ${response.status}`);
        }

        showToast(`✅ Pushed ${events.length} workouts!`);

    } catch (e) {
        console.error('[Push] Error:', e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "📤 Push"; }
    }
}

/**
 * Delete remote workouts for a week (preserves local state)
 * @param {number} weekIndex - Index of week in plan
 */
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

/**
 * Reset remote workouts with optional confirmation
 * @param {number} weekIndex - Index of week
 * @param {boolean} skipConfirm - Skip confirmation dialog
 */
async function resetRemoteWeeklyWorkouts(weekIndex, skipConfirm = false) {
    const doDelete = async () => {
        showToast("Deleting from Intervals.icu...");
        try {
            await deleteRemoteWorkouts(weekIndex);
            showToast("✅ Remote workouts cleared. Local plan preserved.");
        } catch (e) {
            showToast(`❌ Error: ${e.message}`);
        }
    };

    if (skipConfirm) {
        await doDelete();
    } else {
        showConfirm("Clear Remote Workouts", "Delete workouts for this week from Intervals.icu? Your local plan will be kept.", doDelete);
    }
}

/**
 * Bulk push multiple weeks to Intervals.icu
 * @param {Array<number>} weekIndices - Array of week indices
 */
async function pushWeeksToIntervalsBulk(weekIndices) {
    if (!weekIndices || weekIndices.length === 0) return;

    const allEvents = [];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    weekIndices.forEach(weekIndex => {
        const week = state.generatedPlan[weekIndex];
        const workouts = state.generatedWorkouts[weekIndex];

        if (!week || !workouts) return;

        workouts.forEach(workout => {
            if (!workout.start_date_local || workout.type === 'Rest') return;

            const d = new Date(workout.start_date_local);
            const dayNum = d.getDay();
            const dayName = dayNames[dayNum];
            const dateStr = workout.start_date_local.split('T')[0];
            const slot = workout.slot || 'morning';
            const timeStr = slot === 'evening' ? '18:00:00' : '06:00:00';

            let desc = workout.description_export || workout.description_ui || "";
            if (workout.steps && Array.isArray(workout.steps)) {
                desc = window.formatStepsForIntervals(workout.steps);
            }

            let apiType = normalizeWorkoutType(workout.type);
            if (!apiType) {
                apiType = state.sportType === 'Cycling' ? 'Ride' : 'Run';
            }

            const event = {
                category: "WORKOUT",
                start_date_local: `${dateStr}T${timeStr}`,
                type: apiType,
                name: workout.title || workout.type || apiType,
                description: desc,
                external_id: `elite_coach_w${week.week}_${dayName}_${slot}`
            };

            const sportSettingsId = getSportSettingsId(apiType);
            if (sportSettingsId) {
                event.sport_settings_id = sportSettingsId;
            }

            allEvents.push(event);
        });

        // Add weekly NOTE if exists
        const weekNote = state.weeklyNotes && state.weeklyNotes[weekIndex];
        if (weekNote && weekNote.note) {
            const weekStart = new Date(week.startDate);
            const noteDate = weekStart.toISOString().split('T')[0];
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            const noteEndDate = weekEnd.toISOString().split('T')[0];

            allEvents.push({
                category: "NOTE",
                start_date_local: `${noteDate}T00:00:00`,
                end_date_local: `${noteEndDate}T23:59:59`,
                name: `Week ${week.week}: Training Focus`,
                description: weekNote.note,
                color: '#3498db',
                external_id: `elite_coach_w${week.week}_note`
            });
        }
    });

    if (allEvents.length === 0) {
        showToast("No workouts to push.");
        return;
    }

    try {
        await window.uploadEventsBulk(state.apiKey, state.athleteId, allEvents);
        showToast(`✅ Bulk pushed ${allEvents.length} workouts!`);
    } catch (e) {
        console.error("Bulk push failed:", e);
        showToast(`❌ Bulk Push Error: ${e.message}`);
        throw e;
    }
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.pushToIntervalsICU = pushToIntervalsICU;
window.resetRemoteWeeklyWorkouts = resetRemoteWeeklyWorkouts;
window.pushWeeksToIntervalsBulk = pushWeeksToIntervalsBulk;
window.deleteRemoteWorkouts = deleteRemoteWorkouts;

window.WorkoutUploader = {
    pushToIntervalsICU,
    resetRemoteWeeklyWorkouts,
    pushWeeksToIntervalsBulk,
    deleteRemoteWorkouts,
    buildEventObject,
    normalizeWorkoutType,
    getSportSettingsId
};
