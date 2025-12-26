// Using global msPerDay from constants.js


/**
 * Process AI response and optionally return data
 * @param {string} content - Raw AI response content
 * @param {Array} indices - Week indices being processed
 * @param {boolean} returnObject - If true, returns the parsed object instead of just rendering
 * @returns {Array|undefined} Parsed workout results if returnObject is true
 */
function processAIResponse(content, indices, returnObject = false) {
    try {
        console.log("AI Response Content (Raw):", content);

        // Strip markdown code blocks if present
        let cleanContent = content.replace(/```csv\n?|```/g, '').trim();

        // [WEEKLY NOTES] Extract notes from AI response
        const noteRegex = /NOTE_WEEK_(\d+):\s*(.+)/g;
        let match;
        while ((match = noteRegex.exec(cleanContent)) !== null) {
            const weekNum = parseInt(match[1]);
            const noteText = match[2].trim();
            const weekIndex = weekNum - 1;

            if (!state.weeklyNotes) state.weeklyNotes = {};
            state.weeklyNotes[weekIndex] = {
                weekNum: weekNum,
                note: noteText,
                createdAt: new Date().toISOString()
            };
            console.log(`[Weekly Notes] Week ${weekNum}: ${noteText}`);
        }

        // [VERIFICATION VISIBILITY] Extract verification logs
        const verifRegex = /# VERIFICATION BLOCK - WEEK (\d+)[\s\S]*?(?=(?:# VERIFICATION BLOCK|$))/g;
        let vMatch;
        while ((vMatch = verifRegex.exec(cleanContent)) !== null) {
            const weekNum = parseInt(vMatch[1]);
            const logContent = vMatch[0].trim();
            const weekIndex = weekNum - 1;

            if (!state.verificationLogs) state.verificationLogs = {};
            state.verificationLogs[weekIndex] = {
                weekNum: weekNum,
                log: logContent,
                createdAt: new Date().toISOString()
            };
            console.log(`[Verification Log] Extracted for Week ${weekNum}`);
        }

        // [HYDRATION] Parse CSV using the global service
        if (!window.WorkoutHydrationService) {
            throw new Error("WorkoutHydrationService is not loaded.");
        }

        // Get Plan Start Date
        const planStartData = state.generatedPlan[0];
        if (!planStartData || !planStartData.startDate) throw new Error("Missing Plan Start Date");

        let planStartDate;
        if (planStartData.startDate.includes('T')) {
            planStartDate = new Date(planStartData.startDate);
        } else {
            planStartDate = new Date(planStartData.startDate + "T00:00:00");
        }
        if (isNaN(planStartDate.getTime())) throw new Error("Invalid Plan Start Date");

        // Filter data lines
        const dataLines = cleanContent.split('\n').filter(l => {
            const t = l.trim();
            return t.length > 0 && /^\d/.test(t);
        });
        const firstLine = dataLines[0];
        const firstCol = firstLine ? firstLine.split(',')[0].trim() : '';

        // DETECT FORMAT: Date (YYYY-MM-DD) vs DayIndex (number)
        const isDateFormat = firstCol.includes('-') && firstCol.length >= 10;

        let anchorDate = new Date(planStartDate);
        let adjustedDataLines = dataLines;

        if (isDateFormat) {
            console.log(`[Hydration] Detected DATE format (${firstCol}). Using dates directly.`);
        } else {
            // LEGACY FORMAT: DayIndex offset logic
            const firstIndex = parseInt(firstCol) || 0;
            const batchStartIndex = indices[0];
            const expectedCumulativeStart = batchStartIndex * 7;

            let offsetToAdd = 0;

            if (firstIndex < (expectedCumulativeStart - 2)) {
                console.log(`[Hydration] Detected RELATIVE indexing. Manually shifting by ${expectedCumulativeStart} days.`);
                offsetToAdd = expectedCumulativeStart;
            } else {
                console.log(`[Hydration] Detected CUMULATIVE indexing. No shift needed.`);
            }

            if (offsetToAdd > 0) {
                anchorDate.setDate(anchorDate.getDate() + offsetToAdd);
            }

            // Detect per-week 0-6 resetting pattern
            const indices_in_csv = dataLines.map(line => parseInt(line.split(',')[0]));
            let hasReset = false;
            for (let i = 1; i < indices_in_csv.length; i++) {
                if (indices_in_csv[i] < indices_in_csv[i - 1]) {
                    hasReset = true;
                    break;
                }
            }

            if (hasReset) {
                console.log(`[Hydration] Detected PER-WEEK indexing (0-6 resets). Converting to cumulative...`);
                let weekOffset = 0;
                let lastIndex = -1;

                adjustedDataLines = dataLines.map(line => {
                    const parts = line.split(',');
                    const originalIndex = parseInt(parts[0]);

                    if (originalIndex <= lastIndex) {
                        weekOffset += 7;
                    }
                    lastIndex = originalIndex;

                    const newIndex = originalIndex + weekOffset;
                    parts[0] = newIndex.toString();
                    return parts.join(',');
                });
            }
        }

        // Pass the adjusted CSV data to hydration
        const hydratedWeek = window.WorkoutHydrationService.hydrateWeek(adjustedDataLines.join('\n'), anchorDate);

        const results = [];

        // Merge Smart Scheduler Steps into Hydrated Workouts
        hydratedWeek.forEach(workout => {
            const wDate = new Date(workout.date);
            const planStartUTC = Date.UTC(planStartDate.getFullYear(), planStartDate.getMonth(), planStartDate.getDate());
            const wDateUTC = Date.UTC(wDate.getFullYear(), wDate.getMonth(), wDate.getDate());

            const diffDays = Math.round((wDateUTC - planStartUTC) / (1000 * 60 * 60 * 24));
            const weekIndex = Math.floor(diffDays / 7);
            const dayOfWeek = wDate.getDay();

            // Find matching slot in original template
            if (state.generatedPlan && state.generatedPlan[weekIndex] && state.generatedPlan[weekIndex].schedule) {
                const slot = state.generatedPlan[weekIndex].schedule.find(s => s.day === dayOfWeek);

                if (slot && slot.steps && Array.isArray(slot.steps) && slot.steps.length > 0) {
                    console.log(`[Hydration] Enforcing hardcoded steps for ${slot.type?.label} on day ${dayOfWeek}`);
                    workout.steps = JSON.parse(JSON.stringify(slot.steps));
                }
            }
        });

        // Group by week
        hydratedWeek.forEach((workout, i) => {
            const wDate = new Date(workout.date);
            const wDateUTC = Date.UTC(wDate.getFullYear(), wDate.getMonth(), wDate.getDate());
            const planStartUTC = Date.UTC(planStartDate.getFullYear(), planStartDate.getMonth(), planStartDate.getDate());

            const diffTime = wDateUTC - planStartUTC;
            const diffDays = Math.round(diffTime / msPerDay);
            const weekIndex = Math.floor(diffDays / 7);

            if (indices.includes(weekIndex)) {
                if (!state.generatedWorkouts[weekIndex]) state.generatedWorkouts[weekIndex] = [];

                let resultItem = results.find(r => r.weekIndex === weekIndex);
                if (!resultItem) {
                    const resultDate = new Date(planStartDate);
                    resultDate.setDate(resultDate.getDate() + (weekIndex * 7));

                    resultItem = {
                        weekIndex: weekIndex,
                        weekNumber: weekIndex + 1,
                        workouts: [],
                        startDate: resultDate.toISOString()
                    };
                    results.push(resultItem);
                }

                state.generatedWorkouts[weekIndex].push(workout);
                resultItem.workouts.push(workout);
            }
        });

        // Store in State for all processed weeks
        results.forEach(res => {
            state.generatedWorkouts[res.weekIndex] = res.workouts;

            const availability = state.weeklyAvailability[res.weekIndex] || state.defaultAvailableDays;
            if (typeof renderAIWorkouts === 'function') {
                renderAIWorkouts(res.weekIndex, res.workouts, availability);
            }
        });

        // Update mobile today view
        if (window.innerWidth < 1024 && typeof renderMobileTodayView === 'function') {
            renderMobileTodayView();
        }

        // Post-generation validation
        if (typeof validatePostGeneration === 'function') {
            const allWorkouts = results.flatMap(r => r.workouts || []);
            const weekTarget = indices.length === 1 && state.generatedPlan[indices[0]]
                ? state.generatedPlan[indices[0]].targetDistance
                : null;

            const validationResults = validatePostGeneration(allWorkouts, weekTarget);

            if (validationResults.length > 0) {
                console.log("[Validation] Post-generation issues found:", validationResults);

                if (typeof showValidationToast === 'function') {
                    showValidationToast(validationResults);
                }

                state.lastValidationResults = validationResults;

                validationResults.forEach(v => {
                    const prefix = v.severity === 'error' ? '🚫' : v.severity === 'warning' ? '⚠️' : 'ℹ️';
                    console.log(`${prefix} ${v.title}: ${v.message}`);
                    if (v.suggestion) console.log(`   → ${v.suggestion}`);
                });
            }
        }

        if (returnObject) return results;

        hideAILoading();
        showToast("✅ AI Workout Plan Generated!");

    } catch (e) {
        console.error("Parse Error:", e);
        if (!returnObject) {
            hideAILoading();
            showToast("❌ Failed to parse AI response.");
        }
        throw e;
    }
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.processAIResponse = processAIResponse;

window.AIResponseParser = {
    processAIResponse
};
