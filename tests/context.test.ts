import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ProjectContext, type ProjectType } from '../src/context';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const TMP_DIR = path.join(os.tmpdir(), `factory-context-test-${Date.now()}`);

describe('ProjectContext', () => {
    let ctx: ProjectContext;

    beforeEach(async () => {
        await fs.mkdir(TMP_DIR, { recursive: true });
        ctx = new ProjectContext();
    });

    afterEach(async () => {
        await fs.rm(TMP_DIR, { recursive: true, force: true });
    });

    describe('scanFileTree', () => {
        it('should list files in directory', async () => {
            await fs.writeFile(path.join(TMP_DIR, 'file1.txt'), 'content');
            await fs.mkdir(path.join(TMP_DIR, 'subdir'));
            await fs.writeFile(path.join(TMP_DIR, 'subdir/file2.ts'), 'content');

            const tree = await ctx.scanFileTree(TMP_DIR);

            expect(tree).toContain('file1.txt');
            expect(tree).toContain('subdir/file2.ts');
        });

        it('should ignore node_modules and .git', async () => {
            await fs.mkdir(path.join(TMP_DIR, 'node_modules'));
            await fs.writeFile(path.join(TMP_DIR, 'node_modules/pkg.js'), 'content');
            await fs.mkdir(path.join(TMP_DIR, '.git'));
            await fs.writeFile(path.join(TMP_DIR, '.git/config'), 'content');
            await fs.writeFile(path.join(TMP_DIR, 'main.ts'), 'content');

            const tree = await ctx.scanFileTree(TMP_DIR);

            expect(tree).toContain('main.ts');
            expect(tree).not.toContain('node_modules');
            expect(tree).not.toContain('.git');
        });

        it('should respect maxFiles limit', async () => {
            for (let i = 0; i < 5; i++) {
                await fs.writeFile(path.join(TMP_DIR, `file${i}.txt`), 'content');
            }

            const tree = await ctx.scanFileTree(TMP_DIR, 3);
            const lines = tree.split('\n').filter(Boolean);

            expect(lines.length).toBe(3);
        });
    });

    describe('detectTestFiles', () => {
        it('should detect common test file patterns', async () => {
            await fs.writeFile(path.join(TMP_DIR, 'app.test.ts'), '');
            await fs.writeFile(path.join(TMP_DIR, 'utils.spec.js'), '');
            await fs.writeFile(path.join(TMP_DIR, 'main_test.go'), '');
            await fs.writeFile(path.join(TMP_DIR, 'test_api.py'), '');
            await fs.writeFile(path.join(TMP_DIR, 'normal.ts'), '');
            await fs.writeFile(path.join(TMP_DIR, 'UserServiceTest.java'), '');
            await fs.writeFile(path.join(TMP_DIR, 'UserSpec.php'), '');
            await fs.writeFile(path.join(TMP_DIR, 'user_spec.rb'), '');
            await fs.writeFile(path.join(TMP_DIR, 'lib_test.rs'), '');
            await fs.writeFile(path.join(TMP_DIR, 'widget_test.dart'), '');
            await fs.writeFile(path.join(TMP_DIR, 'user_test.exs'), '');
            await fs.writeFile(path.join(TMP_DIR, 'math_test.cpp'), '');

            const tests = await ctx.detectTestFiles(TMP_DIR);

            expect(tests).toContain('app.test.ts');
            expect(tests).toContain('utils.spec.js');
            expect(tests).toContain('main_test.go');
            expect(tests).toContain('test_api.py');
            expect(tests).not.toContain('normal.ts');

            // New languages
            expect(tests).toContain('UserServiceTest.java');
            expect(tests).toContain('UserSpec.php');
            expect(tests).toContain('user_spec.rb');
            expect(tests).toContain('lib_test.rs');
            expect(tests).toContain('widget_test.dart');
            expect(tests).toContain('user_test.exs');
            expect(tests).toContain('math_test.cpp');
        });
    });

    describe('detectProjectType API', () => {
        it('should detect NEW_PROJECT when directory is empty', async () => {
            const type = await ctx.detectProjectType(TMP_DIR);
            expect(type).toBe('NEW_PROJECT');
        });

        it('should detect UPDATE_PROJECT when prd.json exists', async () => {
            await fs.writeFile(path.join(TMP_DIR, 'prd.json'), '{}');
            const type = await ctx.detectProjectType(TMP_DIR);
            expect(type).toBe('UPDATE_PROJECT');
        });

        it('should detect BROWNFIELD when code files exist but no prd.json', async () => {
            await fs.writeFile(path.join(TMP_DIR, 'package.json'), '{}');
            const type = await ctx.detectProjectType(TMP_DIR);
            expect(type).toBe('BROWNFIELD');
        });

        it('should detect NEW_PROJECT if only .gitignore or README exist (heuristics)', async () => {
            await fs.writeFile(path.join(TMP_DIR, '.gitignore'), '');
            const type1 = await ctx.detectProjectType(TMP_DIR);
            expect(type1).toBe('NEW_PROJECT');

            await fs.writeFile(path.join(TMP_DIR, 'README.md'), '');
            const type2 = await ctx.detectProjectType(TMP_DIR);
            expect(type2).toBe('NEW_PROJECT');
        });
    });
});
