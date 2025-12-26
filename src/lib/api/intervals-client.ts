// ============================================================================
// INTERVALS.ICU API CLIENT
// TypeScript port of the Intervals.icu integration
// ============================================================================

export interface IntervalsCredentials {
    apiKey: string;
    athleteId: string;
}

export interface IntervalsEvent {
    id?: string;
    start_date_local: string;
    category: 'WORKOUT' | 'TARGET' | 'NOTE';
    name: string;
    description?: string;
    type?: string;
    indoor?: boolean;
    color?: string;
    moving_time?: number;
    distance?: number;
    workout_doc?: WorkoutDoc;
    load_target?: number;
}

export interface WorkoutDoc {
    steps: WorkoutStep[];
}

export interface WorkoutStep {
    type: 'warmup' | 'cooldown' | 'interval' | 'rest' | 'ramp';
    duration?: { value: number; unit: 'seconds' | 'minutes' | 'km' };
    target?: { type: 'pace' | 'power' | 'hr'; min?: number; max?: number };
    reps?: number;
    onDuration?: { value: number; unit: string };
    offDuration?: { value: number; unit: string };
}

export interface IntervalsActivity {
    id: string;
    start_date_local: string;
    type: string;
    name: string;
    moving_time: number;
    distance: number;
    icu_training_load?: number;
}

export interface IntervalsAthlete {
    id: string;
    name: string;
    email?: string;
    sport_settings?: SportSetting[];
    ftp?: number;
    lthr?: number;
    max_hr?: number;
    weight?: number;
}

export interface SportSetting {
    id: number;
    types: string[];
    default_indoor_type?: string;
    pace_units?: string;
}

export interface IntervalsWellness {
    date: string;
    rhr?: number;
    hrv?: number;
    sleep_quality?: number;
    fatigue?: number;
    soreness?: number;
    motivation?: number;
    weight?: number;
}

// ============================================================================
// API CLIENT CLASS
// ============================================================================

class IntervalsClient {
    private baseUrl = 'https://intervals.icu/api/v1';
    private credentials: IntervalsCredentials | null = null;

    /**
     * Set credentials for API calls
     */
    setCredentials(credentials: IntervalsCredentials): void {
        this.credentials = credentials;
    }

    /**
     * Get auth header
     */
    private getAuthHeader(): string {
        if (!this.credentials?.apiKey) {
            throw new Error('Intervals.icu API key not configured');
        }
        return `Basic ${btoa(`API_KEY:${this.credentials.apiKey}`)}`;
    }

    /**
     * Get athlete ID
     */
    private getAthleteId(): string {
        if (!this.credentials?.athleteId) {
            throw new Error('Intervals.icu Athlete ID not configured');
        }
        return this.credentials.athleteId;
    }

    /**
     * Make authenticated request
     */
    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': this.getAuthHeader(),
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Intervals.icu API error: ${response.status} - ${errorText}`);
        }

        const text = await response.text();
        if (!text || text.trim().length === 0) {
            return {} as T;
        }

        try {
            return JSON.parse(text);
        } catch {
            return { raw: text } as unknown as T;
        }
    }

    // =========================================================================
    // ATHLETE
    // =========================================================================

    /**
     * Fetch athlete profile and settings
     */
    async getAthlete(): Promise<IntervalsAthlete> {
        const athleteId = this.getAthleteId();
        return this.request<IntervalsAthlete>(`/athlete/${athleteId}`);
    }

    /**
     * Test connection with current credentials
     */
    async testConnection(): Promise<{ success: boolean; athlete?: IntervalsAthlete; error?: string }> {
        try {
            const athlete = await this.getAthlete();
            return { success: true, athlete };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    // =========================================================================
    // EVENTS (WORKOUTS)
    // =========================================================================

    /**
     * Fetch events for a date range
     */
    async getEvents(
        oldest: string,
        newest: string,
        category?: 'WORKOUT' | 'TARGET' | 'NOTE'
    ): Promise<IntervalsEvent[]> {
        const athleteId = this.getAthleteId();
        let url = `/athlete/${athleteId}/events?oldest=${oldest}&newest=${newest}`;
        if (category) url += `&category=${category}`;
        return this.request<IntervalsEvent[]>(url);
    }

    /**
     * Upload events in bulk (upsert)
     */
    async uploadEvents(events: IntervalsEvent[]): Promise<{ success: boolean; count: number }> {
        if (!events.length) return { success: true, count: 0 };

        const athleteId = this.getAthleteId();
        await this.request(`/athlete/${athleteId}/events/bulk?upsert=true`, {
            method: 'POST',
            body: JSON.stringify(events),
        });

        return { success: true, count: events.length };
    }

    /**
     * Delete events sequentially
     */
    async deleteEvents(events: IntervalsEvent[]): Promise<{ success: boolean; deleted: number }> {
        if (!events.length) return { success: true, deleted: 0 };

        const athleteId = this.getAthleteId();
        let deleted = 0;

        for (const event of events) {
            if (!event.id) continue;
            try {
                await this.request(`/athlete/${athleteId}/events/${event.id}`, {
                    method: 'DELETE',
                });
                deleted++;
            } catch (e) {
                console.warn(`Failed to delete event ${event.id}:`, e);
            }
        }

        return { success: true, deleted };
    }

    // =========================================================================
    // ACTIVITIES
    // =========================================================================

    /**
     * Fetch activities for a date range
     */
    async getActivities(oldest: string, newest: string): Promise<IntervalsActivity[]> {
        const athleteId = this.getAthleteId();
        return this.request<IntervalsActivity[]>(
            `/athlete/${athleteId}/activities?oldest=${oldest}&newest=${newest}`
        );
    }

    // =========================================================================
    // WELLNESS
    // =========================================================================

    /**
     * Fetch wellness data for a date range
     */
    async getWellness(oldest: string, newest: string): Promise<IntervalsWellness[]> {
        const athleteId = this.getAthleteId();
        return this.request<IntervalsWellness[]>(
            `/athlete/${athleteId}/wellness?oldest=${oldest}&newest=${newest}`
        );
    }

    // =========================================================================
    // UTILITY
    // =========================================================================

    /**
     * Find the WeightTraining sport settings ID
     */
    async getStrengthSportId(): Promise<number | null> {
        try {
            const athlete = await this.getAthlete();
            const setting = athlete.sport_settings?.find(s =>
                s.types?.includes('WeightTraining')
            );
            return setting?.id ?? null;
        } catch {
            return null;
        }
    }
}

// Export singleton instance
export const intervalsClient = new IntervalsClient();

// Export class for testing
export { IntervalsClient };
