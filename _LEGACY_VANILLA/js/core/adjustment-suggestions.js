// ==========================================
// ADJUSTMENT SUGGESTIONS
// AI-powered training adjustment recommendations
// Advisory by default - user can override everything
// ==========================================

/**
 * Suggestion Types
 */
const SUGGESTION_TYPES = {
    PROCEED: 'proceed',           // All green, continue as planned
    REDUCE_VOLUME: 'reduce_volume', // Cut next week's volume
    SWAP_INTENSITY: 'swap_intensity', // Replace KEY with EASY
    ADD_REST: 'add_rest',          // Insert rest day
    EXTEND_RECOVERY: 'extend_recovery', // Suggest extra recovery week
    INCREASE_VOLUME: 'increase_volume'  // Can handle more
};

/**
 * Suggestion severity levels (for UI styling)
 */
const SUGGESTION_SEVERITY = {
    SUCCESS: 'success',   // Green - good news
    INFO: 'info',         // Blue - neutral info
    CAUTION: 'caution',   // Yellow - heads up
    WARNING: 'warning'    // Red - take action
};

/**
 * Generate adjustment suggestions based on readiness assessment
 * @param {Object} readinessResult - Output from calculateReadiness
 * @param {Object} weekPlan - Current/next week's plan
 * @param {Object} options - Additional context
 * @returns {Object} Suggestions with reasoning
 */
function generateAdjustmentSuggestions(readinessResult, weekPlan = null, options = {}) {
    const mode = window.getReadinessMode?.() || 'advisory';
    const suggestions = [];

    const { status, modifier, reasons = [], flags = {} } = readinessResult;

    // Get compliance data if available
    const complianceData = readinessResult._autoComplianceData || options.complianceData;
    const compliance = complianceData?.compliance ?? readinessResult.compliance ?? null;

    // =========================================
    // GREEN STATUS - Good to go
    // =========================================
    if (status === 'GREEN') {
        if (modifier >= 1.0) {
            suggestions.push({
                id: 'proceed_full',
                type: SUGGESTION_TYPES.PROCEED,
                severity: SUGGESTION_SEVERITY.SUCCESS,
                title: '✅ Full Steam Ahead',
                reason: 'All signals are green. Your body is responding well to training.',
                explanation: reasons.join(' • ') || 'Great recovery indicators across the board.',
                action: null,
                dismissable: false,
                autoApply: false
            });

            // Bonus: If high motivation + good compliance, can push slightly
            if (flags.green >= 3 && compliance && compliance >= 0.95) {
                suggestions.push({
                    id: 'can_push_more',
                    type: SUGGESTION_TYPES.INCREASE_VOLUME,
                    severity: SUGGESTION_SEVERITY.INFO,
                    title: '💪 Room to Push',
                    reason: 'Excellent compliance + high readiness = capacity for more.',
                    explanation: `You completed ${Math.round(compliance * 100)}% of planned volume and all recovery indicators are strong.`,
                    action: { type: 'increase_volume', amount: 5 },
                    dismissable: true,
                    autoApply: false
                });
            }
        } else {
            suggestions.push({
                id: 'proceed_standard',
                type: SUGGESTION_TYPES.PROCEED,
                severity: SUGGESTION_SEVERITY.SUCCESS,
                title: '👍 Continue as Planned',
                reason: 'Readiness looks good. Standard progression recommended.',
                explanation: reasons.join(' • ') || 'Recovery indicators are within normal range.',
                action: null,
                dismissable: false,
                autoApply: false
            });
        }
    }

    // =========================================
    // YELLOW STATUS - Maintenance
    // =========================================
    if (status === 'YELLOW') {
        suggestions.push({
            id: 'maintain_load',
            type: SUGGESTION_TYPES.PROCEED,
            severity: SUGGESTION_SEVERITY.CAUTION,
            title: '⚖️ Maintenance Week Suggested',
            reason: 'Some signals suggest your body needs consolidation time.',
            explanation: reasons.join(' • '),
            action: { type: 'maintain', note: 'Keep volume same as last week' },
            dismissable: true,
            autoApply: mode === 'strict'
        });

        // If low compliance is the issue, be understanding
        if (compliance !== null && compliance < 0.8) {
            suggestions.push({
                id: 'low_compliance_note',
                type: SUGGESTION_TYPES.PROCEED,
                severity: SUGGESTION_SEVERITY.INFO,
                title: '📊 Compliance Note',
                reason: `${Math.round(compliance * 100)}% of planned volume completed.`,
                explanation: 'Life happens! Low compliance doesn\'t always mean bad training. You may have adapted workouts to fit your schedule (commute runs, combined sessions, etc.). Only you know if the week felt productive.',
                action: null,
                dismissable: true,
                autoApply: false
            });
        }

        // If soreness is the trigger
        if (reasons.some(r => r.toLowerCase().includes('sore'))) {
            suggestions.push({
                id: 'swap_intensity',
                type: SUGGESTION_TYPES.SWAP_INTENSITY,
                severity: SUGGESTION_SEVERITY.CAUTION,
                title: '🔄 Consider Easy Swaps',
                reason: 'Muscle soreness detected.',
                explanation: 'You could swap a KEY session for an EASY run to allow recovery while maintaining volume.',
                action: { type: 'swap_intensity', from: 'KEY', to: 'EASY' },
                dismissable: true,
                autoApply: false
            });
        }
    }

    // =========================================
    // RED STATUS - Recovery needed
    // =========================================
    if (status === 'RED') {
        suggestions.push({
            id: 'reduce_volume',
            type: SUGGESTION_TYPES.REDUCE_VOLUME,
            severity: SUGGESTION_SEVERITY.WARNING,
            title: '⚠️ Recovery Week Recommended',
            reason: 'Multiple stress signals detected.',
            explanation: reasons.join(' • '),
            action: { type: 'reduce_volume', amount: 35 },
            dismissable: true,
            autoApply: mode === 'strict'
        });

        // Pain/injury is serious
        if (reasons.some(r => r.toLowerCase().includes('pain') || r.toLowerCase().includes('injury'))) {
            suggestions.push({
                id: 'pain_warning',
                type: SUGGESTION_TYPES.ADD_REST,
                severity: SUGGESTION_SEVERITY.WARNING,
                title: '🩹 Pain Reported',
                reason: 'Consider taking extra rest to prevent injury escalation.',
                explanation: 'Training through pain often leads to longer recovery periods. Listen to your body.',
                action: { type: 'add_rest', days: 2 },
                dismissable: true,
                autoApply: false
            });
        }

        // Burnout signs
        if (reasons.some(r => r.toLowerCase().includes('burnout') || r.toLowerCase().includes('motivation'))) {
            suggestions.push({
                id: 'burnout_note',
                type: SUGGESTION_TYPES.EXTEND_RECOVERY,
                severity: SUGGESTION_SEVERITY.CAUTION,
                title: '🧘 Mental Recovery',
                reason: 'Low motivation combined with fatigue can signal overtraining.',
                explanation: 'A recovery week now can prevent a longer forced break later. Consider activities you enjoy outside of structured training.',
                action: { type: 'extend_recovery', weeks: 1 },
                dismissable: true,
                autoApply: false
            });
        }
    }

    // =========================================
    // Filter out dismissed suggestions
    // =========================================
    const filteredSuggestions = suggestions.filter(s => {
        if (!s.dismissable) return true;
        return !window.isSuggestionDismissed?.(s.id, s.type);
    });

    return {
        suggestions: filteredSuggestions,
        allSuggestions: suggestions, // Include dismissed for debugging
        mode,
        status: readinessResult.status,
        autoApply: mode === 'strict' && status === 'RED',
        compliancePercent: compliance !== null ? Math.round(compliance * 100) : null,
        summary: generateSummary(status, filteredSuggestions)
    };
}

