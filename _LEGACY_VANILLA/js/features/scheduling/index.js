// ==========================================
// SCHEDULING FEATURE - BARREL EXPORT
// Re-exports all scheduling services
// ==========================================

/**
 * Scheduling Feature Module
 * 
 * This module provides the rule-based calculation engine.
 * It replaces the monolithic smart-scheduler.js with focused services.
 * 
 * Services:
 * - progression-engine.js : Calculates volume and ramp rates
 * - frequency-optimizer.js: Distributes hard/easy workouts across the week
 * - volume-distributor.js : Fills easy days to hit volume targets
 * - template-generator.js  : Main orchestrator for weekly plan generation
 * - wizard-helpers.js     : Helpers used by the onboarding wizard
 * 
 * All functions are exposed to window.* for backwards compatibility.
 */

(function () {
    console.log('[Scheduling] Feature module loaded');

    // Verify all services are loaded
    const requiredExports = [
        'generateWeeklyTemplate',
        'calculateProgression',
        'optimizeFrequency',
        'redistributeVolume',
        'fillEasyRuns',
        'distributeOverflow'
    ];


    const missingExports = requiredExports.filter(name => typeof window[name] === 'undefined');
    if (missingExports.length > 0) {
        console.warn('[Scheduling] Missing exports:', missingExports);
    } else {
        console.log('[Scheduling] All exports verified ✓');
    }

    // Export namespace object
    window.Scheduling = {
        Progression: window.ProgressionEngine,
        Frequency: window.FrequencyOptimizer,
        Volume: window.VolumeDistributor,
        Template: window.TemplateGenerator,
        Wizard: window.WizardHelpers
    };
})();
