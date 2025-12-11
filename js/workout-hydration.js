// "use strict"; (Removed CJS strict)
// Object.defineProperty(exports, "__esModule", { value: true }); (Removed)
// exports.WorkoutHydrationService = void 0; (Removed)
class WorkoutHydrationService {
    /**
     * Main entry point to hydrate a full week of CSV data
     */
    static hydrateWeek(csvData, blockStartDate) {
        const lines = csvData.trim().split('\n');
        const weekPlan = [];
        lines.forEach(line => {
            if (!line.trim())
                return;
            const parts = line.split(',');
            // CSV Columns: DayIndex, Type, Distance, Duration, Title, StepsString
            // Note: Handle cases where StepsString might be missing or empty
            const dayIndex = parseInt(parts[0]);
            if (isNaN(dayIndex)) {
                // Skip lines with invalid day index (headers, empty lines, bad data)
                return;
            }
            const type = parts[1] ? parts[1].trim() : '';
            if (!type || type.toLowerCase() === 'dayindex')
                return; // Double check for header
            const distance = parts[2] ? parseInt(parts[2]) : 0;
            const duration = parts[3] ? parseInt(parts[3]) : 0;
            const title = parts[4];
            const stepsString = parts.length > 5 ? parts.slice(5).join(',') : ''; // Join back in case of accidental commas in steps
            // Check validity of blockStartDate
            if (isNaN(blockStartDate.getTime())) {
                console.error("Invalid Block Start Date passed to hydrator");
                // fallback to today if totally broken? No, better to skip or error safely.
                // We will skip to avoid crashing the UI logic loop.
                return;
            }
            const workoutDate = new Date(blockStartDate);
            workoutDate.setDate(blockStartDate.getDate() + dayIndex);
            let workout;
            if (type === 'Rest') {
                workout = {
                    date: workoutDate.toISOString(),
                    start_date_local: workoutDate.toISOString(),
                    dayIndex,
                    type: 'Rest',
                    title: title || 'Rest Day',
                    description: 'Passive Recovery',
                    totalDuration: 0,
                    totalDistance: 0,
                    steps: []
                };
            }
            else {
                const parsedSteps = this.parseSteps(stepsString);
                const description = this.generateDescription(parsedSteps);
                workout = {
                    date: workoutDate.toISOString(),
                    start_date_local: workoutDate.toISOString(),
                    dayIndex,
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
        return weekPlan;
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
                // Inner steps separated by '+'
                const innerStepsRaw = innerContent.split('+');
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
     */
    static generateDescription(steps) {
        const blocks = [];
        steps.forEach(step => {
            let blockLines = [];
            if (step.reps && step.steps) {
                // Repeater
                blockLines.push(`${step.reps}x`);
                step.steps.forEach(innerStep => {
                    blockLines.push(`- ${this.formatDuration(innerStep.duration || 0)} ${innerStep.type} @ ${innerStep.intensity}`);
                });
            }
            else {
                // Normal Step
                blockLines.push(`- ${this.formatDuration(step.duration || 0)} ${step.type} @ ${step.intensity}`);
            }
            blocks.push(blockLines.join('\n'));
        });
        return blocks.join('\n\n');
    }
    static formatDuration(seconds) {
        if (seconds >= 60) {
            const mins = Math.floor(seconds / 60);
            const secs = seconds % 60;
            return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
        }
        return `${seconds}s`;
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
