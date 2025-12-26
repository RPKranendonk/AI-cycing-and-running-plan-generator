class SettingsManager {
    constructor() {
        this.isProMode = localStorage.getItem('proMode') === 'true';

        // Expose global toggle function for the HTML onclick
        window.toggleProMode = () => this.toggleProMode(!this.isProMode);

        // Apply immediately
        this.applyMode();
    }

    toggleProMode(isActive) {
        // Feature Gating
        if (isActive && window.PaymentService && !window.PaymentService.guardFeature('Pro Mode Configuration')) return;

        this.isProMode = isActive;
        localStorage.setItem('proMode', this.isProMode);
        this.applyMode();

        const msg = this.isProMode ? "🔧 Advanced Settings Unlocked" : "✨ Simple Mode Enabled";
        if (window.showToast) showToast(msg, 'info');
    }

    applyMode() {
        // 1. Body Class (Controls .advanced-field via CSS if any)
        document.body.classList.toggle('pro-mode-active', this.isProMode);

        // 2. Toggle .pro-only elements
        document.querySelectorAll('.pro-only').forEach(el => {
            if (this.isProMode) {
                el.classList.remove('hidden');
                // If it's a details element, we might want to open it? No, keep user preference.
            } else {
                el.classList.add('hidden');
            }
        });

        // 3. Fallback for data-complexity="pro"
        document.querySelectorAll('[data-complexity="pro"]').forEach(el => {
            if (this.isProMode) {
                el.classList.remove('hidden');
            } else {
                el.classList.add('hidden');
            }
        });

        // 4. Update Toggle UI (Button + Knob)
        const toggleBtn = document.getElementById('proModeToggle');
        const toggleKnob = document.getElementById('proModeKnob');
        const statusText = document.querySelector('#proModeToggle').previousElementSibling; // The "Pro" label

        if (toggleBtn && toggleKnob) {
            if (this.isProMode) {
                // Active State
                toggleBtn.classList.remove('bg-slate-700');
                toggleBtn.classList.add('bg-cyan-500', 'shadow-lg', 'shadow-cyan-500/50');

                toggleKnob.classList.add('translate-x-4');
                toggleKnob.classList.remove('bg-white/50');
                toggleKnob.classList.add('bg-white');

                if (statusText) statusText.classList.add('text-cyan-400');
            } else {
                // Inactive State
                toggleBtn.classList.add('bg-slate-700');
                toggleBtn.classList.remove('bg-cyan-500', 'shadow-lg', 'shadow-cyan-500/50');

                toggleKnob.classList.remove('translate-x-4');
                toggleKnob.classList.add('bg-white/50');
                toggleKnob.classList.remove('bg-white');

                if (statusText) statusText.classList.remove('text-cyan-400');
            }
        }
    }
}

// Initialize Global Instance
window.settingsManager = new SettingsManager();

// ============================================================================
// TRAINING PACES SETTINGS
// Source of truth: js/core/zone-service.js
// ============================================================================

/**
 * Update paces when 5K time or fitness context changes in settings
 * @param {string} fiveKTime - Time in MM:SS format
 */
window.updateSettingsPaces = function (fiveKTime) {
    if (!fiveKTime) return;

    // Auto-format
    let formatted = fiveKTime.replace(/[^0-9:]/g, '');
    if (formatted.length === 2 && !formatted.includes(':')) {
        formatted += ':';
    }
    if (formatted.length > 5) formatted = formatted.slice(0, 5);

    const input = document.getElementById('settings-5k-input');
    if (input && input.value !== formatted) {
        input.value = formatted;
    }

    // Get fitness context
    const contextSelect = document.getElementById('settings-fitness-context');
    const context = contextSelect?.value || 'current';

    // Calculate paces using ThresholdEstimator
    if (window.calculatePaces) {
        const paces = window.calculatePaces(formatted, context);
        if (paces) {
            // Update displays
            const ltDisplay = document.getElementById('settings-lt-pace');
            const easyDisplay = document.getElementById('settings-easy-pace');

            if (ltDisplay) ltDisplay.textContent = formatPaceMMSS(paces.thresholdPace);
            if (easyDisplay) easyDisplay.textContent = formatPaceMMSS(paces.easyPace);

            // Save to state and localStorage
            if (!window.state) window.state = {};
            if (!window.state.user) window.state.user = {};
            window.state.user.thresholdPace = paces.thresholdPace;
            window.state.user.easyPace = paces.easyPace;
            window.state.thresholdPaceSecPerKm = paces.thresholdPace;

            localStorage.setItem('elite_thresholdPace', paces.thresholdPace);
            localStorage.setItem('elite_easyPace', paces.easyPace);
            localStorage.setItem('elite_fiveKTime', formatted);
            localStorage.setItem('elite_fitnessContext', context);

            // CRITICAL: Recalculate all zones via ZoneService
            if (window.ZoneService && window.ZoneService.calculateZonesFromLT) {
                window.ZoneService.calculateZonesFromLT(paces.thresholdPace);
                console.log('[Settings] Zones recalculated from new 5K time');
            }

            if (window.showToast) {
                showToast(`✅ Training paces updated: LT ${formatPaceMMSS(paces.thresholdPace)}/km`, 'success');
            }
        }
    }
};

