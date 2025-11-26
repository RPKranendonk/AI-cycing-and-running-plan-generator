// ==========================================
// CORE LOGIC: MARATHON SCHEDULE GENERATOR v5.0
// ==========================================

function getStartingVolume() {
    let currentKm = 30;
    if (state.activities && state.activities.length > 0) {
        const now = new Date();
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
        const lastWeekStart = new Date(lastSunday);
        lastWeekStart.setDate(lastSunday.getDate() - 6);

        let vol = 0;
        state.activities.forEach(act => {
            if (act.type === 'Run') {
                const d = new Date(act.start_date_local);
                if (d >= lastWeekStart && d <= lastSunday) {
                    vol += (act.distance || 0) / 1000;
                }
            }
        });
        if (vol > 0) currentKm = vol;
    }
    return currentKm;
}

function getStartingTSS() {
    let maxTss = 0;
    if (state.activities && state.activities.length > 0) {
        // Look at last 4 weeks
        const now = new Date();
        const fourWeeksAgo = new Date(now);
        fourWeeksAgo.setDate(now.getDate() - 28);

        const weeklyTss = {};
        state.activities.forEach(act => {
            if (act.type === 'Ride' || act.type === 'VirtualRide') {
                const d = new Date(act.start_date_local);
                if (d >= fourWeeksAgo && d <= now) {
                    const weekKey = `${d.getFullYear()}-W${getWeekNumber(d)}`;
                    if (!weeklyTss[weekKey]) weeklyTss[weekKey] = 0;
                    weeklyTss[weekKey] += (act.icu_intensity || 0); // Assuming icu_intensity is TSS-like or load
                }
            }
        });

        // Find max
        Object.values(weeklyTss).forEach(tss => {
            if (tss > maxTss) maxTss = tss;
        });
    }
    return maxTss > 0 ? maxTss : 300; // Default fallback
}

function applyModifications() {
    if (!state.modifications) return;
    for (const key in state.modifications) {
        const [w, d] = key.split('_').map(Number);
        if (state.generatedPlan[w] && state.generatedPlan[w].schedule[d]) {
            state.generatedPlan[w].schedule[d] = { ...state.generatedPlan[w].schedule[d], ...state.modifications[key] };
        }
    }
}

function calculateScheduleStructure(totalWeeks, taperWeeksInput = 3) {
    // I. INPUT VARIABLE: Total_Weeks

    // II. STEP 1: CALCULATE TAPER (T)
    const T = taperWeeksInput;

    // III. STEP 2: SET THE ANCHOR (A)
    const A = 3; // Fixed final training block before taper

    // IV. STEP 3: CALCULATE EARLIER TRAINING POOL (P)
    const P = totalWeeks - T - A;

    // Safety fallback for very short plans
    if (P <= 0) {
        return {
            taperWeeks: T,
            anchorWeeks: Math.max(1, totalWeeks - T),
            earlyBlockLengths: []
        };
    }

    // V. STEP 4: DETERMINE EARLIER BLOCKS STRATEGY (N)
    let N = 1;
    if (P >= 6 && P <= 10) N = 2;
    else if (P >= 11 && P <= 14) N = 3;
    else if (P >= 15) N = 4;

    // Distribute the Pool
    const baseSize = Math.floor(P / N);
    const remainder = P % N;

    let earlyBlockLengths = [];
    for (let i = 0; i < N; i++) {
        // Add 1 week to the first 'remainder' blocks (Front-loading)
        let len = baseSize + (i < remainder ? 1 : 0);
        earlyBlockLengths.push(len);
    }

    // Return the structural blueprint
    return {
        taperWeeks: T,
        anchorWeeks: A,
        earlyBlockLengths: earlyBlockLengths
    };
}

// ... (Planning functions moved to planning-running.js and planning-cycling.js) ...