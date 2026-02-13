#!/bin/bash

# Wait for sandbox-runtime health check to pass
while ! curl -s http://localhost:8330/healthz -o /dev/null -w "%{http_code}" | grep -q "200"; do
    echo "[chrome] Waiting for sandbox-runtime to be ready..."
    sleep 1
done

echo "sandbox-runtime is ready, starting chrome..."
# Execute the original chrome startup script
exec /opt/.rubic/.packages/scripts/start-chrome.sh