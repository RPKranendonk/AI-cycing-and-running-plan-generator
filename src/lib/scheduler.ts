// ============================================================================
// SCHEDULER SERVICE
// Rule-based weekly schedule builder using backward scheduling (Big Rocks First)
// Ported from: _LEGACY_VANILLA/js/core/deterministic-scheduler.js
// ============================================================================

import type {
    DaySlot,
    ScheduledWorkout,
    WeeklyAvailability,
} from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export type Phase = 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'race';

export interface WeekData {
    weekNumber: number;
    targetVolume: number;      // km
    longRunDistance: number;   // km
    phase: Phase;
    isRecoveryWeek: boolean;
    gymTarget: number;         // Strength sessions per week
    startDate: string;
}

export interface SchedulerOptions {
    thresholdPace?: number;    // sec/km
    easyPace?: number;         // sec/km
    preferredLongRunDay?: number; // 0-6 (Sun-Sat)
}

export interface SchedulerResult {
    schedule: DaySlot[];
    usedVolume: number;
    targetVolume: number;
    warnings: SchedulerWarning[];
}

export interface SchedulerWarning {
    type: string;
    message: string;
}

// Day names for display
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ============================================================================
// MAIN SCHEDULING FUNCTION
// ============================================================================

/**
 * Build a weekly schedule using backward scheduling (Big Rocks First)
 * 
 * Priority Order:
 * 1. Long Run (biggest rock) - placed on day with most hours
 * 2. Key Workout (intervals/tempo) - placed on day with second-most hours
 * 3. Strength sessions - placed on remaining high-availability days
 * 4. Easy runs - fill remaining volume
 */
