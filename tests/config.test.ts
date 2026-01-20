import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { parseArgs, parseEnvConfig, mergeConfig } from '../src/config';
import { DEFAULT_CONFIG } from '../src/types';

describe('CLI Argument Parsing', () => {
    test('parses positional goal argument', () => {
        const config = parseArgs(['Create REST API']);
        expect(config.goal).toBe('Create REST API');
    });

    test('parses --model flag with =', () => {
        const config = parseArgs(['--model=gpt-4', 'goal']);
        expect(config.model).toBe('gpt-4');
    });

    test('parses --model flag with space', () => {
        const config = parseArgs(['--model', 'gpt-4', 'goal']);
        expect(config.model).toBe('gpt-4');
    });

    test('parses --base-url flag', () => {
        const config = parseArgs(['--base-url=http://localhost:8000/v1', 'goal']);
        expect(config.baseUrl).toBe('http://localhost:8000/v1');
    });

    test('parses --dry-run flag', () => {
        const config = parseArgs(['--dry-run', 'goal']);
        expect(config.dryRun).toBe(true);
    });

    test('parses --mock-llm flag', () => {
        const config = parseArgs(['--mock-llm', 'goal']);
        expect(config.mockLlm).toBe(true);
    });

    test('parses --timeout flag', () => {
        const config = parseArgs(['--timeout=1800', 'goal']);
        expect(config.timeout).toBe(1800);
    });

    test('parses --verbose flag', () => {
        const config = parseArgs(['--verbose', 'goal']);
        expect(config.verbose).toBe(true);
    });

    test('parses --quiet flag', () => {
        const config = parseArgs(['--quiet', 'goal']);
        expect(config.quiet).toBe(true);
    });

    test('parses --planning-cycles flag', () => {
        const config = parseArgs(['--planning-cycles=5', 'goal']);
        expect(config.planningCycles).toBe(5);
    });

    test('parses --verify-cycles flag', () => {
        const config = parseArgs(['--verify-cycles=5', 'goal']);
        expect(config.verificationCycles).toBe(5);
    });

    test('parses --worker-iters flag', () => {
        const config = parseArgs(['--worker-iters=20', 'goal']);
        expect(config.workerIterations).toBe(20);
    });

    test('parses --max-cost flag', () => {
        const config = parseArgs(['--max-cost=5.50', 'goal']);
        expect(config.maxCost).toBe(5.5);
    });

    test('returns empty object when no args', () => {
        const config = parseArgs([]);
        // parseArgs now returns Partial - only explicit values
        expect(config.model).toBeUndefined();
        expect(config.timeout).toBeUndefined();
        expect(config.goal).toBeUndefined();
    });

    test('handles multiple flags together', () => {
        const config = parseArgs([
            '--model=test-model',
            '--timeout=600',
            '--dry-run',
            '--verbose',
            'My goal here',
        ]);
        expect(config.model).toBe('test-model');
        expect(config.timeout).toBe(600);
        expect(config.dryRun).toBe(true);
        expect(config.verbose).toBe(true);
        expect(config.goal).toBe('My goal here');
    });
});

describe('Environment Variable Config', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        // Restore original env
        Object.keys(process.env).forEach((key) => {
            if (key.startsWith('FACTORY_') || key === 'OPENAI_BASE_URL') {
                delete process.env[key];
            }
        });
    });

    test('reads FACTORY_MODEL from env', () => {
        process.env.FACTORY_MODEL = 'custom-model';
        const config = parseEnvConfig();
        expect(config.model).toBe('custom-model');
    });

    test('reads OPENAI_BASE_URL from env', () => {
        process.env.OPENAI_BASE_URL = 'http://example.com/v1';
        const config = parseEnvConfig();
        expect(config.baseUrl).toBe('http://example.com/v1');
    });

    test('reads FACTORY_TIMEOUT from env', () => {
        process.env.FACTORY_TIMEOUT = '7200';
        const config = parseEnvConfig();
        expect(config.timeout).toBe(7200);
    });

    test('reads FACTORY_PLANNING_CYCLES from env', () => {
        process.env.FACTORY_PLANNING_CYCLES = '5';
        const config = parseEnvConfig();
        expect(config.planningCycles).toBe(5);
    });

    test('reads FACTORY_MAX_COST from env', () => {
        process.env.FACTORY_MAX_COST = '10.5';
        const config = parseEnvConfig();
        expect(config.maxCost).toBe(10.5);
    });
});

describe('Config Merge', () => {
    test('CLI args override env config with proper layering', () => {
        const cli = parseArgs(['--model=cli-model', 'goal']);
        const env = { model: 'env-model', timeout: 7200 };
        const merged = mergeConfig(cli, env);

        // CLI model overrides env model
        expect(merged.model).toBe('cli-model');
        // Env timeout used since CLI didn't specify it
        expect(merged.timeout).toBe(7200);
        expect(merged.goal).toBe('goal');
    });

    test('env values used when CLI is empty', () => {
        const cli = parseArgs(['goal']);
        const env = { model: 'env-model', timeout: 5000 };
        const merged = mergeConfig(cli, env);

        expect(merged.model).toBe('env-model');
        expect(merged.timeout).toBe(5000);
        expect(merged.goal).toBe('goal');
    });

    test('defaults used when neither CLI nor env specify values', () => {
        const cli = parseArgs(['goal']);
        const env = {};
        const merged = mergeConfig(cli, env);

        expect(merged.model).toBe(DEFAULT_CONFIG.model);
        expect(merged.timeout).toBe(DEFAULT_CONFIG.timeout);
        expect(merged.goal).toBe('goal');
    });
});
