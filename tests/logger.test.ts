import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { Logger, createLogger, type LogEntry } from '../src/logger';
import type { LogLevel } from '../src/types';

const TEST_LOG_FILE = '/tmp/test_factory.log';

describe('Logger', () => {
    afterEach(async () => {
        // Cleanup test log file
        if (existsSync(TEST_LOG_FILE)) {
            await unlink(TEST_LOG_FILE);
        }
    });

    describe('Level filtering', () => {
        test('debug level logs all messages', async () => {
            const consoleSpy = mock(() => { });
            const originalLog = console.log;
            const originalError = console.error;
            console.log = consoleSpy;
            console.error = consoleSpy;

            const logger = new Logger({ level: 'debug', quiet: false });
            logger.debug('debug msg');
            logger.info('info msg');
            logger.warn('warn msg');
            logger.error('error msg');

            console.log = originalLog;
            console.error = originalError;

            expect(consoleSpy).toHaveBeenCalledTimes(4);
        });

        test('info level filters debug messages', async () => {
            const consoleSpy = mock(() => { });
            const originalLog = console.log;
            const originalError = console.error;
            console.log = consoleSpy;
            console.error = consoleSpy;

            const logger = new Logger({ level: 'info', quiet: false });
            logger.debug('debug msg');
            logger.info('info msg');
            logger.warn('warn msg');
            logger.error('error msg');

            console.log = originalLog;
            console.error = originalError;

            expect(consoleSpy).toHaveBeenCalledTimes(3);
        });

        test('error level only logs errors', async () => {
            const consoleSpy = mock(() => { });
            const originalLog = console.log;
            const originalError = console.error;
            console.log = consoleSpy;
            console.error = consoleSpy;

            const logger = new Logger({ level: 'error', quiet: false });
            logger.debug('debug msg');
            logger.info('info msg');
            logger.warn('warn msg');
            logger.error('error msg');

            console.log = originalLog;
            console.error = originalError;

            expect(consoleSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Quiet mode', () => {
        test('quiet mode suppresses console output', async () => {
            const consoleSpy = mock(() => { });
            const originalLog = console.log;
            console.log = consoleSpy;

            const logger = new Logger({ level: 'debug', quiet: true });
            logger.info('should not appear');

            console.log = originalLog;

            expect(consoleSpy).not.toHaveBeenCalled();
        });
    });

    describe('File logging', () => {
        test('creates log file on first write', async () => {
            const logger = new Logger({ level: 'info', quiet: true, logFile: TEST_LOG_FILE });
            logger.info('test message');
            await logger.close();

            expect(existsSync(TEST_LOG_FILE)).toBe(true);
        });

        test('writes valid JSON lines', async () => {
            const logger = new Logger({ level: 'info', quiet: true, logFile: TEST_LOG_FILE });
            logger.info('message 1', { foo: 'bar' });
            logger.warn('message 2');
            await logger.close();

            const content = await readFile(TEST_LOG_FILE, 'utf-8');
            const lines = content.trim().split('\n');

            expect(lines.length).toBe(2);

            const entry1 = JSON.parse(lines[0]!) as LogEntry;
            expect(entry1.level).toBe('info');
            expect(entry1.message).toBe('message 1');
            expect(entry1.context).toEqual({ foo: 'bar' });

            const entry2 = JSON.parse(lines[1]!) as LogEntry;
            expect(entry2.level).toBe('warn');
            expect(entry2.message).toBe('message 2');
        });

        test('includes timestamp in ISO 8601 format', async () => {
            const logger = new Logger({ level: 'info', quiet: true, logFile: TEST_LOG_FILE });
            logger.info('test');
            await logger.close();

            const content = await readFile(TEST_LOG_FILE, 'utf-8');
            const entry = JSON.parse(content.trim()) as LogEntry;

            // Should match ISO 8601 format
            expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        });
    });

    describe('Timer', () => {
        test('timer returns duration in milliseconds', async () => {
            const logger = new Logger({ level: 'debug', quiet: true });
            const stop = logger.timer('test operation');

            // Wait a bit
            await new Promise(resolve => setTimeout(resolve, 50));

            const duration = stop();
            expect(duration).toBeGreaterThanOrEqual(40);
            expect(duration).toBeLessThan(200);
        });

        test('timer logs duration to file', async () => {
            const logger = new Logger({ level: 'debug', quiet: true, logFile: TEST_LOG_FILE });
            const stop = logger.timer('test operation');
            await new Promise(resolve => setTimeout(resolve, 10));
            stop();
            await logger.close();

            const content = await readFile(TEST_LOG_FILE, 'utf-8');
            const entry = JSON.parse(content.trim()) as LogEntry;

            expect(entry.message).toBe('test operation');
            expect(entry.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Console colors', () => {
        test('error uses console.error', async () => {
            const logSpy = mock(() => { });
            const errorSpy = mock(() => { });
            const originalLog = console.log;
            const originalError = console.error;
            console.log = logSpy;
            console.error = errorSpy;

            const logger = new Logger({ level: 'debug', quiet: false });
            logger.error('error message');

            console.log = originalLog;
            console.error = originalError;

            expect(logSpy).not.toHaveBeenCalled();
            expect(errorSpy).toHaveBeenCalled();
        });

        test('info uses console.log', async () => {
            const logSpy = mock(() => { });
            const errorSpy = mock(() => { });
            const originalLog = console.log;
            const originalError = console.error;
            console.log = logSpy;
            console.error = errorSpy;

            const logger = new Logger({ level: 'debug', quiet: false });
            logger.info('info message');

            console.log = originalLog;
            console.error = originalError;

            expect(logSpy).toHaveBeenCalled();
            expect(errorSpy).not.toHaveBeenCalled();
        });
    });

    describe('createLogger factory', () => {
        test('creates logger from config', () => {
            const logger = createLogger({
                logFile: null,
                logLevel: 'warn',
                quiet: true,
            });

            expect(logger).toBeInstanceOf(Logger);
        });
    });
});
