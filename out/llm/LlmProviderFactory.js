"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLlmProvider = createLlmProvider;
const OpenAiLlmProvider_1 = require("./OpenAiLlmProvider");
const StubLlmProvider_1 = require("./StubLlmProvider");
function createLlmProvider(enabled, providerName) {
    switch (providerName) {
        case 'openai':
            return enabled ? new OpenAiLlmProvider_1.OpenAiLlmProvider() : new StubLlmProvider_1.StubLlmProvider(false);
        case 'stub':
        default:
            return new StubLlmProvider_1.StubLlmProvider(enabled);
    }
}
//# sourceMappingURL=LlmProviderFactory.js.map