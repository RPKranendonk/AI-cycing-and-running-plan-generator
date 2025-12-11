// ==========================================
// UI MODALS & NOTIFICATIONS
// Setup modal, confirmation modal, toast, AI loading
// ==========================================

// --- SETUP MODAL HELPERS ---
function openSetup() {
    const modal = document.getElementById('setupModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeSetup() {
    const modal = document.getElementById('setupModal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

function showToast(msg) {
    const t = document.getElementById('toast');
    const msgEl = document.getElementById('toastMsg');
    if (t && msgEl) {
        msgEl.innerText = msg;
        t.classList.remove('translate-x-full');
        setTimeout(() => t.classList.add('translate-x-full'), 3000);
    }
}

// --- AI LOADING OVERLAY ---
let tipInterval;

function showAILoading(message = "Generating AI Plan...") {
    const overlay = document.getElementById('aiLoadingOverlay');
    const messageEl = document.getElementById('loadingMessage');
    const titleEl = document.getElementById('loadingTitle');

    if (overlay) {
        if (titleEl) titleEl.textContent = message;
        overlay.classList.remove('hidden');

        // Start Rotating Tips
        let tipIndex = 0;
        if (messageEl && typeof TRAINING_TIPS !== 'undefined') {
            messageEl.textContent = TRAINING_TIPS[0];
            messageEl.classList.remove('opacity-0');

            if (tipInterval) clearInterval(tipInterval);
            tipInterval = setInterval(() => {
                // Fade out
                messageEl.classList.add('opacity-0');
                messageEl.classList.add('transition-opacity', 'duration-500');

                setTimeout(() => {
                    tipIndex = (tipIndex + 1) % TRAINING_TIPS.length;
                    messageEl.textContent = TRAINING_TIPS[tipIndex];
                    // Fade in
                    messageEl.classList.remove('opacity-0');
                }, 500);
            }, 30000); // Change every 30 seconds
        }
    }
}

function hideAILoading() {
    const overlay = document.getElementById('aiLoadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
    if (tipInterval) {
        clearInterval(tipInterval);
        tipInterval = null;
    }
}

function updateAILoadingText(message) {
    const titleEl = document.getElementById('loadingTitle');
    if (titleEl) {
        titleEl.textContent = message;
    }
}

// --- CONFIRMATION MODAL ---
function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmationModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOkBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (!modal) {
        if (confirm(message)) onConfirm();
        return;
    }

    titleEl.textContent = title;
    msgEl.textContent = message;

    // Clean up old listeners
    const newOk = okBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOk, okBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newOk.addEventListener('click', () => {
        modal.classList.add('hidden');
        onConfirm();
    });

    newCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.classList.remove('hidden');
}

// NOTE: Debug prompt functions (updateDebugPrompt, toggleDebugPrompt, copyDebugPrompt)
// are defined in ui.js with more complete logic including lastDebugPrompt tracking

// --- EXPOSE TO WINDOW ---
window.openSetup = openSetup;
window.closeSetup = closeSetup;
window.showToast = showToast;
window.showAILoading = showAILoading;
window.hideAILoading = hideAILoading;
window.updateAILoadingText = updateAILoadingText;
window.showConfirm = showConfirm;

