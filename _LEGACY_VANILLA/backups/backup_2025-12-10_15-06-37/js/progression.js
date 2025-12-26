// --- PROGRESSION RATE CONTROL ---

function setProgressionRate(rate) {
    state.progressionRate = rate;
    localStorage.setItem('elite_progressionRate', state.progressionRate);

    // Update the Configuration modal dropdown if it exists (it might not)
    const input = document.getElementById('progressionInput');
    if (input) input.value = rate;

    // Regenerate the plan with the new rate
    if (typeof generateTrainingPlan === 'function') {
        generateTrainingPlan();
    } else {
        console.error("generateTrainingPlan is not defined");
    }

    // Re-render the plan UI using the main render function
    if (typeof renderWeeklyPlan === 'function') {
        renderWeeklyPlan();
    } else {
        console.error("renderWeeklyPlan is not defined");
    }

    // Show toast notification
    const rateName = rate === 0.10 ? 'Aggressive (+10%)' :
        rate === 0.075 ? 'Normal (+7.5%)' :
            'Easy (+5%)';
    showToast(`Switched to ${rateName}`);
}
