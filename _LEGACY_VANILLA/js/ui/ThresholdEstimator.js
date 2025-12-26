// ============================================================================
// THRESHOLD ESTIMATOR
// Smart onboarding component that estimates training paces from 5k time
// ============================================================================

/**
 * Pace Calculation Logic:
 * 1. User inputs their best recent 5k time (MM:SS)
 * 2. Context modifier adjusts for fitness state:
 *    - Rusty: +5% slower (coming back from break)
 *    - Current: No change (could run this today)
 *    - Improved: -3% faster (in better shape now)
 * 3. Derive training paces:
 *    - Threshold Pace = Adjusted 5k Pace × 1.08
 *    - Easy Pace = Threshold Pace × 1.25
 */

const CONTEXT_MODIFIERS = {
    rusty: 1.05,     // 5% slower
    current: 1.0,    // No change
    improved: 0.97   // 3% faster
};

// State for the estimator
const estimatorState = {
    fiveKTime: '',      // MM:SS format
    context: 'current', // 'rusty' | 'current' | 'improved'
    thresholdPace: null,
    easyPace: null
};

/**
 * Parse MM:SS format to total seconds
 */
function parseMMSS(timeStr) {
    if (!timeStr || !timeStr.includes(':')) return null;
    const [mins, secs] = timeStr.split(':').map(Number);
    if (isNaN(mins) || isNaN(secs)) return null;
    return mins * 60 + secs;
}

/**
 * Format seconds to MM:SS display
 */
