import { describe, test, expect, afterEach } from 'bun:test';
import { atomicWrite, createBackup, extractJson, detectToolCalls, formatDuration } from '../src/utils';
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';

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

describe('Extract JSON (Multi-Strategy)', () => {
    // Strategy 1: ```json block
    test('strategy: json_block — extracts from ```json block', () => {
        const input = 'Some text\n```json\n{"key": "value"}\n```\nMore text';
        const result = extractJson(input);
        expect(result.json).toBe('{"key": "value"}');
        expect(result.strategy).toBe('json_block');
        expect(result.toolCallDetected).toBe(false);
    });

    // Strategy 2: ``` block (any language)
    test('strategy: any_block — extracts from generic code block', () => {
        const input = 'Here is the output:\n```\n{"name": "test"}\n```\nDone.';
        const result = extractJson(input);
        expect(result.json).toBe('{"name": "test"}');
        expect(result.strategy).toBe('any_block');
    });

    // Strategy 3: JSON braces
    test('strategy: json_braces — extracts JSON object from text', () => {
        const input = 'The result is {"project": {"name": "foo"}} and that is all.';
        const result = extractJson(input);
        expect(result.json).toBe('{"project": {"name": "foo"}}');
        expect(result.strategy).toBe('json_braces');
    });

    // Strategy 4: raw text fallback
    test('strategy: raw_text — returns trimmed input when no patterns match', () => {
        const input = '   no json here   ';
        const result = extractJson(input);
        expect(result.json).toBe('no json here');
        expect(result.strategy).toBe('raw_text');
    });

    // Priority: json_block beats any_block
    test('priority: json_block takes precedence over any_block', () => {
        const input = '```json\n{"first": 1}\n```\n```\n{"second": 2}\n```';
        const result = extractJson(input);
        expect(result.json).toBe('{"first": 1}');
        expect(result.strategy).toBe('json_block');
    });

    // Multiline handling
    test('handles multiline JSON in code block', () => {
        const input = '```json\n{\n  "key": "value",\n  "nested": {\n    "a": 1\n  }\n}\n```';
        const result = extractJson(input);
        expect(JSON.parse(result.json)).toEqual({ key: 'value', nested: { a: 1 } });
    });

    // File read fallback (tool call detected + file exists)
    test('strategy: file_read — reads from disk when tool call detected', () => {
        const input = '|  Write prd.json\nDone writing file.';
        const testPrdPath = '/tmp/test-prd-extract.json';

        // Create test file
        writeFileSync(testPrdPath, '{"project": {"name": "from-file"}}');

        const result = extractJson(input, testPrdPath);
        expect(result.strategy).toBe('file_read');
        expect(result.toolCallDetected).toBe(true);
        expect(JSON.parse(result.json)).toEqual({ project: { name: 'from-file' } });

        // Cleanup
        unlinkSync(testPrdPath);
    });

    // Tool call detected but file doesn't exist — fallback to other strategies
    test('tool call detected but no file — falls back to text extraction', () => {
        const input = '|  Write prd.json\n```json\n{"fallback": true}\n```';
        const result = extractJson(input, '/tmp/nonexistent-file.json');
        expect(result.toolCallDetected).toBe(true);
        expect(result.strategy).toBe('json_block');
        expect(result.json).toBe('{"fallback": true}');
    });
});

describe('Detect Tool Calls', () => {
    test('detects "| Write" pattern', () => {
        expect(detectToolCalls('|  Write prd.json')).toBe(true);
    });

    test('detects "| Edit" pattern', () => {
        expect(detectToolCalls('|  Edit prd.json\nUpdating content...')).toBe(true);
    });

    test('detects "Wrote file:" pattern', () => {
        expect(detectToolCalls('Wrote file: prd.json')).toBe(true);
    });

    test('detects "Created file:" pattern', () => {
        expect(detectToolCalls('Created file: /app/prd.json')).toBe(true);
    });

    test('detects "Updated file:" pattern', () => {
        expect(detectToolCalls('Updated file: prd.json with new content')).toBe(true);
    });

    test('returns false for normal JSON output', () => {
        expect(detectToolCalls('```json\n{"key": "value"}\n```')).toBe(false);
    });

    test('returns false for empty string', () => {
        expect(detectToolCalls('')).toBe(false);
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
