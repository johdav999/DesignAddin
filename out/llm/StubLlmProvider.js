"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubLlmProvider = void 0;
class StubLlmProvider {
    enabled;
    constructor(enabled) {
        this.enabled = enabled;
    }
    async generateJson(_schemaName, _prompt) {
        if (!this.enabled) {
            throw new Error('LLM not configured');
        }
        throw new Error('LLM provider not implemented yet');
    }
}
exports.StubLlmProvider = StubLlmProvider;
//# sourceMappingURL=StubLlmProvider.js.map