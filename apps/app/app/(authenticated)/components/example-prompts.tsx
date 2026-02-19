"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  GlobeIcon,
  CodeIcon,
  FileTextIcon,
  BrainCircuitIcon,
  PaletteIcon,
  BarChart3Icon,
  type LucideIcon,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  setExampleList,
  setFeaturedExamples,
  addToRecentlyUsed,
  type ExampleItem,
} from "@/lib/store/slices/example.slice";
import { useCreateSessionMutation } from "@/lib/store/api/api.slice";

// ---------------------------------------------------------------------------
// Static example prompts (Manus parity — loaded on mount)
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, LucideIcon> = {
  research: GlobeIcon,
  coding: CodeIcon,
  writing: FileTextIcon,
  analysis: BarChart3Icon,
  design: PaletteIcon,
  general: BrainCircuitIcon,
};

const STATIC_EXAMPLES: ExampleItem[] = [
  {
    id: "ex-research-1",
    title: "Research a topic",
    description: "Search the web, gather info, and create a summary",
    prompt: "Research the latest developments in quantum computing and write a comprehensive summary with key breakthroughs from 2025-2026.",
    category: "research",
    tags: ["web", "research", "summary"],
    difficulty: "beginner",
    popularity: 95,
    isNew: false,
    isFeatured: true,
    createdAt: "2026-01-01",
  },
  {
    id: "ex-coding-1",
    title: "Build a web app",
    description: "Create a full-stack application from scratch",
    prompt: "Build a todo app with React, Express, and a SQLite database. Include user authentication and CRUD operations.",
    category: "coding",
    tags: ["code", "fullstack", "react"],
    difficulty: "intermediate",
    popularity: 90,
    isNew: false,
    isFeatured: true,
    createdAt: "2026-01-01",
  },
  {
    id: "ex-writing-1",
    title: "Draft a document",
    description: "Write professional emails, reports, or articles",
    prompt: "Write a professional project proposal for implementing an AI-powered customer support system, including timeline, budget estimates, and expected ROI.",
    category: "writing",
    tags: ["writing", "business", "document"],
    difficulty: "beginner",
    popularity: 85,
    isNew: false,
    isFeatured: true,
    createdAt: "2026-01-01",
  },
  {
    id: "ex-analysis-1",
    title: "Analyze data",
    description: "Process data, create charts, and find insights",
    prompt: "Analyze this dataset and create visualizations showing trends, outliers, and key statistics. Provide actionable recommendations.",
    category: "analysis",
    tags: ["data", "visualization", "analysis"],
    difficulty: "intermediate",
    popularity: 80,
    isNew: false,
    isFeatured: true,
    createdAt: "2026-01-01",
  },
  {
    id: "ex-design-1",
    title: "Design a UI",
    description: "Generate mockups and design ideas",
    prompt: "Design a modern landing page for a SaaS product. Include hero section, features, pricing, and testimonials with a dark theme.",
    category: "design",
    tags: ["design", "ui", "web"],
    difficulty: "beginner",
    popularity: 75,
    isNew: true,
    isFeatured: false,
    createdAt: "2026-02-01",
  },
  {
    id: "ex-general-1",
    title: "Automate a workflow",
    description: "Create scripts to automate repetitive tasks",
    prompt: "Create a Python script that monitors a folder for new CSV files, processes them, and sends a summary email with the results.",
    category: "general",
    tags: ["automation", "python", "email"],
    difficulty: "intermediate",
    popularity: 70,
    isNew: false,
    isFeatured: false,
    createdAt: "2026-01-15",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExamplePrompts() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [createSession] = useCreateSessionMutation();

  const exampleList = useAppSelector((s) => s.example.exampleList);
  const featuredExamples = useAppSelector((s) => s.example.featuredExamples);

  // Populate slice on mount with static examples
  useEffect(() => {
    if (exampleList.length === 0) {
      dispatch(setExampleList(STATIC_EXAMPLES));
      dispatch(setFeaturedExamples(STATIC_EXAMPLES.filter((e) => e.isFeatured)));
    }
  }, [dispatch, exampleList.length]);

  const handleClick = useCallback(
    async (example: ExampleItem) => {
      dispatch(addToRecentlyUsed(example.id));
      try {
        const session = await createSession({ title: example.title }).unwrap();
        if (!session) return;
        sessionStorage.setItem(
          `chat-${session.id}-initial`,
          JSON.stringify({ parts: [{ type: "text", text: example.prompt }] })
        );
        router.push(`/chat/${session.id}`);
      } catch {
        // Fall through — RTK Query handles errors
      }
    },
    [dispatch, createSession, router]
  );

  // Show featured examples (max 4 on the dashboard)
  const displayed = featuredExamples.length > 0 ? featuredExamples.slice(0, 4) : STATIC_EXAMPLES.slice(0, 4);

  return (
    <div className="grid grid-cols-2 gap-2 w-full">
      {displayed.map((example) => {
        const Icon = ICON_MAP[example.category] ?? BrainCircuitIcon;
        return (
          <button
            key={example.id}
            type="button"
            className="flex items-start gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleClick(example)}
          >
            <div className="flex items-center justify-center size-8 rounded-md bg-muted text-muted-foreground shrink-0 mt-0.5">
              <Icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">{example.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{example.description}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
