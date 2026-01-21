# Factory Roadmap

## Project Status Overview

| Phase | Name | Status | Branch |
|-------|------|--------|--------|
| 0 | Bootstrap & Current State | ✅ Completed | `main` |
| 1 | CLI Refactoring & Core Loop Rewrite | ✅ Completed | `feature/phase-1-cli-refactoring` |
| 2 | Logging & Observability | 🔲 Planned | - |
| 3 | Project Context Enhancement | 🔲 Planned | - |
| 4 | Git Worktree Isolation | 🔲 Planned | - |
| 5 | Universal Test Runner & Quality Gate | 🔲 Planned | - |
| 6 | Docker Image Optimization | 🔲 Planned | - |
| 7 | Install Script & Distribution | 🔲 Planned | - |
| 8 | DinD Networking Improvements | 🔲 Planned | - |
| 9 | Parallel Task Execution | 🔲 Planned | - |
| 10 | Cost Tracking & Analytics | 🔲 Planned | - |
| 11 | Live Integration Testing | 🔲 Planned | - |

**Current Focus:** Phase 2 - Logging & Observability

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

### Phase 2: Logging & Observability 🔲

**Goal:** Structured JSON logging for debugging and analytics.

**Deliverables:**
- [ ] Create `Logger` class with levels (debug, info, warn, error)
- [ ] Log to both console and `factory.log` file
- [ ] Add timing metrics (phase duration, agent call duration)
- [ ] Log token usage (if available from opencode)
- [ ] Emit structured events for worker iterations (iteration start/end, success/failure)
- [ ] Add `--log-file` and `--log-level` flags
- [ ] Add Zod validation for LLM responses (deferred from Phase 1)
- [ ] Add parseInt/parseFloat input validation (deferred from Phase 1)
- [ ] Add task status transitions (implementation/verification) (deferred from Phase 1)

**Verification:**
- Verify `factory.log` is created and contains valid JSON
- Verify log rotation doesn't crash on large files

---

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
