import { useApp } from "@/lib/app-context";
import { format, startOfMonth, addDays, isSameDay, isSameMonth, startOfWeek } from "date-fns";
import { Card } from "@/components/ui/card";
import { cn, formatDurationLong } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export default function Schedule() {
  const { workouts } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());

  const today = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = addDays(monthStart, 41); // 6 weeks to fill the calendar
  
  // Start from the Monday of the week containing the 1st
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = Array.from({ length: 42 }).map((_, i) => addDays(calendarStart, i));

  const previousMonth = () => setCurrentDate(addDays(currentDate, -30));
  const nextMonth = () => setCurrentDate(addDays(currentDate, 30));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="rounded-full" onClick={previousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold min-w-[140px] text-center text-lg">{format(currentDate, "MMMM yyyy")}</span>
          <Button variant="outline" size="icon" className="rounded-full" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="space-y-3">
        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="text-center text-sm font-bold text-muted-foreground uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days Grid */}
        <div className="grid grid-cols-7 gap-2 auto-rows-max">
          {days.map((day, i) => {
            const dayWorkouts = workouts.filter(w => isSameDay(w.date, day));
            const isToday = isSameDay(day, today);
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={i}
                className={cn(
                  "min-h-[120px] p-2 rounded-2xl border transition-all space-y-1",
                  isToday
                    ? "bg-primary/10 border-primary/30 shadow-md"
                    : isCurrentMonth
                      ? "bg-white border-transparent hover:border-border hover:shadow-sm"
                      : "bg-gray-50/50 border-transparent opacity-50"
                )}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold",
                      isToday ? "bg-primary text-white" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {isToday && (
                    <span className="text-[10px] font-bold uppercase text-primary">Today</span>
                  )}
                </div>

                {/* Workouts for this day */}
                <div className="space-y-1">
                  {dayWorkouts.length > 0 ? (
                    dayWorkouts.map((w) => {
                      const primaryZone = w.plannedSteps.find(
                        (s) => typeof s.zone === "number" && s.zone > 1
                      ) || w.plannedSteps[0];
                      const zoneNum = typeof primaryZone?.zone === "number" ? primaryZone.zone : 1;

                      return (
                        <Card
                          key={w.id}
                          className={cn(
                            "p-2 shadow-sm border-l-2 overflow-hidden cursor-pointer hover:shadow-md transition-all text-[11px] bg-white/80"
                          )}
                          style={{
                            borderLeftColor: `hsl(var(--zone-${zoneNum}))`,
                          }}
                        >
                          <p className="font-bold truncate text-xs">{w.name}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDurationLong(w.duration)}</p>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          isCurrentMonth ? "text-muted-foreground/40" : "text-muted-foreground/20"
                        )}
                      >
                        Rest
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-8 pt-6 border-t justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[hsl(var(--zone-1))]" />
          <span>Easy</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[hsl(var(--zone-2))]" />
          <span>Base</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[hsl(var(--zone-3))]" />
          <span>Tempo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[hsl(var(--zone-4))]" />
          <span>Hard</span>
        </div>
      </div>
    </div>
  );
}
