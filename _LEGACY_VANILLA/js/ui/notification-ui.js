// ==========================================
// NOTIFICATION UI
// Permission request and settings interface
// ==========================================

const NotificationUI = {
    /**
     * Show notification permission prompt
     * Clean UI that explains each notification type
     */
    showPermissionPrompt() {
        const html = `
            <div class="p-6 space-y-5">
                <div class="text-center">
                    <div class="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                        <i class="fa-solid fa-bell text-3xl text-white"></i>
                    </div>
                    <h3 class="text-xl font-bold">Enable Notifications?</h3>
                    <p class="text-sm text-secondary mt-2">Get helpful reminders for your training. You choose what you receive.</p>
                </div>
                
                <div class="space-y-3">
                    ${Object.entries(NOTIFICATION_DESCRIPTIONS).map(([key, info]) => `
                        <label class="flex items-start gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                            <input type="checkbox" 
                                class="mt-1 notification-type-toggle" 
                                data-type="${key}" 
                                ${info.defaultEnabled ? 'checked' : ''}>
                            <div class="flex-1">
                                <div class="font-medium text-sm">${info.icon} ${info.title}</div>
                                <div class="text-xs text-muted">${info.description}</div>
                            </div>
                        </label>
                    `).join('')}
                </div>
                
                <div class="pt-3 space-y-3">
                    <button onclick="NotificationUI.enableAndClose()" 
                        class="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                        <i class="fa-solid fa-bell mr-2"></i> Enable Notifications
                    </button>
                    <div class="flex justify-center gap-4 text-sm">
                        <button onclick="NotificationUI.notNow()" class="text-muted hover:text-secondary">
                            Not now
                        </button>
                        <button onclick="NotificationUI.never()" class="text-muted hover:text-red-500">
                            Never ask again
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.showModal(html);
    },

    /**
     * Show notification settings panel
     */
    showSettings() {
        const settings = getNotificationSettings();
        const html = `
            <div class="p-6 space-y-5">
                <div class="flex items-center justify-between">
                    <h3 class="text-lg font-bold">🔔 Notification Settings</h3>
                    <button onclick="NotificationUI.closeModal()" class="text-muted hover:text-secondary">
                        <i class="fa-solid fa-times text-lg"></i>
                    </button>
                </div>
                
                <!-- Master Switch -->
                <div class="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
                    <div>
                        <div class="font-medium">Notifications</div>
                        <div class="text-xs text-muted">${settings.permission === 'denied' ? 'Blocked by browser' : 'Master switch'}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" 
                            id="masterNotificationToggle"
                            class="sr-only peer" 
                            ${settings.enabled ? 'checked' : ''}
                            ${settings.permission === 'denied' ? 'disabled' : ''}
                            onchange="NotificationUI.toggleMaster(this.checked)">
                        <div class="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                </div>
                
                ${settings.permission === 'denied' ? `
                    <div class="text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                        <i class="fa-solid fa-exclamation-triangle mr-2"></i>
                        Notifications blocked by browser. Enable in browser settings.
                    </div>
                ` : ''}
                
                <!-- Notification Types -->
                <div class="space-y-2">
                    <div class="text-sm font-medium text-secondary">Notification Types</div>
                    ${Object.entries(NOTIFICATION_DESCRIPTIONS).map(([key, info]) => `
                        <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                            <div class="flex items-center gap-3">
                                <span class="text-lg">${info.icon}</span>
                                <span class="text-sm font-medium">${info.title}</span>
                            </div>
                            <input type="checkbox" 
                                class="notification-type-setting" 
                                data-type="${key}" 
                                ${settings.types[key] ? 'checked' : ''}
                                onchange="NotificationUI.toggleType('${key}', this.checked)">
                        </label>
                    `).join('')}
                </div>
                
                <!-- Quiet Hours -->
                <div class="space-y-2">
                    <div class="text-sm font-medium text-secondary">Quiet Hours</div>
                    <label class="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                        <span class="text-sm">Enable quiet hours</span>
                        <input type="checkbox" 
                            id="quietHoursToggle"
                            ${settings.quietHours.enabled ? 'checked' : ''}
                            onchange="NotificationUI.toggleQuietHours(this.checked)">
                    </label>
                    <div class="flex gap-2 items-center text-sm text-muted">
                        <span>From</span>
                        <select id="quietStart" onchange="NotificationUI.updateQuietHours()" class="px-2 py-1 rounded border">
                            ${[...Array(24)].map((_, h) => `<option value="${h}" ${settings.quietHours.start === h ? 'selected' : ''}>${h.toString().padStart(2, '0')}:00</option>`).join('')}
                        </select>
                        <span>to</span>
                        <select id="quietEnd" onchange="NotificationUI.updateQuietHours()" class="px-2 py-1 rounded border">
                            ${[...Array(24)].map((_, h) => `<option value="${h}" ${settings.quietHours.end === h ? 'selected' : ''}>${h.toString().padStart(2, '0')}:00</option>`).join('')}
                        </select>
                    </div>
                </div>
                
                <!-- Test Button -->
                <div class="pt-3 flex justify-between items-center">
                    <button onclick="sendTestNotification()" 
                        class="text-sm text-secondary hover:text-primary">
                        <i class="fa-solid fa-paper-plane mr-1"></i> Send test
                    </button>
                    <button onclick="NotificationUI.closeModal()" 
                        class="px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium hover:bg-emerald-600">
                        Done
                    </button>
                </div>
            </div>
        `;

        this.showModal(html);
    },

    /**
     * Show modal helper
     */
    showModal(html) {
        let modal = document.getElementById('notificationModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'notificationModal';
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-auto">${html}</div>`;
        modal.style.display = 'flex';
    },

    /**
     * Close modal
     */
    closeModal() {
        const modal = document.getElementById('notificationModal');
        if (modal) modal.style.display = 'none';
    },

    /**
     * Enable notifications and close
     */
    async enableAndClose() {
        // Save selected types first
        document.querySelectorAll('.notification-type-toggle').forEach(cb => {
            setNotificationType(cb.dataset.type, cb.checked);
        });

        const success = await enableNotifications();
        if (success) {
            this.closeModal();
        }
    },

    /**
     * Not now - close and mark prompted
     */
    notNow() {
        markPrompted(false);
        this.closeModal();
    },

    /**
     * Never ask again
     */
    never() {
        markPrompted(true);
        this.closeModal();
        showToast?.('You won\'t be asked again', 'info');
    },

    /**
     * Toggle master switch
     */
    async toggleMaster(enabled) {
        if (enabled) {
            const permission = await requestNotificationPermission();
            if (permission !== 'granted') {
                document.getElementById('masterNotificationToggle').checked = false;
                return;
            }
            saveNotificationSettings({ enabled: true });
            showToast?.('Notifications enabled', 'success');
        } else {
            disableNotifications();
        }
    },

    /**
     * Toggle notification type
     */
    toggleType(type, enabled) {
        setNotificationType(type, enabled);
    },

    /**
     * Toggle quiet hours
     */
    toggleQuietHours(enabled) {
        const start = parseInt(document.getElementById('quietStart')?.value || 22);
        const end = parseInt(document.getElementById('quietEnd')?.value || 7);
        setQuietHours(enabled, start, end);
    },

    /**
     * Update quiet hours times
     */
    updateQuietHours() {
        const enabled = document.getElementById('quietHoursToggle')?.checked ?? true;
        const start = parseInt(document.getElementById('quietStart')?.value || 22);
        const end = parseInt(document.getElementById('quietEnd')?.value || 7);
        setQuietHours(enabled, start, end);
    }
};

// Expose to window
window.NotificationUI = NotificationUI;

// Auto-prompt after 30 seconds if appropriate
setTimeout(() => {
    if (shouldPromptForNotifications()) {
        NotificationUI.showPermissionPrompt();
    }
}, 30000);

console.log('[NotificationUI] Loaded');
