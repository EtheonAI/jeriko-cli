import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * AI Canvas Slice
 * Manages the AI canvas/whiteboard state for visual collaboration
 */

export type CanvasTool =
  | "select"
  | "pan"
  | "draw"
  | "text"
  | "shape"
  | "image"
  | "eraser"
  | "mark";

export type ShapeType = "rectangle" | "ellipse" | "triangle" | "line" | "arrow" | "polygon";

export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  x: number;
  y: number;
  z: number; // zoom level
}

export interface CanvasShape {
  id: string;
  type: "draw" | "text" | "shape" | "image";
  shapeType?: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  points?: Point[]; // for freehand drawing
  content?: string; // for text
  imageUrl?: string; // for images
  style: {
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    fontSize?: number;
    fontFamily?: string;
  };
  locked: boolean;
  visible: boolean;
  zIndex: number;
}

export interface Guide {
  id: string;
  type: "horizontal" | "vertical";
  position: number;
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

export interface AICanvasEditorState {
  // Canvas ID
  canvasId: string | null;

  // Shapes
  shapes: Record<string, CanvasShape>;

  // Camera
  camera: Camera;

  // Selection
  selectedShapeIds: string[];
  hoveredShapeId: string | null;
  previewSelectedId: string | null;

  // Alt+drag cloning
  altDragCloneIds: string[];
  isAltPressed: boolean;

  // Guides
  guides: Guide[];

  // Interaction state
  interaction: {
    activeTool: CanvasTool;
    rightMouseDown: boolean;
    isImageDragging: boolean;
    temporaryPanMode: boolean;
    temporaryMarkMode: boolean;
    panning: boolean;
  };

  // Brushing (selection box)
  brushing: {
    isBrushing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
  };

  // Marking (annotation)
  marking: {
    isMarking: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    imageShapeId: string | null;
  };

  // Context menu
  contextMenu: {
    position: Point | null;
    target: string | null;
  };

  // Screenshots
  screenshots: {
    markScreenshots: Record<string, string>;
    markedImages: Record<string, string>;
  };

  // Edit text mode (OCR)
  editTextMode: {
    imageId: string | null;
    annotations: Annotation[];
    selectedAnnotationIndex: number | null;
    hoveredAnnotationIndex: number | null;
    editedTexts: string[];
    isOcrLoading: boolean;
  };

  // Settings
  settings: {
    useScrollWheelZoom: boolean;
    rightClickDragToPan: boolean;
    gridState: boolean;
    snapToGrid: boolean;
    showGuides: boolean;
  };

  // Comment history (undo/redo)
  commentHistory: {
    past: unknown[];
    future: unknown[];
  };

  // Comment popup
  commentPopup: {
    commentId: string;
    isOpen: boolean;
  };

  // OCR cache
  ocrCache: Record<string, string>;

  // Loading
  isLoading: boolean;
  isSaving: boolean;
}

const initialState: AICanvasEditorState = {
  canvasId: null,
  shapes: {},
  camera: { x: 0, y: 0, z: 1 },
  selectedShapeIds: [],
  hoveredShapeId: null,
  previewSelectedId: null,
  altDragCloneIds: [],
  isAltPressed: false,
  guides: [],
  interaction: {
    activeTool: "select",
    rightMouseDown: false,
    isImageDragging: false,
    temporaryPanMode: false,
    temporaryMarkMode: false,
    panning: false,
  },
  brushing: {
    isBrushing: false,
    startPoint: null,
    currentPoint: null,
  },
  marking: {
    isMarking: false,
    startPoint: null,
    currentPoint: null,
    imageShapeId: null,
  },
  contextMenu: {
    position: null,
    target: null,
  },
  screenshots: {
    markScreenshots: {},
    markedImages: {},
  },
  editTextMode: {
    imageId: null,
    annotations: [],
    selectedAnnotationIndex: null,
    hoveredAnnotationIndex: null,
    editedTexts: [],
    isOcrLoading: false,
  },
  settings: {
    useScrollWheelZoom: false,
    rightClickDragToPan: false,
    gridState: false,
    snapToGrid: true,
    showGuides: true,
  },
  commentHistory: {
    past: [],
    future: [],
  },
  commentPopup: {
    commentId: "",
    isOpen: false,
  },
  ocrCache: {},
  isLoading: false,
  isSaving: false,
};

export const aiCanvasSlice = createSlice({
  name: "aiCanvas",
  initialState,
  reducers: {
    // Canvas
    setCanvasId: (state, action: PayloadAction<string | null>) => {
      state.canvasId = action.payload;
    },

    // Shapes
    setShapes: (state, action: PayloadAction<Record<string, CanvasShape>>) => {
      state.shapes = action.payload;
    },

    addShape: (state, action: PayloadAction<CanvasShape>) => {
      state.shapes[action.payload.id] = action.payload;
    },

    updateShape: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<CanvasShape> }>
    ) => {
      const shape = state.shapes[action.payload.id];
      if (shape) {
        Object.assign(shape, action.payload.updates);
      }
    },

    deleteShape: (state, action: PayloadAction<string>) => {
      delete state.shapes[action.payload];
      state.selectedShapeIds = state.selectedShapeIds.filter(
        (id) => id !== action.payload
      );
    },

    deleteSelectedShapes: (state) => {
      state.selectedShapeIds.forEach((id) => {
        delete state.shapes[id];
      });
      state.selectedShapeIds = [];
    },

    // Camera
    setCamera: (state, action: PayloadAction<Camera>) => {
      state.camera = action.payload;
    },

    updateCamera: (state, action: PayloadAction<Partial<Camera>>) => {
      state.camera = { ...state.camera, ...action.payload };
    },

    zoomIn: (state) => {
      state.camera.z = Math.min(state.camera.z * 1.2, 5);
    },

    zoomOut: (state) => {
      state.camera.z = Math.max(state.camera.z / 1.2, 0.1);
    },

    resetZoom: (state) => {
      state.camera.z = 1;
    },

    // Selection
    setSelectedShapeIds: (state, action: PayloadAction<string[]>) => {
      state.selectedShapeIds = action.payload;
    },

    toggleShapeSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedShapeIds.indexOf(action.payload);
      if (index === -1) {
        state.selectedShapeIds.push(action.payload);
      } else {
        state.selectedShapeIds.splice(index, 1);
      }
    },

