// ============================================================================
// SCHEDULE PAGE
// Redesigned: Mobile vertical stacking, Desktop summary sidebar + multi-week view
// ============================================================================

import { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { buildWeekSchedule, formatScheduleForDisplay } from '@/lib/scheduler';
import type { WeekData, Phase } from '@/lib/scheduler';
import { intervalsClient } from '@/lib/api/intervals-client';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
    Settings,
    Trash2,
    Send,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Loader2,
} from 'lucide-react';

// Days start with Monday (index 0 = Monday, 6 = Sunday)
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Maps a week number to its corresponding training block and phase.
 *
 * Implements a structured 16-week training plan divided into 4-week blocks,
 * each with a specific training focus following periodization principles.
 *
 * @param weekNum - Week number in the plan (1-indexed)
 * @returns Object containing block number (1-4) and training phase
 *
 * @remarks
 * **Training Block Structure (16 weeks total):**
 *
 * - **Block 1 (Weeks 1-4): Base Phase**
 *   - Focus: Build aerobic foundation
 *   - Priority: Easy mileage, structural adaptation
 *   - Example: Long runs, easy runs, basic intervals
 *
 * - **Block 2 (Weeks 5-8): Build Phase**
 *   - Focus: Increase intensity and volume
 *   - Priority: Tempo work, longer intervals
 *   - Example: Cruise intervals, marathon pace runs
 *
 * - **Block 3 (Weeks 9-12): Peak Phase**
 *   - Focus: Race-specific intensity
 *   - Priority: High-quality workouts, max volume
 *   - Example: VO2max intervals, race pace practice
 *
 * - **Block 4 (Week 13+): Taper Phase**
 *   - Focus: Recovery and sharpening
 *   - Priority: Reduce volume, maintain intensity
 *   - Example: Short intervals, race preparation
 *
 * **Periodization Logic:**
 * - Each block builds on previous adaptations
 * - Volume increases through base/build, peaks, then tapers
 * - Intensity increases progressively across all blocks
 * - Fourth week of each block is typically recovery week
 *
 * @example
 * const week3 = getBlockForWeek(3);
 * // Returns: { blockNum: 1, phase: 'base' }
 *
 * @example
 * const week10 = getBlockForWeek(10);
 * // Returns: { blockNum: 3, phase: 'peak' }
 *
 * @example
 * const week15 = getBlockForWeek(15);
 * // Returns: { blockNum: 4, phase: 'taper' }
 */
function getBlockForWeek(weekNum: number): { blockNum: number; phase: Phase } {
    if (weekNum <= 4) return { blockNum: 1, phase: 'base' };
    if (weekNum <= 8) return { blockNum: 2, phase: 'build' };
    if (weekNum <= 12) return { blockNum: 3, phase: 'peak' };
    return { blockNum: 4, phase: 'taper' };
}

