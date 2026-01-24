#!/usr/bin/env bun
/**
 * Factory - Autonomous AI Software Engineering System
 * Main entry point
 */
import { existsSync, readFileSync, readdirSync } from 'fs';
import { $ } from 'bun';

import { parseArgs, parseEnvConfig, mergeConfig } from './src/config';
import { workerLoop, runOpencode } from './src/worker';
import { atomicWrite, createBackup, extractJson } from './src/utils';
import { createLogger, Logger } from './src/logger';
import { parsePrdWithErrors, formatPrdErrors } from './src/schemas';
import type { FactoryConfig, Prd, PrdTask } from './src/types';

// Constants
const PROJECT_DIR = 'target_project';
const PRD_FILE = `${PROJECT_DIR}/prd.json`;
const PROMPTS_DIR = 'prompts';

// Global state for graceful shutdown
let shuttingDown = false;
let currentPrd: Prd | null = null;
let globalLogger: Logger | null = null;

// Scenario detection
type Scenario = 'NEW_PROJECT' | 'UPDATE_PROJECT' | 'BROWNFIELD' | 'RESUME';

function detectScenario(hasGoal: boolean, hasPrdFile: boolean, hasProjectFiles: boolean): Scenario {
    if (!hasGoal && hasPrdFile) return 'RESUME';
    if (hasPrdFile) return 'UPDATE_PROJECT';
    if (hasProjectFiles) return 'BROWNFIELD';
    return 'NEW_PROJECT';
}

/**
 * Gracefully shut down the factory, saving state.
 * @param exitCode The exit code to use.
 */
async function shutdown(exitCode = 0): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;

    if (globalLogger) {
        globalLogger.info('Graceful shutdown initiated');
    } else {
        console.log('\n🛑 Graceful shutdown...');
    }

    if (currentPrd) {
        try {
            await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));
            if (globalLogger) {
                globalLogger.info('State saved to prd.json');
            } else {
                console.log('💾 State saved to prd.json');
            }
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            if (globalLogger) {
                globalLogger.error('Failed to save state', { error: msg });
            } else {
                console.error('❌ Failed to save state:', error);
            }
            process.exit(1);
        }
    }

    if (globalLogger) {
        await globalLogger.close();
    }
    process.exit(exitCode);
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
    process.on('SIGINT', () => shutdown(0));
    process.on('SIGTERM', () => shutdown(0));
}

/**
 * Setup global timeout
 */
function setupTimeout(config: FactoryConfig, logger: Logger): void {
    if (config.timeout > 0) {
        setTimeout(() => {
            logger.error('Global timeout reached!');
            shutdown(1);
        }, config.timeout * 1000);
    }
}

/**
 * Run an agent with the given prompt file and context replacements
 * @param cwd - Working directory for the agent (should be PROJECT_DIR)
 */
async function runAgent(
    promptFile: string,
    contextReplacements: Record<string, string>,
    config: FactoryConfig,
    logger: Logger,
    cwd?: string
): Promise<string> {
    let prompt = readFileSync(promptFile, 'utf-8');

    for (const [key, value] of Object.entries(contextReplacements)) {
        prompt = prompt.replaceAll(key, value);
    }

    logger.debug(`Running agent: ${promptFile}`, { cwd });

    if (config.mockLlm) {
        // Return mock response for testing
        return 'MOCK_RESPONSE';
    }

    return await runOpencode(prompt, config, cwd);
}

/**
 * Main factory execution
 */
