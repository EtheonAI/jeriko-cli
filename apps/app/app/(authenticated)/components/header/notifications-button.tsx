"use client";

import { useEffect, useState } from "react";
import { NotificationsTrigger } from "@repo/notifications/components/trigger";
import { Button } from "@repo/design-system/components/ui/button";
import { BellIcon } from "lucide-react";

export function NotificationsButton() {
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder during SSR to avoid hydration mismatch
  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <BellIcon className="h-5 w-5" />
      </Button>
    );
  }

  return <NotificationsTrigger />;
}
