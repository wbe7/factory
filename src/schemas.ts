/**
 * Zod schemas for LLM response validation.
 * Provides type-safe parsing of prd.json and agent responses.
 */
import { z, type ZodIssue } from 'zod';

// Task status enum with fallback
const StatusValues = ['pending', 'implementation', 'verification', 'completed', 'failed'] as const;
export const TaskStatusSchema = z.enum(StatusValues).catch('pending');

// PRD Project schema
export const PrdProjectSchema = z.object({
    name: z.string(),
    description: z.string(),
    tech_stack: z.array(z.string()),
    test_command: z.string(),
    quality_gate: z.object({
        lint_command: z.string().nullable().optional(),
        type_check: z.string().nullable().optional(),
        security_scan: z.string().nullable().optional(),
    }).optional(),
});

// Task metrics schema
export const TaskMetricsSchema = z.object({
    tokens_used: z.number(),
    estimated_cost_usd: z.number(),
    duration_seconds: z.number(),
});

// PRD Task schema - with defaults for common LLM mistakes
export const PrdTaskSchema = z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    acceptance_criteria: z.array(z.string()).default([]),
    dependencies: z.array(z.string()).default([]),
    status: TaskStatusSchema.default('pending'),
    passes: z.boolean().default(false),
    metrics: TaskMetricsSchema.optional(),
});

// Full PRD schema
export const PrdSchema = z.object({
    project: PrdProjectSchema,
    user_stories: z.array(PrdTaskSchema),
});

// Inferred types from schemas
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type PrdProject = z.infer<typeof PrdProjectSchema>;
export type PrdTask = z.infer<typeof PrdTaskSchema>;
export type Prd = z.infer<typeof PrdSchema>;

// Type for safeParse result
export type SafeParseResult = ReturnType<typeof PrdSchema.safeParse>;

/**
 * Parse JSON string to validated PRD object.
 * Returns null if parsing or validation fails.
 */
export function parsePrd(json: string): Prd | null {
    try {
        const data = JSON.parse(json);
        const result = PrdSchema.safeParse(data);
        if (result.success) {
            return result.data;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Parse JSON string with detailed error reporting.
 * Returns [Prd, null] on success, [null, errors] on failure.
 */
export function parsePrdWithErrors(json: string): [Prd | null, string[]] {
    try {
        const data = JSON.parse(json);
        const result = PrdSchema.safeParse(data);
        if (result.success) {
            return [result.data, []];
        }
        const errors = formatPrdErrors(result);
        return [null, errors];
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return [null, [`JSON parse error: ${msg}`]];
    }
}

/**
 * Validate unknown data against PRD schema.
 * Returns SafeParseResult with success/error info.
 */
export function validatePrd(data: unknown): SafeParseResult {
    return PrdSchema.safeParse(data);
}

/**
 * Get human-readable validation errors.
 */
export function formatPrdErrors(result: SafeParseResult): string[] {
    if (result.success) return [];
    return result.error.issues.map((issue: ZodIssue) =>
        `${issue.path.join('.')}: ${issue.message}`
    );
}
