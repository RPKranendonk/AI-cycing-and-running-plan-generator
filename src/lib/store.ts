// ============================================================================
// ZUSTAND STORE
// Centralized state management with persistence
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
    AthleteProfile,
    FitnessMetrics,
    TrainingGoal,
    WeeklyAvailability,
    WeekSchedule,
    ScheduledWorkout,
    IntervalsCredentials,
    AIProviderConfig,
    DragState,
    ViewMode
} from '@/types';

// ============================================================================
// STORE INTERFACE
// ============================================================================

interface AppState {
    // Athlete Profile
    athlete: AthleteProfile;
    metrics: FitnessMetrics;
    goal: TrainingGoal;

    // API Credentials
    intervals: IntervalsCredentials;
    ai: AIProviderConfig;

    // Availability
    availability: WeeklyAvailability;
    longRunDay: number;

    // Plan
    plan: WeekSchedule[];
    modifications: Record<string, unknown>;

    // Progression Settings
    progression: {
        startingVolume: number;
        progressionRate: number;
        startingLongRun: number;
        longRunProgression: number;
    };

    // Generator Settings (Persisted)
    planSettings: {
        progressionRate: number;
        longRunProgression: number;
        taperDuration: number;
        startWithRestWeek: boolean;
    };

    // UI Preferences (Persisted)
    preferences: {
        proMode: boolean;      // Show advanced metrics (CTL, TSS, etc.)
        darkMode: boolean;
    };

    // UI State
    viewMode: ViewMode;
    selectedWeek: number;
    dragState: DragState | null;
    isLoading: boolean;

    // Actions
    setAthlete: (profile: Partial<AthleteProfile>) => void;
    setMetrics: (metrics: Partial<FitnessMetrics>) => void;
    setGoal: (goal: Partial<TrainingGoal>) => void;
    setIntervalsCredentials: (creds: Partial<IntervalsCredentials>) => void;
    setAIConfig: (config: Partial<AIProviderConfig>) => void;
    setAvailability: (day: number, avail: Partial<WeeklyAvailability[number]>) => void;
    setAllAvailability: (avail: WeeklyAvailability) => void;
    setPlan: (weeks: WeekSchedule[]) => void;
    updateWorkout: (weekNum: number, day: number, slot: 'am' | 'pm', workout: ScheduledWorkout | null) => void;
    setProgression: (prog: Partial<AppState['progression']>) => void;
    setPlanSettings: (settings: Partial<AppState['planSettings']>) => void;
    setViewMode: (mode: ViewMode) => void;
    setSelectedWeek: (week: number) => void;
    setDragState: (state: DragState | null) => void;
    setLoading: (loading: boolean) => void;
    setPreferences: (prefs: Partial<AppState['preferences']>) => void;
    reset: () => void;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const defaultAvailability: WeeklyAvailability = {
    0: { hours: 2.0, split: false, amHours: 1.0, pmHours: 1.0 },  // Sunday
    1: { hours: 1.5, split: false, amHours: 0.75, pmHours: 0.75 }, // Monday
    2: { hours: 1.5, split: false, amHours: 0.75, pmHours: 0.75 }, // Tuesday
    3: { hours: 1.5, split: false, amHours: 0.75, pmHours: 0.75 }, // Wednesday
    4: { hours: 1.5, split: false, amHours: 0.75, pmHours: 0.75 }, // Thursday
    5: { hours: 1.5, split: false, amHours: 0.75, pmHours: 0.75 }, // Friday
    6: { hours: 2.5, split: false, amHours: 1.25, pmHours: 1.25 }, // Saturday
};

const initialState = {
    athlete: {
        name: '',
        sport: 'Running' as const,
        experience: 'consistent' as const,
        gymAccess: 'none' as const,
    },
    metrics: {},
    goal: {
        type: 'event' as const,
        raceDate: '',
    },
    intervals: {
        apiKey: '',
        athleteId: '',
    },
    ai: {
        provider: 'mistral' as const,
        apiKey: '',
    },
    availability: defaultAvailability,
    longRunDay: 6, // Saturday
    plan: [],
    modifications: {},
    progression: {
        startingVolume: 30,
        progressionRate: 0.10,
        startingLongRun: 10,
        longRunProgression: 1.5,
    },
    planSettings: {
        progressionRate: 0.10,
        longRunProgression: 1.5,
        taperDuration: 2,
        startWithRestWeek: false,
    },
    viewMode: 'scroll' as ViewMode,
    selectedWeek: 1,
    dragState: null,
    isLoading: false,
};

// ============================================================================
// STORE CREATION
// ============================================================================

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            ...initialState,

