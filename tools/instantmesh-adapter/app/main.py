from __future__ import annotations

import asyncio
import json
import os
import secrets
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .gradio_client import GradioInstantMeshClient, GradioInstantMeshOptions


TaskStatus = Literal["queued", "running", "succeeded", "failed"]


class TaskCreateResponse(BaseModel):
    taskId: str
    status: TaskStatus


class TaskStatusResponse(BaseModel):
    taskId: str
    status: TaskStatus
    progress: int
    message: str
    glbUrl: str | None = None
    error: str | None = None
    createdAt: str
    updatedAt: str


@dataclass
class MeshTask:
    id: str
    token: str
    image_bytes: bytes
    image_content_type: str
    image_file_name: str
    format: str
    scale_hint: str
    extra_params: str
    status: TaskStatus = "queued"
    progress: int = 5
    message: str = "Queued"
    glb_path: Path | None = None
    error: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class AdapterState:
    def __init__(self) -> None:
        self.tasks: dict[str, MeshTask] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self.lock = asyncio.Lock()
        self.worker: asyncio.Task[None] | None = None

    async def start(self) -> None:
        if self.worker is None:
            self.worker = asyncio.create_task(worker_loop())

    async def stop(self) -> None:
        if self.worker:
            self.worker.cancel()
            try:
                await self.worker
            except asyncio.CancelledError:
                pass
            self.worker = None


app = FastAPI(title="InstantMesh Adapter", version="0.1.0")
state = AdapterState()


def get_api_key() -> str:
    return os.getenv("INSTANTMESH_ADAPTER_API_KEY", "local-dev")


def get_output_dir() -> Path:
    configured = os.getenv("INSTANTMESH_ADAPTER_OUTPUT_DIR", "outputs")
    path = Path(configured)

    if not path.is_absolute():
        path = Path(__file__).resolve().parents[1] / path

    path.mkdir(parents=True, exist_ok=True)
    return path


def get_public_base_url(request: Request) -> str:
    configured = os.getenv("INSTANTMESH_ADAPTER_PUBLIC_BASE_URL", "").strip().rstrip("/")

    if configured:
        return configured

    return str(request.base_url).rstrip("/")


def require_api_key(authorization: str | None = Header(default=None)) -> None:
    expected = get_api_key()

    if not expected:
        return

    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Invalid API key.")


@app.on_event("startup")
async def on_startup() -> None:
    await state.start()


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await state.stop()


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/instantmesh/tasks", response_model=TaskCreateResponse)
async def create_task(
    _: None = Depends(require_api_key),
    model_input_image: UploadFile = File(alias="modelInputImage"),
    format: str = Form(default="glb"),
    scale_hint: str = Form(default="", alias="scaleHint"),
    extra_params: str = Form(default="", alias="extraParams"),
) -> TaskCreateResponse:
    normalized_format = format.strip().lower() or "glb"

    if normalized_format != "glb":
        raise HTTPException(status_code=400, detail="Only GLB output is supported.")

    image_bytes = await model_input_image.read()

    if not image_bytes:
        raise HTTPException(status_code=400, detail="modelInputImage is required.")

    task = MeshTask(
        id=uuid4().hex,
        token=secrets.token_urlsafe(24),
        image_bytes=image_bytes,
        image_content_type=model_input_image.content_type or "image/png",
        image_file_name=model_input_image.filename or "model-input.png",
        format=normalized_format,
        scale_hint=scale_hint,
        extra_params=extra_params,
    )

    async with state.lock:
        state.tasks[task.id] = task
        await state.queue.put(task.id)

    return TaskCreateResponse(taskId=task.id, status=task.status)


@app.get("/api/instantmesh/tasks/{task_id}", response_model=TaskStatusResponse)
async def get_task(task_id: str, request: Request, _: None = Depends(require_api_key)) -> TaskStatusResponse:
    task = await get_existing_task(task_id)
    return to_status_response(task, request)


@app.get("/api/instantmesh/tasks/{task_id}/glb")
async def download_glb(task_id: str, token: str) -> FileResponse:
    task = await get_existing_task(task_id)

    if token != task.token:
        raise HTTPException(status_code=403, detail="Invalid download token.")

    if task.status != "succeeded" or not task.glb_path or not task.glb_path.exists():
        raise HTTPException(status_code=404, detail="GLB is not ready.")

    return FileResponse(
        task.glb_path,
        media_type="model/gltf-binary",
        filename=task.glb_path.name,
    )


