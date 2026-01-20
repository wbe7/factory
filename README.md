# AI Software Factory v3

An autonomous software development system that turns high-level prompts into fully tested, production-ready code.
The system runs in a secure, isolated Docker container where it can install any tools, languages, or frameworks it needs to accomplish the task (Self-Provisioning).

## Architecture
- **Architect**: Breaks requirements into atomic, TDD-ready tasks.
- **Worker (Ralph)**: Executes tasks (coding, research, ops) in an infinite loop until verification passes.
- **Orchestrator**: Manages the state and flow between agents.

## 🚀 Docker Usage (Recommended)

Run the factory in an isolated environment. The container runs as root, allowing the agent to install **any** dependency it needs.

### 1. Build the Image
```bash
cd gemini/factory
docker build -t ai-factory .
```

### 2. Convenient Setup (Recommended)
Create a symlink or alias to run the factory from anywhere in your terminal.

**Option A: Symlink (Global command)**
```bash
# Make the wrapper executable and link it
chmod +x $(pwd)/factory_wrapper.sh
sudo ln -s $(pwd)/factory_wrapper.sh /usr/local/bin/factory
```

**Option B: Alias (Add to .zshrc/.bashrc)**
```bash
alias factory='path/to/gemini/factory/factory_wrapper.sh'
```

### 3. Usage Examples

**New Project (Interactive)**
Go to an empty folder and start the factory.
```bash
mkdir my-app && cd my-app
factory "Create a Tic-Tac-Toe game in Python"
```

**Resume Work**
Just run it without arguments in the project folder.
```bash
cd my-app
factory
```

**Modify Existing Project**
```bash
factory "Add a dark mode toggle to the UI"
```

### 4. Background Execution
To run long tasks in the background without an interactive terminal:

```bash
# Run detached (-d) is handled by docker run, but via wrapper we need to be careful.
# The wrapper defaults to interactive. For true background execution, call docker directly or use nohup:

nohup factory "Research and document the top 5 vector database options" > factory.log 2>&1 &
```
*Note: You can follow progress with `tail -f factory.log`*

## Advanced Configuration
You can pass any environment variable needed for the tools (e.g., Context7, GitHub tokens) by adding `-e` flags to the `docker run` command inside `factory_wrapper.sh` or exporting them before running the script if they are whitelisted.

## Local Usage (Mac/Linux)
... (Manual Bun setup omitted, Docker recommended) ...

## How It Works
1.  **Planning:** The `Architect` generates a `prd.json` and a `plan.json`.
2.  **Critique:** The `Critic` reviews the plan.
3.  **Execution:** The `Factory` loops through tasks.
    *   **Worker** installs necessary tools (e.g., `apt-get install python3`, `go install ...`).
    *   **Worker** performs the task (coding, researching, etc).
    *   **Verifier** checks the work.
    *   Loop continues until success.
