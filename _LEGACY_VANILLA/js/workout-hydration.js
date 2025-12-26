// "use strict"; (Removed CJS strict)
// Object.defineProperty(exports, "__esModule", { value: true }); (Removed)
// exports.WorkoutHydrationService = void 0; (Removed)
class WorkoutHydrationService {
    /**
     * Main entry point to hydrate a full week of CSV data
     * Supports both Date (YYYY-MM-DD) and legacy DayIndex formats
     */
    static hydrateWeek(csvData, blockStartDate) {
        const lines = csvData.trim().split('\n');
        const weekPlan = [];
        lines.forEach(line => {
            if (!line.trim())
                return;
            const parts = line.split(',');
            // CSV Columns: Date/DayIndex, Type, Distance, Duration, Title, Slot, StepsString
            // Slot = "morning" | "evening" | empty (defaults to "morning")
            const firstCol = parts[0] ? parts[0].trim() : '';

            // Detect format: Date (YYYY-MM-DD) or DayIndex (number)
            let workoutDate;
            let dayIndex;

            if (firstCol.includes('-') && firstCol.length >= 10) {
                // Date format: YYYY-MM-DD
                const parsedDate = new Date(firstCol + "T12:00:00");
                if (isNaN(parsedDate.getTime())) {
                    console.warn(`[Hydration] Invalid date format: ${firstCol}`);
                    return;
                }
                workoutDate = parsedDate;
                // Calculate dayIndex from blockStartDate for compatibility
                const diffTime = parsedDate.getTime() - blockStartDate.getTime();
                dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24));
            } else {
                // Legacy DayIndex format
                dayIndex = parseInt(firstCol);
                if (isNaN(dayIndex)) {
                    // Skip lines with invalid day index (headers, empty lines, bad data)
                    return;
                }
                // Check validity of blockStartDate
                if (isNaN(blockStartDate.getTime())) {
                    console.error("Invalid Block Start Date passed to hydrator");
                    return;
                }
                workoutDate = new Date(blockStartDate);
                workoutDate.setDate(blockStartDate.getDate() + dayIndex);
            }

            const type = parts[1] ? parts[1].trim() : '';
            if (!type || type.toLowerCase() === 'dayindex' || type.toLowerCase() === 'date')
                return; // Skip header

            // FIX: Use parseFloat to preserve decimals, then round
            const distance = parts[2] ? Math.round(parseFloat(parts[2])) : 0;
            const duration = parts[3] ? Math.round(parseFloat(parts[3])) : 0;
            const title = parts[4] ? parts[4].trim() : '';

            // Runtime validation: warn if duration seems too short (< 20min = 1200s)
            if (duration > 0 && duration < 1200 && type !== 'Rest') {
                console.warn(`[Hydration] Short duration detected: ${duration}s for "${title}". Expected >= 1200s (20min).`);
            }

            // Parse Slot (column 5) - defaults to "morning" if not specified
            let slot = parts[5] ? parts[5].trim().toLowerCase() : 'morning';
            let stepsString = '';

            if (slot !== 'morning' && slot !== 'evening') {
                // If slot column contains steps data (old format), treat as morning + parse as steps
                if (slot.includes('~') || slot.includes('|')) {
                    slot = 'morning';
                    stepsString = parts.length > 5 ? parts.slice(5).join(',') : '';
                } else {
                    slot = 'morning';
                    stepsString = parts.length > 6 ? parts.slice(6).join(',') : '';
                }
            } else {
                stepsString = parts.length > 6 ? parts.slice(6).join(',') : '';
            }

            // Set time based on slot: morning=06:00, evening=18:00
            if (slot === 'evening') {
                workoutDate.setHours(18, 0, 0, 0);
            } else {
                workoutDate.setHours(6, 0, 0, 0);
            }

            let workout;
            if (type === 'Rest') {
                workout = {
                    date: workoutDate.toISOString(),
                    start_date_local: workoutDate.toISOString(),
                    dayIndex,
                    slot,
                    type: 'Rest',
                    title: title || 'Rest Day',
                    description: 'Passive Recovery',
                    totalDuration: 0,
                    totalDistance: 0,
                    steps: []
                };
            }
            else {
                // [MODIFIED] Check for Hardcoded Structure Overlap
                const hardcodedMatch = this.matchHardcodedStructure(title, type);

                let parsedSteps = [];
                let description = "";

                if (hardcodedMatch) {
                    // Override with deterministic structure
                    console.log(`[Hydration] Applying hardcoded structure for "${title}"`);
                    parsedSteps = hardcodedMatch.steps;
                    // Regenerate description based on the hardcoded steps to ensure UI match
                    description = this.generateDescription(parsedSteps);
                    // Update metadata if needed (e.g. enforce correct duration)
                    if (hardcodedMatch.minDuration > duration) {
                        // Optionally bump duration
                    }
                } else {
                    // Standard AI parsing
                    parsedSteps = this.parseSteps(stepsString);
                    description = this.generateDescription(parsedSteps);
                }

                workout = {
                    date: workoutDate.toISOString(),
                    start_date_local: workoutDate.toISOString(),
                    dayIndex,
                    slot,
                    type,
                    title,
                    description,
                    totalDuration: duration,
                    totalDistance: distance,
                    steps: parsedSteps
                };
            }
            weekPlan.push(workout);
        });

        // =========================================
        // POST-PROCESSING: Enforce Training Rules
        // =========================================
        const validatedPlan = this.validateAndEnforceDurations(weekPlan);

        return validatedPlan;
    }

    /**
     * Validates and enforces minimum durations based on training rules
     * @param {Array} workouts - Array of workout objects
     * @returns {Array} Validated workouts with enforced minimums
     */
    static validateAndEnforceDurations(workouts) {
        // Get sport type from global state if available
        const sport = (typeof state !== 'undefined' && state.sportType) || 'Running';

        // Check if training rules are available
        if (typeof getMinDuration !== 'function') {
            console.warn("[Hydration] Training rules not loaded, skipping validation");
            return workouts;
        }

        return workouts.map(workout => {
            // Skip Rest days
            if (workout.type === 'Rest') return workout;

            // Determine workout category
            let workoutCategory = workout.type.toLowerCase();
            if (workout.title && workout.title.toLowerCase().includes('long')) {
                workoutCategory = 'longrun';
            }
            if (workout.title && (workout.title.toLowerCase().includes('shakeout') ||
                workout.title.toLowerCase().includes('recovery'))) {
                workoutCategory = 'recovery';
            }

            // Get minimum duration for this workout type
            const minDuration = getMinDuration(sport, workoutCategory);

            // Enforce minimum duration
            if (workout.totalDuration > 0 && workout.totalDuration < minDuration) {
                const originalMinutes = Math.round(workout.totalDuration / 60);
                const enforcedMinutes = Math.round(minDuration / 60);

                console.log(`[Validation] Enforcing min duration: ${workout.title} ${originalMinutes}m → ${enforcedMinutes}m`);

                // Update duration
                workout.totalDuration = minDuration;

                // Update description to note the adjustment
                if (workout.description) {
                    workout.description += `\n[Auto-adjusted from ${originalMinutes}m to ${enforcedMinutes}m minimum]`;
                }
            }

            return workout;
        });
    }
    /**
     * Parses the Micro-Syntax string into a structured array of steps
     * Syntax:
     * | = block separator
     * x = repeater multiplier (e.g. 6x(...))
     * () = steps within a repeater
     * + = step separator inside repeater
     * ~ = attribute separator (Code~Duration~Intensity)
     */
    static parseSteps(stepsString) {
        if (!stepsString)
            return [];
        const steps = [];
        // Split by top-level pipe '|' but NOT inside parentheses. 
        // Simple split('|') works because parentheses don't contain pipes in this spec.
        const blocks = stepsString.split('|');
        for (const block of blocks) {
            const trimmedBlock = block.trim();
            if (!trimmedBlock)
                continue;
            // Check for Repeater: digits + 'x' + '(' + content + ')'
            const repeaterMatch = trimmedBlock.match(/^(\d+)x\((.*)\)$/);
            if (repeaterMatch) {
                const reps = parseInt(repeaterMatch[1]);
                const innerContent = repeaterMatch[2];
                // Inner steps separated by '+' (spec) or '|' (AI sometimes uses this by mistake)
                // Split by '+' first, if only 1 part try '|'
                let innerStepsRaw = innerContent.split('+');
                if (innerStepsRaw.length === 1 && innerContent.includes('|')) {
                    innerStepsRaw = innerContent.split('|');
                }
                const innerSteps = innerStepsRaw.map(s => this.parseSingleStep(s));
                steps.push({
                    reps: reps,
                    steps: innerSteps
                });
            }
            else {
                // Standard Step
                steps.push(this.parseSingleStep(trimmedBlock));
            }
        }
        return steps;
    }
    static parseSingleStep(stepStr) {
        // Format: Code~Duration~Intensity
        const parts = stepStr.split('~');
        // Basic error handling/fallback
        const code = parts[0] || 'r';
        const duration = parts[1] ? parseInt(parts[1]) : 0;
        const intensity = parts[2] || '';
        // Map code to full type
        let type = this.TYPE_MAP[code] || 'Run';
        // Fallback for codes not in map, though map covers spec.
        // 'w' -> Warmup, 'c' -> Cooldown, 'r' -> Run, 'rec' -> Recover
        return {
            type,
            duration,
            intensity
        };
    }
    /**
     * Generates a human-readable description from the parsed steps
     * Groups consecutive warmup/cooldown steps under headers
     */
    static generateDescription(steps) {
        const sections = [];
        let currentPhase = null;
        let currentLines = [];

        const flushPhase = () => {
            if (currentLines.length > 0) {
                if (currentPhase) {
                    sections.push(`${currentPhase}\n${currentLines.join('\n')}`);
                } else {
                    sections.push(currentLines.join('\n'));
                }
                currentLines = [];
            }
            currentPhase = null;
        };

        steps.forEach(step => {
            if (step.reps && step.steps) {
                // Repeater - flush current phase and add as new section
                flushPhase();

                const repLines = [`${step.reps}x`];
                step.steps.forEach(innerStep => {
                    repLines.push(`- ${this.formatDuration(innerStep.duration || 0)} ${innerStep.type} @ ${innerStep.intensity}`);
                });
                sections.push(repLines.join('\n'));
            } else {
                // Normal step - group by type (Warmup, Cooldown, or Main/Run)
                const stepPhase = step.type === 'Warmup' ? 'Warmup' :
                    step.type === 'Cooldown' ? 'Cooldown' : null;

                if (stepPhase !== currentPhase) {
                    flushPhase();
                    currentPhase = stepPhase;
                }

                // Format the step line
                const durationStr = this.formatDuration(step.duration || 0);
                if (currentPhase) {
                    // Warmup/Cooldown - just show duration and intensity
                    currentLines.push(`- ${durationStr} @ ${step.intensity}`);
                } else {
                    // Main work - include the type (Run, Recover, etc.)
                    currentLines.push(`- ${durationStr} ${step.type} @ ${step.intensity}`);
                }
            }
        });

        flushPhase();
        return sections.join('\n\n');
    }
    static formatDuration(seconds) {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        return `${seconds}s`;
    }

    /**
     * Matches title against hardcoded definitions
     */
    static matchHardcodedStructure(title, type) {
        if (!title) return null;
        const lowerTitle = title.toLowerCase();

        // 1. Hill Sprints (Week 1 Base)
        if (lowerTitle.includes("hill sprints")) {
            return {
                minDuration: 2700, // 45m
                steps: [
                    { type: 'Warmup', duration: 900, intensity: '60-70%' }, // 15m
                    {
                        reps: 8,
                        steps: [
                            { type: 'Run', duration: 10, intensity: 'Max Effort' }, // 10s Sprint
                            { type: 'Recover', duration: 90, intensity: 'Z1' }     // 90s Rec
                        ]
                    },
                    { type: 'Cooldown', duration: 600, intensity: '60-70%' } // 10m
                ]
            };
        }

        // 2. Progression Run (Week 2 Base)
        if (lowerTitle.includes("progression run")) {
            return {
                minDuration: 3300, // 55m
                steps: [
                    { type: 'Warmup', duration: 600, intensity: '60-70%' }, // 10m
                    { type: 'Run', duration: 900, intensity: 'Z2 (Steady)' }, // 15m
                    { type: 'Run', duration: 900, intensity: 'Z3 (Tempo)' },  // 15m
                    { type: 'Run', duration: 300, intensity: 'Z4 (Threshold)' }, // 5m
                    { type: 'Cooldown', duration: 300, intensity: '60-70%' } // 5m
                ]
            };
        }

        // 3. Fartlek (Week 3 Base)
        if (lowerTitle.includes("fartlek")) {
            return {
                minDuration: 2700,
                steps: [
                    { type: 'Warmup', duration: 900, intensity: '60-70%' }, // 15m
                    {
                        reps: 8,
                        steps: [
                            { type: 'Run', duration: 60, intensity: '5k Pace' },
                            { type: 'Recover', duration: 60, intensity: 'Z1' }
                        ]
                    },
                    { type: 'Cooldown', duration: 600, intensity: '60-70%' } // 10m
                ]
            };
        }

        // 4. Strides (Generic Quality) 
        // User Spec: Warmup 10m, 8x(20s @ 125-135% + 100s @ 60-70%), Cooldown 10m
        if (lowerTitle.includes("strides")) {
            return {
                minDuration: 2700, // ~45m
                steps: [
                    { type: 'Warmup', duration: 600, intensity: '60-70%' }, // 10m
                    {
                        reps: 8,
                        steps: [
                            { type: 'Run', duration: 20, intensity: '125-135%' },
                            { type: 'Recover', duration: 100, intensity: '60-70%' }
                        ]
                    },
                    { type: 'Cooldown', duration: 600, intensity: '60-70%' } // 10m
                ]
            };
        }

        return null;
    }
}
// exports.WorkoutHydrationService = WorkoutHydrationService; (Removed)
// Map shortened codes to full type names
WorkoutHydrationService.TYPE_MAP = {
    'w': 'Warmup',
    'c': 'Cooldown',
    'r': 'Run',
    'rec': 'Recover',
    'z1': 'Zone 1', // Example mapping if needed, though intensity is usually passed through
};
// UMD-style export
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = { WorkoutHydrationService };
}
else if (typeof window !== 'undefined') {
    window.WorkoutHydrationService = WorkoutHydrationService;
}
