import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { env } from "@/env";
import { verifySession } from "@/lib/dal";
import { serverTrpc, HydrateClient } from "@/lib/trpc/server";
import { AvatarStack } from "./components/avatar-stack";
import { Cursors } from "./components/cursors";
import { Header } from "./components/header/index";
import { ChatSection } from "./components/chat-section";
import { ExamplePrompts } from "./components/example-prompts";

const title = "Rubic";
const description = "AI-powered productivity platform.";

const CollaborationProvider = dynamic(() =>
  import("./components/collaboration-provider").then((mod) => mod.CollaborationProvider)
);

const OnboardingWizard = dynamic(() =>
  import("./components/onboarding-wizard").then((mod) => mod.OnboardingWizard)
);

export const metadata: Metadata = {
  title,
  description,
};

const App = async () => {
  // Cached DAL — deduplicates with layout's getSession() call (zero extra DB cost).
  // verifySession redirects to /login if not authenticated.
  const session = await verifySession();

  const user = {
    name: session.user.name ?? null,
    email: session.user.email ?? "",
    image: session.user.image ?? null,
  };

  // Prefetch data on the server — client components get it instantly via HydrateClient.
  // Wrapped in try/catch: if DB or auth fails during SSR, the page still renders
  // and client-side RTK Query hooks will fetch the data instead.
  try {
    await Promise.all([
      serverTrpc.sessions.list.prefetch(),
      serverTrpc.billing.getCreditBalance.prefetch(),
    ]);
  } catch {
    // SSR prefetch failed — client-side will retry via useGetSessionsQuery()
  }

  return (
    <HydrateClient>
      <Header title="Rubic" version="1.0" user={user}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider orgId={session?.user?.id ?? ""}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-3xl -mt-16">
          {/* Hero text */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">What can I do for you?</h1>
            <p className="text-muted-foreground text-sm">
              Your AI assistant for research, coding, design, and more
            </p>
          </div>

          {/* Input */}
          <ChatSection showConfigBar />

          {/* Example prompts — Manus-style quick-start cards */}
          <ExamplePrompts />
        </div>
      </main>

      {/* Onboarding wizard — shown on first login */}
      <OnboardingWizard />
    </HydrateClient>
  );
};

export default App;
