"""Parallel task result storage — Manus parity.

POST /file/store_parallel_tasks_result — Store result from parallel worker
GET  /file/get_parallel_tasks_result — Retrieve stored results
"""

import json
import os
from typing import Any

from fastapi import APIRouter, Request

from ..logger import get_logger

logger = get_logger("parallel_tasks")
router = APIRouter()

HOME = os.getenv("HOME", "/home/ubuntu")
RESULTS_DIR = os.path.join(HOME, ".parallel_task_results")

# In-memory store (also persisted to disk)
_results: dict[str, Any] = {}


@router.post("/file/store_parallel_tasks_result")
async def store_result(request: Request) -> dict[str, Any]:
    body = await request.json()
    task_id = body.get("task_id")
    result = body.get("result")

    if not task_id:
        return {"error": "task_id is required"}

    _results[task_id] = result

    # Persist to disk
    os.makedirs(RESULTS_DIR, exist_ok=True)
    with open(os.path.join(RESULTS_DIR, f"{task_id}.json"), "w") as f:
        json.dump(result, f)

    logger.info("Stored parallel task result: %s", task_id)
    return {"ok": True, "task_id": task_id}


@router.get("/file/get_parallel_tasks_result")
async def get_results(task_id: str | None = None) -> dict[str, Any]:
    if task_id:
        # Check memory first, then disk
        if task_id in _results:
            return {"ok": True, "task_id": task_id, "result": _results[task_id]}
        path = os.path.join(RESULTS_DIR, f"{task_id}.json")
        if os.path.exists(path):
            try:
                with open(path) as f:
                    return {"ok": True, "task_id": task_id, "result": json.load(f)}
            except json.JSONDecodeError:
                return {"error": f"Corrupted result file for task_id: {task_id}"}
        return {"error": f"No result for task_id: {task_id}"}

    # Return all results
    return {"ok": True, "results": _results}
