// MANUAL VALIDATOR SNIPPET
// Paste this in your browser console to validate the CURRENT plan state.

(function checkCurrentPlan() {
    if (!window.EnduranceValidator) {
        console.error("EnduranceValidator not loaded.");
        return;
    }
    if (!state || !state.generatedPlan) {
        console.error("No plan state found.");
        return;
    }

    console.log("=== MANUAL ENDURANCE VALIDATION ===");
    console.log("Checking all weeks...");

    const sport = state.sportType || 'Running';

    state.generatedPlan.forEach((week, i) => {
        if (!week.workouts || week.workouts.length === 0) return;

        // Calculate Volume
        let volHours = 0;
        week.workouts.forEach(w => {
            const dur = typeof w.duration === 'number' ? w.duration : parseFloat(w.duration) || 0;
            volHours += (dur / 60);
        });

        const res = window.EnduranceValidator.validateWeek(week.workouts, volHours, sport);

        console.group(`Week ${week.week} (${volHours.toFixed(1)}h) - ${res.idmUsed}`);
        console.log(`Distribution: Z1 ${res.distribution.SCI_Z1.toFixed(0)}% / Z2 ${res.distribution.SCI_Z2.toFixed(0)}% / Z3 ${res.distribution.SCI_Z3.toFixed(0)}%`);
        console.log(`Targets:      Z1 ${res.targets.SCI_Z1}% / Z2 ${res.targets.SCI_Z2}% / Z3 ${res.targets.SCI_Z3}%`);

        if (res.passed) {
            console.log("%c✅ PASSED", "color:green; font-weight:bold");
        } else {
            console.log("%c❌ FAILED", "color:red; font-weight:bold");
            res.corrections.forEach(c => {
                console.log(`  -> ${c.action} (${c.diagnosis})`);
            });
        }
        console.groupEnd();
    });
})();
