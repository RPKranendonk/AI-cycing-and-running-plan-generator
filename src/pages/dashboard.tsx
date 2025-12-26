// ============================================================================
// DASHBOARD PAGE
// Main home page showing today's workout and weekly progress
// ============================================================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { buildWeekSchedule, formatScheduleForDisplay } from '@/lib/scheduler'
import type { WeekData } from '@/lib/scheduler'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
    Play,
    Clock,
    MapPin,
    ChevronRight,
    Zap,
    Calendar,
    TrendingUp,
    RefreshCw,
} from 'lucide-react'

export default function Dashboard() {
    const { availability, progression, athlete, setLoading, isLoading } = useStore()
    const [schedule, setSchedule] = useState<ReturnType<typeof formatScheduleForDisplay> | null>(null)

    const handleGeneratePlan = () => {
        setLoading(true)
        setTimeout(() => {
            const weekData: WeekData = {
                weekNumber: 1,
                targetVolume: progression.startingVolume,
                longRunDistance: progression.startingLongRun,
                phase: 'base',
                isRecoveryWeek: false,
                gymTarget: 2,
                startDate: new Date().toISOString(),
            }
            const result = buildWeekSchedule(weekData, availability)
            setSchedule(formatScheduleForDisplay(result))
            setLoading(false)
        }, 500)
    }

    // Find today's workout from schedule
    const todayIndex = new Date().getDay() // 0=Sun, 6=Sat
    const todayWorkout = schedule?.[todayIndex]?.workout
    const upcomingWorkouts = schedule?.filter((d, i) => i > todayIndex && d.workout).slice(0, 3) || []

    // Today's date info is calculated inline below

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Base Phase • Week 1
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight">
                        {athlete.name ? `Welcome back, ${athlete.name.split(' ')[0]}` : "Today's Plan"}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/onboarding">
                        <Button variant="outline" className="rounded-full">
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Quick Start
                        </Button>
                    </Link>
                    {!schedule && (
                        <Button
                            onClick={handleGeneratePlan}
                            className="rounded-full"
                            disabled={isLoading}
                        >
                            <Zap className="w-4 h-4 mr-2" />
                            Generate Plan
                        </Button>
                    )}
                    <div className="hidden md:block text-right">
                        <p className="text-xl font-bold">
                            {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
                        </p>
                        <p className="text-muted-foreground text-sm">
                            {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                    </div>
                </div>
            </div>

            {/* Today's Workout Hero Card */}
            {todayWorkout ? (
                <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-950">
                    <div
                        className="absolute top-0 left-0 w-2 h-full"
                        style={{ backgroundColor: todayWorkout.color }}
                    />
                    <CardContent className="p-6 md:p-8">
                        <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span
                                            className="px-2.5 py-1 rounded-full text-xs font-medium text-white"
                                            style={{ backgroundColor: todayWorkout.color }}
                                        >
                                            {todayWorkout.sport}
                                        </span>
                                        <span className="text-sm font-medium text-muted-foreground uppercase">
                                            {todayWorkout.focus}
                                        </span>
                                    </div>
                                    <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                                        {todayWorkout.name}
                                    </h2>
                                </div>

                                <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-primary" />
                                        <span className="text-foreground">
                                            {todayWorkout.estimatedDuration} min
                                        </span>
                                    </div>
                                    {todayWorkout.estimatedDistance && (
                                        <div className="flex items-center gap-2">
                                            <MapPin className="w-5 h-5 text-primary" />
                                            <span className="text-foreground">
                                                {todayWorkout.estimatedDistance} km
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 min-w-[160px]">
                                <Button size="lg" className="w-full rounded-full text-base h-14 shadow-xl shadow-primary/20">
                                    <Play className="w-5 h-5 mr-2" />
                                    Start Workout
                                </Button>
                                <Button variant="outline" className="w-full rounded-full border-2">
                                    View Details
                                </Button>
                            </div>
                        </div>

                        {/* Workout Structure Visualizer */}
                        {todayWorkout.steps.length > 0 && (
                            <div className="mt-8 flex gap-1 h-12 items-end opacity-80">
                                {todayWorkout.steps.map((step, i) => {
                                    const height = step.type === 'warmup' ? '40%' : step.type === 'cooldown' ? '40%' : '100%'
                                    return (
                                        <div
                                            key={i}
                                            className="rounded-t-sm flex-1 transition-all hover:opacity-100"
                                            style={{
                                                height,
                                                backgroundColor: todayWorkout.color + '80',
                                            }}
                                            title={`${step.type}: ${step.duration} @ ${step.intensity}`}
                                        />
                                    )
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
            ) : !schedule ? (
                <Card className="border-dashed border-2 bg-muted/30">
                    <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                            <Calendar className="w-8 h-8 text-primary" />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">No Plan Yet</h3>
                        <p className="text-muted-foreground mb-6">
                            Click "Generate Plan" to create your personalized training schedule.
                        </p>
                        <Button onClick={handleGeneratePlan} isLoading={isLoading}>
                            <Zap className="w-4 h-4 mr-2" />
                            Generate Plan
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800">
                    <CardContent className="p-6 text-center">
                        <h3 className="text-xl font-semibold text-green-700 dark:text-green-300">Rest Day</h3>
                        <p className="text-green-600 dark:text-green-400">Recover and prepare for your next workout!</p>
                    </CardContent>
                </Card>
            )}

            {/* Grid: Upcoming & Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming Workouts */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-bold">Coming Up</h3>
                        <Link to="/schedule">
                            <Button variant="link">See Schedule</Button>
                        </Link>
                    </div>

                    <div className="grid gap-4">
                        {schedule ? (
                            upcomingWorkouts.length > 0 ? (
                                upcomingWorkouts.map((day, i) => (
                                    <div
                                        key={day.day}
                                        className="group flex items-center p-4 bg-white rounded-[20px] shadow-sm border border-transparent hover:border-border hover:shadow-md transition-all cursor-pointer dark:bg-zinc-900"
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-secondary flex flex-col items-center justify-center text-xs font-bold text-muted-foreground mr-4 group-hover:bg-primary group-hover:text-white transition-colors">
                                            <span className="text-lg">{new Date(Date.now() + (i + 1) * 86400000).getDate()}</span>
                                            <span className="uppercase">{day.dayName}</span>
                                        </div>

                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-bold text-lg">{day.workout?.name}</h4>
                                                <div
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: day.workout?.color }}
                                                />
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {day.workout?.focus} • {day.workout?.estimatedDuration}m
                                                {day.workout?.estimatedDistance && ` • ${day.workout.estimatedDistance}km`}
                                            </p>
                                        </div>

                                        <ChevronRight className="text-muted-foreground opacity-50" />
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-center py-8">No more workouts this week!</p>
                            )
                        ) : (
                            <p className="text-muted-foreground text-center py-8">Generate a plan to see upcoming workouts</p>
                        )}
                    </div>
                </div>

                {/* Weekly Stats */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold">Weekly Progress</h3>
                    <Card className="h-full bg-white border-none shadow-sm dark:bg-zinc-900">
                        <CardContent className="p-6 space-y-6">
                            {/* Volume */}
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Volume</p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-4xl font-bold">
                                        {schedule ? Math.round(progression.startingVolume * 0.72) : 0}
                                    </span>
                                    <span className="text-sm font-medium">/ {progression.startingVolume} km</span>
                                </div>
                                <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all"
                                        style={{ width: schedule ? '72%' : '0%' }}
                                    />
                                </div>
                            </div>

                            {/* Intensity Distribution */}
                            <div>
                                <p className="text-sm text-muted-foreground mb-1">Intensity Distribution</p>
                                <div className="flex h-4 w-full rounded-full overflow-hidden gap-0.5">
                                    <div className="bg-zone-1 w-[20%]" />
                                    <div className="bg-zone-2 w-[50%]" />
                                    <div className="bg-zone-3 w-[20%]" />
                                    <div className="bg-zone-4 w-[10%]" />
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                                    <span>Low (70%)</span>
                                    <span>High (30%)</span>
                                </div>
                            </div>

                            {/* Streak */}
                            <div className="pt-4 border-t">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                        <TrendingUp className="w-6 h-6 text-primary" />
                                    </div>
                                    <div>
                                        <p className="font-bold">3 Day Streak</p>
                                        <p className="text-xs text-muted-foreground">Keep it going!</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
