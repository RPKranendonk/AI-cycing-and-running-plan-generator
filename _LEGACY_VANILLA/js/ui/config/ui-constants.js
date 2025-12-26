/**
 * UI Constants and Configuration
 * Stores color maps, title maps, and static configuration for the UI.
 * Refactored from weekly-ui.js to reduce file size and improve maintainability.
 */

window.UIConstants = {
    // Workout Color Classes
    COLORS: {
        'LongRun': 'border-orange-500/50 bg-orange-900/20 text-orange-200',
        'long_run': 'border-orange-500/50 bg-orange-900/20 text-orange-200',
        'long_run_progressive': 'border-orange-500/50 bg-orange-900/20 text-orange-200',

        'Intervals': 'border-red-500/50 bg-red-900/20 text-red-200',
        'vo2_max_4x1k': 'border-red-500/50 bg-red-900/20 text-red-200',
        'vo2_max_5x800': 'border-red-500/50 bg-red-900/20 text-red-200',
        'track_400s': 'border-red-500/50 bg-red-900/20 text-red-200',
        'hill_sprints': 'border-red-500/50 bg-red-900/20 text-red-200',
        'fartlek_10x1': 'border-red-500/50 bg-red-900/20 text-red-200',

        'Tempo': 'border-red-500/50 bg-red-900/20 text-red-200',
        'tempo_20m': 'border-red-500/50 bg-red-900/20 text-red-200',
        'tempo_30m': 'border-red-500/50 bg-red-900/20 text-red-200',
        'cruise_intervals': 'border-red-500/50 bg-red-900/20 text-red-200',
        'progressive_run': 'border-red-500/50 bg-red-900/20 text-red-200',

        'WeightTraining': 'border-purple-500/50 bg-purple-900/20 text-purple-200',
        'gym_strength': 'border-purple-500/50 bg-purple-900/20 text-purple-200',
        'gym_power': 'border-purple-500/50 bg-purple-900/20 text-purple-200',

        'Easy': 'border-blue-500/50 bg-blue-900/20 text-blue-200',
        'easy_run': 'border-blue-500/50 bg-blue-900/20 text-blue-200',
        'recovery_run': 'border-emerald-500/50 bg-emerald-900/20 text-emerald-200',

        'ActiveRecovery': 'border-emerald-500/50 bg-emerald-900/20 text-emerald-200',
        'Recovery': 'border-emerald-500/50 bg-emerald-900/20 text-emerald-200',
        'Default': 'border-slate-700 bg-slate-800/50 text-slate-400'
    },

    // Workout Titles
    TITLES: {
        'Running': {
            'LongRun': 'Long Run',
            'long_run': 'Long Run',
            'long_run_progressive': 'Prog. Long Run',

            'Easy': 'Easy Run',
            'easy_run': 'Easy Run',
            'recovery_run': 'Recovery Run',

            'Intervals': 'Intervals',
            'vo2_max_4x1k': 'VO2 Max 4x1k',
            'vo2_max_5x800': 'VO2 Max 5x800m',
            'track_400s': 'Speed 400s',
            'hill_sprints': 'Hill Sprints',
            'fartlek_10x1': 'Fartlek 10x1',
            'strides_8x20s': 'Strides',

            'Tempo': 'Tempo',
            'tempo_20m': 'Tempo 20m',
            'tempo_30m': 'Tempo 30m',
            'cruise_intervals': 'Cruise Intervals',
            'progressive_run': 'Progressive Run',

            'WeightTraining': 'Strength',
            'gym_strength': 'Strength',
            'gym_power': 'Power',

            'Yoga': 'Yoga',
            'ActiveRecovery': 'Recovery',
            'Rest': 'Rest'
        },
        'Cycling': {
            'LongRun': 'Long Ride', // Mapped from LongRun type
            'long_run': 'Long Ride',
            'long_run_progressive': 'Prog. Long Ride',

            'Easy': 'Easy Spin',
            'easy_run': 'Easy Spin',
            'recovery_run': 'Recovery Spin',

            'Intervals': 'Intervals',
            'vo2_max_4x1k': 'VO2 Max',
            'vo2_max_5x800': 'VO2 Max',
            'track_400s': 'Sprints',
            'hill_sprints': 'Hill Climbs',
            'fartlek_10x1': 'Fartlek',

            'Tempo': 'Threshold',
            'tempo_20m': 'Threshold 20m',
            'tempo_30m': 'Threshold 30m',
            'cruise_intervals': 'Cruise Intervals',
            'progressive_run': 'Progressive Ride',

            'WeightTraining': 'Strength',
            'gym_strength': 'Strength',
            'gym_power': 'Power',

            'Yoga': 'Yoga',
            'ActiveRecovery': 'Recovery',
            'Rest': 'Rest'
        }
    },

    // Tooltips and Labels
    LABELS: {
        COACH_NOTE: 'Coaching Notes / Feedback',
        COACH_PLACEHOLDER: "e.g., 'Group run on Wednesday evening', 'sore knee this week', 'prefer morning workouts'...",
        DRAG_TIP: '💡 Drag workouts to any day • Use gear icon ⚙️ to adjust this week\'s availability'
    },

    // Helper to get color class
    getWorkoutColorClass: function (type) {
        return this.COLORS[type] || this.COLORS['Default'];
    },

    // Helper to get title
    getWorkoutTitle: function (typeId, note, isCycling = false) {
        const sport = isCycling ? 'Cycling' : 'Running';
        const mapping = this.TITLES[sport];
        // Return note if present, otherwise mapped title, otherwise typeId
        return note || mapping[typeId] || typeId || 'Rest';
    }
};
