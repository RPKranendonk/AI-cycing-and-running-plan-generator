// ==========================================
// NOTIFICATION TRIGGERS
// Logic for when to send notifications
// ==========================================

/**
 * Send a notification (if enabled and not in quiet hours)
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 * @returns {boolean} Whether notification was sent
 */
function sendNotification(type, title, body, options = {}) {
    // Check if enabled
    if (!isNotificationTypeEnabled(type)) {
        console.log(`[Notifications] Type ${type} not enabled, skipping`);
        return false;
    }

    // Check quiet hours
    if (isQuietHours()) {
        console.log('[Notifications] In quiet hours, skipping');
        return false;
    }

    // Check browser support
    if (!('Notification' in window)) {
        console.warn('[Notifications] Not supported');
        return false;
    }

    // Send notification
    try {
        const notification = new Notification(title, {
            body,
            icon: options.icon || '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: type,
            requireInteraction: options.requireInteraction || false,
            ...options
        });

        // Handle click
        notification.onclick = () => {
            window.focus();
            if (options.onClick) options.onClick();
            notification.close();
        };

        console.log(`[Notifications] Sent: ${type}`, title);
        return true;
    } catch (err) {
        console.error('[Notifications] Send error:', err);
        return false;
    }
}

/**
 * Check if weekly check-in is due (Monday morning)
 * @returns {boolean}
 */
function isWeeklyCheckinDue() {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();

    // Monday (1) between 8-10 AM
    if (day === 1 && hour >= 8 && hour <= 10) {
        // Check if already notified today
        const lastCheckin = localStorage.getItem('last_checkin_notification');
        if (lastCheckin) {
            const lastDate = new Date(lastCheckin);
            if (lastDate.toDateString() === now.toDateString()) {
                return false; // Already notified today
            }
        }
        return true;
    }
    return false;
}

/**
 * Send weekly check-in notification
 */
function sendWeeklyCheckinNotification() {
    const sent = sendNotification(
        NOTIFICATION_TYPES.WEEKLY_CHECKIN,
        '📋 Weekly Check-in Time',
        'How did last week go? Update your readiness to optimize next week\'s training.',
        {
            requireInteraction: true,
            onClick: () => {
                window.openStatsView?.();
            }
        }
    );

    if (sent) {
        localStorage.setItem('last_checkin_notification', new Date().toISOString());
    }
}

/**
 * Check readiness and send alert if RED
 */
async function checkAndAlertReadiness() {
    if (!isNotificationTypeEnabled(NOTIFICATION_TYPES.READINESS_ALERT)) return;

    try {
        const readiness = await calculateReadinessWithAuto?.({});
        if (readiness?.status === 'RED') {
            // Check if already alerted today
            const lastAlert = localStorage.getItem('last_readiness_alert');
            if (lastAlert) {
                const lastDate = new Date(lastAlert);
                const now = new Date();
                if (lastDate.toDateString() === now.toDateString()) {
                    return; // Already alerted today
                }
            }

            sendNotification(
                NOTIFICATION_TYPES.READINESS_ALERT,
                '🚨 Readiness Alert',
                'Your readiness signals indicate you may need extra recovery. Check your suggestions.',
                {
                    requireInteraction: true,
                    onClick: () => {
                        window.openStatsView?.();
                    }
                }
            );

            localStorage.setItem('last_readiness_alert', new Date().toISOString());
        }
    } catch (err) {
        console.error('[Notifications] Readiness check error:', err);
    }
}

/**
 * Send milestone celebration notification
 * @param {string} milestoneType - 'week' or 'block'
 * @param {Object} data - Milestone data
 */
function celebrateMilestone(milestoneType, data = {}) {
    let title, body;

    switch (milestoneType) {
        case 'week':
            title = '🎉 Week Complete!';
            body = `You completed Week ${data.weekNumber || ''}! Great consistency.`;
            break;
        case 'block':
            title = '🏆 Training Block Complete!';
            body = `You finished the ${data.blockName || 'training'} block! Time to celebrate.`;
            break;
        default:
            title = '🎉 Milestone Reached!';
            body = 'You\'re making great progress!';
    }

    sendNotification(NOTIFICATION_TYPES.MILESTONE, title, body, {
        onClick: () => {
            window.openStatsView?.();
        }
    });
}

/**
 * Send test notification
 */
function sendTestNotification() {
    if (!areNotificationsEnabled()) {
        showToast?.('Enable notifications first', 'warning');
        return false;
    }

    return sendNotification(
        NOTIFICATION_TYPES.MILESTONE,
        '🔔 Test Notification',
        'If you see this, notifications are working!',
        { requireInteraction: false }
    );
}

/**
 * Initialize notification checks
 * Called on app load
 */
function initNotificationChecks() {
    if (!areNotificationsEnabled()) return;

    console.log('[Notifications] Initializing checks...');

    // Check weekly check-in
    if (isWeeklyCheckinDue()) {
        sendWeeklyCheckinNotification();
    }

    // Check readiness (with delay to let data load)
    setTimeout(() => {
        checkAndAlertReadiness();
    }, 5000);
}

// Expose to window
window.sendNotification = sendNotification;
window.isWeeklyCheckinDue = isWeeklyCheckinDue;
window.sendWeeklyCheckinNotification = sendWeeklyCheckinNotification;
window.checkAndAlertReadiness = checkAndAlertReadiness;
window.celebrateMilestone = celebrateMilestone;
window.sendTestNotification = sendTestNotification;
window.initNotificationChecks = initNotificationChecks;

console.log('[NotificationTriggers] Loaded');
