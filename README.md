# AI Software Factory v4

An autonomous, self-provisioning software engineering system. It turns high-level prompts into fully tested, production-ready code (or research/infrastructure) using a secure, isolated Docker environment.

## 🧠 Deep Dive: How It Works & Logic

This section details the internal state machine and agentic loops. **Read this to understand the system's brain.**

### 1. State Management (`prd.json`)
The core source of truth is the `prd.json` file in the project root. It persists across sessions.
*   **Structure:** Contains Project Metadata (Tech Stack) and a list of **User Stories**.
*   **Status Flow:** Each User Story transitions: `pending` -> `implementation` -> `verification` -> `completed`.
*   **Resume Logic:** When the Factory starts without a prompt, it reads `prd.json` and finds the first non-completed task to resume work.

### 2. Phase 1: The Planning Loop
Before any code is written, the system must agree on a plan.
*   **Input:** User Prompt + Existing Project State (File structure, existing `prd.json`).
*   **Architect Agent:**
    *   Analyzes the request.
    *   Generates or Updates `prd.json`.
    *   **Crucial Rule:** Breaks large features into *atomic* tasks (e.g., "Setup Init", "Add Handler", "Add Middleware", "Add Frontend Component"). Small tasks = higher success rate.
*   **Critic Agent:**
    *   Reads the proposed `prd.json`.
    *   Checks for: Logical gaps, dangerous operations, non-atomic tasks, missing acceptance criteria.
    *   **Feedback:** If issues found, returns specific critique.
*   **Loop:** *Architect -> Critic -> Architect* repeats (up to `PLANNING_CYCLES`) until the Critic returns `NO_CRITICAL_ISSUES`.

### 3. Phase 2: The Execution Loop
The system iterates through the `prd.json` tasks sequentially.

#### A. The Worker (Ralph)
The "Hands" of the system.
*   **Role:** Solves the current Task ID.
*   **Self-Provisioning:** The Docker container runs as `root`. The Worker determines what tools are needed and installs them.
    *   *Need Go?* `apt install golang`
    *   *Need React?* `npm install -g create-react-app`
    *   *Need to debug network?* `apt install curl net-tools`
*   **TDD Workflow:**
    1.  **Analyze:** Reads the Task Description and Acceptance Criteria.
    2.  **Test:** Writes a reproduction script or unit test that *fails* (Red).
    3.  **Implement:** Writes the implementation code.
    4.  **Verify:** Runs the test until it *passes* (Green).
*   **Internal Loop:** The Worker runs in its own "Ralph Loop" (up to `RALPH_ITERATIONS`), trying different solutions if tests fail.

#### B. The Verifier
The "Quality Assurance" Gate.
*   **Role:** Independent validation of the Worker's output.
*   **Action:**
    *   Reads the Task Criteria.
    *   Executes the tests created by the Worker (or creates its own verification steps).
    *   Checks file existence, syntax validity, and logical correctness.
*   **Decision:**
    *   **PASS:** Updates `prd.json` task status to `completed`.
    *   **FAIL:** Returns detailed feedback to the Worker. The Worker then restarts its loop with this feedback injected.

---

## 🛠️ Installation & Setup

### 1. Build or Pull Image
The factory runs in a container.
```bash
# Pull from registry (if available)
docker pull wbe7/factory:latest

# OR Build locally
cd gemini/factory
docker build -t wbe7/factory:latest .
```

### 2. Configure Authentication
The factory uses **OpenCode** configuration.
```bash
# Ensure you have your keys (OpenAI/Anthropic) in your local config
mkdir -p ~/.config/opencode
# The wrapper automatically mounts this directory!
```

### 3. Install Wrapper (Recommended)
This script allows you to run `factory` from any directory.
```bash
chmod +x factory_wrapper.sh
sudo ln -s $(pwd)/factory_wrapper.sh /usr/local/bin/factory
```

---

## 🚦 Usage Scenarios

The Factory automatically detects the state of the directory to choose the right strategy.

### Scenario 1: New Project (Greenfield)
**State:** Empty Directory.
**Action:** Architect creates new `prd.json`. Worker implements from scratch.

```bash
mkdir my-app && cd my-app
factory "Create a Tic-Tac-Toe game in Python"
```

### Scenario 2: Continue Work (Update)
**State:** Existing `prd.json`.
**Action:** Architect *appends* to `prd.json`. Critic checks integration. Worker executes new tasks.

```bash
cd my-app
factory "Add a high score board that saves to JSON"
```

### Scenario 3: Brownfield Project
**State:** Existing Files, NO `prd.json`.
**Action:** Architect analyzes files, reverse-engineers a `prd.json` state, and plans the new request.

```bash
cd legacy-api
factory "Refactor /auth route to use JWT"
```

### Scenario 4: Resume Interrupted Session
**State:** `prd.json` has `pending` tasks.
**Action:** Resumes immediately from the first pending task.

```bash
cd my-app
factory
# (No arguments = Resume mode)
```

---

## 🏃 Background Execution

For long-running tasks, use the `-d` (detach) flag. The wrapper handles the Docker arguments for you.

```bash
# Start in background
factory -d "Research and document top 5 vector databases"

# Output will be:
# 🏭 Factory started in background.
# 📝 Logs: docker logs -f factory-1737389123
# 🛑 Stop: docker stop factory-1737389123
```

## 🔧 Advanced Configuration

**Environment Variables:**
Pass these to the `docker run` command (via the wrapper) if you don't use `~/.config/opencode`.
*   `OPENAI_API_KEY`
*   `ANTHROPIC_API_KEY`
*   `GITHUB_TOKEN` (for cloning private repos)

**Docker Volume Mapping:**
By default, the wrapper maps:
*   `$(pwd)` -> `/app/target_project` (Your code)
*   `~/.config/opencode` -> `/root/.config/opencode` (Your auth)
