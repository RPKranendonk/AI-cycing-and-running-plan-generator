// ============================================================================
// PRO GATES
// Central module for managing Pro feature access and upgrade prompts
// ============================================================================

/**
 * Pro Features Configuration
 */
const PRO_FEATURES = {
    sync: {
        id: 'sync',
        title: 'Sync to Intervals.icu',
        icon: '📤',
        description: 'Automatically push your training plan to Intervals.icu calendar',
        benefits: [
            'One-click calendar sync',
            'Workout descriptions with structured steps',
            'Weekly target updates'
        ]
    },
    doubleDays: {
        id: 'doubleDays',
        title: 'Double Sessions',
        icon: '🔄',
        description: 'Schedule morning and evening workouts on the same day',
        benefits: [
            'Morning Run + Evening Gym',
            'Split long sessions',
            'Advanced periodization'
        ]
    },
    aiAnalysis: {
        id: 'aiAnalysis',
        title: 'AI Coach Analysis',
        icon: '🤖',
        description: 'Get AI-powered insights and workout details',
        benefits: [
            'Personalized workout descriptions',
            'Pace guidance for each interval',
            'Weekly coaching notes'
        ]
    },
    advancedMetrics: {
        id: 'advancedMetrics',
        title: 'Advanced Metrics',
        icon: '📊',
        description: 'Access detailed training load and fitness analysis',
        benefits: [
            'TSS/CTL/ATL tracking',
            'Form prediction',
            'Recovery recommendations'
        ]
    }
};

/**
 * Check if user has Pro access
 * @returns {boolean}
 */
function isPro() {
    // Check state first, then localStorage
    if (window.state?.user?.isPro) return true;
    return localStorage.getItem('elite_isPro') === 'true';
}

/**
 * Set Pro status (for testing/admin)
 * @param {boolean} status
 */
function setProStatus(status) {
    if (!window.state) window.state = {};
    if (!window.state.user) window.state.user = {};
    window.state.user.isPro = status;
    localStorage.setItem('elite_isPro', status ? 'true' : 'false');
    console.log(`[ProGates] Pro status set to: ${status}`);
}

/**
 * Check if a Pro feature is accessible
 * Shows modal if not Pro
 * @param {string} featureId - Key from PRO_FEATURES
 * @returns {boolean} - true if allowed to proceed
 */
function checkProFeature(featureId) {
    if (isPro()) return true;

    showProModal(featureId);
    return false;
}

/**
 * Show Pro upgrade modal for a specific feature
 * @param {string} featureId
 */
function showProModal(featureId) {
    const feature = PRO_FEATURES[featureId];
    if (!feature) {
        console.warn(`[ProGates] Unknown feature: ${featureId}`);
        return;
    }

    // Remove existing modal
    document.getElementById('pro-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'pro-modal';
    modal.className = 'fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.innerHTML = `
        <div class="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full overflow-hidden">
            <!-- Header with Icon -->
            <div class="relative bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-center">
                <div class="absolute top-2 right-2">
                    <button onclick="document.getElementById('pro-modal').remove()" 
                        class="p-2 text-white/70 hover:text-white transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="text-5xl mb-3">${feature.icon}</div>
                <div class="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Pro Feature
                </div>
                <h2 class="text-2xl font-bold text-white">${feature.title}</h2>
            </div>

            <!-- Content -->
            <div class="p-6 space-y-4">
                <p class="text-slate-300 text-center">${feature.description}</p>
                
                <div class="space-y-2">
                    ${feature.benefits.map(b => `
                        <div class="flex items-center gap-3 text-sm text-slate-300">
                            <span class="text-emerald-400 text-lg">✓</span>
                            <span>${b}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Actions -->
            <div class="p-6 pt-0 space-y-3">
                <button onclick="openProUpgrade()" 
                    class="w-full py-4 px-6 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl 
                           hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/25">
                    🚀 Upgrade to Pro
                </button>
                <button onclick="document.getElementById('pro-modal').remove()" 
                    class="w-full py-3 px-6 bg-slate-800 text-slate-400 font-medium rounded-xl 
                           hover:bg-slate-700 hover:text-white transition-colors border border-white/10">
                    Maybe Later
                </button>
            </div>

            <!-- Footer -->
            <div class="px-6 py-4 bg-slate-900/50 border-t border-white/5 text-center">
                <p class="text-xs text-slate-500">
                    Your schedule is still saved locally. Pro just unlocks extra features.
                </p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

/**
 * Open Pro upgrade flow
 */
window.openProUpgrade = function () {
    // For now, just show a toast and enable Pro for testing
    // In production, this would redirect to payment
    document.getElementById('pro-modal')?.remove();

    // For development: toggle Pro on
    setProStatus(true);
    showToast('✨ Pro enabled for testing! Refresh to see changes.', 'success');
};

/**
 * Render Pro badge for UI elements
 * @returns {string} HTML badge or empty string
 */
function renderProBadge() {
    if (isPro()) return '';
    return `<span class="pro-badge ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full uppercase">Pro</span>`;
}

/**
 * Initialize Pro state from localStorage
 */
function initProGates() {
    if (!window.state) window.state = {};
    if (!window.state.user) window.state.user = {};

    const savedPro = localStorage.getItem('elite_isPro');
    if (savedPro === 'true') {
        window.state.user.isPro = true;
    }

    console.log(`[ProGates] Initialized. Pro status: ${isPro()}`);
}

// Auto-init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProGates);
} else {
    initProGates();
}

// Exports
window.isPro = isPro;
window.setProStatus = setProStatus;
window.checkProFeature = checkProFeature;
window.showProModal = showProModal;
window.renderProBadge = renderProBadge;
window.PRO_FEATURES = PRO_FEATURES;

console.log('[ProGates] Module loaded');
