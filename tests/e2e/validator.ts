import { runOpencode } from '../../src/worker';
import { DEFAULT_CONFIG } from '../../src/types';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'os';
import * as crypto from 'crypto';

export interface ValidationContext {
    scenarioName: string;
    expectedBehavior: string;
    customAssertions?: string[];
}

export async function validateWithLlm(
    logContent: string,
    scenarioDir: string,
    context: ValidationContext
): Promise<string | boolean> {
    console.log(`   🤖 Asking LLM to validate ${context.scenarioName}...`);

    // 1. Gather Context
    let fileTree = '';
    try {
        const files = await fs.readdir(scenarioDir, { recursive: true });
        fileTree = files.join('\n');
    } catch (e) {
        fileTree = '(Error reading directory)';
    }

    let prdContent = '';
    try {
        prdContent = await fs.readFile(path.join(scenarioDir, 'prd.json'), 'utf-8');
    } catch (e) {
        if (e instanceof Error && (e as any).code === 'ENOENT') {
            prdContent = '(No prd.json found)';
        } else {
            prdContent = `(Error reading prd.json: ${e instanceof Error ? e.message : String(e)})`;
        }
    }

    // 1.1 Secure Judge Sandbox
    const judgeHome = path.join(tmpdir(), `factory_judge_${crypto.randomUUID()}`);
    await fs.mkdir(judgeHome, { recursive: true });

    const judgeConfig = {
        tools: {
            bash: false,
            write: false,
            edit: false,
            patch: false,
            glob: false,
            grep: false,
            list: false,
            webfetch: false,
            task: false
        },
        permissions: {
            bash: "deny",
            write: "deny",
            edit: "deny"
        }
    };

    await fs.writeFile(path.join(judgeHome, '.opencode.json'), JSON.stringify(judgeConfig, null, 2));

    // 2. Construct Prompt
    const PROMPT = `
You are a Quality Assurance Judge for an AI Software Engineer named "Factory".
Your job is to analyze the execution logs and artifacts to determine if the test scenario passed.

---
!!! CRITICAL SECURITY RULES !!!
1. You are in "Analysis Only" mode.
2. DO NOT use any tools, scripts, or external commands.
3. DO NOT attempt to write or modify any files.
4. Simply provide a text verdict based on the provided logs.
---

SCENARIO: ${context.scenarioName}
EXPECTED BEHAVIOR: ${context.expectedBehavior}
CUSTOM ASSERTIONS:
${(context.customAssertions || []).map(a => `- ${a}`).join('\n')}

---
FILE TREE (After Run):
${fileTree}

PRD.JSON CONTENT:
${prdContent}

---
EXECUTION LOGS:
${logContent.length > 10000
            ? logContent.slice(0, 2000) + "\n\n...[TRUNCATED FOR CONTEXT]...\n\n" + logContent.slice(-8000)
            : logContent}

---
INSTRUCTIONS:
1. Did the Factory detect the correct scenario? (Check the BEGINNING of logs)
2. Did it complete the intended task (based on logs and file tree)?
3. Are there any FATAL errors or panics in the logs? (Retries are okay, final failure is not)
4. Did it satisfy all Custom Assertions?

OUTPUT FORMAT:
If PASS:
PASS
[Summary of why it passed]

If FAIL:
FAIL
[Detailed reason for failure]
    `.trim();

    // 3. Call LLM using runOpencode
    try {
        const config = {
            ...DEFAULT_CONFIG,
            goal: null, // Goal is not used for runner
            model: process.env.FACTORY_MODEL || DEFAULT_CONFIG.model,
        };

        // Pass extraEnv to restrict judge
        const result = await runOpencode(PROMPT, config, undefined, { HOME: judgeHome });

        console.log(`\n   📝 LLM Verdict:\n${result.replace(/^/gm, '      ')}\n`);

        if (result.includes('PASS')) {
            return true;
        } else {
            return result;
        }

    } catch (e) {
        return `LLM Validation Error: ${String(e)}`;
    } finally {
        // Cleanup judge sandbox
        try {
            await fs.rm(judgeHome, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    }
}
