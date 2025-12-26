// ==========================================
// NOTIFICATION SETTINGS
// User preferences for push notifications
// Opt-in only - user controls everything
// ==========================================

/**
 * Notification Types
 */
const NOTIFICATION_TYPES = {
    WEEKLY_CHECKIN: 'weekly_checkin',
    READINESS_ALERT: 'readiness_alert',
    RECOVERY_REMINDER: 'recovery_reminder',
    MILESTONE: 'milestone'
};

/**
 * Notification type descriptions (for UI)
 */
const NOTIFICATION_DESCRIPTIONS = {
    weekly_checkin: {
        title: 'Weekly Check-in',
        description: 'Reminder to log your weekly feedback every Monday',
        icon: '📋',
        defaultEnabled: true
    },
    readiness_alert: {
        title: 'Readiness Alert',
        description: 'Alert when your readiness drops to RED status',
        icon: '🚨',
        defaultEnabled: true
    },
    recovery_reminder: {
        title: 'Recovery Reminder',
        description: 'Gentle nudge after 3+ days of low compliance',
        icon: '💤',
        defaultEnabled: false
    },
    milestone: {
        title: 'Milestone Celebration',
        description: 'Celebrate when you complete a week or training block',
        icon: '🎉',
        defaultEnabled: true
    }
};

/**
 * Default settings - notifications OFF by default
 */
const DEFAULT_NOTIFICATION_SETTINGS = {
    enabled: false,           // Master switch - off by default
    permission: 'default',    // 'default', 'granted', 'denied'
    types: {
        weekly_checkin: true,
        readiness_alert: true,
        recovery_reminder: false,
        milestone: true
    },
    quietHours: {
        enabled: true,
        start: 22,            // 10 PM
        end: 7                // 7 AM
    },
    lastPromptDate: null,     // When user was last asked
    neverAsk: false           // User said "never"
};

/**
 * Get current notification settings
 * @returns {Object} Settings object
 */
function getNotificationSettings() {
    try {
        const stored = localStorage.getItem('notification_settings');
        if (stored) {
            return { ...DEFAULT_NOTIFICATION_SETTINGS, ...JSON.parse(stored) };
        }
    } catch (e) {
        console.warn('[Notifications] Parse error, using defaults');
    }
    return { ...DEFAULT_NOTIFICATION_SETTINGS };
}

/**
 * Save notification settings
 * @param {Object} settings - Settings to save
 */
function saveNotificationSettings(settings) {
    const updated = {
        ...getNotificationSettings(),
        ...settings
    };
    localStorage.setItem('notification_settings', JSON.stringify(updated));
    console.log('[Notifications] Settings saved:', updated);
    return updated;
}

/**
 * Check if notifications are enabled (master switch + permission)
 * @returns {boolean}
 */
function areNotificationsEnabled() {
    const settings = getNotificationSettings();
    return settings.enabled && settings.permission === 'granted';
}

/**
 * Check if a specific notification type is enabled
 * @param {string} type - Notification type
 * @returns {boolean}
 */
function isNotificationTypeEnabled(type) {
    if (!areNotificationsEnabled()) return false;
    const settings = getNotificationSettings();
    return settings.types[type] === true;
}

/**
 * Toggle a specific notification type
 * @param {string} type - Notification type
 * @param {boolean} enabled - Enable/disable
 */
function setNotificationType(type, enabled) {
    const settings = getNotificationSettings();
    settings.types[type] = enabled;
    saveNotificationSettings(settings);
}

/**
 * Check if currently in quiet hours
 * @returns {boolean}
 */
function isQuietHours() {
    const settings = getNotificationSettings();
    if (!settings.quietHours.enabled) return false;

    const now = new Date();
    const hour = now.getHours();
    const { start, end } = settings.quietHours;

    // Handle overnight quiet hours (e.g., 22-7)
    if (start > end) {
        return hour >= start || hour < end;
    }
    return hour >= start && hour < end;
}

/**
 * Set quiet hours
 * @param {boolean} enabled - Enable/disable
 * @param {number} start - Start hour (0-23)
 * @param {number} end - End hour (0-23)
 */
function setQuietHours(enabled, start = 22, end = 7) {
    const settings = getNotificationSettings();
    settings.quietHours = { enabled, start, end };
    saveNotificationSettings(settings);
}

/**
 * Request notification permission
 * @returns {Promise<string>} Permission status
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('[Notifications] Not supported in this browser');
        return 'denied';
    }

    try {
        const permission = await Notification.requestPermission();
        saveNotificationSettings({ permission });
        console.log('[Notifications] Permission:', permission);
        return permission;
    } catch (err) {
        console.error('[Notifications] Permission request error:', err);
        return 'denied';
    }
}

/**
 * Check if we should prompt user for notifications
 * @returns {boolean}
 */
function shouldPromptForNotifications() {
    const settings = getNotificationSettings();

    // Never ask if user said "never"
    if (settings.neverAsk) return false;

    // Already enabled or denied
    if (settings.enabled || settings.permission === 'denied') return false;

    // Don't ask more than once per week
    if (settings.lastPromptDate) {
        const lastPrompt = new Date(settings.lastPromptDate);
        const daysSince = (Date.now() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) return false;
    }

    return true;
}

/**
 * Mark that we prompted the user
 * @param {boolean} neverAsk - User selected "never ask again"
 */
function markPrompted(neverAsk = false) {
    saveNotificationSettings({
        lastPromptDate: new Date().toISOString(),
        neverAsk
    });
}

/**
 * Enable notifications
 * @returns {Promise<boolean>} Success
 */
async function enableNotifications() {
    const permission = await requestNotificationPermission();
    if (permission === 'granted') {
        saveNotificationSettings({ enabled: true, permission: 'granted' });
        showToast?.('Notifications enabled!', 'success');
        return true;
    } else {
        showToast?.('Notification permission denied', 'error');
        return false;
    }
}

/**
 * Disable notifications
 */
function disableNotifications() {
    saveNotificationSettings({ enabled: false });
    showToast?.('Notifications disabled', 'info');
}

// Expose to window
window.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
window.NOTIFICATION_DESCRIPTIONS = NOTIFICATION_DESCRIPTIONS;
window.getNotificationSettings = getNotificationSettings;
window.saveNotificationSettings = saveNotificationSettings;
window.areNotificationsEnabled = areNotificationsEnabled;
window.isNotificationTypeEnabled = isNotificationTypeEnabled;
window.setNotificationType = setNotificationType;
window.isQuietHours = isQuietHours;
window.setQuietHours = setQuietHours;
window.requestNotificationPermission = requestNotificationPermission;
window.shouldPromptForNotifications = shouldPromptForNotifications;
window.markPrompted = markPrompted;
window.enableNotifications = enableNotifications;
window.disableNotifications = disableNotifications;

console.log('[NotificationSettings] Loaded - Opt-in notifications ready');
