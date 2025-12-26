// ==========================================
// ONBOARDING FEATURE - BARREL EXPORT
// Re-exports all onboarding wizard services
// ==========================================

/**
 * Onboarding Feature Module
 * 
 * This module provides the Apple-like stepped onboarding flow.
 * It extracts logic from quick-setup-wizard.js into modular services.
 * 
 * Services:
 * - wizard-state.js         : State, constants, and navigation
 * - step-renderer.js        : UI rendering for all wizard steps
 * - onboarding-logic.js     : Helpers for sport/goal/volume/paces
 * - connection-finalizer.js : API testing and plan generation
 * 
 * All functions are exposed to window.* for backwards compatibility.
 */

(function () {
    console.log('[Onboarding] Feature module loaded');

    // Verify key exports
    const requiredExports = [
        'openWizard',
        'wizardNext',
        'wizardBack',
        'applyWizardSettingsAndGenerate',
        'testWizardConnection',
        'wizardFiveKInput'
    ];


    const missingExports = requiredExports.filter(name => typeof window[name] === 'undefined');
    if (missingExports.length > 0) {
        console.warn('[Onboarding] Missing exports:', missingExports);
    } else {
        console.log('[Onboarding] All exports verified ✓');
    }

    // Export namespace
    window.Onboarding = {
        State: window.OnboardingState,
        StepRenderer: window.StepRenderer,
        Helpers: window.OnboardingHelpers,
        Finalizer: window.OnboardingFinalizer
    };
})();
