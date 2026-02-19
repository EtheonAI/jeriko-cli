"use client";

import * as React from "react";
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  PaintbrushIcon,
  MousePointerIcon,
  HandIcon,
  PenToolIcon,
  TypeIcon,
  SquareIcon,
  EraserIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateCcwIcon,
  Trash2Icon,
  GridIcon,
  ArrowUpIcon,
  ImageOffIcon,
  CrosshairIcon,
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// Konva.js — dynamic import for SSR safety (Konva requires window/document)
let Stage: typeof import("react-konva").Stage;
let Layer: typeof import("react-konva").Layer;
let Rect: typeof import("react-konva").Rect;
let Line: typeof import("react-konva").Line;
let Text: typeof import("react-konva").Text;
let Image: typeof import("react-konva").Image;
let Transformer: typeof import("react-konva").Transformer;
let Group: typeof import("react-konva").Group;

// ============================================================================
// Types
// ============================================================================

export type CanvasToolType =
  | "select"
  | "pan"
  | "mark"
  | "draw"
  | "text"
  | "rectangle"
  | "eraser";

export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  z: number; // zoom level
}

export interface ShapeStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  opacity: number;
  fontSize: number;
  fontFamily: string;
}

export type ShapeKind =
  | "rect"
  | "ellipse"
  | "path"
  | "text"
  | "image"
  | "mark";

export interface CanvasShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: ShapeStyle;
  text?: string;
  imageUrl?: string;
  points?: Point[];
  visible: boolean;
  zIndex: number;
}

export interface Annotation {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
}

/** Subset of canvas state exposed to external consumers (e.g. Redux sync) */
export interface CanvasStateSnapshot {
  shapes: CanvasShape[];
  selectedIds: string[];
  activeTool: CanvasToolType;
  zoom: number;
  showGrid: boolean;
}

