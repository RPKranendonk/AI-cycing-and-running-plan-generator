// ==========================================
// SCHEDULE TEMPLATE UI - Apple-Like UX
// Free-arrange drag-drop with progressive disclosure
// ==========================================

/**
 * Render modes for progressive disclosure
 */
const RENDER_MODE = {
    READONLY: 'readonly',      // Level 1: Just view
    DRAGGABLE: 'draggable',    // Level 2: Can rearrange
    EDITABLE: 'editable'       // Level 3: Can edit workout details
};

/**
 * Render the weekly template with progressive disclosure
 */
function renderScheduleTemplate(template, container, options = {}) {
    const {
        mode = RENDER_MODE.READONLY,
        weekIndex = 0,
        onTemplateChange = null
    } = options;

    container.innerHTML = '';
    container.className = 'schedule-template-container';

    // Create grid with drop zones
    const grid = document.createElement('div');
    grid.className = 'schedule-grid flex gap-1 p-3 bg-gradient-to-br from-slate-900/80 to-slate-800/50 rounded-xl backdrop-blur-sm';
    grid.dataset.weekIndex = weekIndex;

    template.forEach((slot, index) => {
        // Add drop zone before each card (for insert mode)
        if (mode !== RENDER_MODE.READONLY) {
            const dropZone = createDropZone(index, 'before');
            grid.appendChild(dropZone);
        }

        const card = createSlotCard(slot, index, mode, weekIndex, onTemplateChange);
        grid.appendChild(card);
    });

    // Add final drop zone after last card
    if (mode !== RENDER_MODE.READONLY) {
        const dropZone = createDropZone(template.length, 'after');
        grid.appendChild(dropZone);
    }

    container.appendChild(grid);

    // Hint text based on mode
    if (mode === RENDER_MODE.DRAGGABLE) {
        const hint = document.createElement('div');
        hint.className = 'text-center text-[10px] text-slate-500 mt-2 opacity-0 transition-opacity duration-300';
        hint.id = `drag-hint-${weekIndex}`;
        hint.textContent = 'Drag workouts to rearrange • Tap to edit';
        container.appendChild(hint);
    }

    // Setup drag-drop if enabled
    if (mode !== RENDER_MODE.READONLY) {
        setupFreeDragDrop(grid, template, weekIndex, onTemplateChange);
    }
}

/**
 * Create a drop zone for insert mode
 */
function createDropZone(position, type) {
    const zone = document.createElement('div');
    zone.className = 'drop-zone w-1 min-h-[80px] rounded transition-all duration-200 opacity-0';
    zone.dataset.position = position;
    zone.dataset.type = type;
    return zone;
}

/**
 * Create a single slot card with Apple-like styling
 */
function createSlotCard(slot, index, mode, weekIndex, onTemplateChange) {
    const card = document.createElement('div');
    const colorClasses = getSlotColorClass(slot);

    card.className = `slot-card relative flex flex-col items-center justify-center p-3 rounded-xl min-w-[70px] min-h-[90px] 
        transition-all duration-200 ease-out ${colorClasses}`;
    card.dataset.day = index;
    card.dataset.weekIndex = weekIndex;

    // Draggable styling based on mode
    if (mode !== RENDER_MODE.READONLY && slot.editable) {
        card.draggable = true;
        card.classList.add('cursor-grab', 'active:cursor-grabbing');

        // Hover effect for draggable cards
        card.addEventListener('mouseenter', () => {
            if (!card.classList.contains('dragging')) {
                card.classList.add('scale-[1.02]', 'shadow-lg', 'shadow-cyan-500/10');
            }
            // Show hint
            const hint = document.getElementById(`drag-hint-${weekIndex}`);
            if (hint) hint.classList.remove('opacity-0');
        });

        card.addEventListener('mouseleave', () => {
            card.classList.remove('scale-[1.02]', 'shadow-lg', 'shadow-cyan-500/10');
        });
    }

    // Day label (top)
    const dayLabel = document.createElement('div');
    dayLabel.className = 'text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-1';
    dayLabel.textContent = slot.dayName;
    card.appendChild(dayLabel);

    // Workout icon (center)
    const icon = document.createElement('div');
    icon.className = 'text-2xl my-1 select-none';
    icon.textContent = slot.type ? slot.type.icon : '❓';
    card.appendChild(icon);

    // Workout type label
    const typeLabel = document.createElement('div');
    typeLabel.className = 'text-[11px] font-semibold text-center leading-tight';
    typeLabel.textContent = slot.type ? slot.type.label : 'Tap to set';
    card.appendChild(typeLabel);

    // Duration/Distance (small)
    if (slot.duration > 0 || slot.distance > 0) {
        const detailLabel = document.createElement('div');
        detailLabel.className = 'text-[9px] text-slate-400 mt-1';
        detailLabel.textContent = slot.distance > 0 ? `${slot.distance} km` : `${slot.duration}m`;
        card.appendChild(detailLabel);
    }

    // Lock icon for non-editable slots
    if (!slot.editable && slot.type && slot.type.id !== 'Blocked') {
        const lockBadge = document.createElement('div');
        lockBadge.className = 'absolute -top-1 -right-1 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center text-[8px] text-slate-400';
        lockBadge.textContent = '🔒';
        card.appendChild(lockBadge);
    }

    // Click to edit (Level 3)
    if (mode === RENDER_MODE.EDITABLE && slot.editable) {
        card.addEventListener('click', (e) => {
            if (!card.classList.contains('dragging')) {
                openEditPanel(slot, index, weekIndex, onTemplateChange);
            }
        });
    }

    return card;
}

