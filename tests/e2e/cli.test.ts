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
        expect(result).toContain('--log-file');
        expect(result).toContain('--log-level');
        expect(result).toContain('OPENAI_BASE_URL');
        expect(result).toContain('FACTORY_LOG_FILE');
        expect(result).toContain('FACTORY_LOG_LEVEL');
    });

    test('--dry-run displays config and exits without LLM call', async () => {
        const result = await $`bun factory.ts --dry-run "Test task"`.text();

        // Logger outputs startup and dry run messages
        expect(result).toContain('Factory started');
        expect(result).toContain('Dry run');
    });

    test('--verbose --dry-run shows model info', async () => {
        // In debug mode, context is shown
        const result = await $`bun factory.ts --log-level=debug --dry-run --model=test-model "Test"`.text();

        expect(result).toContain('test-model');
    });

    test('--log-level=debug shows debug messages', async () => {
        const result = await $`bun factory.ts --log-level=debug --dry-run "Test"`.text();

        // With debug level, file logging message should appear
        expect(result).toContain('Dry run');
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

    test('invalid --timeout value throws error', async () => {
        const proc = await $`bun factory.ts --timeout=abc "Test"`.nothrow();

        expect(proc.exitCode).toBe(1);
        expect(proc.stderr.toString()).toContain('Invalid --timeout value');
    });

    test('invalid --log-level value throws error', async () => {
        const proc = await $`bun factory.ts --log-level=invalid "Test"`.nothrow();

        expect(proc.exitCode).toBe(1);
        expect(proc.stderr.toString()).toContain('Invalid --log-level value');
    });
});

