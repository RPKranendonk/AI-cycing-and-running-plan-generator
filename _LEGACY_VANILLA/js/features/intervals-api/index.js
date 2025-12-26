// ==========================================
// INTERVALS API FEATURE - BARREL EXPORT
// Re-exports all intervals-api services
// ==========================================

/**
 * Intervals API Feature Module
 * 
 * This module provides the core logic for communicating with Intervals.icu.
 * It replaces the monolithic intervals-service.js with focused service modules.
 * 
 * Services:
 * - api-client.js        : Core HTTP communication and auth
 * - workout-uploader.js  : Pushing and deleting workouts
 * - fitness-fetcher.js   : Fetching athlete fitness (CTL/ATL) and weight
 * - zones-fetcher.js     : Fetching and calculating training zones
 * - targets-service.js   : Pushing weekly target distance/TSS
 * - step-formatter.js    : Formatting structured workouts into ICU step syntax
 * 
 * All functions are exposed to window.* for backwards compatibility.
 */

(function () {
    console.log('[IntervalsAPI] Feature module loaded');

    // Verify all services are loaded
    const requiredExports = [
        'pushToIntervalsICU',
        'fetchAthleteSettings',
        'formatStepsForIntervals'
    ];


    const missingExports = requiredExports.filter(name => typeof window[name] === 'undefined');
    if (missingExports.length > 0) {
        console.warn('[IntervalsAPI] Missing exports:', missingExports);
    } else {
        console.log('[IntervalsAPI] All exports verified ✓');
    }

    // Export namespace object
    window.IntervalsAPI = {
        Client: window.IntervalsClient,
        Uploader: window.WorkoutUploader,
        Fitness: window.FitnessFetcher,
        Formatter: window.StepFormatter
    };
})();
