import * as assert from 'assert';
import { buildChatCompletionsRequest } from '../openaiClient';

suite('OpenAiClient', () => {
	test('buildChatCompletionsRequest builds deterministic payload', () => {
		const request = buildChatCompletionsRequest(
			{
				model: 'gpt-4.1-mini',
				temperature: 0.2,
				maxOutputTokens: 3000,
			},
			'hello world'
		);

		assert.strictEqual(request.model, 'gpt-4.1-mini');
		assert.strictEqual(request.temperature, 0.2);
		assert.strictEqual(request.max_tokens, 3000);
		assert.strictEqual(request.messages.length, 1);
		assert.strictEqual(request.messages[0].role, 'user');
		assert.strictEqual(request.messages[0].content, 'hello world');
	});
});
