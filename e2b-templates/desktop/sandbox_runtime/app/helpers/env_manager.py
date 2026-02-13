"""Dynamic environment variable management.

Handles the 4-layer env system:
  L1: ~/.env (baked at build time)
  L2: ~/.user_env (session-level, written by orchestrator)
  L3: ~/.secrets/ (individual secret files)
  L4: process env
"""

import os
from pathlib import Path

from ..logger import get_logger

logger = get_logger("env_manager")

HOME = os.getenv("HOME", "/home/ubuntu")
USER_ENV_PATH = Path(HOME) / ".user_env"
SECRETS_DIR = Path(HOME) / ".secrets"


def load_user_env() -> dict[str, str]:
    """Load current .user_env as a dict."""
    result: dict[str, str] = {}
    if USER_ENV_PATH.exists():
        for line in USER_ENV_PATH.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                # Remove 'export ' prefix
                if line.startswith("export "):
                    line = line[7:]
                if "=" in line:
                    key, _, value = line.partition("=")
                    # Strip surrounding quotes
                    value = value.strip().strip('"').strip("'")
                    result[key.strip()] = value
    return result


def set_env_vars(env_vars: dict[str, str]) -> list[str]:
    """Write env vars to .user_env and update process env."""
    lines: list[str] = []
    if USER_ENV_PATH.exists():
        lines = [
            l for l in USER_ENV_PATH.read_text().splitlines() if l.strip()
        ]

    updated_keys: list[str] = []
    for key, value in env_vars.items():
        export_line = f'export {key}="{value}"'
        # Find and replace existing line, or append
        found = False
        for i, line in enumerate(lines):
            if line.strip().startswith(f"export {key}="):
                lines[i] = export_line
                found = True
                break
        if not found:
            lines.append(export_line)
        # Also update process env
        os.environ[key] = value
        updated_keys.append(key)

    USER_ENV_PATH.write_text("\n".join(lines) + "\n")
    return updated_keys


def write_secret(name: str, value: str) -> None:
    """Write a secret to ~/.secrets/{name} with restricted permissions."""
    SECRETS_DIR.mkdir(parents=True, exist_ok=True)
    secret_path = SECRETS_DIR / name
    secret_path.write_text(value)
    secret_path.chmod(0o600)
    # Also export in env
    os.environ[name] = value


def read_secret(name: str) -> str | None:
    """Read a secret from ~/.secrets/{name}."""
    secret_path = SECRETS_DIR / name
    if secret_path.exists():
        return secret_path.read_text().strip()
    return None
