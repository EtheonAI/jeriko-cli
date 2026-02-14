#!/bin/bash
# Rubic Sandbox Environment Setup — port assignments for internal processes
# NOTE: SANDBOX_SERVER_PORT is used by start_server.py for the EXTERNAL port.
# Do NOT set SANDBOX_SERVER_PORT here — it defaults to 8330 in start_server.py.
export SANDBOX_INTERNAL_PORT=9330
export SANDBOX_EXTERNAL_PORT=8330
export UPGRADE_SERVICE_PORT=8340
export MCP_SERVER_PORT=8350
