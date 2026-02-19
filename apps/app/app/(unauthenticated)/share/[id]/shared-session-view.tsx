"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Command, User2, Eye, Heart, Clock, Lock } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import { useAppDispatch, useGuestPage } from "@/lib/store/hooks";
import {
  enterGuestMode,
  incrementMessagesUsed,
  setReferralSource,
  setReferralCode,
  exitGuestMode,
} from "@/lib/store/slices/guestPage.slice";

interface SharedMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

interface SharedSessionViewProps {
  session: {
    id: string;
    title: string;
    createdAt: string;
    likeCount: number;
    viewCount: number;
  };
  author: {
    id: string;
    name: string;
    image: string | null;
  };
  messages: SharedMessage[];
  messageDisplayLimit: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function MessageBubble({ message }: { message: SharedMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-white text-black"
            : "bg-neutral-900 text-neutral-200 border border-neutral-800"
        )}
      >
        <div className="whitespace-pre-wrap break-words">{message.content}</div>
        <div
          className={cn(
            "mt-1.5 text-[10px]",
            isUser ? "text-neutral-400" : "text-neutral-500"
          )}
        >
          {formatDate(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

export function SharedSessionView({
  session,
  author,
  messages,
  messageDisplayLimit,
}: SharedSessionViewProps) {
  const [showAll, setShowAll] = useState(false);
  const dispatch = useAppDispatch();
  const guestState = useGuestPage();
  const searchParams = useSearchParams();

  // Enter guest mode on mount, exit on unmount
  useEffect(() => {
    dispatch(enterGuestMode());

    // Parse referral params from URL
    const ref = searchParams.get("ref");
    const code = searchParams.get("code");
    if (ref) dispatch(setReferralSource(ref));
    if (code) dispatch(setReferralCode(code));

    return () => {
      dispatch(exitGuestMode());
    };
  }, [dispatch, searchParams]);

  const visibleMessages = showAll
    ? messages
    : messages.slice(0, messageDisplayLimit);

  const hasMoreMessages = messages.length > messageDisplayLimit;
  const hiddenCount = messages.length - messageDisplayLimit;

  const handleContinueAsGuest = () => {
    dispatch(incrementMessagesUsed());
    setShowAll(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-black">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-neutral-800 bg-black/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Command className="h-5 w-5 text-white" />
            <span className="text-sm font-medium text-white">Rubic</span>
          </Link>

          <Link href="/login">
            <Button
              variant="outline"
              size="sm"
              className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800 hover:text-white"
            >
              Sign in
            </Button>
          </Link>
        </div>
      </header>

      {/* Session info */}
      <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-4">
        <h1 className="text-xl font-semibold text-white">{session.title}</h1>

        <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <User2 className="h-3.5 w-3.5" />
            <span>{author.name}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDate(session.createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            <span>{session.viewCount} views</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="h-3.5 w-3.5" />
            <span>{session.likeCount} likes</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-8">
        <div className="space-y-4">
          {visibleMessages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        {/* Login gate - shown when there are more messages */}
        {hasMoreMessages && !showAll && (
          <div className="relative mt-8">
            {/* Fade overlay */}
            <div className="pointer-events-none absolute -top-16 left-0 right-0 h-16 bg-gradient-to-t from-black to-transparent" />

            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-6 text-center">
              <Lock className="mx-auto h-8 w-8 text-neutral-500 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                {hiddenCount} more message{hiddenCount !== 1 ? "s" : ""} in this conversation
              </h3>
              <p className="text-sm text-neutral-400 mb-5">
                Sign up for Rubic to view the full conversation and start creating your own.
              </p>

              <div className="flex flex-col items-center gap-3">
                <Link href="/login" className="w-full max-w-xs">
                  <Button className="h-11 w-full bg-white text-black hover:bg-neutral-200">
                    Sign up to try Rubic
                  </Button>
                </Link>
                <button
                  type="button"
                  onClick={handleContinueAsGuest}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  Continue viewing as guest
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Login prompt from Redux (shown when guest hits message limit) */}
      {guestState.showLoginPrompt && showAll && (
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-4 text-center">
            <p className="text-sm text-neutral-300 mb-3">
              You've viewed {guestState.messagesUsed} messages as a guest. Sign up to get unlimited access.
            </p>
            <Link href="/login">
              <Button size="sm" className="bg-white text-black hover:bg-neutral-200">
                Sign up for free
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* CTA footer */}
      <footer className="border-t border-neutral-800 bg-neutral-950">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-8">
          <Command className="h-8 w-8 text-white" />
          <h2 className="text-lg font-semibold text-white">
            Sign up to try Rubic
          </h2>
          <p className="text-center text-sm text-neutral-400 max-w-md">
            Rubic is an AI-powered workspace for automation, smart home control, and connected
            applications. Start building today.
          </p>
          <Link href="/login">
            <Button className="h-11 px-8 bg-white text-black hover:bg-neutral-200">
              Get started for free
            </Button>
          </Link>
          <div className="flex items-center gap-1 text-sm text-neutral-500 mt-2">
            <span>from</span>
            <span className="font-semibold text-neutral-400">Etheon</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
