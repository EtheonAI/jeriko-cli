"""Route registration — all 64+ endpoints from tool modules."""

from fastapi import FastAPI

from .tools.terminal import router as terminal_router
from .tools.files import router as files_router
from .tools.text_editor import router as text_editor_router
from .tools.browser import router as browser_router
from .tools.config import router as config_router
from .tools.neko import router as neko_router
from .tools.code_server import router as code_server_router
from .tools.slides import router as slides_router
from .tools.skills import router as skills_router
from .tools.email import router as email_router
from .tools.image import router as image_router
from .tools.deploy import router as deploy_router
from .tools.webdev import router as webdev_router
from .tools.parallel_tasks import router as parallel_tasks_router
from .tools.apiproxy import router as apiproxy_router


def register_routes(app: FastAPI) -> None:
    """Register all tool route modules on the app.

    IMPORTANT: parallel_tasks_router MUST come before files_router because
    files_router has a catch-all /file/{command} route that would shadow
    the explicit /file/store_parallel_tasks_result and
    /file/get_parallel_tasks_result routes.
    """
    app.include_router(terminal_router)
    app.include_router(parallel_tasks_router)  # Before files_router — see docstring
    app.include_router(files_router)
    app.include_router(text_editor_router)
    app.include_router(browser_router)
    app.include_router(config_router)
    app.include_router(neko_router)
    app.include_router(code_server_router)
    app.include_router(slides_router)
    app.include_router(skills_router)
    app.include_router(email_router)
    app.include_router(image_router)
    app.include_router(deploy_router)
    app.include_router(webdev_router)
    app.include_router(apiproxy_router)
