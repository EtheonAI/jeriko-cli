import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * AI Canvas Editor Slice
 * Manages the AI canvas editor state for drawing/editing (Manus-style aiCanvasEditor)
 *
 * Manus keys:
 * - shapes
 * - selectedShapeIds
 * - hoveredShapeId
 * - previewSelectedId
 * - altDragCloneIds
 * - isAltPressed
 * - guides
 */

export type ShapeType =
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "line"
  | "arrow"
  | "text"
  | "image"
  | "freehand"
  | "path";

export interface Point {
  x: number;
  y: number;
}

export interface ShapeStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  textAlign?: "left" | "center" | "right";
  borderRadius?: number;
}

export interface CanvasShape {
  id: string;
  type: ShapeType;
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
  // For lines/arrows
  startPoint?: Point;
  endPoint?: Point;
  // Metadata
  locked?: boolean;
  visible?: boolean;
  name?: string;
  zIndex: number;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Guide {
  id: string;
  type: "horizontal" | "vertical";
  position: number; // x for vertical, y for horizontal
  isVisible: boolean;
}

export interface AiCanvasEditorState {
  // Shapes
  shapes: CanvasShape[];

  // Selection
  selectedShapeIds: string[];
  hoveredShapeId: string | null;
  previewSelectedId: string | null;

  // Alt+drag cloning
  altDragCloneIds: string[];
  isAltPressed: boolean;

  // Guides/rulers
  guides: Guide[];

  // Tool state
  currentTool: ShapeType | "select" | "pan" | "zoom";
  isDrawing: boolean;
  drawingShape: Partial<CanvasShape> | null;

  // Canvas state
  zoom: number;
  panX: number;
  panY: number;

  // History
  historyIndex: number;
  canUndo: boolean;
  canRedo: boolean;

  // Clipboard
  clipboard: CanvasShape[];

  // Grid/snap
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;

  // Loading
  isLoading: boolean;
  error: string | null;
}

const initialState: AiCanvasEditorState = {
  shapes: [],
  selectedShapeIds: [],
  hoveredShapeId: null,
  previewSelectedId: null,
  altDragCloneIds: [],
  isAltPressed: false,
  guides: [],
  currentTool: "select",
  isDrawing: false,
  drawingShape: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  historyIndex: -1,
  canUndo: false,
  canRedo: false,
  clipboard: [],
  showGrid: false,
  snapToGrid: true,
  gridSize: 10,
  isLoading: false,
  error: null,
};

export const aiCanvasEditorSlice = createSlice({
  name: "aiCanvasEditor",
  initialState,
  reducers: {
    // Shapes
    setShapes: (state, action: PayloadAction<CanvasShape[]>) => {
      state.shapes = action.payload;
    },

    addShape: (state, action: PayloadAction<CanvasShape>) => {
      state.shapes.push(action.payload);
    },

    updateShape: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<CanvasShape> }>
    ) => {
      const index = state.shapes.findIndex((s) => s.id === action.payload.id);
      if (index !== -1 && state.shapes[index]) {
        Object.assign(state.shapes[index], action.payload.updates, {
          updatedAt: new Date().toISOString(),
        });
      }
    },

    removeShape: (state, action: PayloadAction<string>) => {
      state.shapes = state.shapes.filter((s) => s.id !== action.payload);
      state.selectedShapeIds = state.selectedShapeIds.filter(
        (id) => id !== action.payload
      );
    },

    removeShapes: (state, action: PayloadAction<string[]>) => {
      state.shapes = state.shapes.filter(
        (s) => !action.payload.includes(s.id)
      );
      state.selectedShapeIds = state.selectedShapeIds.filter(
        (id) => !action.payload.includes(id)
      );
    },

    duplicateShapes: (state, action: PayloadAction<string[]>) => {
      const shapesToDuplicate = state.shapes.filter((s) =>
        action.payload.includes(s.id)
      );
      const newShapes = shapesToDuplicate.map((shape) => ({
        ...shape,
        id: `${shape.id}_copy_${Date.now()}`,
        x: shape.x + 20,
        y: shape.y + 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      state.shapes.push(...newShapes);
      state.selectedShapeIds = newShapes.map((s) => s.id);
    },

    // Selection
    setSelectedShapeIds: (state, action: PayloadAction<string[]>) => {
      state.selectedShapeIds = action.payload;
    },

    selectShape: (state, action: PayloadAction<string>) => {
      if (!state.selectedShapeIds.includes(action.payload)) {
        state.selectedShapeIds.push(action.payload);
      }
    },

    deselectShape: (state, action: PayloadAction<string>) => {
      state.selectedShapeIds = state.selectedShapeIds.filter(
        (id) => id !== action.payload
      );
    },

    toggleShapeSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedShapeIds.indexOf(action.payload);
      if (index === -1) {
        state.selectedShapeIds.push(action.payload);
      } else {
        state.selectedShapeIds.splice(index, 1);
      }
    },

    selectAll: (state) => {
      state.selectedShapeIds = state.shapes.map((s) => s.id);
    },

    deselectAll: (state) => {
      state.selectedShapeIds = [];
    },

    setHoveredShapeId: (state, action: PayloadAction<string | null>) => {
      state.hoveredShapeId = action.payload;
    },

    setPreviewSelectedId: (state, action: PayloadAction<string | null>) => {
      state.previewSelectedId = action.payload;
    },

    // Alt+drag cloning
    setAltDragCloneIds: (state, action: PayloadAction<string[]>) => {
      state.altDragCloneIds = action.payload;
    },

    clearAltDragCloneIds: (state) => {
      state.altDragCloneIds = [];
    },

    setIsAltPressed: (state, action: PayloadAction<boolean>) => {
      state.isAltPressed = action.payload;
    },

    // Guides
    setGuides: (state, action: PayloadAction<Guide[]>) => {
      state.guides = action.payload;
    },

    addGuide: (state, action: PayloadAction<Guide>) => {
      state.guides.push(action.payload);
    },

    removeGuide: (state, action: PayloadAction<string>) => {
      state.guides = state.guides.filter((g) => g.id !== action.payload);
    },

    toggleGuideVisibility: (state, action: PayloadAction<string>) => {
      const guide = state.guides.find((g) => g.id === action.payload);
      if (guide) {
        guide.isVisible = !guide.isVisible;
      }
    },

    // Tool
    setCurrentTool: (
      state,
      action: PayloadAction<AiCanvasEditorState["currentTool"]>
    ) => {
      state.currentTool = action.payload;
      state.isDrawing = false;
      state.drawingShape = null;
    },

    setIsDrawing: (state, action: PayloadAction<boolean>) => {
      state.isDrawing = action.payload;
    },

    setDrawingShape: (
      state,
      action: PayloadAction<Partial<CanvasShape> | null>
    ) => {
      state.drawingShape = action.payload;
    },

    // Canvas view
    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = Math.min(5, Math.max(0.1, action.payload));
    },

    zoomIn: (state) => {
      state.zoom = Math.min(5, state.zoom * 1.2);
    },

    zoomOut: (state) => {
      state.zoom = Math.max(0.1, state.zoom / 1.2);
    },

    resetZoom: (state) => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
    },

    setPan: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.panX = action.payload.x;
      state.panY = action.payload.y;
    },

