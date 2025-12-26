// ==========================================
// READINESS SETTINGS
// User preferences for readiness system
// ==========================================

/**
 * Readiness Modes
 * ADVISORY: Show suggestions, never block (default)
 * MODERATE: Suggest strongly, nudge toward compliance
 * STRICT: Gate progression on compliance thresholds
 */
const READINESS_MODES = {
    ADVISORY: 'advisory',
    MODERATE: 'moderate',
    STRICT: 'strict'
};

/**
 * Default settings
 */
const DEFAULT_READINESS_SETTINGS = {
    mode: READINESS_MODES.ADVISORY,
    showComplianceWarnings: true,
    autoApplySuggestions: false,
    dismissedSuggestions: [],      // Array of suggestion IDs user has dismissed
    dismissedCategories: [],       // Categories user doesn't want to see
    lastUpdated: null
};

/**
 * Get current readiness settings from localStorage
 * @returns {Object} Settings object
 */
function getReadinessSettings() {
    try {
        const stored = localStorage.getItem('readiness_settings');
        if (stored) {
            return { ...DEFAULT_READINESS_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('[ReadinessSettings] Parse error, using defaults');
    }
    return { ...DEFAULT_READINESS_SETTINGS };
}

/**
 * Save readiness settings
 * @param {Object} settings - Settings to save
 */
function saveReadinessSettings(settings) {
    const updated = {
        ...getReadinessSettings(),
        ...settings,
        lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('readiness_settings', JSON.stringify(updated));
    console.log('[ReadinessSettings] Saved:', updated);
    return updated;
}

/**
 * Get current mode
 * @returns {string} Current mode
 */
function getReadinessMode() {
    return getReadinessSettings().mode;
}

/**
 * Set readiness mode
 * @param {string} mode - One of READINESS_MODES values
 */
function setReadinessMode(mode) {
    if (!Object.values(READINESS_MODES).includes(mode)) {
        console.warn('[ReadinessSettings] Invalid mode:', mode);
        return;
    }
    saveReadinessSettings({ mode });
}

/**
 * Dismiss a specific suggestion (by ID)
 * @param {string} suggestionId - Suggestion ID to dismiss
 */
function dismissSuggestion(suggestionId) {
    const settings = getReadinessSettings();
    if (!settings.dismissedSuggestions.includes(suggestionId)) {
        settings.dismissedSuggestions.push(suggestionId);
        saveReadinessSettings(settings);
    }
}

/**
 * Dismiss an entire category of suggestions
 * @param {string} category - Category to dismiss
 */
function dismissCategory(category) {
    const settings = getReadinessSettings();
    if (!settings.dismissedCategories.includes(category)) {
        settings.dismissedCategories.push(category);
        saveReadinessSettings(settings);
    }
}

/**
 * Reset all dismissals
 */
function resetDismissals() {
    saveReadinessSettings({
        dismissedSuggestions: [],
        dismissedCategories: []
    });
}

/**
 * Check if a suggestion is dismissed
 * @param {string} suggestionId - Suggestion ID
 * @param {string} category - Suggestion category
 * @returns {boolean} True if dismissed
 */
function isSuggestionDismissed(suggestionId, category) {
    const settings = getReadinessSettings();
    return settings.dismissedSuggestions.includes(suggestionId) ||
        settings.dismissedCategories.includes(category);
}

// Expose to window
window.READINESS_MODES = READINESS_MODES;
window.getReadinessSettings = getReadinessSettings;
window.saveReadinessSettings = saveReadinessSettings;
window.getReadinessMode = getReadinessMode;
window.setReadinessMode = setReadinessMode;
window.dismissSuggestion = dismissSuggestion;
window.dismissCategory = dismissCategory;
window.resetDismissals = resetDismissals;
window.isSuggestionDismissed = isSuggestionDismissed;

console.log('[ReadinessSettings] Loaded - Mode:', getReadinessMode());
