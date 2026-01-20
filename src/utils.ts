import { rename } from 'fs/promises';
import { copyFile } from 'fs/promises';
import { existsSync } from 'fs';

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
 * Extract JSON from markdown code block or raw text.
 */
export function extractJson(text: string): string {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    return match ? match[1] : text;
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
