// ==========================================
// WIZARD HELPERS
// Helper functions for Quick Setup Wizard integration
// ==========================================

/**
 * Generate schedule for Quick Setup Wizard
 * Creates synthetic availability based on days count and runs scheduler.
 * @param {number} daysPerWeek - Number of training days (3-7)
 * @param {string} sport - 'Running' or 'Cycling'
 * @param {string} experience - 'Fresh' | 'Consistent' | 'Pro'
 * @param {number} currentVolume - Current weekly volume
 */
window.generateWizardSchedule = function (daysPerWeek, sport = 'Running', experience = 'Consistent', currentVolume = 30) {
    const generateWeeklyTemplate = window.generateWeeklyTemplate;

    // 1. Create Default Availability Pattern (0=Sun to 6=Sat)
    const availability = new Array(7).fill(0);
    const longRunDay = 0;

    // Day Selection Logic
    let activeDays = [];
    if (daysPerWeek === 3) {
        activeDays = [0, 2, 4];
    } else if (daysPerWeek === 4) {
        activeDays = [0, 2, 4, 6];
    } else if (daysPerWeek === 5) {
        activeDays = [0, 2, 3, 4, 6];
    } else if (daysPerWeek === 6) {
        activeDays = [0, 2, 3, 4, 5, 6];
    } else {
        activeDays = [0, 1, 2, 3, 4, 5, 6];
    }

    const dailyHours = experience === 'Pro' ? 3.0 : 2.0;
    activeDays.forEach(d => availability[d] = dailyHours);

    // 2. Configure Rules based on Persona
    const isPro = experience === 'Pro';
    const isBeginner = experience === 'Fresh';

    const weekData = {
        targetVolume: currentVolume || 30,
        longRunDistance: isBeginner ? 5 : (isPro ? 20 : 12),
        phase: 'Base',
        preferredLongRunDay: longRunDay,
        gymTarget: isBeginner ? 1 : 2,
        sport: sport,
        allowDoubles: isPro
    };

    // 3. Generate Template
    const result = generateWeeklyTemplate(weekData, availability);

    // 4. Map back to Wizard Format (0=Mon, 6=Sun)
    const wizardSchedule = new Array(7).fill(null).map((_, i) => ({
        day: i,
        type: 'Rest',
        label: 'Rest'
    }));

    result.template.forEach(slot => {
        const wizardDayIndex = (slot.day + 6) % 7;
        wizardSchedule[wizardDayIndex] = {
            day: wizardDayIndex,
            type: slot.type ? slot.type.id : 'Rest',
            label: slot.type ? slot.type.label : 'Rest',
            secondary: slot.secondary ? { id: slot.secondary.id, label: slot.secondary.label } : null
        };
    });

    return wizardSchedule;
};

/**
 * Generate schedule using actual user availability
 * @param {string} sport - 'Running' or 'Cycling'
 * @param {string} experience - 'Fresh' | 'Consistent' | 'Pro'
 * @param {number} volume - Current weekly volume
 * @param {Object} availability - { 0: hrs, 1: hrs, ..., 6: hrs } (0=Sun format)
 */
window.generateWizardScheduleWithAvailability = function (sport = 'Running', experience = 'Consistent', volume = 30, availability = {}) {
    const generateWeeklyTemplate = window.generateWeeklyTemplate;

    const isPro = experience === 'Pro';
    const isBeginner = experience === 'Fresh';

    // Find the day with most availability for long run
    let longRunDay = 0;
    let maxHours = availability[0] || 0;
    for (let i = 0; i < 7; i++) {
        if ((availability[i] || 0) > maxHours || (i === 0 && (availability[i] || 0) >= 2)) {
            maxHours = availability[i] || 0;
            if ((availability[i] || 0) >= 2) longRunDay = i;
        }
    }

    const weekData = {
        targetVolume: volume || 30,
        longRunDistance: isBeginner ? 5 : (isPro ? 20 : 12),
        phase: 'Base',
        preferredLongRunDay: longRunDay,
        gymTarget: isBeginner ? 1 : 2,
        sport: sport,
        allowDoubles: isPro
    };

    const result = generateWeeklyTemplate(weekData, availability);

    const wizardSchedule = new Array(7).fill(null).map((_, i) => ({
        day: i,
        type: 'Rest',
        label: 'Rest'
    }));

    result.template.forEach(slot => {
        const wizardDayIndex = (slot.day + 6) % 7;
        wizardSchedule[wizardDayIndex] = {
            day: wizardDayIndex,
            type: slot.type ? slot.type.id : 'Rest',
            label: slot.type ? slot.type.label : 'Rest',
            secondary: slot.secondary ? { id: slot.secondary.id, label: slot.secondary.label } : null
        };
    });

    return wizardSchedule;
};

