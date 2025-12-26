// ==========================================
// PWA INSTALL PROMPT
// Shows "Add to homescreen" banner
// ==========================================

/**
 * PWA Install Prompt Handler
 * Captures the beforeinstallprompt event and shows custom UI
 */
const PWAInstall = {
    deferredPrompt: null,
    isInstalled: false,

    /**
     * Initialize the install prompt handler
     */
    init() {
        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isInstalled = true;
            console.log('[PWA] App is already installed');
            return;
        }

        // Check if user dismissed before
        const dismissed = localStorage.getItem('pwa_install_dismissed');
        const dismissedAt = dismissed ? parseInt(dismissed) : 0;
        const daysSinceDismiss = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);

        // Show again after 7 days
        if (daysSinceDismiss < 7) {
            console.log('[PWA] Install prompt dismissed recently, skipping');
            return;
        }

        // Listen for the beforeinstallprompt event
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('[PWA] Install prompt captured');

            // Show our custom install UI after a short delay
            setTimeout(() => this.showInstallBanner(), 2000);
        });

        // Track successful installation
        window.addEventListener('appinstalled', () => {
            this.isInstalled = true;
            this.hideInstallBanner();
            console.log('[PWA] App installed successfully!');
            this.showToast('✅ App installed to homescreen!', 'success');
        });
    },

    /**
     * Show the install banner
     */
    showInstallBanner() {
        if (this.isInstalled || !this.deferredPrompt) return;

        // Create banner if doesn't exist
        let banner = document.getElementById('pwa-install-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.className = 'pwa-install-banner';
            banner.innerHTML = `
                <div class="pwa-install-content">
                    <div class="pwa-install-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                    </div>
                    <div class="pwa-install-text">
                        <strong>Install AI Coach</strong>
                        <span>Add to your homescreen for quick access</span>
                    </div>
                </div>
                <div class="pwa-install-actions">
                    <button class="pwa-install-dismiss" onclick="PWAInstall.dismiss()">Not now</button>
                    <button class="pwa-install-button" onclick="PWAInstall.install()">Install</button>
                </div>
            `;
            document.body.appendChild(banner);
        }

        // Animate in
        requestAnimationFrame(() => {
            banner.classList.add('visible');
        });
    },

    /**
     * Hide the install banner
     */
    hideInstallBanner() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.remove('visible');
            setTimeout(() => banner.remove(), 300);
        }
    },

    /**
     * Trigger the install prompt
     */
    async install() {
        if (!this.deferredPrompt) {
            console.warn('[PWA] No install prompt available');
            return;
        }

        this.hideInstallBanner();

        // Show the native install prompt
        this.deferredPrompt.prompt();

        // Wait for user response
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] Install prompt result:', outcome);

        this.deferredPrompt = null;
    },

    /**
     * Dismiss the banner
     */
    dismiss() {
        localStorage.setItem('pwa_install_dismissed', Date.now().toString());
        this.hideInstallBanner();
    },

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        if (typeof showToast === 'function') {
            showToast(message, type);
        } else {
            console.log('[PWA]', message);
        }
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    PWAInstall.init();
});

// Export for global access
window.PWAInstall = PWAInstall;
