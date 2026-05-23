from __future__ import annotations

import base64
import mimetypes
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote, urljoin

import httpx


@dataclass(frozen=True)
class GradioInstantMeshOptions:
    remove_background: bool
    sample_steps: int
    seed: int
    timeout_seconds: int


@dataclass(frozen=True)
class GradioFile:
    bytes: bytes
    content_type: str
    file_name: str


class GradioInstantMeshClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    async def generate_glb(
        self,
        *,
        image_bytes: bytes,
        image_content_type: str,
        image_file_name: str,
        options: GradioInstantMeshOptions,
        session_hash: str,
    ) -> GradioFile:
        data_url = bytes_to_data_url(image_bytes, image_content_type)
        one_step = await self._resolve_one_step_workflow()

        if one_step:
            mesh = await self._predict(
                fn_index=one_step.fn_index,
                data=[data_url, options.remove_background, options.sample_steps, options.seed],
                session_hash=session_hash,
                timeout_seconds=options.timeout_seconds,
            )
            glb_reference = get_output(mesh, one_step.glb_output_index, "GLB file")

            return await self._download_file(
                glb_reference,
                fallback_name=Path(image_file_name).stem or "instantmesh",
                timeout_seconds=options.timeout_seconds,
            )

        processed = await self._predict(
            fn_index=2,
            data=[data_url, options.remove_background],
            session_hash=session_hash,
            timeout_seconds=options.timeout_seconds,
        )
        processed_image = get_output(processed, 0, "processed image")

        multiview = await self._predict(
            fn_index=3,
            data=[processed_image, options.sample_steps, options.seed],
            session_hash=session_hash,
            timeout_seconds=options.timeout_seconds,
        )
        multiview_state = get_output(multiview, 0, "multi-view state")

        mesh = await self._predict(
            fn_index=4,
            data=[multiview_state],
            session_hash=session_hash,
            timeout_seconds=options.timeout_seconds,
        )
        glb_reference = get_output(mesh, 2, "GLB file")

        return await self._download_file(
            glb_reference,
            fallback_name=Path(image_file_name).stem or "instantmesh",
            timeout_seconds=options.timeout_seconds,
        )

    async def _predict(
        self,
        *,
        fn_index: int,
        data: list[Any],
        session_hash: str,
        timeout_seconds: int,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            response = await client.post(
                f"{self.base_url}/api/predict",
                json={
                    "data": data,
                    "fn_index": fn_index,
                    "session_hash": session_hash,
                },
            )

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as error:
            body = response.text.strip()
            detail = f": {body[:500]}" if body else ""
            raise RuntimeError(
                f"Gradio predict failed with HTTP {response.status_code}{detail}"
            ) from error

        payload = response.json()

        if not isinstance(payload, dict):
            raise RuntimeError("Gradio returned a non-object response.")

        if payload.get("error"):
            raise RuntimeError(str(payload["error"]))

        return payload

    async def _resolve_one_step_workflow(self) -> "OneStepWorkflow | None":
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{self.base_url}/config")
            response.raise_for_status()
            config = response.json()
        except Exception:
            return None

        dependencies = config.get("dependencies")
        components = config.get("components")

        if not isinstance(dependencies, list) or not isinstance(components, list):
            return None

        component_by_id = {
            component.get("id"): component
            for component in components
            if isinstance(component, dict)
        }

        for fn_index, dependency in enumerate(dependencies):
            if not isinstance(dependency, dict):
                continue

            input_ids = dependency.get("inputs")
            output_ids = dependency.get("outputs")

            if not isinstance(input_ids, list) or not isinstance(output_ids, list):
                continue

            input_types = [component_by_id.get(component_id, {}).get("type") for component_id in input_ids]

            if input_types[:4] != ["image", "checkbox", "slider", "number"]:
                continue

            glb_output_index = find_glb_output_index(output_ids, component_by_id)

            if glb_output_index is None:
                continue

            return OneStepWorkflow(fn_index=fn_index, glb_output_index=glb_output_index)

        return None

    async def _download_file(self, value: Any, *, fallback_name: str, timeout_seconds: int) -> GradioFile:
        inline = decode_inline_file(value, fallback_name)

        if inline:
            return inline

        file_url, file_name = self._resolve_file_url(value, fallback_name)

        async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
            response = await client.get(file_url)

        response.raise_for_status()
        content_type = response.headers.get("content-type") or guess_content_type(file_name)
        normalized_name = ensure_glb_file_name(file_name)

        return GradioFile(
            bytes=response.content,
            content_type="model/gltf-binary" if normalized_name.endswith(".glb") else content_type,
            file_name=normalized_name,
        )

    def _resolve_file_url(self, value: Any, fallback_name: str) -> tuple[str, str]:
        reference = extract_file_reference(value)

        if not reference:
            raise RuntimeError("InstantMesh did not return a GLB file reference.")

        if reference.startswith("http://") or reference.startswith("https://"):
            return reference, ensure_glb_file_name(Path(reference.split("?")[0]).name or fallback_name)

        path = reference.replace("\\", "/")
        file_name = ensure_glb_file_name(Path(path).name or fallback_name)
        return urljoin(self.base_url, f"/file={quote(reference, safe='')}"), file_name


def bytes_to_data_url(image_bytes: bytes, content_type: str) -> str:
    encoded = base64.b64encode(image_bytes).decode("ascii")
    return f"data:{content_type or 'image/png'};base64,{encoded}"


@dataclass(frozen=True)
class OneStepWorkflow:
    fn_index: int
    glb_output_index: int


def find_glb_output_index(output_ids: list[Any], component_by_id: dict[Any, dict[str, Any]]) -> int | None:
    for index, component_id in enumerate(output_ids):
        component = component_by_id.get(component_id)

        if not component:
            continue

        props = component.get("props") if isinstance(component.get("props"), dict) else {}
        label = str(props.get("label", "")).lower()

        if component.get("type") == "model3d" and "glb" in label:
            return index

    return None


def get_output(payload: dict[str, Any], index: int, label: str) -> Any:
    data = payload.get("data")

    if not isinstance(data, list) or len(data) <= index:
        raise RuntimeError(f"Gradio response missing {label}.")

    output = data[index]

    if output is None:
        raise RuntimeError(f"Gradio response returned empty {label}.")

    return output


def extract_file_reference(value: Any) -> str:
    if isinstance(value, str):
        return value

    if isinstance(value, dict):
        for key in ("name", "path", "url"):
            candidate = value.get(key)

            if isinstance(candidate, str) and candidate:
                return candidate

    return ""


def decode_inline_file(value: Any, fallback_name: str) -> GradioFile | None:
    raw_data = value.get("data") if isinstance(value, dict) else value

    if not isinstance(raw_data, str):
        return None

    if raw_data.startswith("data:"):
        header, encoded = raw_data.split(",", 1)
        content_type = header.removeprefix("data:").split(";")[0] or "model/gltf-binary"

        return GradioFile(
            bytes=base64.b64decode(encoded),
            content_type=content_type,
            file_name=ensure_glb_file_name(fallback_name),
        )

    return None


def ensure_glb_file_name(file_name: str) -> str:
    stem = Path(file_name).name or "item-model"

    return stem if stem.lower().endswith(".glb") else f"{Path(stem).stem or 'item-model'}.glb"


def guess_content_type(file_name: str) -> str:
    return mimetypes.guess_type(file_name)[0] or "model/gltf-binary"
