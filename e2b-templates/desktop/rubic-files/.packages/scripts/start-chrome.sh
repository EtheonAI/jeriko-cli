#!/bin/bash

export HOME=/home/ubuntu
source ~/.bashrc
export DISPLAY=:0
export QT_QPA_PLATFORM=wayland
export QT_WAYLAND_DISABLE_WINDOWDECORATION=1

EXTENSION_HOME=/opt/.rubic/.packages/chrome-extensions
# EXTENSION_HOME=/home/ubuntu/extensions/

EXTENSIONS=${EXTENSION_HOME}/ublock-lite,${EXTENSION_HOME}/rubic-helper

# Ensure download dir and profile Preferences are configured
DOWNLOAD_DIR=/home/ubuntu/Downloads
PROFILE_DIR=/home/ubuntu/.browser_data_dir/Default
mkdir -p "$DOWNLOAD_DIR" "$PROFILE_DIR"
python3 - <<'PY'
import json, os
pref_path = "/home/ubuntu/.browser_data_dir/Default/Preferences"
os.makedirs(os.path.dirname(pref_path), exist_ok=True)
try:
    data = {}
    if os.path.exists(pref_path):
        with open(pref_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    data.setdefault('download', {})
    data['download']['default_directory'] = "/home/ubuntu/Downloads"
    data['download']['prompt_for_download'] = False
    data['download']['directory_upgrade'] = True
    with open(pref_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
except Exception as e:
    print(f"[warn] failed to prepare Preferences: {e}")
PY

# Enforce download directory via Chromium managed policy (system-wide)
sudo mkdir -p /etc/chromium/policies/managed
sudo tee /etc/chromium/policies/managed/rubic-downloads.json >/dev/null <<'JSON'
{
  "DownloadDirectory": "/home/ubuntu/Downloads",
  "PromptForDownload": false
}
JSON

chromium-browser \
    --disable-features=HighEfficiencyModeAvailable,HighEfficiencyModeToggle,DestroyProfileOnBrowserClose,Translate,PaintHolding,AcceptCHFrame \
    --disable-permission-action-reporting \
    --disable-field-trial-config \
    --disable-background-networking \
    --enable-features=NetworkService,NetworkServiceInProcess \
    --disable-background-timer-throttling \
    --disable-backgrounding-occluded-windows \
    --disable-breakpad \
    --no-default-browser-check \
    --disable-dev-shm-usage \
    --disable-hang-monitor \
    --disable-prompt-on-repost \
    --disable-renderer-backgrounding \
    --force-color-profile=srgb \
    --no-first-run \
    --password-store=basic \
    --use-mock-keychain \
    --no-service-autorun \
    --export-tagged-pdf \
    --disable-search-engine-choice-screen \
    --mute-audio \
    --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 \
    --use-angle=swiftshader-webgl \
    --ozone-override-screen-size=1280,1029 \
    --noerrdialogs \
    --window-size=1280,1029 \
    --window-position=0,0 \
    --lang=en-US \
    --num-raster-threads=4 \
    --remote-debugging-port=9222 \
    --load-extension="${EXTENSIONS}" \
    --user-data-dir=/home/ubuntu/.browser_data_dir \
    --download-default-directory=/home/ubuntu/Downloads
# backup
    # --no-sandbox \
    # --disable-blink-features=AutomationControlled \
    # --disable-popup-blocking \
    # --disable-component-update \
    # --disable-default-apps \
    # --disable-client-side-phishing-detection \
    # --disable-component-extensions-with-background-pages \
    # --allow-pre-commit-input \
    # --disable-ipc-flooding-protection \
    # --metrics-recording-only \
    # --disable-back-forward-cache \
    # --disable-features=HighEfficiencyModeAvailable,HighEfficiencyModeToggle,ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,DialMediaRouteProvider,AcceptCHFrame,AutoExpandDetailsElement,CertificateTransparencyComponentUpdater,AvoidUnnecessaryBeforeUnloadCheckSync,Translate,HttpsUpgrades,PaintHolding \
    # --disable-gpu \

# Note: Some option explanations
# --no-sandbox: https://monica.im/share/chat?shareId=9tEuQz3WEpfzvN4Z&copied=1

# Some removed options that would show security warnings; not added without clear benefits
# --disable-blink-features=AutomationControlled \
# --enable-automation \

# Multiple extensions can be loaded separated by commas
# --load-extension="/path/to/a,/path/to/b"
