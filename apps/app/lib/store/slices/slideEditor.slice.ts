import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

/**
 * Slide Editor Slice
 * Manages presentation/slide editing state
 */

export interface SlideElement {
  id: string;
  type: "text" | "image" | "shape" | "video" | "chart" | "table";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content?: string;
  style?: Record<string, unknown>;
  zIndex: number;
}

export interface Slide {
  id: string;
  index: number;
  elements: SlideElement[];
  background?: {
    type: "color" | "image" | "gradient";
    value: string;
  };
  notes?: string;
  thumbnail?: string;
  transition?: {
    type: string;
    duration: number;
  };
}

export interface SlideTemplate {
  uid: string;
  name: string;
  cover: string;
  official: boolean;
  isFree: boolean;
  previewUrls: string[];
  imagePreviewUrls: Array<{
    thumbnail: string;
    raw: string;
  }>;
  status: number;
  error: string;
  isTeamShared: boolean;
  isOwner: boolean;
  slidesGenerateMode: "image" | "text" | "mixed";
}

export interface SlideEditorState {
  // Session
  sessionUid: string | null;

  // Slides
  slides: Slide[];
  currentSlideIndex: number;
  selectedSlideIds: string[];

  // Element selection
  selectedElementIds: string[];
  hoveredElementId: string | null;

  // Editor state
  isEditing: boolean;
  isPresentationMode: boolean;
  zoom: number;

  // Templates
  templates: SlideTemplate[];
  selectedTemplateUid: string | null;
  isLoadingTemplates: boolean;

  // History (undo/redo)
  history: {
    past: Slide[][];
    future: Slide[][];
  };

  // Clipboard
  clipboard: SlideElement[] | null;

  // Sidebar
  sidebarTab: "slides" | "elements" | "animations" | "themes";

  // Loading
  isLoading: boolean;
  isSaving: boolean;

  // Error
  error: string | null;
}

const initialState: SlideEditorState = {
  sessionUid: null,
  slides: [],
  currentSlideIndex: 0,
  selectedSlideIds: [],
  selectedElementIds: [],
  hoveredElementId: null,
  isEditing: false,
  isPresentationMode: false,
  zoom: 100,
  templates: [],
  selectedTemplateUid: null,
  isLoadingTemplates: false,
  history: {
    past: [],
    future: [],
  },
  clipboard: null,
  sidebarTab: "slides",
  isLoading: false,
  isSaving: false,
  error: null,
};

