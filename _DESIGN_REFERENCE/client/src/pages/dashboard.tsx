import { useApp } from "@/lib/app-context";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ZoneBadge } from "@/components/ui/zone-badge";
import { ProgressRing } from "@/components/ui/progress-ring";
import { ArrowRight, Clock, MapPin, Trophy, ChevronRight, Activity, Zap } from "lucide-react";
import { formatDurationLong } from "@/lib/utils";
import { MOCK_STATS } from "@/lib/mock-data";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user, workouts } = useApp();
  const [, setLocation] = useLocation();

  if (!user) return null;

  // Find today's workout (simulated)
  // In a real app, match new Date()
  const todayWorkout = workouts[0]; 
  const nextWorkouts = workouts.slice(1, 4);

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Base Phase • Week 3</p>
          <h1 className="text-3xl font-bold tracking-tight">Today's Plan</h1>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={() => setLocation('/onboarding')} 
            variant="outline" 
            className="rounded-full flex items-center gap-2 border-2"
          >
            <Zap className="w-4 h-4" />
            Quickstart
          </Button>
          <div className="hidden md:block text-right">
            <p className="text-2xl font-bold">{format(new Date(), "EEEE")}</p>
            <p className="text-muted-foreground">{format(new Date(), "MMM d, yyyy")}</p>
          </div>
        </div>
      </div>

      {/* Hero Card: Today's Workout */}
      <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-950">
        <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6 md:items-center justify-between">
            <div className="space-y-4">
              <div className="space-y-1">
                 <div className="flex items-center gap-3 mb-2">
                    <ZoneBadge zone={2} showLabel={true} />
                    <span className="text-sm font-medium text-muted-foreground uppercase">{todayWorkout.type}</span>
                 </div>
                 <h2 className="text-3xl md:text-4xl font-bold text-foreground">{todayWorkout.name}</h2>
              </div>
              
              <div className="flex items-center gap-6 text-sm font-medium text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-foreground">{formatDurationLong(todayWorkout.duration)}</span>
                </div>
                {todayWorkout.distance && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary" />
                    <span className="text-foreground">{(todayWorkout.distance / 1000).toFixed(1)} km</span>
                  </div>
                )}
                 <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <span className="text-foreground">{todayWorkout.tss} TSS</span>
                 </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 min-w-[160px]">
               <Button size="lg" className="w-full rounded-full text-base h-14 shadow-xl shadow-primary/20" onClick={() => setLocation(`/workout/${todayWorkout.id}`)}>
                 Start Workout
               </Button>
               <Button variant="outline" className="w-full rounded-full border-2">
                 View Details
               </Button>
            </div>
          </div>

          {/* Workout Structure Visualizer (Mini) */}
          <div className="mt-8 flex gap-1 h-12 items-end opacity-80">
            {todayWorkout.plannedSteps.map((step, i) => {
              let height = '100%';
              if (typeof step.zone === 'number') {
                 height = step.zone === 1 ? '40%' : step.zone === 2 ? '60%' : step.zone === 3 ? '75%' : step.zone === 4 ? '90%' : '100%';
              }
              const color = `var(--zone-${step.zone})`;
              return (
                <div 
                  key={i}
                  className="rounded-t-sm flex-1 transition-all hover:opacity-100"
                  style={{ 
                    height, 
                    backgroundColor: `hsl(${color})`,
                  }}
                  title={`${step.name}: ${formatDurationLong(step.duration)} @ Z${step.zone}`}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Grid: Upcoming & Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Upcoming Workouts */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Coming Up</h3>
            <Button variant="link" onClick={() => setLocation('/schedule')}>See Schedule</Button>
          </div>
          
          <div className="grid gap-4">
            {nextWorkouts.map((workout) => {
              // Find the primary zone (first non-Z1 zone, or just Z1)
              const primaryZoneStep = workout.plannedSteps.find(s => typeof s.zone === 'number' && s.zone > 1) || workout.plannedSteps[0];
              const zoneColor = `hsl(var(--zone-${primaryZoneStep?.zone || 1}))`;

              return (
                <div 
                  key={workout.id} 
                  className="group flex items-center p-4 bg-white rounded-[20px] shadow-sm border border-transparent hover:border-border hover:shadow-md transition-all cursor-pointer"
                  onClick={() => setLocation(`/workout/${workout.id}`)}
                >
                  <div className="w-14 h-14 rounded-2xl bg-secondary flex flex-col items-center justify-center text-xs font-bold text-muted-foreground mr-4 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="text-lg">{format(workout.date, "d")}</span>
                    <span className="uppercase">{format(workout.date, "EEE")}</span>
                  </div>
                  
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold text-lg">{workout.name}</h4>
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zoneColor }} />
                     </div>
                     <p className="text-sm text-muted-foreground">
                        {workout.type} • {formatDurationLong(workout.duration)}
                        {workout.distance && ` • ${(workout.distance/1000).toFixed(1)}km`}
                     </p>
                  </div>
                  
                  <ChevronRight className="text-muted-foreground opacity-50" />
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Stats */}
        <div className="space-y-4">
          <h3 className="text-xl font-bold">Weekly Progress</h3>
          <Card className="h-full bg-white border-none shadow-sm p-6 flex flex-col justify-between">
             <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Volume</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">32.5</span>
                    <span className="text-sm font-medium">/ 45 km</span>
                  </div>
                  <div className="mt-2 h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-[72%] rounded-full" />
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-1">Intensity Distribution</p>
                  <div className="flex h-4 w-full rounded-full overflow-hidden gap-0.5">
                     <div className="bg-[hsl(var(--zone-1))] w-[20%]" />
                     <div className="bg-[hsl(var(--zone-2))] w-[50%]" />
                     <div className="bg-[hsl(var(--zone-3))] w-[20%]" />
                     <div className="bg-[hsl(var(--zone-4))] w-[10%]" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    <span>Low (70%)</span>
                    <span>High (30%)</span>
                  </div>
                </div>
             </div>
             
             <div className="mt-8 pt-6 border-t">
               <div className="flex items-center gap-3">
                 <ProgressRing progress={MOCK_STATS.readiness} radius={25} stroke={4} className="text-primary" />
                 <div>
                   <p className="font-bold">Readiness: {MOCK_STATS.readiness}%</p>
                   <p className="text-xs text-muted-foreground">High capability to train hard today.</p>
                 </div>
               </div>
             </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
