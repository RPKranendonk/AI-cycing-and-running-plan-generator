// ============================================================================
// WORKOUT UPLOADER SERVICE
// TypeScript port for pushing workouts to Intervals.icu
// ============================================================================

import { intervalsClient, type IntervalsEvent } from './intervals-client';
import type { ScheduledWorkout, WeekSchedule } from '@/types';
import {
    formatStepsForIntervals,
    generateDescription,
    type WorkoutStep
} from './step-formatter';

// ============================================================================
// TYPES
// ============================================================================

export interface WorkoutUploadResult {
    success: boolean;
    count: number;
    error?: string;
}

export interface SportSettingsMap {
    Run?: number;
    Ride?: number;
    WeightTraining?: number;
    Yoga?: number;
    Swim?: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Normalizes workout type for Intervals.icu API
 */
export function normalizeWorkoutType(type: string): string | null {
    if (!type || type === 'Rest') return null;
    if (type === 'Gym' || type === 'Strength') return 'WeightTraining';
    return type;
}

/**
 * Builds an event object for Intervals.icu
 */
export function buildEventObject(
    workout: ScheduledWorkout,
    weekNumber: number,
    date: Date,
    slot: 'am' | 'pm' = 'am',
    sportSettingsMap?: SportSettingsMap
): IntervalsEvent | null {
    const apiType = normalizeWorkoutType(workout.sport || 'Run');
    if (!apiType) return null;

    const dateStr = date.toISOString().split('T')[0];
    const timeOfDay = slot === 'pm' ? 'T18:00:00' : 'T06:00:00';
    const dayName = DAY_NAMES[date.getDay()];

    // Build description from steps or use workout description
    let description = '';
    if (workout.steps && workout.steps.length > 0) {
        // Convert steps to proper Intervals.icu format
        // Parse duration strings that might contain distance (e.g., "400m", "1km")
        const formattedSteps: WorkoutStep[] = workout.steps.map(step => {
            const stepFormatted: WorkoutStep = {
                type: step.type as any,
                duration: step.duration,
                intensity: step.intensity
            };

            // Check if duration contains distance markers
            const durationStr = step.duration.toString();
            if (durationStr.match(/^\d+m$/) && !durationStr.includes('min')) {
                // Distance in meters (e.g., "400m")
                stepFormatted.distance = parseInt(durationStr);
                delete stepFormatted.duration;
            } else if (durationStr.match(/^\d+(\.\d+)?km$/)) {
                // Distance in km (e.g., "1km", "1.5km")
                stepFormatted.distance = parseFloat(durationStr) * 1000;
                delete stepFormatted.duration;
            }

            return stepFormatted;
        });

        description = formatStepsForIntervals(formattedSteps);
    }

    // Add zone/intensity info
    if (workout.focus) {
        description = `Focus: ${workout.focus}\n\n${description}`;
    }

    const event: IntervalsEvent = {
        category: 'WORKOUT',
        start_date_local: `${dateStr}${timeOfDay}`,
        type: apiType,
        name: workout.name || workout.sport,
        description,
        color: workout.color,
        moving_time: workout.estimatedDuration ? workout.estimatedDuration * 60 : undefined,
        distance: workout.estimatedDistance ? workout.estimatedDistance * 1000 : undefined,
    };

    // Add external ID for tracking
    (event as IntervalsEvent & { external_id: string }).external_id =
        `endurance_ai_w${weekNumber}_${dayName}_${slot}`;

    // Attach sport settings ID if available
    if (sportSettingsMap && apiType in sportSettingsMap) {
        (event as IntervalsEvent & { sport_settings_id: number }).sport_settings_id =
            sportSettingsMap[apiType as keyof SportSettingsMap]!;
    }

    return event;
}

// ============================================================================
// WORKOUT UPLOADER CLASS
// ============================================================================

class WorkoutUploader {
    private sportSettingsMap: SportSettingsMap = {};

    /**
     * Set sport settings IDs for correct workout categorization
     */
    setSportSettings(settings: SportSettingsMap): void {
        this.sportSettingsMap = settings;
    }

