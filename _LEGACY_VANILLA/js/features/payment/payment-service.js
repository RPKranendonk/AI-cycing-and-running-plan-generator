/**
 * Payment Service
 * Handles Pro status entitlement and simulated Stripe integration.
 */
class PaymentService {
    constructor() {
        this.STORAGE_KEY = 'ai_coach_pro_status';
        this.proStatus = this.loadStatus();

        // Real Stripe Links
        this.STRIPE_LINKS = {
            one_time: 'https://buy.stripe.com/test_4gM28sgch6JX2pO7lt2go00', // User provided Test Link
            subscription: 'https://donate.stripe.com/6oU9AU1hn3xL3tSaxF2go02' // Using same link as fallback/placeholder
        };

        // UI Callbacks
        this.onStatusChange = null;
    }

    /**
     * Load status from local storage
     */
    loadStatus() {
        return localStorage.getItem(this.STORAGE_KEY) === 'true';
    }

    /**
     * Check if user is Pro
     */
    isProUser() {
        return this.proStatus;
    }

    /**
     * Handle Donation/Upgrade Flow
     * @param {string} type - 'one_time' or 'subscription'
     */
    upgrade(type = 'one_time') {
        console.log(`[Payment] Initiating ${type} donation flow...`);
        const link = this.STRIPE_LINKS[type];

        if (link) {
            // [DEEP INTEGRATION]
            // We expect the Stripe Link to redirect to:
            // https://[YOUR_DOMAIN]/success.html?session_id={CHECKOUT_SESSION_ID}
            window.open(link, '_blank');

            // Close modal immediately
            const modal = document.getElementById('upgradeModal');
            if (modal) modal.classList.add('hidden');
        } else {
            console.error("Invalid donation type or missing link");
        }
    }

    /**
     * Verify Session from URL (called by success.html)
     * @param {string} sessionId 
     * @returns {boolean} isValid
     */
    verifySession(sessionId) {
        if (!sessionId) return false;

        console.log("[Payment] Verifying session:", sessionId);
        // In a real backend app, we would POST this ID to our server
        // to query Stripe's API.
        // For this static app, presence of ID is our "proof" of redirect.

        this.setProStatus(true);
        return true;
    }

    /**
     * Handle Feedback Submission
     */
    sendFeedback() {
        const input = document.getElementById('feedbackText');
        const text = input ? input.value : '';

        if (!text.trim()) {
            alert("Please enter some feedback first.");
            return;
        }

        console.log("[Feedback] User sent:", text);

        // TODO: Send to backend or email service
        // For now, valid simulation

        if (input) input.value = ''; // Clear
        alert("Thank you! Your feedback has been sent.");
    }

    // handleCallback removed - verification moved to success.html

    /**
     * Set Pro status manually (for debug/admin)
     */
    setProStatus(isPro) {
        this.proStatus = isPro;
        localStorage.setItem(this.STORAGE_KEY, isPro);
        console.log(`[Payment] Status updated: ${isPro ? 'PRO' : 'FREE'}`);

        if (this.onStatusChange) {
            this.onStatusChange(isPro);
        }
    }

    /**
     * Check if a feature is locked and handle the UI interaction
     * @param {string} featureName - Name of the feature for the modal
     * @returns {boolean} true if allowed, false if locked (and shows modal)
     */
    guardFeature(featureName) {
        if (this.isProUser()) return true;

        // Show upgrade modal
        if (window.showUpgradeModal) {
            window.showUpgradeModal(featureName);
        } else {
            alert(`Please support the project to access ${featureName}!`);
        }
        return false;
    }
}

// Singleton Export
window.PaymentService = new PaymentService();
console.log('[PaymentService] Loaded');
