// NEW PLAN LOGIC - TWO PHASE APPROACH

// PHASE 1: Assign week themes
let weekThemes = new Array(totalWeeks).fill('Build');

for (let w = 0; w < totalWeeks; w++) {
    const weeksOut = totalWeeks - 1 - w;

    if (weeksOut === 0) {
        weekThemes[w] = 'Race';
    } else if (weeksOut >= 1 && weeksOut <= 2) {
        weekThemes[w] = 'Taper';
    } else if (weeksOut >= 3 && weeksOut <= 5) {
        // The 3 weeks before taper are always build (peak block)
        weekThemes[w] = 'Build';
    } else {
        // weeksOut >= 6: Apply 4-week cycles working backwards
        // Week at weeksOut=6 starts a new cycle
        const weeksBeforePeakBlock = weeksOut - 6; // 0, 1, 2, 3, 4, 5, ...
        const cyclePosition = weeksBeforePeakBlock % 4;

        if (cyclePosition === 3) {
            weekThemes[w] = 'Recovery';
        } else {
            weekThemes[w] = 'Build';
        }
    }
}

// Handle exceptions
if (weekThemes[0] === 'Recovery') {
    weekThemes[0] = 'Build';
    // Push the recovery later in the cycle
    for (let w = 1; w < Math.min(totalWeeks, 6); w++) {
        const weeksOut = totalWeeks - 1 - w;
        if (weekThemes[w] === 'Recovery' && weeksOut >= 6) {
            weekThemes[w] = 'Build';
            if (w + 1 < totalWeeks) {
                const nextWeeksOut = totalWeeks - 1 - (w + 1);
                if (nextWeeksOut >= 6) {
                    weekThemes[w + 1] = 'Recovery';
                }
            }
            break;
        }
    }
}

if (weekThemes[1] === 'Recovery') {
    weekThemes[1] = 'Build';
    // Adjust recoveries in first  two blocks
    let adjustedCount = 0;
    for (let w = 2; w < Math.min(totalWeeks, 12) && adjustedCount < 2; w++) {
        const weeksOut = totalWeeks - 1 - w;
        if (weekThemes[w] === 'Recovery' && weeksOut >= 6) {
            weekThemes[w] = 'Build';
            if (w + 1 < totalWeeks) {
                const nextWeeksOut = totalWeeks - 1 - (w + 1);
                if (nextWeeksOut >= 6) {
                    weekThemes[w + 1] = 'Recovery';
                }
            }
            adjustedCount++;
        }
    }
}

// PHASE 2: Calculate volumes based on themes
for (let w = 0; w < totalWeeks; w++) {
    const weeksOut = totalWeeks - 1 - w;
    const theme = weekThemes[w];
    let vol = 0;
    let longRun = 0;
    let focus = theme;

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
        // Build or Recovery weeks
        if (theme === 'Recovery') {
            vol = currentCapacity * restWeekFactor;
            longRun = currentLongRunCapacity * restWeekFactor;
            focus = "Recovery";
        } else {
            // Build week
            const prevTheme = w > 0 ? weekThemes[w - 1] : null;

            if (prevTheme === 'Recovery') {
                // Resume at exact same level as 3 weeks ago
                vol = threeWeeksAgoCapacity;
                longRun = threeWeeksAgoLongRun;
                currentCapacity = threeWeeksAgoCapacity;
                currentLongRunCapacity = threeWeeksAgoLongRun;
            } else {
                // Normal build progression
                currentCapacity = currentCapacity * (1 + progressionRate);
                currentLongRunCapacity = currentLongRunCapacity + 2;
                vol = currentCapacity;
                longRun = currentLongRunCapacity;
            }

            // Track for post-recovery resumption (3 weeks ahead)
            if (w + 3 < totalWeeks && weekThemes[w + 3] === 'Recovery') {
                threeWeeksAgoCapacity = vol;
                threeWeeksAgoLongRun = longRun;
            }
        }
    }

    // ...rest of logic
}
