import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { $ } from 'bun';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'fs';

const TEST_DIR = '/tmp/factory-scenario-test';
const FACTORY_PATH = process.cwd();

describe('E2E: Scenario Detection', () => {
    beforeEach(() => {
        rmSync(TEST_DIR, { recursive: true, force: true });
        mkdirSync(`${TEST_DIR}/target_project`, { recursive: true });
    });

    afterEach(() => {
        rmSync(TEST_DIR, { recursive: true, force: true });
    });

    test('NEW_PROJECT: empty directory, has goal', async () => {
        const proc = await $`bun ${FACTORY_PATH}/factory.ts --mock-llm --dry-run "Create app"`.cwd(TEST_DIR).nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('NEW_PROJECT');
    });

    test('RESUME: prd.json exists, no goal', async () => {
        // Create prd.json in target_project
        writeFileSync(`${TEST_DIR}/target_project/prd.json`, JSON.stringify({
            project: { name: 'test', description: 'test', tech_stack: [], test_command: 'echo' },
            user_stories: [{ id: 'US-001', title: 't', description: 'd', status: 'pending', passes: false, acceptance_criteria: [], dependencies: [] }]
        }));

        const proc = await $`bun ${FACTORY_PATH}/factory.ts --mock-llm --dry-run`.cwd(TEST_DIR).nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('RESUME');
    });

    test('UPDATE_PROJECT: prd.json exists, goal provided', async () => {
        writeFileSync(`${TEST_DIR}/target_project/prd.json`, JSON.stringify({
            project: { name: 'test', description: 'test', tech_stack: [], test_command: 'echo' },
            user_stories: []
        }));

        const proc = await $`bun ${FACTORY_PATH}/factory.ts --mock-llm --dry-run "Add feature"`.cwd(TEST_DIR).nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('UPDATE_PROJECT');
    });

    test('BROWNFIELD: existing files, no prd.json', async () => {
        writeFileSync(`${TEST_DIR}/target_project/main.go`, 'package main');

        const proc = await $`bun ${FACTORY_PATH}/factory.ts --mock-llm --dry-run "Add endpoint"`.cwd(TEST_DIR).nothrow();
        const output = proc.stdout.toString() + proc.stderr.toString();
        expect(output).toContain('BROWNFIELD');
    });
});

describe('E2E: New CLI Flags', () => {
    test('--plan flag is recognized', async () => {
        const proc = await $`bun factory.ts --help`.nothrow();
        const output = proc.stdout.toString();
        expect(output).toContain('--plan');
        expect(output).toContain('Run planning only');
    });

    test('--verbose-planning flag is recognized', async () => {
        const proc = await $`bun factory.ts --help`.nothrow();
        const output = proc.stdout.toString();
        expect(output).toContain('--verbose-planning');
    });
});