// --- Validation Functions ---

/**
 * Validate if a swap is allowed
 */
function validateSwap(template, fromDay, toDay) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    const fromSlot = template[fromDay];
    const toSlot = template[toDay];

    if (fromSlot.priority === 'BLOCKED' || toSlot.priority === 'BLOCKED') {
        return { valid: false, reason: 'Cannot swap with unavailable days' };
    }

    if (!fromSlot.editable) {
        return { valid: false, reason: 'This workout cannot be moved' };
    }

    const longRunDay = template.findIndex(s => s.type === WORKOUT_TYPES.LONG_RUN);
    const dayBeforeLong = (longRunDay + 6) % 7;
    if (toDay === dayBeforeLong && (fromSlot.type === WORKOUT_TYPES.INTERVALS || fromSlot.type === WORKOUT_TYPES.TEMPO)) {
        return { valid: false, reason: 'Hard workouts cannot be placed day before Long Run' };
    }

    return { valid: true };
}

/**
 * Apply a swap between two days
 */
function applySwap(template, fromDay, toDay) {
    const validation = validateSwap(template, fromDay, toDay);
    if (!validation.valid) {
        console.warn(`[SmartScheduler] Swap rejected: ${validation.reason}`);
        return false;
    }

    const temp = { ...template[fromDay] };
    template[fromDay] = { ...template[toDay], day: fromDay, dayName: template[fromDay].dayName };
    template[toDay] = { ...temp, day: toDay, dayName: template[toDay].dayName };

    const postSwapWarnings = validateWeekLayout(template);
    return { success: true, warnings: postSwapWarnings };
}

/**
 * Validate week layout for dangerous patterns
 */
function validateWeekLayout(template) {
    const WORKOUT_TYPES = window.WORKOUT_TYPES;
    const warnings = [];
    const longRunDay = template.findIndex(s => s.type === WORKOUT_TYPES.LONG_RUN);
    const keyDay = template.findIndex(s => s.type === WORKOUT_TYPES.INTERVALS || s.type === WORKOUT_TYPES.TEMPO);
    const gymDays = template.map((s, i) => s.type === WORKOUT_TYPES.WEIGHT_TRAINING || s.secondary?.id === 'WeightTraining' ? i : -1).filter(i => i !== -1);

    if (keyDay !== -1 && longRunDay !== -1) {
        const dayBeforeLong = (longRunDay + 6) % 7;
        if (keyDay === dayBeforeLong) {
            warnings.push({
                type: 'HARD_DAY_BEFORE_LONG',
                message: '⚠️ Intensity session day before Long Run may impact performance.'
            });
        }
    }

    if (keyDay !== -1) {
        const dayBeforeKey = (keyDay + 6) % 7;
        const dayAfterKey = (keyDay + 1) % 7;
        for (const gymDay of gymDays) {
            if (gymDay === dayBeforeKey || gymDay === dayAfterKey) {
                warnings.push({
                    type: 'GYM_ADJACENT_KEY',
                    message: '⚠️ Strength training adjacent to key workout may reduce recovery.'
                });
                break;
            }
        }
    }

    if (keyDay !== -1 && longRunDay !== -1) {
        const dayAfterKey = (keyDay + 1) % 7;
        if (dayAfterKey === longRunDay) {
            warnings.push({
                type: 'BACK_TO_BACK_KEY',
                message: '⚠️ Back-to-back key sessions (Intensity → Long Run) detected.'
            });
        }
    }

    return warnings;
}

/**
 * Convert template to AI-consumable format
 */
function templateToPromptSlots(template) {
    return template
        .filter(slot => slot.type && slot.type.id !== 'Blocked' && slot.type.id !== 'Rest')
        .map(slot => ({
            day: slot.dayName,
            type: slot.type.label,
            duration: slot.duration,
            distance: slot.distance || 0
        }));
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.validateSwap = validateSwap;
window.applySwap = applySwap;
window.validateWeekLayout = validateWeekLayout;
window.templateToPromptSlots = templateToPromptSlots;

window.WizardHelpers = {
    generateWizardSchedule: window.generateWizardSchedule,
    generateWizardScheduleWithAvailability: window.generateWizardScheduleWithAvailability,
    validateSwap,
    applySwap,
    validateWeekLayout,
    templateToPromptSlots
};
