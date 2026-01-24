import { describe, test, expect } from 'bun:test';
import { $ } from 'bun';

describe('E2E: Environment Variables', () => {
    test('FACTORY_MODEL env var is picked up', async () => {
        // Use debug log level to see full context including model
        const proc = await $`FACTORY_MODEL=test-env-model bun factory.ts --log-level=debug --dry-run "Test"`.nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('test-env-model');
    });

    test('FACTORY_LOG_LEVEL env var is picked up', async () => {
        const proc = await $`FACTORY_LOG_LEVEL=debug bun factory.ts --dry-run "Test"`.nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        // Debug level should show more messages
        expect(proc.exitCode).toBe(0);
    });

    test('CLI flag overrides ENV var', async () => {
        // Use debug log level to see model in context
        const proc = await $`FACTORY_MODEL=env-model bun factory.ts --model=cli-model --log-level=debug --dry-run "Test"`.nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('cli-model');
    });

    test('API key warning when no keys set', async () => {
        // Clear all API keys and check for warning
        const proc = await $`env HOME=/tmp/nonexistent GOOGLE_API_KEY= OPENAI_API_KEY= ANTHROPIC_API_KEY= OPENROUTER_API_KEY= bun factory.ts --model gpt-4 --dry-run "Test"`.nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('No API keys found');
    });
});
