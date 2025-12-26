// ==========================================
// WEEKLY CHECK-IN MODAL
// Collects user feedback for Readiness Engine
// ==========================================

/**
 * Open the weekly check-in modal
 */
function openWeeklyCheckIn(weekIndex, weekData = {}) {
    // Store context
    window.checkInContext = { weekIndex, weekData };

    // Get any existing feedback for this week
    const existingFeedback = state.weeklyFeedback?.[weekIndex] || {};

    const overlay = document.createElement('div');
    overlay.id = 'weekly-checkin-modal';
    overlay.className = 'fixed inset-0 bg-slate-950/95 z-[100] flex items-center justify-center backdrop-blur-sm animate-fade-in';

    overlay.innerHTML = `
        <div class="w-full max-w-lg mx-4 bg-gradient-to-br from-slate-800/90 to-slate-900/90 rounded-3xl p-6 shadow-2xl border border-white/10">
            <!-- Header -->
            <div class="text-center mb-6">
                <h2 class="text-2xl font-bold text-white mb-1">Weekly Check-In</h2>
                <p class="text-slate-400 text-sm">How did last week go? This helps us adapt your next week.</p>
            </div>

            <!-- RPE Slider -->
            <div class="mb-5">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-sm font-semibold text-white">💪 Effort (RPE)</label>
                    <span id="rpe-value" class="text-sm font-mono text-cyan-400">${existingFeedback.rpe || 5}</span>
                </div>
                <input type="range" id="checkin-rpe" min="1" max="10" value="${existingFeedback.rpe || 5}" 
                    class="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                    oninput="document.getElementById('rpe-value').textContent = this.value">
                <div class="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>1 Easy</span>
                    <span>5 Moderate</span>
                    <span>10 Max</span>
                </div>
            </div>

            <!-- Motivation -->
            <div class="mb-5">
                <label class="block text-sm font-semibold text-white mb-2">🧠 Motivation Level</label>
                <div class="grid grid-cols-3 gap-2" id="motivation-selector">
                    <button onclick="selectMotivation('Low')" 
                        class="motivation-btn p-3 rounded-xl border-2 ${existingFeedback.motivation === 'Low' ? 'border-amber-500 bg-amber-500/20' : 'border-white/10 bg-slate-800/50'} hover:border-amber-500/50 transition-all">
                        <div class="text-2xl mb-1">😔</div>
                        <div class="text-xs text-slate-300">Low</div>
                    </button>
                    <button onclick="selectMotivation('Normal')" 
                        class="motivation-btn p-3 rounded-xl border-2 ${existingFeedback.motivation === 'Normal' || !existingFeedback.motivation ? 'border-cyan-500 bg-cyan-500/20' : 'border-white/10 bg-slate-800/50'} hover:border-cyan-500/50 transition-all">
                        <div class="text-2xl mb-1">🙂</div>
                        <div class="text-xs text-slate-300">Normal</div>
                    </button>
                    <button onclick="selectMotivation('High')" 
                        class="motivation-btn p-3 rounded-xl border-2 ${existingFeedback.motivation === 'High' ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/10 bg-slate-800/50'} hover:border-emerald-500/50 transition-all">
                        <div class="text-2xl mb-1">🔥</div>
                        <div class="text-xs text-slate-300">High</div>
                    </button>
                </div>
            </div>

            <!-- Soreness -->
            <div class="mb-5">
                <label class="block text-sm font-semibold text-white mb-2">🦵 Muscle Soreness</label>
                <div class="grid grid-cols-3 gap-2" id="soreness-selector">
                    <button onclick="selectSoreness('None')" 
                        class="soreness-btn p-3 rounded-xl border-2 ${existingFeedback.soreness === 'None' || !existingFeedback.soreness ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/10 bg-slate-800/50'} hover:border-emerald-500/50 transition-all">
                        <div class="text-2xl mb-1">✅</div>
                        <div class="text-xs text-slate-300">None</div>
                    </button>
                    <button onclick="selectSoreness('Sore')" 
                        class="soreness-btn p-3 rounded-xl border-2 ${existingFeedback.soreness === 'Sore' ? 'border-amber-500 bg-amber-500/20' : 'border-white/10 bg-slate-800/50'} hover:border-amber-500/50 transition-all">
                        <div class="text-2xl mb-1">😣</div>
                        <div class="text-xs text-slate-300">Sore</div>
                    </button>
                    <button onclick="selectSoreness('Pain')" 
                        class="soreness-btn p-3 rounded-xl border-2 ${existingFeedback.soreness === 'Pain' ? 'border-red-500 bg-red-500/20' : 'border-white/10 bg-slate-800/50'} hover:border-red-500/50 transition-all">
                        <div class="text-2xl mb-1">🩹</div>
                        <div class="text-xs text-slate-300">Pain</div>
                    </button>
                </div>
            </div>

            <!-- Sleep (Optional) -->
            <div class="mb-6">
                <div class="flex justify-between items-center mb-2">
                    <label class="text-sm font-semibold text-white">💤 Avg Sleep (optional)</label>
                    <span id="sleep-value" class="text-sm font-mono text-slate-400">${existingFeedback.sleepHours || 7}h</span>
                </div>
                <input type="range" id="checkin-sleep" min="4" max="10" step="0.5" value="${existingFeedback.sleepHours || 7}" 
                    class="w-full h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-purple-500"
                    oninput="document.getElementById('sleep-value').textContent = this.value + 'h'">
            </div>

            <!-- Readiness Preview -->
            <div id="readiness-preview" class="mb-6 p-4 rounded-xl border hidden">
                <!-- Populated by updateReadinessPreview() -->
            </div>

            <!-- Actions -->
            <div class="flex gap-3">
                <button onclick="closeWeeklyCheckIn()" 
                    class="flex-1 px-4 py-3 bg-slate-700/50 text-slate-300 font-bold rounded-xl hover:bg-slate-600/50 transition-colors">
                    Skip
                </button>
                <button onclick="submitWeeklyCheckIn()" 
                    class="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20">
                    Save & Adapt ✨
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Initialize state
    window.checkInState = {
        rpe: existingFeedback.rpe || 5,
        motivation: existingFeedback.motivation || 'Normal',
        soreness: existingFeedback.soreness || 'None',
        sleepHours: existingFeedback.sleepHours || 7
    };

    // Update preview after render
    setTimeout(() => updateReadinessPreview(), 100);
}

/**
 * Select motivation level
 */
window.selectMotivation = function (level) {
    window.checkInState.motivation = level;

    // Update UI
    document.querySelectorAll('.motivation-btn').forEach(btn => {
        btn.classList.remove('border-amber-500', 'bg-amber-500/20', 'border-cyan-500', 'bg-cyan-500/20', 'border-emerald-500', 'bg-emerald-500/20');
        btn.classList.add('border-white/10', 'bg-slate-800/50');
    });

    const colors = {
        'Low': ['border-amber-500', 'bg-amber-500/20'],
        'Normal': ['border-cyan-500', 'bg-cyan-500/20'],
        'High': ['border-emerald-500', 'bg-emerald-500/20']
    };
    event.currentTarget.classList.remove('border-white/10', 'bg-slate-800/50');
    event.currentTarget.classList.add(...colors[level]);

    updateReadinessPreview();
};

/**
 * Select soreness level
 */
window.selectSoreness = function (level) {
    window.checkInState.soreness = level;

    // Update UI
    document.querySelectorAll('.soreness-btn').forEach(btn => {
        btn.classList.remove('border-emerald-500', 'bg-emerald-500/20', 'border-amber-500', 'bg-amber-500/20', 'border-red-500', 'bg-red-500/20');
        btn.classList.add('border-white/10', 'bg-slate-800/50');
    });

    const colors = {
        'None': ['border-emerald-500', 'bg-emerald-500/20'],
        'Sore': ['border-amber-500', 'bg-amber-500/20'],
        'Pain': ['border-red-500', 'bg-red-500/20']
    };
    event.currentTarget.classList.remove('border-white/10', 'bg-slate-800/50');
    event.currentTarget.classList.add(...colors[level]);

    updateReadinessPreview();
};

/**
 * Update readiness preview in real-time
 */
function updateReadinessPreview() {
    const preview = document.getElementById('readiness-preview');
    if (!preview) return;

    // Get current input values
    const rpeEl = document.getElementById('checkin-rpe');
    const sleepEl = document.getElementById('checkin-sleep');

    if (rpeEl) window.checkInState.rpe = parseInt(rpeEl.value);
    if (sleepEl) window.checkInState.sleepHours = parseFloat(sleepEl.value);

    // Calculate readiness
    const readiness = calculateReadiness({
        rpe: window.checkInState.rpe,
        motivation: window.checkInState.motivation,
        soreness: window.checkInState.soreness,
        sleepHours: window.checkInState.sleepHours,
        baselineSleep: 7.5,
        compliance: null // Will be calculated from actual data later
    });

    const colorClass = getReadinessColorClass(readiness.status);
    const icon = getReadinessIcon(readiness.status);

    preview.className = `mb-6 p-4 rounded-xl border ${colorClass}`;
    preview.classList.remove('hidden');

    preview.innerHTML = `
        <div class="flex items-center gap-3 mb-2">
            <span class="text-2xl">${icon}</span>
            <div>
                <div class="font-bold">${readiness.status} Status</div>
                <div class="text-xs opacity-80">${readiness.recommendation}</div>
            </div>
        </div>
    `;
}

/**
 * Submit weekly check-in
 */
window.submitWeeklyCheckIn = function () {
    const { weekIndex } = window.checkInContext || {};
    const feedback = window.checkInState;

    // Get final values from inputs
    const rpeEl = document.getElementById('checkin-rpe');
    const sleepEl = document.getElementById('checkin-sleep');
    if (rpeEl) feedback.rpe = parseInt(rpeEl.value);
    if (sleepEl) feedback.sleepHours = parseFloat(sleepEl.value);

    // Store feedback in state
    if (!state.weeklyFeedback) state.weeklyFeedback = {};
    state.weeklyFeedback[weekIndex] = {
        ...feedback,
        timestamp: new Date().toISOString()
    };
    localStorage.setItem('elite_weeklyFeedback', JSON.stringify(state.weeklyFeedback));

    // Calculate readiness
    const readiness = calculateReadiness(feedback);

    // Store readiness result
    if (!state.weeklyReadiness) state.weeklyReadiness = {};
    state.weeklyReadiness[weekIndex] = readiness;
    localStorage.setItem('elite_weeklyReadiness', JSON.stringify(state.weeklyReadiness));

    // Close modal
    closeWeeklyCheckIn();

    // Show result toast
    const icon = getReadinessIcon(readiness.status);
    showToast(`${icon} ${readiness.status}: ${readiness.recommendation}`,
        readiness.status === 'GREEN' ? 'success' :
            readiness.status === 'YELLOW' ? 'warning' : 'error');

    console.log('[ReadinessEngine] Check-in saved:', { feedback, readiness });
};

/**
 * Close check-in modal
 */
window.closeWeeklyCheckIn = function () {
    const modal = document.getElementById('weekly-checkin-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 300);
    }
};

// Add event listeners for sliders to update preview
document.addEventListener('input', (e) => {
    if (e.target.id === 'checkin-rpe' || e.target.id === 'checkin-sleep') {
        updateReadinessPreview();
    }
});

// Expose to window
window.openWeeklyCheckIn = openWeeklyCheckIn;

console.log('[WeeklyCheckIn] Modal component loaded');
