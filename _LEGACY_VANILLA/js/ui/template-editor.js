// ==========================================
// WEEKLY TEMPLATE EDITOR
// Visual drag-drop interface for rule-based schedule
// User adjusts template → AI fills workout details
// ==========================================

/**
 * Template Editor State
 */
const templateEditorState = {
    weekIndex: null,
    template: null,
    isDragging: false,
    draggedIndex: null,
    warnings: []
};

/**
 * Color classes for workout types
 */
const TEMPLATE_COLORS = {
    'LongRun': { bg: 'from-orange-500/40 to-orange-600/30', border: 'border-orange-500/60', text: 'text-orange-300' },
    'Intervals': { bg: 'from-red-500/40 to-red-600/30', border: 'border-red-500/60', text: 'text-red-300' },
    'Tempo': { bg: 'from-amber-500/40 to-amber-600/30', border: 'border-amber-500/60', text: 'text-amber-300' },
    'Easy': { bg: 'from-emerald-500/40 to-emerald-600/30', border: 'border-emerald-500/60', text: 'text-emerald-300' },
    'WeightTraining': { bg: 'from-purple-500/40 to-purple-600/30', border: 'border-purple-500/60', text: 'text-purple-300' },
    'Yoga': { bg: 'from-teal-500/40 to-teal-600/30', border: 'border-teal-500/60', text: 'text-teal-300' },
    'Rest': { bg: 'from-slate-600/40 to-slate-700/30', border: 'border-slate-500/60', text: 'text-slate-300' },
    'Blocked': { bg: 'from-gray-700/40 to-gray-800/30', border: 'border-gray-600/40', text: 'text-gray-500' }
};

/**
 * Icons for workout types
 */
const TEMPLATE_ICONS = {
    'LongRun': '🏃‍♂️', 'Intervals': '⚡', 'Tempo': '🔥', 'Easy': '🌿',
    'WeightTraining': '💪', 'Yoga': '🧘', 'Rest': '😴', 'Blocked': '🚫'
};

/**
 * Day names starting from Monday
 */
const EDITOR_DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/**
 * Open the template editor for a specific week
 */
function openTemplateEditor(weekIndex) {
    const weekData = state.generatedPlan?.[weekIndex];
    if (!weekData) {
        showToast('Week data not found', 'error');
        return;
    }

    // Get availability - convert Sunday=0 to Monday=0 format
    const availability = {};
    for (let i = 0; i < 7; i++) {
        const origDay = (i + 1) % 7; // Convert Mon=0 to Sun=0 format
        availability[i] = state.dailyAvailability?.[origDay]?.hours || 0;
    }

    // Generate template using smart-scheduler
    // Note: generateWeeklyTemplate now returns { template, warnings }
    const result = generateWeeklyTemplate({
        targetVolume: weekData.rawKm || 40,
        longRunDistance: parseInt(weekData.longRun) || 15,
        phase: weekData.phaseName || 'Base',
        preferredLongRunDay: state.longRunDay || 0,
        gymTarget: 2,
        sport: state.sportType || 'Running'
    }, availability, {
        minSessionDuration: 35
    });

    // Handle both old (array) and new ({ template, warnings }) return formats
    const template = Array.isArray(result) ? result : (result?.template || []);

    // Convert to Monday-first format for display
    const mondayFirstTemplate = [];
    for (let i = 0; i < 7; i++) {
        const origIndex = (i + 1) % 7;
        mondayFirstTemplate.push({
            ...template[origIndex],
            displayDay: i,
            displayDayName: EDITOR_DAY_NAMES[i]
        });
    }

    templateEditorState.weekIndex = weekIndex;
    templateEditorState.template = mondayFirstTemplate;
    templateEditorState.warnings = [];

    renderTemplateEditor(weekIndex, weekData);
}

/**
 * Render the template editor UI
 */