function formatPace(secondsPerKm) {
    if (!secondsPerKm || isNaN(secondsPerKm)) return '--:--';
    const mins = Math.floor(secondsPerKm / 60);
    const secs = Math.round(secondsPerKm % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculate training paces from 5k time
 * @param {string} fiveKTime - Time in MM:SS format
 * @param {string} context - 'rusty' | 'current' | 'improved'
 * @returns {Object} { thresholdPace, easyPace, fiveKPace } in seconds/km
 */
function calculatePaces(fiveKTime, context = 'current') {
    const totalSeconds = parseMMSS(fiveKTime);
    if (!totalSeconds) return null;

    // Base 5k pace (seconds per km)
    const fiveKPace = totalSeconds / 5;

    // Apply context modifier
    const modifier = CONTEXT_MODIFIERS[context] || 1.0;
    const adjustedPace = fiveKPace * modifier;

    // Derive training paces
    const thresholdPace = adjustedPace * 1.08;  // ~8% slower than 5k pace
    const easyPace = thresholdPace * 1.25;      // 25% slower than threshold

    return {
        fiveKPace: Math.round(adjustedPace),
        thresholdPace: Math.round(thresholdPace),
        easyPace: Math.round(easyPace)
    };
}

/**
 * Update estimator state and recalculate paces
 * 
 * NOTE: This function triggers ZoneService.calculateZonesFromLT() which is
 * the SINGLE SOURCE OF TRUTH for all pace zones. See js/core/zone-service.js
 */
function updateEstimator(field, value) {
    estimatorState[field] = value;

    const paces = calculatePaces(estimatorState.fiveKTime, estimatorState.context);
    if (paces) {
        estimatorState.thresholdPace = paces.thresholdPace;
        estimatorState.easyPace = paces.easyPace;

        // Save to global state
        if (!window.state) window.state = {};
        if (!window.state.user) window.state.user = {};
        window.state.user.thresholdPace = paces.thresholdPace;
        window.state.user.easyPace = paces.easyPace;
        window.state.user.fiveKPace = paces.fiveKPace;

        // Persist to localStorage
        localStorage.setItem('elite_thresholdPace', paces.thresholdPace);
        localStorage.setItem('elite_easyPace', paces.easyPace);
        localStorage.setItem('elite_fiveKTime', estimatorState.fiveKTime);
        localStorage.setItem('elite_fitnessContext', estimatorState.context);

        // CRITICAL: Calculate all zones via ZoneService (single source of truth)
        if (window.ZoneService && window.ZoneService.calculateZonesFromLT) {
            window.ZoneService.calculateZonesFromLT(paces.thresholdPace);
        }
    }

    // Update UI display
    renderPaceDisplay();
}

/**
 * Render the pace display section
 */
function renderPaceDisplay() {
    const container = document.getElementById('pace-display');
    if (!container) return;

    const paces = calculatePaces(estimatorState.fiveKTime, estimatorState.context);

    if (!paces) {
        container.innerHTML = `
            <div class="text-center text-slate-500 py-4">
                Enter your 5k time to see estimated paces
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="glass-panel p-4 rounded-xl border border-white/10 text-center">
                <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">Threshold Pace</div>
                <div class="text-2xl font-bold text-cyan-400">${formatPace(paces.thresholdPace)}</div>
                <div class="text-xs text-slate-500">/km (Zone 4)</div>
            </div>
            <div class="glass-panel p-4 rounded-xl border border-white/10 text-center">
                <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">Easy Pace</div>
                <div class="text-2xl font-bold text-emerald-400">${formatPace(paces.easyPace)}</div>
                <div class="text-xs text-slate-500">/km (Zone 2)</div>
            </div>
        </div>
        <div class="mt-3 p-3 bg-slate-800/50 rounded-lg border border-white/5">
            <div class="flex items-center gap-2 text-sm text-slate-300">
                <span class="text-cyan-400">ℹ️</span>
                <span>Based on your ${estimatorState.context === 'rusty' ? 'returning' : estimatorState.context === 'improved' ? 'improved' : 'current'} fitness</span>
            </div>
        </div>
    `;
}

/**
 * Render the full Threshold Estimator component
 * @param {HTMLElement|string} container - Container element or ID
 */
function renderThresholdEstimator(containerId) {
    const container = typeof containerId === 'string'
        ? document.getElementById(containerId)
        : containerId;

    if (!container) return;

    // Load saved values
    const savedTime = localStorage.getItem('elite_fiveKTime') || '';
    const savedContext = localStorage.getItem('elite_fitnessContext') || 'current';
    estimatorState.fiveKTime = savedTime;
    estimatorState.context = savedContext;

    container.innerHTML = `
        <div class="threshold-estimator space-y-6">
            <!-- Header -->
            <div class="text-center">
                <h2 class="text-2xl font-bold text-white mb-2">Your Running Fitness</h2>
                <p class="text-slate-400 text-sm">We'll calculate your training zones from a single input</p>
            </div>

            <!-- 5K Time Input -->
            <div class="glass-panel p-6 rounded-xl border border-white/10">
                <label class="block text-sm font-medium text-slate-300 mb-3">
                    🏃 Best Recent 5km Time
                </label>
                <div class="flex gap-3 items-center">
                    <input 
                        type="text" 
                        id="fiveK-input"
                        placeholder="22:30"
                        value="${savedTime}"
                        class="flex-1 p-4 text-2xl font-mono text-center bg-slate-900/80 border-2 border-white/20 rounded-xl text-white placeholder-slate-600 focus:border-cyan-500 focus:outline-none transition-colors"
                        oninput="handleFiveKInput(this.value)"
                        maxlength="5"
                    >
                    <span class="text-slate-400 text-sm">MM:SS</span>
                </div>
            </div>

            <!-- Context Toggle -->
            <div class="glass-panel p-4 rounded-xl border border-white/10">
                <label class="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                    How does this time feel?
                </label>
                <div class="grid grid-cols-3 gap-2" id="context-toggle">
                    <button 
                        onclick="setFitnessContext('rusty')"
                        class="context-btn p-3 rounded-lg border-2 transition-all ${savedContext === 'rusty' ? 'border-amber-500 bg-amber-500/20 text-amber-300' : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/30'}"
                        data-context="rusty"
                    >
                        <div class="text-lg mb-1">😴</div>
                        <div class="text-xs font-medium">Rusty</div>
                        <div class="text-[10px] text-slate-500">Coming back</div>
                    </button>
                    <button 
                        onclick="setFitnessContext('current')"
                        class="context-btn p-3 rounded-lg border-2 transition-all ${savedContext === 'current' ? 'border-cyan-500 bg-cyan-500/20 text-cyan-300' : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/30'}"
                        data-context="current"
                    >
                        <div class="text-lg mb-1">💪</div>
                        <div class="text-xs font-medium">Current</div>
                        <div class="text-[10px] text-slate-500">Could do today</div>
                    </button>
                    <button 
                        onclick="setFitnessContext('improved')"
                        class="context-btn p-3 rounded-lg border-2 transition-all ${savedContext === 'improved' ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300' : 'border-white/10 bg-slate-800/50 text-slate-400 hover:border-white/30'}"
                        data-context="improved"
                    >
                        <div class="text-lg mb-1">🚀</div>
                        <div class="text-xs font-medium">Improved</div>
                        <div class="text-[10px] text-slate-500">Faster now</div>
                    </button>
                </div>
            </div>

            <!-- Pace Display -->
            <div id="pace-display"></div>
        </div>
    `;

    // Initial render of pace display
    renderPaceDisplay();
}

/**
 * Handle 5k time input with auto-formatting
 */
window.handleFiveKInput = function (value) {
    // Auto-format: add colon after 2 digits
    let formatted = value.replace(/[^0-9:]/g, '');
    if (formatted.length === 2 && !formatted.includes(':')) {
        formatted += ':';
    }
    if (formatted.length > 5) formatted = formatted.slice(0, 5);

    const input = document.getElementById('fiveK-input');
    if (input && input.value !== formatted) {
        input.value = formatted;
    }

    updateEstimator('fiveKTime', formatted);
};

/**
 * Set fitness context (rusty/current/improved)
 */
window.setFitnessContext = function (context) {
    // Update button styles
    document.querySelectorAll('.context-btn').forEach(btn => {
        const btnContext = btn.dataset.context;
        const isSelected = btnContext === context;

        btn.classList.remove('border-amber-500', 'bg-amber-500/20', 'text-amber-300',
            'border-cyan-500', 'bg-cyan-500/20', 'text-cyan-300',
            'border-emerald-500', 'bg-emerald-500/20', 'text-emerald-300');
        btn.classList.add('border-white/10', 'bg-slate-800/50', 'text-slate-400');

        if (isSelected) {
            btn.classList.remove('border-white/10', 'bg-slate-800/50', 'text-slate-400');
            if (context === 'rusty') {
                btn.classList.add('border-amber-500', 'bg-amber-500/20', 'text-amber-300');
            } else if (context === 'current') {
                btn.classList.add('border-cyan-500', 'bg-cyan-500/20', 'text-cyan-300');
            } else {
                btn.classList.add('border-emerald-500', 'bg-emerald-500/20', 'text-emerald-300');
            }
        }
    });

    updateEstimator('context', context);
};

/**
 * Load saved paces from localStorage on init
 */
function initThresholdEstimator() {
    if (!window.state) window.state = {};
    if (!window.state.user) window.state.user = {};

    const savedThreshold = localStorage.getItem('elite_thresholdPace');
    const savedEasy = localStorage.getItem('elite_easyPace');

    if (savedThreshold) window.state.user.thresholdPace = parseInt(savedThreshold);
    if (savedEasy) window.state.user.easyPace = parseInt(savedEasy);

    console.log('[ThresholdEstimator] Loaded paces:', {
        threshold: formatPace(window.state.user.thresholdPace),
        easy: formatPace(window.state.user.easyPace)
    });
}

// Auto-init on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThresholdEstimator);
} else {
    initThresholdEstimator();
}

// Exports
window.renderThresholdEstimator = renderThresholdEstimator;
window.calculatePaces = calculatePaces;
window.formatPace = formatPace;
window.ThresholdEstimator = {
    render: renderThresholdEstimator,
    calculate: calculatePaces,
    format: formatPace,
    state: estimatorState
};

console.log('[ThresholdEstimator] Module loaded');
