"""File operations — Manus parity.

Provides: POST /file/* with commands:
  read, write, upload, batch_read, exists, list_dir, info, mkdir
"""

import os
import subprocess
import stat as stat_module
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("files")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")
MAX_READ_SIZE = 10 * 1024 * 1024  # 10MB


def _resolve_path(path: str) -> str:
    """Resolve ~ and relative paths."""
    if path.startswith("~"):
        path = os.path.expanduser(path)
    if not os.path.isabs(path):
        path = os.path.join(HOME, path)
    return os.path.realpath(path)


@router.post("/file/{command}")
async def file_handler(command: str, request: Request) -> dict[str, Any]:
    body = await request.json() if request.headers.get("content-type", "").startswith("application/json") else {}
    path = body.get("path", "")
    abs_path = _resolve_path(path) if path else ""

    if command == "read":
        if not abs_path:
            return {"error": "path is required"}
        if not os.path.exists(abs_path):
            return {"error": f"File not found: {path}"}
        try:
            size = os.path.getsize(abs_path)
            if size > MAX_READ_SIZE:
                return {"error": f"File too large: {size} bytes (max {MAX_READ_SIZE})"}
            encoding = body.get("encoding", "utf-8")
            content = Path(abs_path).read_text(encoding=encoding)
            return {"content": content, "size": size, "path": abs_path}
        except UnicodeDecodeError:
            # Binary file — return base64
            import base64
            data = Path(abs_path).read_bytes()
            return {
                "content": base64.b64encode(data).decode("ascii"),
                "encoding": "base64",
                "size": len(data),
                "path": abs_path,
            }
        except Exception as e:
            return {"error": str(e)}

    elif command == "write":
        if not abs_path:
            return {"error": "path is required"}
        content = body.get("content", "")
        append = body.get("append", False)
        leading_newline = body.get("leading_newline", False)
        trailing_newline = body.get("trailing_newline", True)

        # Build content
        text = ""
        if leading_newline:
            text += "\n"
        text += content
        if trailing_newline and not text.endswith("\n"):
            text += "\n"

        try:
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            mode = "a" if append else "w"
            encoding = body.get("encoding", "utf-8")
            with open(abs_path, mode, encoding=encoding) as f:
                f.write(text)
            return {"ok": True, "path": abs_path, "size": os.path.getsize(abs_path)}
        except Exception as e:
            return {"error": str(e)}

    elif command == "upload":
        file_path = body.get("file_path") or body.get("path", "")
        abs_file = _resolve_path(file_path)
        if not os.path.exists(abs_file):
            return {"error": f"File not found: {file_path}"}
        try:
            result = subprocess.run(
                ["rubic-upload-file", abs_file],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                return {"ok": True, "url": result.stdout.strip(), "path": abs_file}
            return {"error": result.stderr.strip() or "Upload failed"}
        except subprocess.TimeoutExpired:
            return {"error": "Upload timed out"}
        except Exception as e:
            return {"error": str(e)}

    elif command == "batch_read":
        file_paths = body.get("file_paths") or body.get("paths", [])
        if not file_paths:
            return {"error": "file_paths is required"}
        results = {}
        for fp in file_paths[:20]:  # Max 20 files
            afp = _resolve_path(fp)
            try:
                if os.path.exists(afp):
                    size = os.path.getsize(afp)
                    if size <= MAX_READ_SIZE:
                        results[fp] = {
                            "content": Path(afp).read_text(errors="replace"),
                            "size": size,
                        }
                    else:
                        results[fp] = {"error": f"Too large: {size} bytes"}
                else:
                    results[fp] = {"error": "Not found"}
            except Exception as e:
                results[fp] = {"error": str(e)}
        return {"results": results}

    elif command == "exists":
        if not abs_path:
            return {"error": "path is required"}
        exists = os.path.exists(abs_path)
        is_file = os.path.isfile(abs_path) if exists else False
        is_dir = os.path.isdir(abs_path) if exists else False
        return {"exists": exists, "isFile": is_file, "isDirectory": is_dir, "path": abs_path}

    elif command == "list_dir":
        target = abs_path or HOME
        if not os.path.isdir(target):
            return {"error": f"Not a directory: {path}"}
        try:
            entries = []
            for entry in sorted(os.listdir(target)):
                full = os.path.join(target, entry)
                try:
                    s = os.stat(full)
                    entries.append({
                        "name": entry,
                        "type": "directory" if stat_module.S_ISDIR(s.st_mode) else "file",
                        "size": s.st_size,
                        "modified": s.st_mtime,
                    })
                except OSError:
                    entries.append({"name": entry, "type": "unknown"})
            return {"entries": entries, "path": target}
        except Exception as e:
            return {"error": str(e)}

    elif command == "info":
        if not abs_path:
            return {"error": "path is required"}
        if not os.path.exists(abs_path):
            return {"error": f"Not found: {path}"}
        try:
            s = os.stat(abs_path)
            return {
                "path": abs_path,
                "size": s.st_size,
                "type": "directory" if stat_module.S_ISDIR(s.st_mode) else "file",
                "modified": s.st_mtime,
                "created": s.st_ctime,
                "permissions": oct(s.st_mode),
            }
        except Exception as e:
            return {"error": str(e)}

    elif command == "mkdir":
        if not abs_path:
            return {"error": "path is required"}
        try:
            os.makedirs(abs_path, exist_ok=True)
            return {"ok": True, "path": abs_path}
        except Exception as e:
            return {"error": str(e)}

    else:
        return {"error": f"Unknown file command: {command}"}
