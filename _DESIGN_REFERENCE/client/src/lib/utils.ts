import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format duration in seconds to MM:SS or H:MM:SS
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatDurationLong(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

// Generate date array for calendar
export function getDaysInWeek(currentDate: Date = new Date()) {
  const days = [];
  const start = new Date(currentDate);
  // Adjust to get the Monday of the current week
  const day = start.getDay();
  const diff = start.getDate() - day + (day === 0 ? -6 : 1); 
  start.setDate(diff);

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
}