export default function Schedule() {
    const { availability, progression, setLoading, intervals } = useStore();
    const [currentBlock, setCurrentBlock] = useState(1);
    const [schedules, setSchedules] = useState<Map<number, ReturnType<typeof formatScheduleForDisplay>>>(new Map());
    const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([1]));
    const [pushingWeek, setPushingWeek] = useState<number | null>(null);
    const [deletingWeek, setDeletingWeek] = useState<number | null>(null);
    const [confirmDeleteWeek, setConfirmDeleteWeek] = useState<number | null>(null);

    // Get weeks for current block
    const blockWeeks = useMemo(() => {
        const startWeek = (currentBlock - 1) * 4 + 1;
        return Array.from({ length: 4 }, (_, i) => startWeek + i);
    }, [currentBlock]);

    const generateWeek = (weekNum: number) => {
        if (schedules.has(weekNum)) return;

        setLoading(true);
        setTimeout(() => {
            const { phase } = getBlockForWeek(weekNum);
            const weekData: WeekData = {
                weekNumber: weekNum,
                targetVolume: progression.startingVolume * (1 + progression.progressionRate * (weekNum - 1)),
                longRunDistance: progression.startingLongRun + progression.longRunProgression * (weekNum - 1),
                phase,
                isRecoveryWeek: weekNum % 4 === 0,
                gymTarget: 2,
                startDate: new Date().toISOString(),
            };
            const result = buildWeekSchedule(weekData, availability);
            const display = formatScheduleForDisplay(result);

            setSchedules(prev => new Map(prev).set(weekNum, display));
            setLoading(false);
        }, 200);
    };

    // Generate all weeks in current block
    useEffect(() => {
        blockWeeks.forEach(weekNum => {
            if (!schedules.has(weekNum)) {
                generateWeek(weekNum);
            }
        });
    }, [blockWeeks]);

    /**
     * Calculates the start and end dates for a given week in the training plan.
     *
     * Uses Monday-start convention and calculates dates relative to the current week,
     * making Week 1 always the current week regardless of when the user starts.
     *
     * @param weekNum - Week number (1-indexed) from the training plan
     * @returns Object containing formatted date strings and Date object for week start
     *
     * @remarks
     * **Week Convention:**
     * - Week starts on Monday, ends on Sunday
     * - Week 1 = current week (starts on the most recent Monday)
     * - Week 2 = next week (7 days after Week 1 Monday)
     * - Week N = current Monday + (N-1) * 7 days
     *
     * **Algorithm Steps:**
     *
     * 1. **Find Current Monday**
     *    - Get today's day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
     *    - Calculate offset to Monday:
     *      - If Sunday (0): go back 6 days
     *      - If Mon-Sat (1-6): go back (dayOfWeek - 1) days
     *    - Result: Most recent Monday at or before today
     *
     * 2. **Calculate Week Start**
     *    - Start from current Monday
     *    - Add offset: (weekNum - 1) * 7 days
     *    - Week 1: +0 days (current Monday)
     *    - Week 2: +7 days (next Monday)
     *    - Week 3: +14 days, etc.
     *
     * 3. **Calculate Week End**
     *    - End = Start + 6 days (Sunday)
     *    - Ensures 7-day week: Mon-Sun
     *
     * **Return Format:**
     * ```typescript
     * {
     *   start: "Jan 15",      // Formatted start date (Monday)
     *   end: "Jan 21",        // Formatted end date (Sunday)
     *   startDate: Date       // Full Date object for programmatic use
     * }
     * ```
     *
     * **Date Formatting:**
     * - Uses en-US locale
     * - Format: "MMM D" (e.g., "Jan 15", "Dec 3")
     * - Short month name + numeric day
     *
     * **Edge Cases:**
     * - Sunday handled specially (goes back 6 days, not forward 1)
     * - Month boundaries handled automatically by Date object
     * - Year boundaries handled automatically (e.g., Dec 28 → Jan 3)
     *
     * @example
     * // If today is Wednesday, Jan 17, 2024
     * const week1 = getWeekDates(1);
     * // Returns:
     * // {
     * //   start: "Jan 15",        // Monday of current week
     * //   end: "Jan 21",          // Sunday of current week
     * //   startDate: Date(2024-01-15)
     * // }
     *
     * @example
     * // Same today date, getting Week 3
     * const week3 = getWeekDates(3);
     * // Returns:
     * // {
     * //   start: "Jan 29",        // Monday two weeks from now
     * //   end: "Feb 4",           // Sunday (crosses month boundary)
     * //   startDate: Date(2024-01-29)
     * // }
     *
     * @example
     * // If today is Sunday, Jan 21, 2024
     * const week1 = getWeekDates(1);
     * // Returns:
     * // {
     * //   start: "Jan 15",        // Goes back to Monday (6 days ago)
     * //   end: "Jan 21",          // Today (Sunday)
     * //   startDate: Date(2024-01-15)
     * // }
     */
    const getWeekDates = (weekNum: number) => {
        const today = new Date();
        // Find the Monday of the current week
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days
        const currentMonday = new Date(today);
        currentMonday.setDate(today.getDate() + daysToMonday);

        // Add weeks offset
        const start = new Date(currentMonday);
        start.setDate(currentMonday.getDate() + (weekNum - 1) * 7);

        const end = new Date(start);
        end.setDate(start.getDate() + 6); // Sunday

        return {
            start: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            end: end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            startDate: start,
        };
    };

    const toggleWeekExpand = (weekNum: number) => {
        setExpandedWeeks(prev => {
            const newSet = new Set(prev);
            if (newSet.has(weekNum)) {
                newSet.delete(weekNum);
            } else {
                newSet.add(weekNum);
            }
            return newSet;
        });
    };

    // Normalize workout type for Intervals.icu API
    const normalizeWorkoutType = (sport: string | undefined): string => {
        if (!sport || sport === 'Rest') return 'Run';
        if (sport === 'Gym' || sport === 'Strength') return 'WeightTraining';
        if (sport === 'Cycling') return 'Ride';
        return 'Run';
    };

    /**
     * Syncs a week's worth of planned workouts to Intervals.icu platform.
     *
     * This function handles the complete workflow of uploading weekly training schedules
     * to Intervals.icu, including deleting old workouts and creating new ones with
     * proper metadata and external IDs for tracking.
     *
     * @param weekNum - Week number (1-indexed) from the training plan
     * @returns Promise that resolves when sync is complete
     *
     * @remarks
     * **Sync Workflow:**
     *
     * 1. **Validation Phase**
     *    - Verifies Intervals.icu API key and athlete ID are configured
     *    - Shows error toast and exits if credentials missing
     *    - Sets credentials on intervals API client
     *
     * 2. **Cleanup Phase**
     *    - Calculates week start (Monday) and end dates
     *    - Fetches existing workouts from Intervals.icu for the week
     *    - Filters for app-created events (matching external_id pattern)
     *    - Deletes old app events to prevent duplicates
     *    - Preserves manually-created or other-app events
     *
     * 3. **Build Phase**
     *    - Converts each scheduled workout into Intervals.icu event format
     *    - Calculates proper date for each day (Monday = weekStart + 0)
     *    - Normalizes sport types to API-compatible values
     *    - Builds description with focus, distance, and duration
     *    - Creates unique external_id per workout
     *
     * 4. **Upload Phase**
     *    - Uploads all events using intervalsClient.uploadEvents()
     *    - Uses upsert logic to handle potential conflicts
     *    - Shows success toast with event count
     *
     * **Event Format:**
     * ```typescript
     * {
     *   category: 'WORKOUT',
     *   start_date_local: 'YYYY-MM-DDT06:00:00',  // 6 AM default
     *   type: 'Run' | 'WeightTraining' | 'Ride',
     *   name: 'Workout name',
     *   description: 'Focus\n📏 Distance\n⏱️ Duration',
     *   color: '#hex',
     *   moving_time: seconds,
     *   external_id: 'elite_coach_w{week}_{day}_{slot}'
     * }
     * ```
     *
     * **External ID Pattern:**
     * - Format: `elite_coach_w{weekNum}_{dayName}_{slot}`
     * - Example: `elite_coach_w3_Tuesday_morning`
     * - Used for:
     *   - Identifying app-created workouts vs manual entries
     *   - Preventing duplicate uploads
     *   - Safe deletion (only removes app events)
     *
     * **Date Calculation:**
     * - Week starts on Monday (getWeekDates returns Monday as start)
     * - Each day offset: Monday=0, Tuesday=1, ..., Sunday=6
     * - Time: Defaults to 06:00:00 (6 AM) for all workouts
     *
     * **Sport Type Normalization:**
     * - Running/Rest → 'Run'
     * - Gym/Strength → 'WeightTraining'
     * - Cycling → 'Ride'
     * - See normalizeWorkoutType() function
     *
     * **Error Handling:**
     * - Missing credentials: Shows error toast, exits early
     * - Delete errors: Logged but doesn't block upload (warn + continue)
     * - Upload errors: Shows error toast with message
     * - All errors clear loading state via finally block
     *
     * **UI Feedback:**
     * - Sets pushingWeek state (shows loading spinner)
     * - Toast progression: "Syncing..." → "Week Pushed!" or error
     * - Loading state cleared in finally block
     *
     * @example
     * // User clicks "Push to Intervals.icu" button for Week 3
     * await handlePushWeek(3);
     * // Result: 5 workouts uploaded (Mon, Tue, Wed, Fri, Sat)
     * //         Shows: "✅ Week Pushed! 5 workouts synced to Intervals.icu"
     *
     * @throws Does not throw - all errors caught and shown via toast notifications
     *
     * @sideEffects
     * - Modifies Intervals.icu calendar (deletes old, creates new events)
     * - Updates pushingWeek state during operation
     * - Displays toast notifications
     * - Makes multiple API calls to Intervals.icu
     */
    const handlePushWeek = async (weekNum: number) => {
        if (!intervals.apiKey || !intervals.athleteId) {
            toast({
                title: 'Not Connected',
                description: 'Please connect to Intervals.icu in Settings first.',
                variant: 'destructive',
            });
            return;
        }

        setPushingWeek(weekNum);

        // Set client credentials
        intervalsClient.setCredentials({
            apiKey: intervals.apiKey,
            athleteId: intervals.athleteId,
        });

        try {
            // Build events from schedule
            const schedule = schedules.get(weekNum);
            if (!schedule) throw new Error('No schedule found');

            // Get Monday start date for this week
            const { startDate: weekStart } = getWeekDates(weekNum);

            // First, delete existing app events for this week
            toast({ title: 'Syncing...', description: 'Clearing old workouts first' });

            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);
            const oldest = weekStart.toISOString().split('T')[0];
            const newest = weekEnd.toISOString().split('T')[0];

            try {
                const existingEvents = await intervalsClient.getEvents(oldest, newest, 'WORKOUT');
                // Only delete events created by our app (matching external_id pattern)
                const appEvents = existingEvents.filter(
                    (e) => (e as { external_id?: string }).external_id?.startsWith(`elite_coach_w${weekNum}`)
                );
                if (appEvents.length > 0) {
                    await intervalsClient.deleteEvents(appEvents);
                }
            } catch (deleteError) {
                console.warn('Could not delete existing events:', deleteError);
            }

            // Build new events with full metadata
            const events = schedule
                .filter(day => day.workout)
                .map((day, dayIndex) => {
                    const workout = day.workout!;
                    const eventDate = new Date(weekStart);
                    eventDate.setDate(weekStart.getDate() + dayIndex);
                    const dateStr = eventDate.toISOString().split('T')[0];
                    const dayName = DAY_NAMES_FULL[dayIndex];
                    const slot = 'morning'; // Default to morning

                    // Determine API type
                    const apiType = normalizeWorkoutType(workout.sport);

                    // Build description
                    let description = '';
                    if (workout.focus) {
                        description += `${workout.focus}\n\n`;
                    }
                    if (workout.estimatedDistance) {
                        description += `📏 Target: ${workout.estimatedDistance.toFixed(1)} km\n`;
                    }
                    if (workout.estimatedDuration) {
                        description += `⏱️ Duration: ${workout.estimatedDuration} min\n`;
                    }

                    return {
                        category: 'WORKOUT' as const,
                        start_date_local: `${dateStr}T06:00:00`,
                        type: apiType,
                        name: workout.name,
                        description: description.trim(),
                        color: workout.color || '#3498db',
                        moving_time: (workout.estimatedDuration || 60) * 60,
                        // External ID for tracking and preventing duplicates
                        external_id: `elite_coach_w${weekNum}_${dayName}_${slot}`,
                    };
                });

            if (events.length === 0) {
                toast({
                    title: 'No Workouts',
                    description: 'No workouts found for this week',
                });
                return;
            }

            // Upload using upsert for idempotency
            await intervalsClient.uploadEvents(events);

            toast({
                title: '✅ Week Pushed!',
                description: `${events.length} workouts synced to Intervals.icu`,
                variant: 'success',
            });
        } catch (error) {
            console.error('[Push] Error:', error);
            toast({
                title: 'Push Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setPushingWeek(null);
        }
    };

    // Delete workouts from Intervals.icu
    const handleDeleteWeek = async (weekNum: number) => {
        if (!intervals.apiKey || !intervals.athleteId) {
            toast({
                title: 'Not Connected',
                description: 'Please connect to Intervals.icu in Settings first.',
                variant: 'destructive',
            });
            return;
        }

        setDeletingWeek(weekNum);
        setConfirmDeleteWeek(null);

        intervalsClient.setCredentials({
            apiKey: intervals.apiKey,
            athleteId: intervals.athleteId,
        });

        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() + (weekNum - 1) * 7 - startDate.getDay());
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 7);

            const oldest = startDate.toISOString().split('T')[0];
            const newest = endDate.toISOString().split('T')[0];

            const events = await intervalsClient.getEvents(oldest, newest, 'WORKOUT');

            if (events.length > 0) {
                await intervalsClient.deleteEvents(events);
                toast({
                    title: 'Workouts Deleted',
                    description: `Removed ${events.length} workouts from Intervals.icu`,
                    variant: 'default',
                });
            } else {
                toast({
                    title: 'No Workouts',
                    description: 'No planned workouts found for this week',
                    variant: 'default',
                });
            }
        } catch (error) {
            toast({
                title: 'Delete Failed',
                description: error instanceof Error ? error.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setDeletingWeek(null);
        }
    };

    const { phase } = getBlockForWeek(blockWeeks[0]);
    const phaseLabel = phase.charAt(0).toUpperCase() + phase.slice(1);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
                    <p className="text-muted-foreground">
                        Block {currentBlock} • {phaseLabel} Phase
                    </p>
                </div>

                {/* Block Navigation */}
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map(block => (
                        <Button
                            key={block}
                            variant={currentBlock === block ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setCurrentBlock(block)}
                            className="rounded-full"
                        >
                            Block {block}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Weeks List */}
            <div className="space-y-4">
                {blockWeeks.map(weekNum => {
                    const schedule = schedules.get(weekNum);
                    const dates = getWeekDates(weekNum);
                    const isRecovery = weekNum % 4 === 0;
                    const isExpanded = expandedWeeks.has(weekNum);
                    const targetVolume = Math.round(progression.startingVolume * (1 + progression.progressionRate * (weekNum - 1)));
                    const longRunTarget = Math.round(progression.startingLongRun + progression.longRunProgression * (weekNum - 1));
                    const workoutCount = schedule?.filter(d => d.workout).length || 0;

                    return (
                        <Card key={weekNum} className="overflow-hidden">
                            <CardContent className="p-0">
                                {/* Desktop Layout: Summary + Days side by side */}
                                <div className="flex flex-col lg:flex-row">
                                    {/* Week Summary (Left Sidebar on Desktop) */}
                                    <div className="lg:w-64 lg:border-r p-4 bg-secondary/20 flex flex-col">
                                        <div className="flex items-center justify-between lg:flex-col lg:items-start lg:gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg">Week {weekNum}</h3>
                                                    {isRecovery && (
                                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                                            Recovery
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {dates.start} - {dates.end}
                                                </p>
                                            </div>

                                            {/* Mobile: Expand Toggle */}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="lg:hidden"
                                                onClick={() => toggleWeekExpand(weekNum)}
                                            >
                                                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                                            </Button>
                                        </div>

                                        {/* Stats */}
                                        <div className="mt-4 grid grid-cols-3 lg:grid-cols-1 gap-3">
                                            <div>
                                                <p className="text-xs text-muted-foreground">Volume</p>
                                                <p className="font-bold">{targetVolume} km</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Long Run</p>
                                                <p className="font-bold">{longRunTarget} km</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-muted-foreground">Workouts</p>
                                                <p className="font-bold">{workoutCount}</p>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="mt-4 flex lg:flex-col gap-2">
                                            <Button variant="outline" size="sm" className="flex-1 lg:w-full">
                                                <Settings className="w-4 h-4 mr-2" />
                                                <span className="hidden sm:inline">Availability</span>
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="flex-1 lg:w-full text-red-600 hover:text-red-700"
                                                disabled={deletingWeek === weekNum}
                                                onClick={() => setConfirmDeleteWeek(weekNum)}
                                            >
                                                {deletingWeek === weekNum ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                )}
                                                <span className="hidden sm:inline">Delete</span>
                                            </Button>
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="flex-1 lg:w-full"
                                                disabled={pushingWeek === weekNum}
                                                onClick={() => handlePushWeek(weekNum)}
                                            >
                                                {pushingWeek === weekNum ? (
                                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                ) : (
                                                    <Send className="w-4 h-4 mr-2" />
                                                )}
                                                <span className="hidden sm:inline">Push</span>
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Days Grid (Right on Desktop, Below on Mobile) */}
                                    <div className={`flex-1 p-4 ${!isExpanded ? 'hidden lg:block' : ''}`}>
                                        {schedule ? (
                                            <>
                                                {/* Desktop: 7-column grid */}
                                                <div className="hidden lg:grid lg:grid-cols-7 gap-2">
                                                    {/* Day Headers */}
                                                    {DAY_NAMES.map(day => (
                                                        <div key={day} className="text-center text-xs font-medium text-muted-foreground mb-2">
                                                            {day}
                                                        </div>
                                                    ))}

                                                    {/* Day Cards */}
                                                    {schedule.map((day) => (
                                                        <div
                                                            key={day.day}
                                                            className={`min-h-[100px] rounded-xl border p-2 transition-all hover:shadow-md cursor-pointer ${day.day === new Date().getDay() && weekNum === 1
                                                                ? 'ring-2 ring-primary ring-offset-2'
                                                                : ''
                                                                }`}
                                                        >
                                                            {day.workout ? (
                                                                <div className="space-y-1">
                                                                    <div
                                                                        className="w-full h-1 rounded-full"
                                                                        style={{ backgroundColor: day.workout.color }}
                                                                    />
                                                                    <p className="font-medium text-xs truncate">{day.workout.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground">
                                                                        {day.workout.estimatedDuration}m
                                                                        {day.workout.estimatedDistance && ` • ${day.workout.estimatedDistance}km`}
                                                                    </p>
                                                                    <span
                                                                        className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium text-white"
                                                                        style={{ backgroundColor: day.workout.color }}
                                                                    >
                                                                        {day.workout.sport}
                                                                    </span>

                                                                    {day.secondary && (
                                                                        <div className="pt-1 border-t border-dashed mt-1">
                                                                            <p className="text-[10px] font-medium truncate">{day.secondary.name}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                                                                    Rest
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Mobile: Vertical Stack */}
                                                <div className="lg:hidden space-y-2">
                                                    {schedule.map((day) => (
                                                        <div
                                                            key={day.day}
                                                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${day.day === new Date().getDay() && weekNum === 1
                                                                ? 'ring-2 ring-primary'
                                                                : ''
                                                                }`}
                                                        >
                                                            {/* Day Label */}
                                                            <div className="w-16 text-center">
                                                                <p className="font-bold text-sm">{DAY_NAMES[day.day]}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {DAY_NAMES_FULL[day.day].slice(0, 3)}
                                                                </p>
                                                            </div>

                                                            {/* Workout Info */}
                                                            <div className="flex-1">
                                                                {day.workout ? (
                                                                    <div className="flex items-center gap-3">
                                                                        <div
                                                                            className="w-1 h-10 rounded-full"
                                                                            style={{ backgroundColor: day.workout.color }}
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-medium text-sm truncate">{day.workout.name}</p>
                                                                            <p className="text-xs text-muted-foreground">
                                                                                {day.workout.estimatedDuration}m
                                                                                {day.workout.estimatedDistance && ` • ${day.workout.estimatedDistance}km`}
                                                                            </p>
                                                                        </div>
                                                                        <span
                                                                            className="px-2 py-1 rounded-full text-[10px] font-medium text-white shrink-0"
                                                                            style={{ backgroundColor: day.workout.color }}
                                                                        >
                                                                            {day.workout.sport}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground italic">Rest Day</p>
                                                                )}

                                                                {/* Secondary Workout */}
                                                                {day.secondary && (
                                                                    <div className="mt-2 pt-2 border-t border-dashed flex items-center gap-3">
                                                                        <div
                                                                            className="w-1 h-6 rounded-full opacity-60"
                                                                            style={{ backgroundColor: day.secondary.color }}
                                                                        />
                                                                        <div className="flex-1">
                                                                            <p className="text-xs font-medium">{day.secondary.name}</p>
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                {day.secondary.estimatedDuration}m (PM)
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        ) : (
                                            // Loading
                                            <div className="flex items-center justify-center h-32">
                                                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={confirmDeleteWeek !== null} onOpenChange={(open) => !open && setConfirmDeleteWeek(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Week {confirmDeleteWeek} Workouts?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all planned workouts for Week {confirmDeleteWeek} from your Intervals.icu calendar.
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => confirmDeleteWeek && handleDeleteWeek(confirmDeleteWeek)}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            Delete Workouts
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
