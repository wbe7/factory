import { rename } from 'fs/promises';
import { copyFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';

/**
 * Write file atomically using temp file + rename pattern.
 * Prevents corruption if process is killed mid-write.
 */
export async function atomicWrite(path: string, data: string): Promise<void> {
    const tmpPath = `${path}.tmp`;
    await Bun.write(tmpPath, data);
    await rename(tmpPath, path);
}

/**
 * Create backup of file before modification.
 * Copies file.ext to file.ext.bak
 */
export async function createBackup(path: string): Promise<void> {
    if (existsSync(path)) {
        await copyFile(path, `${path}.bak`);
    }
}

/**
 * Result of JSON extraction with metadata about extraction strategy.
 */
export interface JsonExtractionResult {
    json: string;
    strategy: 'json_block' | 'any_block' | 'json_braces' | 'raw_text' | 'file_read';
    toolCallDetected: boolean;
}

/**
 * Detect if LLM output contains tool call patterns (Write/Edit file).
 * These patterns indicate the LLM wrote to disk instead of returning JSON in text.
 */
export function detectToolCalls(text: string): boolean {
    const patterns = [
        /\|\s+Write\s+/i,           // |  Write prd.json
        /\|\s+Edit\s+/i,            // |  Edit prd.json
        /Wrote file:/i,              // Wrote file: prd.json
        /Created file:/i,            // Created file: prd.json
        /Updated file:/i,            // Updated file: prd.json
    ];
    return patterns.some(p => p.test(text));
}

/**
 * Extract JSON using multiple strategies in order of preference.
 * Returns the first successful extraction with metadata.
 * 
 * Strategies (in priority order):
 * 1. json_block: ```json ... ``` markdown block
 * 2. any_block: ``` ... ``` generic code block
 * 3. json_braces: { ... } JSON object boundaries
 * 4. raw_text: trimmed input as-is
 * 
 * If tool calls are detected AND prdFilePath exists, reads from disk first (file_read).
 */
export function extractJson(text: string, prdFilePath?: string): JsonExtractionResult {
    // 1. Detect tool calls (LLM wrote to disk instead of returning JSON)
    const toolCallDetected = detectToolCalls(text);

    // 2. If tool calls detected AND file exists, read from disk
    if (toolCallDetected && prdFilePath && existsSync(prdFilePath)) {
        const fileContent = readFileSync(prdFilePath, 'utf-8');
        return { json: fileContent, strategy: 'file_read', toolCallDetected };
    }

    // 3. Try extraction strategies in order
    type Strategy = 'json_block' | 'any_block' | 'json_braces';
    const strategies: Array<[RegExp, Strategy]> = [
        [/```json\n([\s\S]*?)\n```/, 'json_block'],     // ```json ... ```
        [/```\n([\s\S]*?)\n```/, 'any_block'],          // ``` ... ``` (any lang)
        [/(\{[\s\S]*\})/, 'json_braces'],               // { ... } (JSON object)
    ];

    for (const [regex, strategy] of strategies) {
        const match = text.match(regex);
        if (match?.[1]) {
            return { json: match[1], strategy, toolCallDetected };
        }
    }

    // 4. Fallback: use raw text as-is
    return { json: text.trim(), strategy: 'raw_text', toolCallDetected };
}

/**
 * Format duration in human-readable format.
 */
export function formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}
