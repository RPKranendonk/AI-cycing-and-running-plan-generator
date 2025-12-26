// ==========================================
// WEEKLY PLAN FEATURE - BARREL EXPORT
// Re-exports all weekly-plan services
// ==========================================

/**
 * Weekly Plan Feature Module
 * 
 * This module provides the logic for the per-week training cards.
 * It extracts logic from the monolithic weekly-ui.js into modular services.
 * 
 * Services:
 * - workout-builder.js     : Logic for building workout strings and durations
 * - drag-handlers.js       : Drag and drop handlers for day swapping
 * - availability-editor.js : Per-week availability sliders and AM/PM logic
 * - week-actions.js        : Week and block-level actions (push, reset, delete)
 * 
 * All functions are exposed to window.* for backwards compatibility.
 */

(function () {
    console.log('[WeeklyPlan] Feature module loaded');

    // Verify all services are loaded
    const requiredExports = [
        'buildWorkoutDescription',
        'handleWorkoutDrop',
        'openWeekAvailabilityEditor',
        'pushBlockWorkouts'
    ];

    const missingExports = requiredExports.filter(name => typeof window[name] === 'undefined');
    if (missingExports.length > 0) {
        console.warn('[WeeklyPlan] Missing exports:', missingExports);
    } else {
        console.log('[WeeklyPlan] All exports verified ✓');
    }

    // Export namespace object
    window.WeeklyPlan = {
        Workouts: window.WorkoutBuilder,
        Drag: window.DragHandlers,
        Availability: window.AvailabilityEditor,
        Actions: window.WeekActions
    };
})();
