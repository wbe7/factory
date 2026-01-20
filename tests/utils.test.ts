import { describe, test, expect, afterEach } from 'bun:test';
import { atomicWrite, createBackup, extractJson, formatDuration } from '../src/utils';
import { existsSync, unlinkSync, readFileSync } from 'fs';

const TEST_FILE = '/tmp/test-atomic.json';
const TEST_BACKUP = '/tmp/test-atomic.json.bak';
const TEST_TMP = '/tmp/test-atomic.json.tmp';

describe('Atomic Write', () => {
    afterEach(() => {
        [TEST_FILE, TEST_BACKUP, TEST_TMP].forEach((f) => {
            if (existsSync(f)) unlinkSync(f);
        });
    });

    test('writes file atomically', async () => {
        await atomicWrite(TEST_FILE, '{"test": true}');

        expect(existsSync(TEST_FILE)).toBe(true);
        expect(existsSync(TEST_TMP)).toBe(false); // Temp file should be gone
        expect(readFileSync(TEST_FILE, 'utf-8')).toBe('{"test": true}');
    });

    test('overwrites existing file', async () => {
        await atomicWrite(TEST_FILE, '{"version": 1}');
        await atomicWrite(TEST_FILE, '{"version": 2}');

        expect(readFileSync(TEST_FILE, 'utf-8')).toBe('{"version": 2}');
    });
});

describe('Create Backup', () => {
    afterEach(() => {
        [TEST_FILE, TEST_BACKUP].forEach((f) => {
            if (existsSync(f)) unlinkSync(f);
        });
    });

    test('creates backup before overwrite', async () => {
        await atomicWrite(TEST_FILE, '{"version": 1}');
        await createBackup(TEST_FILE);
        await atomicWrite(TEST_FILE, '{"version": 2}');

        expect(readFileSync(TEST_BACKUP, 'utf-8')).toBe('{"version": 1}');
        expect(readFileSync(TEST_FILE, 'utf-8')).toBe('{"version": 2}');
    });

    test('does nothing if file does not exist', async () => {
        await createBackup('/tmp/nonexistent-file.json');
        expect(existsSync('/tmp/nonexistent-file.json.bak')).toBe(false);
    });
});

describe('Extract JSON', () => {
    test('extracts JSON from markdown code block', () => {
        const input = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
        expect(extractJson(input)).toBe('{"key": "value"}');
    });

    test('returns raw text if no code block', () => {
        const input = '{"key": "value"}';
        expect(extractJson(input)).toBe('{"key": "value"}');
    });

    test('handles multiline JSON', () => {
        const input = '```json\n{\n  "key": "value",\n  "nested": {\n    "a": 1\n  }\n}\n```';
        const result = extractJson(input);
        expect(JSON.parse(result)).toEqual({ key: 'value', nested: { a: 1 } });
    });
});

describe('Format Duration', () => {
    test('formats seconds only', () => {
        expect(formatDuration(45)).toBe('45s');
    });

    test('formats minutes and seconds', () => {
        expect(formatDuration(125)).toBe('2m 5s');
    });

    test('formats exact minutes', () => {
        expect(formatDuration(120)).toBe('2m');
    });

    test('formats large duration', () => {
        expect(formatDuration(3661)).toBe('61m 1s');
    });
});
