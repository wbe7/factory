
import { $ } from 'bun';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const SANDBOX_ROOT = path.resolve('.sandbox');
const LOGS_DIR = path.join(SANDBOX_ROOT, 'logs');
const TIMEOUT_MS = 30 * 60 * 1000; // Increased to 30 minutes for robustness

export interface ScenarioConfig {
    name: string;
    description: string;
    setup?: (scenarioDir: string) => Promise<void>;
    args: string[]; // Arguments for 'factory'
    validation?: (logContent: string, scenarioDir: string) => Promise<string | boolean>; // Return error string or true
}

// Global cleanup exported to be called once
export async function cleanAllSandboxes() {
    console.log(`🧹 Cleaning sandbox root: ${SANDBOX_ROOT}`);
    await $`rm -rf ${SANDBOX_ROOT}/*`.quiet().nothrow();
}

export class ScenarioRunner {
    private containerName: string;

    constructor(private config: ScenarioConfig) {
        this.containerName = `factory-e2e-${config.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    }

    async run(): Promise<{ success: boolean; logs: string; error?: string }> {
        const scenarioDir = path.join(SANDBOX_ROOT, this.config.name);
        const logFile = path.join(LOGS_DIR, `${this.config.name}.log`);

        console.log(`\n🚀 Starting Scenario: ${this.config.name}`);
        console.log(`   📂 Dir: ${scenarioDir}`);

        // 1. Setup
        await fs.mkdir(scenarioDir, { recursive: true });
        await fs.mkdir(LOGS_DIR, { recursive: true });

        if (this.config.setup) {
            console.log('   🛠️  Running setup...');
            await this.config.setup(scenarioDir);
        }

        // 2. Run Docker Container
        console.log(`   🐳 Running Docker container: ${this.containerName}...`);

        const cmd = [
            'docker', 'run',
            '--name', this.containerName,
            '-v', `${scenarioDir}:/app/target_project`,
            '-v', `${process.env.HOME}/.config/opencode:/root/.config/opencode`,
            '-v', '/var/run/docker.sock:/var/run/docker.sock',
            // Pass minimal env vars needed
            '-e', `OPENAI_API_KEY=${process.env.OPENAI_API_KEY || ''}`,
            '-e', `ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY || ''}`,
            '-e', `GOOGLE_API_KEY=${process.env.GOOGLE_API_KEY || ''}`,
            'wbe7/factory:latest',
            ...this.config.args,
            '--log-level', 'debug'
        ];

        try {
            // Start process and capture logs
            const logWriter = await fs.open(logFile, 'w');
            const proc = Bun.spawn(cmd, {
                stdout: logWriter.fd,
                stderr: logWriter.fd,
            });

            console.log(`   Testing in progress (30m timeout)...`);

            // Timeout logic
            const timeout = setTimeout(() => {
                console.log(`   🚨 TIMEOUT reached! Killing container...`);
                proc.kill();
            }, TIMEOUT_MS);

            await proc.exited;
            clearTimeout(timeout);
            await logWriter.close();

            const logs = await fs.readFile(logFile, 'utf-8');

            if (proc.exitCode !== 0) {
                // Check if it was killed by us (timeout) or crashed
                if (proc.signalCode === 'SIGTERM' || proc.signalCode === 'SIGKILL') {
                    return { success: false, logs, error: 'TIMEOUT exceeded (30m)' };
                }
                // If it failed naturally, we still continue to validation if logs exist
            }

            // 3. Validation
            if (this.config.validation) {
                console.log('   🕵️  Validating results...');
                const validationResult = await this.config.validation(logs, scenarioDir);
                if (validationResult !== true) {
                    return { success: false, logs, error: typeof validationResult === 'string' ? validationResult : 'Validation Failed' };
                }
            }

            return { success: true, logs };

        } catch (e) {
            return { success: false, logs: '', error: String(e) };
        } finally {
            await this.cleanup();
        }
    }

    private async cleanup() {
        await $`docker rm -f ${this.containerName}`.quiet().nothrow();
    }
}