export interface AICanvasViewProps {
  /** Image URL or data URI from generate_image tool output or screenshot */
  content?: string;
  /** Called whenever canvas state changes — use to sync with external state (e.g. Redux) */
  onStateChange?: (snapshot: CanvasStateSnapshot) => void;
  /** Manus toolbar: upscale image */
  onUpscale?: (imageUrl: string) => void;
  /** Manus toolbar: remove background */
  onRemoveBg?: (imageUrl: string) => void;
  /** Called when a marking annotation rectangle is completed */
  onMarkingComplete?: (annotation: {
    imageId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  /** Called when annotations change */
  onAnnotationsChange?: (annotations: Annotation[]) => void;
  /** Pre-loaded annotations for restoring state */
  initialAnnotations?: Annotation[];
  /** OCR edit text mode */
  editTextMode?: boolean;
  /** OCR annotation regions */
  ocrAnnotations?: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
  }>;
  /** Callback when OCR text changes */
  onOcrTextChange?: (index: number, text: string) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `shape_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const DEFAULT_STYLE: ShapeStyle = {
  fill: "transparent",
  stroke: "#3b82f6",
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,
  fontFamily: "sans-serif",
};

const MARK_STYLE: ShapeStyle = {
  fill: "rgba(59, 130, 246, 0.08)",
  stroke: "#3b82f6",
  strokeWidth: 2,
  opacity: 1,
  fontSize: 16,
  fontFamily: "sans-serif",
};

// ============================================================================
// Toolbar Button
// ============================================================================

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
  shortcutHint,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  shortcutHint?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={shortcutHint ? `${label} (${shortcutHint})` : label}
      className={cn(
        "relative flex items-center justify-center rounded-md p-1.5 transition-colors",
        disabled && "pointer-events-none opacity-30",
        active
          ? "bg-blue-500/20 text-blue-400"
          : "text-muted-foreground/60 hover:bg-muted/20 hover:text-muted-foreground"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

/** Manus action button — larger, with label */
function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        disabled
          ? "pointer-events-none opacity-30"
          : "text-muted-foreground/70 hover:bg-muted/20 hover:text-muted-foreground"
      )}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

// ============================================================================
// Text Edit Overlay (positioned in screen space above Konva stage)
// ============================================================================

function TextEditOverlay({
  x,
  y,
  width,
  height,
  text,
  fontSize,
  onFinish,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  onFinish: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(text);

  useEffect(() => {
    textareaRef.current?.focus();
    textareaRef.current?.select();
  }, []);

  const handleBlur = useCallback(() => {
    onFinish(value);
  }, [value, onFinish]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onFinish(value);
      }
      if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
        e.preventDefault();
        onFinish(value);
      }
    },
    [value, onFinish]
  );

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="fixed z-50 resize-none rounded border border-blue-500 bg-background/95 p-1 text-foreground outline-none"
      style={{
        left: x,
        top: y,
        width: Math.max(width, 80),
        height: Math.max(height, 30),
        fontSize,
        lineHeight: 1.3,
      }}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AICanvasView({
  content,
  onStateChange,
  onUpscale,
  onRemoveBg,
  onMarkingComplete,
  onAnnotationsChange,
  initialAnnotations,
  editTextMode: editTextModeProp,
  ocrAnnotations,
  onOcrTextChange,
}: AICanvasViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  // Konva SSR guard — dynamically import react-konva
  const [konvaLoaded, setKonvaLoaded] = useState(false);
  useEffect(() => {
    import("react-konva").then((mod) => {
      Stage = mod.Stage;
      Layer = mod.Layer;
      Rect = mod.Rect;
      Line = mod.Line;
      Text = mod.Text;
      Image = mod.Image;
      Transformer = mod.Transformer;
      Group = mod.Group;
      setKonvaLoaded(true);
    });
  }, []);

  // Canvas dimensions (from container)
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // State
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<CanvasToolType>("select");
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 });
  const [showGrid, setShowGrid] = useState(false);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [temporaryPan, setTemporaryPan] = useState(false);
  const [nextZIndex, setNextZIndex] = useState(1);
  const [annotations, setAnnotations] = useState<Annotation[]>(
    initialAnnotations ?? []
  );
  const [editTextMode, setEditTextMode] = useState(false);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const drawingPointsRef = useRef<number[]>([]);
  const drawingStartRef = useRef<Point | null>(null);
  const [drawingPreviewPoints, setDrawingPreviewPoints] = useState<number[]>([]);
  const [markPreview, setMarkPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [rectPreview, setRectPreview] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Background image
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(
    null
  );
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const contentProcessedRef = useRef<string | null>(null);

  // Effective tool (considering temporary pan via space bar)
  const effectiveTool: CanvasToolType = temporaryPan ? "pan" : activeTool;

  // Sync state to external consumer (e.g. Redux aiCanvasEditor slice)
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;
  useEffect(() => {
    onStateChangeRef.current?.({
      shapes,
      selectedIds,
      activeTool,
      zoom: camera.z,
      showGrid,
    });
  }, [shapes, selectedIds, activeTool, camera.z, showGrid]);

  // Load background image from content prop
  useEffect(() => {
    if (!content || content === contentProcessedRef.current) return;
    contentProcessedRef.current = content;

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      setImageElement(img);
      setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

      // Auto-fit: center the image in the viewport
      const scaleX = stageSize.width / img.naturalWidth;
      const scaleY = stageSize.height / img.naturalHeight;
      const scale = Math.min(scaleX, scaleY, 1) * 0.9; // 90% fit with margin
      setCamera({
        x: (stageSize.width - img.naturalWidth * scale) / 2,
        y: (stageSize.height - img.naturalHeight * scale) / 2,
        z: scale,
      });
    };
    img.src = content;
  }, [content, stageSize.width, stageSize.height]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for temporary pan
      if (e.code === "Space" && !e.repeat && editingTextId === null) {
        e.preventDefault();
        setTemporaryPan(true);
        return;
      }

      // Delete/Backspace to remove selected
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedIds.length > 0 &&
        editingTextId === null
      ) {
        e.preventDefault();
        setShapes((prev) => prev.filter((s) => !selectedIds.includes(s.id)));
        setSelectedIds([]);
        return;
      }

      // Escape to deselect
      if (e.key === "Escape") {
        setSelectedIds([]);
        setEditingTextId(null);
        return;
      }

      // Tool shortcuts
      if (editingTextId !== null) return;
      switch (e.key.toLowerCase()) {
        case "v":
          setActiveTool("select");
          break;
        case "h":
          setActiveTool("pan");
          break;
        case "m":
          setActiveTool("mark");
          break;
        case "p":
          setActiveTool("draw");
          break;
        case "t":
          setActiveTool("text");
          break;
        case "r":
          setActiveTool("rectangle");
          break;
        case "e":
          setActiveTool("eraser");
          break;
        case "g":
          setShowGrid((prev) => !prev);
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setTemporaryPan(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [selectedIds, editingTextId]);

  // ── Scroll wheel zoom ──
  const handleWheel = useCallback(
    (e: any) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;

      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const oldScale = camera.z;
      const scaleBy = 1.08;
      const newScale =
        e.evt.deltaY > 0
          ? Math.max(0.1, oldScale / scaleBy)
          : Math.min(5, oldScale * scaleBy);

      const mousePointTo = {
        x: (pointer.x - camera.x) / oldScale,
        y: (pointer.y - camera.y) / oldScale,
      };

      setCamera({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
        z: newScale,
      });
    },
    [camera]
  );

  // ── Stage mouse handlers ──
  const handleStageMouseDown = useCallback(
    (e: any) => {
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      // Convert to canvas coordinates
      const canvasX = (pointer.x - camera.x) / camera.z;
      const canvasY = (pointer.y - camera.y) / camera.z;

      switch (effectiveTool) {
        case "pan": {
          // Pan is handled by Konva stage draggable
          break;
        }

        case "select": {
          // Check if clicking on a shape — Konva handles click on individual shapes
          const clickedShape = e.target;
          if (clickedShape === stage || clickedShape.getLayer() === clickedShape) {
            // Clicked on empty stage — deselect
            setSelectedIds([]);
            if (transformerRef.current) {
              transformerRef.current.nodes([]);
            }
          }
          break;
        }

        case "mark": {
          setIsDrawing(true);
          drawingStartRef.current = { x: canvasX, y: canvasY };
          setMarkPreview({
            x: canvasX,
            y: canvasY,
            width: 0,
            height: 0,
          });
          break;
        }

        case "draw": {
          setIsDrawing(true);
          drawingPointsRef.current = [canvasX, canvasY];
          setDrawingPreviewPoints([canvasX, canvasY]);
          break;
        }

        case "rectangle": {
          setIsDrawing(true);
          drawingStartRef.current = { x: canvasX, y: canvasY };
          setRectPreview({
            x: canvasX,
            y: canvasY,
            width: 0,
            height: 0,
          });
          break;
        }

        case "text": {
          const textShape: CanvasShape = {
            id: generateId(),
            kind: "text",
            x: canvasX,
            y: canvasY,
            width: 150,
            height: 30,
            rotation: 0,
            style: { ...DEFAULT_STYLE, stroke: "#e5e7eb" },
            text: "Text",
            visible: true,
            zIndex: nextZIndex,
          };
          setShapes((prev) => [...prev, textShape]);
          setNextZIndex((n) => n + 1);
          setEditingTextId(textShape.id);
          break;
        }

        case "eraser": {
          const clicked = e.target;
          if (clicked !== stage && clicked.id?.()) {
            const shapeId = clicked.id();
            setShapes((prev) => prev.filter((s) => s.id !== shapeId));
          }
          break;
        }
      }
    },
    [effectiveTool, camera, nextZIndex]
  );

  const handleStageMouseMove = useCallback(
    (e: any) => {
      if (!isDrawing) return;
      const stage = stageRef.current;
      if (!stage) return;
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const canvasX = (pointer.x - camera.x) / camera.z;
      const canvasY = (pointer.y - camera.y) / camera.z;

      if (effectiveTool === "draw") {
        drawingPointsRef.current = [
          ...drawingPointsRef.current,
          canvasX,
          canvasY,
        ];
        setDrawingPreviewPoints([...drawingPointsRef.current]);
      } else if (effectiveTool === "mark" && drawingStartRef.current) {
        const start = drawingStartRef.current;
        setMarkPreview({
          x: Math.min(start.x, canvasX),
          y: Math.min(start.y, canvasY),
          width: Math.abs(canvasX - start.x),
          height: Math.abs(canvasY - start.y),
        });
      } else if (effectiveTool === "rectangle" && drawingStartRef.current) {
        const start = drawingStartRef.current;
        setRectPreview({
          x: Math.min(start.x, canvasX),
          y: Math.min(start.y, canvasY),
          width: Math.abs(canvasX - start.x),
          height: Math.abs(canvasY - start.y),
        });
      }
    },
    [isDrawing, effectiveTool, camera]
  );

  const handleStageMouseUp = useCallback(() => {
    if (!isDrawing) return;

    if (effectiveTool === "draw") {
      const points = drawingPointsRef.current;
      if (points.length >= 4) {
        // Find bounds
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;
        for (let i = 0; i < points.length; i += 2) {
          if (points[i]! < minX) minX = points[i]!;
          if (points[i + 1]! < minY) minY = points[i + 1]!;
          if (points[i]! > maxX) maxX = points[i]!;
          if (points[i + 1]! > maxY) maxY = points[i + 1]!;
        }
        // Normalize points relative to shape origin
        const normalizedPoints: number[] = [];
        for (let i = 0; i < points.length; i += 2) {
          normalizedPoints.push(points[i]! - minX, points[i + 1]! - minY);
        }
        const pathShape: CanvasShape = {
          id: generateId(),
          kind: "path",
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
          rotation: 0,
          style: { ...DEFAULT_STYLE },
          points: [], // stored as flat array in Konva
          visible: true,
          zIndex: nextZIndex,
        };
        // Store flat points array for Konva Line
        (pathShape as any)._flatPoints = normalizedPoints;
        setShapes((prev) => [...prev, pathShape]);
        setNextZIndex((n) => n + 1);
      }
      drawingPointsRef.current = [];
      setDrawingPreviewPoints([]);
    } else if (effectiveTool === "mark" && markPreview) {
      if (markPreview.width > 5 && markPreview.height > 5) {
        const markShape: CanvasShape = {
          id: generateId(),
          kind: "mark",
          x: markPreview.x,
          y: markPreview.y,
          width: markPreview.width,
          height: markPreview.height,
          rotation: 0,
          style: { ...MARK_STYLE },
          visible: true,
          zIndex: nextZIndex,
        };
        setShapes((prev) => [...prev, markShape]);
        setNextZIndex((n) => n + 1);

        // Create annotation entry
        const newAnnotation: Annotation = {
          id: markShape.id,
          imageId: content ?? "",
          x: markPreview.x,
          y: markPreview.y,
          width: markPreview.width,
          height: markPreview.height,
          text: "",
        };
        setAnnotations((prev) => {
          const next = [...prev, newAnnotation];
          onAnnotationsChange?.(next);
          return next;
        });

        onMarkingComplete?.({
          imageId: content ?? "",
          x: markPreview.x,
          y: markPreview.y,
          width: markPreview.width,
          height: markPreview.height,
        });
      }
      setMarkPreview(null);
    } else if (effectiveTool === "rectangle" && rectPreview) {
      if (rectPreview.width > 3 && rectPreview.height > 3) {
        const rectShape: CanvasShape = {
          id: generateId(),
          kind: "rect",
          x: rectPreview.x,
          y: rectPreview.y,
          width: rectPreview.width,
          height: rectPreview.height,
          rotation: 0,
          style: {
            ...DEFAULT_STYLE,
            fill: "rgba(59, 130, 246, 0.1)",
          },
          visible: true,
          zIndex: nextZIndex,
        };
        setShapes((prev) => [...prev, rectShape]);
        setNextZIndex((n) => n + 1);
      }
      setRectPreview(null);
    }

    setIsDrawing(false);
    drawingStartRef.current = null;
  }, [
    isDrawing,
    effectiveTool,
    markPreview,
    rectPreview,
    nextZIndex,
    content,
    onMarkingComplete,
    onAnnotationsChange,
  ]);

  // ── Shape click handler ──
  const handleShapeClick = useCallback(
    (e: any, shapeId: string) => {
      if (effectiveTool === "eraser") {
        setShapes((prev) => prev.filter((s) => s.id !== shapeId));
        return;
      }
      if (effectiveTool !== "select") return;

      e.cancelBubble = true;
      const isShift = e.evt.shiftKey;

      if (isShift) {
        setSelectedIds((prev) =>
          prev.includes(shapeId)
            ? prev.filter((id) => id !== shapeId)
            : [...prev, shapeId]
        );
      } else {
        setSelectedIds([shapeId]);
      }
    },
    [effectiveTool]
  );

  // ── Shape double-click for text editing ──
  const handleShapeDblClick = useCallback(
    (shapeId: string) => {
      const shape = shapes.find((s) => s.id === shapeId);
      if (shape?.kind === "text") {
        setEditingTextId(shapeId);
      }
    },
    [shapes]
  );

  // ── Text edit finish ──
  const handleTextEditFinish = useCallback(
    (text: string) => {
      if (editingTextId) {
        setShapes((prev) =>
          prev.map((s) => (s.id === editingTextId ? { ...s, text } : s))
        );
      }
      setEditingTextId(null);
    },
    [editingTextId]
  );

  // ── Transformer update (selection handles) ──
  useEffect(() => {
    if (!konvaLoaded || !transformerRef.current || !stageRef.current) return;
    const stage = stageRef.current;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter(Boolean);
    transformerRef.current.nodes(nodes);
    transformerRef.current.getLayer()?.batchDraw();
  }, [selectedIds, konvaLoaded, shapes]);

  // ── Shape drag end (update position in state) ──
  const handleDragEnd = useCallback((e: any, shapeId: string) => {
    const node = e.target;
    setShapes((prev) =>
      prev.map((s) =>
        s.id === shapeId ? { ...s, x: node.x(), y: node.y() } : s
      )
    );
  }, []);

  // ── Transform end (update size/rotation) ──
  const handleTransformEnd = useCallback((e: any, shapeId: string) => {
    const node = e.target;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    // Reset scale and apply to width/height
    node.scaleX(1);
    node.scaleY(1);
    setShapes((prev) =>
      prev.map((s) =>
        s.id === shapeId
          ? {
              ...s,
              x: node.x(),
              y: node.y(),
              width: Math.max(5, node.width() * scaleX),
              height: Math.max(5, node.height() * scaleY),
              rotation: node.rotation(),
            }
          : s
      )
    );
  }, []);

  // ── Stage drag (pan) ──
  const handleStageDragEnd = useCallback((e: any) => {
    if (e.target === stageRef.current) {
      setCamera((prev) => ({
        ...prev,
        x: e.target.x(),
        y: e.target.y(),
      }));
    }
  }, []);

  // Sorted shapes for rendering
  const sortedShapes = useMemo(
    () => [...shapes].sort((a, b) => a.zIndex - b.zIndex),
    [shapes]
  );

  // Editing text shape info (for overlay positioning)
  const editingShape = editingTextId
    ? shapes.find((s) => s.id === editingTextId) ?? null
    : null;

  // Cursor style
  const cursorStyle = useMemo(() => {
    switch (effectiveTool) {
      case "pan":
        return "grab";
      case "draw":
      case "mark":
      case "rectangle":
        return "crosshair";
      case "text":
        return "text";
      case "eraser":
        return "pointer";
      case "select":
      default:
        return "default";
    }
  }, [effectiveTool]);

  // Manus toolbar actions
  const hasImage = !!content;

  return (
    <div ref={containerRef} className="flex h-full flex-col">
      {/* ================================================================= */}
      {/* Header */}
      {/* ================================================================= */}
      <div className="flex items-center gap-2 border-b border-border/10 bg-canvas-surface px-3 py-2">
        <PaintbrushIcon className="size-3.5 text-pink-400" />
        <span className="text-xs font-medium text-muted-foreground/70">
          AI Canvas
        </span>

        {shapes.length > 0 && (
          <span className="text-xs text-muted-foreground/40">
            {shapes.length} shape{shapes.length !== 1 ? "s" : ""}
          </span>
        )}

        <div className="flex-1" />

        {/* Manus action buttons */}
        {hasImage && (
          <div className="flex items-center gap-0.5 border-r border-border/10 pr-2">
            <ActionButton
              icon={ArrowUpIcon}
              label="Upscale"
              onClick={() => onUpscale?.(content!)}
              disabled={!onUpscale}
            />
            <ActionButton
              icon={ImageOffIcon}
              label="Remove bg"
              onClick={() => onRemoveBg?.(content!)}
              disabled={!onRemoveBg}
            />
            <ActionButton
              icon={TypeIcon}
              label="Edit text"
              onClick={() => setEditTextMode((prev) => !prev)}
            />
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => {
              const newZ = Math.max(0.1, camera.z / 1.2);
              const cx = stageSize.width / 2;
              const cy = stageSize.height / 2;
              setCamera((prev) => ({
                x: cx - ((cx - prev.x) / prev.z) * newZ,
                y: cy - ((cy - prev.y) / prev.z) * newZ,
                z: newZ,
              }));
            }}
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            title="Zoom out"
          >
            <ZoomOutIcon className="size-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground/50">
            {Math.round(camera.z * 100)}%
          </span>
          <button
            type="button"
            onClick={() => {
              const newZ = Math.min(5, camera.z * 1.2);
              const cx = stageSize.width / 2;
              const cy = stageSize.height / 2;
              setCamera((prev) => ({
                x: cx - ((cx - prev.x) / prev.z) * newZ,
                y: cy - ((cy - prev.y) / prev.z) * newZ,
                z: newZ,
              }));
            }}
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            title="Zoom in"
          >
            <ZoomInIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() =>
              setCamera({ x: 0, y: 0, z: 1 })
            }
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            title="Reset view"
          >
            <RotateCcwIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Toolbar */}
      {/* ================================================================= */}
      <div className="flex items-center gap-0.5 border-b border-border/10 bg-canvas-surface px-2 py-1">
        <ToolbarButton
          icon={MousePointerIcon}
          label="Select"
          shortcutHint="V"
          active={activeTool === "select" && !temporaryPan}
          onClick={() => setActiveTool("select")}
        />
        <ToolbarButton
          icon={HandIcon}
          label="Pan"
          shortcutHint="H"
          active={activeTool === "pan" || temporaryPan}
          onClick={() => setActiveTool("pan")}
        />

        <div className="mx-1 h-4 w-px bg-border/20" />

        <ToolbarButton
          icon={CrosshairIcon}
          label="Mark"
          shortcutHint="M"
          active={activeTool === "mark"}
          onClick={() => setActiveTool("mark")}
        />
        <ToolbarButton
          icon={PenToolIcon}
          label="Draw"
          shortcutHint="P"
          active={activeTool === "draw"}
          onClick={() => setActiveTool("draw")}
        />
        <ToolbarButton
          icon={TypeIcon}
          label="Text"
          shortcutHint="T"
          active={activeTool === "text"}
          onClick={() => setActiveTool("text")}
        />
        <ToolbarButton
          icon={SquareIcon}
          label="Rectangle"
          shortcutHint="R"
          active={activeTool === "rectangle"}
          onClick={() => setActiveTool("rectangle")}
        />

        <div className="mx-1 h-4 w-px bg-border/20" />

        <ToolbarButton
          icon={EraserIcon}
          label="Eraser"
          shortcutHint="E"
          active={activeTool === "eraser"}
          onClick={() => setActiveTool("eraser")}
        />

        <div className="mx-1 h-4 w-px bg-border/20" />

        <ToolbarButton
          icon={GridIcon}
          label="Toggle grid"
          shortcutHint="G"
          active={showGrid}
          onClick={() => setShowGrid((prev) => !prev)}
        />

        {selectedIds.length > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-border/20" />
            <ToolbarButton
              icon={Trash2Icon}
              label="Delete selected"
              shortcutHint="Del"
              onClick={() => {
                setShapes((prev) =>
                  prev.filter((s) => !selectedIds.includes(s.id))
                );
                setSelectedIds([]);
              }}
            />
            <span className="text-xs text-muted-foreground/40">
              {selectedIds.length} selected
            </span>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* OCR Edit Text Mode indicator */}
      {/* ================================================================= */}
      {(editTextMode || editTextModeProp) && (
        <div className="flex items-center gap-2 border-b border-blue-500/20 bg-blue-500/5 px-3 py-1.5">
          <TypeIcon className="size-3 text-blue-400" />
          <span className="text-xs text-blue-400">
            Edit Text mode — OCR processing...
          </span>
        </div>
      )}

      {/* ================================================================= */}
      {/* Konva Canvas */}
      {/* ================================================================= */}
      <div
        className="relative flex-1 overflow-hidden bg-canvas-deep"
        style={{ cursor: cursorStyle }}
      >
        {konvaLoaded ? (
          <>
            <Stage
              ref={stageRef}
              width={stageSize.width}
              height={stageSize.height}
              scaleX={camera.z}
              scaleY={camera.z}
              x={camera.x}
              y={camera.y}
              draggable={effectiveTool === "pan"}
              onWheel={handleWheel}
              onMouseDown={handleStageMouseDown}
              onMouseMove={handleStageMouseMove}
              onMouseUp={handleStageMouseUp}
              onDragEnd={handleStageDragEnd}
            >
              {/* Layer 1: Background image + grid */}
              <Layer>
                {/* Grid pattern */}
                {showGrid &&
                  (() => {
                    const gridSize = 20;
                    const gridLines: React.ReactElement[] = [];
                    const viewWidth = stageSize.width / camera.z + 100;
                    const viewHeight = stageSize.height / camera.z + 100;
                    const startX =
                      Math.floor(-camera.x / camera.z / gridSize) * gridSize -
                      gridSize;
                    const startY =
                      Math.floor(-camera.y / camera.z / gridSize) * gridSize -
                      gridSize;

                    for (
                      let x = startX;
                      x < startX + viewWidth + gridSize * 2;
                      x += gridSize
                    ) {
                      gridLines.push(
                        <Line
                          key={`gv-${x}`}
                          points={[x, startY, x, startY + viewHeight + gridSize * 2]}
                          stroke="rgba(128, 128, 128, 0.12)"
                          strokeWidth={0.5}
                          listening={false}
                        />
                      );
                    }
                    for (
                      let y = startY;
                      y < startY + viewHeight + gridSize * 2;
                      y += gridSize
                    ) {
                      gridLines.push(
                        <Line
                          key={`gh-${y}`}
                          points={[startX, y, startX + viewWidth + gridSize * 2, y]}
                          stroke="rgba(128, 128, 128, 0.12)"
                          strokeWidth={0.5}
                          listening={false}
                        />
                      );
                    }
                    return gridLines;
                  })()}

                {/* Background image */}
                {imageElement && (
                  <Image
                    image={imageElement}
                    x={0}
                    y={0}
                    width={imageDimensions?.width ?? imageElement.naturalWidth}
                    height={
                      imageDimensions?.height ?? imageElement.naturalHeight
                    }
                    listening={false}
                  />
                )}
              </Layer>

              {/* Layer 2: Shapes (annotations, drawings, text) */}
              <Layer>
                {sortedShapes.map((shape) => {
                  if (!shape.visible) return null;

                  const isSelected = selectedIds.includes(shape.id);
                  const isDraggable = effectiveTool === "select";
                  const commonProps = {
                    id: shape.id,
                    x: shape.x,
                    y: shape.y,
                    rotation: shape.rotation,
                    draggable: isDraggable,
                    onClick: (e: any) => handleShapeClick(e, shape.id),
                    onDblClick: () => handleShapeDblClick(shape.id),
                    onDragEnd: (e: any) => handleDragEnd(e, shape.id),
                    onTransformEnd: (e: any) =>
                      handleTransformEnd(e, shape.id),
                  };

                  switch (shape.kind) {
                    case "rect":
                      return (
                        <Rect
                          key={shape.id}
                          {...commonProps}
                          width={shape.width}
                          height={shape.height}
                          fill={shape.style.fill}
                          stroke={shape.style.stroke}
                          strokeWidth={shape.style.strokeWidth}
                          cornerRadius={2}
                          opacity={shape.style.opacity}
                        />
                      );

                    case "mark":
                      return (
                        <Rect
                          key={shape.id}
                          {...commonProps}
                          width={shape.width}
                          height={shape.height}
                          fill={shape.style.fill}
                          stroke={shape.style.stroke}
                          strokeWidth={shape.style.strokeWidth}
                          dash={[6, 3]}
                          opacity={shape.style.opacity}
                        />
                      );

                    case "path": {
                      const flatPts =
                        (shape as any)._flatPoints ??
                        (shape.points
                          ? shape.points.flatMap((p) => [p.x, p.y])
                          : []);
                      if (flatPts.length < 4) return null;
                      return (
                        <Line
                          key={shape.id}
                          {...commonProps}
                          points={flatPts}
                          stroke={shape.style.stroke}
                          strokeWidth={shape.style.strokeWidth}
                          lineCap="round"
                          lineJoin="round"
                          tension={0.3}
                          opacity={shape.style.opacity}
                        />
                      );
                    }

                    case "text":
                      return (
                        <Text
                          key={shape.id}
                          {...commonProps}
                          text={shape.text ?? ""}
                          width={shape.width}
                          fontSize={shape.style.fontSize}
                          fontFamily={shape.style.fontFamily}
                          fill={shape.style.stroke}
                          opacity={shape.style.opacity}
                        />
                      );

                    case "image":
                      // Individual image shapes (not background)
                      return null;

                    default:
                      return null;
                  }
                })}

                {/* Drawing preview (freehand) */}
                {isDrawing &&
                  effectiveTool === "draw" &&
                  drawingPreviewPoints.length >= 4 && (
                    <Line
                      points={drawingPreviewPoints}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      lineCap="round"
                      lineJoin="round"
                      tension={0.3}
                      opacity={0.7}
                      listening={false}
                    />
                  )}

                {/* Mark preview (dashed blue rect) */}
                {markPreview && (
                  <Rect
                    x={markPreview.x}
                    y={markPreview.y}
                    width={markPreview.width}
                    height={markPreview.height}
                    fill="rgba(59, 130, 246, 0.08)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 3]}
                    listening={false}
                  />
                )}

                {/* Rectangle drawing preview */}
                {rectPreview && (
                  <Rect
                    x={rectPreview.x}
                    y={rectPreview.y}
                    width={rectPreview.width}
                    height={rectPreview.height}
                    fill="rgba(59, 130, 246, 0.1)"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dash={[6, 3]}
                    cornerRadius={2}
                    listening={false}
                  />
                )}

                {/* OCR annotation overlays */}
                {(editTextMode || editTextModeProp) &&
                  ocrAnnotations?.map((ann, i) => (
                    <Group key={`ocr-${i}`}>
                      <Rect
                        x={ann.x}
                        y={ann.y}
                        width={ann.width}
                        height={ann.height}
                        fill="rgba(59, 130, 246, 0.05)"
                        stroke="#3b82f6"
                        strokeWidth={1}
                      />
                      <Text
                        x={ann.x + 2}
                        y={ann.y + 2}
                        text={ann.text}
                        fontSize={12}
                        fill="#3b82f6"
                        width={ann.width - 4}
                      />
                    </Group>
                  ))}
              </Layer>

              {/* Layer 3: Selection transformer */}
              <Layer>
                <Transformer
                  ref={transformerRef}
                  boundBoxFunc={(_oldBox: any, newBox: any) => {
                    // Minimum size
                    if (newBox.width < 5 || newBox.height < 5) {
                      return _oldBox;
                    }
                    return newBox;
                  }}
                  borderStroke="#3b82f6"
                  borderStrokeWidth={1}
                  anchorFill="#3b82f6"
                  anchorStroke="#fff"
                  anchorSize={8}
                  anchorCornerRadius={2}
                  rotateEnabled={true}
                  keepRatio={false}
                />
              </Layer>
            </Stage>

            {/* Text editing overlay (positioned in screen space) */}
            {editingShape && (
              <TextEditOverlay
                x={editingShape.x * camera.z + camera.x}
                y={editingShape.y * camera.z + camera.y}
                width={editingShape.width * camera.z}
                height={editingShape.height * camera.z}
                text={editingShape.text ?? ""}
                fontSize={editingShape.style.fontSize * camera.z}
                onFinish={handleTextEditFinish}
              />
            )}
          </>
        ) : (
          /* Loading state while Konva imports */
          <div className="flex h-full items-center justify-center">
            <div className="size-6 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
          </div>
        )}

        {/* Empty state */}
        {shapes.length === 0 && !content && konvaLoaded && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground/40">
              <PaintbrushIcon className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-sm">Canvas workspace</p>
              <p className="mt-1 text-xs text-muted-foreground/30">
                Draw, annotate, and create with AI
              </p>
              <p className="mt-2 text-xs text-muted-foreground/25">
                Space to pan -- Scroll to zoom -- V/H/M/P/T/R/E for tools
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
