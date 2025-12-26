// ============================================================================
// PROGRESS PAGE
// Training progress and analytics with real charts
// ============================================================================

import { useStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VolumeChart } from '@/components/charts/volume-chart';
import { ZoneDistributionChart } from '@/components/charts/zone-distribution-chart';
import { ProgressRing } from '@/components/charts/progress-ring';
import { TrendingUp, Activity, Calendar, BarChart3, Target } from 'lucide-react';

// Mock data for charts
const volumeData = [
    { week: 'W1', planned: 30, actual: 28 },
    { week: 'W2', planned: 33, actual: 31 },
    { week: 'W3', planned: 36, actual: 37 },
    { week: 'W4', planned: 28, actual: 27 },
    { week: 'W5', planned: 40, actual: 38 },
    { week: 'W6', planned: 44, actual: 43 },
];

const zoneData = [
    { name: 'Z1 Recovery', value: 30, color: 'hsl(var(--zone-1))' },
    { name: 'Z2 Aerobic', value: 45, color: 'hsl(var(--zone-2))' },
    { name: 'Z3 Tempo', value: 15, color: 'hsl(var(--zone-3))' },
    { name: 'Z4 Threshold', value: 7, color: 'hsl(var(--zone-4))' },
    { name: 'Z5 VO2max', value: 3, color: 'hsl(var(--zone-5))' },
];

export default function Progress() {
    const { plan, athlete } = useStore();

    // Calculate stats from plan
    const totalPlannedDistance = plan.reduce(
        (sum, week) => sum + (week.targetVolume || 0),
        0
    );
    const weeksCompleted = plan.filter(w => w.actualVolume !== undefined).length;
    const completionRate = plan.length > 0
        ? Math.round((weeksCompleted / plan.length) * 100)
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Progress</h1>
                <p className="text-muted-foreground">
                    Track your training journey{athlete.name ? `, ${athlete.name}` : ''}
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    {
                        label: 'Total Distance',
                        value: `${totalPlannedDistance.toFixed(1)} km`,
                        icon: Activity,
                        color: 'text-blue-500',
                    },
                    {
                        label: 'Weeks Completed',
                        value: `${weeksCompleted} / ${plan.length}`,
                        icon: Calendar,
                        color: 'text-green-500',
                    },
                    {
                        label: 'Workouts',
                        value: `${plan.length * 5}`, // Estimate
                        icon: BarChart3,
                        color: 'text-purple-500',
                    },
                    {
                        label: 'Completion Rate',
                        value: `${completionRate}%`,
                        icon: TrendingUp,
                        color: 'text-orange-500',
                    },
                ].map((stat) => (
                    <Card key={stat.label}>
                        <CardContent className="p-6">
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-xl bg-secondary ${stat.color}`}>
                                    <stat.icon className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                                    <p className="text-2xl font-bold">{stat.value}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Volume Chart */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Weekly Volume</CardTitle>
                        <CardDescription>Planned vs actual training volume</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <VolumeChart data={volumeData} height={280} />
                    </CardContent>
                </Card>

                {/* Compliance Ring */}
                <Card>
                    <CardHeader>
                        <CardTitle>Plan Compliance</CardTitle>
                        <CardDescription>How well you're following the plan</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center pt-4">
                        <ProgressRing
                            progress={87}
                            size={160}
                            strokeWidth={12}
                            label="Compliance"
                            sublabel="This Month"
                        />
                        <div className="mt-6 grid grid-cols-2 gap-4 w-full text-center">
                            <div>
                                <p className="text-2xl font-bold">12</p>
                                <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">2</p>
                                <p className="text-xs text-muted-foreground">Missed</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Zone Distribution & Goals */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Zone Distribution */}
                <Card>
                    <CardHeader>
                        <CardTitle>Time in Zones</CardTitle>
                        <CardDescription>Distribution across training zones</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ZoneDistributionChart data={zoneData} height={280} />
                    </CardContent>
                </Card>

                {/* Training Goals */}
                <Card>
                    <CardHeader>
                        <CardTitle>Training Goals</CardTitle>
                        <CardDescription>Your progress towards key milestones</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {[
                            { label: 'Weekly Volume Target', current: 38, target: 40, unit: 'km' },
                            { label: 'Long Run Distance', current: 18, target: 32, unit: 'km' },
                            { label: 'Strength Sessions', current: 6, target: 8, unit: 'sessions' },
                        ].map((goal) => (
                            <div key={goal.label} className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="font-medium">{goal.label}</span>
                                    <span className="text-muted-foreground">
                                        {goal.current}/{goal.target} {goal.unit}
                                    </span>
                                </div>
                                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all"
                                        style={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                                    />
                                </div>
                            </div>
                        ))}

                        {/* Race Countdown */}
                        <div className="pt-4 border-t">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-primary/10">
                                    <Target className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold">Goal Race</p>
                                    <p className="text-sm text-muted-foreground">
                                        {plan.length > 0
                                            ? `${plan.length} weeks of training planned`
                                            : 'No race scheduled'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Recent Workouts */}
            <Card>
                <CardHeader>
                    <CardTitle>Recent Workouts</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {[
                            { name: 'Easy Run', date: 'Today', distance: '8.2 km', duration: '52 min', color: 'hsl(var(--zone-2))' },
                            { name: 'Tempo Run', date: 'Yesterday', distance: '6.5 km', duration: '35 min', color: 'hsl(var(--zone-4))' },
                            { name: 'Long Run', date: '3 days ago', distance: '15 km', duration: '1h 32m', color: 'hsl(var(--zone-2))' },
                            { name: 'Intervals', date: '4 days ago', distance: '7.2 km', duration: '45 min', color: 'hsl(var(--zone-5))' },
                        ].map((workout, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className="w-1 h-10 rounded-full"
                                        style={{ backgroundColor: workout.color }}
                                    />
                                    <div>
                                        <p className="font-medium">{workout.name}</p>
                                        <p className="text-sm text-muted-foreground">{workout.date}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium">{workout.distance}</p>
                                    <p className="text-sm text-muted-foreground">{workout.duration}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