/**
 * Apply a manually entered LT pace (from lab test)
 */
window.applyManualLTPace = function () {
    const input = document.getElementById('settings-manual-lt');
    if (!input || !input.value) {
        if (window.showToast) showToast('Please enter an LT pace (e.g., 4:30)', 'error');
        return;
    }

    // Parse MM:SS to seconds
    const parts = input.value.split(':');
    if (parts.length !== 2) {
        if (window.showToast) showToast('Invalid format. Use MM:SS (e.g., 4:30)', 'error');
        return;
    }

    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (isNaN(mins) || isNaN(secs)) {
        if (window.showToast) showToast('Invalid time values', 'error');
        return;
    }

    const ltPaceSecPerKm = mins * 60 + secs;

    // Calculate easy pace (Z2 = ~85% of LT, so pace is slower)
    const easyPace = Math.round(ltPaceSecPerKm * 1.18);

    // Update displays
    const ltDisplay = document.getElementById('settings-lt-pace');
    const easyDisplay = document.getElementById('settings-easy-pace');

    if (ltDisplay) ltDisplay.textContent = formatPaceMMSS(ltPaceSecPerKm);
    if (easyDisplay) easyDisplay.textContent = formatPaceMMSS(easyPace);

    // Save to state and localStorage
    if (!window.state) window.state = {};
    if (!window.state.user) window.state.user = {};
    window.state.user.thresholdPace = ltPaceSecPerKm;
    window.state.user.easyPace = easyPace;
    window.state.thresholdPaceSecPerKm = ltPaceSecPerKm;

    localStorage.setItem('elite_thresholdPace', ltPaceSecPerKm.toString());
    localStorage.setItem('elite_easyPace', easyPace.toString());

    // CRITICAL: Recalculate all zones via ZoneService
    if (window.ZoneService && window.ZoneService.calculateZonesFromLT) {
        window.ZoneService.calculateZonesFromLT(ltPaceSecPerKm);
        console.log('[Settings] Zones recalculated from manual LT pace');
    }

    if (window.showToast) {
        showToast(`🔬 Lab-tested LT pace applied: ${formatPaceMMSS(ltPaceSecPerKm)}/km`, 'success');
    }

    // Clear the input
    input.value = '';
};

/**
 * Format seconds to MM:SS
 */
function formatPaceMMSS(secPerKm) {
    if (!secPerKm || secPerKm <= 0) return '--:--';
    const mins = Math.floor(secPerKm / 60);
    const secs = Math.round(secPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Initialize settings paces from localStorage
 */
function initSettingsPaces() {
    const saved5K = localStorage.getItem('elite_fiveKTime');
    const savedContext = localStorage.getItem('elite_fitnessContext');
    const savedLT = localStorage.getItem('elite_thresholdPace');
    const savedEasy = localStorage.getItem('elite_easyPace');

    // Populate 5K input
    const fiveKInput = document.getElementById('settings-5k-input');
    if (fiveKInput && saved5K) {
        fiveKInput.value = saved5K;
    }

    // Populate context dropdown
    const contextSelect = document.getElementById('settings-fitness-context');
    if (contextSelect && savedContext) {
        contextSelect.value = savedContext;
    }

    // Populate pace displays
    if (savedLT) {
        const ltDisplay = document.getElementById('settings-lt-pace');
        if (ltDisplay) ltDisplay.textContent = formatPaceMMSS(parseInt(savedLT));
    }
    if (savedEasy) {
        const easyDisplay = document.getElementById('settings-easy-pace');
        if (easyDisplay) easyDisplay.textContent = formatPaceMMSS(parseInt(savedEasy));
    }
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSettingsPaces);
} else {
    // Delay slightly to ensure elements exist
    setTimeout(initSettingsPaces, 100);
}
