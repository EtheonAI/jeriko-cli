"use client";

import * as React from "react";
import {
  useState,
  useReducer,
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
} from "lucide-react";
import { cn } from "@repo/design-system/lib/utils";

// ============================================================================
// Types
// ============================================================================

export type CanvasToolType =
  | "select"
  | "pan"
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
  | "image";

export interface CanvasShape {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  style: ShapeStyle;
  // For text shapes
  text?: string;
  // For image shapes
  imageUrl?: string;
  // For path/freehand shapes
  points?: Point[];
  // Visibility/order
  visible: boolean;
  zIndex: number;
}

// ============================================================================
// Reducer (local state -- no Redux dependency)
// ============================================================================

interface CanvasEditorState {
  shapes: CanvasShape[];
  selectedIds: string[];
  camera: Camera;
  activeTool: CanvasToolType;
  isDrawing: boolean;
  drawingPoints: Point[];
  drawingStart: Point | null;
  brushing: {
    active: boolean;
    start: Point | null;
    current: Point | null;
  };
  showGrid: boolean;
  nextZIndex: number;
  editingTextId: string | null;
}

type CanvasAction =
  | { type: "SET_TOOL"; tool: CanvasToolType }
  | { type: "ADD_SHAPE"; shape: CanvasShape }
  | { type: "UPDATE_SHAPE"; id: string; updates: Partial<CanvasShape> }
  | { type: "DELETE_SHAPES"; ids: string[] }
  | { type: "SET_SELECTED"; ids: string[] }
  | { type: "TOGGLE_SELECT"; id: string }
  | { type: "SET_CAMERA"; camera: Partial<Camera> }
  | { type: "ZOOM"; delta: number; center: Point }
  | { type: "PAN"; dx: number; dy: number }
  | { type: "RESET_VIEW" }
  | { type: "START_DRAWING"; point: Point }
  | { type: "CONTINUE_DRAWING"; point: Point }
  | { type: "FINISH_DRAWING" }
  | { type: "START_RECT"; point: Point }
  | { type: "CONTINUE_RECT"; point: Point }
  | { type: "FINISH_RECT" }
  | { type: "START_BRUSHING"; point: Point }
  | { type: "CONTINUE_BRUSHING"; point: Point }
  | { type: "FINISH_BRUSHING"; shapeIds: string[] }
  | { type: "TOGGLE_GRID" }
  | { type: "SET_EDITING_TEXT"; id: string | null }
  | { type: "MOVE_SHAPES"; ids: string[]; dx: number; dy: number };

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

function createInitialState(): CanvasEditorState {
  return {
    shapes: [],
    selectedIds: [],
    camera: { x: 0, y: 0, z: 1 },
    activeTool: "select",
    isDrawing: false,
    drawingPoints: [],
    drawingStart: null,
    brushing: { active: false, start: null, current: null },
    showGrid: false,
    nextZIndex: 1,
    editingTextId: null,
  };
}

