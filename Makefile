
# Makefile for common Docker commands

# Variables
IMAGE_NAME = iowoi/jules-master
TAG = latest

.PHONY: build

# Build the production Docker image
build:
	docker build -t $(IMAGE_NAME):$(TAG) .

# Build the production Docker image for a specific platform (e.g., make build-platform PLATFORM=linux/amd64)
build-platform:
	docker build --platform=$(PLATFORM) -t $(IMAGE_NAME):$(TAG) .

# Run the production container (maps port 9123 on host to 9002 in container)
run:
	docker run -p 9123:9002 --env-file .env -v ./data:/app/data $(IMAGE_NAME):$(TAG)

# Start development environment
dev:
	docker-compose up dev

# Stop development environment
down:
	docker-compose down

# Clean up dangling images and volumes
clean:
	docker-compose down -v --remove-orphans
	docker image prune -f

# Default command
all: build
