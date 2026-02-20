"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiMarkdownGenerator = void 0;
const vscode = __importStar(require("vscode"));
class OpenAiMarkdownGenerator {
    async generateMarkdown(stage, inputs) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            await vscode.window.showErrorMessage(`OpenAI API key is missing.

Windows (PowerShell):

setx OPENAI_API_KEY "your_key_here"
# then restart VS Code

macOS/Linux (zsh/bash):

export OPENAI_API_KEY="your_key_here"
# launch code from same terminal OR add to ~/.zshrc ~/.bashrc

VS Code must be restarted after setting env vars in most cases.`, { modal: true });
            throw new Error('OPENAI_API_KEY is not set');
        }
        const model = vscode.workspace.getConfiguration('designAddin.llm').get('model', 'gpt-4.1-mini');
        const temperature = vscode.workspace.getConfiguration('designAddin.llm').get('temperature', 0.2);
        const maxTokens = vscode.workspace.getConfiguration('designAddin.llm').get('maxTokens', 3000);
        const messages = this.buildMessages(stage, inputs);
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens,
            }),
        });
        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`OpenAI request failed (${response.status}): ${responseText}`);
        }
        const data = (await response.json());
        const content = data.choices?.[0]?.message?.content?.trim();
        if (!content) {
            throw new Error('OpenAI response did not contain markdown content');
        }
        return content;
    }
    buildMessages(stage, inputs) {
        if (inputs.prompt) {
            return [
                {
                    role: 'system',
                    content: 'You are a senior product and engineering assistant. Follow the user instructions exactly and return markdown only.',
                },
                { role: 'user', content: inputs.prompt },
            ];
        }
        const systemByStage = {
            brief: 'You are an expert product manager and technical writer for developer tools. Produce clear, structured output and avoid fluff.',
            architecture: 'You are a senior software architect for VS Code extensions. You design pragmatic architectures with clear module boundaries, data contracts, and implementation details.',
            backlog: 'You are a technical product owner. You create backlogs with epics, user stories, acceptance criteria, and implementation notes.',
            prompts: 'You are a senior engineer who writes precise implementation prompts for coding agents. Your prompts must be actionable and reference exact file paths, functions, and test steps. Assume TypeScript VS Code extension + webview.',
        };
        const userByStage = {
            brief: inputs.idea ?? '',
            architecture: `IDEA:\n${inputs.idea ?? ''}\n\nBRIEF:\n${inputs.brief ?? ''}`,
            backlog: `IDEA:\n${inputs.idea ?? ''}\n\nBRIEF:\n${inputs.brief ?? ''}\n\nARCHITECTURE:\n${inputs.architecture ?? ''}`,
            prompts: `ARCHITECTURE:\n${inputs.architecture ?? ''}\n\nBACKLOG:\n${inputs.backlog ?? ''}`,
        };
        return [
            { role: 'system', content: systemByStage[stage] },
            { role: 'user', content: userByStage[stage] },
        ];
    }
}
exports.OpenAiMarkdownGenerator = OpenAiMarkdownGenerator;
//# sourceMappingURL=OpenAiMarkdownGenerator.js.map