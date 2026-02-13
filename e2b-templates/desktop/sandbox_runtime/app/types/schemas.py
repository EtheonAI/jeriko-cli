from pydantic import BaseModel, Field
from typing import Any


class TerminalCreateRequest(BaseModel):
    cols: int = 80
    rows: int = 24
    shell: str = "/bin/bash"


class TerminalWriteRequest(BaseModel):
    text: str


class TerminalResizeRequest(BaseModel):
    cols: int
    rows: int


class FileRequest(BaseModel):
    command: str
    path: str = ""
    content: str | None = None
    encoding: str = "utf-8"
    append: bool = False
    leading_newline: bool = False
    trailing_newline: bool = True
    glob_pattern: str | None = None
    file_paths: list[str] | None = None


class TextEditorRequest(BaseModel):
    command: str
    path: str = ""
    content: str | None = None
    old_str: str | None = None
    new_str: str | None = None
    insert_line: int | None = None
    view_range: list[int] | None = None
    regex: str | None = None
    glob: str | None = None
    file_path: str | None = None
    edits: list[dict[str, Any]] | None = None


class BrowserActionRequest(BaseModel):
    action: str
    url: str | None = None
    coordinate: list[int] | None = None
    text: str | None = None
    key: str | None = None
    direction: str | None = None
    amount: int | None = None
    script: str | None = None
    selector: str | None = None
    value: str | None = None


class SetEnvRequest(BaseModel):
    env: dict[str, str] | None = None
    secrets: list[dict[str, str]] | None = None
    enabledBuiltInMCP: list[str] | None = None


class InitSandboxRequest(BaseModel):
    session_id: str | None = None
    user_id: str | None = None
    sandbox_token: str | None = None
    env_vars: dict[str, str] | None = None


class SlideRequest(BaseModel):
    project_path: str = "/home/ubuntu/slides"
    slideId: int | None = None
    changes: dict[str, Any] | None = None
    notes: str | None = None
    file_path: str | None = None


class SkillRequest(BaseModel):
    skill_name: str | None = None
    skill_path: str | None = None


class CodeServerAuthRequest(BaseModel):
    pre_auth_token: str


class ParallelTaskResultRequest(BaseModel):
    task_id: str
    result: Any
