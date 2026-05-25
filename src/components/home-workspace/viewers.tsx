import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Maximize2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ItemDraftPatch,
  ItemMaterialCreateInput,
  SceneDraftPatch,
  SceneMaterialCreateInput,
  WorkspaceItemMaterialMetadata,
  WorkspaceMaterial,
  WorkspaceMaterialCategory,
  WorkspaceMaterialMetadata,
  WorkspaceMaterialStyle,
  WorkspaceSceneMaterialMetadata,
  WorkspaceSceneScalePreset,
  WorkspaceScript
} from "@/lib/home-workspace";
import {
  defaultScenePanoramaView,
  defaultSceneScalePreset,
  defaultScenePanoramaMaxRedrawAttempts,
  itemTagFields,
  maskBoardAcceptedTypes,
  maskBoardDrawingStyles,
  maskBodyFields,
  maskColorFields,
  maskPersonalityGroups,
  maskVoiceFields,
  materialIcons,
  materialStyles,
  materialTypes,
  maxMaskBoardImageBytes,
  maxScenePanoramaFaceBytes,
  maxScenePanoramaMaxRedrawAttempts,
  maxSceneReferenceImages,
  minScenePanoramaMaxRedrawAttempts,
  scenePanoramaAcceptedTypes,
  scenePanoramaFaces,
  scenePanoramaThreeFaceOrder,
  sceneScalePresets,
  scriptCategories,
  scriptPickerPageSize,
  clampScenePanoramaView,
  loadSceneEquirectangularTexture,
  loadScenePanoramaCubeTexture,
  scheduleScenePanoramaWebglStart,
  type ItemCreateDraft,
  type ItemModelDraft,
  type ItemModelProgress,
  type ItemModelStreamEvent,
  type ItemTagFieldId,
  type ItemViewFace,
  type ItemViewImageDraft,
  type MaskAiMessage,
  type MaskBoardDrawingStyle,
  type MaskBoardImageSource,
  type MaskBodyFieldId,
  type MaskColorFieldId,
  type MaskCreateDraft,
  type MaskDraftPatch,
  type MaskPersonalityFieldId,
  type MaskVoiceFieldId,
  type MessageStreamEvent,
  type SceneAiMessage,
  type SceneBlockDraft,
  type SceneCreateDraft,
  type ScenePanoramaDraft,
  type ScenePanoramaDrawingStyle,
  type ScenePanoramaFace,
  type ScenePanoramaFaceDraft,
  type ScenePanoramaGenerationDraft,
  type ScenePanoramaMotherDraft,
  type ScenePanoramaStreamDoneEvent,
  type ScenePanoramaStreamEvent,
  type ScenePanoramaStreamFaceImage,
  type ScenePanoramaStreamImage,
  type ScenePanoramaView,
  type ScenePanoramaWebglLoadMode,
  type SceneReferenceImageDraft,
  type ViewMode,
  type ScriptManagerView,
  type MaterialManagerView,
  type StreamingReply
} from "./shared";
import { isCompleteScenePanoramaFaceUrls } from "./drafts";

export {
  ItemModelPreviewDialog,
  ItemModelViewer,
  SceneEquirectangularPanoramaPreviewDialog,
  SceneEquirectangularPanoramaViewer,
  ScenePanoramaPreviewDialog,
  ScenePanoramaViewer
};

