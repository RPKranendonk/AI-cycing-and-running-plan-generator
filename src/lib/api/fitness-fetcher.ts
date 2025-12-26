// ============================================================================
// FITNESS FETCHER SERVICE
// TypeScript port for fetching athlete data from Intervals.icu
// ============================================================================

import { intervalsClient } from './intervals-client';
import type { IntervalsActivity, IntervalsWellness, IntervalsAthlete } from './intervals-client';

// ============================================================================
// TYPES
// ============================================================================

export interface FitnessData {
    ctl: number;  // Chronic Training Load (fitness)
    atl: number;  // Acute Training Load (fatigue)
    tsb: number;  // Training Stress Balance (form)
    rampRate: number;
}

export interface BiometricsData {
    rhr: { current: number; avg: number };
    hrv: { current: number; avg: number };
    sleep: { current: number; avg: number };
    soreness: { current: number; avg: number };
    weight?: number;
}

export interface WeeklyVolumeData {
    weekStart: string;
    weekEnd: string;
    totalKm: number;
    activities: Array<{
        date: string;
        name: string;
        distanceKm: number;
        type: string;
    }>;
}

export interface ComplianceData {
    compliance: number;
    plannedVolume: number;
    actualVolume: number;
    details: Array<{
        date: string;
        name: string;
        distance: string;
        type: string;
    }>;
}

export interface AthleteSettings {
    ftp?: number;
    lthr?: number;
    maxHr?: number;
    weight?: number;
    name?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
}

function getDateRange(daysBack: number): { oldest: string; newest: string } {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - daysBack);
    return {
        oldest: formatDate(start),
        newest: formatDate(end),
    };
}

function calculateAverage(data: number[]): number {
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, val) => acc + val, 0);
    return Math.round(sum / data.length);
}

// ============================================================================
// FITNESS FETCHER CLASS
// ============================================================================

class FitnessFetcher {
    /**
     * Fetch athlete settings from Intervals.icu
     */
    async fetchAthleteSettings(): Promise<AthleteSettings | null> {
        try {
            const data = await intervalsClient.getAthlete();

            const settings: AthleteSettings = {
                name: data.name,
                ftp: data.ftp,
                maxHr: data.max_hr,
                weight: data.weight,
            };

            // LTHR is in icu_lthr field
            if ((data as IntervalsAthlete & { icu_lthr?: number }).icu_lthr) {
                settings.lthr = (data as IntervalsAthlete & { icu_lthr?: number }).icu_lthr;
            }

            console.log('[FitnessFetcher] Athlete settings:', settings);
            return settings;
        } catch (error) {
            console.error('[FitnessFetcher] Athlete settings fetch error:', error);
            return null;
        }
    }

    /**
     * Fetch fitness metrics (CTL, ATL, TSB)
     */
    async fetchFitness(): Promise<FitnessData | null> {
        try {
            const data = await intervalsClient.getAthlete() as IntervalsAthlete & {
                ctl?: number;
                atl?: number;
                tsb?: number;
                ramp_rate?: number;
            };

            const fitness: FitnessData = {
                ctl: data.ctl || 0,
                atl: data.atl || 0,
                tsb: data.tsb || 0,
                rampRate: data.ramp_rate || 0,
            };

            console.log('[FitnessFetcher] Fitness data:', fitness);
            return fitness;
        } catch (error) {
            console.error('[FitnessFetcher] Fitness fetch error:', error);
            return null;
        }
    }

    /**
     * Fetch recent activities
     */
    async fetchActivities(daysBack = 40): Promise<IntervalsActivity[]> {
        const { oldest, newest } = getDateRange(daysBack);

        try {
            const activities = await intervalsClient.getActivities(oldest, newest);
            console.log(`[FitnessFetcher] Fetched ${activities.length} activities`);
            return activities;
        } catch (error) {
            console.error('[FitnessFetcher] Activities fetch error:', error);
            return [];
        }
    }

    /**
     * Fetch activities for a specific date range
     */
    async fetchActivitiesForRange(
        oldest: string,
        newest: string
    ): Promise<IntervalsActivity[]> {
        try {
            return await intervalsClient.getActivities(oldest, newest);
        } catch (error) {
            console.error('[FitnessFetcher] Activities range fetch error:', error);
            return [];
        }
    }

    /**
     * Fetch wellness data
     */
    async fetchWellness(daysBack = 28): Promise<IntervalsWellness[]> {
        const { oldest, newest } = getDateRange(daysBack);

        try {
            const wellness = await intervalsClient.getWellness(oldest, newest);
            console.log(`[FitnessFetcher] Fetched ${wellness.length} wellness entries`);
            return wellness;
        } catch (error) {
            console.error('[FitnessFetcher] Wellness fetch error:', error);
            return [];
        }
    }

