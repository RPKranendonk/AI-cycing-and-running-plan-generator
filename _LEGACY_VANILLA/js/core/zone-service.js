/**
 * @file zone-service.js
 * @description Single source of truth for pace zones calculations (Friel 7-zone model).
 * @usedBy js/weekly-ui.js, js/features/intervals-api/services/step-formatter.js
 * @responsibilities
 * - Calculates pace zones from Lactate Threshold (LT)
 * - Stores zones in private module state (avoids window.state wipes)
 * - Provides helper methods like getZonePace() and getWorkoutPaceRange()
 * @why Centralized to ensure consistent pace calculations across the app and API.
 */

// ============================================================================
// ZONE SERVICE - Single Source of Truth for Pace Zones
// ============================================================================
// 
// This is THE canonical source for all pace zone calculations.
// All other scripts MUST read zones from window.state.zones, not define their own.
//
// Data Flow:
// 1. User enters 5K time → ThresholdEstimator → LT Pace
//    OR: User imports zones from Intervals.icu
// 2. ZoneService.calculateZonesFromLT(ltPace) → window.state.zones
// 3. All scripts call window.getZonePace('Z2') to get pace for that zone
//
// ============================================================================

/**
 * Friel 7-Zone Model (percentages only)
 * These are the CANONICAL zone boundaries as percentages of LT pace.
 * 
 * IMPORTANT: This is the only place zone percentages should be defined.
 * All other files must read calculated paces from window.state.zones
 */
const FRIEL_ZONE_MODEL = [
    { id: 'Z1', name: 'Recovery', minPct: 0, maxPct: 80, purpose: 'Warmup, cooldown, recovery jogs' },
    { id: 'Z2', name: 'Endurance', minPct: 80, maxPct: 90, purpose: 'Easy runs, long runs' },
    { id: 'Z3', name: 'Tempo', minPct: 90, maxPct: 95, purpose: 'Marathon pace, concentrated effort' },
    { id: 'Z4', name: 'Sub-Threshold', minPct: 95, maxPct: 100, purpose: 'Cruising speed, half marathon pace' },
    { id: 'Z5a', name: 'Threshold', minPct: 100, maxPct: 102, purpose: '10K pace, the redline' },
    { id: 'Z5b', name: 'VO2 Max', minPct: 102, maxPct: 106, purpose: '5K pace, gasping for air' },
    { id: 'Z5c', name: 'Anaerobic', minPct: 106, maxPct: 130, purpose: 'Strides, sprints, final kicks' }
];

/**
 * MODIFIED FRIEL / PURPOSE-BASED WORKOUT TYPES
 * Decouples "Workout Types" from strict zone labels to use "Biological Reality"
 * for easy runs while keeping "Strict Math" for hard workouts.
 */
const PACE_RANGES = {
    'RECOVERY': { minPct: 0.65, maxPct: 0.80, description: '65-80% of LT' },
    'EASY': { minPct: 0.80, maxPct: 0.88, description: '80-88% of LT' },
    'TEMPO': { minPct: 0.88, maxPct: 0.95, description: '88-95% of LT' },
    'THRESHOLD': { minPct: 0.95, maxPct: 1.00, description: '95-100% of LT' },
    'VO2_MAX': { minPct: 1.05, maxPct: 1.20, description: '105-120% of LT' },
    'STRIDES': { minPct: 1.25, maxPct: 1.35, description: '125-135% of LT' }
};

/**
 * Calculate target pace range for a specific workout type
 * 
 * Formula: TargetPace = LT_Pace / Intensity_Multiplier
 * (Higher intensity multiplier = Lower pace number = Faster)
 * 
 * @param {number} ltPaceSeconds - User's Threshold Pace in seconds per km
 * @param {string} typeKey - Key from PACE_RANGES (e.g., 'EASY', 'TEMPO')
 * @returns {Object} { minPace: "MM:SS", maxPace: "MM:SS", description: string }
 */