export const slideEditorSlice = createSlice({
  name: "slideEditor",
  initialState,
  reducers: {
    // Session
    setSessionUid: (state, action: PayloadAction<string | null>) => {
      state.sessionUid = action.payload;
    },

    // Slides
    setSlides: (state, action: PayloadAction<Slide[]>) => {
      state.slides = action.payload;
      state.isLoading = false;
    },

    addSlide: (state, action: PayloadAction<Slide>) => {
      state.slides.push(action.payload);
    },

    insertSlide: (state, action: PayloadAction<{ index: number; slide: Slide }>) => {
      state.slides.splice(action.payload.index, 0, action.payload.slide);
      // Update indices
      state.slides.forEach((slide, i) => {
        slide.index = i;
      });
    },

    deleteSlide: (state, action: PayloadAction<string>) => {
      state.slides = state.slides.filter((s) => s.id !== action.payload);
      // Update indices
      state.slides.forEach((slide, i) => {
        slide.index = i;
      });
      // Adjust current slide if needed
      if (state.currentSlideIndex >= state.slides.length) {
        state.currentSlideIndex = Math.max(0, state.slides.length - 1);
      }
    },

    updateSlide: (
      state,
      action: PayloadAction<{ id: string; updates: Partial<Slide> }>
    ) => {
      const slide = state.slides.find((s) => s.id === action.payload.id);
      if (slide) {
        Object.assign(slide, action.payload.updates);
      }
    },

    reorderSlides: (state, action: PayloadAction<Slide[]>) => {
      state.slides = action.payload;
      state.slides.forEach((slide, i) => {
        slide.index = i;
      });
    },

    duplicateSlide: (state, action: PayloadAction<string>) => {
      const slideIndex = state.slides.findIndex((s) => s.id === action.payload);
      const slide = state.slides[slideIndex];
      if (slideIndex !== -1 && slide) {
        const newSlide: Slide = {
          ...slide,
          id: `slide_${Date.now()}`,
          elements: slide.elements.map((el) => ({
            ...el,
            id: `element_${Date.now()}_${Math.random()}`,
          })),
        };
        state.slides.splice(slideIndex + 1, 0, newSlide);
        state.slides.forEach((s, i) => {
          s.index = i;
        });
      }
    },

    // Current slide
    setCurrentSlideIndex: (state, action: PayloadAction<number>) => {
      state.currentSlideIndex = action.payload;
    },

    nextSlide: (state) => {
      if (state.currentSlideIndex < state.slides.length - 1) {
        state.currentSlideIndex += 1;
      }
    },

    prevSlide: (state) => {
      if (state.currentSlideIndex > 0) {
        state.currentSlideIndex -= 1;
      }
    },

    // Slide selection
    setSelectedSlideIds: (state, action: PayloadAction<string[]>) => {
      state.selectedSlideIds = action.payload;
    },

    toggleSlideSelection: (state, action: PayloadAction<string>) => {
      const index = state.selectedSlideIds.indexOf(action.payload);
      if (index === -1) {
        state.selectedSlideIds.push(action.payload);
      } else {
        state.selectedSlideIds.splice(index, 1);
      }
    },

    // Elements
    addElement: (
      state,
      action: PayloadAction<{ slideId: string; element: SlideElement }>
    ) => {
      const slide = state.slides.find((s) => s.id === action.payload.slideId);
      if (slide) {
        slide.elements.push(action.payload.element);
      }
    },

    updateElement: (
      state,
      action: PayloadAction<{
        slideId: string;
        elementId: string;
        updates: Partial<SlideElement>;
      }>
    ) => {
      const slide = state.slides.find((s) => s.id === action.payload.slideId);
      if (slide) {
        const element = slide.elements.find((e) => e.id === action.payload.elementId);
        if (element) {
          Object.assign(element, action.payload.updates);
        }
      }
    },

    deleteElement: (
      state,
      action: PayloadAction<{ slideId: string; elementId: string }>
    ) => {
      const slide = state.slides.find((s) => s.id === action.payload.slideId);
      if (slide) {
        slide.elements = slide.elements.filter(
          (e) => e.id !== action.payload.elementId
        );
      }
    },

    setSelectedElementIds: (state, action: PayloadAction<string[]>) => {
      state.selectedElementIds = action.payload;
    },

    setHoveredElementId: (state, action: PayloadAction<string | null>) => {
      state.hoveredElementId = action.payload;
    },

    // Editor state
    setIsEditing: (state, action: PayloadAction<boolean>) => {
      state.isEditing = action.payload;
    },

    setIsPresentationMode: (state, action: PayloadAction<boolean>) => {
      state.isPresentationMode = action.payload;
    },

    setZoom: (state, action: PayloadAction<number>) => {
      state.zoom = action.payload;
    },

    // Templates
    setTemplates: (state, action: PayloadAction<SlideTemplate[]>) => {
      state.templates = action.payload;
      state.isLoadingTemplates = false;
    },

    setSelectedTemplateUid: (state, action: PayloadAction<string | null>) => {
      state.selectedTemplateUid = action.payload;
    },

    setLoadingTemplates: (state, action: PayloadAction<boolean>) => {
      state.isLoadingTemplates = action.payload;
    },

    // Clipboard
    copyElements: (state) => {
      const currentSlide = state.slides[state.currentSlideIndex];
      if (currentSlide) {
        state.clipboard = currentSlide.elements.filter((e) =>
          state.selectedElementIds.includes(e.id)
        );
      }
    },

    pasteElements: (state) => {
      if (state.clipboard && state.clipboard.length > 0) {
        const currentSlide = state.slides[state.currentSlideIndex];
        if (currentSlide) {
          const newElements = state.clipboard.map((el) => ({
            ...el,
            id: `element_${Date.now()}_${Math.random()}`,
            x: el.x + 20,
            y: el.y + 20,
          }));
          currentSlide.elements.push(...newElements);
          state.selectedElementIds = newElements.map((e) => e.id);
        }
      }
    },

    // Sidebar
    setSidebarTab: (
      state,
      action: PayloadAction<"slides" | "elements" | "animations" | "themes">
    ) => {
      state.sidebarTab = action.payload;
    },

    // Loading
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    setSaving: (state, action: PayloadAction<boolean>) => {
      state.isSaving = action.payload;
    },

    // Error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },

    // Reset
    resetSlideEditor: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const {
  setSessionUid,
  setSlides,
  addSlide,
  insertSlide,
  deleteSlide,
  updateSlide,
  reorderSlides,
  duplicateSlide,
  setCurrentSlideIndex,
  nextSlide,
  prevSlide,
  setSelectedSlideIds,
  toggleSlideSelection,
  addElement,
  updateElement,
  deleteElement,
  setSelectedElementIds,
  setHoveredElementId,
  setIsEditing,
  setIsPresentationMode,
  setZoom,
  setTemplates,
  setSelectedTemplateUid,
  setLoadingTemplates,
  copyElements,
  pasteElements,
  setSidebarTab,
  setLoading,
  setSaving,
  setError,
  resetSlideEditor,
} = slideEditorSlice.actions;

export default slideEditorSlice.reducer;
