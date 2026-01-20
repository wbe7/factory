#!/bin/bash

# Define image name
IMAGE_NAME="ai-factory"

# Check if image exists, if not warn user
if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
  echo "⚠️  Image '$IMAGE_NAME' not found. Please build it first:"
  echo "   docker build -t $IMAGE_NAME /path/to/gemini/factory"
  exit 1
fi

# Detect if we have an interactive terminal
if [ -t 0 ]; then
    DOCKER_FLAGS="-it"
else
    DOCKER_FLAGS=""
fi

# Run Docker
# - Maps current directory PWD to /app/target_project
# - Passes all arguments to the entrypoint
# - Passes host OPENAI_API_KEY if set
docker run --rm $DOCKER_FLAGS \
  -v "$(pwd)":/app/target_project \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  $IMAGE_NAME "$@"
