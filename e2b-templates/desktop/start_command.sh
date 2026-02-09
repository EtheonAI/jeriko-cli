#!/bin/bash

# Set display
export DISPLAY=${DISPLAY:-:99}

# Start Xvfb (virtual framebuffer)
Xvfb $DISPLAY -ac -screen 0 1280x720x24 -nolisten tcp &
sleep 2

# Start PulseAudio for audio capture
pulseaudio --start --exit-idle-time=-1 2>/dev/null || true

# Start XFCE session
startxfce4 &
sleep 3

# Start Neko WebRTC server on port 8080 (always-on, no auth for agent use)
NEKO_DESKTOP_SCREEN="1280x720@30" \
NEKO_MEMBER_PROVIDER="noauth" \
NEKO_SESSION_IMPLICIT_HOSTING="true" \
NEKO_WEBRTC_ICELITE="1" \
NEKO_WEBRTC_TCPMUX="8081" \
NEKO_SERVER_BIND=":8080" \
neko serve &

# Playwright browser controller is started lazily by agent on first browser tool call
# (port 9821 — see tools/browser_interactive.py)

# Keep running
wait