            // Athlete Actions
            setAthlete: (profile) => set((state) => ({
                athlete: { ...state.athlete, ...profile }
            })),

            setMetrics: (metrics) => set((state) => ({
                metrics: { ...state.metrics, ...metrics }
            })),

            setGoal: (goal) => set((state) => ({
                goal: { ...state.goal, ...goal }
            })),

            // API Actions
            setIntervalsCredentials: (creds) => set((state) => ({
                intervals: { ...state.intervals, ...creds }
            })),

            setAIConfig: (config) => set((state) => ({
                ai: { ...state.ai, ...config }
            })),

            // Availability Actions
            setAvailability: (day, avail) => set((state) => ({
                availability: {
                    ...state.availability,
                    [day]: { ...state.availability[day], ...avail }
                }
            })),

            setAllAvailability: (avail) => set({ availability: avail }),

            // Plan Actions
            setPlan: (weeks) => set({ plan: weeks }),

            updateWorkout: (weekNum, day, slot, workout) => set((state) => {
                const newPlan = [...state.plan];
                const weekIndex = newPlan.findIndex(w => w.weekNumber === weekNum);
                if (weekIndex !== -1) {
                    const newDays = [...newPlan[weekIndex].days];
                    if (slot === 'am') {
                        newDays[day] = { ...newDays[day], workout };
                    } else {
                        newDays[day] = { ...newDays[day], secondary: workout };
                    }
                    newPlan[weekIndex] = { ...newPlan[weekIndex], days: newDays };
                }
                return { plan: newPlan };
            }),

            // Progression Actions
            setProgression: (prog) => set((state) => ({
                progression: { ...state.progression, ...prog }
            })),

            setPlanSettings: (settings) => set((state) => ({
                planSettings: { ...state.planSettings, ...settings }
            })),

            // UI Actions
            setViewMode: (mode) => set({ viewMode: mode }),
            setSelectedWeek: (week) => set({ selectedWeek: week }),
            setDragState: (dragState) => set({ dragState }),
            setLoading: (isLoading) => set({ isLoading }),

            // Reset
            reset: () => set(initialState),
        }),
        {
            name: 'endurance-ai-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Only persist these fields
                athlete: state.athlete,
                metrics: state.metrics,
                goal: state.goal,
                intervals: state.intervals,
                ai: state.ai,
                availability: state.availability,
                longRunDay: state.longRunDay,
                plan: state.plan,
                progression: state.progression,
                planSettings: state.planSettings,
            }),
        }
    )
);

// ============================================================================
// SELECTORS (for performance)
// ============================================================================

export const selectAthlete = (state: AppState) => state.athlete;
export const selectMetrics = (state: AppState) => state.metrics;
export const selectGoal = (state: AppState) => state.goal;
export const selectPlan = (state: AppState) => state.plan;
export const selectAvailability = (state: AppState) => state.availability;
export const selectProgression = (state: AppState) => state.progression;
export const selectIsLoading = (state: AppState) => state.isLoading;

// Week selector
export const selectWeek = (weekNum: number) => (state: AppState) =>
    state.plan.find(w => w.weekNumber === weekNum);

// Total volume selector
export const selectTotalVolume = (state: AppState) =>
    state.plan.reduce((sum, week) => sum + (week.actualVolume || week.targetVolume), 0);
