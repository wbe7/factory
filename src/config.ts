import type { FactoryConfig } from './types';
import { DEFAULT_CONFIG } from './types';

/**
 * Parse CLI arguments from process.argv.
 * Supports --flag=value and --flag value formats.
 */
export function parseArgs(args: string[]): FactoryConfig {
    const config: FactoryConfig = {
        goal: null,
        ...DEFAULT_CONFIG,
    };

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }

        if (arg.startsWith('--')) {
            const [key, value] = parseFlag(arg, args[i + 1]);

            switch (key) {
                case 'model':
                    config.model = value;
                    break;
                case 'base-url':
                    config.baseUrl = value;
                    break;
                case 'planning-cycles':
                    config.planningCycles = parseInt(value, 10);
                    break;
                case 'verify-cycles':
                    config.verificationCycles = parseInt(value, 10);
                    break;
                case 'worker-iters':
                    config.workerIterations = parseInt(value, 10);
                    break;
                case 'timeout':
                    config.timeout = parseInt(value, 10);
                    break;
                case 'max-cost':
                    config.maxCost = parseFloat(value);
                    break;
                case 'dry-run':
                    config.dryRun = true;
                    break;
                case 'mock-llm':
                    config.mockLlm = true;
                    break;
                case 'verbose':
                    config.verbose = true;
                    break;
                case 'quiet':
                    config.quiet = true;
                    break;
            }

            // Skip next arg if it was consumed as value
            if (!arg.includes('=') && value && !['dry-run', 'mock-llm', 'verbose', 'quiet'].includes(key)) {
                i++;
            }
        } else if (!arg.startsWith('-')) {
            // Positional argument = goal
            config.goal = arg;
        }

        i++;
    }

    return config;
}

/**
 * Parse a flag like --key=value or --key value
 */
function parseFlag(arg: string, nextArg?: string): [string, string] {
    if (arg.includes('=')) {
        const [key, ...rest] = arg.slice(2).split('=');
        return [key, rest.join('=')];
    }
    return [arg.slice(2), nextArg || ''];
}

/**
 * Parse environment variables and merge with defaults.
 */
export function parseEnvConfig(): Partial<FactoryConfig> {
    const env = Bun.env;

    return {
        model: env.FACTORY_MODEL || DEFAULT_CONFIG.model,
        baseUrl: env.OPENAI_BASE_URL || null,
        planningCycles: env.FACTORY_PLANNING_CYCLES
            ? parseInt(env.FACTORY_PLANNING_CYCLES, 10)
            : DEFAULT_CONFIG.planningCycles,
        verificationCycles: env.FACTORY_VERIFICATION_CYCLES
            ? parseInt(env.FACTORY_VERIFICATION_CYCLES, 10)
            : DEFAULT_CONFIG.verificationCycles,
        workerIterations: env.FACTORY_WORKER_ITERATIONS
            ? parseInt(env.FACTORY_WORKER_ITERATIONS, 10)
            : DEFAULT_CONFIG.workerIterations,
        timeout: env.FACTORY_TIMEOUT
            ? parseInt(env.FACTORY_TIMEOUT, 10)
            : DEFAULT_CONFIG.timeout,
        maxCost: env.FACTORY_MAX_COST
            ? parseFloat(env.FACTORY_MAX_COST)
            : null,
    };
}

/**
 * Merge CLI args with env config. CLI takes precedence.
 */
export function mergeConfig(cli: FactoryConfig, env: Partial<FactoryConfig>): FactoryConfig {
    return {
        ...DEFAULT_CONFIG,
        ...env,
        ...cli,
        // Ensure goal from CLI is preserved
        goal: cli.goal,
    };
}

/**
 * Print help message and exit.
 */
export function printHelp(): void {
    console.log(`
🏭 Factory - Autonomous AI Software Engineering System

Usage: factory [options] "<goal>"

Options:
  --model <model>           LLM model (default: opencode/glm-4.7-free)
  --base-url <url>          Custom LLM endpoint (OpenAI-compatible)
  --planning-cycles <n>     Max planning iterations (default: 3)
  --verify-cycles <n>       Max verification iterations (default: 3)
  --worker-iters <n>        Max worker iterations per task (default: 10)
  --timeout <seconds>       Global timeout (default: 3600)
  --max-cost <usd>          Maximum cost limit in USD
  --dry-run                 Output plan without execution
  --mock-llm                Use mock LLM for testing
  --verbose                 Verbose logging
  --quiet                   Minimal output
  -h, --help                Show this help

Examples:
  factory "Create a REST API in Go"
  factory --model gpt-4 --timeout 1800 "Add authentication"
  factory --dry-run "Complex task"

Environment Variables:
  FACTORY_MODEL             Default model
  FACTORY_TIMEOUT           Default timeout
  OPENAI_BASE_URL           Custom LLM endpoint
  OPENAI_API_KEY            API key for custom endpoint
`);
}
