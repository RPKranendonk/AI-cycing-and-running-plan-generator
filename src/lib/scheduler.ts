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
 * Finds the optimal day for scheduling a workout (typically the long run).
 *
 * Uses a priority-based algorithm to select the best day based on time availability
 * and scheduling preferences.
 *
 * @param schedule - Current weekly schedule being built
 * @param availability - User's available hours for each day of the week
 * @param requiredMinutes - Minimum time needed for the workout
 * @param preferred - Optional preferred day (0=Sun, 6=Sat), takes highest priority
 * @returns Day index (0-6) of best available day, or -1 if no suitable day found
 *
 * @remarks
 * Selection Priority (evaluated in order):
 * 1. **Preferred Day** - If specified and has sufficient time
 * 2. **Weekend Days** - Saturday (6) or Sunday (0) with enough hours
 * 3. **Most Available Day** - Any day with maximum available hours
 *
 * Requirements:
 * - Day must have enough available hours (requiredMinutes / 60)
 * - Day must not already have a workout scheduled
 *
 * Algorithm Details:
 * - Converts requiredMinutes to hours for comparison
 * - Weekend days prioritized for long runs (common training pattern)
 * - If no weekend slots available, finds day with most available time
 * - Returns -1 if no day meets minimum time requirement
 *
 * @example
 * const availability = {
 *   0: { hours: 3 }, // Sunday - 3 hours
 *   1: { hours: 1 }, // Monday - 1 hour
 *   6: { hours: 2.5 } // Saturday - 2.5 hours
 * };
 * const longRunDay = findBestDay([], availability, 120, null);
 * // Returns: 0 (Sunday) - weekend day with most hours (3 > 2.5)
 *
 * @example
 * // With preferred day specified
 * const preferredDay = findBestDay([], availability, 90, 6);
 * // Returns: 6 (Saturday) - preferred day has enough time (2.5h >= 1.5h)
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
 * Finds the optimal day for the key workout (intervals/tempo), avoiding the long run day.
 *
 * Implements intelligent scheduling by preferring midweek days for quality workouts,
 * which aligns with best practices in endurance training.
 *
 * @param schedule - Current weekly schedule being built
 * @param availability - User's available hours for each day of the week
 * @param requiredMinutes - Minimum time needed for the workout
 * @param excludeDay - Day to exclude from selection (typically the long run day)
 * @returns Day index (0-6) of best available day, or -1 if no suitable day found
 *
 * @remarks
 * Selection Priority (evaluated in order):
 * 1. **Midweek Days** - Tuesday (2), Wednesday (3), Thursday (4)
 *    - Preferred for spacing hard efforts away from long run
 *    - Allows recovery before/after weekend long runs
 * 2. **Any Available Day** - Falls back to any day with sufficient time
 *
 * Requirements:
 * - Day must not be the excluded day (long run day)
 * - Day must not already have a workout scheduled
 * - Day must have enough available hours
 * - Selects day with most available hours within priority group
 *
 * Training Rationale:
 * - Midweek quality sessions create optimal hard/easy pattern
 * - Separates high-intensity efforts from long run for better recovery
 * - Common pattern: Long Run (weekend) → Easy (Mon) → Key Workout (Tue-Thu)
 *
 * @example
 * const availability = {
 *   0: { hours: 3 },   // Sunday (excluded - long run)
 *   2: { hours: 1.5 }, // Tuesday - 1.5 hours
 *   3: { hours: 2 },   // Wednesday - 2 hours
 *   5: { hours: 1.5 }  // Friday - 1.5 hours
 * };
 * const keyDay = findSecondBestDay([], availability, 45, 0);
 * // Returns: 3 (Wednesday) - midweek day with most hours (2h > 1.5h)
 *
 * @example
 * // When midweek unavailable, falls back to any day
 * const limitedAvailability = {
 *   0: { hours: 3 },   // Sunday (excluded)
 *   5: { hours: 2 }    // Friday - only option
 * };
 * const keyDay = findSecondBestDay([], limitedAvailability, 45, 0);
 * // Returns: 5 (Friday) - only available day with sufficient time
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
 * Calculates workout duration in minutes from distance and running pace.
 *
 * Converts running distance and pace into estimated time needed, useful for
 * checking if a workout fits within available time slots.
 *
 * @param distanceKm - Distance to cover in kilometers
 * @param paceSecPerKm - Running pace in seconds per kilometer
 * @returns Estimated duration in minutes (rounded up to nearest minute)
 *
 * @remarks
 * Formula: duration = (distance × pace) / 60
 * - Multiplies distance by pace to get total seconds
 * - Divides by 60 to convert to minutes
 * - Rounds up using Math.ceil() to ensure sufficient time is allocated
 *
 * Rounding Strategy:
 * - Always rounds UP to be conservative with time estimates
 * - Ensures scheduled workouts have adequate time
 * - Better to have extra buffer than cut workouts short
 *
 * @example
 * // 10km run at 5:00/km pace
 * const duration = estimateDuration(10, 300);
 * // Calculation: (10 * 300) / 60 = 50 minutes
 * // Returns: 50
 *
 * @example
 * // Long run: 20km at 6:15/km pace (375 sec/km)
 * const longRunDuration = estimateDuration(20, 375);
 * // Calculation: (20 * 375) / 60 = 125 minutes
 * // Returns: 125
 *
 * @example
 * // Fractional result rounds up
 * const duration = estimateDuration(5.5, 290);
 * // Calculation: (5.5 * 290) / 60 = 26.58...
 * // Returns: 27 (rounded up)
 */
