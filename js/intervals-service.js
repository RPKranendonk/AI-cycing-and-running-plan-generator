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

async function pushWeeklyTargetsToIntervals() {
    if (!state.generatedPlan || state.generatedPlan.length === 0) {
        return showToast("No plan generated yet.");
    }

    if (!confirm("Push weekly targets to Intervals.icu? This will update your goals.")) return;

    const pushBtn = document.getElementById('push-targets-btn');
    if (pushBtn) { pushBtn.disabled = true; pushBtn.textContent = "Pushing..."; }
    showToast("Pushing targets...");

    try {
        const events = [];
        const isCycling = state.sportType === 'Cycling';

        // Use Plan Start Date if available, otherwise fallback to today/calculated dates
        const planStartInput = document.getElementById('planStartDateInput');
        const planStartDate = planStartInput && planStartInput.value ? new Date(planStartInput.value) : new Date();

        state.generatedPlan.forEach(week => {
            // Calculate Monday of this week
            const weekStart = new Date(planStartDate);
            weekStart.setDate(planStartDate.getDate() + ((week.weekNumber - 1) * 7));

            // Adjust to Monday if planStartDate is not Monday? 
            // Actually, let's assume the plan logic aligns weeks correctly.
            // Intervals.icu targets usually start on Monday.
            // Let's ensure we are targeting the Monday of that week.
            const day = weekStart.getDay();
            const diff = weekStart.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
            const monday = new Date(weekStart.setDate(diff));
            const dateStr = monday.toISOString().split('T')[0];

            const event = {
                category: "TARGET",
                start_date_local: dateStr,
                type: isCycling ? "Ride" : "Run",
            };

            if (isCycling) {
                // Push Load (TSS)
                event.load_target = Math.round(week.goalLoad);
            } else {
                // Push Distance (meters)
                event.distance_target = Math.round(week.goalLoad * 1000);
            }

            events.push(event);
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
        showToast(`✅ Pushed ${events.length} weekly targets!`);

    } catch (e) {
        console.error(e);
        showToast(`❌ Push Error: ${e.message}`);
    } finally {
        if (pushBtn) { pushBtn.disabled = false; pushBtn.textContent = "🎯 Push Weekly Targets"; }
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
