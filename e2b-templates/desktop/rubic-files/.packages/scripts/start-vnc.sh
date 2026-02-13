#!/bin/bash
set -euo pipefail

# Ensure x11vnc is running on :0 and expose websocket on 5901
if ! pgrep -f "x11vnc -display :0" >/dev/null 2>&1; then
	echo "x11vnc not running; supervisor should manage it"
fi

exec websockify --web=/opt/.rubic/.packages/chrome-extensions/rubic-helper 5901 localhost:5900