async function main(): Promise<void> {
    // Parse configuration
    const cliConfig = parseArgs(process.argv.slice(2));
    const envConfig = parseEnvConfig();
    const config = mergeConfig(cliConfig, envConfig);

    // Initialize logger
    const logger = createLogger(config);
    globalLogger = logger;

    logger.info(`Factory started`, { goal: config.goal || 'Resume', model: config.model });
    if (config.logFile) {
        logger.debug(`File logging enabled`, { logFile: config.logFile });
    }

    // Setup handlers
    setupSignalHandlers();
    setupTimeout(config, logger);

    // Ensure project directory exists
    if (!existsSync(PROJECT_DIR)) {
        logger.debug('Creating project directory');
        await $`mkdir -p ${PROJECT_DIR}`;
        await $`cd ${PROJECT_DIR} && git init`;
    }

    // Detect and log scenario early (also needed for dry-run output)
    const hasPrdFile = existsSync(PRD_FILE);
    const hasProjectFiles = existsSync(PROJECT_DIR) &&
        readdirSync(PROJECT_DIR).filter(f => !f.startsWith('.')).length > 0;
    const scenario = detectScenario(!!config.goal, hasPrdFile, hasProjectFiles);

    logger.info(`🎯 Detected scenario: ${scenario}`, {
        goal: config.goal || 'Resume',
        hasPrdFile,
        hasProjectFiles,
    });

    // Warn if common API keys are missing, BUT only if no config file exists
    // (User might have configured providers in ~/.config/opencode/config.json)
    const hasConfig = existsSync(`${Bun.env.HOME}/.config/opencode/config.json`) ||
        existsSync('/root/.config/opencode/config.json');

    // Also skip warning if using a typically free model
    const isFreeModel = config.model.includes('free') || config.model.includes('local') || config.model.includes('pickle');

    if (!hasConfig && !isFreeModel && !Bun.env.GOOGLE_API_KEY && !Bun.env.OPENAI_API_KEY && !Bun.env.ANTHROPIC_API_KEY && !Bun.env.OPENROUTER_API_KEY) {
        logger.warn('⚠️ No API keys found (GOOGLE_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY)');
        logger.warn('   LLM calls may fail. See README for configuration.');
    }

    // --- DRY RUN MODE ---
    if (config.dryRun) {
        logger.info('Dry run mode - would execute with:', {
            model: config.model,
            goal: config.goal,
            scenario,
            planningCycles: config.planningCycles,
            verificationCycles: config.verificationCycles,
        });
        await shutdown(0);
    }

    // --- PHASE 1: PLANNING ---
    if (config.goal) {
        const planningTimer = logger.timer('Planning phase');
        let prdContent = existsSync(PRD_FILE) ? readFileSync(PRD_FILE, 'utf-8') : '{}';
        const mode = existsSync(PRD_FILE) ? 'UPDATE_PROJECT' : 'NEW_PROJECT';

        let planApproved = false;
        let attempt = 0;
        let criticFeedback = '';

        while (!planApproved && attempt < config.planningCycles) {
            attempt++;
            logger.info(`📐 Planning Cycle ${attempt}/${config.planningCycles}`);

            // 1. Architect
            const architectTimer = logger.timer('Architect agent');
            logger.info('   🏗️  Architect: analyzing goal...');

            const architectOutput = await runAgent(`${PROMPTS_DIR}/architect.md`, {
                '{{GOAL}}': config.goal + (criticFeedback ? `\n\nCRITIC FEEDBACK: ${criticFeedback}` : ''),
                '{{CURRENT_PRD}}': prdContent,
                '{{MODE}}': mode,
            }, config, logger, PROJECT_DIR);

            const architectDuration = architectTimer();

            // Use enhanced extractJson with file fallback
            const extractionResult = extractJson(architectOutput, PRD_FILE);

            // Log extraction details at INFO level (not DEBUG)
            logger.info('   🏗️  Architect output analysis', {
                strategy: extractionResult.strategy,
                toolCallDetected: extractionResult.toolCallDetected,
                outputPreview: architectOutput.slice(0, 300),
            });

            // Use Zod validation with detailed error reporting
            const [validatedPrd, validationErrors] = parsePrdWithErrors(extractionResult.json);
            if (!validatedPrd) {
                logger.error('Invalid JSON from Architect. Retrying...', {
                    duration: architectDuration,
                    strategy: extractionResult.strategy,
                    toolCallDetected: extractionResult.toolCallDetected,
                    errors: validationErrors.slice(0, 5),
                    rawPreview: extractionResult.json.slice(0, 200),
                });
                continue;
            }

            logger.info(`   🏗️  Architect: generated prd.json`, { duration: architectDuration });

            // Verbose planning output
            if (config.verbosePlanning) {
                logger.info('📝 Architect raw output:', { output: architectOutput });
            }

            prdContent = extractionResult.json;
            await createBackup(PRD_FILE);
            await atomicWrite(PRD_FILE, prdContent);
            currentPrd = validatedPrd;

            // 2. Critic
            const criticTimer = logger.timer('Critic agent');
            logger.info('   🔍 Critic: validating plan...');

            const critique = await runAgent(`${PROMPTS_DIR}/critic.md`, {
                '{{PRD_CONTENT}}': prdContent,
            }, config, logger, PROJECT_DIR);

            const criticDuration = criticTimer();

            // Verbose planning output
            if (config.verbosePlanning) {
                logger.info('📝 Critic raw output:', { output: critique });
            }

            if (critique.includes('NO_CRITICAL_ISSUES')) {
                logger.info('✅ Plan Approved!', { duration: criticDuration });
                planApproved = true;
            } else {
                const issueCount = (critique.match(/\d+\.\s+/g) || []).length || 'some';
                logger.info(`   🔍 Critic: found ${issueCount} issues. Refining...`, {
                    duration: criticDuration
                });
                criticFeedback = critique;
            }
        }

        planningTimer();

        if (!planApproved) {
            logger.error('Failed to approve plan after maximum cycles');
            await shutdown(1);
        }

        // Planning-only mode exit
        if (config.planOnly) {
            logger.info('📋 Planning-only mode: prd.json created. Skipping execution.');
            logger.info('   Run "factory" without --plan to execute tasks.');
            await shutdown(0);
        }
    }

    // --- PHASE 2: EXECUTION ---
    logger.info('🔨 Execution Phase');

    while (true) {
        if (!existsSync(PRD_FILE)) break;

        const prdContent = readFileSync(PRD_FILE, 'utf-8');
        const [validatedPrd, prdErrors] = parsePrdWithErrors(prdContent);

        if (!validatedPrd) {
            logger.error('Invalid prd.json format', { errors: prdErrors });
            await shutdown(1);
            return;
        }

        currentPrd = validatedPrd;

        // Select first pending task whose dependencies are all completed
        const completedTaskIds = new Set(
            currentPrd.user_stories.filter(t => t.passes).map(t => t.id)
        );
        const task = currentPrd.user_stories.find(
            (t: PrdTask) =>
                !t.passes && t.dependencies.every(depId => completedTaskIds.has(depId))
        );

        if (!task) {
            logger.info('🎉 All tasks completed!');
            break;
        }

        logger.info(`👉 Task #${task.id}: ${task.title}`);

        // Set task status to implementation
        task.status = 'implementation';
        await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));

        let taskVerified = false;
        let verifyAttempt = 0;
        let verifierFeedback = '';

        while (!taskVerified && verifyAttempt < config.verificationCycles) {
            verifyAttempt++;

            // 1. Worker Loop
            logger.info(`   👷 Worker Loop (Attempt ${verifyAttempt}/${config.verificationCycles})...`);

            let taskDesc = task.description;
            if (verifierFeedback) {
                taskDesc += `\n\nFIX REQUEST: ${verifierFeedback}`;
            }

            const workerPromptRaw = readFileSync(`${PROMPTS_DIR}/worker.md`, 'utf-8');
            const workerPrompt = workerPromptRaw
                .replace('{{TASK_ID}}', task.id)
                .replace('{{TASK_DESCRIPTION}}', taskDesc)
                .replace('{{TASK_CRITERIA}}', JSON.stringify(task.acceptance_criteria));

            // Run worker with new signature
            const workerResult = await workerLoop(workerPrompt, {
                config,
                runner: runOpencode,
                cwd: PROJECT_DIR,
                logger,
            });

            if (!workerResult.completed) {
                logger.warn('Worker did not complete task within iterations', {
                    iterations: workerResult.iterations,
                    duration: workerResult.totalDuration,
                });
            }

            // 2. Verifier
            task.status = 'verification';
            await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));

            logger.info('   🕵️ Verifier checking...');
            const verifyTimer = logger.timer('Verifier agent');

            const verifyResult = await runAgent(`${PROMPTS_DIR}/verifier.md`, {
                '{{TASK_ID}}': task.id,
                '{{TASK_TITLE}}': task.title,
                '{{TASK_CRITERIA}}': JSON.stringify(task.acceptance_criteria),
            }, config, logger, PROJECT_DIR);

            const verifyDuration = verifyTimer();

            if (verifyResult.includes('VERIFICATION_PASSED')) {
                logger.info('   ✅ Verification Passed!', { duration: verifyDuration });
                taskVerified = true;
                task.passes = true;
                task.status = 'completed';

                await createBackup(PRD_FILE);
                await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));
            } else {
                logger.warn('   ❌ Verification Failed.', { duration: verifyDuration });
                verifierFeedback = verifyResult;
            }
        }

        if (!taskVerified) {
            task.status = 'failed';
            await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));
            logger.error('Task failed verification limit. Stopping factory.', { taskId: task.id });
            await shutdown(1);
        }
    }

    await logger.close();
}

// Run
main().catch(async (error) => {
    const msg = error instanceof Error ? error.message : String(error);
    if (globalLogger) {
        globalLogger.error('Fatal error', { error: msg });
        await globalLogger.close();
    } else {
        console.error('💥 Fatal error:', error);
    }
    await shutdown(1);
});

