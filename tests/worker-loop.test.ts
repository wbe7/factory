import { describe, test, expect, mock } from 'bun:test';
import { workerLoop } from '../src/worker';

describe('Worker Loop', () => {
    test('returns true when COMPLETE promise found on first iteration', async () => {
        const mockRunner = mock(() => Promise.resolve('<promise>COMPLETE</promise>'));
        const result = await workerLoop('test prompt', { workerIterations: 10, verbose: false }, mockRunner);

        expect(result).toBe(true);
        expect(mockRunner).toHaveBeenCalledTimes(1);
    });

    test('returns true when COMPLETE found on third iteration', async () => {
        let calls = 0;
        const mockRunner = mock(() => {
            calls++;
            if (calls < 3) return Promise.resolve('Still working...');
            return Promise.resolve('<promise>COMPLETE</promise>');
        });

        const result = await workerLoop('test prompt', { workerIterations: 10, verbose: false }, mockRunner);

        expect(result).toBe(true);
        expect(calls).toBe(3);
    });

    test('returns false when max iterations reached', async () => {
        const mockRunner = mock(() => Promise.resolve('Never completes'));
        const result = await workerLoop('test prompt', { workerIterations: 3, verbose: false }, mockRunner);

        expect(result).toBe(false);
        expect(mockRunner).toHaveBeenCalledTimes(3);
    });

    test('continues on error and retries', async () => {
        let calls = 0;
        const mockRunner = mock(() => {
            calls++;
            if (calls === 1) return Promise.reject(new Error('First call fails'));
            return Promise.resolve('<promise>COMPLETE</promise>');
        });

        const result = await workerLoop('test prompt', { workerIterations: 5, verbose: false }, mockRunner);

        expect(result).toBe(true);
        expect(calls).toBe(2);
    });

    test('handles all iterations failing', async () => {
        const mockRunner = mock(() => Promise.reject(new Error('Always fails')));
        const result = await workerLoop('test prompt', { workerIterations: 3, verbose: false }, mockRunner);

        expect(result).toBe(false);
        expect(mockRunner).toHaveBeenCalledTimes(3);
    });

    test('verbose mode logs iterations', async () => {
        const mockRunner = mock(() => Promise.resolve('<promise>COMPLETE</promise>'));
        const consoleSpy = mock(() => { });
        const originalLog = console.log;
        console.log = consoleSpy;

        await workerLoop('test prompt', { workerIterations: 10, verbose: true }, mockRunner);

        console.log = originalLog;
        expect(consoleSpy).toHaveBeenCalled();
    });
});