/**
 * Generate a human-readable summary
 */
function generateSummary(status, suggestions) {
    const actionable = suggestions.filter(s => s.action);

    if (status === 'GREEN' && actionable.length === 0) {
        return 'You\'re in great shape. Continue as planned!';
    }
    if (status === 'YELLOW') {
        return 'Consider maintaining current load. No need to push harder yet.';
    }
    if (status === 'RED') {
        return 'Recovery signals detected. Consider reducing load this week.';
    }
    return 'Review the suggestions below.';
}

/**
 * Apply a suggestion's action to the plan (stub for now)
 * @param {Object} suggestion - Suggestion object
 * @param {Object} weekPlan - Week to modify
 */
function applySuggestion(suggestion, weekPlan) {
    if (!suggestion.action) {
        console.log('[Suggestions] No action to apply');
        return weekPlan;
    }

    console.log('[Suggestions] Applying:', suggestion.id, suggestion.action);

    // TODO: Implement actual plan modification based on action type
    // For now, just log and return unchanged
    switch (suggestion.action.type) {
        case 'reduce_volume':
            console.log(`[Suggestions] Would reduce volume by ${suggestion.action.amount}%`);
            break;
        case 'increase_volume':
            console.log(`[Suggestions] Would increase volume by ${suggestion.action.amount}%`);
            break;
        case 'swap_intensity':
            console.log(`[Suggestions] Would swap ${suggestion.action.from} to ${suggestion.action.to}`);
            break;
        case 'add_rest':
            console.log(`[Suggestions] Would add ${suggestion.action.days} rest days`);
            break;
        case 'extend_recovery':
            console.log(`[Suggestions] Would extend recovery by ${suggestion.action.weeks} weeks`);
            break;
        default:
            console.log('[Suggestions] Unknown action type');
    }

    return weekPlan;
}

// Expose to window
window.SUGGESTION_TYPES = SUGGESTION_TYPES;
window.SUGGESTION_SEVERITY = SUGGESTION_SEVERITY;
window.generateAdjustmentSuggestions = generateAdjustmentSuggestions;
window.applySuggestion = applySuggestion;

console.log('[AdjustmentSuggestions] Loaded - Advisory system ready');
