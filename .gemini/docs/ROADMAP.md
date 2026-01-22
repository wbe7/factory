# Factory Roadmap

## Project Status Overview

| Phase | Name | Status | Branch |
|-------|------|--------|--------|
| 0 | Bootstrap & Current State | ✅ Completed | `main` |
| 1 | CLI Refactoring & Core Loop Rewrite | ✅ Completed | `feature/phase-1-cli-refactoring` |
| 2 | Logging & Observability | ✅ Completed | `feature/phase-2-logging` |
| 2.5 | Stability & Debugging | 🔲 Planned | - |
| 3 | Project Context Enhancement | 🔲 Planned | - |
| 4 | Git Worktree Isolation | 🔲 Planned | - |
| 5 | Universal Test Runner & Quality Gate | 🔲 Planned | - |
| 6 | Docker Image Optimization | 🔲 Planned | - |
| 7 | Install Script & Distribution | 🔲 Planned | - |
| 8 | DinD Networking Improvements | 🔲 Planned | - |
| 9 | Parallel Task Execution | 🔲 Planned | - |
| 10 | Cost Tracking & Analytics | 🔲 Planned | - |
| 11 | Live Integration Testing | 🔲 Planned | - |

**Current Focus:** Phase 2.5 - Stability & Debugging

---

## Phase Details

### Phase 0: Bootstrap & Current State ✅

**Status:** Completed (pre-project initialization)

**What exists:**
- [x] `factory.ts` - Main orchestrator with Planning & Execution loops
- [x] `Dockerfile` - Ubuntu 24.04 base with Bun, opencode
- [x] `factory_wrapper.sh` - Docker run wrapper with volume mounts
- [x] `prompts/` - Agent prompts (architect, critic, worker, verifier)
- [x] `README.md` - Usage documentation

**Known Issues:**
- Hardcoded model and cycle counts
- No structured logging
- Architect doesn't see project file tree
- Node.js in container too old (v18, needs v20+)
- create-next-app conflicts with existing files
- Permission prompts block non-interactive execution (→ Phase 1)
- External dependency on `ralph-wiggum` (unnecessary complexity)
- No CI/CD pipeline (GitHub Actions needed)

---

### Phase 1: CLI Refactoring & Core Loop Rewrite ✅

**Goal:** Make Factory configurable, remove external dependencies, implement native execution loop with production-grade safety.

**Deliverables:**

*CLI & Configuration:*
- [x] Add CLI argument parsing (native Bun `process.argv`)
- [x] Environment variable support for:
  - `FACTORY_MODEL` (default: `opencode/glm-4.7-free`)
  - `FACTORY_PLANNING_CYCLES` (default: 3)
  - `FACTORY_VERIFICATION_CYCLES` (default: 3)
  - `FACTORY_WORKER_ITERATIONS` (default: 10)
  - `FACTORY_TIMEOUT` (default: 3600 seconds)
  - `FACTORY_MAX_COST` (default: unlimited)
  - `OPENAI_BASE_URL` (custom LLM endpoint for self-hosted models)
  - `OPENAI_API_KEY` (API key for custom endpoint)
- [x] Add flags: `--model`, `--planning-cycles`, `--verify-cycles`, `--worker-iters`
- [x] Add flags: `--timeout`, `--max-cost` (rate limiting)
- [x] Add flags: `--base-url` (override LLM endpoint for local/self-hosted models)
- [x] Add flags: `--verbose` / `--quiet`, `--dry-run`
- [x] Remove hardcoded "v3" from output
- [x] Create `.env.example` with all env vars documented

*Remove Ralph Dependency:*
- [x] Implement native `workerLoop()` function (~30 lines)
- [x] Remove `ralph-wiggum` from Dockerfile and dependencies
- [x] Loop logic: call `opencode run` until `<promise>COMPLETE</promise>` found
- [x] Add iteration counter and timeout handling
- [ ] Emit structured events for each iteration (prep for Phase 2 logging) → **Deferred to Phase 2**

*Safety & Reliability:*
- [x] **Atomic writes**: Write to `prd.json.tmp`, then rename (prevents corruption)
- [x] **Backup**: Copy `prd.json` to `prd.json.bak` before each modification
- [x] **Graceful shutdown**: Handle `SIGTERM`/`SIGINT`, save state, cleanup
- [x] **Global timeout**: `setTimeout` to kill process after `--timeout` seconds
- [x] Configure opencode for non-interactive mode (auto-accept permissions)