function renderTemplateEditor(weekIndex, weekData) {
    const template = templateEditorState.template;

    // Check if container already exists in the week detail
    let editorContainer = document.getElementById(`template-editor-${weekIndex}`);

    if (!editorContainer) {
        // Create container in the week detail area
        const weekDetail = document.getElementById(`week-detail-${weekIndex}`);
        if (!weekDetail) {
            showToast('Please expand week first', 'warning');
            return;
        }

        editorContainer = document.createElement('div');
        editorContainer.id = `template-editor-${weekIndex}`;
        editorContainer.className = 'template-editor mt-6 animate-fade-in';

        // Insert before the action buttons
        const actionsRow = weekDetail.querySelector('.grid.grid-cols-4');
        if (actionsRow) {
            actionsRow.parentNode.insertBefore(editorContainer, actionsRow);
        } else {
            weekDetail.appendChild(editorContainer);
        }
    }

    let html = `
        <!-- Header -->
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
                <span class="text-xl">📅</span>
                <div>
                    <h3 class="text-base font-bold text-white">Weekly Template</h3>
                    <p class="text-xs text-slate-400">Drag to rearrange • AI will fill workout details</p>
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="resetTemplate(${weekIndex})" 
                    class="px-3 py-1.5 text-xs bg-slate-700/50 text-slate-300 rounded-lg hover:bg-slate-600/50 transition-colors">
                    ↺ Reset
                </button>
                <button onclick="confirmTemplateAndGenerate(${weekIndex})" 
                    class="px-4 py-1.5 text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg hover:opacity-90 transition-all shadow-lg shadow-cyan-500/20">
                    ✨ Generate Details
                </button>
            </div>
        </div>

        <!-- Template Grid -->
        <div class="grid grid-cols-7 gap-2 mb-4" id="template-grid-${weekIndex}">
    `;

    template.forEach((slot, i) => {
        const typeId = slot.type?.id || 'Rest';
        const colors = TEMPLATE_COLORS[typeId] || TEMPLATE_COLORS['Rest'];
        const icon = TEMPLATE_ICONS[typeId] || '❓';
        const label = slot.type?.label || 'Rest';
        const isBlocked = typeId === 'Blocked';
        const isLocked = !slot.editable && typeId !== 'Rest';

        html += `
            <div class="template-slot relative flex flex-col items-center p-3 rounded-xl 
                bg-gradient-to-br ${colors.bg} border-2 ${colors.border} 
                ${isBlocked ? 'opacity-50 cursor-not-allowed' : 'cursor-grab hover:scale-105'} 
                ${isLocked ? 'ring-2 ring-white/20' : ''}
                transition-all duration-200"
                draggable="${!isBlocked}"
                data-slot-index="${i}"
                data-type="${typeId}">
                
                ${isLocked ? '<div class="absolute top-1 right-1 text-[10px] opacity-60">🔒</div>' : ''}
                
                <div class="text-[11px] ${colors.text} font-bold mb-1">${slot.displayDayName}</div>
                <div class="text-2xl mb-1">${icon}</div>
                <div class="text-[10px] font-semibold ${colors.text} text-center leading-tight">${label}</div>
                
                ${slot.distance ? `<div class="text-[9px] text-white/60 mt-1">${slot.distance}km</div>` : ''}
                ${slot.duration && !slot.distance ? `<div class="text-[9px] text-white/60 mt-1">${slot.duration}min</div>` : ''}
                
                <div class="text-[8px] text-white/40 mt-1">${slot.availableHours}h avail</div>
            </div>
        `;
    });

    html += '</div>';

    // Warnings area
    html += `<div id="template-warnings-${weekIndex}" class="space-y-2 mb-4"></div>`;

    // Info box
    html += `
        <div class="p-3 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 rounded-xl border border-cyan-500/20">
            <div class="flex items-start gap-3">
                <span class="text-xl">✨</span>
                <div>
                    <div class="text-sm font-bold text-white">Ready for AI details?</div>
                    <div class="text-xs text-slate-400">
                        Adjust the template if needed, then click "Generate Details" to have AI create specific workouts 
                        (paces, intervals, durations) for each session.
                    </div>
                </div>
            </div>
        </div>
    `;

    editorContainer.innerHTML = html;

    // Setup drag-drop handlers
    setupTemplateDragDrop(weekIndex);

    // Validate and show warnings
    validateTemplate(weekIndex);
}

