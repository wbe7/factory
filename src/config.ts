import type { FactoryConfig, LogLevel } from './types';
import { DEFAULT_CONFIG } from './types';

const VALID_LOG_LEVELS = new Set<LogLevel>(['debug', 'info', 'warn', 'error']);

/**
 * Parse and validate a positive integer from string.
 * @param name - Description of the value (e.g., '--timeout')
 */
function parsePositiveInt(value: string, name: string): number {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error(`Invalid value for ${name}: "${value}". Must be a positive integer.`);
    }
    return parsed;
}

/**
 * Parse and validate a non-negative integer from string.
 * Allows 0 for "skip this phase" semantics.
 * @param name - Description of the value (e.g., '--planning-cycles')
 */
function parseNonNegativeInt(value: string, name: string): number {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`Invalid value for ${name}: "${value}". Must be a non-negative integer.`);
    }
    return parsed;
}

/**
 * Parse and validate a positive float from string.
 * @param name - Description of the value (e.g., '--max-cost' or 'FACTORY_MAX_COST')
 */
function parsePositiveFloat(value: string, name: string): number {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || parsed <= 0) {
        throw new Error(`Invalid value for ${name}: "${value}". Must be a positive number.`);
    }
    return parsed;
}

/**
 * Parse CLI arguments from process.argv.
 * Returns ONLY explicitly provided arguments (Partial) to allow proper layering.
 * Supports --flag=value and --flag value formats.
 */
export function parseArgs(args: string[]): Partial<FactoryConfig> {
    const config: Partial<FactoryConfig> = {};
    const BOOLEAN_FLAGS = new Set(['dry-run', 'mock-llm', 'verbose', 'quiet', 'plan', 'verbose-planning']);

    let i = 0;
    while (i < args.length) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            printHelp();
            process.exit(0);
        }

        if (arg && arg.startsWith('--')) {
            const [key, value] = parseFlag(arg, args[i + 1]);

            switch (key) {
                case 'model':
                    config.model = value;
                    break;
                case 'base-url':
                    config.baseUrl = value;
                    break;
                case 'planning-cycles':
                    config.planningCycles = parseNonNegativeInt(value, '--planning-cycles');
                    break;
                case 'verify-cycles':
                    config.verificationCycles = parseNonNegativeInt(value, '--verify-cycles');
                    break;
                case 'worker-iters':
                    config.workerIterations = parseNonNegativeInt(value, '--worker-iters');
                    break;
                case 'timeout':
                    config.timeout = parsePositiveInt(value, '--timeout');
                    break;
                case 'max-cost':
                    config.maxCost = parsePositiveFloat(value, '--max-cost');
                    break;
                case 'log-file':
                    config.logFile = value;
                    break;
                case 'log-level': {
                    const level = value.toLowerCase() as LogLevel;
                    if (!VALID_LOG_LEVELS.has(level)) {
                        throw new Error(`Invalid --log-level value: "${value}". Must be one of: debug, info, warn, error.`);
                    }
                    config.logLevel = level;
                    break;
                }
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
                case 'plan':
                    config.planOnly = true;
                    break;
                case 'verbose-planning':
                    config.verbosePlanning = true;
                    break;
                case 'force-new':
                    config.forceNew = true;
                    break;
                case 'force-brownfield':
                    config.forceBrownfield = true;
                    break;
            }

            // Skip next arg if it was consumed as value
            if (!arg.includes('=') && value && !BOOLEAN_FLAGS.has(key)) {
                i++;
            }
        } else if (arg && !arg.startsWith('-')) {
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
        const [key = '', ...rest] = arg.slice(2).split('=');
        return [key, rest.join('=')];
    }
    return [arg.slice(2), nextArg || ''];
}

/**
 * Parse environment variables and merge with defaults.
 * Returns ONLY values that are explicitly set in environment.
 */
export function parseEnvConfig(): Partial<FactoryConfig> {
    const env = Bun.env;
    const config: Partial<FactoryConfig> = {};

    if (env.FACTORY_MODEL) config.model = env.FACTORY_MODEL;
    if (env.OPENAI_BASE_URL) config.baseUrl = env.OPENAI_BASE_URL;
    if (env.FACTORY_PLANNING_CYCLES) config.planningCycles = parseInt(env.FACTORY_PLANNING_CYCLES, 10);
    if (env.FACTORY_VERIFICATION_CYCLES) config.verificationCycles = parseInt(env.FACTORY_VERIFICATION_CYCLES, 10);
    if (env.FACTORY_WORKER_ITERATIONS) config.workerIterations = parseInt(env.FACTORY_WORKER_ITERATIONS, 10);
    if (env.FACTORY_TIMEOUT) config.timeout = parseInt(env.FACTORY_TIMEOUT, 10);
    if (env.FACTORY_MAX_COST) config.maxCost = parseFloat(env.FACTORY_MAX_COST);
    if (env.FACTORY_LOG_FILE) config.logFile = env.FACTORY_LOG_FILE;
    if (env.FACTORY_LOG_LEVEL) {
        const level = env.FACTORY_LOG_LEVEL.toLowerCase() as LogLevel;
        if (VALID_LOG_LEVELS.has(level)) {
            config.logLevel = level;
        }
    }

    return config;
}

/**
 * Merge CLI args with env config. Precedence: CLI > Env > Defaults.
 */
export function mergeConfig(cli: Partial<FactoryConfig>, env: Partial<FactoryConfig>): FactoryConfig {
    return {
        ...DEFAULT_CONFIG,
        ...env,
        ...cli,
        goal: cli.goal ?? null,
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
  --model <model>           LLM model (default: opencode/big-pickle)
  --base-url <url>          Custom LLM endpoint (OpenAI-compatible)
  --planning-cycles <n>     Max planning iterations (default: 5, 0=skip)
  --verify-cycles <n>       Max verification iterations (default: 5, 0=skip)
  --worker-iters <n>        Max worker iterations per task (default: 10, 0=skip)
  --timeout <seconds>       Global timeout (default: 0, 0=unlimited)
  --max-cost <usd>          Maximum cost limit in USD
  --log-file <path>         Enable file logging (JSON Lines format)
  --log-level <level>       Log level: debug, info, warn, error (default: info)
  --plan                    Run planning only (no execution phase)
  --verbose-planning        Show full Architect/Critic output (debugging)
  --dry-run                 Output plan without execution
  --mock-llm                Use mock LLM for testing
  --verbose                 Verbose logging
  --quiet                   Minimal output
  -h, --help                Show this help

Examples:
  factory "Create a REST API in Go"
  factory --model gpt-4 --timeout 1800 "Add authentication"
  factory --plan "Create plan only"
  factory --log-level debug "Debug task"
  factory --dry-run "Complex task"

Environment Variables:
  FACTORY_MODEL             Default model
  FACTORY_TIMEOUT           Default timeout
  FACTORY_LOG_FILE          Log file path (enables file logging)
  FACTORY_LOG_LEVEL         Log level (debug, info, warn, error)
  OPENAI_BASE_URL           Custom LLM endpoint
  OPENAI_API_KEY            API key for custom endpoint
`);
}
