"use client";

import * as React from "react";
import { cn } from "@repo/design-system/lib/utils";
import {
  MailIcon,
  SendIcon,
  CheckCircle2Icon,
  XCircleIcon,
  FileTextIcon,
  LoaderIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  UserIcon,
} from "lucide-react";
import type { ToolRendererProps } from "../tool-registry";

// ============================================================================
// Types
// ============================================================================

interface EmailDraftInput {
  to?: string;
  subject?: string;
  body?: string;
  cc?: string;
  bcc?: string;
  is_html?: boolean;
  save_as_draft?: boolean;
}

interface EmailDraftOutput {
  status?: "success" | "error";
  error?: string;
  messageId?: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Split comma-separated recipients into array */
function parseRecipients(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Detect provider from tool name */
function getProvider(toolName: string): "gmail" | "outlook" {
  return toolName.startsWith("outlook") ? "outlook" : "gmail";
}

/** Provider display config */
const PROVIDER_CONFIG = {
  gmail: { label: "Gmail", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/20" },
  outlook: { label: "Outlook", color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20" },
} as const;

// ============================================================================
// Sub-components
// ============================================================================

function RecipientBadge({ email }: { email: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
      <UserIcon className="size-2.5" />
      {email}
    </span>
  );
}

function RecipientRow({ label, recipients }: { label: string; recipients: string[] }) {
  if (recipients.length === 0) return null;
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-8 shrink-0 pt-0.5 font-medium text-muted-foreground/60">{label}</span>
      <div className="flex flex-wrap gap-1">
        {recipients.map((r, i) => (
          <RecipientBadge key={i} email={r} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Compact Receipt — shown after send/error
// ============================================================================

function EmailReceipt({
  provider,
  subject,
  to,
  isDraft,
  status,
  error,
}: {
  provider: "gmail" | "outlook";
  subject?: string;
  to?: string;
  isDraft: boolean;
  status: "success" | "error";
  error?: string;
}) {
  const config = PROVIDER_CONFIG[provider];
  const isSuccess = status === "success";

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm",
        isSuccess
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      )}
      role="status"
    >
      {isSuccess ? (
        <CheckCircle2Icon className="size-4 shrink-0 text-emerald-500" />
      ) : (
        <XCircleIcon className="size-4 shrink-0 text-red-500" />
      )}
      <div className="min-w-0 flex-1">
        <span className="font-medium text-foreground/80">
          {isSuccess
            ? isDraft
              ? "Draft saved"
              : "Email sent"
            : "Failed to send"}
        </span>
        {isSuccess && subject && (
          <span className="ml-1.5 text-muted-foreground/60">
            &mdash; {subject}
          </span>
        )}
        {!isSuccess && error && (
          <p className="mt-0.5 text-xs text-red-500/80">{error}</p>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
          config.bg,
          config.color
        )}
      >
        {config.label}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * MessageDraftRenderer — Inline email draft for gmail_send / outlook_send.
 *
 * States:
 * - input-streaming / input-available: Shows "Composing..." loading
 * - output-available (success): Shows compact receipt OR expanded draft
 * - output-available (error): Shows error receipt
 *
 * Renders the full email (To, CC, BCC, Subject, Body) in a card so the user
 * can see exactly what was sent on their behalf. Collapses to a one-line
 * receipt, expandable to see full content.
 */
export function MessageDraftRenderer({
  toolName,
  state,
  input,
  output,
}: ToolRendererProps<EmailDraftInput, EmailDraftOutput>) {
  const [expanded, setExpanded] = React.useState(false);
  const provider = getProvider(toolName);
  const config = PROVIDER_CONFIG[provider];

  const to = parseRecipients(input?.to);
  const cc = parseRecipients(input?.cc);
  const bcc = parseRecipients(input?.bcc);
  const subject = input?.subject || "";
  const body = input?.body || "";
  const isDraft = input?.save_as_draft ?? false;

  // Loading state
  if (state === "input-streaming" || state === "input-available") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm",
          config.border,
          config.bg
        )}
      >
        <LoaderIcon className={cn("size-4 shrink-0 animate-spin", config.color)} />
        <span className="text-muted-foreground">
          {isDraft ? "Saving draft" : "Sending email"} via {config.label}...
        </span>
        {subject && (
          <span className="truncate text-xs text-muted-foreground/50">
            &mdash; {subject}
          </span>
        )}
      </div>
    );
  }

  if (state !== "output-available") return null;

  const status = output?.status ?? "success";
  const error = output?.error;

  // Collapsed: receipt only
  if (!expanded) {
    return (
      <div className="space-y-0">
        <EmailReceipt
          provider={provider}
          subject={subject}
          to={input?.to}
          isDraft={isDraft}
          status={status}
          error={error}
        />
        {/* Expand button to see full draft */}
        {body && status === "success" && (
          <button
            type="button"
            className="mt-1 flex w-full items-center justify-center gap-1 rounded-b-lg py-1 text-[11px] text-muted-foreground/40 transition-colors hover:bg-muted/10 hover:text-muted-foreground/60"
            onClick={() => setExpanded(true)}
          >
            <ChevronDownIcon className="size-3" />
            View email
          </button>
        )}
      </div>
    );
  }

  // Expanded: full draft card
  return (
    <article
      className={cn(
        "overflow-hidden rounded-lg border",
        config.border,
        "bg-card"
      )}
      aria-labelledby={`draft-subject-${toolName}`}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b px-3 py-2",
          config.border,
          config.bg
        )}
      >
        <div className="flex items-center gap-2">
          <MailIcon className={cn("size-4", config.color)} />
          <span className="text-xs font-medium text-foreground/80">
            {isDraft ? "Draft" : "Sent"} via {config.label}
          </span>
        </div>
        <button
          type="button"
          className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:bg-muted/20 hover:text-muted-foreground"
          onClick={() => setExpanded(false)}
        >
          <ChevronUpIcon className="size-3.5" />
        </button>
      </div>

      {/* Recipients */}
      <div className="space-y-1.5 border-b px-3 py-2" style={{ borderColor: "var(--border-10, rgba(0,0,0,0.05))" }}>
        <RecipientRow label="To" recipients={to} />
        <RecipientRow label="Cc" recipients={cc} />
        <RecipientRow label="Bcc" recipients={bcc} />
      </div>

      {/* Subject */}
      {subject && (
        <div className="border-b px-3 py-2" style={{ borderColor: "var(--border-10, rgba(0,0,0,0.05))" }}>
          <p id={`draft-subject-${toolName}`} className="text-sm font-medium text-foreground">
            {subject}
          </p>
        </div>
      )}

      {/* Body */}
      <div className="px-3 py-3">
        <div className="max-h-60 overflow-y-auto text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
          {body}
        </div>
      </div>

      {/* Status footer */}
      <div
        className={cn(
          "flex items-center gap-2 border-t px-3 py-1.5 text-xs",
          status === "success"
            ? "border-emerald-500/10 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
            : "border-red-500/10 bg-red-500/5 text-red-600 dark:text-red-400"
        )}
      >
        {status === "success" ? (
          <>
            <CheckCircle2Icon className="size-3" />
            {isDraft ? "Saved as draft" : "Sent successfully"}
          </>
        ) : (
          <>
            <XCircleIcon className="size-3" />
            {error || "Failed to send"}
          </>
        )}
      </div>
    </article>
  );
}
