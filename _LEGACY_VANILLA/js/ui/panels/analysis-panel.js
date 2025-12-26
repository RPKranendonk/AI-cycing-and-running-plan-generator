/**
 * Analysis Panel Controller
 * Handles interactions for the Smart Analysis / Recommendation panel (Result Card)
 */
window.AnalysisPanel = {
    toggleDetails: function () {
        const details = document.getElementById('analysis-details');
        const arrow = document.getElementById('details-arrow');

        if (details && arrow) {
            const isHidden = details.classList.contains('hidden');
            if (isHidden) {
                details.classList.remove('hidden');
                arrow.classList.add('rotate-90');
            } else {
                details.classList.add('hidden');
                arrow.classList.remove('rotate-90');
            }
        }
    }
};

// Global Expose for onClick handlers
window.toggleAnalysisDetails = AnalysisPanel.toggleDetails.bind(AnalysisPanel);

console.log('[AnalysisPanel] Module loaded');
