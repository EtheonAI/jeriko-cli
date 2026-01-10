import type { UIMessage } from "ai";
import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import { twMerge } from "tailwind-merge";

type MessageProps = {
  data: UIMessage;
  markdown?: ComponentProps<typeof Markdown>;
};

export const Message = ({ data, markdown }: MessageProps) => {
  // Extract text content from parts array
  const textContent = data.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

  return (
    <div
      className={twMerge(
        "flex max-w-[80%] flex-col gap-2 rounded-xl px-4 py-2",
        data.role === "user"
          ? "self-end bg-foreground text-background"
          : "self-start bg-muted"
      )}
    >
      <Markdown {...markdown}>{textContent}</Markdown>
    </div>
  );
};