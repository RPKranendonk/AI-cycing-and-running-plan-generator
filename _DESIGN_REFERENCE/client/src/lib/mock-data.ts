import { Workout, DailyStats } from './types';
import { addDays, startOfToday, startOfWeek, addHours } from 'date-fns';

const today = startOfToday();
const monday = startOfWeek(today, { weekStartsOn: 1 });

export const MOCK_WORKOUTS: Workout[] = [
  {
    id: 'w1',
    name: 'Aerobic Base Building',
    date: today,
    type: 'Run',
    duration: 3600,
    distance: 8500,
    tss: 45,
    plannedSteps: [
      { id: 's1', name: 'Warm Up', duration: 600, zone: 1, description: 'Easy jogging' },
      { id: 's2', name: 'Steady State', duration: 2400, zone: 2, description: 'Keep HR under 145' },
      { id: 's3', name: 'Cool Down', duration: 600, zone: 1, description: 'Walk or jog' },
    ],
    completed: false,
  },
  {
    id: 'w2',
    name: 'Tempo Intervals',
    date: addDays(today, 2),
    type: 'Run',
    duration: 3000,
    distance: 7000,
    tss: 60,
    plannedSteps: [
      { id: 's1', name: 'Warm Up', duration: 600, zone: 1 },
      { id: 's2', name: 'Tempo 1', duration: 600, zone: 3 },
      { id: 's3', name: 'Recovery', duration: 180, zone: 1 },
      { id: 's4', name: 'Tempo 2', duration: 600, zone: 3 },
      { id: 's5', name: 'Recovery', duration: 180, zone: 1 },
      { id: 's6', name: 'Tempo 3', duration: 600, zone: 3 },
      { id: 's7', name: 'Cool Down', duration: 240, zone: 1 },
    ],
    completed: false,
  },
  {
    id: 'w3',
    name: 'Long Run',
    date: addDays(today, 4), // Saturday usually
    type: 'Run',
    duration: 5400,
    distance: 12000,
    tss: 80,
    plannedSteps: [
      { id: 's1', name: 'Long Run', duration: 5400, zone: 2, description: 'Consistent pace' },
    ],
    completed: false,
  },
  {
    id: 'w4',
    name: 'Recovery Spin',
    date: addDays(today, 1),
    type: 'Ride',
    duration: 2700,
    distance: 15000,
    tss: 20,
    plannedSteps: [
      { id: 's1', name: 'Spin', duration: 2700, zone: 1 },
    ],
    completed: false,
  },
];

export const MOCK_STATS: DailyStats = {
  date: today,
  readiness: 85,
  sleep: 7.5,
  hrv: 65,
};
