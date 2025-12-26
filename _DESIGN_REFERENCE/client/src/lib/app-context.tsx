import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile, Workout } from './types';
import { MOCK_WORKOUTS } from './mock-data';

interface AppContextType {
  user: UserProfile | null;
  workouts: Workout[];
  updateUser: (data: Partial<UserProfile>) => void;
  completeOnboarding: (data: Partial<UserProfile>) => void;
  toggleWorkoutComplete: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Try to load from localStorage first
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('endurance_app_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [workouts, setWorkouts] = useState<Workout[]>(MOCK_WORKOUTS);

  useEffect(() => {
    if (user) {
      localStorage.setItem('endurance_app_user', JSON.stringify(user));
    }
  }, [user]);

  const updateUser = (data: Partial<UserProfile>) => {
    setUser((prev) => prev ? { ...prev, ...data } : data as UserProfile);
  };

  const completeOnboarding = (data: Partial<UserProfile>) => {
    setUser({
      ...data,
      hasCompletedOnboarding: true,
      // Defaults if missing
      name: data.name || 'Athlete',
      sport: data.sport || 'Runner',
      level: data.level || 'Intermediate',
      goal: data.goal || 'Faster',
      weeklyAvailability: data.weeklyAvailability || [1, 1, 1, 1, 1, 2, 2],
      gymAccess: data.gymAccess || 'Commercial',
    } as UserProfile);
  };

  const toggleWorkoutComplete = (id: string) => {
    setWorkouts(prev => prev.map(w => 
      w.id === id ? { ...w, completed: !w.completed } : w
    ));
  };

  return (
    <AppContext.Provider value={{ user, workouts, updateUser, completeOnboarding, toggleWorkoutComplete }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