    // Clipboard
    copyToClipboard: (state) => {
      state.clipboard = state.shapes.filter((s) =>
        state.selectedShapeIds.includes(s.id)
      );
    },

    pasteFromClipboard: (state) => {
      const newShapes = state.clipboard.map((shape) => ({
        ...shape,
        id: `${shape.id}_paste_${Date.now()}`,
        x: shape.x + 20,
        y: shape.y + 20,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      state.shapes.push(...newShapes);
      state.selectedShapeIds = newShapes.map((s) => s.id);
    },

    // Grid
    setShowGrid: (state, action: PayloadAction<boolean>) => {
      state.showGrid = action.payload;
    },

    toggleGrid: (state) => {
      state.showGrid = !state.showGrid;
    },

    setSnapToGrid: (state, action: PayloadAction<boolean>) => {
      state.snapToGrid = action.payload;
    },

    setGridSize: (state, action: PayloadAction<number>) => {
      state.gridSize = action.payload;
    },

    // Z-index ordering
    bringToFront: (state) => {
      const maxZ = Math.max(...state.shapes.map((s) => s.zIndex));
      state.selectedShapeIds.forEach((id) => {
        const shape = state.shapes.find((s) => s.id === id);
        if (shape) {
          shape.zIndex = maxZ + 1;
        }
      });
    },

    sendToBack: (state) => {
      const minZ = Math.min(...state.shapes.map((s) => s.zIndex));
      state.selectedShapeIds.forEach((id) => {
        const shape = state.shapes.find((s) => s.id === id);
        if (shape) {
          shape.zIndex = minZ - 1;
        }
      });
    },

    // Loading
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },

    // Reset
    resetAiCanvasEditor: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setShapes,
  addShape,
  updateShape,
  removeShape,
  removeShapes,
  duplicateShapes,
  setSelectedShapeIds,
  selectShape,
  deselectShape,
  toggleShapeSelection,
  selectAll,
  deselectAll,
  setHoveredShapeId,
  setPreviewSelectedId,
  setAltDragCloneIds,
  clearAltDragCloneIds,
  setIsAltPressed,
  setGuides,
  addGuide,
  removeGuide,
  toggleGuideVisibility,
  setCurrentTool,
  setIsDrawing,
  setDrawingShape,
  setZoom,
  zoomIn,
  zoomOut,
  resetZoom,
  setPan,
  copyToClipboard,
  pasteFromClipboard,
  setShowGrid,
  toggleGrid,
  setSnapToGrid,
  setGridSize,
  bringToFront,
  sendToBack,
  setIsLoading,
  setError,
  resetAiCanvasEditor,
} = aiCanvasEditorSlice.actions;

export default aiCanvasEditorSlice.reducer;
