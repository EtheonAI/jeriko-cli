import { auth } from "@repo/auth";
import type { Metadata } from "next";
import dynamic from "next/dynamic";
import { env } from "@/env";
import { AvatarStack } from "./components/avatar-stack";
import { Cursors } from "./components/cursors";
import { Header } from "./components/header/index";
import { ChatSection } from "./components/chat-section";
import { headers } from "next/headers";

const title = "Rubic";
const description = "AI-powered productivity platform.";

const CollaborationProvider = dynamic(() =>
  import("./components/collaboration-provider").then((mod) => mod.CollaborationProvider)
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
      <Header title="Rubic" version="1.0" user={user}>
        {env.LIVEBLOCKS_SECRET && (
          <CollaborationProvider orgId={session?.user?.id ?? ""}>
            <AvatarStack />
            <Cursors />
          </CollaborationProvider>
        )}
      </Header>
      <main className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-6 w-full max-w-xl -mt-16">
          {/* Hero text */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">What can I do for you?</h1>
            <p className="text-muted-foreground text-sm">
              Your AI assistant for research, coding, design, and more
            </p>
          </div>

          {/* Input */}
          <ChatSection showConfigBar />
        </div>
      </main>
    </>
  );
};

export default App;
