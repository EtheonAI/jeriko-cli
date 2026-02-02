"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/ui/avatar";
import { cn } from "@repo/design-system/lib/utils";
import { BotIcon } from "lucide-react";

type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

const demoMessages: DemoMessage[] = [
  {
    id: "1",
    role: "user",
    content: "Can you help me create a daily weather forecast email automation?",
    timestamp: "10:30 AM",
  },
  {
    id: "2",
    role: "assistant",
    content: "I'd be happy to help you set up a daily weather forecast email automation. Here's what I can do:\n\n1. **Data Source**: I'll fetch weather data from a reliable API like OpenWeatherMap or Weather.gov\n\n2. **Email Template**: Create a clean, formatted email with:\n   - Current temperature and conditions\n   - High/low for the day\n   - 5-day forecast preview\n   - Weather alerts if any\n\n3. **Scheduling**: Set up daily delivery at your preferred time\n\nWould you like me to proceed with this setup? Which city should I configure the forecast for?",
    timestamp: "10:31 AM",
  },
  {
    id: "3",
    role: "user",
    content: "Yes please! Set it up for San Francisco, CA. I'd like to receive it at 6 AM every day.",
    timestamp: "10:32 AM",
  },
  {
    id: "4",
    role: "assistant",
    content: "I've configured the weather automation for San Francisco, CA with daily delivery at 6:00 AM PST.\n\n**Setup Complete:**\n- Location: San Francisco, CA\n- Delivery Time: 6:00 AM (PST)\n- Frequency: Daily\n- Content: Current conditions, daily forecast, 5-day outlook\n\nYou'll receive your first weather email tomorrow morning. Would you like me to send a test email now to preview the format?",
    timestamp: "10:33 AM",
  },
];

export const DemoChat = () => {
  return (
    <div className="flex flex-col gap-4 py-4">
      {demoMessages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "flex gap-3 px-4",
            message.role === "user" ? "flex-row-reverse" : "flex-row"
          )}
        >
          <Avatar className="h-8 w-8 shrink-0">
            {message.role === "assistant" ? (
              <>
                <AvatarFallback className="bg-primary text-primary-foreground">
                  <BotIcon className="h-4 w-4" />
                </AvatarFallback>
              </>
            ) : (
              <>
                <AvatarImage src="/avatars/user.jpg" alt="User" />
                <AvatarFallback>U</AvatarFallback>
              </>
            )}
          </Avatar>
          <div
            className={cn(
              "flex max-w-[80%] flex-col gap-1",
              message.role === "user" ? "items-end" : "items-start"
            )}
          >
            <div
              className={cn(
                "rounded-lg px-4 py-2 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
            <span className="text-xs text-muted-foreground">
              {message.timestamp}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
