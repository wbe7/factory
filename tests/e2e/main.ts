
import { ScenarioRunner, type ScenarioConfig, cleanAllSandboxes } from './runner';
import { validateWithLlm } from './validator';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function main() {
    console.log('🏭 Starting Factory Automated E2E Suite');
    console.log('=======================================');

    // 0. Global Cleanup
    await cleanAllSandboxes();

    const scenarios: ScenarioConfig[] = [
        {
            name: '01_NEW_PROJECT',
            description: 'Start from empty directory, create a Python script.',
            args: ['--planning-cycles', '5', '--verify-cycles', '5', 'Create a hello world python script'],
            validation: async (log, dir) => {
                return validateWithLlm(log, dir, {
                    scenarioName: 'NEW_PROJECT',
                    expectedBehavior: 'Factory should detect NEW_PROJECT and create a python script that prints "Hello World".',
                    customAssertions: [
                        'Logs must contain "Detected scenario: NEW_PROJECT"',
                        'A python file must exist'
                    ]
                });
            }
        },
        {
            name: '02_BROWNFIELD',
            description: 'Start with existing main.go, add logging.',
            setup: async (dir) => {
                await fs.writeFile(path.join(dir, 'main.go'), 'package main\n\nfunc main() {\n  println("Hello")\n}');
            },
            args: ['--planning-cycles', '5', '--verify-cycles', '5', 'Add a println line to main.go'],
            validation: async (log, dir) => {
                return validateWithLlm(log, dir, {
                    scenarioName: 'BROWNFIELD',
                    expectedBehavior: 'Factory should detect BROWNFIELD and modify main.go.',
                    customAssertions: [
                        'Logs must contain "Detected scenario: BROWNFIELD"'
                    ]
                });
            }
        },
        {
            name: '03_UPDATE_PROJECT',
            description: 'Start with existing prd.json, add new task.',
            setup: async (dir) => {
                const prd = {
                    project: {
                        name: "Test",
                        description: "E2E Update Test",
                        tech_stack: ["python"],
                        test_command: "python3 --version"
                    },
                    user_stories: [
                        {
                            id: "T001",
                            title: "Init",
                            description: "Initial task",
                            status: "completed",
                            passes: true,
                            dependencies: [],
                            acceptance_criteria: []
                        }
                    ]
                };
                await fs.writeFile(path.join(dir, 'prd.json'), JSON.stringify(prd, null, 2));
                await fs.writeFile(path.join(dir, 'existing.py'), 'print("ok")');
            },
            args: ['--planning-cycles', '5', '--verify-cycles', '5', 'Create a file named VERSION.txt with content 1.0.0'],
            validation: async (log, dir) => {
                return validateWithLlm(log, dir, {
                    scenarioName: 'UPDATE_PROJECT',
                    expectedBehavior: 'Factory should detect UPDATE_PROJECT and append task.',
                    customAssertions: [
                        'Logs must contain "Detected scenario: UPDATE_PROJECT"',
                        'VERSION.txt file must be created'
                    ]
                });
            }
        },
        {
            name: '04_RESUME',
            description: 'Start with pending PRD, run without args.',
            setup: async (dir) => {
                const prd = {
                    project: {
                        name: "Resume Test",
                        description: "E2E Resume Test",
                        tech_stack: ["bash"],
                        test_command: "ls"
                    },
                    user_stories: [
                        {
                            id: "T001",
                            title: "Create hello.txt",
                            description: "Content 'resumed'",
                            status: "pending",
                            passes: false,
                            dependencies: [],
                            acceptance_criteria: ["File hello.txt exists"]
                        }
                    ]
                };
                await fs.writeFile(path.join(dir, 'prd.json'), JSON.stringify(prd, null, 2));
            },
            args: [],
            validation: async (log, dir) => {
                return validateWithLlm(log, dir, {
                    scenarioName: 'RESUME',
                    expectedBehavior: 'Factory should detect RESUME and execute pending task.',
                    customAssertions: [
                        'Logs must contain "Detected scenario: RESUME"',
                        'File hello.txt must exist'
                    ]
                });
            }
        }
    ];

    const results = await Promise.all(scenarios.map(async (scenario) => {
        try {
            const runner = new ScenarioRunner(scenario);
            const result = await runner.run();
            return { scenario, result };
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            return {
                scenario,
                result: { success: false, logs: '', error: `Runner initialization failed: ${errorMsg}` }
            };
        }
    }));

    console.log('\n=======================================');
    console.log('📊 E2E TEST SUMMARY');
    console.log('=======================================');

    let failures = 0;
    for (const { scenario, result } of results) {
        if (result.success) {
            console.log(`✅ ${scenario.name.padEnd(20)}: PASSED`);
        } else {
            console.error(`❌ ${scenario.name.padEnd(20)}: FAILED`);
            console.error(`   Reason: ${result.error}`);
            failures++;
        }
    }

    console.log('=======================================');
    if (failures === 0) {
        console.log(`🎉 All ${scenarios.length} scenarios passed!`);
        process.exit(0);
    } else {
        console.error(`💥 ${failures} scenarios failed.`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('💥 A fatal error occurred in the E2E test runner:', err);
    process.exit(1);
});
