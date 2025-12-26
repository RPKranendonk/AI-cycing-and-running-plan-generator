// ==========================================
// STATS VIEW
// Epic 2: Stats Tab MVP
// Displays compliance, CTL/ATL/TSB, weekly trends
// ==========================================

const StatsView = {
    /**
     * Initialize stats view
     */
    init() {
        console.log('[StatsView] Initialized');
    },

    /**
     * Render the stats view content
     * @returns {string} HTML string
     */
    render() {
        return `
            <div class="stats-view p-4 space-y-6 max-w-2xl mx-auto">
                <!-- Header -->
                <div class="text-center mb-6">
                    <h2 class="text-2xl font-bold text-primary">📊 Training Stats</h2>
                    <p class="text-secondary text-sm mt-1">Performance overview and compliance tracking</p>
                </div>

                <!-- Current Week Summary -->
                <div class="stats-card" id="currentWeekStats">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="font-semibold">This Week</h3>
                        <span class="readiness-badge" id="readinessBadge">--</span>
                    </div>
                    
                    <!-- Compliance Bar -->
                    <div class="mb-4">
                        <div class="flex justify-between text-sm mb-2">
                            <span class="text-secondary">Compliance</span>
                            <span class="font-mono font-semibold" id="compliancePercent">--%</span>
                        </div>
                        <div class="compliance-bar">
                            <div class="compliance-bar-fill green" id="complianceFill" style="width: 0%"></div>
                        </div>
                        <div class="flex justify-between text-xs text-muted mt-1">
                            <span id="actualVolume">-- km</span>
                            <span id="plannedVolume">/ -- km planned</span>
                        </div>
                    </div>
                </div>

                <!-- Fitness Metrics -->
                <div class="stats-card" id="fitnessMetrics">
                    <h3 class="font-semibold mb-4">Fitness</h3>
                    <div class="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <div class="text-2xl font-bold text-emerald-600" id="ctlValue">--</div>
                            <div class="text-xs text-secondary">CTL</div>
                            <div class="text-xs text-muted">Fitness</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold text-amber-600" id="atlValue">--</div>
                            <div class="text-xs text-secondary">ATL</div>
                            <div class="text-xs text-muted">Fatigue</div>
                        </div>
                        <div>
                            <div class="text-2xl font-bold" id="tsbValue">--</div>
                            <div class="text-xs text-secondary">TSB</div>
                            <div class="text-xs text-muted">Form</div>
                        </div>
                    </div>
                </div>

                <!-- 4-Week History -->
                <div class="stats-card" id="weekHistory">
                    <h3 class="font-semibold mb-4">4-Week Trend</h3>
                    <div class="grid grid-cols-4 gap-2" id="weekTrendGrid">
                        <!-- Populated by JS -->
                        <div class="text-center p-3 rounded-lg bg-secondary">
                            <div class="text-xs text-muted">W1</div>
                            <div class="text-lg">--</div>
                        </div>
                        <div class="text-center p-3 rounded-lg bg-secondary">
                            <div class="text-xs text-muted">W2</div>
                            <div class="text-lg">--</div>
                        </div>
                        <div class="text-center p-3 rounded-lg bg-secondary">
                            <div class="text-xs text-muted">W3</div>
                            <div class="text-lg">--</div>
                        </div>
                        <div class="text-center p-3 rounded-lg bg-secondary">
                            <div class="text-xs text-muted">W4</div>
                            <div class="text-lg">--</div>
                        </div>
                    </div>
                    <div class="mt-4 text-center">
                        <span class="text-sm text-secondary">Avg Compliance: </span>
                        <span class="font-semibold" id="avgCompliance">--%</span>
                    </div>
                </div>

                <!-- Intensity Distribution (New) -->
                <div class="stats-card" id="zoneDistributionChart">
                    <h3 class="font-semibold mb-4">Scientific Zone Distribution</h3>
                    <div class="flex h-32 items-end space-x-2 px-2" id="intensityBars">
                        <!-- Populated by JS -->
                        <div class="w-full h-full flex items-center justify-center text-xs text-muted">
                            Loading...
                        </div>
                    </div>
                    <div class="flex justify-between mt-2 text-xs text-secondary px-2">
                        <div class="flex items-center"><div class="w-3 h-3 bg-emerald-500 rounded-sm mr-1"></div>Z1 (Easy)</div>
                        <div class="flex items-center"><div class="w-3 h-3 bg-amber-500 rounded-sm mr-1"></div>Z2 (Mod)</div>
                        <div class="flex items-center"><div class="w-3 h-3 bg-red-500 rounded-sm mr-1"></div>Z3 (Hard)</div>
                    </div>
                </div>

                <!-- AI Suggestions Panel -->
                <div class="stats-card" id="suggestionsPanel">
                    <div class="text-center text-muted text-sm py-4">
                        <i class="fa-solid fa-lightbulb mr-1"></i>
                        Click "Refresh Stats" to load suggestions
                    </div>
                </div>

                <!-- Refresh Button -->
                <div class="text-center">
                    <button onclick="StatsView.refresh()" 
                        class="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                        <i class="fa-solid fa-sync mr-2"></i> Refresh Stats
                    </button>
                </div>
            </div>
        `;
    },

    /**
     * Load and display stats data
     */
    async refresh() {
        console.log('[StatsView] Refreshing stats...');

        try {
            // Fetch fitness data
            if (typeof fetchFitness === 'function') {
                const fitness = await fetchFitness();
                this.updateFitnessDisplay(fitness);
            }

            let complianceData = null;

            // Calculate current week compliance
            if (typeof calculateWeekCompliance === 'function' && state.generatedPlan?.length > 0) {
                const currentWeekIndex = this.findCurrentWeekIndex();
                if (currentWeekIndex >= 0) {
                    complianceData = await calculateWeekCompliance(currentWeekIndex);
                    this.updateComplianceDisplay(complianceData);

                    // Added: Zone Distribution Logic
                    this.renderZoneDistribution(state.generatedPlan[currentWeekIndex]);
                }
            }

            // Generate readiness assessment and suggestions
            if (typeof calculateReadinessWithAuto === 'function') {
                const readiness = await calculateReadinessWithAuto({
                    complianceData
                });
                this.updateReadinessBadge(readiness);

                // Generate suggestions
                if (typeof generateAdjustmentSuggestions === 'function') {
                    const weekPlan = state.generatedPlan?.[this.findCurrentWeekIndex()];
                    const suggestionsResult = generateAdjustmentSuggestions(readiness, weekPlan);
                    this.updateSuggestionsPanel(suggestionsResult);
                }
            }

            showToast('Stats refreshed', 'success');
        } catch (err) {
            console.error('[StatsView] Refresh error:', err);
            showToast('Failed to refresh stats', 'error');
        }
    },

    /**
     * Update readiness badge
     */
    updateReadinessBadge(readiness) {
        const badge = document.getElementById('readinessBadge');
        if (!badge || !readiness) return;

        const icon = window.getReadinessIcon?.(readiness.status) || '⚪';
        const colorClass = window.getReadinessColorClass?.(readiness.status) || '';

        badge.textContent = `${icon} ${readiness.status}`;
        badge.className = `readiness-badge px-2 py-1 rounded-full text-xs font-medium ${colorClass}`;
    },

    /**
     * Update suggestions panel
     */
    updateSuggestionsPanel(suggestionsResult) {
        const panel = document.getElementById('suggestionsPanel');
        if (!panel) return;

        if (window.SuggestionsUI) {
            panel.innerHTML = SuggestionsUI.render(suggestionsResult);
        } else {
            panel.innerHTML = '<div class="text-muted text-sm">Suggestions unavailable</div>';
        }
    },

    /**
     * Find the index of the current week in the plan
     */
    findCurrentWeekIndex() {
        if (!state.generatedPlan) return -1;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < state.generatedPlan.length; i++) {
            const week = state.generatedPlan[i];
            if (!week.startDate) continue;

            const weekStart = new Date(week.startDate + 'T00:00:00');
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);

            if (today >= weekStart && today <= weekEnd) {
                return i;
            }
        }

        return -1;
    },

    /**
     * Update fitness display
     */
    updateFitnessDisplay(fitness) {
        if (!fitness) return;

        const ctlEl = document.getElementById('ctlValue');
        const atlEl = document.getElementById('atlValue');
        const tsbEl = document.getElementById('tsbValue');

        if (ctlEl) ctlEl.textContent = Math.round(fitness.ctl);
        if (atlEl) atlEl.textContent = Math.round(fitness.atl);
        if (tsbEl) {
            const tsb = Math.round(fitness.tsb);
            tsbEl.textContent = tsb > 0 ? `+${tsb}` : tsb;
            tsbEl.style.color = tsb > 10 ? '#059669' : tsb < -20 ? '#dc2626' : '#444654';
        }
    },

    /**
     * Update compliance display
     */
    updateComplianceDisplay(data) {
        if (!data) return;

        const percentEl = document.getElementById('compliancePercent');
        const fillEl = document.getElementById('complianceFill');
        const actualEl = document.getElementById('actualVolume');
        const plannedEl = document.getElementById('plannedVolume');

        const percent = Math.round((data.compliance || 0) * 100);

        if (percentEl) percentEl.textContent = `${percent}%`;
        if (fillEl) {
            fillEl.style.width = `${Math.min(percent, 100)}%`;
            fillEl.className = 'compliance-bar-fill ' +
                (percent >= 90 ? 'green' : percent >= 70 ? 'yellow' : 'red');
        }
        if (actualEl) actualEl.textContent = `${data.actualVolume} km`;
        if (plannedEl) plannedEl.textContent = `/ ${data.plannedVolume} km planned`;
    },

    /**
     * Render Zone Distribution (Scientific 3-Zone Model)
     */
    renderZoneDistribution(weekPlan) {
        const container = document.getElementById('intensityBars');
        if (!container || !weekPlan || !weekPlan.schedule) return;

        let z1 = 0, z2 = 0, z3 = 0;
        let total = 0;

        weekPlan.schedule.forEach(slot => {
            const w = slot.workout;
            if (!w) return;
            // Simple heuristic mapping
            // Z1: Recovery, Long Run, Easy
            // Z2: Tempo, SweetSpot
            // Z3: Intervals, VO2 Max, Anaerobic
            // Duration based
            const duration = w.duration || 60; // default 60m if missing

            // Check type or name
            const type = (w.type || slot.type || '').toLowerCase();
            const name = (w.name || '').toLowerCase();

            if (name.includes('recovery') || name.includes('easy') || name.includes('long')) {
                z1 += duration;
            } else if (name.includes('tempo') || name.includes('sweet') || name.includes('threshold')) {
                z2 += duration;
            } else if (name.includes('interval') || name.includes('vo2') || name.includes('hill') || name.includes('sprint')) {
                z3 += duration;
            } else {
                // Default to Z1 for undefined
                z1 += duration;
            }
            total += duration;
        });

        if (total === 0) return;

        const p1 = Math.round((z1 / total) * 100);
        const p2 = Math.round((z2 / total) * 100);
        const p3 = Math.round((z3 / total) * 100);

        // Render Bars
        container.innerHTML = `
            <div class="flex-1 flex flex-col justify-end group relative h-full">
                 <div class="w-full bg-emerald-500/20 rounded-t-sm relative transition-all duration-500" style="height: ${p1}%">
                    <div class="absolute bottom-0 w-full bg-emerald-500 rounded-t-sm" style="height: 100%"></div>
                 </div>
                 <span class="text-xs font-mono mt-1 text-center text-emerald-400">${p1}%</span>
            </div>
            <div class="flex-1 flex flex-col justify-end group relative h-full">
                 <div class="w-full bg-amber-500/20 rounded-t-sm relative transition-all duration-500" style="height: ${p2}%">
                    <div class="absolute bottom-0 w-full bg-amber-500 rounded-t-sm" style="height: 100%"></div>
                 </div>
                 <span class="text-xs font-mono mt-1 text-center text-amber-400">${p2}%</span>
            </div>
            <div class="flex-1 flex flex-col justify-end group relative h-full">
                 <div class="w-full bg-red-500/20 rounded-t-sm relative transition-all duration-500" style="height: ${p3}%">
                    <div class="absolute bottom-0 w-full bg-red-500 rounded-t-sm" style="height: 100%"></div>
                 </div>
                 <span class="text-xs font-mono mt-1 text-center text-red-400">${p3}%</span>
            </div>
        `;
    }
};

// Expose to window
window.StatsView = StatsView;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    StatsView.init();
});

console.log('[StatsView] Module loaded');