/**
 * Get Apple-like color classes based on slot type
 */
function getSlotColorClass(slot) {
    if (!slot.type) return 'bg-slate-800/40 border border-dashed border-slate-600/50';

    const colorMap = {
        'LongRun': 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30 text-orange-300',
        'Intervals': 'bg-gradient-to-br from-red-500/20 to-rose-600/10 border border-red-500/30 text-red-300',
        'Tempo': 'bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/30 text-amber-300',
        'Easy': 'bg-gradient-to-br from-emerald-500/15 to-green-600/10 border border-emerald-500/25 text-emerald-300',
        'WeightTraining': 'bg-gradient-to-br from-purple-500/20 to-violet-600/10 border border-purple-500/30 text-purple-300',
        'Yoga': 'bg-gradient-to-br from-teal-500/20 to-cyan-600/10 border border-teal-500/30 text-teal-300',
        'Rest': 'bg-slate-800/30 border border-slate-700/30 text-slate-500',
        'Blocked': 'bg-slate-900/30 border border-slate-800/20 text-slate-600 opacity-40'
    };

    return colorMap[slot.type.id] || 'bg-slate-800/40 border border-slate-600/50';
}

/**
 * Setup free-arrange drag-drop with insert mode
 */
function setupFreeDragDrop(container, template, weekIndex, onTemplateChange) {
    let draggedIndex = null;
    let draggedElement = null;

    container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.slot-card');
        if (!card || !card.draggable) return;

        draggedIndex = parseInt(card.dataset.day);
        draggedElement = card;

        // Apple-like lift effect
        card.classList.add('dragging', 'opacity-60', 'scale-105', 'rotate-2', 'shadow-2xl');
        card.style.zIndex = '100';

        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedIndex);

        // Show all drop zones
        container.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.remove('opacity-0');
            zone.classList.add('bg-cyan-500/20', 'w-3');
        });
    });

    container.addEventListener('dragend', (e) => {
        // Reset all visual states
        if (draggedElement) {
            draggedElement.classList.remove('dragging', 'opacity-60', 'scale-105', 'rotate-2', 'shadow-2xl');
            draggedElement.style.zIndex = '';
        }

        // Hide all drop zones
        container.querySelectorAll('.drop-zone').forEach(zone => {
            zone.classList.add('opacity-0');
            zone.classList.remove('bg-cyan-500/20', 'bg-cyan-400/40', 'w-3', 'w-4');
        });

        draggedIndex = null;
        draggedElement = null;
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    });

    // Drop zone hover effects
    container.addEventListener('dragenter', (e) => {
        const zone = e.target.closest('.drop-zone');
        if (zone) {
            zone.classList.add('bg-cyan-400/40', 'w-4', 'scale-110');
        }
    });

    container.addEventListener('dragleave', (e) => {
        const zone = e.target.closest('.drop-zone');
        if (zone) {
            zone.classList.remove('bg-cyan-400/40', 'w-4', 'scale-110');
        }
    });

    // Handle drop on drop zones (insert mode)
    container.addEventListener('drop', (e) => {
        e.preventDefault();

        const zone = e.target.closest('.drop-zone');
        if (!zone || draggedIndex === null) return;

        const targetPosition = parseInt(zone.dataset.position);

        // Perform the move
        const success = moveWorkout(template, draggedIndex, targetPosition);

        if (success) {
            // Re-render with animation
            renderScheduleTemplate(template, container.parentElement, {
                mode: RENDER_MODE.DRAGGABLE,
                weekIndex,
                onTemplateChange
            });

            if (onTemplateChange) onTemplateChange(template);
            showToast('✨ Schedule updated', 'success');
        }
    });

    // Handle drop on cards (swap mode fallback)
    container.addEventListener('drop', (e) => {
        const card = e.target.closest('.slot-card');
        if (!card || draggedIndex === null) return;

        const targetIndex = parseInt(card.dataset.day);
        if (targetIndex === draggedIndex) return;

        // Validate and apply swap
        const validation = window.validateSwap(template, draggedIndex, targetIndex);
        if (validation.valid) {
            window.applySwap(template, draggedIndex, targetIndex);
            renderScheduleTemplate(template, container.parentElement, {
                mode: RENDER_MODE.DRAGGABLE,
                weekIndex,
                onTemplateChange
            });

            if (onTemplateChange) onTemplateChange(template);
            showToast('✨ Swapped workouts', 'success');
        } else {
            showToast(`⚠️ ${validation.reason}`, 'warning');
        }
    });
}

