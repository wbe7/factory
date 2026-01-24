.PHONY: test lint type-check build clean help

# Default target
help:
	@echo "Factory - Autonomous AI Software Engineering System"
	@echo ""
	@echo "Available targets:"
	@echo "  make test        - Run all tests"
	@echo "  make lint        - Run TypeScript type checking"
	@echo "  make type-check  - Run TypeScript type checking (alias)"
	@echo "  make build       - Build production bundle"
	@echo "  make clean       - Clean build artifacts"
	@echo "  make help        - Show this help"

# Run all tests
test:
	bun test

# Run TypeScript type checking (Bun doesn't have a built-in linter, using tsc for type checking)
lint:
	bunx tsc --noEmit --skipLibCheck

# Alias for lint
type-check: lint

# Build production bundle
build:
	bun build factory.ts --outdir=dist --target=bun

# Clean build artifacts (does not remove log files as path is configurable)
clean:
	rm -rf dist

# Test Docker ENV var propagation
.PHONY: docker-test-env
docker-test-env:
	@echo "Testing FACTORY_MODEL env var propagation in Docker..."
	@docker run --rm \
		-e FACTORY_MODEL=test-model \
		-e FACTORY_LOG_LEVEL=debug \
		wbe7/factory:latest \
		--dry-run "Test ENV vars" 2>&1 | grep -q 'test-model' && \
		echo "✅ ENV vars working" || \
		(echo "❌ ENV vars not propagated"; exit 1)
