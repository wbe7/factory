import { describe, test, expect } from 'bun:test';
import {
    PrdSchema,
    PrdTaskSchema,
    PrdProjectSchema,
    TaskStatusSchema,
    parsePrd,
    parsePrdWithErrors,
    validatePrd,
    formatPrdErrors,
    type Prd,
    type PrdTask,
} from '../src/schemas';

describe('Zod Schemas', () => {
    describe('TaskStatusSchema', () => {
        test('accepts valid statuses', () => {
            expect(TaskStatusSchema.parse('pending')).toBe('pending');
            expect(TaskStatusSchema.parse('implementation')).toBe('implementation');
            expect(TaskStatusSchema.parse('verification')).toBe('verification');
            expect(TaskStatusSchema.parse('completed')).toBe('completed');
            expect(TaskStatusSchema.parse('failed')).toBe('failed');
        });

        test('invalid status falls back to pending (tolerant)', () => {
            // With .catch('pending'), invalid values return 'pending' instead of throwing
            expect(TaskStatusSchema.parse('invalid')).toBe('pending');
            expect(TaskStatusSchema.parse('')).toBe('pending');
        });
    });

    describe('PrdProjectSchema', () => {
        test('accepts valid project', () => {
            const project = {
                name: 'Test Project',
                description: 'A test project',
                tech_stack: ['TypeScript', 'Bun'],
                test_command: 'bun test',
            };

            const result = PrdProjectSchema.parse(project);
            expect(result.name).toBe('Test Project');
            expect(result.tech_stack).toEqual(['TypeScript', 'Bun']);
        });

        test('accepts project with quality_gate', () => {
            const project = {
                name: 'Test',
                description: 'Test',
                tech_stack: [],
                test_command: 'test',
                quality_gate: {
                    lint_command: 'lint',
                    type_check: 'tsc',
                    security_scan: null,
                },
            };

            const result = PrdProjectSchema.parse(project);
            expect(result.quality_gate?.lint_command).toBe('lint');
        });

        test('rejects missing required fields', () => {
            expect(() => PrdProjectSchema.parse({})).toThrow();
            expect(() => PrdProjectSchema.parse({ name: 'Test' })).toThrow();
        });
    });

    describe('PrdTaskSchema', () => {
        const validTask: PrdTask = {
            id: 'T001',
            title: 'Test Task',
            description: 'Implement feature',
            acceptance_criteria: ['Criterion 1', 'Criterion 2'],
            dependencies: [],
            status: 'pending',
            passes: false,
        };

        test('accepts valid task', () => {
            const result = PrdTaskSchema.parse(validTask);
            expect(result.id).toBe('T001');
            expect(result.status).toBe('pending');
        });

        test('accepts task with metrics', () => {
            const taskWithMetrics = {
                ...validTask,
                metrics: {
                    tokens_used: 1000,
                    estimated_cost_usd: 0.05,
                    duration_seconds: 30,
                },
            };

            const result = PrdTaskSchema.parse(taskWithMetrics);
            expect(result.metrics?.tokens_used).toBe(1000);
        });

        test('invalid status falls back to pending (tolerant)', () => {
            const result = PrdTaskSchema.parse({ ...validTask, status: 'unknown' });
            expect(result.status).toBe('pending'); // Fallback instead of throw
        });
    });

    describe('PrdSchema', () => {
        const validPrd: Prd = {
            project: {
                name: 'Factory',
                description: 'AI Engineering System',
                tech_stack: ['TypeScript', 'Bun'],
                test_command: 'bun test',
            },
            user_stories: [
                {
                    id: 'T001',
                    title: 'Initial Setup',
                    description: 'Setup project structure',
                    acceptance_criteria: ['Tests pass'],
                    dependencies: [],
                    status: 'pending',
                    passes: false,
                },
            ],
        };

        test('accepts valid PRD', () => {
            const result = PrdSchema.parse(validPrd);
            expect(result.project.name).toBe('Factory');
            expect(result.user_stories.length).toBe(1);
        });

        test('accepts PRD with empty user_stories', () => {
            const emptyPrd = {
                ...validPrd,
                user_stories: [],
            };

            const result = PrdSchema.parse(emptyPrd);
            expect(result.user_stories.length).toBe(0);
        });

        test('rejects PRD without project', () => {
            expect(() => PrdSchema.parse({ user_stories: [] })).toThrow();
        });
    });

    describe('parsePrd', () => {
        test('parses valid JSON to PRD', () => {
            const json = JSON.stringify({
                project: {
                    name: 'Test',
                    description: 'Test',
                    tech_stack: [],
                    test_command: 'test',
                },
                user_stories: [],
            });

            const result = parsePrd(json);
            expect(result).not.toBeNull();
            expect(result?.project.name).toBe('Test');
        });

        test('returns null for invalid JSON', () => {
            expect(parsePrd('not json')).toBeNull();
            expect(parsePrd('{invalid}')).toBeNull();
        });

        test('returns null for invalid PRD structure', () => {
            expect(parsePrd('{}')).toBeNull();
            expect(parsePrd('{"project": {}}')).toBeNull();
        });
    });

    describe('validatePrd', () => {
        test('returns success for valid PRD', () => {
            const prd = {
                project: {
                    name: 'Test',
                    description: 'Test',
                    tech_stack: [],
                    test_command: 'test',
                },
                user_stories: [],
            };

            const result = validatePrd(prd);
            expect(result.success).toBe(true);
        });

        test('returns error for invalid PRD', () => {
            const result = validatePrd({});
            expect(result.success).toBe(false);
        });
    });

    describe('formatPrdErrors', () => {
        test('returns empty array for successful validation', () => {
            const result = validatePrd({
                project: {
                    name: 'Test',
                    description: 'Test',
                    tech_stack: [],
                    test_command: 'test',
                },
                user_stories: [],
            });

            expect(formatPrdErrors(result)).toEqual([]);
        });

        test('returns error messages for failed validation', () => {
            const result = validatePrd({ project: { name: 'Test' } });
            const errors = formatPrdErrors(result);

            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('Type inference', () => {
        test('inferred types match expected interface', () => {
            // This is a compile-time check - if types don't match, this won't compile
            const task: PrdTask = {
                id: 'T001',
                title: 'Test',
                description: 'Test',
                acceptance_criteria: [],
                dependencies: [],
                status: 'pending',
                passes: false,
            };

            const prd: Prd = {
                project: {
                    name: 'Test',
                    description: 'Test',
                    tech_stack: [],
                    test_command: 'test',
                },
                user_stories: [task],
            };

            expect(prd.user_stories[0]!.id).toBe('T001');
        });
    });
});