function getWorkoutPaceRange(ltPaceSeconds, typeKey) {
    if (!ltPaceSeconds || ltPaceSeconds <= 0) {
        return { minPace: '--:--', maxPace: '--:--', description: 'Invalid LT Pace' };
    }

    const typeConfig = PACE_RANGES[typeKey.toUpperCase()];
    if (!typeConfig) {
        console.warn(`[ZoneService] Unknown workout type key: ${typeKey}`);
        return { minPace: '--:--', maxPace: '--:--', description: 'Unknown Type' };
    }

    // Calculate Paces (Seconds per km)
    // "Slow Limit" corresponds to minPct (smaller multiplier -> larger seconds -> slower)
    // "Fast Limit" corresponds to maxPct (larger multiplier -> smaller seconds -> faster)
    // Use Math.floor to align with "Modified Friel" requirements (e.g. 287.5s -> 287s)
    const slowPaceSeconds = Math.floor(ltPaceSeconds / typeConfig.minPct);
    const fastPaceSeconds = Math.floor(ltPaceSeconds / typeConfig.maxPct);

    return {
        minPace: formatPaceMMSS(slowPaceSeconds), // Slower pace (larger number)
        maxPace: formatPaceMMSS(fastPaceSeconds), // Faster pace (smaller number)
        description: typeConfig.description,
        raw: {
            slow: slowPaceSeconds,
            fast: fastPaceSeconds
        }
    };
}

/**
 * PRIVATE ZONE STORAGE - Cannot be wiped by window.state reassignment
 * This is the authoritative source for zone data.
 */
let _zoneStorage = null;

/**
 * Calculate all zone paces from LT pace
 * @param {number} ltPaceSecPerKm - Lactate Threshold pace in seconds per km
 * @returns {Object} Zone state object with all calculated paces
 */
function calculateZonesFromLT(ltPaceSecPerKm) {
    if (!ltPaceSecPerKm || ltPaceSecPerKm <= 0) {
        console.warn('[ZoneService] Invalid LT pace:', ltPaceSecPerKm);
        return null;
    }

    const ltPaceMps = 1000 / ltPaceSecPerKm;

    // Calculate pace for each zone
    // Higher % = faster = lower sec/km
    // Zone pace = LT pace / (pct / 100)
    const zones = FRIEL_ZONE_MODEL.map(z => {
        // Use center of zone for calculation
        const centerPct = (z.minPct + z.maxPct) / 2;
        // For Z1 (0-80%), use 75% as center
        const effectiveCenterPct = z.minPct === 0 ? 75 : centerPct;

        // Calculate paces at boundaries and center
        const centerPaceSecKm = ltPaceSecPerKm / (effectiveCenterPct / 100);
        const minPaceSecKm = z.maxPct >= 130 ? null : ltPaceSecPerKm / (z.maxPct / 100); // Fastest pace (at max %)
        const maxPaceSecKm = z.minPct === 0 ? null : ltPaceSecPerKm / (z.minPct / 100); // Slowest pace (at min %)

        return {
            id: z.id,
            name: z.name,
            minPct: z.minPct,
            maxPct: z.maxPct,
            purpose: z.purpose,
            // Pace in sec/km (used by most calculations)
            paceSecPerKm: Math.round(centerPaceSecKm),
            minPaceSecKm: minPaceSecKm ? Math.round(minPaceSecKm) : null,
            maxPaceSecKm: maxPaceSecKm ? Math.round(maxPaceSecKm) : null,
            // Pace in m/s (used by Intervals.icu API)
            paceMps: 1000 / centerPaceSecKm,
            // Pace multiplier relative to LT (for distance calculations)
            paceMultiplier: ltPaceSecPerKm / centerPaceSecKm
        };
    });

    const zoneState = {
        ltPaceSecPerKm: ltPaceSecPerKm,
        ltPaceMps: ltPaceMps,
        zones: zones,
        model: 'friel-7',
        lastUpdated: new Date().toISOString()
    };

    // CRITICAL: Store in PRIVATE module storage (survives window.state reassignment)
    _zoneStorage = zoneState;

    // Also store in global state for backwards compatibility
    if (!window.state) window.state = {};
    window.state.zones = zoneState;

    // Also set the flat thresholdPaceSecPerKm for backwards compatibility
    window.state.thresholdPaceSecPerKm = ltPaceSecPerKm;

    console.log('[ZoneService] Zones calculated from LT:', formatPaceMMSS(ltPaceSecPerKm), '/km');
    console.log('[ZoneService] Zone state:', zoneState);

    return zoneState;
}

/**
 * Import zones from Intervals.icu
 * @param {number} ltPaceMps - LT pace in m/s from Intervals.icu
 * @param {Array} paceZonesPct - Array of zone boundary percentages
 * @param {Array} paceZoneNames - Array of zone names (optional)
 */
