# Base on latest Ubuntu for maximum compatibility and package availability
FROM ubuntu:24.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install essential bootstrapping tools and common utilities
# Pre-installed to avoid runtime downloads by the Agent
RUN apt-get update && apt-get install -y \
    # Core tools
    curl \
    wget \
    git \
    unzip \
    zip \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    # Node.js (for npm packages)
    nodejs \
    npm \
    # Docker CLI (for container management)
    docker.io \
    # Network utilities
    net-tools \
    iproute2 \
    dnsutils \
    iputils-ping \
    netcat-openbsd \
    # System utilities
    procps \
    htop \
    jq \
    make \
    sudo \
    vim-tiny \
    less \
    && rm -rf /var/lib/apt/lists/*

# Install Bun (for running the factory script itself)
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="$BUN_INSTALL/bin:$PATH"

# Install Factory Dependencies globally
# - opencode-ai: The LLM interface
RUN bun install -g opencode-ai opencode-gemini-auth

# Set working directory
WORKDIR /app

# Copy Factory Core
COPY factory.ts .
COPY src/ ./src/
COPY prompts/ ./prompts/

# Copy opencode config for non-interactive mode
RUN mkdir -p /root/.config/opencode
COPY opencode.config.json /root/.config/opencode/config.json

# Ensure executable permissions
RUN chmod +x factory.ts

# Define volume for the generated project
# Users should mount their host directory here to persist files
VOLUME /app/target_project

# Entrypoint runs the factory
# Arguments passed to "docker run" after the image name will be passed to this script
ENTRYPOINT ["bun", "factory.ts"]
