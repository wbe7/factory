import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export type ProjectType = 'NEW_PROJECT' | 'UPDATE_PROJECT' | 'BROWNFIELD' | 'RESUME';

export class ProjectContext {
    private scanIgnore = new Set([
        'node_modules', '.git', '.DS_Store', 'dist', 'build', 'out', 'vendor',
        '.idea', '.vscode', 'coverage', '.next', '.nuxt', 'target' // Rust target
    ]);

    /**
     * Scans the file tree up to maxFiles, ignoring common junk folders.
     * Returns a sorted list of relative paths.
     */
    async scanFileTree(cwd: string, maxFiles: number = 100): Promise<string> {
        const files: string[] = [];

        // Manual recursive walk to prune directories early
        const walk = async (dir: string, relativePath: string) => {
            if (files.length >= maxFiles) return;

            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });

                // Sort for deterministic output
                entries.sort((a, b) => a.name.localeCompare(b.name));

                for (const entry of entries) {
                    if (files.length >= maxFiles) return;
                    if (this.scanIgnore.has(entry.name)) continue;

                    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

                    if (entry.isDirectory()) {
                        await walk(path.join(dir, entry.name), entryRelativePath);
                    } else {
                        files.push(entryRelativePath);
                    }
                }
            } catch (err) {
                // Ignore permission errors etc
            }
        };

        await walk(cwd, '');
        return files.join('\n');
    }

    /**
     * Detects test files using common patterns.
     */
    async detectTestFiles(cwd: string): Promise<string[]> {
        // Supports: JS/TS, Go, Python, Java/Kotlin/Scala/C#, PHP, Ruby, Rust, Swift, Dart, Elixir, C/C++
        const testPattern = /((spec|test)\.(ts|js|jsx|tsx|mjs|cjs)$)|(_test\.go$)|(^test_.*\.py$)|((Test|Spec|Tests)\.(java|kt|scala|cs|swift|php)$)|(_(test|spec)\.(rb|rs|exs)$)|(_test\.(dart|c|cpp|h|hpp)$)/i;
        const testFiles: string[] = [];

        // Use scanFileTree logic but maybe with a higher limit? 
        // Or just reuse the logic without the file content overhead.
        // We'll reuse the walk logic but specialized for searching.
        // Actually, detectTestFiles should probably search deeper than scanFileTree for context.
        // But for now let's keep it simple and reuse a similar walker.

        // We will scan up to 1000 files for tests to be safe
        const searchLimit = 1000;
        let scanned = 0;

        const walkTests = async (dir: string, relativePath: string) => {
            if (scanned >= searchLimit) return;

            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                for (const entry of entries) {
                    if (scanned >= searchLimit) break;
                    if (this.scanIgnore.has(entry.name)) continue;

                    const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

                    if (entry.isDirectory()) {
                        await walkTests(path.join(dir, entry.name), entryRelativePath);
                    } else if (testPattern.test(entry.name)) {
                        testFiles.push(entryRelativePath);
                    }
                    scanned++;
                }
            } catch (e) { }
        };

        await walkTests(cwd, '');
        return testFiles;
    }

    /**
     * robustly detects the project state/scenario.
     */
    async detectProjectType(cwd: string): Promise<ProjectType> {
        // 1. Check for prd.json (UPDATE or RESUME)
        // Actually the Factory logic distinguishes RESUME vs UPDATE based on prd.json content (pending tasks).
        // Here we just return UPDATE_PROJECT if prd.json exists, Factory handles the RESUME splitting?
        // Looking at the walkthrough/docs:
        // "RESUME: prd.json with pending tasks"
        // "UPDATE_PROJECT: Existing prd.json with completed tasks" -> Architect appends new tasks
        // "NEW_PROJECT: Empty dir"
        // "BROWNFIELD: Files exist, no prd.json"

        // However, existing factory logic might be relying on this detection. 
        // Wait, the previous detection was in factory.ts and simple. 
        // The requirement says: "return NEW, BROWNFIELD, etc."
        // Let's implement basic checking.

        const hasPrd = await this.exists(path.join(cwd, 'prd.json'));
        if (hasPrd) return 'UPDATE_PROJECT'; // Caller handles RESUME check by reading the file

        // Check if directory is effectively empty
        const entries = await fs.readdir(cwd);
        const significantFiles = entries.filter(f =>
            !f.startsWith('.') && // ignore hidden files
            !['README.md', 'LICENSE', 'node_modules'].includes(f) // ignore docs/scaffolding
        );

        if (significantFiles.length === 0) {
            return 'NEW_PROJECT';
        }

        return 'BROWNFIELD';
    }

    private async exists(filePath: string): Promise<boolean> {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
}
