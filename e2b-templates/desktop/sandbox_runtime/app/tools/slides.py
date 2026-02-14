"""Slide endpoints — Manus parity.

POST /slide/{action} with actions:
  init-project, modify, notes, present, update-state, upload-resources, upload_template_image
"""

import json
import os
import subprocess
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("slides")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")


@router.post("/slide/{action}")
async def slide_action(action: str, request: Request) -> dict[str, Any]:
    body = await request.json()
    project_path = body.get("project_path", os.path.join(HOME, "slides"))
    slides_dir = os.path.join(project_path, "slides")
    slides_json = os.path.join(slides_dir, "slides.json")

    if action == "init-project":
        # Use app_name for project path if provided
        app_name = body.get("app_name")
        if app_name:
            project_path = os.path.join(HOME, app_name)
            slides_dir = os.path.join(project_path, "slides")
            slides_json = os.path.join(slides_dir, "slides.json")
        os.makedirs(slides_dir, exist_ok=True)
        slide_title = body.get("title", "Title Slide")
        initial = [
            {
                "id": 1,
                "title": slide_title,
                "content": "Welcome",
                "notes": "",
                "background": "#ffffff",
                "order": 0,
            }
        ]
        with open(slides_json, "w") as f:
            json.dump(initial, f, indent=2)
        index_html = os.path.join(slides_dir, "index.html")
        with open(index_html, "w") as f:
            f.write(
                "<!DOCTYPE html><html><head><title>Slides</title></head>"
                "<body><div id='app'></div></body></html>"
            )
        return {"ok": True, "projectPath": project_path}

    elif action == "modify":
        try:
            with open(slides_json) as f:
                data = json.load(f)
            # Accept both slideId (Manus) and slide_id (orchestrator snake_case)
            slide_id = body.get("slideId") or body.get("slide_id")
            slide = next((s for s in data if str(s["id"]) == str(slide_id)), None)
            if slide is None:
                return {"error": f"Slide {slide_id} not found"}
            # Accept both nested changes object and flat fields
            changes = body.get("changes", {})
            if not changes:
                # Build changes from flat fields (orchestrator sends flat)
                for key in ("title", "content", "background", "order"):
                    if key in body:
                        changes[key] = body[key]
            slide.update(changes)
            with open(slides_json, "w") as f:
                json.dump(data, f, indent=2)
            return {"ok": True, "slide": slide}
        except FileNotFoundError:
            return {"error": "Slides not initialized"}

    elif action == "notes":
        try:
            with open(slides_json) as f:
                data = json.load(f)
            # Accept both slideId and slide_id
            slide_id = body.get("slideId") or body.get("slide_id")
            slide = next((s for s in data if str(s["id"]) == str(slide_id)), None)
            if slide is None:
                return {"error": f"Slide {slide_id} not found"}
            slide["notes"] = body.get("notes", "")
            with open(slides_json, "w") as f:
                json.dump(data, f, indent=2)
            return {"ok": True}
        except FileNotFoundError:
            return {"error": "Slides not initialized"}

    elif action == "present":
        return {"ok": True, "mode": "present", "url": "http://localhost:3000?mode=present"}

    elif action == "update-state":
        state_path = os.path.join(slides_dir, "state.json")
        with open(state_path, "w") as f:
            json.dump(body, f, indent=2)
        return {"ok": True}

    elif action in ("upload-resources", "upload_template_image"):
        file_path = body.get("file_path")
        if not file_path:
            return {"error": "file_path required"}
        try:
            result = subprocess.run(
                ["rubic-upload-file", file_path],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                return {"ok": True, "url": result.stdout.strip()}
            return {"ok": False, "error": result.stderr.strip()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    else:
        return {"error": f"Unknown slide action: {action}"}
