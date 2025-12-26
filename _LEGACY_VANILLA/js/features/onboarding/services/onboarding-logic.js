// ==========================================
// ONBOARDING HELPERS & LOGIC
// Logic for sport selection, goals, volume, and paces
// ==========================================

/**
 * Handle Sport Selection
 */
function selectSport(sport) {
    if (!window.wizardState) return;
    window.wizardState.data.sport = sport;
    window.wizardState.data.currentVolume = sport === 'Running' ? 30 : 5;
    window.renderWizardStep(1); // Refresh
}

/**
 * Handle Goal Selection
 */
function selectGoal(goal) {
    if (!window.wizardState) return;
    window.wizardState.data.goal = goal;
    window.renderWizardStep(2); // Refresh
}

/**
 * Update Experience Level
 */
function updateExperience(val) {
    if (!window.wizardState) return;
    const levels = ['Fresh', 'Consistent', 'Pro'];
    window.wizardState.data.experience = levels[parseInt(val)];
}

/**
 * Update Weekly Volume
 */
function updateVolume(val) {
    if (!window.wizardState) return;
    window.wizardState.data.currentVolume = parseInt(val);
    const volumeDisplay = document.querySelector('.text-4xl.font-bold.text-white');
    if (volumeDisplay) volumeDisplay.textContent = val;
}

/**
 * Toggle availability day
 */
function toggleAvailDay(dayIndex) {
    if (!window.wizardState) return;
    if (!window.wizardState.data.availability) window.wizardState.data.availability = {};
    const current = window.wizardState.data.availability[dayIndex] || 0;
    window.wizardState.data.availability[dayIndex] = current > 0 ? 0 : 1.5;
    window.renderWizardStep(3);
}

/**
 * Handle 5K input & Zone Calculation
 */
function wizardFiveKInput(value) {
    if (!window.wizardState) return;
    let formatted = value.replace(/[^0-9:]/g, '');
    if (formatted.length === 2 && !formatted.includes(':')) formatted += ':';
    if (formatted.length > 5) formatted = formatted.slice(0, 5);

    const input = document.getElementById('wizard-5k-input');
    if (input && input.value !== formatted) input.value = formatted;
    window.wizardState.data.fiveKTime = formatted;

    if (window.calculatePaces) {
        const paces = window.calculatePaces(formatted, window.wizardState.data.fitnessContext);
        if (paces) {
            updatePaceDisplay(paces);
            // Sync with global state
            if (!window.state) window.state = {};
            if (!window.state.user) window.state.user = {};
            window.state.user.thresholdPace = paces.thresholdPace;
            window.state.user.easyPace = paces.easyPace;

            // Sync with ZoneService (single source of truth)
            if (window.ZoneService && window.ZoneService.calculateZonesFromLT) {
                window.ZoneService.calculateZonesFromLT(paces.thresholdPace);
            }
        }
    }
}

function updatePaceDisplay(paces) {
    const display = document.getElementById('wizard-pace-display');
    if (!display) return;
    const fPace = window.formatPace || (p => p);
    display.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="glass-panel p-4 rounded-xl border border-white/10 text-center">
                <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">Threshold</div>
                <div class="text-2xl font-bold text-cyan-400">${fPace(paces.thresholdPace)}</div>
                <div class="text-xs text-slate-500">/km</div>
            </div>
            <div class="glass-panel p-4 rounded-xl border border-white/10 text-center">
                <div class="text-xs text-slate-400 uppercase tracking-wider mb-1">Easy Pace</div>
                <div class="text-2xl font-bold text-emerald-400">${fPace(paces.easyPace)}</div>
                <div class="text-xs text-slate-500">/km</div>
            </div>
        </div>
    `;
}

/**
 * Set fitness context (Rusty, Current, Improved)
 */
function wizardSetContext(context) {
    if (!window.wizardState) return;
    window.wizardState.data.fitnessContext = context;
    wizardFiveKInput(window.wizardState.data.fiveKTime || '');
    window.renderWizardStep(3);
}

/**
 * Generate default schedule based on availability
 */
function generateDefaultSchedule() {
    if (!window.wizardState) return [];
    const trainingDays = window.wizardState.data.trainingDays || 5;
    const baseTemplate = window.DEFAULT_SCHEDULES[trainingDays] || window.DEFAULT_SCHEDULES[5];

    // Simple deep copy and adjustment for actual availability
    return JSON.parse(JSON.stringify(baseTemplate));
}

// --- EXPOSE TO WINDOW ---
window.selectSport = selectSport;
window.selectGoal = selectGoal;
window.updateExperience = updateExperience;
window.updateVolume = updateVolume;
window.toggleAvailDay = toggleAvailDay;
window.wizardFiveKInput = wizardFiveKInput;
window.wizardSetContext = wizardSetContext;
window.generateDefaultSchedule = generateDefaultSchedule;

window.OnboardingHelpers = {
    selectSport,
    selectGoal,
    updateExperience,
    updateVolume,
    toggleAvailDay,
    wizardFiveKInput,
    wizardSetContext,
    generateDefaultSchedule
};
