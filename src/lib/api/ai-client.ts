// ============================================================================
// AI PROVIDER CLIENT
// TypeScript port for calling various AI providers
// ============================================================================

export type AIProvider = 'gemini' | 'mistral' | 'deepseek' | 'openrouter' | 'openai';

export interface AIConfig {
    provider: AIProvider;
    apiKey: string;
    model?: string;
    temperature?: number;
}

export interface AIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface AIResponse {
    content: string;
    provider: AIProvider;
    model: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

// ============================================================================
// PROVIDER ENDPOINTS
// ============================================================================

const PROVIDER_CONFIG: Record<AIProvider, {
    url: string;
    defaultModel: string;
    parseResponse: (data: unknown) => string;
}> = {
    gemini: {
        url: 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
        defaultModel: 'gemini-2.5-flash',
        parseResponse: (data: unknown) => {
            const d = data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
            return d.candidates?.[0]?.content?.parts?.[0]?.text || '';
        },
    },
    mistral: {
        url: 'https://api.mistral.ai/v1/chat/completions',
        defaultModel: 'mistral-large-latest',
        parseResponse: (data: unknown) => {
            const d = data as { choices?: Array<{ message?: { content?: string } }> };
            return d.choices?.[0]?.message?.content || '';
        },
    },
    deepseek: {
        url: 'https://api.deepseek.com/chat/completions',
        defaultModel: 'deepseek-chat',
        parseResponse: (data: unknown) => {
            const d = data as { choices?: Array<{ message?: { content?: string } }> };
            return d.choices?.[0]?.message?.content || '';
        },
    },
    openrouter: {
        url: 'https://openrouter.ai/api/v1/chat/completions',
        defaultModel: 'deepseek/deepseek-r1',
        parseResponse: (data: unknown) => {
            const d = data as { choices?: Array<{ message?: { content?: string } }> };
            return d.choices?.[0]?.message?.content || '';
        },
    },
    openai: {
        url: 'https://api.openai.com/v1/chat/completions',
        defaultModel: 'gpt-4o',
        parseResponse: (data: unknown) => {
            const d = data as { choices?: Array<{ message?: { content?: string } }> };
            return d.choices?.[0]?.message?.content || '';
        },
    },
};

// ============================================================================
// RATE LIMITING
// ============================================================================

const rateLimits: Record<string, { count: number; start: number }> = {};

function checkRateLimit(provider: AIProvider, maxPerMinute: number): void {
    const now = Date.now();

    if (!rateLimits[provider]) {
        rateLimits[provider] = { count: 0, start: now };
    }

    const limit = rateLimits[provider];

    // Reset if minute has passed
    if (now - limit.start > 60000) {
        limit.count = 0;
        limit.start = now;
    }

    if (limit.count >= maxPerMinute) {
        const waitSec = Math.ceil((60000 - (now - limit.start)) / 1000);
        throw new Error(`Rate limit exceeded. Please wait ${waitSec} seconds.`);
    }

    limit.count++;
}

// ============================================================================
// AI CLIENT CLASS
// ============================================================================

class AIClient {
    private config: AIConfig | null = null;

    /**
     * Configure the AI client
     */
    configure(config: AIConfig): void {
        this.config = config;
    }

    /**
     * Get current configuration
     */
    getConfig(): AIConfig | null {
        return this.config;
    }

    /**
     * Call the AI provider with messages
     */
    async chat(messages: AIMessage[]): Promise<AIResponse> {
        if (!this.config) {
            throw new Error('AI client not configured. Call configure() first.');
        }

        const { provider, apiKey, model, temperature = 0.7 } = this.config;

        if (!apiKey) {
            throw new Error(`${provider} API key not configured.`);
        }

        // Rate limiting for Gemini (free tier)
        if (provider === 'gemini') {
            checkRateLimit('gemini', 5);
        }

        const providerConfig = PROVIDER_CONFIG[provider];
        const selectedModel = model || providerConfig.defaultModel;

        try {
            const response = await this.makeRequest(
                provider,
                apiKey,
                selectedModel,
                messages,
                temperature
            );

            const content = providerConfig.parseResponse(response);

            if (!content) {
                throw new Error(`No content returned from ${provider}`);
            }

            return {
                content,
                provider,
                model: selectedModel,
            };
        } catch (error) {
            console.error(`[AIClient] ${provider} error:`, error);
            throw error;
        }
    }

    /**
     * Make the actual HTTP request to the provider
     */
    private async makeRequest(
        provider: AIProvider,
        apiKey: string,
        model: string,
        messages: AIMessage[],
        temperature: number
    ): Promise<unknown> {
        const config = PROVIDER_CONFIG[provider];
        let url = config.url;

        // Gemini has different URL format
        if (provider === 'gemini') {
            url = url.replace('{model}', model) + `?key=${apiKey}`;
        }

        // Build request body
        let body: unknown;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (provider === 'gemini') {
            // Gemini format
            const prompt = messages.map(m => m.content).join('\n\n');
            body = {
                contents: [{ parts: [{ text: prompt }] }],
            };
        } else {
            // OpenAI-compatible format
            headers['Authorization'] = `Bearer ${apiKey}`;

            if (provider === 'openrouter') {
                headers['HTTP-Referer'] = typeof window !== 'undefined' ? window.location.href : '';
                headers['X-Title'] = 'Endurance AI';
            }

            body = {
                model,
                messages,
                temperature,
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(180000), // 3 minute timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API Error ${response.status}`;
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.error?.message || errorData.message || errorMessage;
            } catch {
                // Use default error message
            }
            throw new Error(errorMessage);
        }

        return response.json();
    }

    /**
     * Simple completion helper
     */
    async complete(
        systemPrompt: string,
        userPrompt: string
    ): Promise<string> {
        const response = await this.chat([
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ]);
        return response.content;
    }
}

// Export singleton instance
export const aiClient = new AIClient();

// Export class for testing
export { AIClient };
