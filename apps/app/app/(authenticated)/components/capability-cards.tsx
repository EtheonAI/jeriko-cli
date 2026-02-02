"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  CodeIcon,
  DatabaseIcon,
  FileTextIcon,
  GlobeIcon,
  MailIcon,
  PaletteIcon,
  PenToolIcon,
  SearchIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type CapabilityCard = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: string;
};

const capabilities: CapabilityCard[] = [
  {
    id: "1",
    title: "Research & Analysis",
    description: "Deep research, data analysis, and insights extraction",
    icon: SearchIcon,
    category: "Research",
  },
  {
    id: "2",
    title: "Content Generation",
    description: "Blog posts, articles, copywriting, and creative content",
    icon: PenToolIcon,
    category: "Content",
  },
  {
    id: "3",
    title: "Coding & Development",
    description: "Write, debug, and review code in any language",
    icon: CodeIcon,
    category: "Development",
  },
  {
    id: "4",
    title: "Design Services",
    description: "UI/UX concepts, graphics, and visual design ideas",
    icon: PaletteIcon,
    category: "Design",
  },
  {
    id: "5",
    title: "Data Processing",
    description: "Transform, clean, and analyze datasets efficiently",
    icon: DatabaseIcon,
    category: "Data",
  },
  {
    id: "6",
    title: "Document Creation",
    description: "Reports, proposals, presentations, and documentation",
    icon: FileTextIcon,
    category: "Documents",
  },
  {
    id: "7",
    title: "Email Automation",
    description: "Draft, schedule, and manage email communications",
    icon: MailIcon,
    category: "Automation",
  },
  {
    id: "8",
    title: "Web Scraping",
    description: "Extract and collect data from websites at scale",
    icon: GlobeIcon,
    category: "Web",
  },
];

export const CapabilityCards = () => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {capabilities.map((capability) => (
        <Card
          key={capability.id}
          className="cursor-default transition-colors hover:bg-muted/50"
        >
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <capability.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-sm font-medium">
                {capability.title}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-xs">
              {capability.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
