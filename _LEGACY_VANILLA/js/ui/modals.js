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
    const messageEl = document.getElementById('loadingMessage'); // Now the subtitle
    const titleEl = document.getElementById('loadingTitle'); // Now the main title ("Crafting Plan...")

    if (overlay) {
        if (titleEl) titleEl.textContent = "Crafting Plan..."; // Keep static valid title or use message
        // Actually, let's use the message for the Title if it's short, or the subtitle if long.
        // For consistency with previous logic:
        if (titleEl) titleEl.textContent = message;

        overlay.classList.remove('hidden');

        // Start Rotating Tips - begin with random tip
        let tipIndex = Math.floor(Math.random() * TRAINING_TIPS.length);
        if (messageEl && typeof TRAINING_TIPS !== 'undefined') {
            messageEl.textContent = TRAINING_TIPS[tipIndex];
            messageEl.classList.remove('opacity-0');

            if (tipInterval) clearInterval(tipInterval);
            tipInterval = setInterval(() => {
                // Fade out
                messageEl.classList.add('opacity-0');

                setTimeout(() => {
                    tipIndex = (tipIndex + 1) % TRAINING_TIPS.length;
                    messageEl.textContent = TRAINING_TIPS[tipIndex];
                    // Fade in
                    messageEl.classList.remove('opacity-0');
                }, 500);
            }, 20000); // Slower rotation (12s) for better readability
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

// --- INPUT MODAL (Dynamic) ---
function showInputModal(title, message, placeholder, onConfirm) {
    let modal = document.getElementById('inputModal');

    // Create if not exists
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'inputModal';
        modal.className = 'fixed inset-0 bg-black/80 z-50 hidden flex items-center justify-center backdrop-blur-sm animate-fade-in';
        modal.innerHTML = `
            <div class="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl transform transition-all scale-100">
                <h3 id="inputModalTitle" class="text-xl font-bold text-white mb-2"></h3>
                <p id="inputModalMessage" class="text-slate-400 text-sm mb-4"></p>
                <textarea id="inputModalField" rows="3" class="w-full bg-slate-800/50 border border-white/10 rounded-lg p-3 text-white text-sm focus:border-cyan-500 outline-none mb-6 resize-none" placeholder=""></textarea>
                <div class="flex justify-end gap-3">
                    <button id="inputModalCancel" class="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-sm font-semibold">Cancel</button>
                    <button id="inputModalConfirm" class="px-6 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold hover:shadow-lg hover:shadow-cyan-500/20 transition-all text-sm">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Elements
    const titleEl = modal.querySelector('#inputModalTitle');
    const msgEl = modal.querySelector('#inputModalMessage');
    const inputEl = modal.querySelector('#inputModalField');
    const cancelBtn = modal.querySelector('#inputModalCancel');
    const confirmBtn = modal.querySelector('#inputModalConfirm');

    // Set Content
    titleEl.textContent = title;
    msgEl.textContent = message;
    inputEl.placeholder = placeholder || "Enter text...";
    inputEl.value = ""; // Clear previous

    // Show
    modal.classList.remove('hidden');
    inputEl.focus();

    // Handlers
    const close = () => {
        modal.classList.add('hidden');
        // Clean up listeners to avoid dupes? Cloning is safer.
        confirmBtn.replaceWith(confirmBtn.cloneNode(true));
        cancelBtn.replaceWith(cancelBtn.cloneNode(true));
    };

    // Re-select after clone
    const newConfirm = modal.querySelector('#inputModalConfirm');
    const newCancel = modal.querySelector('#inputModalCancel');

    newCancel.onclick = close;

    newConfirm.onclick = () => {
        const val = inputEl.value.trim();
        if (val) {
            onConfirm(val);
            close();
        } else {
            inputEl.classList.add('border-red-500');
            setTimeout(() => inputEl.classList.remove('border-red-500'), 500);
        }
    };
}

window.showInputModal = showInputModal;



// --- PRO MODE TOGGLE ---
window.toggleProMode = function() {
    document.body.classList.toggle('pro-mode');
    const isPro = document.body.classList.contains('pro-mode');
    showToast(isPro ? "Pro Mode Enabled 🔧" : "Simple Mode Active ✨");
    localStorage.setItem('elite_proMode', isPro);
};

// Initialize Pro Mode State
if (localStorage.getItem('elite_proMode') === 'true') {
    document.body.classList.add('pro-mode');
}