    /**
     * Push a single week's workouts to Intervals.icu
     */
    async pushWeek(week: WeekSchedule, includeTargets = true): Promise<WorkoutUploadResult> {
        const events: IntervalsEvent[] = [];

        week.days.forEach((day, dayIndex) => {
            const date = new Date(week.startDate);
            date.setDate(date.getDate() + dayIndex);

            // Primary workout
            if (day.workout) {
                const event = buildEventObject(
                    day.workout,
                    week.weekNumber,
                    date,
                    'am',
                    this.sportSettingsMap
                );
                if (event) events.push(event);
            }

            // Secondary workout
            if (day.secondary) {
                const event = buildEventObject(
                    day.secondary,
                    week.weekNumber,
                    date,
                    'pm',
                    this.sportSettingsMap
                );
                if (event) events.push(event);
            }
        });

        // Add weekly targets
        if (includeTargets && week.targetVolume) {
            const targetEvent = this.buildWeeklyTargetEvent(week);
            if (targetEvent) events.push(targetEvent);
        }

        if (events.length === 0) {
            return { success: true, count: 0 };
        }

        try {
            // Delete existing events first
            await this.deleteWeekEvents(week);

            // Upload new events
            const result = await intervalsClient.uploadEvents(events);
            return { success: result.success, count: events.length };
        } catch (error) {
            return {
                success: false,
                count: 0,
                error: error instanceof Error ? error.message : 'Upload failed',
            };
        }
    }

    /**
     * Build weekly target event for Intervals.icu
     */
    private buildWeeklyTargetEvent(week: WeekSchedule): IntervalsEvent | null {
        const startDate = new Date(week.startDate);
        const dateStr = startDate.toISOString().split('T')[0];

        // Calculate long run distance from workouts
        let longRunDistance = 0;
        week.days.forEach(day => {
            if (day.workout?.name?.toLowerCase().includes('long')) {
                longRunDistance = day.workout.estimatedDistance || 0;
            }
        });

        // Determine sport type from first workout
        let sportType = 'Run';
        for (const day of week.days) {
            if (day.workout) {
                sportType = day.workout.sport === 'Cycling' ? 'Ride' : 'Run';
                break;
            }
        }

        const target: IntervalsEvent = {
            category: 'TARGET',
            start_date_local: `${dateStr}T00:00:00`,
            type: sportType,
            name: `Week ${week.weekNumber} Target`,
            description: `Weekly Target:\n- Volume: ${week.targetVolume.toFixed(1)}km\n- Long ${sportType}: ${longRunDistance.toFixed(1)}km\n- Phase: ${week.phase}`,
            distance: week.targetVolume * 1000, // Convert to meters
        };

        // Add external ID for tracking
        (target as IntervalsEvent & { external_id: string }).external_id =
            `endurance_ai_w${week.weekNumber}_target`;

        return target;
    }

    /**
     * Push multiple weeks in bulk
     */
    async pushWeeks(weeks: WeekSchedule[], includeTargets = true): Promise<WorkoutUploadResult> {
        const allEvents: IntervalsEvent[] = [];

        for (const week of weeks) {
            week.days.forEach((day, dayIndex) => {
                const date = new Date(week.startDate);
                date.setDate(date.getDate() + dayIndex);

                if (day.workout) {
                    const event = buildEventObject(
                        day.workout,
                        week.weekNumber,
                        date,
                        'am',
                        this.sportSettingsMap
                    );
                    if (event) allEvents.push(event);
                }

                if (day.secondary) {
                    const event = buildEventObject(
                        day.secondary,
                        week.weekNumber,
                        date,
                        'pm',
                        this.sportSettingsMap
                    );
                    if (event) allEvents.push(event);
                }
            });

            // Add weekly target
            if (includeTargets && week.targetVolume) {
                const targetEvent = this.buildWeeklyTargetEvent(week);
                if (targetEvent) allEvents.push(targetEvent);
            }
        }

        if (allEvents.length === 0) {
            return { success: true, count: 0 };
        }

        try {
            const result = await intervalsClient.uploadEvents(allEvents);
            return { success: result.success, count: allEvents.length };
        } catch (error) {
            return {
                success: false,
                count: 0,
                error: error instanceof Error ? error.message : 'Bulk upload failed',
            };
        }
    }

    /**
     * Delete events for a specific week
     */
    async deleteWeekEvents(week: WeekSchedule): Promise<{ success: boolean; deleted: number }> {
        const startDate = week.startDate;
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 7);

        const oldest = startDate.split('T')[0];
        const newest = endDate.toISOString().split('T')[0];

        try {
            const events = await intervalsClient.getEvents(oldest, newest, 'WORKOUT');

            // Filter to our app's events
            const appEvents = events.filter(e =>
                (e as IntervalsEvent & { external_id?: string }).external_id?.includes(`endurance_ai_w${week.weekNumber}`)
            );

            return await intervalsClient.deleteEvents(appEvents);
        } catch (error) {
            console.warn('[WorkoutUploader] Delete failed:', error);
            return { success: false, deleted: 0 };
        }
    }
}

// Export singleton instance
export const workoutUploader = new WorkoutUploader();

// Export class for testing
export { WorkoutUploader };