*Testing Infrastructure:*
- [x] Add `--mock-llm` flag for testing without real API calls
- [x] Create mock responses fixture for unit tests
- [x] Setup basic test structure with `bun test`

*Documentation:*
- [x] Update README with new configuration options
- [x] Document self-hosted model configuration

**Verification:**
- Unit tests for argument parsing
- Unit tests for workerLoop (with mock LLM)
- Unit tests for atomic write and backup
- E2E test: `factory --model foo "Hello"` should pass model to agent
- E2E test: Verify factory works without ralph installed
- E2E test: `factory --dry-run "task"` should output prd.json without executing

---

### Phase 2: Logging & Observability ✅

**Status:** Completed (PR #2 merged)

**Goal:** Structured logging for debugging, analytics, and improved planning phase visibility.

**Deliverables (Completed):**
- [x] Create `Logger` class with levels (debug, info, warn, error)
- [x] **Default: stdout** (Docker-friendly, `docker logs` compatible)
- [x] **Opt-in file logging** via `--log-file <path>` flag
- [x] Add `--log-level` flag (default: info)
- [x] Add `FACTORY_LOG_FILE` and `FACTORY_LOG_LEVEL` env vars
- [x] Add timing metrics (phase duration, agent call duration)
- [x] Emit structured events for worker iterations (iteration start/end, success/failure)
- [x] **Enhanced planning phase visibility** (Architect/Critic progress logging)
- [x] Add Zod validation for `prd.json` with tolerant parsing
- [x] Add `parseInt`/`parseFloat` input validation helpers
- [x] Add task status transitions (`pending` → `implementation` → `verification` → `completed`/`failed`)
- [x] **Task dependency ordering** — execute tasks only when all dependencies are completed
- [x] All agents run in `target_project` directory (bugfix)
- [x] Improved prompts for Architect/Critic/Worker/Verifier

**Stats:** 23 files changed, +1,317 lines, 82 tests

**Tech Debt Deferred to Phase 2.5:**
- Type duplication between `types.ts` and `schemas.ts`
- Stream-based logging for high-frequency scenarios

---

### Phase 2.5: Stability & Debugging 🔲

**Goal:** Fix critical stability issues observed in production testing. Ensure Factory reliably handles all 4 execution scenarios with minimal wasted cycles.

---

#### 🔴 Problem 1: Excessive "Invalid JSON from Architect" Errors

**Observed Behavior:**
In production testing, the Architect agent produced invalid JSON in **25 out of 30 planning cycles** before finally generating valid output. This wastes significant time and API credits.

**Root Causes:**

1. **LLM Uses Tool Calls Instead of Text Response**
   - Instead of returning raw JSON text, the LLM agent (opencode) may call tools like `|  Write prd.json` or `|  Edit prd.json`.
   - Our current logic expects the JSON in the agent's text output and uses `extractJson()` to find `\`\`\`json...` blocks.
   - When LLM writes directly to disk, the text output is empty/contains tool call logs — we mark this as "Invalid JSON".

2. **LLM Returns Markdown Instead of Raw JSON**
   - The prompt says "Return ONLY the valid JSON" but LLM may still wrap it in markdown or add commentary.
   - `extractJson()` tries to find `\`\`\`json` block but may fail if format differs.

3. **Schema Strictness**
   - Even with tolerant Zod parsing, certain structural issues still cause failures.
   - We now log validation errors but they're not visible without `--log-level debug`.

**Solution (Deliverables):**

```
[ ] 1. Detect Tool Calls in Output
    - If output contains "|  Write" or "|  Edit" patterns, LLM wrote to disk directly
    - In this case, READ from PRD_FILE instead of parsing output
    - Log: "Architect used file tool, reading from disk"

[ ] 2. Improve extractJson() Robustness
    - Try multiple extraction strategies in order:
      a. Extract from ```json...``` block
      b. Extract from ```...``` block (any language)
      c. Find JSON object boundaries ({ ... })
      d. Use raw text as-is
    - Add unit tests for each strategy

[ ] 3. Enhanced Error Logging
    - When validation fails, log:
      - First 300 characters of raw LLM output
      - Specific Zod validation errors
      - Whether tool calls were detected
    - Make this visible at INFO level (not just DEBUG)

[ ] 4. Add --verbose-planning Flag
    - Shows full Architect/Critic output during planning phase
    - Useful for debugging prompt issues
```

---

#### 🔴 Problem 2: Environment Variables Not Working in Container

**Observed Behavior:**
Environment variables passed via `docker run -e FACTORY_MODEL=...` are not being picked up. Users must use CLI flags instead.

**Root Cause (Hypothesis):**
- ENV vars may be set AFTER `parseEnvConfig()` is called
- Or there's a docker/bun subprocess inheritance issue

**Solution (Deliverables):**

```
[ ] 1. Add E2E Test for Docker ENV Vars
    - Run: docker run -e FACTORY_MODEL=test-model ... factory --dry-run "test"
    - Assert: output contains "model: test-model"

[ ] 2. Debug parseEnvConfig() Order
    - Add debug logging showing all FACTORY_* env vars at startup
    - Verify Bun.env vs process.env behavior

[ ] 3. Document Correct ENV Var Usage
    - Update README with explicit docker -e examples
    - Add troubleshooting section for common issues
```

---

#### 🟡 Problem 3: Type Duplication

**Observed:**
Types `PrdProject`, `PrdTask`, `Prd` are defined in BOTH:
- `src/types.ts` (manual definitions)
- `src/schemas.ts` (Zod-inferred types)

**Risk:** Definitions can drift out of sync.

**Solution:**

```
[ ] 1. Remove Manual Types from types.ts
    - Delete PrdProject, PrdTask, Prd, TaskStatus from types.ts
    - Keep only FactoryConfig and LogLevel

[ ] 2. Re-export from schemas.ts
    - Update imports across codebase to use schemas.ts exports

[ ] 3. Verify No Type Errors
    - Run: bun tsc --noEmit
```

---

#### 🟡 Problem 4: Logger Performance (Low Priority)

**Observed:**
Logger uses `appendFile()` for each log entry — file handle opened/closed per write.

**Current Assessment:** Not a bottleneck for typical usage (~1 log/second).

**Solution (Optional):**

```
[ ] Consider: Use WriteStream in Logger constructor
    - Open stream once, write many, close in close() method
    - Only implement if profiling shows issue
```

---

#### � Problem 7: Planning-Only Mode Not Supported

**Observed:**
Users want to run only the planning phase (Architect + Critic) without execution, but:
- `--worker-iters 0` crashes or behaves unexpectedly
- `--verify-cycles 0` also causes issues
- No explicit `--plan-only` or `--plan` flag exists

**Use Cases:**
- Review generated `prd.json` before committing to execution
- Iterate on prompts without burning API credits on Worker/Verifier
- CI integration: generate plan for human review

**Solution:**

```
[ ] 1. Add --plan Flag
    - Skip execution phase entirely
    - Similar to --dry-run but actually runs Architect/Critic
    - Output: prd.json with status=pending for all tasks

[ ] 2. Fix Edge Cases
    - --worker-iters 0 should be valid (skip worker loop)
    - --verify-cycles 0 should be valid (skip verification)
    - Validate at startup, not during execution

[ ] 3. Add Explicit Logging
    - Log: "Planning-only mode: skipping execution phase"
    - Log: "Run 'factory' without --plan to execute tasks"
```

---

#### �🔴 Problem 5: All 4 Execution Scenarios Must Be Validated

**Context:**
Factory supports 4 distinct execution scenarios. Each must be tested to ensure reliable operation.

| Scenario | Detection | Expected Behavior |
|----------|-----------|-------------------|
| **NEW_PROJECT** | Empty dir, no `prd.json` | Architect creates full plan from scratch |
| **UPDATE_PROJECT** | Existing `prd.json` with completed tasks | Architect appends/modifies tasks |
| **BROWNFIELD** | Files exist but no `prd.json` | Architect analyzes existing code, creates plan |
| **RESUME** | `prd.json` with pending tasks | Skip planning, continue execution |

**Solution (Deliverables):**

```
[ ] 1. E2E Tests for Each Scenario
    - tests/e2e/scenarios.test.ts with mock LLM responses
    - Assert correct phase detection and flow

[ ] 2. Manual Test Script
    - scripts/test-scenarios.sh with all 4 scenarios
    - Uses real LLM (Gemini Flash for cost efficiency)
    - Creates temp directories for isolation

[ ] 3. Scenario Detection Logging
    - Log detected scenario at INFO level on startup
    - Log: "Detected scenario: NEW_PROJECT"
```

---

#### 🔴 Problem 6: API Key Propagation to Container

**Observed:**
Users confused about where to put API keys for Factory to use inside Docker container.

**Current Flow:**
1. Host: `~/.config/opencode/config.json` with provider/model/api_key
2. Docker: `docker run -v $HOME/.config/opencode:/root/.config/opencode ...`
3. Container: `opencode` reads config from `/root/.config/opencode/config.json`

**For Vertex AI (Google):**
```json
// ~/.config/opencode/config.json
{
  "provider": "google",
  "model": "gemini-3-flash-preview",
  "non_interactive": true
}
```

API key via environment:
```bash
docker run ... -e GOOGLE_API_KEY="your-key" wbe7/factory ...
```

**For OpenAI-compatible:**
```json
// ~/.config/opencode/config.json
{
  "provider": "openai",
  "model": "gpt-4o",
  "non_interactive": true
}
```

API key via environment:
```bash
docker run ... -e OPENAI_API_KEY="sk-..." wbe7/factory ...
```

**Solution (Deliverables):**

```
[ ] 1. Document API Key Flow in README
    - Section: "Configuring LLM Providers"
    - Examples for Google, OpenAI, OpenRouter, local models

[ ] 2. Startup Validation
    - Check for required env vars based on provider
    - Log warning if missing: "GOOGLE_API_KEY not set, LLM calls will fail"

[ ] 3. Add --provider Flag
    - Allow runtime override: factory --provider google --model gemini-3-flash-preview
```

---

#### Verification Plan

**Automated Tests:**

```bash
# 1. JSON extraction strategies
bun test tests/utils.test.ts  # New tests for extractJson variants

# 2. Tool call detection
bun test tests/factory.test.ts  # Mock output with tool calls

# 3. Docker ENV vars
make docker-test-env  # New Makefile target with docker -e tests

# 4. Scenario detection
bun test tests/e2e/scenarios.test.ts  # All 4 scenarios with mocks
```

**Manual Verification (Mac with Docker):**

```bash
# 0. Prerequisites
export GOOGLE_API_KEY="your-vertex-ai-key"
cat ~/.config/opencode/config.json  # Verify provider=google

# Install wrapper (one-time)
cp factory_wrapper.sh /usr/local/bin/factory && chmod +x /usr/local/bin/factory

# 1. Build Docker image (or use existing wbe7/factory:latest)
docker buildx build --platform linux/amd64 -t wbe7/factory:latest .

# 2. Test NEW_PROJECT scenario
rm -rf /tmp/factory-test-new && mkdir -p /tmp/factory-test-new
cd /tmp/factory-test-new
factory --planning-cycles 5 --log-level debug "Create a Go CLI that prints hello world with tests"
# Expected: prd.json created, tasks executed
# Success: valid JSON in ≤3 cycles

# 3. Test UPDATE_PROJECT scenario
cd /tmp/factory-test-new
factory --planning-cycles 5 "Add a --name flag to the CLI"
# Expected: Architect sees existing prd.json, adds new task

# 4. Test BROWNFIELD scenario
rm -rf /tmp/factory-test-brown && mkdir -p /tmp/factory-test-brown
cd /tmp/factory-test-brown && go mod init example.com/test
factory --planning-cycles 5 "Add a main.go that prints the current time"
# Expected: Architect analyzes go.mod, creates appropriate plan

# 5. Test RESUME scenario
# (First, interrupt a running factory with Ctrl+C during execution)
# Then run without prompt:
cd /tmp/factory-test-new
factory
# Expected: Skips planning, continues from pending tasks

# 6. Test ENV var propagation
rm -rf /tmp/factory-test-env && mkdir -p /tmp/factory-test-env
cd /tmp/factory-test-env
FACTORY_MODEL=gemini-3-pro-preview FACTORY_LOG_LEVEL=debug factory --dry-run "test"
# Expected: Logs show model=gemini-3-pro-preview, level=debug
```

> **Note:** The `factory` wrapper (`factory_wrapper.sh`) automatically handles volume mounts for `$(pwd)`, `~/.config/opencode`, and passes `GOOGLE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` to the container.

**Success Criteria:**
- [ ] NEW_PROJECT: Valid JSON in ≤5 cycles
- [ ] UPDATE_PROJECT: New tasks appended to existing prd.json
- [ ] BROWNFIELD: Architect correctly analyzes existing project structure  
- [ ] RESUME: Skips planning, continues from pending tasks
- [ ] ENV vars: All FACTORY_* and GOOGLE_API_KEY propagate correctly
- [ ] `--plan` flag: Runs planning only, creates prd.json with pending tasks
- [ ] No "Invalid JSON" errors when LLM uses Write tool
- [ ] All 82+ tests pass
- [ ] Zero type duplication warnings

### Phase 3: Project Context Enhancement 🔲

**Goal:** Give Architect agent more context about existing project.

**Deliverables:**
- [ ] Add file tree scanning (`find . -type f | head -100`)
- [ ] Inject file tree into Architect prompt
- [ ] Add existing tests discovery (look for `*_test.go`, `*.spec.ts`, etc.)
- [ ] Pass test command from prd.json to Verifier
- [ ] Improve Brownfield scenario detection:
  - Heuristics: `package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml` = real project
  - Ignore: Only dotfiles or single README = treat as new
  - Add `--force-brownfield` / `--force-new` override flags

**Verification:**
- E2E: Run on existing Go project, verify Architect sees file structure
- E2E: Run on existing Next.js project, verify test command is used
- Unit test: Brownfield detection logic with various file combinations

---

### Phase 4: Git Worktree Isolation 🔲

**Goal:** Isolate each task in a git worktree for safe execution.

**Deliverables:**
- [ ] Check if project is a git repo, init if not
- [ ] Create worktree before task: `git worktree add .factory/task-<id> HEAD`
- [ ] Execute Worker in worktree directory
- [ ] On success: `git merge --squash` + cleanup worktree
- [ ] On failure: `git worktree remove --force` (main untouched)
- [ ] Add `--no-worktree` flag for legacy behavior

> **Out of Scope (MVP)**: Git submodules, Git LFS, nested `.git` directories.

**Verification:**
- Test: Simulate worker failure, verify main branch unchanged
- Test: Simulate success, verify changes merged to main

---

### Phase 5: Universal Test Runner & Quality Gate 🔲

**Goal:** Auto-detect and run appropriate test, lint, and type-check commands for any stack.

**Deliverables:**

*Test Runner Detection:*
- [ ] Detect project type by files:
  - `go.mod` → `go test ./...`
  - `package.json` → `npm test` or `bun test`
  - `pyproject.toml` → `pytest`
  - `requirements.txt` (fallback) → `pytest` or `python -m unittest`
  - `Cargo.toml` → `cargo test`
  - `Makefile` with `test` target → `make test`
- [ ] Store detected test command in `prd.json.project.test_command`
- [ ] Use test command in Verifier instead of hardcoded `npm test`
- [ ] Add `--test-command` override flag

*Universal Quality Gate:*
- [ ] Auto-detect and run lint commands:
  - `go.mod` → `go vet ./...` or `golangci-lint run` (if available)
  - `package.json` + `eslint` → `npm run lint` or `npx eslint .`
  - `pyproject.toml` + `ruff` → `ruff check .`
  - `Cargo.toml` → `cargo clippy`
- [ ] Auto-detect and run type check:
  - `tsconfig.json` → `npx tsc --noEmit`
  - `py.typed` or `mypy.ini` → `mypy .`
- [ ] Run security scan (optional, non-blocking):
  - `package.json` → `npm audit --audit-level=high`
  - `requirements.txt` → `pip-audit` (if available)
- [ ] Store all commands in `prd.json.project.quality_gate`:
  ```json
  {
    "test_command": "go test ./...",
    "lint_command": "golangci-lint run",
    "type_check": null,
    "security_scan": null
  }
  ```
- [ ] Add `--skip-lint`, `--skip-type-check`, `--skip-security` flags
- [ ] Quality gate is **soft fail** by default (warnings, not blockers)
- [ ] Add `--strict-quality` to make lint/type errors fail verification

**Verification:**
- Test: Create Go project, verify `go test` and `go vet` detected
- Test: Create TypeScript project, verify `tsc --noEmit` detected
- Test: Python with only `requirements.txt`, verify fallback works
- Test: `--skip-lint` disables lint check

---

### Phase 6: Docker Image Optimization 🔲

**Goal:** Fix container issues and optimize image size.

> **Note**: Permission fix moved to Phase 1 (opencode non-interactive mode).

**Deliverables:**
- [ ] Upgrade Node.js to v22 LTS
- [ ] Add multi-stage build for smaller image
- [ ] Add health check script
- [ ] Optimize layer caching for faster rebuilds
- [ ] Add `FACTORY_VERSION` label to image

**Verification:**
- Verify `node --version` returns v22+
- Verify image size reduced by at least 20%
- Verify create-next-app works without permission prompts

---

### Phase 7: Install Script & Distribution 🔲

**Goal:** One-liner installation for new users.

**Deliverables:**
- [ ] Create `install.sh` script that:
  - Checks Docker is installed
  - Pulls `wbe7/factory:latest`
  - Adds alias to `~/.bashrc` or `~/.zshrc`
- [ ] Host on GitHub raw URL
- [ ] Add install command to README:
  ```bash
  curl -sL https://raw.githubusercontent.com/wbe7/factory/main/install.sh | bash
  ```
- [ ] Support `--uninstall` flag

**Verification:**
- Test on fresh Ubuntu VM
- Test on macOS

---

### Phase 8: DinD Networking Improvements 🔲

**Goal:** Reliable Docker-in-Docker networking.

**Deliverables:**
- [ ] Document networking patterns for DinD
- [ ] Add `--network host` option to wrapper
- [ ] Handle `docker-compose` networking inside Factory
- [ ] Add connection test for spawned containers

**Verification:**
- E2E: Run Factory to create Next.js + PostgreSQL app
- Verify app container can connect to pg container

---

### Phase 9: Parallel Task Execution 🔲

**Goal:** Execute independent tasks in parallel.

**Deliverables:**
- [ ] Build dependency graph from `user_stories[].dependencies`
- [ ] Identify parallelizable tasks (no shared dependencies)
- [ ] Run up to N workers in parallel (`--parallel N` flag)
- [ ] Handle merge conflicts between parallel worktrees

**Verification:**
- Test: Create PRD with 2 independent tasks, verify parallel execution
- Test: Create PRD with dependencies, verify sequential execution

---

### Phase 10: Cost Tracking & Analytics 🔲

**Goal:** Track token usage and costs per task.

**Deliverables:**
- [ ] Extract token counts from opencode responses
- [ ] Store in `prd.json.user_stories[].metrics`
- [ ] Calculate estimated cost based on model pricing
- [ ] Add `--cost-report` flag to show summary
- [ ] Optional: Send metrics to external analytics (Prometheus/Grafana)

**Verification:**
- Verify metrics are stored in prd.json
- Verify cost calculation matches manual estimation

---

### Phase 11: Live Integration Testing 🔲

**Goal:** Validate all functionality on a real server with all 4 scenarios.

**Test Environment:**
- Server: `192.168.77.66` (or dedicated test VM)
- Fresh directory per scenario
- Real LLM API calls (use cheap model for cost control)

**Test Scenarios:**

*Scenario 1: New Project (Greenfield)*
- [ ] `mkdir ~/test/greenfield && cd ~/test/greenfield`
- [ ] `factory "Create a REST API in Go with /health and /ready endpoints"`
- [ ] Verify: prd.json created, code works, tests pass
- [ ] Analyze logs for any errors or warnings

*Scenario 2: Update Existing Project*
- [ ] Use project from Scenario 1
- [ ] `factory "Add /users CRUD endpoints with in-memory storage"`
- [ ] Verify: prd.json UPDATED (not replaced), new endpoints work
- [ ] Verify: Old endpoints (/health, /ready) still work

*Scenario 3: Brownfield Project*
- [ ] `git clone https://github.com/gin-gonic/examples ~/test/brownfield`
- [ ] `cd ~/test/brownfield && factory "Add request logging middleware"`
- [ ] Verify: Architect analyzed existing structure
- [ ] Verify: prd.json created for new feature only

*Scenario 4: Resume After Interruption*
- [ ] Start factory, kill mid-task (`docker stop`)
- [ ] `factory` (no args) — should resume
- [ ] Verify: Picks up from last pending task
- [ ] Verify: No data corruption in prd.json

*Bonus: DinD Scenario*
- [ ] `factory "Create Next.js app with PostgreSQL using docker-compose"`
- [ ] Verify: docker-compose.yml created
- [ ] Verify: App container can connect to PG container

**Success Criteria:**
- ✅ All 4 scenarios complete without manual intervention
- ✅ Logs are readable and structured
- ✅ prd.json state is consistent
- ✅ No permission prompts (non-interactive mode works)
- ✅ Graceful shutdown preserves state

**Deliverables:**
- [ ] Test execution report with logs
- [ ] List of bugs found and fixed
- [ ] Performance metrics (time per scenario)
- [ ] Final walkthrough document

---

## Future Roadmap (Post-MVP)

| Feature | Priority | Description |
|---------|----------|-------------|
| Web Dashboard | Medium | Real-time status, logs, progress bar |
| Webhooks | Medium | Slack/Telegram notifications on completion |
| Multi-Model Router | Low | Different models for different agents |
| Plugin System | Low | Custom agents, custom verifiers |
| Cloud Execution | Low | Run on remote GPU servers |