function ItemModelViewer({
  allowExpand = true,
  closeLabel,
  emptyLabel,
  expandLabel,
  loadingLabel,
  modelUrl,
  title
}: {
  allowExpand?: boolean;
  closeLabel: string;
  emptyLabel: string;
  expandLabel: string;
  loadingLabel: string;
  modelUrl: string;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !modelUrl) {
      setReady(false);
      return;
    }

    let disposed = false;
    let cleanup = () => {};

    async function init() {
      setReady(false);
      setFailed(false);

      try {
        if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
          setFailed(true);
          return;
        }

        if (!hasCanvasWebglSupport(document.createElement("canvas")) || !containerRef.current) {
          setFailed(true);
          return;
        }

        const THREE = await import("three");
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 1000);
        const controls = new OrbitControls(camera, renderer.domElement);
        const loader = new GLTFLoader();
        let animationFrame = 0;
        let observer: ResizeObserver | null = null;
        let model: import("three").Object3D | null = null;

        THREE.ColorManagement.enabled = true;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "none";
        renderer.domElement.className = "h-full w-full cursor-grab rounded-xl";
        containerRef.current.appendChild(renderer.domElement);

        scene.add(new THREE.HemisphereLight(0xffffff, 0x9ca3af, 2.4));
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(4, 5, 6);
        scene.add(keyLight);
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
        fillLight.position.set(-3, 2, -4);
        scene.add(fillLight);

        controls.enableDamping = true;
        controls.dampingFactor = 0.08;
        controls.enablePan = false;
        controls.minDistance = 0.6;
        controls.maxDistance = 12;

        cleanup = () => {
          observer?.disconnect();
          cancelAnimationFrame(animationFrame);
          controls.dispose();
          if (model) {
            disposeThreeObject(model);
          }
          renderer.domElement.remove();
          renderer.dispose();
        };

        model = await new Promise<import("three").Object3D>((resolve, reject) => {
          loader.load(
            modelUrl,
            (gltf) => resolve(gltf.scene),
            undefined,
            (error) => reject(error)
          );
        });

        if (disposed) {
          cleanup();
          return;
        }

        scene.add(model);
        frameThreeModel(THREE, camera, controls, model);

        function resize() {
          if (!containerRef.current) {
            return;
          }

          const width = Math.max(1, containerRef.current.clientWidth);
          const height = Math.max(1, containerRef.current.clientHeight);

          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
          renderer.render(scene, camera);
        }

        function animate() {
          controls.update();
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(animate);
        }

        observer = new ResizeObserver(resize);
        observer.observe(containerRef.current);
        resize();
        animate();
        setReady(true);
      } catch {
        cleanup();
        setFailed(true);
        setReady(false);
      }
    }

    void init();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [modelUrl]);

  if (!modelUrl) {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-dashed border-border bg-background/70 px-4 text-center text-sm text-foreground/48">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-background/70">
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && !failed ? (
        <div className="absolute inset-0 grid place-items-center bg-muted/30 px-4 text-center text-xs font-medium text-foreground/48">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingLabel}
          </span>
        </div>
      ) : null}
      {failed ? (
        <div className="absolute inset-0 grid place-items-center bg-muted/30 px-4 text-center text-xs text-foreground/48">
          <span className="break-all">{title}</span>
        </div>
      ) : null}
      {allowExpand ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/88 text-foreground/68 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground"
          aria-label={expandLabel}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
      {expanded ? (
        <ItemModelPreviewDialog
          closeLabel={closeLabel}
          emptyLabel={emptyLabel}
          loadingLabel={loadingLabel}
          modelUrl={modelUrl}
          onClose={() => setExpanded(false)}
          title={title}
        />
      ) : null}
    </div>
  );
}

function ItemModelPreviewDialog({
  closeLabel,
  emptyLabel,
  loadingLabel,
  modelUrl,
  onClose,
  title
}: {
  closeLabel: string;
  emptyLabel: string;
  loadingLabel: string;
  modelUrl: string;
  onClose: () => void;
  title: string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-5">
      <section className="relative flex h-[min(88vh,56rem)] w-[min(94vw,70rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-foreground/25">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="truncate text-sm font-semibold text-foreground/72">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/68 transition hover:bg-muted hover:text-foreground"
            aria-label={closeLabel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 p-3">
          <ItemModelViewer
            allowExpand={false}
            closeLabel={closeLabel}
            emptyLabel={emptyLabel}
            expandLabel=""
            loadingLabel={loadingLabel}
            modelUrl={modelUrl}
            title={title}
          />
        </div>
      </section>
    </div>
  );
}

function frameThreeModel(
  THREE: typeof import("three"),
  camera: import("three").PerspectiveCamera,
  controls: { maxDistance: number; minDistance: number; target: import("three").Vector3; update: () => void },
  model: import("three").Object3D
) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1);
  const distance = radius * 2.4;

  model.position.sub(center);
  camera.position.set(distance * 0.75, distance * 0.5, distance);
  camera.near = Math.max(0.01, distance / 200);
  camera.far = Math.max(100, distance * 12);
  camera.updateProjectionMatrix();
  controls.minDistance = Math.max(0.2, distance * 0.25);
  controls.maxDistance = Math.max(4, distance * 4);
  controls.target.set(0, 0, 0);
  controls.update();
}

