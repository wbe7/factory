#!/usr/bin/env bun
/**
 * Factory - Autonomous AI Software Engineering System
 * Main entry point
 */
import { existsSync, readFileSync } from 'fs';
import { $ } from 'bun';

import { parseArgs, parseEnvConfig, mergeConfig, printHelp } from './src/config';
import { workerLoop, runOpencode } from './src/worker';
import { atomicWrite, createBackup, extractJson } from './src/utils';
import type { FactoryConfig, Prd, PrdTask } from './src/types';

// Constants
const PROJECT_DIR = 'target_project';
const PRD_FILE = `${PROJECT_DIR}/prd.json`;
const PROMPTS_DIR = 'prompts';

// Global state for graceful shutdown
let shuttingDown = false;
let currentPrd: Prd | null = null;

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(config: FactoryConfig): void {
    const shutdown = async () => {
        if (shuttingDown) return;
        shuttingDown = true;

        console.log('\n🛑 Graceful shutdown...');

        if (currentPrd) {
            try {
                await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));
                console.log('💾 State saved to prd.json');
            } catch (error) {
                console.error('❌ Failed to save state:', error);
            }
        }

        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

/**
 * Setup global timeout
 */
function setupTimeout(config: FactoryConfig): void {
    if (config.timeout > 0) {
        setTimeout(() => {
            console.error('⏰ Global timeout reached!');
            process.exit(1);
        }, config.timeout * 1000);
    }
}

/**
 * Run an agent with the given prompt file and context replacements
 */
async function runAgent(
    promptFile: string,
    contextReplacements: Record<string, string>,
    config: FactoryConfig
): Promise<string> {
    let prompt = readFileSync(promptFile, 'utf-8');

    for (const [key, value] of Object.entries(contextReplacements)) {
        prompt = prompt.replace(key, value);
    }

    if (config.verbose) {
        console.log(`🤖 Running agent: ${promptFile}`);
    }

    if (config.mockLlm) {
        // Return mock response for testing
        return 'MOCK_RESPONSE';
    }

    return await runOpencode(prompt, config);
}

/**
 * Main factory execution
 */
