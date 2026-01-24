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
        await this.walk(cwd, (entryPath) => {
            files.push(entryPath);
        }, maxFiles);
        return files.join('\n');
    }

    /**
     * Detects test files using common patterns.
     */
    async detectTestFiles(cwd: string): Promise<string[]> {
        // Supports: JS/TS, Go, Python, Java/Kotlin/Scala/C#, PHP, Ruby, Rust, Swift, Dart, Elixir, C/C++
        const testPattern = /((spec|test)\.(ts|js|jsx|tsx|mjs|cjs)$)|(_test\.go$)|(^test_.*\.py$)|((Test|Spec|Tests)\.(java|kt|scala|cs|swift|php)$)|(_(test|spec)\.(rb|rs|exs)$)|(_test\.(dart|c|cpp|h|hpp)$)/i;
        const testFiles: string[] = [];

        await this.walk(cwd, (entryPath) => {
            // Check filename specifically, not full path logic if regex expects file name
            // Our regex checks strict endings or beginnings, so checking basenames is safer/easier usually, 
            // but regex has assertions.
            const basename = path.basename(entryPath);
            if (testPattern.test(basename)) {
                testFiles.push(entryPath);
            }
        }, 1000); // Higher limit for test searching

        return testFiles;
    }

    private async walk(
        dir: string,
        callback: (relativePath: string) => void,
        limit: number,
        relativePath: string = '',
        state: { count: number } = { count: 0 }
    ): Promise<void> {
        if (state.count >= limit) return;

        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            // Sort for deterministic output
            entries.sort((a, b) => a.name.localeCompare(b.name));

            for (const entry of entries) {
                if (state.count >= limit) return;
                if (this.scanIgnore.has(entry.name)) continue;

                const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

                if (entry.isDirectory()) {
                    await this.walk(path.join(dir, entry.name), callback, limit, entryRelativePath, state);
                } else {
                    callback(entryRelativePath);
                    state.count++;
                }
            }
        } catch (e) {
            // Ignore permission errors, but log for debug
            // console.debug('Walk error:', e); 
        }
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