function importZonesFromIntervals(ltPaceMps, paceZonesPct, paceZoneNames = null) {
    const ltPaceSecPerKm = 1000 / ltPaceMps;

    // Build zones from Intervals.icu data
    const zones = paceZonesPct.map((maxPct, i) => {
        const minPct = i === 0 ? 0 : paceZonesPct[i - 1];
        const centerPct = (minPct + maxPct) / 2;
        const effectiveCenterPct = minPct === 0 ? 75 : centerPct;

        const centerPaceSecKm = ltPaceSecPerKm / (effectiveCenterPct / 100);
        const minPaceSecKm = maxPct >= 999 ? null : ltPaceSecPerKm / (maxPct / 100);
        const maxPaceSecKm = minPct === 0 ? null : ltPaceSecPerKm / (minPct / 100);

        // Map to Friel names if we have 7 zones
        const defaultNames = ['Recovery', 'Endurance', 'Tempo', 'Sub-Threshold', 'Threshold', 'VO2 Max', 'Anaerobic'];
        const name = paceZoneNames?.[i] || defaultNames[i] || `Zone ${i + 1}`;

        return {
            id: `Z${i + 1}`,
            name: name,
            minPct: minPct,
            maxPct: maxPct >= 999 ? 130 : maxPct,
            purpose: '',
            paceSecPerKm: Math.round(centerPaceSecKm),
            minPaceSecKm: minPaceSecKm ? Math.round(minPaceSecKm) : null,
            maxPaceSecKm: maxPaceSecKm ? Math.round(maxPaceSecKm) : null,
            paceMps: 1000 / centerPaceSecKm,
            paceMultiplier: ltPaceSecPerKm / centerPaceSecKm
        };
    });

    const zoneState = {
        ltPaceSecPerKm: ltPaceSecPerKm,
        ltPaceMps: ltPaceMps,
        zones: zones,
        model: 'intervals-icu',
        lastUpdated: new Date().toISOString()
    };

    // Store in global state
    if (!window.state) window.state = {};
    window.state.zones = zoneState;
    window.state.thresholdPaceSecPerKm = ltPaceSecPerKm;

    console.log('[ZoneService] Zones imported from Intervals.icu');
    return zoneState;
}

/**
 * Get pace for a specific zone (in sec/km)
 * @param {string} zoneId - Zone ID (Z1, Z2, Z3, Z4, Z5/Z5a, Z6/Z5b, Z7/Z5c)
 * @returns {number} Pace in seconds per km
 */
function getZonePace(zoneId) {
    // Read from PRIVATE storage first (survives window.state reassignment)
    // Fall back to window.state.zones only if private storage is empty
    let zoneData = _zoneStorage || window.state?.zones;

    // Auto-reinitialize zones if they're missing (self-healing)
    if (!zoneData?.zones || zoneData.zones.length === 0) {
        // Try to get LT pace from localStorage first
        const savedLT = localStorage.getItem('elite_thresholdPace');
        const ltPace = savedLT ? parseFloat(savedLT) : 300;
        console.log('[ZoneService] Auto-reinitializing zones with LT:', ltPace);
        calculateZonesFromLT(ltPace);
        zoneData = _zoneStorage;
    }

    // Handle zone aliases for compatibility with different zone naming conventions
    // Some code uses Z5/Z6/Z7, our model uses Z5a/Z5b/Z5c
    const zoneAliases = {
        'Z5': 'Z5a',   // Threshold
        'Z6': 'Z5b',   // VO2max
        'Z7': 'Z5c',   // Anaerobic
        'Z5A': 'Z5a',
        'Z5B': 'Z5b',
        'Z5C': 'Z5c'
    };
    const normalizedZoneId = zoneAliases[zoneId] || zoneId;

    const zone = zoneData.zones.find(z => z.id === normalizedZoneId);
    if (!zone) {
        console.warn('[ZoneService] Unknown zone:', zoneId, '- using LT pace');
        return zoneData.ltPaceSecPerKm;
    }

    return zone.paceSecPerKm;
}

/**
 * Get zone pace multiplier (relative to LT)
 * @param {string} zoneId - Zone ID
 * @returns {number} Multiplier (e.g., 1.25 for Z1 means 25% slower than LT)
 */
