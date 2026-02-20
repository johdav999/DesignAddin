"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiClient = void 0;
exports.buildChatCompletionsRequest = buildChatCompletionsRequest;
function buildChatCompletionsRequest(options, prompt) {
    return {
        model: options.model,
        temperature: options.temperature,
        max_tokens: options.maxOutputTokens,
        messages: [{ role: 'user', content: prompt }],
    };
}
class OpenAiClient {
    apiKey;
    options;
    output;
    constructor(apiKey, options, output) {
        this.apiKey = apiKey;
        this.options = options;
        this.output = output;
    }
    async generateMarkdown(prompt) {
        const requestBody = buildChatCompletionsRequest(this.options, prompt);
        const endpoint = `${this.options.baseUrl ?? 'https://api.openai.com'}/v1/chat/completions`;
        const start = Date.now();
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        const elapsed = Date.now() - start;
        if (!response.ok) {
            const errorText = await response.text();
            this.output.appendLine(`[openai] failed ${response.status} in ${elapsed}ms`);
            throw new Error(`OpenAI error ${response.status}: ${errorText}`);
        }
        const json = (await response.json());
        const content = json.choices?.[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('OpenAI returned an empty completion.');
        }
        this.output.appendLine(`[openai] success in ${elapsed}ms`);
        return {
            content,
            usage: {
                promptTokens: json.usage?.prompt_tokens,
                completionTokens: json.usage?.completion_tokens,
                totalTokens: json.usage?.total_tokens,
            },
        };
    }
}
exports.OpenAiClient = OpenAiClient;
//# sourceMappingURL=openaiClient.js.map