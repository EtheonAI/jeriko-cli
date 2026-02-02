import { auth } from "@repo/auth";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { env } from "@/env";
import { AvatarStack } from "./components/avatar-stack";
import { Cursors } from "./components/cursors";
import { Header } from "./components/header/index";
import { CapabilityCards } from "./components/capability-cards";
import { ChatSection } from "./components/chat-section";
import { headers } from "next/headers";

const title = "Rubic";
const description = "AI-powered productivity platform.";

const CollaborationProvider = dynamic(() =>
  import("./components/collaboration-provider").then(
    (mod) => mod.CollaborationProvider
  )
);

export const metadata: Metadata = {
  title,
  description,
};

const App = async () => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  const user = {
    name: session?.user?.name ?? null,
    email: session?.user?.email ?? "",
    image: session?.user?.image ?? null,
  };

  return (
    <>
      <Header title="Rubic" version="1.0" user={user} credits={600} isPro={false}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider orgId={session?.user?.id ?? ""}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <div className="flex flex-1 flex-col p-4 pt-0">
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-8">
          {/* Hero Section */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
              What can I do for you?
            </h1>
            <p className="text-muted-foreground text-lg">
              Your AI assistant for research, coding, design, and more
            </p>
          </div>

          {/* Chat Input with Toolbar */}
          <ChatSection />

          {/* Capability Cards */}
          <div className="w-full max-w-5xl pt-8">
            <CapabilityCards />
          </div>
        </div>
      </div>
    </>
  );
};

export default App;
