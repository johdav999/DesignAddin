"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiLlmProvider = void 0;
const OpenAiMarkdownGenerator_1 = require("./OpenAiMarkdownGenerator");
class OpenAiLlmProvider {
    generator = new OpenAiMarkdownGenerator_1.OpenAiMarkdownGenerator();
    async generateJson(schemaName, prompt) {
        const stage = this.mapSchemaToStage(schemaName);
        const inputs = { prompt };
        const markdown = await this.generator.generateMarkdown(stage, inputs);
        return { markdown };
    }
    mapSchemaToStage(schemaName) {
        const normalized = schemaName.toLowerCase();
        if (normalized.includes('brief')) {
            return 'brief';
        }
        if (normalized.includes('architecture')) {
            return 'architecture';
        }
        if (normalized.includes('backlog')) {
            return 'backlog';
        }
        return 'prompts';
    }
}
exports.OpenAiLlmProvider = OpenAiLlmProvider;
//# sourceMappingURL=OpenAiLlmProvider.js.map