#!/bin/bash
# Using pipe without --no-stream because --no-stream seems to break CLI in this env
cat "$1" | opencode run -m "$2"