    clearSelection: (state) => {
      state.selectedShapeIds = [];
    },

    setHoveredShapeId: (state, action: PayloadAction<string | null>) => {
      state.hoveredShapeId = action.payload;
    },

    // Alt+drag
    setAltPressed: (state, action: PayloadAction<boolean>) => {
      state.isAltPressed = action.payload;
    },

    setAltDragCloneIds: (state, action: PayloadAction<string[]>) => {
      state.altDragCloneIds = action.payload;
    },

    // Tool
    setActiveTool: (state, action: PayloadAction<CanvasTool>) => {
      state.interaction.activeTool = action.payload;
    },

    // Interaction
    setPanning: (state, action: PayloadAction<boolean>) => {
      state.interaction.panning = action.payload;
    },

    setImageDragging: (state, action: PayloadAction<boolean>) => {
      state.interaction.isImageDragging = action.payload;
    },

    setTemporaryPanMode: (state, action: PayloadAction<boolean>) => {
      state.interaction.temporaryPanMode = action.payload;
    },

    // Brushing
    startBrushing: (state, action: PayloadAction<Point>) => {
      state.brushing.isBrushing = true;
      state.brushing.startPoint = action.payload;
      state.brushing.currentPoint = action.payload;
    },

    updateBrushing: (state, action: PayloadAction<Point>) => {
      state.brushing.currentPoint = action.payload;
    },

    endBrushing: (state) => {
      state.brushing.isBrushing = false;
      state.brushing.startPoint = null;
      state.brushing.currentPoint = null;
    },

    // Context menu
    openContextMenu: (
      state,
      action: PayloadAction<{ position: Point; target: string | null }>
    ) => {
      state.contextMenu.position = action.payload.position;
      state.contextMenu.target = action.payload.target;
    },

    closeContextMenu: (state) => {
      state.contextMenu.position = null;
      state.contextMenu.target = null;
    },

    // Settings
    updateSettings: (
      state,
      action: PayloadAction<Partial<AICanvasEditorState["settings"]>>
    ) => {
      state.settings = { ...state.settings, ...action.payload };
    },

    // Comment popup
    openCommentPopup: (state, action: PayloadAction<string>) => {
      state.commentPopup.commentId = action.payload;
      state.commentPopup.isOpen = true;
    },

    closeCommentPopup: (state) => {
      state.commentPopup.isOpen = false;
    },

    // OCR
    setOcrLoading: (state, action: PayloadAction<boolean>) => {
      state.editTextMode.isOcrLoading = action.payload;
    },

    setOcrCache: (
      state,
      action: PayloadAction<{ imageId: string; text: string }>
    ) => {
      state.ocrCache[action.payload.imageId] = action.payload.text;
    },

    // Loading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },

    // Reset
    resetAICanvas: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setCanvasId,
  setShapes,
  addShape,
  updateShape,
  deleteShape,
  deleteSelectedShapes,
  setCamera,
  updateCamera,
  zoomIn,
  zoomOut,
  resetZoom,
  setSelectedShapeIds,
  toggleShapeSelection,
  clearSelection,
  setHoveredShapeId,
  setAltPressed,
  setAltDragCloneIds,
  setActiveTool,
  setPanning,
  setImageDragging,
  setTemporaryPanMode,
  startBrushing,
  updateBrushing,
  endBrushing,
  openContextMenu,
  closeContextMenu,
  updateSettings,
  openCommentPopup,
  closeCommentPopup,
  setOcrLoading,
  setOcrCache,
  setLoading,
  setSaving,
  resetAICanvas,
} = aiCanvasSlice.actions;

export default aiCanvasSlice.reducer;
