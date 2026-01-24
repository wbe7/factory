# Phase 3: Project Context Enhancement — Walkthrough

**Status:** ✅ Completed
**Date:** 2026-01-24
**Branch:** `feature/phase-3-context` (Simulated)

---

## Summary

Phase 3 focused on empowering the Architect agent with deep context about the project structure and existing tests. This enables smarter planning for brownfield projects and prevents regressions by ensuring existing tests are respected. We also improved the robustness of scenario detection (NEW vs BROWNFIELD) and added manual overrides.

---

## Key Deliverables

### 1. Project Context Module (`src/context.ts`)

A new `ProjectContext` class that handles intelligent file scanning:

*   **Smart File Scanning**: Recursively lists files while ignoring noise (`node_modules`, `.git`, `.DS_Store`, etc.).
*   **Test Discovery**: Detects existing test files (JS/TS, Go, Python, Java, PHP, Ruby, Rust, Swift, C#, Dart, Elixir, C/C++) to inform the Architect.
*   **Scenario Detection**: Heuristics to distinguish between `NEW_PROJECT` (empty or just gitignore) and `BROWNFIELD` (existing code).

### 2. Prompt Enrichment

*   **Architect Agent**: Now receives:
    *   `{{FILE_TREE}}`: A partial file tree (up to 100 relevant files) to understand project structure.
    *   `{{EXISTING_TESTS}}`: A list of detected test files.
*   **Verifier Agent**: Now receives:
    *   `{{TEST_COMMAND}}`: Explicit test command from `prd.json` (e.g., `go test ./...`), ensuring the correct test runner is used.

### 3. CLI Enhancements

Added flags to force specific scenarios, useful for testing or overriding heuristics:

*   `--force-new`: Treat current directory as a fresh project (ignore existing files).
*   `--force-brownfield`: Treat current directory as an existing project (force analysis).

### 4. Logic Improvements

*   **Refined RESUME detection**: Correctly identifies RESUME scenario when `prd.json` exists but no goal is provided.
*   **Factory Loop Integration**: Integrated `ProjectContext` scanning into the Planning phase and Test Command extraction into the Execution phase.

---

## Changes

| File | Nature | Description |
|------|--------|-------------|
| `src/context.ts` | **NEW** | `ProjectContext` class implementation. |
| `tests/context.test.ts` | **NEW** | Unit tests for context scanning and detection by regex. |
| `factory.ts` | Modify | Integrated context scanning, updated scenario logic, injected new prompt variables. |
| `src/config.ts` | Modify | Added `--force-new` and `--force-brownfield` flags. |
| `src/types.ts` | Modify | Added flags to config, exported `ProjectType`. |
| `prompts/architect.md` | Modify | Added `Project Context` section with file tree and tests. |
| `prompts/verifier.md` | Modify | Replaced generic instructions with specific `{{TEST_COMMAND}}` execution. |
| `tests/e2e/scenarios.test.ts` | Modify | Added tests for force flags and fixed duplicate tests. |
| `tests/e2e/docker-env.test.ts` | Modify | Fixed API key warning test to work with default free model. |

---

## Test Results

```
bun test
114 pass, 0 fail
```

*   **Unit Tests**: Verified file scanning, ignore lists, and regex matching for tests.
*   **E2E Tests**: Verified scenario detection, flag overrides, and CLI argument parsing.

---

## Next Steps

Proceed to **Phase 4: Git Worktree Isolation** to ensure task execution safety.
