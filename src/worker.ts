import type { FactoryConfig } from './types';

/**
 * Type for opencode runner function (allows mocking in tests)
 */
export type OpencodeRunner = (prompt: string, config: FactoryConfig, cwd?: string) => Promise<string>;

/**
 * Run opencode with the given prompt.
 * Returns the output text.
 * @param cwd - Optional working directory for the opencode process
 */
export async function runOpencode(prompt: string, config: FactoryConfig, cwd?: string): Promise<string> {
    const args = ['run'];

    if (config.model) {
        args.push('-m', config.model);
    }

    // Write prompt to temp file
    const tmpPromptFile = `/tmp/factory_prompt_${crypto.randomUUID()}.md`;
    await Bun.write(tmpPromptFile, prompt);

    try {
        const proc = Bun.spawn(['opencode', ...args], {
            cwd: cwd, // Pass cwd to spawn instead of using process.chdir
            stdin: Bun.file(tmpPromptFile),
            stdout: 'pipe',
            stderr: 'inherit',
            env: {
                ...process.env,
                ...(config.baseUrl ? { OPENAI_BASE_URL: config.baseUrl } : {}),
            },
        });

        const output = await new Response(proc.stdout).text();
        await proc.exited;

        if (proc.exitCode !== 0) {
            throw new Error(`opencode exited with code ${proc.exitCode}`);
        }

        return output.trim();
    } finally {
        // Cleanup temp file
        try {
            const { unlink } = await import('fs/promises');
            await unlink(tmpPromptFile);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Native worker loop that replaces ralph-wiggum.
 * Calls opencode repeatedly until COMPLETE promise is found or max iterations reached.
 * @param cwd - Optional working directory for opencode execution
 */
export async function workerLoop(
    prompt: string,
    config: FactoryConfig,
    runner: OpencodeRunner = runOpencode as OpencodeRunner,
    cwd?: string
): Promise<boolean> {
    for (let i = 0; i < config.workerIterations; i++) {
        if (config.verbose) {
            console.log(`   👷 Worker iteration ${i + 1}/${config.workerIterations}...`);
        }

        try {
            const output = await runner(prompt, config, cwd);

            if (output.includes('<promise>COMPLETE</promise>')) {
                if (config.verbose) {
                    console.log('   ✅ Worker completed task');
                }
                return true;
            }
        } catch (error) {
            if (config.verbose) {
                console.error(`   ❌ Worker iteration ${i + 1} failed:`, error);
            }
            // Continue to next iteration
        }
    }

    return false; // Max iterations reached without completion
}