function getZoneMultiplier(zoneId) {
    // Read from PRIVATE storage first
    let zoneData = _zoneStorage || window.state?.zones;

    // Auto-reinitialize if needed
    if (!zoneData?.zones || zoneData.zones.length === 0) {
        const savedLT = localStorage.getItem('elite_thresholdPace');
        const ltPace = savedLT ? parseFloat(savedLT) : 300;
        calculateZonesFromLT(ltPace);
        zoneData = _zoneStorage;
    }

    // Zone aliases
    const zoneAliases = { 'Z5': 'Z5a', 'Z6': 'Z5b', 'Z7': 'Z5c' };
    const normalizedZoneId = zoneAliases[zoneId] || zoneId;

    const zone = zoneData.zones.find(z => z.id === normalizedZoneId);
    return zone ? zone.paceMultiplier : 1.0;
}

/**
 * Get LT pace (convenience function)
 * @returns {number} LT pace in sec/km
 */
function getLTPace() {
    // Read from private storage first, then window.state, then localStorage
    if (_zoneStorage?.ltPaceSecPerKm) {
        return _zoneStorage.ltPaceSecPerKm;
    }
    if (window.state?.zones?.ltPaceSecPerKm) {
        return window.state.zones.ltPaceSecPerKm;
    }
    if (window.state?.thresholdPaceSecPerKm) {
        return window.state.thresholdPaceSecPerKm;
    }
    // Last resort: localStorage
    const saved = localStorage.getItem('elite_thresholdPace');
    return saved ? parseFloat(saved) : 300;
}

/**
 * Get all zones for display
 * @returns {Array} Array of zone objects
 */
function getAllZones() {
    return window.state?.zones?.zones || [];
}

/**
 * Check if zones are initialized
 * @returns {boolean}
 */
function hasZones() {
    return !!(window.state?.zones?.zones?.length > 0);
}

/**
 * Format pace in MM:SS
 * @param {number} secPerKm
 * @returns {string}
 */
function formatPaceMMSS(secPerKm) {
    if (!secPerKm || secPerKm <= 0) return '--:--';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.round(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Initialize from localStorage or window.state if available
 * Tries multiple sources for the LT pace value
 */
function initZoneService() {
    // Try multiple sources for LT pace
    let ltPace = null;

    // 1. Try localStorage (primary)
    const savedLT = localStorage.getItem('elite_thresholdPace');
    if (savedLT) {
        ltPace = parseFloat(savedLT);
    }

    // 2. Fallback to window.state.thresholdPaceSecPerKm
    if (!ltPace && window.state?.thresholdPaceSecPerKm) {
        ltPace = window.state.thresholdPaceSecPerKm;
    }

    // 3. Fallback to window.state.lthrPace
    if (!ltPace && window.state?.lthrPace) {
        ltPace = window.state.lthrPace;
    }

    // 4. Default to 300s (5:00/km) if no LT pace found
    if (!ltPace || ltPace <= 0) {
        ltPace = 300;
        console.log('[ZoneService] Using default LT pace: 300s (5:00/km)');
    }

    // Initialize zones
    calculateZonesFromLT(ltPace);
    console.log('[ZoneService] Initialized zones from LT pace:', ltPace, 'sec/km');
}

// CRITICAL: Initialize zones IMMEDIATELY with default so they're always available
// This runs synchronously when the script loads, before any workout generation
calculateZonesFromLT(300); // Default 5:00/km - will be overwritten if user has saved pace
console.log('[ZoneService] Pre-initialized with default 300s (5:00/km)');

// Then try to get actual user pace when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initZoneService);
} else {
    initZoneService();
}

// Expose to window
window.ZoneService = {
    FRIEL_ZONE_MODEL,
    PACE_RANGES,
    calculateZonesFromLT,
    importZonesFromIntervals,
    getZonePace,
    getZoneMultiplier,
    getLTPace,
    getAllZones,
    hasZones,
    formatPaceMMSS,
    getWorkoutPaceRange
};

// Convenience functions on window for easy access
window.getZonePace = getZonePace;
window.getZoneMultiplier = getZoneMultiplier;
window.getLTPace = getLTPace;
window.getWorkoutPaceRange = getWorkoutPaceRange;

console.log('[ZoneService] Module loaded - Source of truth for pace zones');
