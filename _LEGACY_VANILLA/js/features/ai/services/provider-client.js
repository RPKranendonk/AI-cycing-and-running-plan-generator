// ==========================================
// AI PROVIDER CLIENT
// Handles HTTP calls to various AI providers
// ==========================================

/**
 * Call DeepSeek API
 * @param {string} prompt - The prompt to send
 * @param {Array} indices - Week indices for response processing
 * @returns {Promise<Array>} Parsed workout results
 */
async function callDeepSeekAPI(prompt, indices) {
    try {
        const cleanKey = state.deepseekApiKey ? state.deepseekApiKey.trim() : "";

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                stream: false
            }),
            signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from DeepSeek");
        }

        return window.processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("DeepSeek Call Failed:", error);
        showToast(`❌ DeepSeek Error: ${error.message}`);
        throw error;
    }
}

/**
 * Call OpenRouter API
 * @param {string} prompt - The prompt to send
 * @param {Array} indices - Week indices for response processing
 * @returns {Promise<Array>} Parsed workout results
 */
async function callOpenRouterAPI(prompt, indices) {
    try {
        const cleanKey = state.openRouterApiKey ? state.openRouterApiKey.trim() : "";
        const model = "deepseek/deepseek-r1";

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`,
                'HTTP-Referer': window.location.href,
                'X-Title': 'Simple AI Coach'
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3
            }),
            signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from OpenRouter");
        }

        return window.processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("OpenRouter Call Failed:", error);
        showToast(`❌ OpenRouter Error: ${error.message}`);
        throw error;
    }
}

/**
 * Call Mistral API
 * @param {string} prompt - The prompt to send
 * @param {Array} indices - Week indices for response processing
 * @returns {Promise<Array>} Parsed workout results
 */
async function callMistralAPI(prompt, indices) {
    try {
        const cleanKey = state.mistralApiKey ? state.mistralApiKey.trim() : "";

        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${cleanKey}`
            },
            body: JSON.stringify({
                model: "mistral-large-latest",
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || `API Error ${response.status}`);
        }

        const data = await response.json();

        if (!data.choices || data.choices.length === 0) {
            throw new Error("No choices returned from Mistral");
        }

        return window.processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("Mistral Call Failed:", error);
        showToast(`❌ Mistral Error: ${error.message}`);
        throw error;
    }
}

/**
 * Call OpenAI API
 * @param {string} prompt - The prompt to send
 * @param {Array} indices - Week indices for response processing
 * @returns {Promise<Array>} Parsed workout results
 */
async function callOpenAI(prompt, indices) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${state.aiApiKey || state.openAIApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: "You are an expert endurance coach." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7
            }),
            signal: AbortSignal.timeout(120000)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `API Error ${response.status}`);
        }

        const data = await response.json();
        return window.processAIResponse(data.choices[0].message.content, indices, true);

    } catch (error) {
        hideAILoading();
        console.error("OpenAI Call Failed:", error);
        showToast(`❌ OpenAI Error: ${error.message}`);
        throw error;
    }
}

/**
 * Call Gemini API with rate limiting
 * @param {string} prompt - The prompt to send
 * @param {Array} indices - Week indices for response processing
 * @returns {Promise<Array>} Parsed workout results
 */
async function callGeminiAPI(prompt, indices) {
    // Rate Limiting Check
    if (!state._geminiRateLimit) state._geminiRateLimit = { count: 0, start: Date.now() };

    const RATE_LIMIT_RPM = 5;
    const now = Date.now();
    if (now - state._geminiRateLimit.start > 60000) {
        state._geminiRateLimit.count = 0;
        state._geminiRateLimit.start = now;
    }

    if (state._geminiRateLimit.count >= RATE_LIMIT_RPM) {
        const waitSec = 60 - Math.floor((now - state._geminiRateLimit.start) / 1000);
        showToast(`⚠️ Rate Limit: Please wait ${waitSec}s`);
        throw new Error(`Gemini Rate Limit Exceeded. Please wait ${waitSec} seconds.`);
    }

    state._geminiRateLimit.count++;

    try {
        const cleanKey = state.geminiApiKey ? state.geminiApiKey.trim() : "";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${cleanKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            }),
            signal: AbortSignal.timeout(180000)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = `API Error ${response.status}`;
            try {
                const errObj = JSON.parse(errorText);
                if (errObj.error && errObj.error.message) errorMsg = errObj.error.message;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        if (data.candidates && data.candidates.length > 0) {
            return window.processAIResponse(data.candidates[0].content.parts[0].text, indices, true);
        } else {
            throw new Error("No candidates returned from Gemini");
        }

    } catch (error) {
        hideAILoading();
        showToast(`❌ Gemini Error: ${error.message}`);
        throw error;
    }
}

/**
 * Route to appropriate provider based on state
 * @param {string} prompt - The prompt to send
 * @param {Array} indices - Week indices for response processing
 * @returns {Promise<Array>} Parsed workout results
 */
async function callAIProvider(prompt, indices) {
    const provider = state.aiProvider || 'gemini';

    if (provider === 'gemini') {
        if (!state.geminiApiKey) throw new Error("Gemini API Key is missing.");
        return await callGeminiAPI(prompt, indices);
    } else if (provider === 'deepseek') {
        if (!state.deepseekApiKey) throw new Error("DeepSeek API Key is missing.");
        return await callDeepSeekAPI(prompt, indices);
    } else if (provider === 'openrouter') {
        if (!state.openRouterApiKey) throw new Error("OpenRouter API Key is missing.");
        return await callOpenRouterAPI(prompt, indices);
    } else if (provider === 'mistral') {
        if (!state.mistralApiKey) throw new Error("Mistral API Key is missing.");
        return await callMistralAPI(prompt, indices);
    } else {
        return await callOpenAI(prompt, indices);
    }
}

// --- EXPOSE TO WINDOW (Backwards Compatibility) ---
window.callDeepSeekAPI = callDeepSeekAPI;
window.callOpenRouterAPI = callOpenRouterAPI;
window.callMistralAPI = callMistralAPI;
window.callOpenAI = callOpenAI;
window.callGeminiAPI = callGeminiAPI;
window.callAIProvider = callAIProvider;

window.AIProviderClient = {
    callDeepSeekAPI,
    callOpenRouterAPI,
    callMistralAPI,
    callOpenAI,
    callGeminiAPI,
    callAIProvider
};
