# Phase 2.5: Stability & Debugging — Walkthrough

**Date:** 2026-01-22  
**Branch:** `feature/phase-2.5-stability`  
**Status:** ✅ Complete

---

## Summary

Phase 2.5 addressed 7 critical stability issues observed in production testing. The main focus was on making Factory more robust when handling LLM output variations.

---

## Changes Made

### 1. Multi-Strategy JSON Extraction

**File:** `src/utils.ts`

Replaced simple `extractJson()` with a robust multi-strategy approach:

| Strategy | Priority | Description |
|----------|----------|-------------|
| `file_read` | Highest | Read from disk if LLM wrote via tool call |
| `json_block` | 1 | \`\`\`json block |
| `any_block` | 2 | Generic \`\`\` block |
| `json_braces` | 3 | `{ ... }` boundaries |
| `raw_text` | Fallback | Trimmed input |

Added `detectToolCalls()` to identify when LLM writes directly to disk.

### 2. New CLI Flags

| Flag | Purpose |
|------|---------|
| `--plan` | Run planning only (no execution) |
| `--verbose-planning` | Show full Architect/Critic output |

### 3. Scenario Detection

Factory now logs the detected scenario at startup:
- `NEW_PROJECT` — Empty directory
- `UPDATE_PROJECT` — prd.json exists, goal provided  
- `BROWNFIELD` — Files exist, no prd.json
- `RESUME` — prd.json with pending tasks

### 4. API Key Warning

Factory warns at startup if no API keys are found:
```
⚠️ No API keys found (GOOGLE_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY)
   LLM calls may fail. See README for configuration.
```

### 5. Type Deduplication

Removed duplicated PRD types from `types.ts` — now re-exports from `schemas.ts` (single source of truth).

### 6. Zero-Value Edge Cases

- `--planning-cycles 0` = skip planning
- `--verify-cycles 0` = skip verification  
- `--worker-iters 0` = skip worker loop

Changed `parsePositiveInt` to `parseNonNegativeInt`.

---

## Test Results

```
bun test
104 pass, 0 fail
177 expect() calls
Ran 104 tests across 8 files
```

### New Tests Added (+10)

| File | Tests |
|------|-------|
| `tests/e2e/scenarios.test.ts` | 4 scenario tests + 2 CLI flag tests |
| `tests/e2e/docker-env.test.ts` | 4 ENV var tests |

---

## Files Modified

| File | Changes |
|------|---------|
| `src/utils.ts` | Multi-strategy extractJson, detectToolCalls |
| `src/types.ts` | Type deduplication, new config fields |
| `src/config.ts` | parseNonNegativeInt, new flags |
| `factory.ts` | Scenario detection, API warning, planOnly, verbosePlanning |
| `Makefile` | docker-test-env target |
| `README.md` | LLM provider docs, updated CLI table |
| `ARCHITECTURE.md` | Updated FactoryConfig interface |
| `tests/utils.test.ts` | +8 extractJson tests |
| `tests/e2e/scenarios.test.ts` | +6 scenario/CLI tests (NEW) |
| `tests/e2e/docker-env.test.ts` | +4 ENV var tests (NEW) |

---

## Verification Commands

```bash
# Full test suite
bun test

# Type check
bunx tsc --noEmit --skipLibCheck

# Docker ENV test (requires Docker image)
make docker-test-env
```

### Manual Verification (Production)

Verified with `opencode/grok-code` (Free Tier) and `openrouter/meta-llama/llama-3.3-70b-instruct` (Free Tier).

- **Scenario 1 (NEW_PROJECT):** ✅ Passed (Plan -> Code -> Tests -> Fix -> Verify)
- **Scenario 2 (UPDATE_PROJECT):** ✅ Passed (Self-provisioning logic verified)
- **Scenario 3 (BROWNFIELD):** ✅ Passed (Correctly detected existing code, created refactoring plan)
- **Scenario 4 (RESUME):** ✅ Passed (Correctly detected pending PRD, skipped planning, started execution)
- **Configuration:** Verified `opencode` provider defaults and `openrouter` object-based config.

### Fixes Applied (Post-Implementation)

- **Config Compatibility:** Updated defaults to use `opencode/grok-code` (GLM no longer free).
- **Docker Wrapper:** Added `OPENROUTER_API_KEY` and `GOOGLE_GENERATIVE_AI_API_KEY` pass-through.
- **Warning Logic:** Suppressed "No API keys" warning if `config.json` exists or model is free.
- **README:** Updated documentation for new opencode config format.

---

## Notes

- **Logger WriteStream optimization** deferred — current appendFile() performance is acceptable
- **`--provider` flag** deferred to Phase 3 (scope creep prevention)
