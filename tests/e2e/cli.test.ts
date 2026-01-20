import { describe, test, expect, beforeAll } from 'bun:test';
import { $ } from 'bun';

describe('E2E: CLI', () => {
    test('--help shows usage information', async () => {
        const result = await $`bun factory.ts --help`.text();

        expect(result).toContain('Factory');
        expect(result).toContain('--model');
        expect(result).toContain('--timeout');
        expect(result).toContain('--dry-run');
        expect(result).toContain('--base-url');
        expect(result).toContain('OPENAI_BASE_URL');
    });

    test('--dry-run displays config and exits without LLM call', async () => {
        const result = await $`bun factory.ts --dry-run "Test task"`.text();

        expect(result).toContain('Dry run mode');
        expect(result).toContain('Test task');
    });

    test('--verbose --dry-run shows model info', async () => {
        const result = await $`bun factory.ts --verbose --dry-run --model=test-model "Test"`.text();

        expect(result).toContain('test-model');
    });

    test('runs without errors with no arguments (resume mode)', async () => {
        // This should print "Resume" and either find no prd.json or complete
        const proc = await $`bun factory.ts --dry-run`.nothrow();

        expect(proc.exitCode).toBe(0);
    });

    test('factory.ts is valid TypeScript', async () => {
        // Just check it can be parsed
        const proc = await $`bun build --target=bun factory.ts`.nothrow();

        expect(proc.exitCode).toBe(0);
    });
});