function canvasReducer(
  state: CanvasEditorState,
  action: CanvasAction
): CanvasEditorState {
  switch (action.type) {
    case "SET_TOOL":
      return {
        ...state,
        activeTool: action.tool,
        isDrawing: false,
        drawingPoints: [],
        drawingStart: null,
        editingTextId: null,
      };

    case "ADD_SHAPE":
      return {
        ...state,
        shapes: [...state.shapes, action.shape],
        nextZIndex: state.nextZIndex + 1,
      };

    case "UPDATE_SHAPE":
      return {
        ...state,
        shapes: state.shapes.map((s) =>
          s.id === action.id ? { ...s, ...action.updates } : s
        ),
      };

    case "DELETE_SHAPES":
      return {
        ...state,
        shapes: state.shapes.filter((s) => !action.ids.includes(s.id)),
        selectedIds: state.selectedIds.filter(
          (id) => !action.ids.includes(id)
        ),
      };

    case "SET_SELECTED":
      return { ...state, selectedIds: action.ids };

    case "TOGGLE_SELECT": {
      const idx = state.selectedIds.indexOf(action.id);
      return {
        ...state,
        selectedIds:
          idx === -1
            ? [...state.selectedIds, action.id]
            : state.selectedIds.filter((id) => id !== action.id),
      };
    }

    case "SET_CAMERA":
      return {
        ...state,
        camera: { ...state.camera, ...action.camera },
      };

    case "ZOOM": {
      const newZ = Math.min(5, Math.max(0.1, state.camera.z + action.delta));
      const scaleFactor = newZ / state.camera.z;
      return {
        ...state,
        camera: {
          x: action.center.x - (action.center.x - state.camera.x) * scaleFactor,
          y: action.center.y - (action.center.y - state.camera.y) * scaleFactor,
          z: newZ,
        },
      };
    }

    case "PAN":
      return {
        ...state,
        camera: {
          ...state.camera,
          x: state.camera.x + action.dx,
          y: state.camera.y + action.dy,
        },
      };

    case "RESET_VIEW":
      return {
        ...state,
        camera: { x: 0, y: 0, z: 1 },
      };

    case "START_DRAWING":
      return {
        ...state,
        isDrawing: true,
        drawingPoints: [action.point],
      };

    case "CONTINUE_DRAWING":
      return {
        ...state,
        drawingPoints: [...state.drawingPoints, action.point],
      };

    case "FINISH_DRAWING": {
      if (state.drawingPoints.length < 2) {
        return { ...state, isDrawing: false, drawingPoints: [] };
      }
      const bounds = getBoundsFromPoints(state.drawingPoints);
      const newShape: CanvasShape = {
        id: generateId(),
        kind: "path",
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
        rotation: 0,
        style: { ...DEFAULT_STYLE },
        points: state.drawingPoints.map((p) => ({
          x: p.x - bounds.minX,
          y: p.y - bounds.minY,
        })),
        visible: true,
        zIndex: state.nextZIndex,
      };
      return {
        ...state,
        isDrawing: false,
        drawingPoints: [],
        shapes: [...state.shapes, newShape],
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case "START_RECT":
      return {
        ...state,
        isDrawing: true,
        drawingStart: action.point,
      };

    case "CONTINUE_RECT":
      return {
        ...state,
        drawingPoints: [action.point],
      };

    case "FINISH_RECT": {
      if (!state.drawingStart || state.drawingPoints.length === 0) {
        return { ...state, isDrawing: false, drawingStart: null, drawingPoints: [] };
      }
      const end = state.drawingPoints[0]!;
      const rx = Math.min(state.drawingStart.x, end.x);
      const ry = Math.min(state.drawingStart.y, end.y);
      const rw = Math.abs(end.x - state.drawingStart.x);
      const rh = Math.abs(end.y - state.drawingStart.y);
      if (rw < 3 && rh < 3) {
        return { ...state, isDrawing: false, drawingStart: null, drawingPoints: [] };
      }
      const rectShape: CanvasShape = {
        id: generateId(),
        kind: "rect",
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        rotation: 0,
        style: { ...DEFAULT_STYLE, fill: "rgba(59, 130, 246, 0.1)" },
        visible: true,
        zIndex: state.nextZIndex,
      };
      return {
        ...state,
        isDrawing: false,
        drawingStart: null,
        drawingPoints: [],
        shapes: [...state.shapes, rectShape],
        nextZIndex: state.nextZIndex + 1,
      };
    }

    case "START_BRUSHING":
      return {
        ...state,
        brushing: {
          active: true,
          start: action.point,
          current: action.point,
        },
      };

    case "CONTINUE_BRUSHING":
      return {
        ...state,
        brushing: {
          ...state.brushing,
          current: action.point,
        },
      };

    case "FINISH_BRUSHING":
      return {
        ...state,
        brushing: { active: false, start: null, current: null },
        selectedIds: action.shapeIds,
      };

    case "TOGGLE_GRID":
      return { ...state, showGrid: !state.showGrid };

    case "SET_EDITING_TEXT":
      return { ...state, editingTextId: action.id };

    case "MOVE_SHAPES":
      return {
        ...state,
        shapes: state.shapes.map((s) =>
          action.ids.includes(s.id)
            ? { ...s, x: s.x + action.dx, y: s.y + action.dy }
            : s
        ),
      };

    default:
      return state;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function getBoundsFromPoints(points: Point[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

function pointsToSvgPath(points: Point[]): string {
  if (points.length === 0) return "";
  const [first, ...rest] = points;
  let d = `M ${first!.x} ${first!.y}`;
  for (const p of rest) {
    d += ` L ${p.x} ${p.y}`;
  }
  return d;
}

function screenToCanvas(
  screenX: number,
  screenY: number,
  camera: Camera,
  svgRect: DOMRect
): Point {
  return {
    x: (screenX - svgRect.left - camera.x) / camera.z,
    y: (screenY - svgRect.top - camera.y) / camera.z,
  };
}

function hitTestShape(shape: CanvasShape, point: Point): boolean {
  if (shape.kind === "path" && shape.points) {
    // Check proximity to path segments
    for (let i = 1; i < shape.points.length; i++) {
      const a = shape.points[i - 1]!;
      const b = shape.points[i]!;
      const ax = a.x + shape.x;
      const ay = a.y + shape.y;
      const bx = b.x + shape.x;
      const by = b.y + shape.y;
      const dist = distToSegment(point, { x: ax, y: ay }, { x: bx, y: by });
      if (dist < 8) return true;
    }
    return false;
  }
  // Bounding box test for rect, text, image, ellipse
  return (
    point.x >= shape.x &&
    point.x <= shape.x + shape.width &&
    point.y >= shape.y &&
    point.y <= shape.y + shape.height
  );
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function shapesInRect(
  shapes: CanvasShape[],
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string[] {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  return shapes
    .filter((s) => {
      const sx = s.x;
      const sy = s.y;
      const sx2 = s.x + s.width;
      const sy2 = s.y + s.height;
      return sx < maxX && sx2 > minX && sy < maxY && sy2 > minY;
    })
    .map((s) => s.id);
}

// ============================================================================
// Props
// ============================================================================

export interface AICanvasViewProps {
  /** Image URL or data URI from generate_image tool output */
  content?: string;
}

// ============================================================================
// Toolbar Button
// ============================================================================

function ToolbarButton({
  icon: Icon,
  label,
  active,
  onClick,
  shortcutHint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  onClick: () => void;
  shortcutHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcutHint ? `${label} (${shortcutHint})` : label}
      className={cn(
        "relative flex items-center justify-center rounded-md p-1.5 transition-colors",
        active
          ? "bg-blue-500/20 text-blue-400"
          : "text-muted-foreground/60 hover:bg-muted/20 hover:text-muted-foreground"
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

// ============================================================================
// SVG Shape Renderers
// ============================================================================

function RenderShape({
  shape,
  isSelected,
  isHovered,
  onMouseDown,
  onMouseEnter,
  onMouseLeave,
  onDoubleClick,
}: {
  shape: CanvasShape;
  isSelected: boolean;
  isHovered: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onDoubleClick: (e: React.MouseEvent) => void;
}) {
  if (!shape.visible) return null;

  const selectionStroke = isSelected ? "#3b82f6" : isHovered ? "#60a5fa" : "none";
  const selectionWidth = isSelected ? 1.5 : isHovered ? 1 : 0;

  const commonGroupProps = {
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    onDoubleClick,
    style: {
      cursor: "pointer",
      opacity: shape.style.opacity,
    } as React.CSSProperties,
  };

  switch (shape.kind) {
    case "rect":
      return (
        <g {...commonGroupProps}>
          {/* Selection outline */}
          {(isSelected || isHovered) && (
            <rect
              x={shape.x - 2}
              y={shape.y - 2}
              width={shape.width + 4}
              height={shape.height + 4}
              fill="none"
              stroke={selectionStroke}
              strokeWidth={selectionWidth}
              strokeDasharray={isSelected ? "none" : "4 2"}
              rx={2}
            />
          )}
          <rect
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            fill={shape.style.fill}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            rx={2}
          />
        </g>
      );

    case "ellipse":
      return (
        <g {...commonGroupProps}>
          {(isSelected || isHovered) && (
            <ellipse
              cx={shape.x + shape.width / 2}
              cy={shape.y + shape.height / 2}
              rx={shape.width / 2 + 2}
              ry={shape.height / 2 + 2}
              fill="none"
              stroke={selectionStroke}
              strokeWidth={selectionWidth}
              strokeDasharray={isSelected ? "none" : "4 2"}
            />
          )}
          <ellipse
            cx={shape.x + shape.width / 2}
            cy={shape.y + shape.height / 2}
            rx={shape.width / 2}
            ry={shape.height / 2}
            fill={shape.style.fill}
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
          />
        </g>
      );

    case "path": {
      if (!shape.points || shape.points.length < 2) return null;
      const translatedPoints = shape.points.map((p) => ({
        x: p.x + shape.x,
        y: p.y + shape.y,
      }));
      const d = pointsToSvgPath(translatedPoints);
      return (
        <g {...commonGroupProps}>
          {/* Wider invisible stroke for easier selection */}
          <path
            d={d}
            fill="none"
            stroke="transparent"
            strokeWidth={Math.max(12, shape.style.strokeWidth + 8)}
          />
          {(isSelected || isHovered) && (
            <path
              d={d}
              fill="none"
              stroke={selectionStroke}
              strokeWidth={shape.style.strokeWidth + 3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <path
            d={d}
            fill="none"
            stroke={shape.style.stroke}
            strokeWidth={shape.style.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      );
    }

    case "text":
      return (
        <g {...commonGroupProps}>
          {(isSelected || isHovered) && (
            <rect
              x={shape.x - 4}
              y={shape.y - 4}
              width={shape.width + 8}
              height={shape.height + 8}
              fill="none"
              stroke={selectionStroke}
              strokeWidth={selectionWidth}
              strokeDasharray={isSelected ? "none" : "4 2"}
              rx={2}
            />
          )}
          <foreignObject
            x={shape.x}
            y={shape.y}
            width={Math.max(shape.width, 20)}
            height={Math.max(shape.height, 20)}
          >
            <div
              style={{
                fontSize: shape.style.fontSize,
                fontFamily: shape.style.fontFamily,
                color: shape.style.stroke,
                width: "100%",
                height: "100%",
                overflow: "hidden",
                wordBreak: "break-word",
                lineHeight: 1.3,
              }}
            >
              {shape.text || ""}
            </div>
          </foreignObject>
        </g>
      );

    case "image":
      return (
        <g {...commonGroupProps}>
          {(isSelected || isHovered) && (
            <rect
              x={shape.x - 2}
              y={shape.y - 2}
              width={shape.width + 4}
              height={shape.height + 4}
              fill="none"
              stroke={selectionStroke}
              strokeWidth={selectionWidth}
              strokeDasharray={isSelected ? "none" : "4 2"}
              rx={2}
            />
          )}
          <image
            href={shape.imageUrl}
            x={shape.x}
            y={shape.y}
            width={shape.width}
            height={shape.height}
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      );

    default:
      return null;
  }
}

// ============================================================================
// Text Edit Overlay
// ============================================================================

function TextEditOverlay({
  shape,
  camera,
  svgRect,
  onFinish,
}: {
  shape: CanvasShape;
  camera: Camera;
  svgRect: DOMRect | null;
  onFinish: (text: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(shape.text || "");

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
      // Allow Enter for multiline, Shift+Enter or Cmd+Enter finishes
      if (e.key === "Enter" && (e.shiftKey || e.metaKey)) {
        e.preventDefault();
        onFinish(value);
      }
    },
    [value, onFinish]
  );

  if (!svgRect) return null;

  const screenX = shape.x * camera.z + camera.x + svgRect.left;
  const screenY = shape.y * camera.z + camera.y + svgRect.top;
  const screenW = Math.max(shape.width * camera.z, 80);
  const screenH = Math.max(shape.height * camera.z, 30);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="fixed z-50 resize-none rounded border border-blue-500 bg-background/95 p-1 text-foreground outline-none"
      style={{
        left: screenX,
        top: screenY,
        width: screenW,
        height: screenH,
        fontSize: shape.style.fontSize * camera.z,
        fontFamily: shape.style.fontFamily,
        lineHeight: 1.3,
      }}
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AICanvasView({ content }: AICanvasViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(canvasReducer, undefined, createInitialState);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [svgRect, setSvgRect] = useState<DOMRect | null>(null);
  const [temporaryPan, setTemporaryPan] = useState(false);

  // Track drag state with refs to avoid stale closure issues in event handlers
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<Point | null>(null);
  const dragTypeRef = useRef<"pan" | "move" | "none">("none");

  // Effective tool considering temporary pan (space key)
  const effectiveTool: CanvasToolType = temporaryPan ? "pan" : state.activeTool;

  // Update SVG rect on resize
  useEffect(() => {
    const updateRect = () => {
      if (svgRef.current) {
        setSvgRect(svgRef.current.getBoundingClientRect());
      }
    };
    updateRect();
    const observer = new ResizeObserver(updateRect);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  // Add initial image shape from content prop (generate_image output)
  const contentProcessedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !content ||
      content === contentProcessedRef.current
    ) {
      return;
    }
    contentProcessedRef.current = content;

    // Place the image centered at origin
    const imgWidth = 512;
    const imgHeight = 512;
    const imageShape: CanvasShape = {
      id: generateId(),
      kind: "image",
      x: -imgWidth / 2,
      y: -imgHeight / 2,
      width: imgWidth,
      height: imgHeight,
      rotation: 0,
      style: { ...DEFAULT_STYLE },
      imageUrl: content,
      visible: true,
      zIndex: state.nextZIndex,
    };
    dispatch({ type: "ADD_SHAPE", shape: imageShape });
    // Center camera on the image
    if (svgRect) {
      dispatch({
        type: "SET_CAMERA",
        camera: {
          x: svgRect.width / 2 - imgWidth / 2,
          y: svgRect.height / 2 - imgHeight / 2,
          z: 1,
        },
      });
    }
  }, [content, svgRect]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for temporary pan mode
      if (e.code === "Space" && !e.repeat && state.editingTextId === null) {
        e.preventDefault();
        setTemporaryPan(true);
        return;
      }

      // Delete/Backspace to remove selected shapes
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        state.selectedIds.length > 0 &&
        state.editingTextId === null
      ) {
        e.preventDefault();
        dispatch({ type: "DELETE_SHAPES", ids: state.selectedIds });
        return;
      }

      // Escape to deselect or cancel
      if (e.key === "Escape") {
        dispatch({ type: "SET_SELECTED", ids: [] });
        dispatch({ type: "SET_EDITING_TEXT", id: null });
        return;
      }

      // Tool shortcuts
      if (state.editingTextId !== null) return;
      switch (e.key) {
        case "v":
        case "V":
          dispatch({ type: "SET_TOOL", tool: "select" });
          break;
        case "h":
        case "H":
          dispatch({ type: "SET_TOOL", tool: "pan" });
          break;
        case "p":
        case "P":
          dispatch({ type: "SET_TOOL", tool: "draw" });
          break;
        case "t":
        case "T":
          dispatch({ type: "SET_TOOL", tool: "text" });
          break;
        case "r":
        case "R":
          dispatch({ type: "SET_TOOL", tool: "rectangle" });
          break;
        case "e":
        case "E":
          dispatch({ type: "SET_TOOL", tool: "eraser" });
          break;
        case "g":
        case "G":
          dispatch({ type: "TOGGLE_GRID" });
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
  }, [state.selectedIds, state.editingTextId]);

  // ── Mouse wheel zoom ──
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!svgRect) return;
      const mousePos = screenToCanvas(e.clientX, e.clientY, state.camera, svgRect);
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      dispatch({
        type: "ZOOM",
        delta,
        center: { x: e.clientX - svgRect.left, y: e.clientY - svgRect.top },
      });
    },
    [state.camera, svgRect]
  );

  // ── Pointer event handlers ──
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (!svgRef.current || !svgRect) return;

      const canvasPoint = screenToCanvas(
        e.clientX,
        e.clientY,
        state.camera,
        svgRect
      );

      isDraggingRef.current = true;
      dragStartRef.current = { x: e.clientX, y: e.clientY };

      // Capture pointer for smooth dragging
      (e.target as Element).setPointerCapture?.(e.pointerId);

      switch (effectiveTool) {
        case "pan": {
          dragTypeRef.current = "pan";
          break;
        }

        case "select": {
          // Check if clicking on a shape
          const sortedShapes = [...state.shapes].sort(
            (a, b) => b.zIndex - a.zIndex
          );
          let hitShape: CanvasShape | null = null;
          for (const shape of sortedShapes) {
            if (hitTestShape(shape, canvasPoint)) {
              hitShape = shape;
              break;
            }
          }

          if (hitShape) {
            if (e.shiftKey) {
              dispatch({ type: "TOGGLE_SELECT", id: hitShape.id });
            } else if (!state.selectedIds.includes(hitShape.id)) {
              dispatch({ type: "SET_SELECTED", ids: [hitShape.id] });
            }
            dragTypeRef.current = "move";
          } else {
            // Start rubber-band selection
            dispatch({ type: "SET_SELECTED", ids: [] });
            dispatch({ type: "START_BRUSHING", point: canvasPoint });
            dragTypeRef.current = "none";
          }
          break;
        }

        case "draw": {
          dispatch({ type: "START_DRAWING", point: canvasPoint });
          dragTypeRef.current = "none";
          break;
        }

        case "rectangle": {
          dispatch({ type: "START_RECT", point: canvasPoint });
          dragTypeRef.current = "none";
          break;
        }

        case "text": {
          // Place a text shape at click position
          const textShape: CanvasShape = {
            id: generateId(),
            kind: "text",
            x: canvasPoint.x,
            y: canvasPoint.y,
            width: 150,
            height: 30,
            rotation: 0,
            style: {
              ...DEFAULT_STYLE,
              stroke: "#e5e7eb",
              fill: "transparent",
            },
            text: "Text",
            visible: true,
            zIndex: state.nextZIndex,
          };
          dispatch({ type: "ADD_SHAPE", shape: textShape });
          dispatch({ type: "SET_EDITING_TEXT", id: textShape.id });
          dragTypeRef.current = "none";
          break;
        }

        case "eraser": {
          // Delete shape under cursor
          const sortedForErase = [...state.shapes].sort(
            (a, b) => b.zIndex - a.zIndex
          );
          for (const shape of sortedForErase) {
            if (hitTestShape(shape, canvasPoint)) {
              dispatch({ type: "DELETE_SHAPES", ids: [shape.id] });
              break;
            }
          }
          dragTypeRef.current = "none";
          break;
        }
      }
    },
    [effectiveTool, state.camera, state.shapes, state.selectedIds, state.nextZIndex, svgRect]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current || !dragStartRef.current || !svgRect) return;

      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      const canvasPoint = screenToCanvas(
        e.clientX,
        e.clientY,
        state.camera,
        svgRect
      );

      switch (dragTypeRef.current) {
        case "pan":
          dispatch({ type: "PAN", dx, dy });
          dragStartRef.current = { x: e.clientX, y: e.clientY };
          break;

        case "move":
          if (state.selectedIds.length > 0) {
            dispatch({
              type: "MOVE_SHAPES",
              ids: state.selectedIds,
              dx: dx / state.camera.z,
              dy: dy / state.camera.z,
            });
            dragStartRef.current = { x: e.clientX, y: e.clientY };
          }
          break;

        default:
          // Handle tool-specific drags
          if (effectiveTool === "draw" && state.isDrawing) {
            dispatch({ type: "CONTINUE_DRAWING", point: canvasPoint });
          } else if (effectiveTool === "rectangle" && state.isDrawing) {
            dispatch({ type: "CONTINUE_RECT", point: canvasPoint });
          } else if (effectiveTool === "select" && state.brushing.active) {
            dispatch({ type: "CONTINUE_BRUSHING", point: canvasPoint });
          } else if (effectiveTool === "eraser") {
            // Continuous erasing while dragging
            const sortedForErase = [...state.shapes].sort(
              (a, b) => b.zIndex - a.zIndex
            );
            for (const shape of sortedForErase) {
              if (hitTestShape(shape, canvasPoint)) {
                dispatch({ type: "DELETE_SHAPES", ids: [shape.id] });
                break;
              }
            }
          }
          break;
      }
    },
    [state.camera, state.selectedIds, state.isDrawing, state.brushing.active, state.shapes, effectiveTool, svgRect]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      dragStartRef.current = null;

      if (!svgRect) return;

      if (effectiveTool === "draw" && state.isDrawing) {
        dispatch({ type: "FINISH_DRAWING" });
      } else if (effectiveTool === "rectangle" && state.isDrawing) {
        dispatch({ type: "FINISH_RECT" });
      } else if (effectiveTool === "select" && state.brushing.active) {
        // Finish rubber-band: select shapes inside the rectangle
        if (state.brushing.start && state.brushing.current) {
          const ids = shapesInRect(
            state.shapes,
            state.brushing.start.x,
            state.brushing.start.y,
            state.brushing.current.x,
            state.brushing.current.y
          );
          dispatch({ type: "FINISH_BRUSHING", shapeIds: ids });
        } else {
          dispatch({ type: "FINISH_BRUSHING", shapeIds: [] });
        }
      }

      dragTypeRef.current = "none";
    },
    [effectiveTool, state.isDrawing, state.brushing, state.shapes, svgRect]
  );

  // ── Double-click handler for text editing ──
  const handleShapeDoubleClick = useCallback(
    (shapeId: string) => {
      const shape = state.shapes.find((s) => s.id === shapeId);
      if (shape?.kind === "text") {
        dispatch({ type: "SET_EDITING_TEXT", id: shapeId });
      }
    },
    [state.shapes]
  );

  // ── Text edit finish ──
  const handleTextEditFinish = useCallback(
    (text: string) => {
      if (state.editingTextId) {
        dispatch({
          type: "UPDATE_SHAPE",
          id: state.editingTextId,
          updates: { text },
        });
      }
      dispatch({ type: "SET_EDITING_TEXT", id: null });
    },
    [state.editingTextId]
  );

  // ── Render current freehand drawing preview ──
  const drawingPreviewPath = useMemo(() => {
    if (!state.isDrawing || effectiveTool !== "draw" || state.drawingPoints.length < 2) {
      return null;
    }
    return pointsToSvgPath(state.drawingPoints);
  }, [state.isDrawing, effectiveTool, state.drawingPoints]);

  // ── Render current rectangle drawing preview ──
  const rectPreview = useMemo(() => {
    if (!state.isDrawing || effectiveTool !== "rectangle" || !state.drawingStart || state.drawingPoints.length === 0) {
      return null;
    }
    const end = state.drawingPoints[0]!;
    return {
      x: Math.min(state.drawingStart.x, end.x),
      y: Math.min(state.drawingStart.y, end.y),
      width: Math.abs(end.x - state.drawingStart.x),
      height: Math.abs(end.y - state.drawingStart.y),
    };
  }, [state.isDrawing, effectiveTool, state.drawingStart, state.drawingPoints]);

  // ── Rubber-band selection rectangle ──
  const brushRect = useMemo(() => {
    if (!state.brushing.active || !state.brushing.start || !state.brushing.current) {
      return null;
    }
    return {
      x: Math.min(state.brushing.start.x, state.brushing.current.x),
      y: Math.min(state.brushing.start.y, state.brushing.current.y),
      width: Math.abs(state.brushing.current.x - state.brushing.start.x),
      height: Math.abs(state.brushing.current.y - state.brushing.start.y),
    };
  }, [state.brushing]);

  // Sorted shapes for rendering (lowest zIndex first)
  const sortedShapes = useMemo(
    () => [...state.shapes].sort((a, b) => a.zIndex - b.zIndex),
    [state.shapes]
  );

  // The editing text shape
  const editingShape = state.editingTextId
    ? state.shapes.find((s) => s.id === state.editingTextId) ?? null
    : null;

  // ── Cursor style based on active tool ──
  const cursorStyle = useMemo(() => {
    switch (effectiveTool) {
      case "pan":
        return "grab";
      case "draw":
        return "crosshair";
      case "text":
        return "text";
      case "rectangle":
        return "crosshair";
      case "eraser":
        return "pointer";
      case "select":
      default:
        return "default";
    }
  }, [effectiveTool]);

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

        {/* Shape count */}
        {state.shapes.length > 0 && (
          <span className="text-xs text-muted-foreground/40">
            {state.shapes.length} shape{state.shapes.length !== 1 ? "s" : ""}
          </span>
        )}

        <div className="flex-1" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "ZOOM",
                delta: -0.15,
                center: svgRect
                  ? { x: svgRect.width / 2, y: svgRect.height / 2 }
                  : { x: 0, y: 0 },
              })
            }
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            title="Zoom out"
          >
            <ZoomOutIcon className="size-3.5" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums text-muted-foreground/50">
            {Math.round(state.camera.z * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: "ZOOM",
                delta: 0.15,
                center: svgRect
                  ? { x: svgRect.width / 2, y: svgRect.height / 2 }
                  : { x: 0, y: 0 },
              })
            }
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:bg-muted/20"
            title="Zoom in"
          >
            <ZoomInIcon className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "RESET_VIEW" })}
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
          active={state.activeTool === "select" && !temporaryPan}
          onClick={() => dispatch({ type: "SET_TOOL", tool: "select" })}
        />
        <ToolbarButton
          icon={HandIcon}
          label="Pan"
          shortcutHint="H"
          active={state.activeTool === "pan" || temporaryPan}
          onClick={() => dispatch({ type: "SET_TOOL", tool: "pan" })}
        />

        <div className="mx-1 h-4 w-px bg-border/20" />

        <ToolbarButton
          icon={PenToolIcon}
          label="Draw"
          shortcutHint="P"
          active={state.activeTool === "draw"}
          onClick={() => dispatch({ type: "SET_TOOL", tool: "draw" })}
        />
        <ToolbarButton
          icon={TypeIcon}
          label="Text"
          shortcutHint="T"
          active={state.activeTool === "text"}
          onClick={() => dispatch({ type: "SET_TOOL", tool: "text" })}
        />
        <ToolbarButton
          icon={SquareIcon}
          label="Rectangle"
          shortcutHint="R"
          active={state.activeTool === "rectangle"}
          onClick={() => dispatch({ type: "SET_TOOL", tool: "rectangle" })}
        />

        <div className="mx-1 h-4 w-px bg-border/20" />

        <ToolbarButton
          icon={EraserIcon}
          label="Eraser"
          shortcutHint="E"
          active={state.activeTool === "eraser"}
          onClick={() => dispatch({ type: "SET_TOOL", tool: "eraser" })}
        />

        <div className="mx-1 h-4 w-px bg-border/20" />

        <ToolbarButton
          icon={GridIcon}
          label="Toggle grid"
          shortcutHint="G"
          active={state.showGrid}
          onClick={() => dispatch({ type: "TOGGLE_GRID" })}
        />

        {state.selectedIds.length > 0 && (
          <>
            <div className="mx-1 h-4 w-px bg-border/20" />
            <ToolbarButton
              icon={Trash2Icon}
              label="Delete selected"
              shortcutHint="Del"
              onClick={() =>
                dispatch({ type: "DELETE_SHAPES", ids: state.selectedIds })
              }
            />
            <span className="text-xs text-muted-foreground/40">
              {state.selectedIds.length} selected
            </span>
          </>
        )}
      </div>

      {/* ================================================================= */}
      {/* SVG Canvas */}
      {/* ================================================================= */}
      <div className="relative flex-1 overflow-hidden bg-canvas-deep">
        <svg
          ref={svgRef}
          className="h-full w-full"
          style={{ cursor: cursorStyle }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
        >
          {/* Transform group: camera pan + zoom */}
          <g
            transform={`translate(${state.camera.x}, ${state.camera.y}) scale(${state.camera.z})`}
          >
            {/* Grid pattern */}
            {state.showGrid && (
              <>
                <defs>
                  <pattern
                    id="ai-canvas-grid"
                    width={20}
                    height={20}
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 20 0 L 0 0 0 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={0.3}
                      className="text-muted-foreground/20"
                    />
                  </pattern>
                </defs>
                <rect
                  x={-10000}
                  y={-10000}
                  width={20000}
                  height={20000}
                  fill="url(#ai-canvas-grid)"
                />
              </>
            )}

            {/* Origin crosshair */}
            <line
              x1={-20}
              y1={0}
              x2={20}
              y2={0}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-muted-foreground/15"
            />
            <line
              x1={0}
              y1={-20}
              x2={0}
              y2={20}
              stroke="currentColor"
              strokeWidth={0.5}
              className="text-muted-foreground/15"
            />

            {/* Render shapes */}
            {sortedShapes.map((shape) => (
              <RenderShape
                key={shape.id}
                shape={shape}
                isSelected={state.selectedIds.includes(shape.id)}
                isHovered={hoveredId === shape.id}
                onMouseDown={(e) => {
                  // Let pointer handler manage selection
                }}
                onMouseEnter={() => setHoveredId(shape.id)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={() => handleShapeDoubleClick(shape.id)}
              />
            ))}

            {/* Drawing preview (freehand) */}
            {drawingPreviewPath && (
              <path
                d={drawingPreviewPath}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.7}
              />
            )}

            {/* Rectangle drawing preview */}
            {rectPreview && (
              <rect
                x={rectPreview.x}
                y={rectPreview.y}
                width={rectPreview.width}
                height={rectPreview.height}
                fill="rgba(59, 130, 246, 0.1)"
                stroke="#3b82f6"
                strokeWidth={2}
                strokeDasharray="6 3"
                rx={2}
              />
            )}

            {/* Rubber-band selection */}
            {brushRect && (
              <rect
                x={brushRect.x}
                y={brushRect.y}
                width={brushRect.width}
                height={brushRect.height}
                fill="rgba(59, 130, 246, 0.08)"
                stroke="#3b82f6"
                strokeWidth={1}
                strokeDasharray="4 2"
              />
            )}
          </g>
        </svg>

        {/* Text editing overlay (positioned in screen space) */}
        {editingShape && (
          <TextEditOverlay
            shape={editingShape}
            camera={state.camera}
            svgRect={svgRect}
            onFinish={handleTextEditFinish}
          />
        )}

        {/* Empty state */}
        {state.shapes.length === 0 && !content && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground/40">
              <PaintbrushIcon className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-sm">Canvas workspace</p>
              <p className="mt-1 text-xs text-muted-foreground/30">
                Draw, annotate, and create with AI
              </p>
              <p className="mt-2 text-xs text-muted-foreground/25">
                Space to pan -- Scroll to zoom -- V/H/P/T/R/E for tools
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
