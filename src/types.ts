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
}

export interface PrdProject {
    name: string;
    description: string;
    tech_stack: string[];
    test_command: string;
    quality_gate?: {
        lint_command: string | null;
        type_check: string | null;
        security_scan: string | null;
    };
}

export interface PrdTask {
    id: string;
    title: string;
    description: string;
    acceptance_criteria: string[];
    dependencies: string[];
    status: 'pending' | 'implementation' | 'verification' | 'completed' | 'failed';
    passes: boolean;
    metrics?: {
        tokens_used: number;
        estimated_cost_usd: number;
        duration_seconds: number;
    };
}

export interface Prd {
    project: PrdProject;
    user_stories: PrdTask[];
}

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
};
