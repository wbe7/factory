#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "fs";
import { $ } from "bun"; 

const PROJECT_DIR = "target_project";
const PRD_FILE = `${PROJECT_DIR}/prd.json`;
const PROMPTS_DIR = "prompts";
const MODEL = "opencode/glm-4.7-free"; 

// Config
const PLANNING_CYCLES = 3;
const VERIFICATION_CYCLES = 3;
const RALPH_ITERATIONS = 10;

async function runAgent(promptFile: string, contextReplacements: Record<string, string>) {
    let prompt = readFileSync(promptFile, "utf-8");
    for (const [key, value] of Object.entries(contextReplacements)) {
        prompt = prompt.replace(key, value);
    }

    const tmpPromptFile = `/tmp/agent_prompt_${Date.now()}.md`;
    writeFileSync(tmpPromptFile, prompt);

    try {
        console.log(`🤖 Agent (${promptFile})...`);
        const proc = Bun.spawn(["bash", "run_agent.sh", tmpPromptFile, MODEL], {
            stdout: "pipe",
            stderr: "inherit",
        });
        const output = await new Response(proc.stdout).text();
        await proc.exited;
        if (proc.exitCode !== 0) throw new Error("Agent failed");
        return output.trim();
    } catch (e) { throw e; }
}

function extractJson(text: string): string {
    const match = text.match(/```json\n([\s\S]*?)\n```/);
    return match ? match[1] : text;
}

async function main() {
    const goal = process.argv[2];
    console.log(`🏭 AI Factory v3. Goal: "${goal || 'Resume'}"`);

    if (!existsSync(PROJECT_DIR)) {
        await $`mkdir -p ${PROJECT_DIR}`;
        await $`cd ${PROJECT_DIR} && git init`;
    }

    // --- PHASE 1: PLANNING ---
    if (goal) { // Only plan if there is a new goal
        let currentPrd = existsSync(PRD_FILE) ? readFileSync(PRD_FILE, "utf-8") : "{}";
        let mode = existsSync(PRD_FILE) ? "UPDATE_PROJECT" : "NEW_PROJECT";
        
        let planApproved = false;
        let attempt = 0;
        let criticFeedback = "";

        while (!planApproved && attempt < PLANNING_CYCLES) {
            attempt++;
            console.log(`\n📐 Planning Cycle ${attempt}/${PLANNING_CYCLES}`);

            // 1. Architect
            const architectOutput = await runAgent(`${PROMPTS_DIR}/architect.md`, {
                "{{GOAL}}": goal + (criticFeedback ? `\n\nCRITIC FEEDBACK: ${criticFeedback}` : ""),
                "{{CURRENT_PRD}}": currentPrd,
                "{{MODE}}": mode
            });
            
            let jsonDraft = extractJson(architectOutput);
            try {
                JSON.parse(jsonDraft); // Validate
                currentPrd = jsonDraft; // Update working draft
                writeFileSync(PRD_FILE, jsonDraft);
            } catch (e) {
                console.error("❌ Invalid JSON from Architect. Retrying...");
                continue;
            }

            // 2. Critic
            const critique = await runAgent(`${PROMPTS_DIR}/critic.md`, {
                "{{PRD_CONTENT}}": currentPrd
            });

            if (critique.includes("NO_CRITICAL_ISSUES")) {
                console.log("✅ Plan Approved!");
                planApproved = true;
            } else {
                console.log("⚠️ Critic found issues. Refining...");
                criticFeedback = critique;
            }
        }
    }

    // --- PHASE 2: EXECUTION ---
    console.log("\n🔨 Execution Phase");
    
    while (true) {
        if (!existsSync(PRD_FILE)) break;
        const prd = JSON.parse(readFileSync(PRD_FILE, "utf-8"));
        const task = prd.user_stories.find((t: any) => !t.passes);

        if (!task) {
            console.log("🎉 All tasks completed!");
            break;
        }

        console.log(`\n👉 Task #${task.id}: ${task.title}`);
        
        let taskVerified = false;
        let verifyAttempt = 0;
        let verifierFeedback = "";

        while (!taskVerified && verifyAttempt < VERIFICATION_CYCLES) {
            verifyAttempt++;
            
            // 1. Worker (Ralph Loop)
            console.log(`   👷 Worker Loop (Attempt ${verifyAttempt})...`);
            
            // Inject verifier feedback into task description for Ralph if needed
            let taskDesc = task.description;
            if (verifierFeedback) {
                taskDesc += `\n\nFIX REQUEST: ${verifierFeedback}`;
            }

            const workerPromptRaw = readFileSync(`${PROMPTS_DIR}/worker.md`, "utf-8");
            const workerPrompt = workerPromptRaw
                .replace("{{TASK_ID}}", task.id)
                .replace("{{TASK_DESCRIPTION}}", taskDesc)
                .replace("{{TASK_CRITERIA}}", JSON.stringify(task.acceptance_criteria));

            try {
                // Escape single quotes for bash string
                const safePrompt = workerPrompt.replace(/'/g, "'\\''");
                const cmd = `cd ${PROJECT_DIR} && ralph '${safePrompt}' --max-iterations ${RALPH_ITERATIONS} --completion-promise "COMPLETE"`;
                await $`bash -c ${cmd}`;
            } catch (e) {
                console.error("Ralph failed/timed out.");
                // We let Verifier check state anyway, maybe it passed partly? Or retry loop.
            }

            // 2. Verifier
            console.log(`   🕵️ Verifier checking...`);
            const verifyResult = await runAgent(`${PROMPTS_DIR}/verifier.md`, {
                "{{TASK_ID}}": task.id,
                "{{TASK_TITLE}}": task.title,
                "{{TASK_CRITERIA}}": JSON.stringify(task.acceptance_criteria)
            });

            if (verifyResult.includes("VERIFICATION_PASSED")) {
                console.log(`   ✅ Verification Passed!`);
                taskVerified = true;
                task.passes = true;
                writeFileSync(PRD_FILE, JSON.stringify(prd, null, 2));
            } else {
                console.log(`   ❌ Verification Failed.`);
                verifierFeedback = verifyResult;
            }
        }
        
        if (!taskVerified) {
            console.error("⛔ Task failed verification limit. Stopping factory.");
            process.exit(1);
        }
    }
}

main();