function disposeThreeObject(object: import("three").Object3D) {
  object.traverse((child) => {
    const mesh = child as import("three").Mesh;

    mesh.geometry?.dispose();

    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(disposeThreeMaterial);
    } else {
      mesh.material?.dispose();
    }
  });
}

function disposeThreeMaterial(material: import("three").Material) {
  const values = Object.values(material as unknown as Record<string, unknown>);

  values.forEach((value) => {
    if (value && typeof value === "object" && "dispose" in value) {
      const disposable = value as { dispose?: () => void };

      disposable.dispose?.();
    }
  });
  material.dispose();
}

function ScenePanoramaViewer({
  className,
  emptyLabel,
  expandLabel,
  faces,
  loadingLabel,
  onExpand,
  onViewChange,
  view,
  webglLoadDelayMs = 0,
  webglLoadMode
}: {
  className?: string;
  emptyLabel: string;
  expandLabel?: string;
  faces: Partial<Record<ScenePanoramaFace, string>> | null;
  loadingLabel?: string;
  onExpand?: () => void;
  onViewChange?: (view: ScenePanoramaView) => void;
  view?: ScenePanoramaView;
  webglLoadDelayMs?: number;
  webglLoadMode?: ScenePanoramaWebglLoadMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExpandRef = useRef(onExpand);
  const onViewChangeRef = useRef(onViewChange);
  const renderRef = useRef<(() => void) | null>(null);
  const viewRef = useRef<ScenePanoramaView>(clampScenePanoramaView(view ?? defaultScenePanoramaView));
  const resolvedWebglLoadMode = webglLoadMode ?? "idle";
  const [webglFailed, setWebglFailed] = useState(false);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    if (!view) {
      return;
    }

    viewRef.current = clampScenePanoramaView(view);
    renderRef.current?.();
  }, [view]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !faces || !isCompleteScenePanoramaFaceUrls(faces)) {
      setWebglReady(false);
      return;
    }

    const currentFaces = faces as Record<ScenePanoramaFace, string>;
    let disposed = false;
    let cleanup = () => {};
    let cancelStart = () => {};

    async function init() {
      setWebglReady(false);
      setWebglFailed(false);

      try {
        if (!hasCanvasWebglSupport(document.createElement("canvas")) || !containerRef.current) {
          setWebglReady(false);
          setWebglFailed(true);
          return;
        }

        const THREE = await import("three");
        THREE.ColorManagement.enabled = true;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(viewRef.current.fov, 1, 0.1, 100);
        camera.position.set(0, 0, 0.1);
        let cubeTexture: import("three").CubeTexture | null = null;
        let cubeImageBitmaps: ImageBitmap[] = [];
        let observer: ResizeObserver | null = null;
        const removeListeners: Array<() => void> = [];
        let pointerDown = false;
        let startX = 0;
        let startY = 0;
        let startView = viewRef.current;
        let movedSincePointerDown = false;

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "none";
        containerRef.current.appendChild(renderer.domElement);
        cleanup = () => {
          observer?.disconnect();
          removeListeners.forEach((removeListener) => removeListener());
          if (renderRef.current === render) {
            renderRef.current = null;
          }
          cubeTexture?.dispose();
          cubeImageBitmaps.forEach((image) => image.close());
          renderer.domElement.remove();
          renderer.dispose();
        };

        const loadedCube = await loadScenePanoramaCubeTexture(THREE, scenePanoramaThreeFaceOrder.map((face) => currentFaces[face]));
        cubeTexture = loadedCube.texture;
        cubeImageBitmaps = loadedCube.imageBitmaps;

        if (disposed) {
          cleanup();
          return;
        }

        cubeTexture.colorSpace = THREE.SRGBColorSpace;
        scene.background = cubeTexture;
        scene.environment = cubeTexture;

        function updateCamera() {
          const currentView = clampScenePanoramaView(viewRef.current);
          viewRef.current = currentView;
          camera.fov = currentView.fov;
          camera.updateProjectionMatrix();
          const phi = THREE.MathUtils.degToRad(90 - currentView.lat);
          const theta = THREE.MathUtils.degToRad(currentView.lon);

          camera.lookAt(
            new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta)
            )
          );
        }

        function render() {
          updateCamera();
          renderer.render(scene, camera);
        }

        renderRef.current = render;

        function resize() {
          if (!containerRef.current) {
            return;
          }

          const width = Math.max(1, containerRef.current.clientWidth);
          const height = Math.max(1, containerRef.current.clientHeight);

          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
          render();
        }

        function onPointerDown(event: PointerEvent) {
          pointerDown = true;
          movedSincePointerDown = false;
          startX = event.clientX;
          startY = event.clientY;
          startView = viewRef.current;
          renderer.domElement.setPointerCapture(event.pointerId);
          renderer.domElement.classList.add("cursor-grabbing");
        }

        function onPointerMove(event: PointerEvent) {
          if (!pointerDown) {
            return;
          }

          const deltaX = event.clientX - startX;
          const deltaY = event.clientY - startY;

          movedSincePointerDown ||= Math.hypot(deltaX, deltaY) > 6;
          viewRef.current = clampScenePanoramaView({
            ...startView,
            lat: startView.lat + deltaY * 0.12,
            lon: startView.lon - deltaX * 0.12
          });
          onViewChangeRef.current?.(viewRef.current);
          render();
        }

        function onPointerUp(event: PointerEvent) {
          const shouldExpand = pointerDown && !movedSincePointerDown && event.type === "pointerup" && Boolean(onExpandRef.current);

          pointerDown = false;
          renderer.domElement.classList.remove("cursor-grabbing");

          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }

          if (shouldExpand) {
            onExpandRef.current?.();
          }
        }

        function onWheel(event: WheelEvent) {
          event.preventDefault();
          viewRef.current = clampScenePanoramaView({
            ...viewRef.current,
            fov: viewRef.current.fov + Math.sign(event.deltaY) * 5
          });
          onViewChangeRef.current?.(viewRef.current);
          render();
        }

        observer = new ResizeObserver(resize);

        renderer.domElement.className = "h-full w-full cursor-grab rounded-xl";
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointercancel", onPointerUp);
        renderer.domElement.addEventListener("lostpointercapture", onPointerUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        removeListeners.push(
          () => renderer.domElement.removeEventListener("pointerdown", onPointerDown),
          () => renderer.domElement.removeEventListener("pointermove", onPointerMove),
          () => renderer.domElement.removeEventListener("pointerup", onPointerUp),
          () => renderer.domElement.removeEventListener("pointercancel", onPointerUp),
          () => renderer.domElement.removeEventListener("lostpointercapture", onPointerUp),
          () => renderer.domElement.removeEventListener("wheel", onWheel)
        );
        observer.observe(containerRef.current);
        resize();
        setWebglReady(true);
      } catch {
        cleanup();
        setWebglReady(false);
        setWebglFailed(true);
      }
    }

    cancelStart =
      resolvedWebglLoadMode === "immediate"
        ? (() => {
            void init();

            return () => {};
          })()
        : scheduleScenePanoramaWebglStart(() => {
            void init();
          }, webglLoadDelayMs);

    return () => {
      disposed = true;
      cancelStart();
      cleanup();
    };
  }, [faces, resolvedWebglLoadMode, webglLoadDelayMs]);

  if (!faces) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-4 text-center text-sm text-foreground/48",
          className ?? "aspect-video"
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border bg-background/70", className ?? "aspect-video")}>
      <div ref={containerRef} className="absolute inset-0" />
      {!webglReady && webglFailed ? (
        <div className="grid h-full grid-cols-3 gap-1 p-1">
          {scenePanoramaFaces.map((face) =>
            faces[face] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={face} src={faces[face]} alt="" loading="lazy" decoding="async" className="h-full w-full rounded-md object-cover" />
            ) : (
              <div key={face} className="flex h-full items-center justify-center rounded-md bg-muted text-[0.68rem] text-foreground/38">
                {emptyLabel}
              </div>
            )
          )}
        </div>
      ) : null}
      {!webglReady && !webglFailed ? (
        <div className="absolute inset-0 grid place-items-center bg-muted/30 px-4 text-center text-xs font-medium text-foreground/48">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingLabel ?? emptyLabel}
          </span>
        </div>
      ) : null}
      {!webglReady && onExpand ? (
        <button
          type="button"
          onClick={onExpand}
          className="absolute inset-0 cursor-zoom-in"
          aria-label={expandLabel ?? ""}
        >
          <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/88 text-foreground/68 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground">
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </span>
        </button>
      ) : null}
      {webglReady && onExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExpand();
          }}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/88 text-foreground/68 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground"
          aria-label={expandLabel ?? ""}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function SceneEquirectangularPanoramaViewer({
  className,
  emptyLabel,
  expandLabel,
  imageUrl,
  loadingLabel,
  onExpand,
  onViewChange,
  view,
  webglLoadDelayMs = 0,
  webglLoadMode
}: {
  className?: string;
  emptyLabel: string;
  expandLabel?: string;
  imageUrl: string | null;
  loadingLabel?: string;
  onExpand?: () => void;
  onViewChange?: (view: ScenePanoramaView) => void;
  view?: ScenePanoramaView;
  webglLoadDelayMs?: number;
  webglLoadMode?: ScenePanoramaWebglLoadMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onExpandRef = useRef(onExpand);
  const onViewChangeRef = useRef(onViewChange);
  const renderRef = useRef<(() => void) | null>(null);
  const viewRef = useRef<ScenePanoramaView>(clampScenePanoramaView(view ?? defaultScenePanoramaView));
  const resolvedWebglLoadMode = webglLoadMode ?? "idle";
  const [webglFailed, setWebglFailed] = useState(false);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);

  useEffect(() => {
    onViewChangeRef.current = onViewChange;
  }, [onViewChange]);

  useEffect(() => {
    if (!view) {
      return;
    }

    viewRef.current = clampScenePanoramaView(view);
    renderRef.current?.();
  }, [view]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !imageUrl) {
      setWebglReady(false);
      return;
    }

    const currentImageUrl = imageUrl;
    let disposed = false;
    let cleanup = () => {};
    let cancelStart = () => {};

    async function init() {
      setWebglReady(false);
      setWebglFailed(false);

      try {
        if (!hasCanvasWebglSupport(document.createElement("canvas")) || !containerRef.current) {
          setWebglReady(false);
          setWebglFailed(true);
          return;
        }

        const THREE = await import("three");
        THREE.ColorManagement.enabled = true;
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(viewRef.current.fov, 1, 0.1, 100);
        const geometry = new THREE.SphereGeometry(50, 64, 32);
        geometry.scale(-1, 1, 1);
        const loadedTexture = await loadSceneEquirectangularTexture(THREE, currentImageUrl);
        const texture = loadedTexture.texture;
        const textureImageBitmap = loadedTexture.imageBitmap;
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshBasicMaterial({ map: texture });
        const sphere = new THREE.Mesh(geometry, material);
        let observer: ResizeObserver | null = null;
        const removeListeners: Array<() => void> = [];
        let pointerDown = false;
        let startX = 0;
        let startY = 0;
        let startView = viewRef.current;
        let movedSincePointerDown = false;

        scene.add(sphere);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.domElement.style.display = "block";
        renderer.domElement.style.touchAction = "none";
        containerRef.current.appendChild(renderer.domElement);
        cleanup = () => {
          observer?.disconnect();
          removeListeners.forEach((removeListener) => removeListener());
          if (renderRef.current === render) {
            renderRef.current = null;
          }
          texture.dispose();
          textureImageBitmap?.close();
          material.dispose();
          geometry.dispose();
          renderer.domElement.remove();
          renderer.dispose();
        };

        if (disposed) {
          cleanup();
          return;
        }

        function updateCamera() {
          const currentView = clampScenePanoramaView(viewRef.current);
          viewRef.current = currentView;
          camera.fov = currentView.fov;
          camera.updateProjectionMatrix();
          const phi = THREE.MathUtils.degToRad(90 - currentView.lat);
          const theta = THREE.MathUtils.degToRad(currentView.lon);

          camera.lookAt(
            new THREE.Vector3(
              Math.sin(phi) * Math.cos(theta),
              Math.cos(phi),
              Math.sin(phi) * Math.sin(theta)
            )
          );
        }

        function render() {
          updateCamera();
          renderer.render(scene, camera);
        }

        renderRef.current = render;

        function resize() {
          if (!containerRef.current) {
            return;
          }

          const width = Math.max(1, containerRef.current.clientWidth);
          const height = Math.max(1, containerRef.current.clientHeight);

          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);
          render();
        }

        function onPointerDown(event: PointerEvent) {
          pointerDown = true;
          movedSincePointerDown = false;
          startX = event.clientX;
          startY = event.clientY;
          startView = viewRef.current;
          renderer.domElement.setPointerCapture(event.pointerId);
          renderer.domElement.classList.add("cursor-grabbing");
        }

        function onPointerMove(event: PointerEvent) {
          if (!pointerDown) {
            return;
          }

          const deltaX = event.clientX - startX;
          const deltaY = event.clientY - startY;

          movedSincePointerDown ||= Math.hypot(deltaX, deltaY) > 6;
          viewRef.current = clampScenePanoramaView({
            ...startView,
            lat: startView.lat + deltaY * 0.12,
            lon: startView.lon - deltaX * 0.12
          });
          onViewChangeRef.current?.(viewRef.current);
          render();
        }

        function onPointerUp(event: PointerEvent) {
          const shouldExpand = pointerDown && !movedSincePointerDown && event.type === "pointerup" && Boolean(onExpandRef.current);

          pointerDown = false;
          renderer.domElement.classList.remove("cursor-grabbing");

          if (renderer.domElement.hasPointerCapture(event.pointerId)) {
            renderer.domElement.releasePointerCapture(event.pointerId);
          }

          if (shouldExpand) {
            onExpandRef.current?.();
          }
        }

        function onWheel(event: WheelEvent) {
          event.preventDefault();
          viewRef.current = clampScenePanoramaView({
            ...viewRef.current,
            fov: viewRef.current.fov + Math.sign(event.deltaY) * 5
          });
          onViewChangeRef.current?.(viewRef.current);
          render();
        }

        observer = new ResizeObserver(resize);
        renderer.domElement.className = "h-full w-full cursor-grab rounded-xl";
        renderer.domElement.addEventListener("pointerdown", onPointerDown);
        renderer.domElement.addEventListener("pointermove", onPointerMove);
        renderer.domElement.addEventListener("pointerup", onPointerUp);
        renderer.domElement.addEventListener("pointercancel", onPointerUp);
        renderer.domElement.addEventListener("lostpointercapture", onPointerUp);
        renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
        removeListeners.push(
          () => renderer.domElement.removeEventListener("pointerdown", onPointerDown),
          () => renderer.domElement.removeEventListener("pointermove", onPointerMove),
          () => renderer.domElement.removeEventListener("pointerup", onPointerUp),
          () => renderer.domElement.removeEventListener("pointercancel", onPointerUp),
          () => renderer.domElement.removeEventListener("lostpointercapture", onPointerUp),
          () => renderer.domElement.removeEventListener("wheel", onWheel)
        );
        observer.observe(containerRef.current);
        resize();
        setWebglReady(true);
      } catch {
        cleanup();
        setWebglReady(false);
        setWebglFailed(true);
      }
    }

    cancelStart =
      resolvedWebglLoadMode === "immediate"
        ? (() => {
            void init();

            return () => {};
          })()
        : scheduleScenePanoramaWebglStart(() => {
            void init();
          }, webglLoadDelayMs);

    return () => {
      disposed = true;
      cancelStart();
      cleanup();
    };
  }, [imageUrl, resolvedWebglLoadMode, webglLoadDelayMs]);

  if (!imageUrl) {
    return (
      <div
        className={cn(
          "flex w-full items-center justify-center rounded-xl border border-dashed border-border bg-background/70 px-4 text-center text-sm text-foreground/48",
          className ?? "aspect-[2/1]"
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("relative w-full overflow-hidden rounded-xl border border-border bg-background/70", className ?? "aspect-[2/1]")}>
      <div ref={containerRef} className="absolute inset-0" />
      {!webglReady && webglFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      ) : null}
      {!webglReady && !webglFailed ? (
        <div className="absolute inset-0 grid place-items-center bg-muted/30 px-4 text-center text-xs font-medium text-foreground/48">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {loadingLabel ?? emptyLabel}
          </span>
        </div>
      ) : null}
      {onExpand ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onExpand();
          }}
          className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background/88 text-foreground/68 shadow-sm backdrop-blur transition hover:bg-background hover:text-foreground"
          aria-label={expandLabel ?? ""}
        >
          <Maximize2 className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

function ScenePanoramaPreviewDialog({
  faces,
  motherImageUrl,
  onClose,
  t
}: {
  faces: Record<ScenePanoramaFace, string>;
  motherImageUrl?: string | null;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const hasMotherPreview = Boolean(motherImageUrl);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-5">
      <section className="relative flex h-[min(94vh,70rem)] w-[min(94vw,64rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-foreground/25">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground/72">{t("sceneForm.panoramaPreviewTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/68 transition hover:bg-muted hover:text-foreground"
            aria-label={t("sceneForm.panoramaPreviewClose")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {hasMotherPreview ? (
          <div className="mx-auto grid min-h-0 w-full max-w-[58rem] flex-1 grid-rows-2 divide-y divide-border">
            <section className="flex min-h-0 flex-col">
              <div className="shrink-0 px-4 py-1.5 text-xs font-medium text-foreground/58">
                {t("sceneForm.panoramaMotherPreview")}
              </div>
              <SceneEquirectangularPanoramaViewer
                className="min-h-0 flex-1 rounded-none border-0"
                imageUrl={motherImageUrl ?? null}
                emptyLabel={t("sceneForm.panoramaMotherEmpty")}
                loadingLabel={t("sceneForm.panoramaPreviewLoading")}
                webglLoadDelayMs={120}
              />
            </section>
            <section className="flex min-h-0 flex-col">
              <div className="shrink-0 px-4 py-1.5 text-xs font-medium text-foreground/58">
                {t("sceneForm.panoramaFacesPreview")}
              </div>
              <ScenePanoramaViewer
                className="min-h-0 flex-1 rounded-none border-0"
                faces={faces}
                emptyLabel={t("sceneForm.panoramaEmpty")}
                loadingLabel={t("sceneForm.panoramaPreviewLoading")}
                webglLoadDelayMs={520}
              />
            </section>
          </div>
        ) : (
          <ScenePanoramaViewer
            className="min-h-0 flex-1 rounded-none border-0"
            faces={faces}
            emptyLabel={t("sceneForm.panoramaEmpty")}
            loadingLabel={t("sceneForm.panoramaPreviewLoading")}
            webglLoadDelayMs={160}
          />
        )}
      </section>
    </div>
  );
}

function SceneEquirectangularPanoramaPreviewDialog({
  imageUrl,
  onClose,
  t
}: {
  imageUrl: string;
  onClose: () => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-3 backdrop-blur-sm sm:p-5">
      <section className="relative flex h-[min(82vh,52rem)] w-[min(94vw,76rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl shadow-foreground/25">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground/72">{t("sceneForm.panoramaMotherPreviewTitle")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/68 transition hover:bg-muted hover:text-foreground"
            aria-label={t("sceneForm.panoramaPreviewClose")}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <SceneEquirectangularPanoramaViewer
          className="min-h-0 flex-1 rounded-none border-0"
          imageUrl={imageUrl}
          emptyLabel={t("sceneForm.panoramaMotherEmpty")}
          loadingLabel={t("sceneForm.panoramaPreviewLoading")}
          webglLoadDelayMs={160}
        />
      </section>
    </div>
  );
}

function hasCanvasWebglSupport(canvas: HTMLCanvasElement) {
  if (typeof WebGLRenderingContext === "undefined" && typeof WebGL2RenderingContext === "undefined") {
    return false;
  }

  return (["webgl", "experimental-webgl"] as const).some((contextName) => {
    try {
      return Boolean(canvas.getContext(contextName));
    } catch {
      return false;
    }
  });
}
