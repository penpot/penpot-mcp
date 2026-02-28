IMAGE_NAME  ?= penpot-mcp
IMAGE_TAG   ?= latest

# WebSocket URL baked into the plugin bundle at build time.
# Override for remote deployments: make build PENPOT_MCP_SERVER_ADDRESS=myserver.example.com
PENPOT_MCP_SERVER_ADDRESS   ?= localhost
PENPOT_MCP_WEBSOCKET_PORT   ?= 4402

.PHONY: build up down logs ps clean

## Build the Docker image
build:
	docker build \
		--build-arg PENPOT_MCP_SERVER_ADDRESS=$(PENPOT_MCP_SERVER_ADDRESS) \
		--build-arg PENPOT_MCP_WEBSOCKET_PORT=$(PENPOT_MCP_WEBSOCKET_PORT) \
		-t $(IMAGE_NAME):$(IMAGE_TAG) \
		.

## Start services with docker compose (builds image if needed)
up:
	docker compose up -d

## Stop and remove containers
down:
	docker compose down

## Follow live logs
logs:
	docker compose logs -f

## Show running containers
ps:
	docker compose ps

## Remove containers, volumes, and the local image
clean:
	docker compose down -v
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) 2>/dev/null || true