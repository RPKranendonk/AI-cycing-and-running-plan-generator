/**
 * @file progression-engine.js
 * @description Logic for progressive overload and specific workout structures.
 * @usedBy js/features/scheduling/services/template-generator.js
 * @responsibilities
 * - Returns specific workout steps based on type, phase, and week number
 * - Handles "Taper" and "Recovery" week adjustments
 * - Defines the "Standard Library" of progressions (e.g., Strides, Tempo, VO2Max)
 * @why Encapsulates the "Coaching Wisdom" of how workouts change over time.
 */

// ==========================================
// PROGRESSION ENGINE
// Calculates structured workout progressions
// ==========================================

/**
 * Calculate Progressive Overload Structure
 * Returns { note, label, duration, steps } based on type, phase and week
 * @param {string} type - STRIDES, VO2MAX, TEMPO, HILL_SPRINTS, PROGRESSION, FARTLEK
 * @param {number} week - Week number in phase (1-indexed)
 * @param {string} phase - Current phase (for Taper detection)
 */
function calculateProgression(type, week, phase = 'Base') {
    const w = (week - 1) % 4 + 1; // 1,2,3,4 cycle
    const isRace = phase === 'Race';
    const isTaper = phase === 'Taper';

    // Base Durations: Warmup 10m (600s), Cooldown 10m (600s) = 20m (1200s) overhead
    const OVERHEAD = 1200;

    if (type === 'STRIDES') {
        let reps = 6 + (w - 1) * 2; // W1: 6, W2: 8, W3: 10

        if (isRace) reps = 4;
        else if (isTaper) reps = Math.ceil(reps * 0.75);

        const steps = [
            { type: 'Warmup', duration: 600, intensity: '60-70% Pace', press_lap: true },
            {
                name: 'Strides',
                reps: reps,
                steps: [
                    { type: 'Run', duration: 20, intensity: '125-135% Pace' },
                    { type: 'Recover', duration: 100, intensity: '60-70% Pace', press_lap: true }
                ]
            },
            { type: 'Cooldown', duration: 600, intensity: '60-70% Pace' }
        ];

        return {
            note: `${reps}x20s Strides`,
            label: `${reps}x20s`,
            duration: 1200 + (reps * 120),
            steps: steps
        };
    }

    if (type === 'VO2MAX') {
        let reps = 5 + (w - 1);

        if (isRace) reps = 3;
        else if (isTaper) reps = Math.ceil(reps * 0.75);

        const repDuration = 3.5 * 60;
        const restDuration = 2 * 60;
        const totalDuration = OVERHEAD + (reps * (repDuration + restDuration));

        const steps = [
            { type: 'Warmup', duration: 900, intensity: '60-70% Pace' },
            {
                name: 'VO2 Max',
                reps: reps,
                steps: [
                    { type: 'Run', distance: 800, intensity: '102-106% Pace' },
                    { type: 'Recover', duration: 120, intensity: '60-70% Pace' }
                ]
            },
            { type: 'Cooldown', duration: 600, intensity: '60-70% Pace' }
        ];

        return {
            note: `${reps} x 800m @ 5k Pace (2min rest)`,
            label: `${reps}x800m`,
            duration: totalDuration,
            steps: steps
        };
    }

    if (type === 'TEMPO') {
        let qualityMins = 20 + (w - 1) * 5;

        if (isRace) qualityMins = 15;
        else if (isTaper) qualityMins = Math.ceil(qualityMins * 0.75);

        let note = '';
        let label = '';
        let workDuration = 0;
        let steps = [];

        if (qualityMins <= 20) {
            note = `${qualityMins}min @ Threshold`;
            label = `${qualityMins}min`;
            workDuration = qualityMins * 60;
            steps = [
                { type: 'Warmup', duration: 900, intensity: '60-70% Pace' },
                { type: 'Run', duration: qualityMins * 60, intensity: '95-100% Pace' },
                { type: 'Cooldown', duration: 600, intensity: '60-70% Pace' }
            ];
        } else {
            const blockTime = Math.ceil(qualityMins / 2);
            note = `2 x ${blockTime}min @ Threshold (2min rest)`;
            label = `2x${blockTime}min`;
            workDuration = (qualityMins * 60) + 120;
            steps = [
                { type: 'Warmup', duration: 900, intensity: '60-70% Pace' },
                {
                    name: 'Threshold',
                    reps: 2,
                    steps: [
                        { type: 'Run', duration: blockTime * 60, intensity: '95-100% Pace' },
                        { type: 'Recover', duration: 120, intensity: '60-70% Pace' }
                    ]
                },
                { type: 'Cooldown', duration: 600, intensity: '60-70% Pace' }
            ];
        }

        return {
            note: note,
            label: label,
            duration: OVERHEAD + workDuration,
            steps: steps
        };
    }

    if (type === 'HILL_SPRINTS') {
        const reps = 8;
        const workSec = 10;
        const restSec = 90;
        const totalDuration = OVERHEAD + (reps * (workSec + restSec));

        const steps = [
            { type: 'Warmup', duration: 900, intensity: '60-70% Pace' },
            {
                name: 'Hill Sprints',
                reps: reps,
                steps: [
                    { type: 'Run', duration: workSec, intensity: '106-130% Pace' },
                    { type: 'Recover', duration: restSec, intensity: '60-85% Pace' }
                ]
            },
            { type: 'Cooldown', duration: 600, intensity: '60-70% Pace' }
        ];

        return {
            note: `${reps} x 10s Hill Sprints (Max Effort, Full Rest)`,
            label: 'Hill Sprints',
            duration: Math.max(2700, totalDuration),
            steps: steps
        };
    }

    if (type === 'PROGRESSION') {
        const steps = [
            { type: 'Warmup', duration: 600, intensity: '60-70% Pace' },
            { type: 'Run', duration: 900, intensity: '85-90% Pace' },
            { type: 'Run', duration: 900, intensity: '90-95% Pace' },
            { type: 'Run', duration: 300, intensity: '95-100% Pace' },
            { type: 'Cooldown', duration: 300, intensity: '60-70% Pace' }
        ];

        return {
            note: 'Progression Run: 1/3 Easy, 1/3 Steady, 1/3 Mod-Hard',
            label: 'Progression',
            duration: 3000,
            steps: steps
        };
    }

    if (type === 'FARTLEK') {
        const steps = [
            { type: 'Warmup', duration: 600, intensity: '60-70% Pace' },
            { type: 'Run', duration: 900, intensity: '85-90% Pace' },
            { type: 'Run', duration: 900, intensity: '90-95% Pace' },
            { type: 'Run', duration: 300, intensity: '95-100% Pace' },
            { type: 'Cooldown', duration: 300, intensity: '60-70% Pace' }
        ];

        return {
            note: 'Fartlek: 10m Easy → 15m Steady → 15m Tempo → 5m Threshold',
            label: 'Fartlek',
            duration: 3000,
            steps: steps
        };
    }

    return { note: 'Easy Run', label: 'Easy', duration: 3600 };
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.calculateProgression = calculateProgression;

window.ProgressionEngine = {
    calculateProgression
};
