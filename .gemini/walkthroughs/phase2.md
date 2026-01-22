# Phase 2: Logging & Observability — Walkthrough

**Status:** ✅ Completed  
**PR:** [#2](https://github.com/wbe7/factory/pull/2) (merged via squash)  
**Branch:** `feature/phase-2-logging` → `master`  
**Date:** 2026-01-22

---

## Summary

Phase 2 delivered a comprehensive logging and observability system for Factory, along with significant improvements to PRD validation, prompt quality, and agent reliability.

---

## Key Deliverables

### 1. Logger Module ([src/logger.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/src/logger.ts))

A production-grade Logger class with:

| Feature | Description |
|---------|-------------|
| **Level filtering** | `debug`, `info`, `warn`, `error` with `--log-level` flag |
| **Colored console output** | ANSI colors for visual clarity |
| **Opt-in file logging** | JSON Lines format via `--log-file <path>` |
| **Timer API** | `logger.timer('operation')` → `stopFn()` with duration |
| **Quiet mode** | Suppress all console output |
| **Context support** | Structured metadata in log entries |

**Usage:**
```typescript
const logger = new Logger({ level: 'debug', logFile: 'factory.log' });
const stop = logger.timer('planning');
// ... do work
stop(); // logs: "planning completed in 1234ms"
```

---

### 2. Zod Schema Validation ([src/schemas.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/src/schemas.ts))

Implemented tolerant parsing for LLM-generated PRD:

| Schema | Tolerance |
|--------|-----------|
| `TaskStatusSchema` | Falls back to `'pending'` for unknown values |
| `PrdTaskSchema` | Defaults for `status`, `passes`, `dependencies`, `acceptance_criteria` |
| `PrdSchema` | Accepts partial input with sensible defaults |

**Helper Functions:**
- `parsePrd(json)` — Parse and validate JSON string
- `parsePrdWithErrors(json)` — Returns `[result, errors[]]` for debugging
- `formatPrdErrors(zodError)` — Human-readable error messages

---

### 3. Config Enhancements ([src/config.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/src/config.ts))

New CLI flags and environment variables:

| Flag | Env Var | Default | Description |
|------|---------|---------|-------------|
| `--log-file <path>` | `FACTORY_LOG_FILE` | - | JSON Lines file path |
| `--log-level <lvl>` | `FACTORY_LOG_LEVEL` | `info` | Minimum log level |

Validation helpers extracted:
- `parsePositiveInt(value, name)` — Validates integer arguments
- `parsePositiveFloat(value, name)` — Validates float arguments

---

### 4. Worker Loop Refactoring ([src/worker.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/src/worker.ts))

New signature with options object:

```typescript
interface WorkerLoopOptions {
  prompt: string;
  cwd: string;
  maxIterations: number;
  timeout: number;
  model: string;
  baseUrl?: string;
  logger: Logger;
}

interface WorkerLoopResult {
  success: boolean;
  output: string;
  iterationsUsed: number;
  durationMs: number;
}
```

---

### 5. Main Orchestration ([factory.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/factory.ts))

Major improvements:

- **Task Dependency Resolution:** Tasks execute only after all dependencies complete
- **Status Transitions:** `pending` → `implementation` → `verification` → `completed`/`failed`
- **Agent CWD Fix:** All agents (Architect, Critic, Worker, Verifier) now run in `target_project/`
- **Enhanced Logging:** Planning phase visibility with timing metrics
- **Detailed Error Logging:** `parsePrdWithErrors()` for debugging LLM failures

---

### 6. Prompt Improvements

| Prompt | Changes |
|--------|---------|
| [architect.md](file:///Users/mtik/go/src/github.com/wbe7/facrory/prompts/architect.md) | Explicit rules: `status: pending`, `passes: false` for new tasks |
| [critic.md](file:///Users/mtik/go/src/github.com/wbe7/facrory/prompts/critic.md) | Verify `passes: false` on new tasks |
| [worker.md](file:///Users/mtik/go/src/github.com/wbe7/facrory/prompts/worker.md) | Clarified "Project Root: Current Directory", TDD emphasis |
| [verifier.md](file:///Users/mtik/go/src/github.com/wbe7/facrory/prompts/verifier.md) | Use `test_command` from prd.json instead of hardcoded |

---

### 7. Dockerfile Enhancements ([Dockerfile](file:///Users/mtik/go/src/github.com/wbe7/facrory/Dockerfile))

Pre-installed utilities to avoid runtime downloads:

```dockerfile
RUN apt-get install -y \
    docker.io net-tools iproute2 dnsutils iputils-ping \
    netcat-openbsd procps htop jq make sudo vim-tiny less
```

---

## Test Coverage

| Test File | Tests | Description |
|-----------|-------|-------------|
| [tests/logger.test.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/tests/logger.test.ts) | 21 | Level filtering, file logging, timers, quiet mode |
| [tests/schemas.test.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/tests/schemas.test.ts) | 43 | Tolerant parsing, defaults, error formatting |
| [tests/worker-loop.test.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/tests/worker-loop.test.ts) | 12 | New signature, result metrics |
| [tests/e2e/cli.test.ts](file:///Users/mtik/go/src/github.com/wbe7/facrory/tests/e2e/cli.test.ts) | 6 | New flags, help output |

**Total:** 82 tests passing

---

## Gemini Code Assist Review

PR #2 went through **5 review cycles** with **11 findings** total:

| Round | Findings | Status |
|-------|----------|--------|
| 1 | 3 (Logger leak, replace→replaceAll, Makefile clean) | ✅ Fixed |
| 2 | 2 (Numeric parsing helpers) | ✅ Fixed |
| 3 | 2 (ZodIssue import, generic name param) | ✅ Fixed |
| 4 | 2 (Task dependency selection) | ✅ Fixed |
| 5 | 2 (Stream logging, type duplication) | ⏳ Deferred to Phase 2.5 |

---

## Stats

```
 23 files changed
 +1,317 insertions
 -151 deletions
 
 New files:
   src/logger.ts (213 lines)
   src/schemas.ts (110 lines)
   tests/logger.test.ts (211 lines)
   tests/schemas.test.ts (247 lines)
   Makefile (32 lines)
```

---

## Known Issues (Deferred to Phase 2.5)

1. **Type Duplication:** `PrdProject`, `PrdTask`, `Prd` defined in both `types.ts` and `schemas.ts`
2. **Logger Stream:** Using `appendFile()` instead of `WriteStream` (not a bottleneck yet)
3. **Invalid JSON Errors:** Architect produces invalid JSON in many cycles before success (root cause: LLM uses Write tool instead of text output)
4. **Docker ENV Vars:** Possibly not working correctly with `-e` flag

---

## Configuration

Opencode configured for Gemini 3 Flash testing:

```json
// ~/.config/opencode/config.json
{
  "provider": "google",
  "model": "gemini-3-flash-preview",
  "non_interactive": true
}
```

---

## Next Steps

See [ROADMAP.md Phase 2.5](file:///Users/mtik/go/src/github.com/wbe7/facrory/.gemini/docs/ROADMAP.md) for detailed stability and debugging improvements.
