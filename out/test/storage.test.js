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
const assert = __importStar(require("assert"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const storage_1 = require("../storage");
suite('DesignAddinStorage', () => {
    test('artifact path helpers', () => {
        assert.strictEqual((0, storage_1.artifactFileName)('brief'), 'brief.md');
        assert.strictEqual((0, storage_1.artifactRelativePath)('architecture'), '.design-addin/architecture.md');
    });
    test('write and read artifact markdown', async () => {
        const root = vscode.Uri.file(path.join(os.tmpdir(), `design-addin-test-${Date.now()}`));
        const storage = new storage_1.DesignAddinStorage(root);
        await storage.writeArtifact('idea', '# Idea\nTest');
        const value = await storage.readArtifact('idea');
        assert.strictEqual(value, '# Idea\nTest');
    });
});
//# sourceMappingURL=storage.test.js.map