    /**
     * Calculate biometrics from wellness data
     */
    calculateBiometrics(wellness: IntervalsWellness[]): BiometricsData | null {
        if (!wellness.length) return null;

        // Sort by date descending
        const sorted = [...wellness].sort((a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const latest = sorted[0];

        // Calculate averages
        const rhrValues = sorted.map(w => w.rhr).filter((v): v is number => v !== undefined);
        const hrvValues = sorted.map(w => w.hrv).filter((v): v is number => v !== undefined);
        const sorenessValues = sorted.map(w => w.soreness).filter((v): v is number => v !== undefined);

        // Find weight
        const withWeight = sorted.find(w => w.weight);

        return {
            rhr: {
                current: latest.rhr || 0,
                avg: calculateAverage(rhrValues),
            },
            hrv: {
                current: latest.hrv || 0,
                avg: calculateAverage(hrvValues),
            },
            sleep: {
                current: latest.sleep_quality || 0,
                avg: calculateAverage(sorted.map(w => w.sleep_quality).filter((v): v is number => v !== undefined)),
            },
            soreness: {
                current: latest.soreness || 0,
                avg: calculateAverage(sorenessValues),
            },
            weight: withWeight?.weight,
        };
    }

    /**
     * Calculate weekly volume from activities
     */
    calculateWeeklyVolume(
        activities: IntervalsActivity[],
        sportType: 'Running' | 'Cycling' = 'Running'
    ): WeeklyVolumeData[] {
        const weeks: WeeklyVolumeData[] = [];
        const now = new Date();

        // Get last Sunday
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
        lastSunday.setHours(23, 59, 59, 999);

        // Calculate 4 weeks
        for (let i = 0; i < 4; i++) {
            const end = new Date(lastSunday);
            end.setDate(lastSunday.getDate() - (i * 7));

            const start = new Date(end);
            start.setDate(end.getDate() - 6);
            start.setHours(0, 0, 0, 0);

            const weekActivities: WeeklyVolumeData['activities'] = [];
            let totalKm = 0;

            activities.forEach(act => {
                const actDate = new Date(act.start_date_local);
                if (actDate >= start && actDate <= end) {
                    const actType = act.type?.toLowerCase() || '';
                    const isRun = actType.includes('run');
                    const isRide = actType.includes('ride') || actType.includes('cycling');

                    if ((sportType === 'Running' && isRun) || (sportType === 'Cycling' && isRide)) {
                        const distanceKm = (act.distance || 0) / 1000;
                        totalKm += distanceKm;
                        weekActivities.push({
                            date: act.start_date_local.split('T')[0],
                            name: act.name,
                            distanceKm,
                            type: act.type,
                        });
                    }
                }
            });

            weeks.push({
                weekStart: formatDate(start),
                weekEnd: formatDate(end),
                totalKm: Math.round(totalKm * 10) / 10,
                activities: weekActivities,
            });
        }

        return weeks;
    }

    /**
     * Calculate compliance for a week
     */
    async calculateCompliance(
        weekStart: string,
        plannedVolume: number,
        sportType: 'Running' | 'Cycling' = 'Running'
    ): Promise<ComplianceData> {
        const startDate = new Date(weekStart);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        const oldest = weekStart;
        const newest = formatDate(endDate);

        const activities = await this.fetchActivitiesForRange(oldest, newest);

        let actualVolume = 0;
        const details: ComplianceData['details'] = [];

        activities.forEach(act => {
            const actType = act.type?.toLowerCase() || '';
            const isRun = actType.includes('run');
            const isRide = actType.includes('ride') || actType.includes('cycling');

            if ((sportType === 'Running' && isRun) || (sportType === 'Cycling' && isRide)) {
                const distanceKm = (act.distance || 0) / 1000;
                actualVolume += distanceKm;
                details.push({
                    date: act.start_date_local?.split('T')[0] || '',
                    name: act.name,
                    distance: distanceKm.toFixed(1),
                    type: act.type,
                });
            }
        });

        const compliance = plannedVolume > 0
            ? Math.min(actualVolume / plannedVolume, 1.5)
            : 1.0;

        return {
            compliance: Math.round(compliance * 100) / 100,
            plannedVolume: Math.round(plannedVolume * 10) / 10,
            actualVolume: Math.round(actualVolume * 10) / 10,
            details,
        };
    }

    /**
     * Get volume recommendations based on recent training
     */
    async getVolumeRecommendations(
        sportType: 'Running' | 'Cycling' = 'Running'
    ): Promise<{
        lastWeekVolume: number;
        avgVolume: number;
        conservative: number;
        moderate: number;
        aggressive: number;
    }> {
        const activities = await this.fetchActivities(28);
        const weeks = this.calculateWeeklyVolume(activities, sportType);

        const lastWeekVolume = weeks[0]?.totalKm || 0;
        const avgVolume = weeks.reduce((sum, w) => sum + w.totalKm, 0) / weeks.length;
        const baseVolume = lastWeekVolume > 0 ? lastWeekVolume : avgVolume;

        return {
            lastWeekVolume: Math.round(lastWeekVolume * 10) / 10,
            avgVolume: Math.round(avgVolume * 10) / 10,
            conservative: Math.round(baseVolume * 1.05 * 10) / 10,
            moderate: Math.round(baseVolume * 1.075 * 10) / 10,
            aggressive: Math.round(baseVolume * 1.10 * 10) / 10,
        };
    }
}

// Export singleton instance
export const fitnessFetcher = new FitnessFetcher();

// Export class for testing
export { FitnessFetcher };