/**
 * Setup drag-drop for template slots
 */
function setupTemplateDragDrop(weekIndex) {
    const grid = document.getElementById(`template-grid-${weekIndex}`);
    if (!grid) return;

    const slots = grid.querySelectorAll('.template-slot[draggable="true"]');

    slots.forEach(slot => {
        slot.addEventListener('dragstart', (e) => {
            templateEditorState.isDragging = true;
            templateEditorState.draggedIndex = parseInt(slot.dataset.slotIndex);
            slot.classList.add('opacity-50', 'scale-95');
            e.dataTransfer.effectAllowed = 'move';
        });

        slot.addEventListener('dragend', () => {
            templateEditorState.isDragging = false;
            slot.classList.remove('opacity-50', 'scale-95');
        });

        slot.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        slot.addEventListener('dragenter', (e) => {
            e.preventDefault();
            if (slot.dataset.type !== 'Blocked') {
                slot.classList.add('ring-4', 'ring-cyan-400', 'scale-110');
            }
        });

        slot.addEventListener('dragleave', () => {
            slot.classList.remove('ring-4', 'ring-cyan-400', 'scale-110');
        });

        slot.addEventListener('drop', (e) => {
            e.preventDefault();
            slot.classList.remove('ring-4', 'ring-cyan-400', 'scale-110');

            const targetIndex = parseInt(slot.dataset.slotIndex);
            const sourceIndex = templateEditorState.draggedIndex;

            if (sourceIndex === null || sourceIndex === targetIndex) return;
            if (slot.dataset.type === 'Blocked') {
                showToast('Cannot swap with unavailable day', 'warning');
                return;
            }

            // Perform swap with validation
            performTemplateSwap(weekIndex, sourceIndex, targetIndex);
        });
    });
}

/**
 * Perform swap between two template slots with validation
 */
function performTemplateSwap(weekIndex, sourceIndex, targetIndex) {
    const template = templateEditorState.template;
    const sourceSlot = template[sourceIndex];
    const targetSlot = template[targetIndex];

    // Check if source is locked (non-editable KEY workout)
    if (!sourceSlot.editable && sourceSlot.type?.priority === 'KEY') {
        showToast(`${sourceSlot.type.label} is locked and cannot be moved`, 'warning');
        return;
    }

    // Perform the swap
    const temp = { ...sourceSlot };
    template[sourceIndex] = {
        ...targetSlot,
        displayDay: sourceSlot.displayDay,
        displayDayName: sourceSlot.displayDayName,
        day: sourceSlot.day
    };
    template[targetIndex] = {
        ...temp,
        displayDay: targetSlot.displayDay,
        displayDayName: targetSlot.displayDayName,
        day: targetSlot.day
    };

    // Re-render
    const weekData = state.generatedPlan?.[weekIndex];
    renderTemplateEditor(weekIndex, weekData);

    showToast('Template updated', 'success');
}

/**
 * Validate template and show warnings
 */
