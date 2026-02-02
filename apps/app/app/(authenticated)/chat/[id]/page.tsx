import { auth } from "@repo/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Header } from "../../components/header/index";
import { ChatInputToolbar } from "../../components/chat-input-toolbar";
import { notFound } from "next/navigation";

type ChatPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: ChatPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Chat ${id} | Rubic`,
    description: "Continue your conversation with Rubic",
  };
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });

  // In production, fetch chat data from database
  // For now, we'll just display the chat ID
  if (!id) {
    notFound();
  }

  return (
    <>
      <Header
        title="Rubic"
        version="1.0"
        user={{
          name: session?.user?.name ?? null,
          email: session?.user?.email ?? "",
          image: session?.user?.image ?? null,
        }}
      />
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-3xl space-y-4">
            {/* Chat messages would go here */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                Chat ID: {id}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Chat messages will appear here
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 border-t bg-background p-4">
          <div className="mx-auto max-w-3xl">
            <ChatInputToolbar />
          </div>
        </div>
      </div>
    </>
  );
}
