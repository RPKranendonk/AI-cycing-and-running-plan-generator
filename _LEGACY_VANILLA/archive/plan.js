// --- PLAN GENERATION ---

function generatePlan() {
    const planStart = new Date();
    // Adjust to start of current week (Monday)
    const day = planStart.getDay() || 7;
    if (day !== 1) planStart.setHours(-24 * (day - 1));
    planStart.setHours(0, 0, 0, 0);
    START_DATE = planStart;

    const raceDate = new Date(state.raceDate);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const totalWeeks = Math.ceil((raceDate - planStart) / msPerWeek);

    state.generatedPlan = [];

    // 1. Determine Starting Volume
    let currentKm = 30; // Default fallback
    if (state.activities && state.activities.length > 0) {
        const now = new Date();
        const lastSunday = new Date(now);
        lastSunday.setDate(now.getDate() - (now.getDay() === 0 ? 7 : now.getDay()));
        lastSunday.setHours(23, 59, 59, 999);
        const lastWeekStart = new Date(lastSunday);
        lastWeekStart.setDate(lastSunday.getDate() - 6);
        lastWeekStart.setHours(0, 0, 0, 0);

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

    // Progression Settings
    const progressionRate = state.progressionRate || 0.075;
    const restWeekFactor = 0.60; // -40%

    // Long Run Settings
    let currentLongRun = Math.ceil(state.lastWeekLongRun || 10);

    // Pre-calculate volumes for all weeks
    let weeklyVolumes = [];

    let currentCapacity = currentKm;
    let currentLongRunCapacity = currentLongRun;

    // Peak Tracking
    let peakKm = 0;
    let peakLongRun = 0;

    // Store volumes for all weeks (for looking back 3 weeks)
    let weekVolumes = [];  // Will store {vol, longRun} for each week

    // ===================================================================
    // PHASE ASSIGNMENT: 4-Phase Macro-Logic (Working Backwards from Race)
    // ===================================================================

    const W = totalWeeks;
    let taperWeeks, phase3Weeks, phase2Weeks, phase1Weeks;

    // Phase 4 (Sharpening): Fixed taper duration
    taperWeeks = W < 9 ? 2 : 3;

    // Remaining weeks to distribute across Phases 1-3
    const R = W - taperWeeks;

    // Check if we need short plan override (Phase 1 would be too small)
    const estimatedPhase1 = R - Math.max(3, Math.round(R * 0.4)) - Math.max(2, Math.round(R * 0.35));

    if (estimatedPhase1 <= 1) {
        // Short plan override: skip base building
        phase1Weeks = 0;
        phase3Weeks = Math.round(R * 0.6);
        phase2Weeks = R - phase3Weeks;
    } else {
        // Standard distribution
        phase3Weeks = Math.max(3, Math.round(R * 0.4));  // Race Reality: ~40%
        phase2Weeks = Math.max(2, Math.round(R * 0.35)); // Engine Development: ~35%
        phase1Weeks = R - phase3Weeks - phase2Weeks;     // Structural Integrity: remainder
    }

    // Assign phase names to each week (working backwards from race)
    let phaseAssignments = new Array(totalWeeks);
    let currentWeek = totalWeeks - 1;

    // Phase 4: Sharpening (Taper + Race)
    phaseAssignments[currentWeek--] = { phase: 'Phase 4', phaseName: 'Sharpening', theme: 'Race' };
    for (let i = 0; i < taperWeeks; i++) {
        phaseAssignments[currentWeek--] = { phase: 'Phase 4', phaseName: 'Sharpening', theme: 'Taper' };
    }

    // Phase 3: Race Reality
    for (let i = 0; i < phase3Weeks; i++) {
        phaseAssignments[currentWeek--] = { phase: 'Phase 3', phaseName: 'Race Reality', theme: 'Build' };
    }

    // Phase 2: Engine Development
    for (let i = 0; i < phase2Weeks; i++) {
        phaseAssignments[currentWeek--] = { phase: 'Phase 2', phaseName: 'Engine Development', theme: 'Build' };
    }

    // Phase 1: Structural Integrity
    while (currentWeek >= 0) {
        phaseAssignments[currentWeek--] = { phase: 'Phase 1', phaseName: 'Structural Integrity', theme: 'Build' };
    }

    // Create simple weekThemes array for backwards compatibility
    let weekThemes = phaseAssignments.map(p => p.theme);

    // ===================================================================
    // MICRO-LOGIC: Week Naming Function
    // ===================================================================
    /**
     * Assigns technical week names based on block length
     * @param {number} positionInBlock - Position of week within block (1-indexed)
     * @param {number} blockLength - Total weeks in block
     * @returns {string} Week name
     */
    function getWeekName(positionInBlock, blockLength) {
        if (blockLength === 2) {
            const names = ['Accumulation', 'Overreach'];
            return names[positionInBlock - 1] || 'Build';
        } else if (blockLength === 3) {
            const names = ['Accumulation', 'Overreach', 'Adaptation'];
            return names[positionInBlock - 1] || 'Build';
        } else if (blockLength === 4) {
            const names = ['Acclimation', 'Accumulation', 'Overreach', 'Adaptation'];
            return names[positionInBlock - 1] || 'Build';
        } else if (blockLength === 5) {
            const names = ['Acclimation', 'Accumulation', 'Progression', 'Overreach', 'Adaptation'];
            return names[positionInBlock - 1] || 'Build';
        } else if (blockLength === 1) {
            return 'Accumulation'; // Single week block
        }
        return 'Build'; // Fallback
    }

    // ===================================================================
    // BLOCK ASSIGNMENT with Recovery Weeks
    // ===================================================================
    // Within each phase (except Phase 4), create blocks ending with recovery weeks
    // Block lengths vary: 2-5 weeks based on remaining weeks in phase

    // PHASE 1.5: Assign Blocks (Variable Length)
    // Race/Taper weeks get their own blocks
    // Build weeks are grouped with the recovery week that follows them
    let blockAssignments = new Array(totalWeeks);
    let currentBlockNum = 1;

    // Work backwards from the race week
    // FIRST: Combine ALL Race + Taper weeks into ONE Sharpening block
    let sharpeningBlockStart = -1;
    let sharpeningBlockEnd = -1;

    for (let w = totalWeeks - 1; w >= 0; w--) {
        const theme = weekThemes[w];
        if (theme === 'Race' || theme === 'Taper') {
            if (sharpeningBlockStart === -1) {
                sharpeningBlockStart = w;
            }
            sharpeningBlockEnd = w;
        } else {
            break; // Stop when we hit non-taper/race weeks
        }
    }

    // Assign the sharpening block
    if (sharpeningBlockStart !== -1) {
        const sharpeningLength = sharpeningBlockStart - sharpeningBlockEnd + 1;
        for (let i = sharpeningBlockEnd; i <= sharpeningBlockStart; i++) {
            blockAssignments[i] = {
                blockNum: currentBlockNum,
                blockType: 'Sharpening',
                blockLength: sharpeningLength,
                positionInBlock: i - sharpeningBlockEnd + 1
            };
        }
        currentBlockNum++;
    }

    // SECOND: Assign blocks for remaining weeks (Phases 1-3)
    // These should have recovery weeks ending each block
    for (let w = (sharpeningBlockEnd !== -1 ? sharpeningBlockEnd - 1 : totalWeeks - 1); w >= 0; w--) {
        if (blockAssignments[w]) continue; // Already assigned

        const theme = weekThemes[w];

        if (theme === 'Recovery') {
            // This recovery week ends a build block
            // Find all consecutive build weeks before this
            let blockStartWeek = w;
            while (blockStartWeek > 0 && weekThemes[blockStartWeek - 1] === 'Build' && !blockAssignments[blockStartWeek - 1]) {
                blockStartWeek--;
            }

            // Assign this block number to all weeks from blockStartWeek to w (inclusive)
            const blockLength = w - blockStartWeek + 1;
            for (let i = blockStartWeek; i <= w; i++) {
                blockAssignments[i] = {
                    blockNum: currentBlockNum,
                    blockType: 'Build',
                    blockLength: blockLength,
                    positionInBlock: i - blockStartWeek + 1
                };
            }
            currentBlockNum++;

            // Skip the weeks we just assigned
            w = blockStartWeek;
        } else if (theme === 'Build') {
            // Build week without a recovery week following it (edge case)
            // DON'T merge with Taper or Race blocks - only merge with other Build blocks
            if (w < totalWeeks - 1 && blockAssignments[w + 1] && blockAssignments[w + 1].blockType === 'Build') {
                // Merge with the next BUILD block only
                const nextBlock = blockAssignments[w + 1];
                blockAssignments[w] = {
                    blockNum: nextBlock.blockNum,
                    blockType: nextBlock.blockType,
                    blockLength: (nextBlock.blockLength || 1) + 1,
                    positionInBlock: 1
                };
                // Update positions in the rest of the block
                for (let i = w + 1; i < totalWeeks && blockAssignments[i] && blockAssignments[i].blockNum === nextBlock.blockNum; i++) {
                    blockAssignments[i].positionInBlock++;
                    blockAssignments[i].blockLength++;
                }
            } else {
                // Create its own small block (shouldn't normally happen)
                blockAssignments[w] = {
                    blockNum: currentBlockNum,
                    blockType: 'Build',
                    blockLength: 1,
                    positionInBlock: 1
                };
                currentBlockNum++;
            }
        }
    }

    // PHASE 2: Calculate volumes based on themes

    for (let w = 0; w < totalWeeks; w++) {
        const weeksOut = totalWeeks - 1 - w;
        const theme = weekThemes[w];
        let vol = 0;
        let longRun = 0;
        let phase = "Base";
        let focus = theme;

        // Determine Phase based on weeksOut
        if (weeksOut === 0) {
            phase = "Race";
        } else if (weeksOut >= 1 && weeksOut <= 2) {
            phase = "Taper";
        } else if (weeksOut >= 3 && weeksOut <= 10) {
            phase = "Build";
        } else {
            phase = "Base";
        }

        // Handle special weeks
        if (weeksOut === 0) {
            vol = peakKm * 0.35;
            longRun = 5;
            focus = "Race";
        } else if (weeksOut === 1) {
            vol = peakKm * 0.45;
            longRun = peakLongRun * 0.50;
            focus = "Taper";
        } else if (weeksOut === 2) {
            vol = peakKm * 0.75;
            longRun = peakLongRun * 0.75;
            focus = "Taper";
        } else if (weeksOut === 3) {
            // Peak week
            currentCapacity = currentCapacity * (1 + progressionRate);
            currentLongRunCapacity = currentLongRunCapacity + 2;
            vol = currentCapacity;
            longRun = currentLongRunCapacity;
            peakKm = vol;
            peakLongRun = longRun;
            focus = "Key Week";
        } else {
            // Build or Recovery weeks (weeksOut >= 4)
            if (theme === 'Recovery') {
                vol = currentCapacity * restWeekFactor;
                longRun = currentLongRunCapacity * restWeekFactor;
                focus = "Recovery";
            } else {
                // Build week
                const prevTheme = w > 0 ? weekThemes[w - 1] : null;

                if (prevTheme === 'Recovery' && w >= 3) {
                    // Resume at exact same level as 3 weeks ago
                    const threeWeeksAgo = weekVolumes[w - 3];
                    vol = threeWeeksAgo.vol;
                    longRun = threeWeeksAgo.longRun;
                    currentCapacity = vol;
                    currentLongRunCapacity = longRun;
                } else {
                    // Normal build progression
                    currentCapacity = currentCapacity * (1 + progressionRate);
                    currentLongRunCapacity = currentLongRunCapacity + 2;
                    vol = currentCapacity;
                    longRun = currentLongRunCapacity;
                }
            }
        }

        // Cap Long Run at 34km (elite safety limit)
        if (longRun > 34) longRun = 34;

        // Ensure Long Run isn't > Total Volume (sanity check)
        if (longRun > vol) longRun = vol * 0.9;

        // Store for 3-week lookback
        weekVolumes.push({
            vol: vol,
            longRun: longRun
        });

        weeklyVolumes.push({
            vol: Math.round(vol),
            longRun: Math.round(longRun),
            phase,
            focus
        });
    }

    // Generate Plan Objects
    weeklyVolumes.forEach((wk, i) => {
        const weekStart = new Date(planStart);
        weekStart.setDate(planStart.getDate() + (i * 7));

        const remaining = wk.vol - wk.longRun;

        // Get block assignment for this week
        const blockInfo = blockAssignments[i] || { blockNum: 1, blockType: 'Build', blockLength: 1, positionInBlock: 1 };

        // Get phase assignment for this week
        const phaseInfo = phaseAssignments[i] || { phase: 'Phase 1', phaseName: 'Structural Integrity', theme: 'Build' };

        // Get week name based on block length and position
        let weekName;
        if (blockInfo.blockType === 'Sharpening') {
            // For sharpening block, use Taper/Race as week names
            weekName = weekThemes[i]; // 'Taper' or 'Race'
        } else {
            weekName = getWeekName(blockInfo.positionInBlock, blockInfo.blockLength);
        }

        state.generatedPlan.push({
            week: i + 1,
            phase: wk.phase,
            focus: wk.focus,
            mileage: Math.round(wk.vol),
            longRun: Math.round(wk.longRun),
            remaining: Math.round(wk.vol - wk.longRun),
            rawKm: wk.vol,
            startDate: weekStart.toISOString(),
            startDateStr: weekStart.toISOString(),
            isRaceWeek: (i === totalWeeks - 1), // Flag final week as Race Week
            totalTSS: 0,
            estHours: "--",
            schedule: [],
            // Block information
            blockNum: blockInfo.blockNum,
            blockType: blockInfo.blockType,
            blockLength: blockInfo.blockLength || 1,
            positionInBlock: blockInfo.positionInBlock || 1,
            // Phase information
            phaseNumber: phaseInfo.phase,
            phaseName: phaseInfo.phaseName,
            // Week naming
            weekName: weekName
        });
    });
}


function estimateTSS(durationMin, zone) {
    if (!durationMin) return 0;
    let tssPerHour = 50;
    if (zone.includes('Z1')) tssPerHour = 40;
    else if (zone.includes('Z3')) tssPerHour = 70;
    else if (zone.includes('Z4')) tssPerHour = 85;
    else if (zone.includes('Z5')) tssPerHour = 95;
    else if (zone.includes('Strength')) return 45;
    return Math.round((durationMin / 60) * tssPerHour);
}


function applyModifications() {
    for (const key in state.modifications) {
        const [w, d] = key.split('_').map(Number);
        if (state.generatedPlan[w] && state.generatedPlan[w].schedule[d]) {
            const mod = state.modifications[key];
            state.generatedPlan[w].schedule[d] = { ...state.generatedPlan[w].schedule[d], ...mod };
        }
    }
}