function validateTemplate(weekIndex) {
    const template = templateEditorState.template;
    const warnings = [];

    // Find key positions
    let longRunIndex = template.findIndex(s => s.type?.id === 'LongRun');
    let intervalsIndex = template.findIndex(s => s.type?.id === 'Intervals');
    let tempoIndex = template.findIndex(s => s.type?.id === 'Tempo');

    // Rule 1: Long Run should have rest/easy day after
    if (longRunIndex !== -1) {
        const nextDay = (longRunIndex + 1) % 7;
        const nextSlot = template[nextDay];
        if (nextSlot.type?.id !== 'Rest' && nextSlot.type?.id !== 'Easy' && nextSlot.type?.id !== 'Blocked') {
            warnings.push({
                level: 'warning',
                message: `⚠️ Recovery: Consider rest or easy day after Long Run (${template[longRunIndex].displayDayName})`,
                fix: () => swapToRest(weekIndex, nextDay)
            });
        }
    }

    // Rule 2: Intervals/Tempo should not be day before Long Run
    if (longRunIndex !== -1) {
        const dayBeforeLong = (longRunIndex - 1 + 7) % 7;
        const slotBefore = template[dayBeforeLong];
        if (slotBefore.type?.id === 'Intervals' || slotBefore.type?.id === 'Tempo') {
            warnings.push({
                level: 'error',
                message: `🔴 Hard workout (${slotBefore.type.label}) on ${slotBefore.displayDayName} will fatigue you for Long Run`,
                fix: null
            });
        }
    }

    // Rule 3: Back-to-back hard days
    for (let i = 0; i < 6; i++) {
        const slot = template[i];
        const nextSlot = template[i + 1];
        if ((slot.type?.id === 'Intervals' || slot.type?.id === 'Tempo' || slot.type?.id === 'LongRun') &&
            (nextSlot.type?.id === 'Intervals' || nextSlot.type?.id === 'Tempo')) {
            warnings.push({
                level: 'warning',
                message: `⚠️ Back-to-back hard days: ${slot.displayDayName} + ${nextSlot.displayDayName}`,
                fix: null
            });
        }
    }

    // Rule 4: Strength within 48h of Long Run
    if (longRunIndex !== -1) {
        const dayBefore = (longRunIndex - 1 + 7) % 7;
        const twoDaysBefore = (longRunIndex - 2 + 7) % 7;
        [dayBefore, twoDaysBefore].forEach(d => {
            if (template[d].type?.id === 'WeightTraining') {
                warnings.push({
                    level: 'info',
                    message: `ℹ️ Strength on ${template[d].displayDayName} is within 48h of Long Run`,
                    fix: null
                });
            }
        });
    }

    // Render warnings
    const warningsContainer = document.getElementById(`template-warnings-${weekIndex}`);
    if (warningsContainer) {
        if (warnings.length === 0) {
            warningsContainer.innerHTML = `
                <div class="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center gap-2">
                    ✅ Template looks good! No scheduling conflicts.
                </div>
            `;
        } else {
            warningsContainer.innerHTML = warnings.map(w => `
                <div class="p-2 ${w.level === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                    w.level === 'warning' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' :
                        'bg-blue-500/10 border-blue-500/30 text-blue-400'} 
                    border rounded-lg text-xs flex items-center justify-between">
                    <span>${w.message}</span>
                </div>
            `).join('');
        }
    }

    templateEditorState.warnings = warnings;
}

/**
 * Reset template to default
 */
window.resetTemplate = function (weekIndex) {
    openTemplateEditor(weekIndex);
    showToast('Template reset to default', 'info');
};

/**
 * Confirm template and trigger AI generation
 */
window.confirmTemplateAndGenerate = function (weekIndex) {
    const template = templateEditorState.template;
    const hasErrors = templateEditorState.warnings.some(w => w.level === 'error');

    if (hasErrors) {
        showToast('Please fix errors before generating', 'error');
        return;
    }

    // Store the confirmed template in state
    if (!state.weeklyTemplates) state.weeklyTemplates = {};
    state.weeklyTemplates[weekIndex] = template;
    localStorage.setItem('elite_weeklyTemplates', JSON.stringify(state.weeklyTemplates));

    // Close the template editor
    const editor = document.getElementById(`template-editor-${weekIndex}`);
    if (editor) {
        editor.classList.add('opacity-0', 'scale-95');
        setTimeout(() => editor.remove(), 200);
    }

    showToast('✨ Template confirmed! Generating workout details...', 'success');

    // Trigger AI generation for this week with the template
    setTimeout(() => {
        if (typeof preparePlanWithAI === 'function') {
            preparePlanWithAI('week', [weekIndex]);
        }
    }, 300);
};

/**
 * Open template editor from week card
 */
window.openTemplateEditor = openTemplateEditor;

console.log('[TemplateEditor] Weekly template editor loaded');
