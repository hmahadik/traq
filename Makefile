# Traq - Activity Tracker v2
# Go + Wails + React/TypeScript

.PHONY: build dev clean test install-deps test-e2e test-e2e-ui

# Default target
all: build

# Build production binary
# Note: webkit2_41 tag required for Ubuntu 24.04+ (uses libwebkit2gtk-4.1)
build:
	wails build -tags webkit2_41

# Build without webkit2_41 (for older systems with libwebkit2gtk-4.0)
build-legacy:
	wails build

# Run in development mode with hot reload
dev:
	wails dev -tags webkit2_41

# Development mode for older systems
dev-legacy:
	wails dev

# Generate Go bindings for frontend
bindings:
	wails generate module

# Run Go tests
test:
	go test ./...

# Run Go tests with coverage
test-coverage:
	go test ./... -coverprofile=coverage.out
	go tool cover -html=coverage.out -o coverage.html

# Run frontend tests
test-frontend:
	cd frontend && npm test

# Run E2E tests (requires dev server running or will start one)
test-e2e:
	cd frontend && npm run test:e2e

# Run E2E tests with UI
test-e2e-ui:
	cd frontend && npm run test:e2e:ui

# Install frontend dependencies
install-frontend:
	cd frontend && npm install

# Install all dependencies
install-deps: install-frontend
	go mod download

# Clean build artifacts
clean:
	rm -rf build/bin/*
	rm -f coverage.out coverage.html

# Format code
fmt:
	go fmt ./...
	cd frontend && npm run format 2>/dev/null || true

# Lint code
lint:
	go vet ./...

# Show help
help:
	@echo "Traq - Activity Tracker v2"
	@echo ""
	@echo "Usage:"
	@echo "  make build          Build production binary (Ubuntu 24.04+)"
	@echo "  make build-legacy   Build for older systems (webkit2gtk-4.0)"
	@echo "  make dev            Run in development mode with hot reload"
	@echo "  make test           Run Go tests"
	@echo "  make test-coverage  Run tests with coverage report"
	@echo "  make test-frontend  Run frontend tests"
	@echo "  make test-e2e       Run E2E tests with Playwright"
	@echo "  make test-e2e-ui    Run E2E tests with Playwright UI"
	@echo "  make install-deps   Install all dependencies"
	@echo "  make clean          Remove build artifacts"
	@echo "  make help           Show this help message"
