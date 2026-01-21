# Factory - Autonomous AI Software Engineering System (GEMINI.md)

> **CRITICAL**: This is the MASTER RULE BOOK for the `factory` project.
> **CONTEXT**: The Project Architecture is defined in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
> **PROGRESS**: The Project Roadmap and Status are defined in [docs/ROADMAP.md](docs/ROADMAP.md).
> **TIP**: Check `.gemini/walkthroughs/` for detailed context on completed phases.
> **YOU MUST READ THESE LINKED DOCUMENTS BEFORE STARTING ANY TASK.**

## 1. Project Vision

Factory is an **autonomous, self-provisioning AI software engineering system**. It transforms high-level prompts into fully tested, production-ready code using a secure, isolated Docker environment.

### Core Principles
1. **Universal**: Works with any tech stack (Go, Python, Rust, Node.js, etc.)
2. **Self-Healing**: Automatic retry loops with feedback incorporation
3. **Safe by Design**: All work happens in isolated Docker containers or git worktrees
4. **Atomic Tasks**: Every task is small, testable, and reversible

## 2. Development Strategy (Agentic Workflow)

### 2.1. AI Developer Protocol
*   **One Phase = One Chat**: Each phase starts in a clean context to avoid hallucination drift.
*   **Branching**: `git checkout -b feature/phase-N-desc`.
*   **TDD Mandatory**: Write tests -> Fail -> Write Code -> Pass.
    *   Primary: `bun test`
*   **Artifacts**: At the end of each phase, save `.gemini/walkthroughs/phaseN.md` (Proof of Work).

### 2.2. Pull Request Workflow
All changes go through `gh` CLI review.
```bash
# 1. Commit changes
git add .
git commit -m "feat(phase2): implement git worktree isolation"
git push -u origin feature/phase-2-worktree

# 2. Create PR
gh pr create --title "feat(phase2): Implement Git Worktree Isolation" --body "## Summary\n- Added worktree support\n- Added tests"

# 3. AI Review Loop (Iterative) - Use review-manager skill
python3 ~/.agent/skills/review-manager/scripts/manage_reviews.py request <PR_NUMBER>
python3 ~/.agent/skills/review-manager/scripts/manage_reviews.py wait <PR_NUMBER>  # MUST wait 3-5 min!
python3 ~/.agent/skills/review-manager/scripts/manage_reviews.py list <PR_NUMBER>
# For each finding: fix code, then resolve the thread:
python3 ~/.agent/skills/review-manager/scripts/manage_reviews.py resolve <THREAD_ID> "Fixed: <description>"
# Repeat until list returns []

# 4. Merge
gh pr merge <PR_NUMBER> --squash --delete-branch
```

> ⚠️ **CRITICAL**: Never interrupt `wait` command. Gemini reviews take 3-5 minutes. Always wait for completion before checking `list`.

### 2.3. Phase Handoff
After finishing a phase:
1.  Update `ROADMAP.md` status.
2.  Save Walkthrough.
3.  Notify user to restart chat with: "Ready for next phase."

## 3. Engineering Standards

### 3.1. Tech Stack
| Component | Technology | Notes |
|-----------|------------|-------|
| **Runtime** | Bun (TypeScript) | Fast startup, native TS support |
| **CLI Framework** | Bun native (process.argv) | Keep it simple, add Commander.js if needed |
| **LLM Interface** | opencode-ai | Supports multiple providers |
| **Worker Loop** | Native (factory.ts) | Retry loop with completion promise |
| **Container** | Docker (Ubuntu 24.04) | Self-provisioning environment |
| **Testing** | Bun test | Built-in test runner |

### 3.2. Error Handling & Logging
*   **Never** throw unhandled exceptions. Catch and handle gracefully.
*   **Logs**: Structured JSON logs with timestamp, level, message.
*   **Log File**: Always persist logs to `factory.log` in project root.

### 3.3. Security & Git Hygiene
*   **No Secrets in Git**: NEVER commit `.env` files, API keys, or credentials.
*   **Gitignore**: Ensure `.env`, `.DS_Store`, `node_modules/`, and `factory.log` are always ignored.
*   **Isolated Execution**: All potentially destructive operations run in Docker or git worktrees.

## 4. Factory Execution Model

### 4.1. Four Scenarios
| Scenario | Detection | Behavior |
|----------|-----------|----------|
| **New Project** | Empty dir, no `prd.json` | Architect creates full plan |
| **Update Project** | Existing `prd.json` | Architect appends new tasks |  
| **Brownfield** | Files exist, no `prd.json` | Architect analyzes and creates plan |
| **Resume** | `prd.json` with pending tasks | Skip planning, continue execution |

### 4.2. Agent Roles
| Agent | Responsibility | Loop |
|-------|----------------|------|
| **Architect** | Create/update `prd.json` with atomic user stories | Planning |
| **Critic** | Validate plan: atomicity, coverage, testability | Planning |
| **Worker** | Implement task using TDD workflow | Execution |
| **Verifier** | Independent QA validation | Execution |

### 4.3. Safety via Git Worktrees
```
Current Flow (Risky):
  factory "Add auth" → writes directly to ./

Safe Flow (Target):
  factory "Add auth"
    → git worktree add .factory/task-001 main
    → works in .factory/task-001/
    → if SUCCESS: git merge + cleanup
    → if FAIL: delete worktree, main untouched
```

### 4.4. Error Recovery Strategy

| Failure Type | Retry Limit | Recovery Action |
|--------------|-------------|-----------------|
| Worker iteration fail | 10 (configurable) | Retry with same prompt, AI sees previous work |
| Verification fail | 3 (configurable) | Inject feedback, Worker retries |
| Planning cycle fail | 3 (configurable) | Architect incorporates Critic feedback |
| **All retries exhausted** | - | Save state, log debug info, exit gracefully |

**On Fatal Failure:**
1. Save current `prd.json` state (mark task as `failed`)
2. Write debug info to `factory.log`
3. Cleanup any worktrees
4. Exit with non-zero code
5. User can resume with `factory` (no args) after fixing issues

## 5. Instruction for AI Developer (Agentic Protocol)

> **We are building Factory - Autonomous AI Software Engineering System**
>
> **Instruction**:
> 1. Read `.gemini/docs/ROADMAP.md` to identify the "Current Focus".
> 2. Check `.gemini/walkthroughs/` for context from previous phases.
> 3. Read `.gemini/docs/ARCHITECTURE.md` to understand the system design.
> 4. **TDD Approach**:
>    - Write tests BEFORE or WITH code.
>    - NEVER proceed to the next phase without passing tests.
> 5. **Git Workflow**:
>    - Separate branch per phase.
>    - PR Review via `gh`.
>
> **⚠️ Stop Signals**:
> STOP and ask for clarification if:
> - You need to choose between two valid approaches.
> - A library is deprecated or incompatible.
> - Tests fail after 3 attempts.
> - **You are unsure about anything.** DO NOT guess. Ask.
