# 🏭 Factory

> **Autonomous AI Software Engineering System**

[![Tests](https://img.shields.io/badge/tests-46%20passing-brightgreen)]()
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1)]()
[![Docker](https://img.shields.io/badge/container-Docker-2496ED)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()

Factory transforms high-level prompts into fully tested, production-ready code using a secure, isolated Docker environment. Zero human intervention required.

## ✨ Features

- **Universal Stack Support** — Go, Python, Rust, Node.js, and any other tech stack
- **Self-Provisioning** — Automatically installs dependencies inside Docker
- **TDD Workflow** — Write tests first, then implement
- **Safe Execution** — All operations isolated in Docker containers
- **Atomic Tasks** — Small, testable, reversible units of work
- **Self-Healing** — Automatic retry loops with feedback incorporation

---

## 📋 Prerequisites

- **Docker** — [Install Docker](https://docs.docker.com/get-docker/)
- **Git** — For cloning the repository
- **OpenCode API key** — Configure in `~/.config/opencode/`

---

## 🚀 Quick Start

```bash
# 1. Clone the repository and install wrapper
git clone https://github.com/wbe7/factory.git
cd factory
chmod +x factory_wrapper.sh
sudo ln -s $(pwd)/factory_wrapper.sh /usr/local/bin/factory

# 2. Run Factory from any project directory
mkdir ~/my-app && cd ~/my-app
factory "Create a REST API in Go with health endpoint"
```

> **Note:** The wrapper handles Docker volume mounts automatically. See [Docker section](#-docker) for manual `docker run` usage.

---

## 🧠 How It Works

Factory operates in two phases, orchestrated by `factory.ts`:

```
┌─────────────────────────────────────────────────────────┐
│                    PLANNING LOOP                        │
│  ┌──────────┐    ┌────────┐    ┌──────────┐             │
│  │ Architect│───▶│prd.json│◀───│  Critic  │             │
│  └──────────┘    └────────┘    └──────────┘             │
│       │              │              │                   │
│       └──────────────┼──────────────┘                   │
│                      ▼                                  │
│               NO_CRITICAL_ISSUES?                       │
└─────────────────────────────────────────────────────────┘
                       │ Yes
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   EXECUTION LOOP                        │
│  ┌────────┐    ┌─────────────┐    ┌──────────┐          │
│  │prd.json│───▶│   Worker    │───▶│ Verifier │          │
│  │ (task) │    │(Native Loop)│    │          │          │
│  └────────┘    └─────────────┘    └──────────┘          │
│                      │                │                 │
│                      ▼                ▼                 │
│              VERIFICATION_PASSED? ────▶ Next Task       │
│                      │ No                               │
│                      ▼                                  │
│              Inject Feedback, Retry                     │
└─────────────────────────────────────────────────────────┘
```

### Agent Roles

| Agent | Phase | Responsibility |
|-------|-------|----------------|
| **Architect** | Planning | Create/update `prd.json` with atomic user stories |
| **Critic** | Planning | Validate plan: atomicity, coverage, testability |
| **Worker** | Execution | Implement task using TDD workflow (native loop) |
| **Verifier** | Execution | Independent QA validation |

### State Management (`prd.json`)

The `prd.json` file is the source of truth:

```json
{
  "project": {
    "name": "my-app",
    "tech_stack": ["Go", "PostgreSQL"],
    "test_command": "go test ./..."
  },
  "user_stories": [
    {
      "id": "US-001",
      "title": "Setup project structure",
      "status": "completed",
      "passes": true
    }
  ]
}
```

---

## 🚦 Usage Scenarios

Factory auto-detects the project state:

### 1. New Project (Greenfield)
```bash
mkdir my-app && cd my-app
factory "Create a Tic-Tac-Toe game in Python"
```

### 2. Update Existing Project
```bash
cd my-app
factory "Add a high score board that saves to JSON"
```

### 3. Brownfield (Legacy Code)
```bash
cd legacy-api
factory "Refactor /auth route to use JWT"
```

### 4. Resume Interrupted Session
```bash
cd my-app
factory  # No arguments = resume from last pending task
```

---

## ⚙️ Configuration

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--model <model>` | `opencode/glm-4.7-free` | LLM model |
| `--base-url <url>` | - | Custom LLM endpoint (OpenAI-compatible) |
| `--planning-cycles <n>` | `3` | Max planning iterations |
| `--verify-cycles <n>` | `3` | Max verification iterations |
| `--worker-iters <n>` | `10` | Max worker iterations per task |
| `--timeout <seconds>` | `3600` | Global timeout |
| `--max-cost <usd>` | - | Maximum cost limit |
| `--dry-run` | - | Output plan without execution |
| `--verbose` | - | Verbose logging |
| `--quiet` | - | Minimal output |
| `-h, --help` | - | Show help |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FACTORY_MODEL` | `opencode/glm-4.7-free` | LLM model |
| `FACTORY_TIMEOUT` | `3600` | Global timeout (seconds) |
| `FACTORY_PLANNING_CYCLES` | `3` | Max planning iterations |
| `FACTORY_VERIFICATION_CYCLES` | `3` | Max verification iterations |
| `FACTORY_WORKER_ITERATIONS` | `10` | Max worker iterations |
| `FACTORY_MAX_COST` | - | Maximum cost limit (USD) |
| `OPENAI_BASE_URL` | - | Custom LLM endpoint |
| `OPENAI_API_KEY` | - | API key for custom endpoint |

### Self-Hosted Models

Factory supports any OpenAI-compatible endpoint:

```bash
# Using local Ollama
export OPENAI_BASE_URL="http://localhost:11434/v1"
factory --model llama3 "Create REST API"

# Using vLLM on remote server
export OPENAI_BASE_URL="http://192.168.77.66:8000/v1"
export OPENAI_API_KEY="your-key"
factory --model nemotron-nano-30b "Add authentication"
```

---

## 🐳 Docker

### Build Locally (Multi-Arch)

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t wbe7/factory:latest \
  --push .
```

### Volume Mapping

| Host Path | Container Path | Purpose |
|-----------|----------------|---------|
| `$(pwd)` | `/app/target_project` | Your project files |
| `~/.config/opencode` | `/root/.config/opencode` | LLM authentication |
| `/var/run/docker.sock` | `/var/run/docker.sock` | Docker-in-Docker |

### Install Wrapper Script

```bash
chmod +x factory_wrapper.sh
sudo ln -s $(pwd)/factory_wrapper.sh /usr/local/bin/factory
```

---

## 📚 Documentation

For detailed architecture and development guides:

| Document | Description |
|----------|-------------|
| [GEMINI.md](.gemini/GEMINI.md) | Development rules and protocols |
| [ARCHITECTURE.md](.gemini/docs/ARCHITECTURE.md) | System design and components |
| [ROADMAP.md](.gemini/docs/ROADMAP.md) | Project phases and status |
| [Walkthroughs](.gemini/walkthroughs/) | Completed phase documentation |

---

## 🧪 Testing

```bash
# Run all tests
bun test

# Expected output
# 46 pass, 0 fail
```

---

## 📄 License

MIT © 2024
