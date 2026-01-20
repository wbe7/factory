# Phase 1: CLI Refactoring & Core Loop Rewrite

**Status:** ✅ Completed  
**Branch:** `feature/phase-1-cli-refactoring`  
**PR:** [#1](https://github.com/wbe7/factory/pull/1)  
**Date:** 2026-01-21

---

## Summary

This phase refactored Factory to be configurable via CLI/env and replaced the external `ralph-wiggum` dependency with a native worker loop implementation.

## Changes Made

### New Files

| File | Purpose |
|------|---------|
| `src/types.ts` | TypeScript interfaces: `FactoryConfig`, `Prd`, `PrdTask` |
| `src/config.ts` | CLI parsing, env config, help output |
| `src/utils.ts` | Atomic writes, backup, JSON extraction |
| `src/worker.ts` | Native worker loop replacing ralph |
| `tests/config.test.ts` | 16 CLI parsing tests |
| `tests/worker-loop.test.ts` | 6 worker loop tests |
| `tests/utils.test.ts` | 11 utility tests |
| `tests/e2e/cli.test.ts` | 5 E2E CLI tests |
| `.env.example` | Environment variables template |
| `opencode.config.json` | Non-interactive mode for Docker |

### Modified Files

| File | Changes |
|------|---------|
| `factory.ts` | Complete refactor using src/ modules (247 LOC) |
| `Dockerfile` | Removed ralph, added src/, opencode config |
| `README.md` | Added Configuration section with all flags/env |
| `.gemini/docs/ARCHITECTURE.md` | Added Docker Build section |
| `.gitignore` | Added .env, factory.log, etc |

## Test Results

```
43 pass
0 fail
66 expect() calls
Ran 43 tests across 4 files. [372.00ms]
```

## CLI Features

```bash
# Help
bun factory.ts --help

# Dry run
bun factory.ts --dry-run "Create API"

# Custom model
bun factory.ts --model gpt-4 "Add auth"

# Self-hosted LLM
OPENAI_BASE_URL=http://localhost:8000/v1 bun factory.ts "Task"

# Verbose mode
bun factory.ts --verbose "Debug task"
```

## Deliverables Checklist

- [x] CLI argument parsing (native Bun)
- [x] Environment variable support (8 vars)
- [x] Add flags: --model, --timeout, --base-url, etc.
- [x] Remove hardcoded "v3"
- [x] Create .env.example
- [x] Implement native workerLoop()
- [x] Remove ralph-wiggum from Dockerfile
- [x] Atomic writes (temp + rename)
- [x] Backup prd.json.bak
- [x] Graceful shutdown (SIGTERM/SIGINT)
- [x] Global timeout
- [x] Configure opencode non-interactive
- [x] Add --mock-llm flag
- [x] Setup bun test infrastructure
- [x] Update README
- [x] Document self-hosted models

## Next Steps

Ready for Phase 2: Logging & Observability
