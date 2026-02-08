import { describe, it, expect, vi } from "vitest";

// Test the groupSessionsByDate utility logic (extracted from sidebar)
describe("groupSessionsByDate", () => {
  type Session = {
    id: string;
    title: string | null;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt: string | Date;
    updatedAt: string | Date;
  };

  function groupSessionsByDate(sessions: Session[]) {
    const buckets: Record<string, Session[]> = {};
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const lastWeek = new Date(today.getTime() - 7 * 86400000);

    const order = ["Today", "Yesterday", "Last 7 days", "Older"];

    for (const session of sessions) {
      const date = new Date(session.updatedAt);
      let label: string;
      if (date >= today) label = "Today";
      else if (date >= yesterday) label = "Yesterday";
      else if (date >= lastWeek) label = "Last 7 days";
      else label = "Older";

      if (!buckets[label]) buckets[label] = [];
      buckets[label].push(session);
    }

    const groups: { label: string; sessions: Session[] }[] = [];
    for (const label of order) {
      if (buckets[label]?.length) {
        groups.push({ label, sessions: buckets[label] });
      }
    }

    return groups;
  }

  it("groups today sessions correctly", () => {
    const sessions: Session[] = [
      { id: "s1", title: "Today Chat", createdAt: new Date(), updatedAt: new Date() },
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
    expect(groups[0].sessions).toHaveLength(1);
  });

  it("groups sessions into multiple buckets", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessions: Session[] = [
      { id: "s1", title: "Today", createdAt: today, updatedAt: today },
      {
        id: "s2",
        title: "Yesterday",
        createdAt: new Date(today.getTime() - 86400000),
        updatedAt: new Date(today.getTime() - 86400000),
      },
      {
        id: "s3",
        title: "Last Week",
        createdAt: new Date(today.getTime() - 3 * 86400000),
        updatedAt: new Date(today.getTime() - 3 * 86400000),
      },
      {
        id: "s4",
        title: "Old",
        createdAt: new Date(today.getTime() - 30 * 86400000),
        updatedAt: new Date(today.getTime() - 30 * 86400000),
      },
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(4);

    const labels = groups.map((g) => g.label);
    expect(labels).toEqual(["Today", "Yesterday", "Last 7 days", "Older"]);
  });

  it("returns empty array for empty sessions", () => {
    const groups = groupSessionsByDate([]);
    expect(groups).toEqual([]);
  });

  it("maintains correct order even if only some buckets have sessions", () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sessions: Session[] = [
      { id: "s1", title: "Today", createdAt: today, updatedAt: today },
      {
        id: "s2",
        title: "Old",
        createdAt: new Date(today.getTime() - 30 * 86400000),
        updatedAt: new Date(today.getTime() - 30 * 86400000),
      },
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe("Today");
    expect(groups[1].label).toBe("Older");
  });

  it("handles string dates from database", () => {
    const sessions: Session[] = [
      {
        id: "s1",
        title: "String Date",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
    const groups = groupSessionsByDate(sessions);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("Today");
  });
});
