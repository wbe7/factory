export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface FactoryConfig {
    goal: string | null;
    model: string;
    baseUrl: string | null;
    planningCycles: number;
    verificationCycles: number;
    workerIterations: number;
    timeout: number;
    maxCost: number | null;
    dryRun: boolean;
    mockLlm: boolean;
    verbose: boolean;
    quiet: boolean;
    logFile: string | null;   // null = stdout only (default)
    logLevel: LogLevel;
    planOnly: boolean;        // Phase 2.5: Run planning without execution
    verbosePlanning: boolean; // Phase 2.5: Show full Architect/Critic output
}

// Re-export Zod-inferred types from schemas.ts (single source of truth)
export type { Prd, PrdProject, PrdTask, TaskStatus } from './schemas';

export const DEFAULT_CONFIG: Omit<FactoryConfig, 'goal'> = {
    model: 'opencode/glm-4.7-free',
    baseUrl: null,
    planningCycles: 3,
    verificationCycles: 3,
    workerIterations: 10,
    timeout: 3600,
    maxCost: null,
    dryRun: false,
    mockLlm: false,
    verbose: false,
    quiet: false,
    logFile: null,      // No file logging by default (Docker-friendly)
    logLevel: 'info',
    planOnly: false,
    verbosePlanning: false,
};

