"""Text editor tool — Manus parity.

POST /text_editor with commands:
  view, create, str_replace, insert, undo_edit, find, find_file, multi_edit
"""

import os
import subprocess
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("text_editor")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")

# Undo backup storage: path -> previous content
_edit_backups: dict[str, str] = {}


def _resolve(path: str) -> str:
    if path.startswith("~"):
        path = os.path.expanduser(path)
    if not os.path.isabs(path):
        path = os.path.join(HOME, path)
    return os.path.realpath(path)


@router.post("/text_editor")
async def text_editor(request: Request) -> dict[str, Any]:
    body = await request.json()
    command = body.get("command", "")
    path = body.get("path", "") or body.get("file_path", "")
    abs_path = _resolve(path) if path else ""

    if command == "view":
        if not abs_path:
            return {"error": "path is required"}
        if not os.path.exists(abs_path):
            return {"error": f"File not found: {path}"}
        try:
            content = Path(abs_path).read_text(errors="replace")
            lines = content.split("\n")
            view_range = body.get("view_range")
            if view_range and len(view_range) == 2:
                start, end = view_range
                # Convert to 0-indexed
                start = max(0, start - 1)
                end = min(len(lines), end)
                selected = lines[start:end]
                numbered = "\n".join(
                    f"{i + start + 1:6d}\t{line}"
                    for i, line in enumerate(selected)
                )
                return {
                    "content": numbered,
                    "totalLines": len(lines),
                    "viewRange": [start + 1, end],
                }
            # Full file with line numbers
            numbered = "\n".join(
                f"{i + 1:6d}\t{line}" for i, line in enumerate(lines)
            )
            return {"content": numbered, "totalLines": len(lines)}
        except Exception as e:
            return {"error": str(e)}

    elif command == "create":
        if not abs_path:
            return {"error": "path is required"}
        content = body.get("content", body.get("file_text", ""))
        try:
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            Path(abs_path).write_text(content)
            return {"ok": True, "path": abs_path, "size": len(content)}
        except Exception as e:
            return {"error": str(e)}

    elif command == "str_replace":
        if not abs_path:
            return {"error": "path is required"}
        old_str = body.get("old_str", "")
        new_str = body.get("new_str", "")
        if not old_str:
            return {"error": "old_str is required"}
        if not os.path.exists(abs_path):
            return {"error": f"File not found: {path}"}
        try:
            content = Path(abs_path).read_text()
            if old_str not in content:
                return {"error": "old_str not found in file", "old_str": old_str}
            count = content.count(old_str)
            if count > 1:
                return {
                    "error": f"old_str found {count} times. Must be unique.",
                    "occurrences": count,
                }
            # Save backup
            _edit_backups[abs_path] = content
            new_content = content.replace(old_str, new_str, 1)
            Path(abs_path).write_text(new_content)
            return {"ok": True, "path": abs_path, "replacements": 1}
        except Exception as e:
            return {"error": str(e)}

    elif command == "insert":
        if not abs_path:
            return {"error": "path is required"}
        insert_line = body.get("insert_line")
        new_str = body.get("new_str", "")
        if insert_line is None:
            return {"error": "insert_line is required"}
        if not os.path.exists(abs_path):
            return {"error": f"File not found: {path}"}
        try:
            content = Path(abs_path).read_text()
            _edit_backups[abs_path] = content
            lines = content.split("\n")
            idx = max(0, min(insert_line, len(lines)))
            lines.insert(idx, new_str)
            Path(abs_path).write_text("\n".join(lines))
            return {"ok": True, "path": abs_path, "insertedAt": idx}
        except Exception as e:
            return {"error": str(e)}

    elif command == "undo_edit":
        if not abs_path:
            return {"error": "path is required"}
        if abs_path not in _edit_backups:
            return {"error": "No edit history for this file"}
        try:
            Path(abs_path).write_text(_edit_backups[abs_path])
            del _edit_backups[abs_path]
            return {"ok": True, "path": abs_path, "restored": True}
        except Exception as e:
            return {"error": str(e)}

    elif command == "find":
        # grep-like search
        regex = body.get("regex", "")
        target_path = abs_path or HOME
        if not regex:
            return {"error": "regex is required"}
        try:
            result = subprocess.run(
                ["grep", "-rn", "--include=*", regex, target_path],
                capture_output=True, text=True, timeout=15,
            )
            lines = result.stdout.strip().split("\n") if result.stdout.strip() else []
            truncated = len(lines) > 200
            if truncated:
                lines = lines[:200]
            return {
                "matches": lines,
                "totalMatches": len(lines),
                "truncated": truncated,
            }
        except subprocess.TimeoutExpired:
            return {"error": "Search timed out"}
        except Exception as e:
            return {"error": str(e)}

    elif command == "find_file":
        glob_pattern = body.get("glob") or body.get("glob_pattern", "*")
        target_path = abs_path or HOME
        try:
            result = subprocess.run(
                ["find", target_path, "-name", glob_pattern, "-type", "f"],
                capture_output=True, text=True, timeout=15,
            )
            files = [f for f in result.stdout.strip().split("\n") if f]
            truncated = len(files) > 200
            if truncated:
                files = files[:200]
            return {
                "files": files,
                "totalFiles": len(files),
                "truncated": truncated,
            }
        except subprocess.TimeoutExpired:
            return {"error": "Search timed out"}
        except Exception as e:
            return {"error": str(e)}

    elif command == "multi_edit":
        edits = body.get("edits", [])
        if not edits:
            return {"error": "edits array is required and must not be empty"}
        if not abs_path or not os.path.exists(abs_path):
            return {"error": f"File not found: {path}"}
        try:
            content = Path(abs_path).read_text()
            _edit_backups[abs_path] = content
            results = []
            for i, edit in enumerate(edits):
                old_s = edit.get("old_str", "")
                new_s = edit.get("new_str", "")
                if not old_s:
                    # Rollback
                    Path(abs_path).write_text(_edit_backups[abs_path])
                    return {
                        "error": f"Edit {i}: old_str is required",
                        "appliedBefore": i,
                        "rolledBack": True,
                    }
                if old_s not in content:
                    # Rollback
                    Path(abs_path).write_text(_edit_backups[abs_path])
                    return {
                        "error": f"Edit {i}: old_str not found in file",
                        "old_str": old_s,
                        "appliedBefore": i,
                        "rolledBack": True,
                    }
                content = content.replace(old_s, new_s, 1)
                results.append({"index": i, "ok": True})
            Path(abs_path).write_text(content)
            return {"ok": True, "editsApplied": len(results), "results": results}
        except Exception as e:
            return {"error": str(e)}

    else:
        return {"error": f"Unknown command: {command}"}
