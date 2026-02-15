"""Skill management endpoints — Manus parity.

POST /skills/sync-skills (or /sync-skills)
POST /skills/package-skill
"""

import os
import subprocess
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("skills")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")


@router.post("/skills/sync-skills")
@router.post("/sync-skills")
async def sync_skills(request: Request) -> dict[str, Any]:
    # Read body for optional skill_ids filter
    body: dict[str, Any] = {}
    try:
        body = await request.json()
    except Exception:
        pass
    skill_ids = body.get("skill_ids") or body.get("skillIds")
    try:
        if skill_ids and isinstance(skill_ids, list):
            # Selective sync — only copy specified skills
            for sid in skill_ids:
                safe_name = str(sid).replace("/", "").replace("..", "")
                subprocess.run(
                    f"cp -r /opt/.rubic/skills/{safe_name} {HOME}/skills/ 2>/dev/null || true",
                    shell=True, timeout=10,
                )
        else:
            # Copy all skills (including dotfiles like .skill_versions.json)
            subprocess.run(
                f"cp -r /opt/.rubic/skills/* {HOME}/skills/ 2>/dev/null || true",
                shell=True, timeout=10,
            )
            subprocess.run(
                f"cp -r /opt/.rubic/skills/.skill_versions.json {HOME}/skills/ 2>/dev/null || true",
                shell=True, timeout=5,
            )
    except Exception:
        pass
    skills: list[str] = []
    try:
        result = subprocess.run(
            ["ls", "-1", f"{HOME}/skills/"],
            capture_output=True, text=True, timeout=5,
        )
        skills = [s for s in result.stdout.strip().split("\n") if s]
    except Exception:
        pass
    return {"ok": True, "skills": skills}


@router.post("/skills/package-skill")
async def package_skill(request: Request) -> dict[str, Any]:
    body = await request.json()
    skill_name = body.get("skill_name") or body.get("skillName")
    if not skill_name:
        return {"error": "skill_name required"}
    skill_dir = body.get("skill_path") or f"{HOME}/skills/{skill_name}"
    try:
        subprocess.run(
            f'cd "{skill_dir}" && zip -r /tmp/{skill_name}.zip .',
            shell=True, timeout=15, check=True,
        )
        result = subprocess.run(
            ["rubic-upload-file", f"/tmp/{skill_name}.zip"],
            capture_output=True, text=True, timeout=30,
        )
        subprocess.run(["rm", "-f", f"/tmp/{skill_name}.zip"], timeout=2)
        if result.returncode == 0:
            return {"ok": True, "url": result.stdout.strip(), "skillName": skill_name}
        return {"ok": False, "error": result.stderr.strip()}
    except Exception as e:
        return {"ok": False, "error": str(e)}