async def get_existing_task(task_id: str) -> MeshTask:
    async with state.lock:
        task = state.tasks.get(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="Task not found.")

    return task


def to_status_response(task: MeshTask, request: Request) -> TaskStatusResponse:
    glb_url = None

    if task.status == "succeeded" and task.glb_path:
        base_url = get_public_base_url(request)
        glb_url = f"{base_url}/api/instantmesh/tasks/{task.id}/glb?token={task.token}"

    return TaskStatusResponse(
        taskId=task.id,
        status=task.status,
        progress=task.progress,
        message=task.message,
        glbUrl=glb_url,
        error=task.error,
        createdAt=task.created_at.isoformat(),
        updatedAt=task.updated_at.isoformat(),
    )


async def worker_loop() -> None:
    while True:
        task_id = await state.queue.get()

        try:
            await run_task(task_id)
        finally:
            state.queue.task_done()


async def run_task(task_id: str) -> None:
    task = await get_existing_task(task_id)
    await update_task(task, status="running", progress=12, message="Calling InstantMesh preprocessing")

    try:
        options = get_task_options(task.extra_params)
        client = GradioInstantMeshClient(os.getenv("INSTANTMESH_GRADIO_BASE_URL", "http://localhost:43839"))

        await update_task(task, progress=24, message="Generating multi-view state")
        glb = await client.generate_glb(
            image_bytes=task.image_bytes,
            image_content_type=task.image_content_type,
            image_file_name=task.image_file_name,
            options=options,
            session_hash=task.id,
        )

        await update_task(task, progress=88, message="Saving GLB")
        output_path = get_output_dir() / f"{task.id}.glb"
        output_path.write_bytes(glb.bytes)
        task.glb_path = output_path
        task.image_bytes = b""
        await update_task(task, status="succeeded", progress=100, message="Succeeded")
    except Exception as error:
        await update_task(task, status="failed", progress=100, message="Failed", error=str(error))


async def update_task(
    task: MeshTask,
    *,
    status: TaskStatus | None = None,
    progress: int | None = None,
    message: str | None = None,
    error: str | None = None,
) -> None:
    async with state.lock:
        if status:
            task.status = status
        if progress is not None:
            task.progress = max(0, min(100, progress))
        if message:
            task.message = message
        if error:
            task.error = error
        task.updated_at = datetime.now(timezone.utc)


def get_task_options(extra_params: str) -> GradioInstantMeshOptions:
    payload = parse_extra_params(extra_params)
    timeout_seconds = int(os.getenv("INSTANTMESH_ADAPTER_TIMEOUT_SECONDS", "900"))
    sample_steps = get_int(payload.get("sampleSteps"), int(os.getenv("INSTANTMESH_ADAPTER_SAMPLE_STEPS", "75")))
    seed = get_int(payload.get("seed"), int(os.getenv("INSTANTMESH_ADAPTER_SEED", "42")))
    remove_background = get_bool(
        payload.get("removeBackground"),
        os.getenv("INSTANTMESH_ADAPTER_REMOVE_BACKGROUND", "true").lower() not in {"0", "false", "no"},
    )

    return GradioInstantMeshOptions(
        remove_background=remove_background,
        sample_steps=max(1, min(150, sample_steps)),
        seed=seed,
        timeout_seconds=max(30, timeout_seconds),
    )


def parse_extra_params(value: str) -> dict[str, object]:
    if not value.strip():
        return {}

    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        return {}

    return payload if isinstance(payload, dict) else {}


def get_int(value: object, fallback: int) -> int:
    if isinstance(value, bool):
        return fallback

    if isinstance(value, int):
        return value

    if isinstance(value, str):
        try:
            return int(value)
        except ValueError:
            return fallback

    return fallback


def get_bool(value: object, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value

    if isinstance(value, str):
        normalized = value.strip().lower()

        if normalized in {"1", "true", "yes", "on"}:
            return True

        if normalized in {"0", "false", "no", "off"}:
            return False

    return fallback
