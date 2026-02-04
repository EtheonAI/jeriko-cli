from fastapi import APIRouter

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    """Basic health check."""
    return {"status": "ok", "service": "agent"}


@router.get("/ready")
async def readiness_check():
    """Readiness check - verifies all dependencies are available."""
    # TODO: Check Redis, LLM providers
    return {"status": "ready"}
