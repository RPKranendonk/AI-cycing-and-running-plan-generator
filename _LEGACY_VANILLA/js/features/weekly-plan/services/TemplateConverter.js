/**
 * @file TemplateConverter.js
 * @description Adapter that converts Scheduler "Templates" into UI/API "Workouts".
 * @usedBy js/weekly-ui.js, js/smart-planner.js
 * @responsibilities
 * - Takes a raw schedule template (from deterministic-scheduler.js)
 * - Hydrates it with dates, descriptions, and steps (using workout-builder.js)
 * - Formats it into the standard object structure expected by the UI and Intervals.icu
 * @why Acts as the "Bridge" between the abstract scheduling logic and the concrete application state.
 */

/**
 * Template Converter Service
 * Converts deterministic scheduler templates into Intervals.icu-compatible workouts
 * Extracts logic from weekly-ui.js
 */

window.TemplateConverter = {
    /**
     * Convert a deterministic template to Intervals.icu-compatible workouts
     */
    convert: function (weekIndex, template, weekData, appState) {
        if (!template || template.length !== 7) {
            console.warn(`[TemplateConverter] Invalid template for week ${weekIndex}`);
            return [];
        }

        const isCycling = appState.sportType === 'Cycling';

        // Calculate weekInPhase for progression
        let weekInPhase = 1;
        if (appState.generatedPlan && weekIndex > 0) {
            const currentPhase = weekData?.phaseName || 'Base';
            for (let i = weekIndex - 1; i >= 0; i--) {
                if (appState.generatedPlan[i]?.phaseName === currentPhase) {
                    weekInPhase++;
                } else {
                    break;
                }
            }
        }

        // Calculate week start date
        let weekStart = new Date();
        if (weekData?.startDate) {
            const parts = weekData.startDate.split('-');
            weekStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }

        const workouts = [];

        // Template is indexed by JS day number (0=Sun, 1=Mon, ..., 6=Sat)
        for (let dayNum = 0; dayNum < 7; dayNum++) {
            const slot = template[dayNum];
            if (!slot || !slot.type) continue;

            const typeId = typeof slot.type === 'object' ? slot.type?.id : slot.type;
            if (!typeId || typeId === 'Rest' || typeId === 'Blocked' || typeId === 'Recovery') continue;

            // Calculate workout date
            // Calculate workout date with robust offset logic
            // Goal: Map dayNum (0=Sun..6=Sat) to the visual week (Mon..Sun)
            // If weekStart is Sun 21st, and we want Mon=22, Sun=28.

            // 1. Calculate offset from weekStart based on day difference (normalized to 0-6)
            let displayOffset = (dayNum - weekStart.getDay() + 7) % 7;

            // 2. Handle Sunday Wrap-around
            // If the week visually ends on Sunday, but our calculation puts Sunday at start (offset 0),
            // and we are NOT actually starting the visual week on Sunday...
            // We force Sunday to be +7 days (End of Week).
            // Condition: weekStart is Sunday (Day 0) AND current slot is Sunday (Day 0)
            if (weekStart.getDay() === 0 && dayNum === 0) {
                displayOffset = 7;
            }

            const workoutDate = new Date(weekStart);
            workoutDate.setDate(weekStart.getDate() + displayOffset);

            // Fix: Use local date string to avoid timezone shifts (e.g. UTC-1 day)
            const year = workoutDate.getFullYear();
            const month = String(workoutDate.getMonth() + 1).padStart(2, '0');
            const day = String(workoutDate.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;

            // Retrieve threshold pace
            let thresholdPace = (window.getLTPace ? window.getLTPace() : null) ||
                (appState.zones?.ltPaceSecPerKm) ||
                (appState.thresholdPaceSecPerKm) || 300;

            if (appState.lthrPace && typeof appState.lthrPace === 'string' && appState.lthrPace.includes(':') && thresholdPace === 300) {
                // Fallback to parsing string if numeric value not found
                const parts = appState.lthrPace.split(':');
                thresholdPace = parseInt(parts[0]) * 60 + parseInt(parts[1]);
            } else if (!isNaN(appState.lthrPace)) {
                thresholdPace = parseInt(appState.lthrPace);
                if (thresholdPace < 120) thresholdPace *= 60;
            }

            // Map typeId to Intervals.icu workout type
            const typeMap = {
                'LongRun': 'Run', 'long_run': 'Run', 'long_run_progressive': 'Run',
                'Easy': 'Run', 'easy_run': 'Run', 'recovery_run': 'Run',
                'Intervals': 'Run', 'vo2_max_4x1k': 'Run', 'vo2_max_5x800': 'Run', 'track_400s': 'Run', 'hill_sprints': 'Run', 'strides_8x20s': 'Run', 'fartlek_10x1': 'Run',
                'Tempo': 'Run', 'tempo_20m': 'Run', 'tempo_30m': 'Run', 'cruise_intervals': 'Run', 'progressive_run': 'Run',
                'WeightTraining': 'WeightTraining', 'gym_strength': 'WeightTraining', 'gym_power': 'WeightTraining',
                'Yoga': 'Yoga',
                'ActiveRecovery': 'Run'
            };
            const apiType = isCycling && typeId !== 'WeightTraining' && typeId !== 'Yoga'
                ? 'Ride' : (typeMap[typeId] || 'Run');

            // Calculate duration
            // Fix: Check slot.workout for data first (Scheduler structure)
            const wData = slot.workout || {};

            // Priority:
            // 1. duration (seconds) directly on slot or workout
            // 2. totalDuration (minutes) on workout or slot
            let duration = wData.duration || slot.duration ||
                ((wData.totalDuration || slot.totalDuration) ? (wData.totalDuration || slot.totalDuration) * 60 : 0);

            if (duration > 0 && duration < 600) {
                // Determine if it was minutes and convert
                duration = duration * 60;
            }

            const distance = wData.totalDistance || wData.distance || slot.distance;

            if (!duration && distance) {
                // Use WorkoutBuilder or local fallback logic if needed
                if (window.WorkoutBuilder?.calculateAccurateDuration) {
                    duration = window.WorkoutBuilder.calculateAccurateDuration(typeId, distance, thresholdPace, isCycling);
                } else {
                    duration = isCycling ? Math.round(distance * 3 * 60) : Math.round(distance * thresholdPace * 1.2);
                }
            }
            if (!duration) duration = 3600;

            // Build title using UIConstants if available, or fallback
            // Extract note from workout or slot
            const note = wData.note || slot.note || (wData.description ? wData.description.substring(0, 50) : null);
            // Fix: Use workout name if available (e.g. from library) before falling back to generic type
            const title = wData.name || note || (window.UIConstants?.getWorkoutTitle ? window.UIConstants.getWorkoutTitle(typeId, null, isCycling) : typeId);

            // Build structured workout steps
            // Using logic from weekly-ui: "PREFER scheduler-generated steps"
            const buildStepsFn = window.buildWorkoutSteps || (window.WorkoutBuilder && window.WorkoutBuilder.buildWorkoutSteps);
            const rawSteps = wData.steps || slot.steps;
            const steps = (rawSteps && rawSteps.length > 0)
                ? rawSteps
                : (buildStepsFn ? buildStepsFn(typeId, distance, duration, weekData?.phaseName, isCycling, weekInPhase) : []);

            // Build description
            const buildDescFn = window.WorkoutBuilder?.buildWorkoutDescription;
            const description = buildDescFn
                ? buildDescFn(typeId, slot.distance, duration, weekData?.phaseName, isCycling)
                : `${title} - ${Math.round(duration / 60)}m`;

            // Use preferred slot
            const preferredSlot = slot.preferredSlot || 'morning';
            const startTime = preferredSlot === 'evening' ? 'T18:00:00' : 'T06:00:00';

            workouts.push({
                date: dateStr,
                start_date_local: `${dateStr}${startTime}`,
                dayIndex: dayNum,
                slot: preferredSlot,
                type: apiType,
                title: title,
                description: description,
                description_export: description,
                steps: steps,
                duration: duration,
                distance: slot.distance ? Math.round(slot.distance * 1000) : 0,
                isFromTemplate: true
            });

            // Secondary workout (Strength)
            if (slot.secondary) {
                const secTypeId = typeof slot.secondary === 'object' ? slot.secondary?.id : slot.secondary;
                if (['WeightTraining', 'gym_strength', 'gym_power', 'gym_neural', 'gym_stability'].includes(secTypeId)) {
                    // Fix: Prefer description from slot/workout if available, else generic builder
                    const secObj = typeof slot.secondary === 'object' ? slot.secondary : {};
                    const customDesc = secObj.description || (secObj.workout ? secObj.workout.description : null);
                    // Fix: Prefer name from secondary object if available
                    const customTitle = secObj.name || (secObj.workout ? secObj.workout.name : 'Strength Training');

                    const secDescription = customDesc || (window.WorkoutBuilder?.buildStrengthDescription ? window.WorkoutBuilder.buildStrengthDescription() : 'Strength Training');

                    workouts.push({
                        date: dateStr,
                        start_date_local: `${dateStr}T17:00:00`,
                        dayIndex: dayNum,
                        slot: 'evening',
                        type: 'WeightTraining',
                        title: customTitle,
                        description: secDescription,
                        description_export: secDescription,
                        duration: slot.secondaryDuration || 2700,
                        distance: 0,
                        isFromTemplate: true
                    });
                }
            }
        }

        // RACE DAY LOGIC
        if (weekData?.isRaceWeek && weekData?.raceDetails) {
            const raceDetails = weekData.raceDetails;
            const raceDate = raceDetails.raceDate;
            if (raceDate) {
                const raceDayDate = new Date(raceDate + 'T08:00:00');
                const raceDayNum = raceDayDate.getDay();

                const raceDescription = `🏁 RACE DAY: ${raceDetails.raceType}\n\nDistance: ${raceDetails.distance} km\nGoal Time: ${raceDetails.goalTime || ''}`;

                workouts.push({
                    date: raceDate,
                    start_date_local: `${raceDate}T08:00:00`,
                    dayIndex: raceDayNum,
                    slot: 'morning',
                    type: isCycling ? 'Ride' : 'Run',
                    title: `🏁 ${raceDetails.raceType}`,
                    description: raceDescription,
                    description_export: raceDescription,
                    duration: 0,
                    distance: Math.round(raceDetails.distance * 1000),
                    isRace: true,
                    isFromTemplate: false
                });
            }
        }

        return workouts;
    }
};