export function buildWeekSchedule(
    weekData: WeekData,
    availability: WeeklyAvailability,
    options: SchedulerOptions = {}
): SchedulerResult {
    const {
        targetVolume = 30,
        longRunDistance = 12,
        phase = 'base',
        isRecoveryWeek = false,
        gymTarget = 2,
    } = weekData;

    const {
        thresholdPace = 300,  // 5:00/km
        easyPace = 375,       // 6:15/km
        preferredLongRunDay = null,
    } = options;

    const warnings: SchedulerWarning[] = [];

    // Initialize empty schedule
    const schedule: DaySlot[] = Array.from({ length: 7 }, () => ({
        workout: null,
        secondary: null,
    }));

    let usedVolume = 0;

    // =========================================================================
    // STEP 1: Place Long Run (Big Rock #1)
    // =========================================================================
    const longRunDurationMin = estimateDuration(longRunDistance, easyPace);
    const longRunDay = findBestDay(schedule, availability, longRunDurationMin, preferredLongRunDay);

    if (longRunDay !== -1) {
        const longRunWorkout = createLongRunWorkout(longRunDistance, longRunDurationMin, weekData.weekNumber);
        schedule[longRunDay].workout = longRunWorkout;
        usedVolume += longRunDistance;
    } else {
        warnings.push({
            type: 'NO_LONG_RUN_SLOT',
            message: `No day with enough time for ${longRunDistance}km Long Run (needs ${Math.round(longRunDurationMin)}min)`,
        });
    }

    // =========================================================================
    // STEP 2: Place Key Workout (Big Rock #2) - Skip for Recovery weeks
    // =========================================================================
    if (!isRecoveryWeek) {
        const keyType = selectKeyWorkoutType(phase, weekData.weekNumber);
        const keyDay = findSecondBestDay(schedule, availability, 45, longRunDay);

        if (keyDay !== -1) {
            const availableMinutes = getAvailableMinutes(availability, keyDay);
            const keyWorkout = createKeyWorkout(keyType, availableMinutes, thresholdPace, weekData.weekNumber);
            schedule[keyDay].workout = keyWorkout;
            usedVolume += keyWorkout.estimatedDistance || 0;
        } else {
            warnings.push({
                type: 'NO_KEY_SLOT',
                message: 'Could not place Key workout - insufficient availability',
            });
        }
    }

    // =========================================================================
    // STEP 3: Place Strength Sessions
    // =========================================================================
    let gymPlaced = 0;

    // Place on hard days first (stacking principle)
    if (gymPlaced < gymTarget) {
        for (let day = 0; day < 7 && gymPlaced < gymTarget; day++) {
            if (schedule[day].workout && !schedule[day].secondary && day !== longRunDay) {
                const workoutType = schedule[day].workout?.focus || '';
                const isHardDay = ['Intervals', 'Tempo', 'Threshold'].some(t => workoutType.includes(t));

                if (isHardDay) {
                    schedule[day].secondary = createStrengthWorkout('neural', weekData.weekNumber);
                    gymPlaced++;
                }
            }
        }
    }

    // Place stability on easy days
    if (gymPlaced < gymTarget) {
        for (let day = 0; day < 7 && gymPlaced < gymTarget; day++) {
            if (!schedule[day].workout && !schedule[day].secondary && day !== longRunDay) {
                const dayAvail = availability[day];
                if (dayAvail && dayAvail.hours >= 0.75) {
                    schedule[day].workout = createStrengthWorkout('stability', weekData.weekNumber);
                    gymPlaced++;
                }
            }
        }
    }

    // =========================================================================
    // STEP 4: Fill Remaining Volume with Easy Runs
    // =========================================================================
    const remainingVolume = Math.max(0, targetVolume - usedVolume);

    if (remainingVolume > 0) {
        const emptyDays = schedule
            .map((slot, i) => ({ slot, day: i }))
            .filter(({ slot, day }) =>
                !slot.workout &&
                availability[day]?.hours > 0.5 &&
                day !== (longRunDay + 1) % 7  // Not day after long run
            );

        if (emptyDays.length > 0) {
            const volumePerDay = remainingVolume / emptyDays.length;
            const maxEasyRun = longRunDistance * 0.6; // 60% of long run max

            for (const { slot, day } of emptyDays) {
                const availableMinutes = getAvailableMinutes(availability, day);
                const maxDistByTime = estimateDistance(availableMinutes - 10, easyPace);
                const targetDist = Math.min(volumePerDay, maxDistByTime, maxEasyRun);

                if (targetDist >= 3) { // Min 3km
                    const duration = estimateDuration(targetDist, easyPace);
                    slot.workout = createEasyRunWorkout(targetDist, duration, weekData.weekNumber);
                    usedVolume += targetDist;
                }
            }
        }
    }

    return {
        schedule,
        usedVolume: Math.round(usedVolume * 10) / 10,
        targetVolume,
        warnings,
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find the best day for a workout based on available hours
 */
function findBestDay(
    schedule: DaySlot[],
    availability: WeeklyAvailability,
    requiredMinutes: number,
    preferred: number | null
): number {
    const requiredHours = requiredMinutes / 60;

    // Try preferred first
    if (preferred !== null && availability[preferred]?.hours >= requiredHours && !schedule[preferred]?.workout) {
        return preferred;
    }

    // Weekend preference for long runs
    const weekendDays = [0, 6]; // Sun, Sat
    for (const day of weekendDays) {
        if (availability[day]?.hours >= requiredHours && !schedule[day]?.workout) {
            return day;
        }
    }

    // Any day with enough time
    let bestDay = -1;
    let maxHours = 0;

    for (let day = 0; day < 7; day++) {
        const hours = availability[day]?.hours || 0;
        if (hours >= requiredHours && hours > maxHours && !schedule[day]?.workout) {
            bestDay = day;
            maxHours = hours;
        }
    }

    return bestDay;
}

/**
 * Find second-best day (for key workout)
 */
function findSecondBestDay(
    schedule: DaySlot[],
    availability: WeeklyAvailability,
    requiredMinutes: number,
    excludeDay: number
): number {
    const requiredHours = requiredMinutes / 60;
    let bestDay = -1;
    let maxHours = 0;

    // Prefer midweek
    const midweekDays = [2, 3, 4]; // Tue, Wed, Thu
    for (const day of midweekDays) {
        if (day === excludeDay) continue;
        if (schedule[day]?.workout) continue;
        const hours = availability[day]?.hours || 0;
        if (hours >= requiredHours && hours > maxHours) {
            bestDay = day;
            maxHours = hours;
        }
    }

    if (bestDay !== -1) return bestDay;

    // Fallback to any available day
    for (let day = 0; day < 7; day++) {
        if (day === excludeDay) continue;
        if (schedule[day]?.workout) continue;
        const hours = availability[day]?.hours || 0;
        if (hours >= requiredHours && hours > maxHours) {
            bestDay = day;
            maxHours = hours;
        }
    }

    return bestDay;
}

/**
 * Get available minutes for a day
 */
function getAvailableMinutes(availability: WeeklyAvailability, day: number): number {
    return (availability[day]?.hours || 0) * 60;
}

/**
 * Estimate duration in minutes from distance and pace
 */
function estimateDuration(distanceKm: number, paceSecPerKm: number): number {
    return Math.ceil((distanceKm * paceSecPerKm) / 60);
}

/**
 * Estimate distance in km from duration and pace
 */
function estimateDistance(durationMin: number, paceSecPerKm: number): number {
    return (durationMin * 60) / paceSecPerKm;
}

/**
 * Select key workout type based on phase and week number
 */
function selectKeyWorkoutType(phase: Phase, weekNumber: number): 'intervals' | 'tempo' | 'threshold' {
    if (phase === 'base') {
        const cycle = ((weekNumber - 1) % 4) + 1;
        if (cycle === 1 || cycle === 3) return 'intervals';
        return 'tempo';
    }
    if (phase === 'recovery') return 'tempo';
    return 'intervals';
}

// ============================================================================
// WORKOUT FACTORY FUNCTIONS
// ============================================================================

function createLongRunWorkout(distance: number, duration: number, weekNumber: number): ScheduledWorkout {
    return {
        id: 'RUN_02',
        name: 'The Long Run',
        sport: 'Running',
        focus: 'Structural durability',
        progressionRule: 'Increase duration by 10% per week',
        steps: [
            { type: 'warmup', duration: '10m', intensity: '60-70%' },
            { type: 'work', duration: `${Math.round(duration - 20)}m`, intensity: '70-80%' },
            { type: 'cooldown', duration: '10m', intensity: '60%' },
        ],
        estimatedDuration: duration,
        estimatedDistance: distance,
        color: '#3B82F6',
        date: '',
        dayOfWeek: 0,
        slot: 'am',
        weekNumber,
    };
}

function createKeyWorkout(
    type: 'intervals' | 'tempo' | 'threshold',
    availableMinutes: number,
    thresholdPace: number,
    weekNumber: number
): ScheduledWorkout {
    const workouts: Record<string, Partial<ScheduledWorkout>> = {
        intervals: {
            id: 'RUN_10',
            name: '1km Repeats',
            focus: 'High-end aerobic capacity',
            color: '#EF4444',
        },
        tempo: {
            id: 'RUN_05',
            name: 'Continuous Tempo',
            focus: 'Mental toughness and stamina',
            color: '#F97316',
        },
        threshold: {
            id: 'RUN_04',
            name: 'Cruise Intervals',
            focus: 'Lactate Threshold',
            color: '#EAB308',
        },
    };

    const template = workouts[type];
    const duration = Math.min(availableMinutes, 60);
    const distance = estimateDistance(duration * 0.7, thresholdPace); // ~70% at pace

    return {
        id: template.id!,
        name: template.name!,
        sport: 'Running',
        focus: template.focus!,
        progressionRule: 'Increase reps each week',
        steps: [
            { type: 'warmup', duration: '15m', intensity: '60-70%' },
            { type: 'work', duration: `${Math.round(duration - 25)}m`, intensity: '95-100%' },
            { type: 'cooldown', duration: '10m', intensity: '60%' },
        ],
        estimatedDuration: duration,
        estimatedDistance: Math.round(distance * 10) / 10,
        color: template.color!,
        date: '',
        dayOfWeek: 0,
        slot: 'am',
        weekNumber,
    };
}

function createEasyRunWorkout(distance: number, duration: number, weekNumber: number): ScheduledWorkout {
    return {
        id: 'RUN_01',
        name: 'Easy Aerobic Run',
        sport: 'Running',
        focus: 'Accumulate time on feet',
        progressionRule: 'Increase duration by 5-10 mins per week',
        steps: [
            { type: 'warmup', duration: '10m', intensity: '65-75%' },
            { type: 'work', duration: `${Math.round(duration - 20)}m`, intensity: '70-80%' },
            { type: 'cooldown', duration: '10m', intensity: '60-70%' },
        ],
        estimatedDuration: duration,
        estimatedDistance: distance,
        color: '#22C55E',
        date: '',
        dayOfWeek: 0,
        slot: 'am',
        weekNumber,
    };
}

function createStrengthWorkout(type: 'neural' | 'stability', weekNumber: number): ScheduledWorkout {
    const templates = {
        neural: {
            id: 'gym_neural',
            name: 'Strength Training A',
            focus: 'Neural Power & Coordination',
        },
        stability: {
            id: 'gym_stability',
            name: 'Strength Training B',
            focus: 'Stability & Endurance',
        },
    };

    const template = templates[type];

    return {
        id: template.id,
        name: template.name,
        sport: 'Strength',
        focus: template.focus,
        progressionRule: 'Progressive overload',
        steps: [],
        estimatedDuration: 45,
        color: '#A855F7',
        date: '',
        dayOfWeek: 0,
        slot: 'am',
        weekNumber,
    };
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface MoveValidation {
    valid: boolean;
    warnings: string[];
}

/**
 * Validate if moving a workout is allowed
 */
export function validateMove(
    schedule: DaySlot[],
    fromDay: number,
    toDay: number,
    slotType: 'am' | 'pm' = 'am'
): MoveValidation {
    const warnings: string[] = [];
    const targetSlot = schedule[toDay];
    const sourceSlot = schedule[fromDay];

    const workout = slotType === 'am' ? sourceSlot.workout : sourceSlot.secondary;
    if (!workout) return { valid: true, warnings: [] };

    // Rule 1: Strength validation
    if (workout.sport === 'Strength') {
        const isNeural = workout.id === 'gym_neural';
        const targetWorkout = targetSlot.workout;

        if (isNeural && targetWorkout?.focus?.includes('Easy')) {
            warnings.push('Neural Strength should be done on Hard Days (Hard/Hard rule)');
        }

        // No consecutive strength days
        const prevDay = (toDay + 6) % 7;
        if (schedule[prevDay]?.secondary?.sport === 'Strength' || schedule[prevDay]?.workout?.sport === 'Strength') {
            warnings.push('Consecutive strength days are not optimal for recovery');
        }
    }

    // Rule 2: High intensity stacking
    const workoutIsHard = ['Intervals', 'Tempo', 'Threshold'].some(t => workout.focus?.includes(t));
    const targetIsHard = targetSlot.workout && ['Intervals', 'Tempo', 'Long'].some(t => targetSlot.workout?.focus?.includes(t));

    if (workoutIsHard && targetIsHard && slotType === 'pm') {
        warnings.push('Stacking two hard running workouts on the same day increases injury risk');
    }

    return {
        valid: warnings.length === 0,
        warnings,
    };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Convert schedule to display format
 */
export function formatScheduleForDisplay(result: SchedulerResult): Array<{
    day: number;
    dayName: string;
    workout: ScheduledWorkout | null;
    secondary: ScheduledWorkout | null;
}> {
    return result.schedule.map((slot, i) => ({
        day: i,
        dayName: DAY_NAMES[i],
        workout: slot.workout,
        secondary: slot.secondary,
    }));
}
