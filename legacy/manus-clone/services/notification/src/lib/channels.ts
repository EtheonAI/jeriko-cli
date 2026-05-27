export interface ChannelPreferences {
  emailEnabled?: boolean | null;
  pushEnabled?: boolean | null;
  inAppEnabled?: boolean | null;
  typeSettings?: Record<string, { email?: boolean; push?: boolean; inApp?: boolean }> | null;
  quietHoursEnabled?: boolean | null;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  quietHoursTimezone?: string | null;
}

export interface ActiveChannels {
  inApp: boolean;
  push: boolean;
  email: boolean;
}

/**
 * Determine which notification channels are active based on user preferences and notification type.
 */
export function getActiveChannels(prefs: ChannelPreferences | null, type: string): ActiveChannels {
  // Default: all channels active
  if (!prefs) {
    return { inApp: true, push: true, email: true };
  }

  // Start with global preferences
  let inApp = prefs.inAppEnabled !== false;
  let push = prefs.pushEnabled !== false;
  let email = prefs.emailEnabled !== false;

  // Apply per-type overrides if present
  const typeOverride = prefs.typeSettings?.[type];
  if (typeOverride) {
    if (typeof typeOverride.inApp === "boolean") inApp = typeOverride.inApp;
    if (typeof typeOverride.push === "boolean") push = typeOverride.push;
    if (typeof typeOverride.email === "boolean") email = typeOverride.email;
  }

  return { inApp, push, email };
}

/**
 * Check if current time falls within the user's configured quiet hours.
 */
export function isQuietHours(prefs: ChannelPreferences | null): boolean {
  if (!prefs?.quietHoursEnabled || !prefs.quietHoursStart || !prefs.quietHoursEnd) {
    return false;
  }

  const timezone = prefs.quietHoursTimezone || "UTC";

  let nowStr: string;
  try {
    nowStr = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone,
    });
  } catch {
    // Invalid timezone, fall back to UTC
    nowStr = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  }

  const nowMinutes = toMinutes(nowStr);
  const startMinutes = toMinutes(prefs.quietHoursStart);
  const endMinutes = toMinutes(prefs.quietHoursEnd);

  // Handle overnight quiet hours (e.g., 22:00 - 07:00)
  if (startMinutes <= endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  // Wraps midnight
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

function toMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * Apply quiet hours logic to channels. During quiet hours, non-urgent notifications
 * skip push and inApp delivery. Email is still delivered (may be batched).
 */
export function applyQuietHours(
  channels: ActiveChannels,
  prefs: ChannelPreferences | null,
  priority: string
): ActiveChannels {
  if (priority === "urgent") {
    return channels;
  }

  if (isQuietHours(prefs)) {
    return {
      ...channels,
      push: false,
      inApp: false,
    };
  }

  return channels;
}
