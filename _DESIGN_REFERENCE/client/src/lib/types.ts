export type Zone = 1 | 2 | 3 | 4 | 5 | 'strength' | 'rest';

export interface IntervalStep {
  id: string;
  name: string;
  duration: number; // seconds
  zone: Zone;
  description?: string;
  targetPace?: string; // e.g. "4:30 /km"
}

export interface Workout {
  id: string;
  name: string;
  date: Date;
  type: 'Run' | 'Ride' | 'Swim' | 'Strength' | 'Rest';
  duration: number; // seconds
  distance?: number; // meters
  tss?: number;
  plannedSteps: IntervalStep[];
  completed?: boolean;
}

export interface UserProfile {
  name: string;
  sport: 'Runner' | 'Cyclist' | 'Longevity';
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  goal: 'Faster' | 'WeightLoss' | 'Event' | 'Health';
  goalDate?: Date;
  thresholdPace?: string; // "MM:SS"
  weeklyAvailability: number[]; // Hours per day Mon-Sun
  gymAccess: 'Commercial' | 'Home' | 'Bodyweight';
  hasCompletedOnboarding: boolean;
}

export interface DailyStats {
  date: Date;
  readiness: number; // 0-100
  sleep: number; // hours
  hrv: number; // ms
}
