// ==========================================
// AI FEATURE - BARREL EXPORT
// Re-exports all AI services
// ==========================================

/**
 * AI Feature Module
 * 
 * This module provides AI integration for workout plan generation.
 * It replaces the monolithic ai-service.js with focused service modules.
 * 
 * Services:
 * - provider-client.js   : HTTP calls to all AI providers
 * - context-builder.js   : Builds context data for prompts
 * - response-parser.js   : Parses AI responses into workouts
 * - ai-orchestrator.js   : Main workflow orchestration
 * 
 * All functions are exposed to window.* for backwards compatibility.
 */

(function () {
    console.log('[AI] Feature module loaded');

    // Verify all services are loaded
    const requiredExports = [
        'preparePlanWithAI',
        'regenerateBlockWithFeedback',
        'processAIResponse',
        'callGeminiAPI',
        'callOpenAI',
        'getLast4WeeksSummary',
        'getZonePaceStrings'
    ];

    const missingExports = requiredExports.filter(name => typeof window[name] === 'undefined');
    if (missingExports.length > 0) {
        console.warn('[AI] Missing exports:', missingExports);
    } else {
        console.log('[AI] All exports verified ✓');
    }

    // Export namespace object
    window.AI = {
        Orchestrator: window.AIOrchestrator,
        ProviderClient: window.AIProviderClient,
        ResponseParser: window.AIResponseParser,
        ContextBuilder: window.AIContextBuilder
    };
})();
