/**
 * Athlete Info Panel Renderer
 * Handles the display of athlete data (Weight, FTP, etc.) retrieved from Intervals.icu
 */
window.AthletePanel = {
    /**
     * Update the Athlete Info Panel with data from Intervals.icu
     * Weight is fetched from wellness API, FTP/pace from athlete data
     * @param {Object} data - The athlete data object from Intervals.icu
     */
    update: function (data) {
        const panel = document.getElementById('intervals-athlete-info');
        if (!panel) return;

        // Show panel
        panel.classList.remove('hidden');

        // Name
        const nameEl = document.getElementById('athlete-name');
        if (nameEl) {
            nameEl.textContent = data.firstname || data.name || '—';
        }

        // Get weight from state (wellness), profile data, or fallback
        const weightEl = document.getElementById('athlete-weight');
        const warningEl = document.getElementById('athlete-warning');
        const warningTextEl = document.getElementById('athlete-warning-text');

        // Priority: state.weight (wellness) > data.weight > data.icu_weight
        let weight = state.weight || data.weight || data.icu_weight || null;

        if (!weight && state.wellness && state.wellness.length > 0) {
            const withWeight = state.wellness.find(w => w.weight && w.weight > 0);
            if (withWeight) weight = withWeight.weight;
        }

        if (weight && weight > 0) {
            if (weightEl) {
                weightEl.textContent = `${weight} kg`;
                weightEl.classList.remove('text-amber-400');
            }
            state.athleteWeight = weight;
        } else {
            if (weightEl) {
                weightEl.textContent = 'Not set';
                weightEl.classList.add('text-amber-400');
            }
            if (warningEl) warningEl.classList.remove('hidden');
            if (warningTextEl) warningTextEl.textContent = 'Add weight in Intervals.icu settings or wellness';
        }

        // FTP/Pace based on sport type
        const fitnessEl = document.getElementById('athlete-fitness');
        const labelEl = document.getElementById('athlete-metric-label');
        const isCycling = state.sportType === 'Cycling';

        if (fitnessEl) {
            if (isCycling) {
                const ftp = state.ftp || data.icu_ftp || data.ftp || null;
                fitnessEl.textContent = ftp ? `${ftp}W` : '—';
                if (labelEl) labelEl.textContent = 'FTP';
            } else {
                const ltPace = state.lthrPace || null;
                fitnessEl.textContent = ltPace ? `${ltPace}/km` : '—';
                if (labelEl) labelEl.textContent = 'LT Pace';
            }
        }
    }
};
