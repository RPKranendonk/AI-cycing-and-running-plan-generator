/**
 * Debug Modal Manager
 * Handles the display and interaction with the AI Context Debugger
 */
window.DebugModal = {
    updatePrompt: function (promptText) {
        window.lastDebugPrompt = promptText;

        // Legacy/Modal Debugger
        const contentEl = document.getElementById('debugPromptContent');
        if (contentEl) {
            contentEl.textContent = promptText;
        }

        // New/Floating Debugger
        const textEl = document.getElementById('aiContextText');
        if (textEl) {
            textEl.value = promptText;
        }

        console.log("Debug Prompt updated (" + promptText.length + " chars)");
    },

    toggle: function (forceState) {
        const modal = document.getElementById('debugPromptModal');
        if (!modal) return;

        const isHidden = modal.classList.contains('hidden');
        const shouldShow = forceState !== undefined ? forceState : isHidden;

        if (shouldShow) {
            modal.classList.remove('hidden');
        } else {
            modal.classList.add('hidden');
        }
    },

    copy: function () {
        if (!window.lastDebugPrompt) return;
        navigator.clipboard.writeText(window.lastDebugPrompt).then(() => {
            showToast("Prompt copied to clipboard!");
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            showToast("Failed to copy");
        });
    }
};

// Global Exposes
window.updateDebugPrompt = DebugModal.updatePrompt.bind(DebugModal);
window.toggleDebugPrompt = DebugModal.toggle.bind(DebugModal);
window.copyDebugPrompt = DebugModal.copy.bind(DebugModal);

// Init global var if needed
if (typeof window.lastDebugPrompt === 'undefined') {
    window.lastDebugPrompt = "";
}