async function main(): Promise<void> {
    // Parse configuration
    const cliConfig = parseArgs(process.argv.slice(2));
    const envConfig = parseEnvConfig();
    const config = mergeConfig(cliConfig, envConfig);

    if (!config.quiet) {
        console.log(`🏭 Factory. Goal: "${config.goal || 'Resume'}"`);
        if (config.verbose) {
            console.log(`   Model: ${config.model}`);
            if (config.baseUrl) console.log(`   Base URL: ${config.baseUrl}`);
            console.log(`   Timeout: ${config.timeout}s`);
        }
    }

    // Setup handlers
    setupSignalHandlers(config);
    setupTimeout(config);

    // Ensure project directory exists
    if (!existsSync(PROJECT_DIR)) {
        await $`mkdir -p ${PROJECT_DIR}`;
        await $`cd ${PROJECT_DIR} && git init`;
    }

    // --- DRY RUN MODE ---
    if (config.dryRun) {
        console.log('🔍 Dry run mode - would execute with:', {
            model: config.model,
            goal: config.goal,
            planningCycles: config.planningCycles,
            verificationCycles: config.verificationCycles,
        });
        process.exit(0);
    }

    // --- PHASE 1: PLANNING ---
    if (config.goal) {
        let prdContent = existsSync(PRD_FILE) ? readFileSync(PRD_FILE, 'utf-8') : '{}';
        const mode = existsSync(PRD_FILE) ? 'UPDATE_PROJECT' : 'NEW_PROJECT';

        let planApproved = false;
        let attempt = 0;
        let criticFeedback = '';

        while (!planApproved && attempt < config.planningCycles) {
            attempt++;
            if (!config.quiet) {
                console.log(`\n📐 Planning Cycle ${attempt}/${config.planningCycles}`);
            }

            // 1. Architect
            const architectOutput = await runAgent(`${PROMPTS_DIR}/architect.md`, {
                '{{GOAL}}': config.goal + (criticFeedback ? `\n\nCRITIC FEEDBACK: ${criticFeedback}` : ''),
                '{{CURRENT_PRD}}': prdContent,
                '{{MODE}}': mode,
            }, config);

            const jsonDraft = extractJson(architectOutput);
            try {
                JSON.parse(jsonDraft); // Validate
                prdContent = jsonDraft;
                await createBackup(PRD_FILE);
                await atomicWrite(PRD_FILE, jsonDraft);
                currentPrd = JSON.parse(jsonDraft) as Prd; // Update for graceful shutdown
            } catch (e) {
                console.error('❌ Invalid JSON from Architect. Retrying...');
                if (config.verbose && e instanceof Error) {
                    console.error(`   Parse Error: ${e.message}`);
                }
                continue;
            }

            // 2. Critic
            const critique = await runAgent(`${PROMPTS_DIR}/critic.md`, {
                '{{PRD_CONTENT}}': prdContent,
            }, config);

            if (critique.includes('NO_CRITICAL_ISSUES')) {
                if (!config.quiet) console.log('✅ Plan Approved!');
                planApproved = true;
            } else {
                if (!config.quiet) console.log('⚠️ Critic found issues. Refining...');
                criticFeedback = critique;
            }
        }

        if (!planApproved) {
            console.error('⛔ Failed to approve plan after maximum cycles');
            process.exit(1);
        }
    }

    // --- PHASE 2: EXECUTION ---
    if (!config.quiet) console.log('\n🔨 Execution Phase');

    while (true) {
        if (!existsSync(PRD_FILE)) break;

        currentPrd = JSON.parse(readFileSync(PRD_FILE, 'utf-8')) as Prd;
        const task = currentPrd.user_stories.find((t: PrdTask) => !t.passes);

        if (!task) {
            if (!config.quiet) console.log('🎉 All tasks completed!');
            break;
        }

        if (!config.quiet) console.log(`\n👉 Task #${task.id}: ${task.title}`);

        let taskVerified = false;
        let verifyAttempt = 0;
        let verifierFeedback = '';

        while (!taskVerified && verifyAttempt < config.verificationCycles) {
            verifyAttempt++;

            // 1. Worker Loop (Native - replaces Ralph)
            if (!config.quiet) console.log(`   👷 Worker Loop (Attempt ${verifyAttempt})...`);

            let taskDesc = task.description;
            if (verifierFeedback) {
                taskDesc += `\n\nFIX REQUEST: ${verifierFeedback}`;
            }

            const workerPromptRaw = readFileSync(`${PROMPTS_DIR}/worker.md`, 'utf-8');
            const workerPrompt = workerPromptRaw
                .replace('{{TASK_ID}}', task.id)
                .replace('{{TASK_DESCRIPTION}}', taskDesc)
                .replace('{{TASK_CRITERIA}}', JSON.stringify(task.acceptance_criteria));

            // Run worker in the project directory without changing the global CWD
            const completed = await workerLoop(workerPrompt, config, runOpencode, PROJECT_DIR);
            if (!completed && config.verbose) {
                console.log('   ⚠️ Worker did not complete task within iterations');
            }

            // 2. Verifier
            if (!config.quiet) console.log('   🕵️ Verifier checking...');
            const verifyResult = await runAgent(`${PROMPTS_DIR}/verifier.md`, {
                '{{TASK_ID}}': task.id,
                '{{TASK_TITLE}}': task.title,
                '{{TASK_CRITERIA}}': JSON.stringify(task.acceptance_criteria),
            }, config);

            if (verifyResult.includes('VERIFICATION_PASSED')) {
                if (!config.quiet) console.log('   ✅ Verification Passed!');
                taskVerified = true;
                task.passes = true;
                task.status = 'completed';

                await createBackup(PRD_FILE);
                await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));
            } else {
                if (!config.quiet) console.log('   ❌ Verification Failed.');
                verifierFeedback = verifyResult;
            }
        }

        if (!taskVerified) {
            task.status = 'failed';
            await atomicWrite(PRD_FILE, JSON.stringify(currentPrd, null, 2));
            console.error('⛔ Task failed verification limit. Stopping factory.');
            process.exit(1);
        }
    }
}

// Run
main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
});
