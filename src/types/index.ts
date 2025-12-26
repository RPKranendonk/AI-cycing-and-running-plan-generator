// ============================================================================
// TYPE DEFINITIONS
// Core types for the Endurance AI Coach application
// ============================================================================

// ============================================================================
// WORKOUT TYPES
// ============================================================================

export interface WorkoutStep {
    type: 'warmup' | 'work' | 'recovery' | 'cooldown' | 'rest';
    duration: string;      // e.g., "10m", "400m", "3x"
    intensity: string;     // e.g., "60-70%", "Z2", "95-100% Pace"
    cadence?: number;      // For cycling
    notes?: string;
}

export interface Workout {
    id: string;            // e.g., "RUN_04"
    name: string;          // e.g., "Cruise Intervals"
    sport: 'Running' | 'Cycling' | 'Strength';
    focus: string;         // e.g., "Lactate Threshold"
    progressionRule: string;
    steps: WorkoutStep[];
    estimatedDuration: number;  // minutes
    estimatedDistance?: number; // km
    color?: string;        // Hex color for UI
}

export interface ScheduledWorkout extends Workout {
    date: string;          // ISO date string
    dayOfWeek: number;     // 0-6 (Sun-Sat)
    slot: 'am' | 'pm';
    weekNumber: number;
    isCompleted?: boolean;
    actualDuration?: number;
}

// ============================================================================
// SCHEDULE TYPES
// ============================================================================

export interface DaySlot {
    workout: ScheduledWorkout | null;
    secondary: ScheduledWorkout | null; // PM workout
}

export interface WeekSchedule {
    weekNumber: number;
    startDate: string;
    endDate: string;
    phase: 'base' | 'build' | 'peak' | 'taper' | 'recovery' | 'race';
    targetVolume: number;  // km or hours
    actualVolume?: number;
    days: DaySlot[];       // 7 elements (Sun-Sat)
    notes?: string;
}

export interface DayAvailability {
    hours: number;
    split: boolean;
    amHours: number;
    pmHours: number;
}

export type WeeklyAvailability = Record<number, DayAvailability>; // 0-6 (Sun-Sat)

// ============================================================================
// ATHLETE TYPES
// ============================================================================

export interface AthleteProfile {
    name: string;
    sport: 'Running' | 'Cycling';
    experience: 'fresh_start' | 'transfer' | 'consistent' | 'high_performance';
    weight?: number;       // kg
    age?: number;
    gender?: 'male' | 'female' | 'other';
    gymAccess: 'none' | 'basic' | 'full';
}

export interface FitnessMetrics {
    lthrPace?: number;     // seconds per km
    lthrBpm?: number;      // lactate threshold heart rate
    ftp?: number;          // functional threshold power (watts)
    maxHr?: number;
    restingHr?: number;
}

export interface TrainingGoal {
    type: 'event' | 'fitness';
    raceDate?: string;
    raceType?: 'Marathon' | 'Half Marathon' | '10K' | '5K' | 'Century' | 'Gran Fondo';
    goalTime?: string;     // HH:MM:SS
}

// ============================================================================
// ZONE TYPES
// ============================================================================

export interface TrainingZone {
    name: string;
    minPercent: number;
    maxPercent: number;
    description: string;
    color: string;
}

export interface ZoneSet {
    frielZones: TrainingZone[];    // 7 zones (Z1, Z2, Z3, Z4, Z5a, Z5b, Z5c)
    scientificZones: TrainingZone[]; // 3 zones (Z1, Z2, Z3)
    paceZones?: Record<string, { min: number; max: number }>; // sec/km
    hrZones?: Record<string, { min: number; max: number }>;   // bpm
    powerZones?: Record<string, { min: number; max: number }>; // watts
}

// ============================================================================
// API TYPES
// ============================================================================

export interface IntervalsCredentials {
    apiKey: string;
    athleteId: string;
}

export interface AIProviderConfig {
    provider: 'mistral' | 'gemini' | 'openrouter' | 'deepseek';
    apiKey: string;
}

// ============================================================================
// PLAN TYPES
// ============================================================================

export interface TrainingPlan {
    id: string;
    createdAt: string;
    updatedAt: string;
    athlete: AthleteProfile;
    goal: TrainingGoal;
    metrics: FitnessMetrics;
    weeks: WeekSchedule[];
    availability: WeeklyAvailability;
    progression: {
        startingVolume: number;
        progressionRate: number;  // e.g., 0.10 for 10%
        startingLongRun: number;
        longRunProgression: number;
    };
}

// ============================================================================
// UI TYPES
// ============================================================================

export interface DragState {
    workout: ScheduledWorkout | null;
    fromDay: number;
    fromSlot: 'am' | 'pm';
}

export type ViewMode = 'scroll' | 'week' | 'block';
