import type { Metadata } from "next";
import { Header } from "../../components/header/index";
import { DemoChatClient } from "./demo-chat-client";

export const metadata: Metadata = {
  title: "Chat Demo | Rubic",
  description: "Demo chat showcasing all UI components",
};

export default function DemoChatPage() {
  return (
    <>
      <Header
        title="Rubic Demo"
        version="1.0"
        user={{
          name: "Demo User",
          email: "demo@rubic.ai",
          image: null,
        }}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <DemoChatClient />
      </div>
    </>
  );
}
