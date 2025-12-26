/**
 * Step Renderer - New Apple-Style Onboarding
 * Completely replaces the old wizard with a high-fidelity mobile-first design.
 */

// --- STYLING CONSTANTS ---
const STYLES = {
    appleBlue: '#0071E3',
    appleBlueHover: '#0077ED',
    appleBg: '#F5F5F7',
    surfaceWhite: '#FFFFFF',
    textPrimary: '#1D1D1F',
    textSecondary: '#86868B',
    borderSubtle: '#D2D2D7',
    iosCard: 'rounded-[1.375rem]', // 22px
    iosBtn: 'rounded-[9999px]',
    shadowSoft: 'shadow-[0_4px_24px_rgba(0,0,0,0.04)]',
    shadowHover: 'shadow-[0_8px_32px_rgba(0,0,0,0.08)]'
};

/**
 * Open the Quick Setup Wizard
 */
function openQuickSetup() {
    // Reset state
    window.wizardState.currentStep = 1;
    // Ensure data object is ready
    if (!window.wizardState.data) window.wizardState.data = {};

    // Inject custom styles for animations and specific iOS-like behaviors
    const styleId = 'onboarding-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .smooth-transition { transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); }
            .ios-radio:checked + div { border-color: #0071E3; box-shadow: 0 0 0 1px #0071E3; background-color: #F8FAFF; }
            .ios-radio:checked + div .check-icon { opacity: 1; transform: scale(1); }
            .ios-radio:checked + div .icon-wrapper { background-color: #0071E3; color: white; box-shadow: 0 4px 12px rgba(0, 113, 227, 0.2); }
            .check-icon { opacity: 0; transform: scale(0.8); transition: all 0.2s ease; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            .animate-slide-up { animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
            
            /* Custom Utility Classes matching User Config */
            .rounded-ios-card { border-radius: 1.375rem; }
            .rounded-ios-btn { border-radius: 9999px; }
            .shadow-soft-card { box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04); }
            .bg-apple-bg { background-color: #F5F5F7; }
            .text-apple-blue { color: #0071E3; }
            .bg-apple-blue { background-color: #0071E3; }
            .hover\\:bg-apple-blue-hover:hover { background-color: #0077ED; }
            .filled { font-variation-settings: 'FILL' 1; }
            .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border-width: 0; }
            .toggle-checkbox:checked + div { background-color: #0071E3; }
            .toggle-checkbox:checked + div > div { transform: translateX(20px); }
        `;
        document.head.appendChild(style);
    }

    // Create Modal Overlay
    const overlay = document.createElement('div');
    overlay.id = 'quick-setup-wizard';
    overlay.className = 'fixed inset-0 bg-[#F5F5F7]/90 z-[100] flex items-center justify-center backdrop-blur-md animate-fade-in font-sans';
    // Use innerHTML structure that mimics the user's provided container
    overlay.innerHTML = `
        <div class="relative mx-auto flex h-full w-full max-w-md flex-col overflow-hidden bg-white sm:h-[844px] sm:rounded-[40px] sm:shadow-2xl shadow-soft-card animate-slide-up">
            <!-- Header for Back Button -->
            <div class="absolute top-6 left-6 z-20">
                <button id="wizard-back-btn" onclick="window.wizardBack()" class="hidden w-10 h-10 rounded-full bg-gray-100/50 hover:bg-gray-200 backdrop-blur-md flex items-center justify-center text-[#1D1D1F] transition-all">
                    <span class="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
            </div>
            
            <div id="wizard-content" class="flex-1 flex flex-col h-full overflow-hidden relative">
                <!-- Content injected by renderWizardStep -->
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    renderWizardStep(1);
}

/**
 * Render logic for each step
 */
function renderWizardStep(step) {
    window.wizardState.currentStep = step;
    const content = document.getElementById('wizard-content');
    if (!content) return;

    // Routing Logic
    let html = '';
    switch (step) {
        case 1: html = renderStepActivity(); break;
        case 2: html = renderStepExperience(); break;
        case 3: html = renderStepGoal(); break;
        case 4: html = renderStepGoalDate(); break;
        case 5:
            // Only show LT Pace for runners
            if (window.wizardState.data.sport === 'Running') {
                html = renderStepLTPace();
            } else {
                renderWizardStep(6); // Skip to Availability
                return;
            }
            break;
        case 6: html = renderStepAvailability(); break;
        case 7: html = renderStepGymAccess(); break;
        case 8: html = renderStepSummary(); break;
        default: break;
    }

    // Manage Back Button Visibility
    const backBtn = document.getElementById('wizard-back-btn');
    if (backBtn) {
        if (step > 1) {
            backBtn.classList.remove('hidden');
        } else {
            backBtn.classList.add('hidden');
        }
    }

    content.innerHTML = html;

    // Bind events after render if needed
}

// --- STEP 1: ACTIVITY ---
function renderStepActivity() {
    const selected = window.wizardState.data.sport;
    return `
        <div class="px-8 pt-12 pb-6">
            <div class="flex items-center gap-2 mb-10 px-1">
                 <div class="h-1 flex-1 rounded-full bg-[#0071E3] transition-all duration-500"></div>
                 <div class="h-1 flex-1 rounded-full bg-gray-200"></div>
                 <div class="h-1 flex-1 rounded-full bg-gray-200"></div>
            </div>
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-4 text-[#1D1D1F]">What moves you?</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide">We’ll tailor your daily flow based on your primary focus.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-8 py-2 space-y-5 no-scrollbar">
            ${_renderRadioOption('sport', 'Running', 'directions_run', 'Runner', '5k to Marathon', selected)}
            ${_renderRadioOption('sport', 'Cycling', 'directions_bike', 'Cyclist', 'Road & Trail', selected)}
            ${_renderRadioOption('sport', 'Longevity', 'ecg_heart', 'Longevity', 'Health & Mobility', selected)}
        </div>
        ${_renderFooter('Continue', 1)}
    `;
}

// --- STEP 2: EXPERIENCE ---
function renderStepExperience() {
    const selected = window.wizardState.data.experience_level;
    const unit = window.wizardState.data.sport === 'Running' ? 'km' : 'hours';
    // Adapting labels based on sport? For now keeping generic or assuming Running logic as base.

    return `
        <div class="px-8 pt-12 pb-4">
             <div class="flex items-center gap-2 mb-8 px-1">
                 <div class="h-1 flex-1 rounded-full bg-[#0071E3]"></div>
                 <div class="h-1 flex-1 rounded-full bg-[#0071E3] transition-all duration-500"></div>
                 <div class="h-1 flex-1 rounded-full bg-gray-200"></div>
            </div>
            <h1 class="text-[34px] font-semibold tracking-tight leading-[1.1] mb-3 text-[#1D1D1F]">Running experience</h1>
            <p class="text-[#86868B] text-[17px] font-normal leading-relaxed tracking-wide">Select your current weekly volume.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-6 py-2 space-y-3 no-scrollbar">
            ${_renderRadioOption('experience_level', 'beginner', 'directions_walk', 'Beginner', '0–15 km / week', selected)}
            ${_renderRadioOption('experience_level', 'intermediate', 'directions_run', 'Intermediate', '15–40 km / week', selected)}
            ${_renderRadioOption('experience_level', 'advanced', 'trophy', 'Advanced', '40+ km / week', selected)}
        </div>
        ${_renderFooter('Continue', 2)}
    `;
}

// --- STEP 3: GOAL ---
function renderStepGoal() {
    const selected = window.wizardState.data.goal;
    return `
        <div class="px-8 pt-12 pb-6">
            <div class="flex items-center gap-2 mb-10 px-1">
                 <div class="h-1 flex-1 rounded-full bg-[#0071E3]"></div>
                 <div class="h-1 flex-1 rounded-full bg-[#0071E3]"></div>
                 <div class="h-1 flex-1 rounded-full bg-[#0071E3] transition-all duration-500"></div>
            </div>
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-4 text-[#1D1D1F]">Set your goal</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide">We’ll adapt your training plan to help you reach your target.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-8 py-2 space-y-4 no-scrollbar">
            ${_renderRadioOption('goal', 'faster', 'bolt', 'Get Faster', 'Improve speed & power', selected)}
            ${_renderRadioOption('goal', 'weight', 'local_fire_department', 'Lose Weight', 'Burn fat & calories', selected)}
            ${_renderRadioOption('goal', 'event', 'flag', 'Event Prep', 'Train for a specific date', selected)}
            ${_renderRadioOption('goal', 'wellness', 'favorite', 'Health & Wellness', 'Longevity & stress relief', selected)}
        </div>
        ${_renderFooter('Continue', 3)}
    `;
}

// --- STEP 4: GOAL DATE ---
function renderStepGoalDate() {
    const date = window.wizardState.data.raceDate || new Date().toISOString().split('T')[0];
    const isEvent = window.wizardState.data.trainingGoal === 'event';

    return `
        <div class="px-8 pt-12 pb-6">
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-4 text-[#1D1D1F]">When is the big day?</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide">We’ll optimize your training schedule to peak exactly when it matters.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-8 py-2 space-y-6 no-scrollbar">
            <div class="relative group cursor-pointer transition-transform active:scale-[0.99]" id="date-card">
                 <input type="date" value="${date}" onchange="window.updateWizardDate(this.value)" class="absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0" />
                 <div class="relative flex flex-col items-center justify-center rounded-[1.375rem] bg-[#F5F5F7] border border-transparent p-8 text-center hover:bg-gray-100 ring-1 ring-transparent focus-within:ring-[#0071E3]/50">
                     <div class="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#0071E3] shadow-sm">
                         <span class="material-symbols-outlined text-[32px]">calendar_month</span>
                     </div>
                     <span class="mb-1 text-[15px] font-medium text-[#86868B]">Target Goal Date</span>
                     <div class="mb-3 text-[34px] font-bold tracking-tight text-[#1D1D1F]">${_formatDateDisplay(date)}</div>
                 </div>
            </div>
            
            <label class="group relative block cursor-pointer select-none">
                <input type="checkbox" class="peer sr-only" onchange="window.toggleJustTraining(this.checked)" ${!isEvent ? 'checked' : ''}/>
                <div class="relative flex items-center justify-between rounded-[1.375rem] bg-[#F5F5F7] border border-transparent p-5 transition-all hover:bg-gray-100 active:scale-[0.99]">
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[17px] font-semibold leading-snug text-[#1D1D1F]">Just Training</span>
                        <span class="text-[15px] text-[#86868B]">I don't have a specific event</span>
                    </div>
                    <div class="relative h-[31px] w-[51px] rounded-full bg-[#E9E9EA] transition-colors duration-200 peer-checked:bg-[#0071E3]">
                        <div class="absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-[20px]"></div>
                    </div>
                </div>
            </label>
        </div>
        ${_renderFooter('Continue', 4)}
    `;
}

// --- STEP 5: LT PACE ---
function renderStepLTPace() {
    // We store as object {min, sec} or string "MM:SS"? 
    // Let's rely on global state helpers if possible, or simple local state
    const pace = window.wizardState.data.thresholdPace || { min: 5, sec: 0 };

    return `
        <div class="px-8 pt-12 pb-2">
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-4 text-[#1D1D1F]">Threshold Pace</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide">Your Lactate Threshold (LT) pace defines your training zones.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-8 py-4 space-y-8 no-scrollbar">
            <div class="bg-[#F5F5F7] p-6 rounded-[1.375rem] space-y-4">
                <div class="flex items-center justify-between">
                    <label class="text-[17px] font-semibold text-[#1D1D1F]">Manual Entry</label>
                    <span class="text-[13px] font-medium text-[#0071E3] bg-blue-50 px-3 py-1 rounded-full">Recommended</span>
                </div>
                <div class="flex items-center gap-3">
                    <div class="relative flex-1">
                        <input type="number" placeholder="00" value="${pace.min}" onchange="window.updateWizardPace('min', this.value)"
                            class="w-full bg-white border-none rounded-xl text-center text-[32px] font-bold text-[#1D1D1F] h-20 shadow-sm focus:ring-0 focus:shadow-[0_0_0_4px_rgba(0,113,227,0.15)] placeholder-gray-300 transition-shadow duration-200 caret-[#0071E3]" />
                        <span class="absolute bottom-2 left-0 right-0 text-center text-[12px] text-[#86868B] font-medium uppercase tracking-wider">Min</span>
                    </div>
                    <span class="text-[32px] font-bold text-[#86868B] pb-6">:</span>
                    <div class="relative flex-1">
                        <input type="number" placeholder="00" value="${pace.sec}" onchange="window.updateWizardPace('sec', this.value)"
                            class="w-full bg-white border-none rounded-xl text-center text-[32px] font-bold text-[#1D1D1F] h-20 shadow-sm focus:ring-0 focus:shadow-[0_0_0_4px_rgba(0,113,227,0.15)] placeholder-gray-300 transition-shadow duration-200 caret-[#0071E3]" />
                        <span class="absolute bottom-2 left-0 right-0 text-center text-[12px] text-[#86868B] font-medium uppercase tracking-wider">Sec</span>
                    </div>
                </div>
                <p class="text-center text-[15px] text-[#86868B]">per km</p>
            </div>
            
             <div class="mt-5 text-center">
                <button onclick="window.wizardNext()" class="text-[15px] font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors px-4 py-1 rounded-full">
                    I don't know my pace
                </button>
            </div>
        </div>
        ${_renderFooter('Continue', 5)}
    `;
}

// --- STEP 6: AVAILABILITY (Granular) ---
function renderStepAvailability() {
    // Ensure availability data exists
    if (!window.wizardState.data.availability || !Array.isArray(window.wizardState.data.availability)) {
        // Initialize with default (Mon=1h, etc.)
        window.wizardState.data.availability = Array(7).fill(null).map(() => ({
            hours: 1.5,
            split: false,
            amHours: 0,
            pmHours: 0
        }));
    }
    const avail = window.wizardState.data.availability;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    // Render Rows
    const rowsHtml = avail.map((d, i) => _renderAvailabilityRow(i, days[i], d)).join('');

    return `
        <div class="px-8 pt-12 pb-2">
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-2 text-[#1D1D1F]">Weekly Schedule</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide mb-6">Set your daily training capacity.</p>
        </div>
        
        <div class="flex-1 overflow-y-auto px-6 py-2 pb-20 no-scrollbar space-y-4">
            ${rowsHtml}
        </div>
        
        ${_renderFooter('Continue', 6)}
    `;
}

function _renderAvailabilityRow(index, dayName, data) {
    const isRest = data.hours === 0;
    const isSplit = data.split;
    // Slider value (if rest, default slider to 0, else data.hours)

    return `
    <div class="bg-[#F5F5F7] p-4 rounded-[1.375rem] transition-all">
        <!-- Top Row: Label + Main Controls -->
        <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-[#1D1D1F] shadow-sm text-sm">
                    ${dayName}
                </div>
                ${index === 0 ? `
                    <button onclick="window.copyDayToAll(${index})" class="text-[11px] font-bold text-[#0071E3] bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors">
                        Copy to All
                    </button>
                ` : ''}
            </div>
            
            <div class="flex items-center gap-3">
                 <div class="flex flex-col items-end">
                    <span class="text-[20px] font-bold text-[#1D1D1F] leading-none" id="disp-h-${index}">${data.hours.toFixed(1)}h</span>
                    <span class="text-[10px] text-[#86868B] uppercase font-bold tracking-wider">${isRest ? 'Rest Day' : 'Training'}</span>
                </div>
            </div>
        </div>
        
        <!-- Slider Row -->
        <div class="px-1 mb-4">
             <input type="range" min="0" max="4" step="0.5" value="${data.hours}" 
                oninput="window.updateDayHours(${index}, this.value)"
                class="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#0071E3]" />
             <div class="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
                <span>Rest</span><span>2h</span><span>4h+</span>
             </div>
        </div>
        
        <!-- Split Toggle Row (Only show if not rest) -->
        <div class="border-t border-gray-200/50 pt-3 flex items-center justify-between ${isRest ? 'opacity-50 pointer-events-none' : ''}">
             <label class="flex items-center gap-2 cursor-pointer select-none">
                <div class="relative">
                    <input type="checkbox" class="sr-only peer" onchange="window.toggleSplit(${index}, this.checked)" ${isSplit ? 'checked' : ''}>
                    <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:bg-[#0071E3] transition-colors"></div>
                    <div class="absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-4 shadow-sm"></div>
                </div>
                <span class="text-xs font-medium text-[#86868B]">Split AM/PM</span>
            </label>
        </div>
        
        <!-- Split Inputs (Animated Expand) -->
        ${isSplit ? `
        <div class="mt-3 grid grid-cols-2 gap-3 animate-fade-in">
             <div class="bg-white p-2 rounded-xl flex items-center gap-2 border border-gray-100">
                <span class="material-symbols-outlined text-[16px] text-orange-400 filled">wb_sunny</span>
                <input type="number" step="0.5" class="w-full text-sm font-bold border-none p-0 focus:ring-0 text-right text-[#1D1D1F]" 
                    value="${data.amHours || (data.hours / 2)}" onchange="window.updateSplitHours(${index}, 'am', this.value)">
                <span class="text-xs text-gray-400">h</span>
             </div>
             <div class="bg-white p-2 rounded-xl flex items-center gap-2 border border-gray-100">
                <span class="material-symbols-outlined text-[16px] text-indigo-400 filled">bedtime</span>
                <input type="number" step="0.5" class="w-full text-sm font-bold border-none p-0 focus:ring-0 text-right text-[#1D1D1F]" 
                    value="${data.hours - (data.amHours || (data.hours / 2))}" onchange="window.updateSplitHours(${index}, 'pm', this.value)">
                <span class="text-xs text-gray-400">h</span>
             </div>
        </div>
        ` : ''}
    </div>
    `;
}

// --- STEP 7: GYM ACCESS ---
function renderStepGymAccess() {
    const selected = window.wizardState.data.gymAccess;
    return `
         <div class="px-8 pt-12 pb-6">
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-4 text-[#1D1D1F]">Gym access?</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide">We’ll tailor your strength training to your available equipment.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-8 py-2 space-y-5 no-scrollbar">
            ${_renderRadioOption('gymAccess', 'commercial', 'fitness_center', 'Commercial Gym', 'Full access to machines', selected)}
            ${_renderRadioOption('gymAccess', 'home', 'home', 'Home Setup', 'Dumbbells & basic gear', selected)}
            ${_renderRadioOption('gymAccess', 'none', 'accessibility_new', 'Bodyweight Only', 'No equipment needed', selected)}
        </div>
        ${_renderFooter('Continue', 7)}
    `;
}

// --- STEP 8: SUMMARY ---
function renderStepSummary() {
    const d = window.wizardState.data;
    // Build Summary
    return `
        <div class="px-8 pt-12 pb-6">
            <h1 class="text-[40px] font-semibold tracking-tight leading-[1.1] mb-4 text-[#1D1D1F]">Review your plan.</h1>
            <p class="text-[#86868B] text-[19px] font-normal leading-relaxed tracking-wide">We’ve optimized your schedule for maximum performance.</p>
        </div>
        <div class="flex-1 overflow-y-auto px-8 py-2 space-y-6 no-scrollbar">
            <div class="bg-[#F5F5F7] p-1.5 rounded-[1.375rem]">
                <div class="flex justify-between items-center px-4 pt-3 pb-2">
                    <h2 class="text-[13px] uppercase tracking-wider font-semibold text-[#86868B]">Profile Details</h2>
                    <button onclick="window.openQuickSetup()" class="text-[15px] font-medium text-[#0071E3] hover:text-[#0077ED]">Edit</button>
                </div>
                <div class="flex flex-col gap-1.5">
                    ${_renderSummaryRow('directions_run', 'Primary Focus', d.sport || 'Runner')}
                    <div class="grid grid-cols-2 gap-1.5">
                        ${_renderSummaryCard('bar_chart', 'Level', d.experience_level || 'Intermediate')}
                        ${_renderSummaryCard('calendar_month', 'Freq', d.trainingDays + ' Days/Wk')}
                    </div>
                    ${_renderSummaryRow('flag', 'Current Goal', d.goal || 'General Fitness')}
                </div>
            </div>
            
            <div class="flex items-start gap-3 px-2 py-1">
                <span class="material-symbols-outlined text-[#86868B] text-[20px]">lock_person</span>
                <p class="text-[13px] text-[#86868B] leading-snug">Your training data is stored locally on your device.</p>
            </div>
        </div>
        
        <div class="p-8 pb-10 bg-white/90 backdrop-blur-xl border-t border-gray-100 z-10">
            <button onclick="window.finishWizard()" class="w-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.99] transition-all duration-200 text-white font-semibold text-[17px] py-4 rounded-full shadow-lg flex items-center justify-center gap-2 group">
                <span class="material-symbols-outlined text-[20px] animate-pulse">auto_awesome</span>
                Generate Plan
            </button>
        </div>
    `;
}


// --- HELPER COMPONENTS ---

function _renderRadioOption(name, value, icon, title, subtitle, selectedValue) {
    const isChecked = selectedValue === value;
    return `
    <label class="group relative block cursor-pointer select-none">
        <input type="radio" name="${name}" value="${value}" class="peer ios-radio sr-only" onchange="window.updateWizardData('${name}', '${value}')" ${isChecked ? 'checked' : ''}/>
        <div class="relative smooth-transition flex items-center justify-between p-5 rounded-[1.375rem] bg-[#F5F5F7] border border-transparent hover:bg-gray-100 active:scale-[0.99]">
            <div class="flex items-center gap-5">
                <div class="icon-wrapper smooth-transition flex items-center justify-center w-12 h-12 rounded-full bg-white shadow-sm text-[#1D1D1F]">
                    <span class="material-symbols-outlined text-[24px]">${icon}</span>
                </div>
                <div class="flex flex-col">
                    <span class="text-[17px] font-semibold text-[#1D1D1F] leading-snug">${title}</span>
                    <span class="text-[15px] text-[#86868B]">${subtitle}</span>
                </div>
            </div>
            <div class="check-icon smooth-transition flex items-center justify-center w-6 h-6 rounded-full bg-[#0071E3] text-white shadow-sm">
                <span class="material-symbols-outlined text-[16px] font-bold">check</span>
            </div>
        </div>
    </label>`;
}

function _renderTimeCard(value, icon, title, selectedValue) {
    const isChecked = selectedValue === value;
    return `
    <label class="group relative cursor-pointer select-none">
        <input type="radio" name="time_preference" value="${value}" class="peer ios-radio sr-only" onchange="window.updateWizardData('time_preference', '${value}')" ${isChecked ? 'checked' : ''}/>
        <div class="smooth-transition h-40 rounded-[1.375rem] bg-[#F5F5F7] border border-transparent hover:bg-gray-100 active:scale-[0.98] flex flex-col items-center justify-center gap-4">
            <div class="icon-wrapper smooth-transition w-14 h-14 rounded-full bg-white shadow-sm border border-gray-100 flex items-center justify-center text-[#86868B]">
                <span class="material-symbols-outlined text-[32px] filled">${icon}</span>
            </div>
            <span class="smooth-transition text-[17px] font-semibold text-[#1D1D1F]">${title}</span>
        </div>
    </label>`;
}

function _renderSummaryRow(icon, label, value) {
    return `
     <div class="bg-white p-4 rounded-[18px] shadow-sm flex items-center justify-between">
        <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#0071E3]">
                <span class="material-symbols-outlined text-[24px]">${icon}</span>
            </div>
            <div class="flex flex-col">
                <span class="text-[13px] text-[#86868B] font-medium">${label}</span>
                <span class="text-[17px] font-semibold text-[#1D1D1F] capitalize">${value}</span>
            </div>
        </div>
         <span class="material-symbols-outlined text-[#D2D2D7]">chevron_right</span>
    </div>`;
}

function _renderSummaryCard(icon, label, value) {
    return `
    <div class="bg-white p-4 rounded-[18px] shadow-sm flex flex-col gap-3">
        <div class="w-10 h-10 rounded-full bg-[#F5F5F7] flex items-center justify-center text-[#0071E3]">
            <span class="material-symbols-outlined text-[20px]">${icon}</span>
        </div>
        <div>
            <span class="text-[13px] text-[#86868B] font-medium block mb-0.5">${label}</span>
            <span class="text-[17px] font-semibold text-[#1D1D1F] capitalize">${value}</span>
        </div>
    </div>`;
}

function _renderFooter(btnText, step) {
    // Add "Skip" details if needed
    return `
        <div class="p-8 pb-10 bg-white/90 backdrop-blur-xl border-t border-gray-100">
            <button onclick="window.wizardNext()" class="w-full bg-[#0071E3] hover:bg-[#0077ED] active:scale-[0.99] transition-all duration-200 text-white font-semibold text-[17px] py-4 rounded-full shadow-none flex items-center justify-center gap-2 group">
                ${btnText}
                <span class="material-symbols-outlined text-[20px] group-hover:translate-x-0.5 transition-transform duration-200">arrow_forward</span>
            </button>
            <div class="mt-5 text-center">
                <button onclick="window.skipWizard()" class="text-[15px] font-medium text-[#0071E3] hover:text-[#0077ED] transition-colors px-4 py-1 rounded-full">
                    Skip for now
                </button>
            </div>
        </div>
    `;
}

function _formatDateDisplay(dateStr) {
    if (!dateStr) return 'Select Date';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


// --- ACTIONS & EVENTS ---

function updateWizardData(key, value) {
    if (!window.wizardState) return;
    window.wizardState.data[key] = value;

    // Auto-advance logic for some steps if desirable, but standard iOS is selection -> continue.
    // We will stick to manual Continue for now as per design "Continue" button.
}

function updateWizardDate(value) {
    updateWizardData('raceDate', value);
    renderWizardStep(4); // Re-render to update display
}

function toggleJustTraining(checked) {
    updateWizardData('trainingGoal', checked ? 'fitness' : 'event');
    if (checked) updateWizardData('raceDate', null);
    renderWizardStep(4);
}

function updateWizardPace(part, value) {
    if (!window.wizardState.data.thresholdPace) window.wizardState.data.thresholdPace = { min: 5, sec: 0 };
    window.wizardState.data.thresholdPace[part] = parseInt(value) || 0;
}

function updateDuration(val) {
    updateWizardData('avg_session_duration', val);
    const display = document.getElementById('duration-display');
    if (display) display.textContent = val;
}

// --- AVAILABILITY LOGIC ---

function updateDayHours(index, value) {
    const arr = [...window.wizardState.data.availability];
    arr[index].hours = parseFloat(value);
    // Reset split if becoming strict 0 (rest) though UI handles it
    if (arr[index].hours === 0) arr[index].split = false;

    // Auto-balance AM/PM if split is active
    if (arr[index].split) {
        arr[index].amHours = arr[index].hours / 2;
        arr[index].pmHours = arr[index].hours / 2;
    }

    window.wizardState.data.availability = arr;
    renderWizardStep(6); // Re-render to show updates (e.g. Rest label)
}

function toggleSplit(index, checked) {
    const arr = [...window.wizardState.data.availability];
    arr[index].split = checked;
    if (checked) {
        arr[index].amHours = arr[index].hours / 2;
        arr[index].pmHours = arr[index].hours / 2;
    }
    window.wizardState.data.availability = arr;
    renderWizardStep(6);
}

function updateSplitHours(index, part, value) {
    const arr = [...window.wizardState.data.availability];
    const val = parseFloat(value) || 0;

    if (part === 'am') {
        arr[index].amHours = val;
        // Adjust PM automatically? Or total? 
        // Let's adjust total to match sum
        arr[index].pmHours = Math.max(0, arr[index].hours - val);
    } else {
        arr[index].pmHours = val;
        arr[index].amHours = Math.max(0, arr[index].hours - val);
    }

    window.wizardState.data.availability = arr;
    // Don't full re-render here to avoid losing focus, just update state. 
    // Actually re-rendering might kill focus on input.
    // Ideally we update DOM directly or debounce.
    // For now, let's NOT re-render on text input, just save.
}

function copyDayToAll(sourceIndex) {
    const source = window.wizardState.data.availability[sourceIndex];
    // Deep copy logic
    const newArr = window.wizardState.data.availability.map(() => ({ ...source }));
    window.wizardState.data.availability = newArr;
    renderWizardStep(6);
}


function finishWizard() {
    // Collect all data and trigger generation
    console.log("Wizard Finished with data:", window.wizardState.data);

    // Map wizard data to Global State/LocalStorage inputs expected by Main.js
    const d = window.wizardState.data;
    const state = window.state || {}; // Global state

    // 1. Sport
    state.sportType = d.sport || 'Running';
    localStorage.setItem('elite_sportType', state.sportType);

    // 2. Goal
    state.trainingGoal = d.trainingGoal; // 'event' or 'fitness'
    if (d.raceDate) {
        state.raceDate = d.raceDate;
        if (document.getElementById('raceDateInput')) document.getElementById('raceDateInput').value = d.raceDate;
    }

    // 3. Experience / Volume
    // Map 'beginner'/'intermediate'/'advanced' to numeric volumes
    let vol = 30;
    if (d.experience_level === 'beginner') vol = 15;
    if (d.experience_level === 'intermediate') vol = 35;
    if (d.experience_level === 'advanced') vol = 60;
    state.startingVolume = vol;
    state.currentVolume = vol;

    // 4. Pace (Running)
    if (d.thresholdPace) {
        // Convert {min, sec} to seconds per km (or mile? user prompt said mile but code usually km)
        // Let's assume input was per KM for consistency with rest of app unless prompted otherwise.
        // If app uses seconds/km:
        const paceSec = (d.thresholdPace.min * 60) + d.thresholdPace.sec;
        state.user = state.user || {};
        state.user.thresholdPace = paceSec;
        state.lthrPace = paceSec;
    }

    // 5. Gym
    state.gymAccess = d.gymAccess;

    // 6. Availability
    // Use the granular availability from step 6
    if (d.availability && Array.isArray(d.availability)) {
        state.dailyAvailability = d.availability;
    } else {
        // Fallback default
        state.dailyAvailability = Array(7).fill({ hours: 1.5, split: false, amHours: 0, pmHours: 0 });
    }

    // Close Wizard
    const overlay = document.getElementById('quick-setup-wizard');
    if (overlay) overlay.remove();

    // Trigger Plan Generation
    if (window.generateTrainingPlan) {
        window.generateTrainingPlan();
        window.location.reload();
    }
}


// --- EXPOSE ---
window.openQuickSetup = openQuickSetup;
window.renderWizardStep = renderWizardStep;
window.updateWizardData = updateWizardData;
window.updateWizardDate = updateWizardDate;
window.toggleJustTraining = toggleJustTraining;
window.updateWizardPace = updateWizardPace;
window.updateDuration = updateDuration;
window.updateDayHours = updateDayHours;
window.toggleSplit = toggleSplit;
window.updateSplitHours = updateSplitHours;
window.copyDayToAll = copyDayToAll;
window.finishWizard = finishWizard;
window.wizardBack = function () {
    const prevStep = window.wizardState.currentStep - 1;
    if (prevStep >= 1) renderWizardStep(prevStep);
};
window.wizardNext = function () {
    const nextStep = window.wizardState.currentStep + 1;
    if (nextStep <= 8) renderWizardStep(nextStep); // Max steps might be 8 now
};

window.StepRenderer = {
    openQuickSetup,
    renderWizardStep
};