function estimateDuration(distanceKm: number, paceSecPerKm: number): number {
    return Math.ceil((distanceKm * paceSecPerKm) / 60);
}

/**
 * Calculates maximum running distance achievable given time and pace constraints.
 *
 * Inverse of estimateDuration - determines how far you can run in available time,
 * useful for filling time slots with appropriately-sized workouts.
 *
 * @param durationMin - Available time in minutes
 * @param paceSecPerKm - Expected running pace in seconds per kilometer
 * @returns Maximum distance in kilometers (may include decimals)
 *
 * @remarks
 * Formula: distance = (duration × 60) / pace
 * - Converts minutes to seconds by multiplying by 60
 * - Divides by pace to get distance in kilometers
 * - Returns precise decimal value (not rounded)
 *
 * Precision:
 * - Returns decimal distances (e.g., 8.5 km)
 * - Calling code typically rounds or validates minimum distances
 * - Useful for calculating volume distribution across multiple runs
 *
 * @example
 * // How far can I run in 45 minutes at 6:00/km pace?
 * const distance = estimateDistance(45, 360);
 * // Calculation: (45 * 60) / 360 = 7.5 km
 * // Returns: 7.5
 *
 * @example
 * // Easy run in 60 minutes at 6:15/km pace (375 sec/km)
 * const easyDistance = estimateDistance(60, 375);
 * // Calculation: (60 * 60) / 375 = 9.6 km
 * // Returns: 9.6
 *
 * @example
 * // Available time after warmup/cooldown
 * const availableTime = 50 - 10; // 50min total - 10min buffer
 * const maxDistance = estimateDistance(availableTime, 300);
 * // Calculation: (40 * 60) / 300 = 8 km
 * // Returns: 8
 */
function estimateDistance(durationMin: number, paceSecPerKm: number): number {
    return (durationMin * 60) / paceSecPerKm;
}

/**
 * Determines the type of quality workout for a given training phase and week.
 *
 * Implements periodization by cycling through different workout intensities based on
 * training phase and week number, following structured training principles.
 *
 * @param phase - Current training phase (base, build, peak, taper, recovery, race)
 * @param weekNumber - Absolute week number in the training plan (1-indexed)
 * @returns Workout type: 'intervals' (high intensity), 'tempo' (moderate), or 'threshold'
 *
 * @remarks
 * Workout Type Characteristics:
 * - **Intervals**: High-end aerobic capacity work (VO2max efforts)
 * - **Tempo**: Sustained moderate-hard efforts (mental toughness, stamina)
 * - **Threshold**: Lactate threshold work (comfortably hard pace)
 *
 * Phase-Based Selection Logic:
 *
 * **Base Phase** (Foundation Building):
 * - Uses 4-week microcycle pattern
 * - Week 1 & 3: Intervals (builds aerobic power)
 * - Week 2 & 4: Tempo (builds aerobic endurance)
 * - Alternates high/moderate intensity for balanced development
 *
 * **Recovery Phase**:
 * - Always tempo (lower intensity for active recovery)
 * - Maintains fitness without excessive stress
 *
 * **All Other Phases** (Build, Peak, Taper, Race):
 * - Defaults to intervals (race-specific intensity)
 * - Prioritizes high-end fitness closer to competition
 *
 * Microcycle Calculation (Base Phase):
 * - Cycle position = ((weekNumber - 1) % 4) + 1
 * - Results in repeating 1-2-3-4 pattern throughout base phase
 *
 * @example
 * // Base phase - week 1 of 4-week cycle
 * const workout1 = selectKeyWorkoutType('base', 1);
 * // Returns: 'intervals'
 *
 * @example
 * // Base phase - week 2 of 4-week cycle
 * const workout2 = selectKeyWorkoutType('base', 2);
 * // Returns: 'tempo'
 *
 * @example
 * // Base phase - week 5 (cycles back to week 1)
 * const workout3 = selectKeyWorkoutType('base', 5);
 * // Returns: 'intervals' (5-1 = 4, 4%4 = 0, 0+1 = 1 → intervals)
 *
 * @example
 * // Build phase - always high intensity
 * const workout4 = selectKeyWorkoutType('build', 10);
 * // Returns: 'intervals'
 *
 * @example
 * // Recovery phase - moderate intensity
 * const workout5 = selectKeyWorkoutType('recovery', 4);
 * // Returns: 'tempo'
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
