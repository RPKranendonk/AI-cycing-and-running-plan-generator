// ============================================================================
// ZONE SERVICE
// Single source of truth for pace zones (Friel 7-zone model)
// Ported from: _LEGACY_VANILLA/js/core/zone-service.js
// ============================================================================

import type { TrainingZone, ZoneSet } from '@/types';

// ============================================================================
// FRIEL 7-ZONE MODEL
// ============================================================================

export const FRIEL_ZONE_MODEL: TrainingZone[] = [
    { name: 'Recovery', minPercent: 0, maxPercent: 80, description: 'Warmup, cooldown, recovery jogs', color: 'hsl(var(--zone-1))' },
    { name: 'Endurance', minPercent: 80, maxPercent: 90, description: 'Easy runs, long runs', color: 'hsl(var(--zone-2))' },
    { name: 'Tempo', minPercent: 90, maxPercent: 95, description: 'Marathon pace, concentrated effort', color: 'hsl(var(--zone-3))' },
    { name: 'Sub-Threshold', minPercent: 95, maxPercent: 100, description: 'Half marathon pace', color: 'hsl(var(--zone-4))' },
    { name: 'Threshold', minPercent: 100, maxPercent: 102, description: '10K pace, the redline', color: 'hsl(var(--zone-5))' },
    { name: 'VO2 Max', minPercent: 102, maxPercent: 106, description: '5K pace, gasping for air', color: 'hsl(var(--zone-5))' },
    { name: 'Anaerobic', minPercent: 106, maxPercent: 130, description: 'Strides, sprints, final kicks', color: 'hsl(var(--zone-5))' },
];

// Zone IDs for lookup
export const ZONE_IDS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5a', 'Z5b', 'Z5c'] as const;
export type ZoneId = typeof ZONE_IDS[number];

// ============================================================================
// WORKOUT PACE RANGES (simplified)
// ============================================================================

export const PACE_RANGES = {
    RECOVERY: { minPct: 0.65, maxPct: 0.80, description: '65-80% of LT' },
    EASY: { minPct: 0.80, maxPct: 0.88, description: '80-88% of LT' },
    TEMPO: { minPct: 0.88, maxPct: 0.95, description: '88-95% of LT' },
    THRESHOLD: { minPct: 0.95, maxPct: 1.00, description: '95-100% of LT' },
    VO2_MAX: { minPct: 1.05, maxPct: 1.20, description: '105-120% of LT' },
    STRIDES: { minPct: 1.25, maxPct: 1.35, description: '125-135% of LT' },
} as const;

export type PaceRangeType = keyof typeof PACE_RANGES;

// ============================================================================
// ZONE CALCULATION
// ============================================================================

export interface CalculatedZone {
    id: ZoneId;
    name: string;
    minPct: number;
    maxPct: number;
    purpose: string;
    paceSecPerKm: number;
    minPaceSecKm: number | null;
    maxPaceSecKm: number | null;
    paceMps: number;
    paceMultiplier: number;
}

export interface ZoneState {
    ltPaceSecPerKm: number;
    ltPaceMps: number;
    zones: CalculatedZone[];
    model: 'friel-7' | 'intervals-icu';
    lastUpdated: string;
}

/**
 * Calculate all zone paces from LT pace
 */
export function calculateZonesFromLT(ltPaceSecPerKm: number): ZoneState | null {
    if (!ltPaceSecPerKm || ltPaceSecPerKm <= 0) {
        console.warn('[ZoneService] Invalid LT pace:', ltPaceSecPerKm);
        return null;
    }

    const ltPaceMps = 1000 / ltPaceSecPerKm;

    const zones: CalculatedZone[] = FRIEL_ZONE_MODEL.map((z, i) => {
        const centerPct = (z.minPercent + z.maxPercent) / 2;
        const effectiveCenterPct = z.minPercent === 0 ? 75 : centerPct;

        const centerPaceSecKm = ltPaceSecPerKm / (effectiveCenterPct / 100);
        const minPaceSecKm = z.maxPercent >= 130 ? null : ltPaceSecPerKm / (z.maxPercent / 100);
        const maxPaceSecKm = z.minPercent === 0 ? null : ltPaceSecPerKm / (z.minPercent / 100);

        return {
            id: ZONE_IDS[i],
            name: z.name,
            minPct: z.minPercent,
            maxPct: z.maxPercent,
            purpose: z.description,
            paceSecPerKm: Math.round(centerPaceSecKm),
            minPaceSecKm: minPaceSecKm ? Math.round(minPaceSecKm) : null,
            maxPaceSecKm: maxPaceSecKm ? Math.round(maxPaceSecKm) : null,
            paceMps: 1000 / centerPaceSecKm,
            paceMultiplier: ltPaceSecPerKm / centerPaceSecKm,
        };
    });

    return {
        ltPaceSecPerKm,
        ltPaceMps,
        zones,
        model: 'friel-7',
        lastUpdated: new Date().toISOString(),
    };
}

