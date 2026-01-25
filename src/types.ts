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
    forceNew: boolean;        // Phase 3: Force NEW_PROJECT scenario
    forceBrownfield: boolean; // Phase 3: Force BROWNFIELD scenario
}

// Re-export Zod-inferred types from schemas.ts (single source of truth)
export type { Prd, PrdProject, PrdTask, TaskStatus } from './schemas';
export type { ProjectType } from './context';

export const DEFAULT_CONFIG: Omit<FactoryConfig, 'goal'> = {
    model: 'opencode/big-pickle',
    baseUrl: null,
    planningCycles: 30,
    verificationCycles: 30,
    workerIterations: 30,
    timeout: 0,
    maxCost: null,
    dryRun: false,
    mockLlm: false,
    verbose: false,
    quiet: false,
    logFile: null,      // No file logging by default (Docker-friendly)
    logLevel: 'info',
    planOnly: false,
    verbosePlanning: false,
    forceNew: false,
    forceBrownfield: false,
};

