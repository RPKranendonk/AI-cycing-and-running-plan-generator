// ==========================================
// AI ORCHESTRATOR
// Orchestrates AI plan generation workflow
// ==========================================

/**
 * Prepares workout plan using AI
 * @param {string} scope - 'week' or 'block'
 * @param {Array<number>} indices - Array of week indices to generate for
 */
async function preparePlanWithAI(scope, indices) {
    try {
        indices.sort((a, b) => a - b);
        console.log(`[AI Debug] preparePlanWithAI called. Scope: ${scope}, Indices:`, indices);

        // Robust Sport Detection
        if (!state.sportType) {
            const cycContainer = document.getElementById('cycling-config-container');
            state.sportType = (cycContainer && cycContainer.style.display !== 'none') ? "Cycling" : "Running";
        }

        if (!state.aiProvider) {
            showToast("❌ No AI provider selected. Please select OpenAI or Gemini in Settings.");
            return;
        }

        if (!state.generatedPlan || !Array.isArray(state.generatedPlan)) {
            console.error("state.generatedPlan is missing or invalid:", state.generatedPlan);
            showToast("❌ No plan found. Please generate a plan first.");
            return;
        }

        // BATCH GENERATION LOGIC
        if (indices.length > 1) {
            showAILoading(`Generating Block Plan...`);

            let progressionContext = [];
            let lastWeekSummary = null;

            const batches = [];
            const chunkSize = 4;
            for (let i = 0; i < indices.length; i += chunkSize) {
                batches.push(indices.slice(i, i + chunkSize));
            }

            for (let i = 0; i < batches.length; i++) {
                const batchIndices = batches[i];
                const firstWeekIdx = batchIndices[0];
                const lastWeekIdx = batchIndices[batchIndices.length - 1];

                if (!state.generatedPlan[firstWeekIdx] || !state.generatedPlan[lastWeekIdx]) {
                    console.error(`Missing week data for indices: ${firstWeekIdx} or ${lastWeekIdx}`);
                    continue;
                }

                const startWeek = state.generatedPlan[firstWeekIdx].week;
                const endWeek = state.generatedPlan[lastWeekIdx].week;
                const rangeLabel = startWeek === endWeek ? `Week ${startWeek}` : `Weeks ${startWeek}-${endWeek}`;

                updateAILoadingText(`Generating ${rangeLabel}...`);

                try {
                    const batchResults = await _generateBatch(batchIndices, scope, progressionContext, lastWeekSummary);

                    if (batchResults && batchResults.length > 0) {
                        batchResults.forEach(res => {
                            const keySession = res.workouts.find(w =>
                                w.title.includes("Interval") ||
                                w.title.includes("Long") ||
                                (w.description_export && w.description_export.includes("Z4"))
                            );

                            if (keySession) {
                                progressionContext.push({
                                    week: res.weekNumber,
                                    key_session: keySession.title,
                                    structure: keySession.description_export
                                        ? keySession.description_export.split('\n').filter(l => l.trim().startsWith('-')).join(', ').substring(0, 150)
                                        : "No details"
                                });
                            }
                        });

                        const lastWeekOfBatch = batchResults[batchResults.length - 1];
                        if (lastWeekOfBatch && lastWeekOfBatch.workouts && lastWeekOfBatch.workouts.length > 0) {
                            const lastWorkout = lastWeekOfBatch.workouts[lastWeekOfBatch.workouts.length - 1];
                            lastWeekSummary = {
                                date: lastWorkout.start_date_local,
                                type: lastWorkout.type,
                                title: lastWorkout.title,
                                isLongRun: lastWorkout.title.toLowerCase().includes('long') || lastWorkout.duration > 5400
                            };
                        }
                    }

                } catch (e) {
                    console.error(`Error generating batch ${rangeLabel}:`, e);
                    showToast(`❌ Failed to generate ${rangeLabel}`);
                    break;
                }
            }

            hideAILoading();
            showToast("✅ Block Plan Generated!");

            if (window.renderWeeklyPlan) {
                window.renderWeeklyPlan();
            }

            return;
        }

        // Single week case
        showAILoading(`Generating Week Plan...`);
        try {
            await _generateBatch(indices, scope, [], null);
            hideAILoading();
            showToast("✅ AI Workout Plan Generated!");

            if (scope === 'week') {
                const openWeekIndices = [];
                indices.forEach(idx => {
                    const detail = document.getElementById(`week-detail-${idx}`);
                    if (detail && !detail.classList.contains('hidden')) openWeekIndices.push(idx);
                });

                if (window.renderWeeklyPlan) window.renderWeeklyPlan();

                setTimeout(() => {
                    openWeekIndices.forEach(idx => {
                        const weekCard = document.querySelector(`[data-week-index="${idx}"]`);
                        if (weekCard && window.toggleWeekDetail) {
                            window.toggleWeekDetail(idx, weekCard);
                        }
                    });
                }, 100);
            }

        } catch (e) {
            hideAILoading();
            showToast(`❌ Error: ${e.message}`);
        }
    } catch (err) {
        console.error("Critical Error in preparePlanWithAI:", err);
        hideAILoading();
        showToast(`❌ System Error: ${err.message}`);
    }
}

