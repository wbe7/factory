# Base on latest Ubuntu for maximum compatibility and package availability
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential bootstrapping tools
# We keep this minimal. The Agent will install everything else (Go, Rust, Node, Python, etc.) as needed.
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    unzip \
    zip \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (for running the factory script itself)
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Install Factory Dependencies globally
# - opencode-ai: The LLM interface
# - @th0rgal/ralph-wiggum: The Coding Agent
RUN bun install -g opencode-ai @th0rgal/ralph-wiggum

# Set working directory
WORKDIR /app

# Copy Factory Core
COPY factory.ts .
COPY run_agent.sh .
COPY prompts/ ./prompts/

# Ensure executable permissions
RUN chmod +x run_agent.sh

# Define volume for the generated project
# Users should mount their host directory here to persist files
VOLUME /app/target_project

# Entrypoint runs the factory
# Arguments passed to "docker run" after the image name will be passed to this script
ENTRYPOINT ["bun", "factory.ts"]
