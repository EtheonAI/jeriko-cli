"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Separator } from "@repo/design-system/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
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
  HeadphonesIcon,
  SparklesIcon,
  KeyboardIcon,
  ShieldIcon,
  ZapIcon,
} from "lucide-react";

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
    href: "/docs/shortcuts",
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
  },
  {
    title: "Privacy & Security",
    description: "Learn how we protect your data and privacy.",
    icon: ShieldIcon,
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

export function HelpTab() {
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
                  <p className="text-xs text-muted-foreground">
                    {resource.description}
                  </p>
                </div>
              </a>
            );
          })}
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
              <Card key={item.title} className="cursor-pointer hover:bg-muted/50 transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium">{item.title}</h4>
                      <p className="text-xs text-muted-foreground">
                        {item.description}
                      </p>
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
                  <p className="text-xs text-muted-foreground mb-3">
                    {option.description}
                  </p>
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
        <div className="space-y-2">
          <details className="group rounded-lg border">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              How do I reset my password?
            </summary>
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Go to Account settings and click on &quot;Change Password&quot;. You&apos;ll need to
              enter your current password and your new password.
            </p>
          </details>
          <details className="group rounded-lg border">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              How do I connect my services?
            </summary>
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Visit the Connectors page in settings to see available integrations.
              Click &quot;Connect&quot; on any service to authorize Rubic.
            </p>
          </details>
          <details className="group rounded-lg border">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              What are credits and how do they work?
            </summary>
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Credits are used for AI operations. Each plan includes a monthly credit
              allocation. You can purchase additional credits or upgrade your plan for more.
            </p>
          </details>
          <details className="group rounded-lg border">
            <summary className="cursor-pointer p-4 text-sm font-medium">
              Can I export my data?
            </summary>
            <p className="px-4 pb-4 text-sm text-muted-foreground">
              Yes! Go to Data Controls in settings and click &quot;Export Your Data&quot;.
              We&apos;ll prepare a download with all your data in JSON format.
            </p>
          </details>
        </div>
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
        <p>Rubic v1.0.0</p>
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
