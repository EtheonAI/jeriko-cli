"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@repo/design-system/components/ui/accordion";
import {
  BookOpenIcon,
  MessageCircleIcon,
  MailIcon,
  GithubIcon,
  TwitterIcon,
  DiscIcon,
  ExternalLinkIcon,
  FileTextIcon,
  VideoIcon,
  KeyboardIcon,
  SparklesIcon,
  ShieldIcon,
  ZapIcon,
} from "lucide-react";
import { useSettings } from "../settings-context";

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "5.2.1";

const resources = [
  {
    title: "Documentation",
    description: "Learn how to use Rubic with our comprehensive guides",
    icon: BookOpenIcon,
    href: "/docs",
    external: false,
  },
  {
    title: "API Reference",
    description: "Integrate Rubic into your applications",
    icon: FileTextIcon,
    href: "/docs/api",
    external: false,
  },
  {
    title: "Video Tutorials",
    description: "Watch step-by-step tutorials to get started",
    icon: VideoIcon,
    href: "https://youtube.com/@rubic",
    external: true,
  },
  {
    title: "Keyboard Shortcuts",
    description: "Speed up your workflow with keyboard shortcuts",
    icon: KeyboardIcon,
    href: "#shortcuts",
    external: false,
  },
];

const quickHelp = [
  {
    title: "Getting Started",
    description: "New to Rubic? Start here to learn the basics.",
    icon: SparklesIcon,
  },
  {
    title: "Connectors",
    description: "How to connect your apps and services to Rubic.",
    icon: ZapIcon,
    tab: "connectors" as const,
  },
  {
    title: "Privacy & Security",
    description: "Learn how we protect your data and privacy.",
    icon: ShieldIcon,
    tab: "data-controls" as const,
  },
];

const contactOptions = [
  {
    title: "Community Discord",
    description: "Join our community for help and discussions",
    icon: DiscIcon,
    href: "https://discord.gg/rubic",
    buttonText: "Join Discord",
  },
  {
    title: "Email Support",
    description: "Get help from our support team",
    icon: MailIcon,
    href: "mailto:support@rubic.dev",
    buttonText: "Send Email",
  },
  {
    title: "Live Chat",
    description: "Chat with us in real-time (Pro users)",
    icon: MessageCircleIcon,
    href: "#",
    buttonText: "Start Chat",
    isPro: true,
  },
];

const socialLinks = [
  {
    name: "Twitter",
    icon: TwitterIcon,
    href: "https://twitter.com/rubicdev",
  },
  {
    name: "GitHub",
    icon: GithubIcon,
    href: "https://github.com/rubic-dev",
  },
  {
    name: "Discord",
    icon: DiscIcon,
    href: "https://discord.gg/rubic",
  },
];

const keyboardShortcuts = [
  { keys: ["Ctrl", "K"], description: "Open command palette" },
  { keys: ["Ctrl", "N"], description: "New conversation" },
  { keys: ["Ctrl", "/"], description: "Focus chat input" },
  { keys: ["Ctrl", ","], description: "Open settings" },
  { keys: ["Ctrl", "Shift", "S"], description: "Toggle sidebar" },
  { keys: ["Esc"], description: "Close dialog / Cancel" },
  { keys: ["Enter"], description: "Send message" },
  { keys: ["Shift", "Enter"], description: "New line in message" },
];

const faqItems = [
  {
    question: "How do I reset my password?",
    answer:
      'Go to Account settings and click on "Change Password". You\'ll need to enter your current password and your new password.',
    tab: "account" as const,
  },
  {
    question: "How do I connect my services?",
    answer:
      'Visit the Connectors page in settings to see available integrations. Click "Connect" on any service to authorize Rubic.',
    tab: "connectors" as const,
  },
  {
    question: "What are credits and how do they work?",
    answer:
      "Credits are used for AI operations. Each plan includes a monthly credit allocation. You can purchase additional credits or upgrade your plan for more.",
    tab: "billing" as const,
  },
  {
    question: "Can I export my data?",
    answer:
      'Yes! Go to Data Controls in settings and click "Export Your Data". We\'ll prepare a download with all your data in JSON format.',
    tab: "data-controls" as const,
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

export function HelpTab() {
  const { setActiveTab } = useSettings();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Get Help</h2>
        <p className="text-sm text-muted-foreground">
          Find answers, learn how to use Rubic, or contact support.
        </p>
      </div>

      <Separator />

      {/* Resources */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Resources</h3>
        <div className="grid gap-3 md:grid-cols-2">
          {resources.map((resource) => {
            const Icon = resource.icon;
            return (
              <a
                key={resource.title}
                href={resource.href}
                target={resource.external ? "_blank" : undefined}
                rel={resource.external ? "noopener noreferrer" : undefined}
                className="flex items-start gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1">
                    <span className="font-medium text-sm">{resource.title}</span>
                    {resource.external && (
                      <ExternalLinkIcon className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{resource.description}</p>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Keyboard Shortcuts */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Keyboard Shortcuts</h3>
        <div className="rounded-lg border">
          <div className="grid grid-cols-2 gap-x-6">
            {keyboardShortcuts.map((shortcut) => (
              <div
                key={shortcut.description}
                className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0"
              >
                <span className="text-sm text-muted-foreground">{shortcut.description}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                      <Kbd>{key}</Kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Quick Help */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Quick Help</h3>
        <div className="grid gap-3">
          {quickHelp.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => item.tab && setActiveTab(item.tab)}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* Contact Support */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Contact Support</h3>
        <div className="grid gap-3 md:grid-cols-3">
          {contactOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Card key={option.title}>
                <CardContent className="pt-6 text-center">
                  <Icon className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                  <h4 className="text-sm font-medium mb-1">{option.title}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{option.description}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    disabled={option.isPro}
                    asChild={!option.isPro}
                  >
                    {option.isPro ? (
                      <span>Pro Only</span>
                    ) : (
                      <a
                        href={option.href}
                        target={option.href.startsWith("http") ? "_blank" : undefined}
                        rel={option.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      >
                        {option.buttonText}
                      </a>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* FAQ */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Frequently Asked Questions</h3>
        <Accordion type="single" collapsible className="rounded-lg border">
          {faqItems.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`} className="px-4">
              <AccordionTrigger>{faq.question}</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">{faq.answer}</p>
                {faq.tab && (
                  <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 mt-2"
                    onClick={() => setActiveTab(faq.tab)}
                  >
                    Go to {faq.tab.replace("-", " ")} settings
                  </Button>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <Separator />

      {/* Social Links */}
      <div className="flex items-center justify-center gap-4 py-4">
        {socialLinks.map((social) => {
          const Icon = social.icon;
          return (
            <a
              key={social.name}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-lg border transition-colors hover:bg-muted"
            >
              <Icon className="h-5 w-5" />
              <span className="sr-only">{social.name}</span>
            </a>
          );
        })}
      </div>

      {/* Version Info */}
      <div className="text-center text-xs text-muted-foreground">
        <p>Rubic v{APP_VERSION}</p>
        <p className="mt-1">
          <a href="/privacy" className="hover:underline">
            Privacy Policy
          </a>
          {" · "}
          <a href="/terms" className="hover:underline">
            Terms of Service
          </a>
        </p>
      </div>
    </div>
  );
}
