#!/bin/bash

# Define image name
IMAGE_NAME="wbe7/factory:latest"
CONTAINER_NAME="factory-$(date +%s)"

# Check if image exists locally, if not warn (or let docker pull it)
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  echo "⚠️  Image '$IMAGE_NAME' not found locally. Docker will try to pull it."
fi

# Argument Parsing for Wrapper Flags
# We intercept -d/--detach to run Docker in background
DETACH_MODE=""
if [[ "$1" == "-d" ]] || [[ "$1" == "--detach" ]]; then
    DETACH_MODE="-d"
    shift # Remove the flag so it isn't passed to the factory script
fi

# Detect if we have an interactive terminal (only if not detached)
DOCKER_INTERACTIVE=""
if [ -z "$DETACH_MODE" ] && [ -t 0 ]; then
    DOCKER_INTERACTIVE="-it"
fi

# Run Docker
# - Maps current directory PWD to /app/target_project
# - Maps ~/.config/opencode for authentication
# - Passes host OPENAI_API_KEY/ANTHROPIC_API_KEY as fallbacks
docker run $DETACH_MODE $DOCKER_INTERACTIVE --rm \
  --name "$CONTAINER_NAME" \
  -v "$(pwd)":/app/target_project \
  -v "$HOME/.config/opencode":/root/.config/opencode \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e OPENAI_API_KEY="${OPENAI_API_KEY:-}" \
  -e OPENAI_BASE_URL="${OPENAI_BASE_URL:-}" \
  -e ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}" \
  -e GOOGLE_API_KEY="${GOOGLE_API_KEY:-}" \
  -e GOOGLE_GENERATIVE_AI_API_KEY="${GOOGLE_GENERATIVE_AI_API_KEY:-${GOOGLE_API_KEY:-}}" \
  -e FACTORY_MODEL="${FACTORY_MODEL:-}" \
  -e FACTORY_TIMEOUT="${FACTORY_TIMEOUT:-}" \
  -e FACTORY_PLANNING_CYCLES="${FACTORY_PLANNING_CYCLES:-}" \
  -e FACTORY_VERIFICATION_CYCLES="${FACTORY_VERIFICATION_CYCLES:-}" \
  -e FACTORY_WORKER_ITERATIONS="${FACTORY_WORKER_ITERATIONS:-}" \
  -e FACTORY_MAX_COST="${FACTORY_MAX_COST:-}" \
  -e FACTORY_LOG_FILE="${FACTORY_LOG_FILE:-}" \
  -e FACTORY_LOG_LEVEL="${FACTORY_LOG_LEVEL:-}" \
  $IMAGE_NAME "$@"

# If detached, inform the user
if [ ! -z "$DETACH_MODE" ]; then
    echo "🏭 Factory started in background."
    echo "📝 Logs: docker logs -f $CONTAINER_NAME"
    echo "🛑 Stop: docker stop $CONTAINER_NAME"
fi