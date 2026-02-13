#!/bin/sh
# Rubic Sandbox Runtime — Wrapper Script (Manus pattern)
# For Nuitka-compiled binary: runs the compiled start_server
# For development: runs via Python directly

SCRIPT=$(readlink -f "$0")
SCRIPT_PATH=$(dirname "$SCRIPT")

# Check if Nuitka-compiled binary exists
if [ -f "$SCRIPT_PATH/start_server.bin" ]; then
    # Nuitka compiled binary
    PYTHONHOME=/home/ubuntu/.local/share/uv/python/cpython-3.12-linux-x86_64-gnu
    export PYTHONHOME
    exec "$SCRIPT_PATH/start_server.bin" "$@"
else
    # Development mode — run via Python
    exec python3 -m sandbox_runtime.start_server "$@"
fi
