// ==========================================
// SUGGESTIONS UI
// Renders adjustment suggestions in a user-friendly way
// ==========================================

const SuggestionsUI = {
    /**
     * Render suggestions panel HTML
     * @param {Object} suggestionsResult - Output from generateAdjustmentSuggestions
     * @returns {string} HTML string
     */
    render(suggestionsResult) {
        if (!suggestionsResult || !suggestionsResult.suggestions) {
            return '<div class="text-muted text-sm">No suggestions available</div>';
        }

        const { suggestions, mode, compliancePercent, summary } = suggestionsResult;

        return `
            <div class="suggestions-panel space-y-4">
                <!-- Header with mode badge -->
                <div class="flex items-center justify-between">
                    <h3 class="font-semibold">💡 Suggestions</h3>
                    <span class="text-xs px-2 py-1 rounded-full ${this.getModeBadgeClass(mode)}">
                        ${mode.charAt(0).toUpperCase() + mode.slice(1)} Mode
                    </span>
                </div>
                
                <!-- Summary -->
                ${summary ? `<p class="text-sm text-secondary">${summary}</p>` : ''}
                
                <!-- Compliance context -->
                ${compliancePercent !== null ? `
                    <div class="text-xs text-muted bg-secondary/10 p-2 rounded-lg">
                        <i class="fa-solid fa-info-circle mr-1"></i>
                        ${compliancePercent}% planned volume completed this week
                    </div>
                ` : ''}
                
                <!-- Suggestions list -->
                <div class="space-y-3">
                    ${suggestions.map(s => this.renderSuggestion(s)).join('')}
                </div>
                
                <!-- Mode toggle -->
                <div class="pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button onclick="SuggestionsUI.showModeSelector()" 
                        class="text-xs text-muted hover:text-secondary transition-colors">
                        <i class="fa-solid fa-gear mr-1"></i> Change suggestion mode
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Render a single suggestion card
     */
    renderSuggestion(suggestion) {
        const { id, title, reason, explanation, severity, dismissable, action } = suggestion;

        return `
            <div class="suggestion-card ${this.getSeverityClass(severity)} p-3 rounded-lg border" data-suggestion-id="${id}">
                <div class="flex items-start justify-between gap-2">
                    <div class="flex-1">
                        <div class="font-medium text-sm">${title}</div>
                        <div class="text-xs text-secondary mt-1">${reason}</div>
                        ${explanation ? `
                            <details class="mt-2">
                                <summary class="text-xs text-muted cursor-pointer hover:text-secondary">
                                    Why this suggestion?
                                </summary>
                                <p class="text-xs text-muted mt-1 pl-2 border-l-2 border-slate-300 dark:border-slate-600">
                                    ${explanation}
                                </p>
                            </details>
                        ` : ''}
                    </div>
                    
                    ${dismissable ? `
                        <button onclick="SuggestionsUI.dismiss('${id}')" 
                            class="text-muted hover:text-secondary p-1" 
                            title="Dismiss this suggestion">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    ` : ''}
                </div>
                
                ${action ? `
                    <div class="mt-3 flex gap-2">
                        <button onclick="SuggestionsUI.apply('${id}')" 
                            class="text-xs px-3 py-1.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-colors">
                            <i class="fa-solid fa-check mr-1"></i> Apply
                        </button>
                        <button onclick="SuggestionsUI.ignore('${id}')" 
                            class="text-xs px-3 py-1.5 bg-slate-500/10 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-500/20 transition-colors">
                            Ignore for now
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    /**
     * Get CSS class for severity
     */
    getSeverityClass(severity) {
        switch (severity) {
            case 'success': return 'bg-emerald-500/10 border-emerald-500/30';
            case 'info': return 'bg-blue-500/10 border-blue-500/30';
            case 'caution': return 'bg-amber-500/10 border-amber-500/30';
            case 'warning': return 'bg-red-500/10 border-red-500/30';
            default: return 'bg-slate-500/10 border-slate-500/30';
        }
    },

    /**
     * Get CSS class for mode badge
     */
    getModeBadgeClass(mode) {
        switch (mode) {
            case 'advisory': return 'bg-blue-500/20 text-blue-600 dark:text-blue-400';
            case 'moderate': return 'bg-amber-500/20 text-amber-600 dark:text-amber-400';
            case 'strict': return 'bg-red-500/20 text-red-600 dark:text-red-400';
            default: return 'bg-slate-500/20 text-slate-600';
        }
    },

    /**
     * Dismiss a suggestion
     */
    dismiss(suggestionId) {
        window.dismissSuggestion?.(suggestionId);
        const el = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (el) {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            setTimeout(() => el.remove(), 200);
        }
        showToast?.('Suggestion dismissed', 'info');
    },

    /**
     * Apply a suggestion
     */
    apply(suggestionId) {
        console.log('[SuggestionsUI] Applying suggestion:', suggestionId);
        // TODO: Actually apply the suggestion to the plan
        showToast?.('Suggestion applied', 'success');
        this.dismiss(suggestionId);
    },

    /**
     * Ignore a suggestion temporarily (doesn't persist)
     */
    ignore(suggestionId) {
        const el = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (el) {
            el.style.opacity = '0.5';
            const buttons = el.querySelectorAll('button');
            buttons.forEach(b => b.disabled = true);
        }
        showToast?.('Ignored for this session', 'info');
    },

    /**
     * Show mode selector modal
     */
    showModeSelector() {
        const currentMode = window.getReadinessMode?.() || 'advisory';

        const html = `
            <div class="p-6 space-y-4">
                <h3 class="text-lg font-semibold">Suggestion Mode</h3>
                <p class="text-sm text-secondary">Choose how strictly the system enforces suggestions.</p>
                
                <div class="space-y-3">
                    <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${currentMode === 'advisory' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-slate-200 dark:border-slate-700'}">
                        <input type="radio" name="readinessMode" value="advisory" ${currentMode === 'advisory' ? 'checked' : ''} class="mt-1">
                        <div>
                            <div class="font-medium">Advisory <span class="text-xs text-muted">(Recommended)</span></div>
                            <div class="text-xs text-secondary">Suggestions are tips. Nothing is blocked. You decide.</div>
                        </div>
                    </label>
                    
                    <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${currentMode === 'moderate' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'border-slate-200 dark:border-slate-700'}">
                        <input type="radio" name="readinessMode" value="moderate" ${currentMode === 'moderate' ? 'checked' : ''} class="mt-1">
                        <div>
                            <div class="font-medium">Moderate</div>
                            <div class="text-xs text-secondary">Stronger nudges. Warnings before progressing with red flags.</div>
                        </div>
                    </label>
                    
                    <label class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${currentMode === 'strict' ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-700'}">
                        <input type="radio" name="readinessMode" value="strict" ${currentMode === 'strict' ? 'checked' : ''} class="mt-1">
                        <div>
                            <div class="font-medium">Strict</div>
                            <div class="text-xs text-secondary">Auto-apply recovery adjustments when readiness is red.</div>
                        </div>
                    </label>
                </div>
                
                <div class="flex justify-end gap-2 pt-3">
                    <button onclick="SuggestionsUI.closeModeSelector()" class="px-4 py-2 text-sm text-muted hover:text-secondary">
                        Cancel
                    </button>
                    <button onclick="SuggestionsUI.saveModeSelection()" class="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600">
                        Save
                    </button>
                </div>
            </div>
        `;

        // Create modal
        let modal = document.getElementById('modeSelectorModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modeSelectorModal';
            modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/50';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div class="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full mx-4">${html}</div>`;
        modal.style.display = 'flex';
    },

    /**
     * Close mode selector
     */
    closeModeSelector() {
        const modal = document.getElementById('modeSelectorModal');
        if (modal) modal.style.display = 'none';
    },

    /**
     * Save mode selection
     */
    saveModeSelection() {
        const selected = document.querySelector('input[name="readinessMode"]:checked');
        if (selected) {
            window.setReadinessMode?.(selected.value);
            showToast?.(`Switched to ${selected.value} mode`, 'success');
        }
        this.closeModeSelector();
    }
};

// Expose to window
window.SuggestionsUI = SuggestionsUI;

console.log('[SuggestionsUI] Loaded');