/**
 * Move a workout to a new position (insert mode)
 */
function moveWorkout(template, fromIndex, toIndex) {
    if (fromIndex === toIndex || fromIndex === toIndex - 1) return false;

    const slot = template[fromIndex];
    if (!slot.editable) {
        showToast('🔒 This workout cannot be moved', 'warning');
        return false;
    }

    // Check if target is valid
    const targetSlot = template[toIndex] || template[toIndex - 1];
    if (targetSlot && targetSlot.priority === 'BLOCKED') {
        showToast('⚠️ Cannot move to unavailable day', 'warning');
        return false;
    }

    // Remove from old position
    const [removed] = template.splice(fromIndex, 1);

    // Adjust target index if needed
    const adjustedTo = fromIndex < toIndex ? toIndex - 1 : toIndex;

    // Insert at new position
    template.splice(adjustedTo, 0, removed);

    // Update day indices
    template.forEach((s, i) => {
        s.day = i;
        s.dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][i];
    });

    return true;
}

/**
 * Open edit panel for a workout slot
 */
function openEditPanel(slot, index, weekIndex, onTemplateChange) {
    // Create panel overlay
    const overlay = document.createElement('div');
    overlay.id = 'edit-panel-overlay';
    overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end justify-center animate-fade-in';

    const panel = document.createElement('div');
    panel.className = 'w-full max-w-md bg-gradient-to-br from-slate-800 to-slate-900 rounded-t-2xl p-6 animate-slide-up';

    panel.innerHTML = `
        <div class="flex justify-between items-center mb-6">
            <h3 class="text-lg font-bold text-white">${slot.dayName}: ${slot.type?.label || 'Unassigned'}</h3>
            <button onclick="closeEditPanel()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-400 hover:text-white transition">
                ×
            </button>
        </div>
        
        <div class="mb-6">
            <label class="text-[10px] uppercase text-slate-400 font-semibold mb-2 block">Workout Type</label>
            <div class="grid grid-cols-4 gap-2" id="type-selector">
                ${Object.values(window.WORKOUT_TYPES).filter(t => t.id !== 'Blocked').map(type => `
                    <button class="type-btn p-3 rounded-xl text-center transition-all ${slot.type?.id === type.id ? 'ring-2 ring-cyan-400 bg-white/10' : 'bg-white/5 hover:bg-white/10'}"
                        data-type-id="${type.id}">
                        <div class="text-2xl mb-1">${type.icon}</div>
                        <div class="text-[9px] text-slate-300">${type.label}</div>
                    </button>
                `).join('')}
            </div>
        </div>
        
        <div class="mb-6">
            <label class="text-[10px] uppercase text-slate-400 font-semibold mb-2 block">Duration</label>
            <div class="flex items-center gap-4">
                <input type="range" id="duration-slider" min="20" max="180" value="${slot.duration || 60}" 
                    class="flex-1 h-2 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-400">
                <span id="duration-value" class="text-cyan-400 font-bold w-16 text-right">${slot.duration || 60} min</span>
            </div>
        </div>
        
        <button onclick="applyEditChanges(${index}, ${weekIndex})" 
            class="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold rounded-xl hover:opacity-90 transition">
            Apply Changes
        </button>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeEditPanel();
    });

    // Setup type selector
    panel.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            panel.querySelectorAll('.type-btn').forEach(b => b.classList.remove('ring-2', 'ring-cyan-400', 'bg-white/10'));
            btn.classList.add('ring-2', 'ring-cyan-400', 'bg-white/10');
        });
    });

    // Duration slider
    const slider = panel.querySelector('#duration-slider');
    const valueDisplay = panel.querySelector('#duration-value');
    slider.addEventListener('input', () => {
        valueDisplay.textContent = `${slider.value} min`;
    });

    // Store callback
    window._editPanelCallback = onTemplateChange;
}

/**
 * Close edit panel
 */
window.closeEditPanel = function () {
    const overlay = document.getElementById('edit-panel-overlay');
    if (overlay) {
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.remove(), 200);
    }
};

/**
 * Apply changes from edit panel
 */
window.applyEditChanges = function (index, weekIndex) {
    const panel = document.querySelector('#edit-panel-overlay');
    if (!panel) return;

    const selectedType = panel.querySelector('.type-btn.ring-2');
    const duration = parseInt(panel.querySelector('#duration-slider').value);

    if (!selectedType) return;

    const typeId = selectedType.dataset.typeId;
    const newType = window.WORKOUT_TYPES[Object.keys(window.WORKOUT_TYPES).find(k => window.WORKOUT_TYPES[k].id === typeId)];

    // Update template in state
    const template = window.state.weeklyTemplates?.[weekIndex];
    if (template && template[index]) {
        template[index].type = newType;
        template[index].duration = duration;

        // Re-render
        const container = document.getElementById(`template-container-${weekIndex}`);
        if (container) {
            renderScheduleTemplate(template, container.parentElement, {
                mode: RENDER_MODE.EDITABLE,
                weekIndex
            });
        }

        if (window._editPanelCallback) window._editPanelCallback(template);
    }

    closeEditPanel();
    showToast('✅ Workout updated', 'success');
};

/**
 * Show toast notification with Apple-like styling
 */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: 'from-emerald-500 to-green-600',
        error: 'from-red-500 to-rose-600',
        warning: 'from-amber-500 to-orange-600',
        info: 'from-cyan-500 to-blue-600'
    };

    toast.className = `px-4 py-2 bg-gradient-to-r ${colors[type]} text-white text-sm font-medium 
        rounded-full shadow-lg backdrop-blur-sm transform transition-all duration-300 animate-bounce-in`;
    toast.textContent = message;

    container.appendChild(toast);

    // Longer duration for error/warning to aid debugging
    const duration = (type === 'error' || type === 'warning') ? 6000 : 3000;

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * Create schedule template section with mode toggle
 */
function createScheduleTemplateSection(weekIndex, weekData, availability, options = {}) {
    const section = document.createElement('div');
    section.className = 'schedule-template-section mb-4';
    section.id = `schedule-template-${weekIndex}`;

    // Header with mode toggle
    const header = document.createElement('div');
    header.className = 'flex justify-between items-center mb-3';
    header.innerHTML = `
        <div class="flex items-center gap-3">
            <span class="text-sm font-semibold text-white">📅 Schedule</span>
            <button id="edit-mode-toggle-${weekIndex}" 
                class="text-[10px] px-2 py-1 rounded-full bg-white/5 text-slate-400 hover:bg-white/10 hover:text-cyan-400 transition-all">
                ✏️ Edit
            </button>
        </div>
        <span class="text-[10px] text-slate-500">AI fills in workout details</span>
    `;
    section.appendChild(header);

    // Template container
    const templateContainer = document.createElement('div');
    templateContainer.id = `template-container-${weekIndex}`;
    section.appendChild(templateContainer);

    // Generate template
    // Note: generateWeeklyTemplate now returns { template, warnings }
    const result = window.generateWeeklyTemplate(weekData, availability);
    const template = Array.isArray(result) ? result : (result?.template || []);

    // Store in state
    if (!window.state.weeklyTemplates) window.state.weeklyTemplates = {};
    window.state.weeklyTemplates[weekIndex] = template;

    // Initial render in readonly mode
    renderScheduleTemplate(template, templateContainer, {
        mode: RENDER_MODE.READONLY,
        weekIndex
    });

    // Toggle handler
    setTimeout(() => {
        const toggle = document.getElementById(`edit-mode-toggle-${weekIndex}`);
        if (toggle) {
            let currentMode = RENDER_MODE.READONLY;
            toggle.addEventListener('click', () => {
                currentMode = currentMode === RENDER_MODE.READONLY ? RENDER_MODE.EDITABLE : RENDER_MODE.READONLY;
                toggle.textContent = currentMode === RENDER_MODE.READONLY ? '✏️ Edit' : '👁️ View';
                toggle.classList.toggle('bg-cyan-500/20', currentMode === RENDER_MODE.EDITABLE);
                toggle.classList.toggle('text-cyan-400', currentMode === RENDER_MODE.EDITABLE);

                renderScheduleTemplate(template, templateContainer, {
                    mode: currentMode,
                    weekIndex
                });
            });
        }
    }, 0);

    return section;
}

// Expose to window
window.RENDER_MODE = RENDER_MODE;
window.renderScheduleTemplate = renderScheduleTemplate;
window.createScheduleTemplateSection = createScheduleTemplateSection;
window.showToast = showToast;