/**
 * Get pace for a specific zone
 */
export function getZonePace(zoneState: ZoneState, zoneId: string): number {
    const zoneAliases: Record<string, ZoneId> = {
        'Z5': 'Z5a',
        'Z6': 'Z5b',
        'Z7': 'Z5c',
        'Z5A': 'Z5a',
        'Z5B': 'Z5b',
        'Z5C': 'Z5c',
    };

    const normalizedZoneId = (zoneAliases[zoneId] || zoneId) as ZoneId;
    const zone = zoneState.zones.find(z => z.id === normalizedZoneId);

    if (!zone) {
        console.warn('[ZoneService] Unknown zone:', zoneId);
        return zoneState.ltPaceSecPerKm;
    }

    return zone.paceSecPerKm;
}

/**
 * Get zone pace multiplier
 */
export function getZoneMultiplier(zoneState: ZoneState, zoneId: string): number {
    const zoneAliases: Record<string, ZoneId> = {
        'Z5': 'Z5a',
        'Z6': 'Z5b',
        'Z7': 'Z5c',
    };

    const normalizedZoneId = (zoneAliases[zoneId] || zoneId) as ZoneId;
    const zone = zoneState.zones.find(z => z.id === normalizedZoneId);

    return zone?.paceMultiplier ?? 1.0;
}

/**
 * Get workout pace range for a specific workout type
 */
export function getWorkoutPaceRange(
    ltPaceSeconds: number,
    typeKey: PaceRangeType
): { minPace: string; maxPace: string; description: string; raw?: { slow: number; fast: number } } {
    if (!ltPaceSeconds || ltPaceSeconds <= 0) {
        return { minPace: '--:--', maxPace: '--:--', description: 'Invalid LT Pace' };
    }

    const typeConfig = PACE_RANGES[typeKey];
    if (!typeConfig) {
        console.warn(`[ZoneService] Unknown workout type key: ${typeKey}`);
        return { minPace: '--:--', maxPace: '--:--', description: 'Unknown Type' };
    }

    const slowPaceSeconds = Math.floor(ltPaceSeconds / typeConfig.minPct);
    const fastPaceSeconds = Math.floor(ltPaceSeconds / typeConfig.maxPct);

    return {
        minPace: formatPaceMMSS(slowPaceSeconds),
        maxPace: formatPaceMMSS(fastPaceSeconds),
        description: typeConfig.description,
        raw: { slow: slowPaceSeconds, fast: fastPaceSeconds },
    };
}

/**
 * Format pace in MM:SS
 */
export function formatPaceMMSS(secPerKm: number): string {
    if (!secPerKm || secPerKm <= 0) return '--:--';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.round(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse MM:SS pace string to seconds
 */
export function parsePaceToSeconds(pace: string): number {
    const [mins, secs] = pace.split(':').map(Number);
    return mins * 60 + (secs || 0);
}

/**
 * Create ZoneSet from LT pace for display
 */
export function createZoneSet(ltPaceSecPerKm: number): ZoneSet {
    const zoneState = calculateZonesFromLT(ltPaceSecPerKm);

    if (!zoneState) {
        return {
            frielZones: FRIEL_ZONE_MODEL,
            scientificZones: [],
        };
    }

    // Create pace zones record
    const paceZones: Record<string, { min: number; max: number }> = {};
    zoneState.zones.forEach(z => {
        paceZones[z.id] = {
            min: z.minPaceSecKm ?? ltPaceSecPerKm * 1.5,
            max: z.maxPaceSecKm ?? ltPaceSecPerKm * 0.7,
        };
    });

    // Scientific 3-zone model (simplified)
    const scientificZones: TrainingZone[] = [
        { name: 'Zone 1 (Easy)', minPercent: 0, maxPercent: 82, description: 'Below VT1', color: 'hsl(var(--zone-1))' },
        { name: 'Zone 2 (Moderate)', minPercent: 82, maxPercent: 100, description: 'Between VT1 and VT2', color: 'hsl(var(--zone-3))' },
        { name: 'Zone 3 (Hard)', minPercent: 100, maxPercent: 130, description: 'Above VT2', color: 'hsl(var(--zone-5))' },
    ];

    return {
        frielZones: FRIEL_ZONE_MODEL,
        scientificZones,
        paceZones,
    };
}
