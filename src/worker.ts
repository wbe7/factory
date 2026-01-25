import type { FactoryConfig } from './types';
import type { Logger } from './logger';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink } from 'fs/promises';

/**
 * Type for opencode runner function (allows mocking in tests)
 */
export type OpencodeRunner = (prompt: string, config: FactoryConfig, cwd?: string) => Promise<string>;

/**
 * Options for workerLoop function
 */
export interface WorkerLoopOptions {
    config: FactoryConfig;
    runner?: OpencodeRunner;
    cwd?: string;
    logger?: Logger;
}

/**
 * Result from workerLoop
 */
export interface WorkerLoopResult {
    completed: boolean;
    iterations: number;
    totalDuration: number;
}

/**
 * Run opencode with the given prompt.
 * Returns the output text.
 * @param cwd - Optional working directory for the opencode process
 */
export async function runOpencode(prompt: string, config: FactoryConfig, cwd?: string, extraEnv: Record<string, string> = {}): Promise<string> {
    const args = ['run'];

    if (config.model) {
        args.push('-m', config.model);
    }

    // Write prompt to temp file (cross-platform)
    const tmpPromptFile = join(tmpdir(), `factory_prompt_${crypto.randomUUID()}.md`);
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
                ...extraEnv,
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
            await unlink(tmpPromptFile);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * Native worker loop that replaces ralph-wiggum.
 * Calls opencode repeatedly until COMPLETE promise is found or max iterations reached.
 */
export async function workerLoop(
    prompt: string,
    options: WorkerLoopOptions
): Promise<WorkerLoopResult> {
    const { config, runner = runOpencode, cwd, logger } = options;
    const loopStart = performance.now();
    let iterations = 0;

    for (let i = 0; i < config.workerIterations; i++) {
        iterations = i + 1;
        const iterStart = performance.now();

        // Log iteration start
        if (logger) {
            logger.debug(`Worker iteration ${iterations}/${config.workerIterations}`, {
                iteration: iterations,
                maxIterations: config.workerIterations,
            });
        } else if (config.verbose) {
            console.log(`   👷 Worker iteration ${iterations}/${config.workerIterations}...`);
        }

        try {
            const output = await runner(prompt, config, cwd);
            const iterDuration = Math.round(performance.now() - iterStart);
            const hasPromise = output.includes('<promise>COMPLETE</promise>');

            // Log iteration end
            if (logger) {
                logger.debug(`Worker iteration ${iterations} completed`, {
                    iteration: iterations,
                    success: true,
                    duration: iterDuration,
                    hasPromise,
                });
            }

            if (hasPromise) {
                if (logger) {
                    logger.info('Worker completed task', {
                        iterations,
                        duration: Math.round(performance.now() - loopStart),
                    });
                } else if (config.verbose) {
                    console.log('   ✅ Worker completed task');
                }
                return {
                    completed: true,
                    iterations,
                    totalDuration: Math.round(performance.now() - loopStart),
                };
            }
        } catch (error) {
            const iterDuration = Math.round(performance.now() - iterStart);

            // Log iteration failure
            if (logger) {
                logger.warn(`Worker iteration ${iterations} failed`, {
                    iteration: iterations,
                    duration: iterDuration,
                    error: error instanceof Error ? error.message : String(error),
                });
            } else if (config.verbose) {
                console.error(`   ❌ Worker iteration ${iterations} failed:`, error);
            }
            // Continue to next iteration
        }
    }

    // Max iterations reached
    const totalDuration = Math.round(performance.now() - loopStart);
    if (logger) {
        logger.warn('Worker max iterations reached without completion', {
            iterations,
            totalDuration,
        });
    }

    return {
        completed: false,
        iterations,
        totalDuration,
    };
}