/**
 * Regenerate a specific block with user feedback
 * @param {number} blockIndex - Index of the block to regenerate
 * @param {string} feedback - User feedback string
 */
async function regenerateBlockWithFeedback(blockIndex, feedback) {
    try {
        console.log(`[AI Service] Regenerating Block ${blockIndex} with feedback: "${feedback}"`);

        const phases = [...new Set(state.generatedPlan.map(w => w.phaseName))];
        const targetPhase = phases[blockIndex];

        if (!targetPhase) {
            throw new Error(`Block ${blockIndex} not found.`);
        }

        const indices = state.generatedPlan
            .map((w, i) => w.phaseName === targetPhase ? i : -1)
            .filter(i => i !== -1);

        if (indices.length === 0) {
            throw new Error(`No weeks found for block index ${blockIndex}`);
        }

        if (!state.regenerationFeedback) state.regenerationFeedback = {};
        state.regenerationFeedback[blockIndex] = feedback;

        await preparePlanWithAI('block', indices);

        delete state.regenerationFeedback[blockIndex];

    } catch (e) {
        console.error("Regeneration Error:", e);
        showToast(`❌ Regeneration Failed: ${e.message}`);
    }
}

/**
 * Internal helper to generate a batch of weeks
 */
async function _generateBatch(indices, scope, historyContext = [], lastWeekSummary = null) {
    // Pre-generation validation
    if (typeof validatePreGeneration === 'function') {
        const availability = state.weeklyAvailability[indices[0]] || state.defaultAvailableDays || [];

        let totalAvailableHours = 0;
        if (state.dailyAvailability) {
            Object.values(state.dailyAvailability).forEach(d => {
                if (d && d.hours) totalAvailableHours += d.hours;
            });
        }

        const longRunDayData = state.dailyAvailability && state.dailyAvailability[state.longRunDay];
        const longRunDayHours = longRunDayData ? longRunDayData.hours : 3;

        const restDays = [];
        if (state.dailyAvailability) {
            Object.entries(state.dailyAvailability).forEach(([day, data]) => {
                if (data && data.hours === 0) restDays.push(parseInt(day));
            });
        }

        const preConfig = {
            sport: state.sportType || 'Running',
            targetVolume: state.generatedPlan[indices[0]]?.targetDistance || state.generatedPlan[indices[0]]?.rawKm || 40,
            totalAvailableHours: totalAvailableHours,
            longRunDistance: state.generatedPlan[indices[0]]?.longRun || 15,
            longRunDayHours: longRunDayHours,
            longRunDay: state.longRunDay,
            restDays: restDays,
            availableDays: availability,
            basePace: state.ltRunningPace
        };

        const preValidation = validatePreGeneration(preConfig);

        if (preValidation.length > 0) {
            const errors = preValidation.filter(v => v.severity === 'error');
            if (errors.length > 0) {
                errors.forEach(e => {
                    console.error(`🚫 ${e.title}: ${e.message}`);
                });
                showToast(`🚫 Cannot generate: ${errors[0].message}`);
                throw new Error(`Pre-validation failed: ${errors[0].message}`);
            }

            const warnings = preValidation.filter(v => v.severity === 'warning');
            warnings.forEach(w => {
                console.warn(`⚠️ ${w.title}: ${w.message}`);
            });
        }
    }

    // Build Context
    const weeksContext = window.buildWeeksContext ? window.buildWeeksContext(indices) : buildWeeksContextFallback(indices);

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const longRunDayName = dayNames[state.longRunDay] || 'Sunday';

    const last4WeeksSummary = window.getLast4WeeksSummary ? window.getLast4WeeksSummary() : "";
    const zones = window.getZonePaceStrings ? window.getZonePaceStrings() : "";

    let goalAssessment = null;
    if (typeof assessMarathonGoal === 'function' && state.goalTime && state.raceDate) {
        goalAssessment = assessMarathonGoal(state.goalTime, state.raceDate);
    }

    const planOverview = window.buildPlanOverview ? window.buildPlanOverview() : "";

    // Build Prompt
    const prompt = window.buildAIWorkoutPrompt({
        scope: scope,
        weeks: weeksContext,
        totalWeeks: state.generatedPlan.length,
        goalAssessment: goalAssessment,
        last4Weeks: last4WeeksSummary,
        zones: zones,
        athleteHistory: state.trainingHistory || "Not provided",
        injuries: state.injuries || "None",
        preferences: state.trainingPreferences || "None",
        sportType: state.sportType || "Running",
        age: state.athleteAge,
        gender: state.gender,
        goalTime: state.goalTime,
        raceDate: state.raceDate,
        rampRate: state.rampRate || 5,
        progressionHistory: historyContext,
        ftp: state.ftp,
        ltRunningPace: state.lthrPace,
        lthrBpm: state.lthrBpm,
        longRunDayName: longRunDayName,
        lastWeekSummary: lastWeekSummary,
        planOverview: planOverview,
        dailyAvailability: state.dailyAvailability || {}
    });

    // Debug prompt display
    if (typeof window.updateDebugPrompt === 'function') {
        window.updateDebugPrompt(prompt);
    }

    // Call AI Provider
    const batchResults = await window.callAIProvider(prompt, indices);

    // ------------------------------------------------------------------------
    // ENDURANCE VALIDATOR & AUTO-CORRECTION
    // ------------------------------------------------------------------------
    if (window.EnduranceValidator && batchResults && Array.isArray(batchResults)) {
        console.log(`[EnduranceValidator] Validating ${batchResults.length} weeks...`);

        batchResults.forEach(weekData => {
            try {
                const sport = state.sportType || 'Running';
                // Estimate volume from workouts if not explicit, or use target
                // We depend on weekData having workouts
                // Calculate volume from the workouts themselves to be accurate to "Draft"
                let volHours = 0;
                if (weekData.workouts) {
                    weekData.workouts.forEach(w => {
                        // parse duration
                        const dur = typeof w.duration === 'number' ? w.duration : parseFloat(w.duration) || 0;
                        // duration is typically minutes in app state? check.
                        // AI usually returns minutes.
                        volHours += (dur / 60);
                    });
                }

                const validation = window.EnduranceValidator.validateWeek(weekData.workouts, volHours, sport);

                if (!validation.passed) {
                    console.warn(`[EnduranceValidator] Week ${weekData.weekNumber} Failed:`, validation.corrections);

                    // APPLY CORRECTIONS
                    validation.corrections.forEach(correction => {
                        if (correction.type === 'INTENSITY_UPGRADE') {
                            // upgrading a General Aerobic (Z2) to Tempo (Z3/Z4)
                            // Find a Z2 workout
                            const z2Workout = weekData.workouts.find(w =>
                                (w.title.includes('Easy') || w.title.includes('General Aerobic') || w.description_export?.includes('Z2')) &&
                                !w.title.includes('Long') && // Don't touch long run
                                !w.title.includes('Recovery') // Don't touch recovery
                            );

                            if (z2Workout) {
                                console.log(`[Auto-Correct] Upgrading workout "${z2Workout.title}" to Tempo/Sweet Spot.`);

                                // Swap with a structured Tempo workout from Library if possible
                                // Or manually patch steps
                                if (window.RUNNING_LIBRARY && window.buildWorkout) {
                                    // Pick a Tempo workout that fits the duration
                                    const durationMin = z2Workout.duration || 45;
                                    const template = window.selectWorkout && window.selectWorkout('TEMPO', 'Base', durationMin)
                                        ? window.selectWorkout('TEMPO', 'Base', durationMin)
                                        : (window.RUNNING_LIBRARY.TEMPO ? window.RUNNING_LIBRARY.TEMPO[0] : null);

                                    if (template) {
                                        const p = state.lthrPace || 300;
                                        const built = window.buildWorkout(template, p, durationMin);

                                        // Update the workout object in place
                                        z2Workout.title = built.name; // OR Keep original title? No, title should reflect content.
                                        z2Workout.description_export = built.description;
                                        z2Workout.steps = built.steps;
                                        z2Workout.structure = template.structure; // Keep structure ref
                                        z2Workout.type = 'Tempo';

                                        showToast(`⚡️ AI Auto-Correct: Upgraded "${z2Workout.title}" to Tempo to meet physiological targets.`);
                                    }
                                }
                            }
                        }

                        // Handle INTENSITY_BOOST (Increase intervals)
                        if (correction.type === 'INTENSITY_BOOST') {
                            // Find key interval session
                            const intervalWorkout = weekData.workouts.find(w => w.title.includes('Interval') || w.type === 'Intervals');
                            if (intervalWorkout && intervalWorkout.steps) {
                                console.log(`[Auto-Correct] Boosting intensity for "${intervalWorkout.title}"`);
                                // Look for the "repetition" step or main set
                                // This is hard to patch generically without deep structure access.
                                // Minimal intervention: Add a note or try to scale?
                                // If we have 'structure' object attached (from library based generation), we can rebuild.
                                if (window.buildWorkout && intervalWorkout.structure) {
                                    // Rebuild with 1.2x scale?
                                    // But usually structure isn't preserved in AI output unless we put it there.
                                    // Assuming AI output might just be steps.

                                    // Simple fallback: Append 5 mins Z4?
                                    // Or just Log it for now as "Suggestion"
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("[EnduranceValidator] Error running validation:", e);
            }
        });
    }

    // ------------------------------------------------------------------------
    // PERSIST CORRECTIONS
    // ------------------------------------------------------------------------
    // Check if we need to write back to state
    if (batchResults && Array.isArray(batchResults)) {
        batchResults.forEach(weekData => {
            // Find component in state to update
            const stateIndex = indices.find(i => state.generatedPlan[i].week === weekData.weekNumber);
            if (stateIndex !== undefined && state.generatedPlan[stateIndex]) {
                state.generatedPlan[stateIndex].workouts = weekData.workouts;
                console.log(`[AI Orchestrator] Updated state for Week ${weekData.weekNumber} with validated workouts.`);
            }
        });
    }

    return batchResults;
}

// Fallback for buildWeeksContext if not loaded
function buildWeeksContextFallback(indices) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return indices.map((index) => {
        const week = state.generatedPlan[index];
        if (!week) throw new Error(`Week data not found for index ${index}`);
        const availability = state.weeklyAvailability[index] || state.defaultAvailableDays;
        return {
            weekNumber: week.week,
            phase: week.phaseName || "Base",
            targetDistance: week.targetDistance || week.rawKm,
            availableDays: availability.map(d => dayNames[d]).join(', ')
        };
    });
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.preparePlanWithAI = preparePlanWithAI;
window.regenerateBlockWithFeedback = regenerateBlockWithFeedback;
window._generateBatch = _generateBatch;

window.AIOrchestrator = {
    preparePlanWithAI,
    regenerateBlockWithFeedback,
    _generateBatch
};
