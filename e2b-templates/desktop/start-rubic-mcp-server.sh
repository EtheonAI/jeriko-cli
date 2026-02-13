#!/bin/bash
# Wait for sandbox runtime to be healthy before starting MCP server
echo "Waiting for sandbox runtime on port 8330..."
MAX_RETRIES=30
RETRY=0
while ! curl -sf http://localhost:8330/healthz > /dev/null 2>&1 && [ "$RETRY" -lt "$MAX_RETRIES" ]; do
    sleep 1
    RETRY=$((RETRY + 1))
done

if [ "$RETRY" -ge "$MAX_RETRIES" ]; then
    echo "WARNING: Sandbox runtime not ready after ${MAX_RETRIES}s"
fi

echo "Starting Rubic MCP CLI server (Go binary)..."
exec rubic-mcp-cli serve
