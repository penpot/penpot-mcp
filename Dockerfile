# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests first to maximise layer-cache reuse
COPY package.json package-lock.json ./
COPY common/package.json common/package-lock.json ./common/
COPY mcp-server/package.json mcp-server/package-lock.json ./mcp-server/
COPY penpot-plugin/package.json penpot-plugin/package-lock.json ./penpot-plugin/

# Install dependencies for every component
RUN npm ci && \
    npm --prefix common install && \
    npm --prefix mcp-server install && \
    npm --prefix penpot-plugin install

# Copy all source files
COPY common/    ./common/
COPY mcp-server/ ./mcp-server/
COPY penpot-plugin/ ./penpot-plugin/

# 1. Build shared types (required by both server and plugin)
RUN npm --prefix common run build

# 2. Build MCP server (bundles common; external deps stay in node_modules)
RUN npm --prefix mcp-server run build

# 3. Build plugin – the WebSocket URL is baked into the JS bundle at this step.
#    Override PENPOT_MCP_SERVER_ADDRESS via --build-arg when the server is NOT
#    on localhost (e.g. remote deployment).
ARG PENPOT_MCP_SERVER_ADDRESS=localhost
ARG PENPOT_MCP_WEBSOCKET_PORT=4402
ENV PENPOT_MCP_SERVER_ADDRESS=${PENPOT_MCP_SERVER_ADDRESS}
ENV PENPOT_MCP_WEBSOCKET_PORT=${PENPOT_MCP_WEBSOCKET_PORT}
RUN npm --prefix penpot-plugin run build


# ─── Stage 2: Runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

# Root package (provides concurrently + resolves "penpot-mcp: file:.." symlinks)
COPY --from=builder /app/node_modules  ./node_modules
COPY --from=builder /app/package.json  ./

# common dist (resolves "@penpot-mcp/common: file:../common" symlinks in
# mcp-server and penpot-plugin node_modules at runtime)
COPY --from=builder /app/common/dist        ./common/dist
COPY --from=builder /app/common/package.json ./common/

# MCP server – bundled binary, static assets, YAML data files, runtime deps
COPY --from=builder /app/mcp-server/dist         ./mcp-server/dist
COPY --from=builder /app/mcp-server/data         ./mcp-server/data
COPY --from=builder /app/mcp-server/node_modules ./mcp-server/node_modules
COPY --from=builder /app/mcp-server/package.json ./mcp-server/

# Plugin – pre-built static files served by `vite preview`;
# vite is a devDep but is needed here to run the preview server
COPY --from=builder /app/penpot-plugin/dist         ./penpot-plugin/dist
COPY --from=builder /app/penpot-plugin/node_modules ./penpot-plugin/node_modules
COPY --from=builder /app/penpot-plugin/package.json ./penpot-plugin/
COPY --from=builder /app/penpot-plugin/vite.config.ts ./penpot-plugin/

# Bind all servers to every interface so Docker port-mapping works
ENV PENPOT_MCP_SERVER_LISTEN_ADDRESS=0.0.0.0

# 4400 – Plugin static-file server (Vite preview)
# 4401 – MCP server HTTP / Streamable-HTTP + SSE
# 4402 – WebSocket  (Penpot plugin <-> MCP server)
# 4403 – REPL       (development / debugging)
EXPOSE 4400 4401 4402 4403

# Use concurrently (already in node_modules) to run both services.
# vite preview reads vite.config.ts from --root and serves penpot-plugin/dist/.
# --host 0.0.0.0 overrides the default localhost binding.
CMD ["node_modules/.bin/concurrently", \
     "--names", "MCP-SERVER,PLUGIN-SERVER", \
     "--prefix-colors", "cyan,magenta", \
     "--kill-others-on-fail", \
     "cd /app/mcp-server && node dist/index.js", \
     "cd /app/penpot-plugin && ./node_modules/.bin/vite preview --host 0.0.0.0 --port 4400"]