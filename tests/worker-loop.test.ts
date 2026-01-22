import { describe, test, expect, mock } from 'bun:test';
import { workerLoop, type WorkerLoopResult } from '../src/worker';
import type { FactoryConfig } from '../src/types';
import { DEFAULT_CONFIG } from '../src/types';

// Create a test config with default values
const createTestConfig = (overrides: Partial<FactoryConfig> = {}): FactoryConfig => ({
    goal: 'test',
    ...DEFAULT_CONFIG,
    ...overrides,
});

describe('Worker Loop', () => {
    test('returns completed=true when COMPLETE promise found on first iteration', async () => {
        const mockRunner = mock(() => Promise.resolve('<promise>COMPLETE</promise>'));
        const config = createTestConfig({ workerIterations: 10, verbose: false });
        const result = await workerLoop('test prompt', { config, runner: mockRunner });

        expect(result.completed).toBe(true);
        expect(result.iterations).toBe(1);
        expect(result.totalDuration).toBeGreaterThanOrEqual(0);
        expect(mockRunner).toHaveBeenCalledTimes(1);
    });

    test('returns completed=true when COMPLETE found on third iteration', async () => {
        let calls = 0;
        const mockRunner = mock(() => {
            calls++;
            if (calls < 3) return Promise.resolve('Still working...');
            return Promise.resolve('<promise>COMPLETE</promise>');
        });

        const config = createTestConfig({ workerIterations: 10, verbose: false });
        const result = await workerLoop('test prompt', { config, runner: mockRunner });

        expect(result.completed).toBe(true);
        expect(result.iterations).toBe(3);
        expect(calls).toBe(3);
    });

    test('returns completed=false when max iterations reached', async () => {
        const mockRunner = mock(() => Promise.resolve('Never completes'));
        const config = createTestConfig({ workerIterations: 3, verbose: false });
        const result = await workerLoop('test prompt', { config, runner: mockRunner });

        expect(result.completed).toBe(false);
        expect(result.iterations).toBe(3);
        expect(mockRunner).toHaveBeenCalledTimes(3);
    });

    test('continues on error and retries', async () => {
        let calls = 0;
        const mockRunner = mock(() => {
            calls++;
            if (calls === 1) return Promise.reject(new Error('First call fails'));
            return Promise.resolve('<promise>COMPLETE</promise>');
        });

        const config = createTestConfig({ workerIterations: 5, verbose: false });
        const result = await workerLoop('test prompt', { config, runner: mockRunner });

        expect(result.completed).toBe(true);
        expect(result.iterations).toBe(2);
        expect(calls).toBe(2);
    });

    test('handles all iterations failing', async () => {
        const mockRunner = mock(() => Promise.reject(new Error('Always fails')));
        const config = createTestConfig({ workerIterations: 3, verbose: false });
        const result = await workerLoop('test prompt', { config, runner: mockRunner });

        expect(result.completed).toBe(false);
        expect(result.iterations).toBe(3);
        expect(mockRunner).toHaveBeenCalledTimes(3);
    });

    test('verbose mode logs iterations without logger', async () => {
        const mockRunner = mock(() => Promise.resolve('<promise>COMPLETE</promise>'));
        const consoleSpy = mock(() => { });
        const originalLog = console.log;
        console.log = consoleSpy;

        const config = createTestConfig({ workerIterations: 10, verbose: true });
        await workerLoop('test prompt', { config, runner: mockRunner });

        console.log = originalLog;
        expect(consoleSpy).toHaveBeenCalled();
    });

    test('passes full config to runner for model/baseUrl access', async () => {
        let receivedConfig: FactoryConfig | null = null;
        const mockRunner = mock((prompt: string, config: FactoryConfig) => {
            receivedConfig = config;
            return Promise.resolve('<promise>COMPLETE</promise>');
        });

        const config = createTestConfig({
            model: 'test-model',
            baseUrl: 'http://test.com/v1',
        });
        await workerLoop('test prompt', { config, runner: mockRunner });

        expect(receivedConfig).not.toBeNull();
        expect(receivedConfig!.model).toBe('test-model');
        expect(receivedConfig!.baseUrl).toBe('http://test.com/v1');
    });

    test('returns totalDuration > 0 for successful completion', async () => {
        const mockRunner = mock(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            return '<promise>COMPLETE</promise>';
        });
        const config = createTestConfig({ workerIterations: 10, verbose: false });
        const result = await workerLoop('test prompt', { config, runner: mockRunner });

        expect(result.completed).toBe(true);
        expect(result.totalDuration).toBeGreaterThan(0);
    });

    test('passes cwd to runner when provided', async () => {
        let receivedCwd: string | undefined;
        const mockRunner = mock((prompt: string, config: FactoryConfig, cwd?: string) => {
            receivedCwd = cwd;
            return Promise.resolve('<promise>COMPLETE</promise>');
        });

        const config = createTestConfig({ workerIterations: 10, verbose: false });
        await workerLoop('test prompt', { config, runner: mockRunner, cwd: '/test/project' });

        expect(receivedCwd).toBe('/test/project');
    });
});

