import type { SessionContext, TimelineEntry } from "../types/index.js";

export class SessionContextLoader {
  private sessions: Map<string, SessionContext> = new Map();

  createSession(sessionId: string, userId?: string): SessionContext {
    const session: SessionContext = {
      sessionId,
      userId,
      tools: [],
      skills: [],
      timeline: [],
      mode: "normal",
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): SessionContext | undefined {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId: string, updates: Partial<SessionContext>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    Object.assign(session, updates);
    return true;
  }

  addTool(sessionId: string, toolName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.tools.includes(toolName)) {
      session.tools.push(toolName);
    }
    return true;
  }

  addSkill(sessionId: string, skillName: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    if (!session.skills.includes(skillName)) {
      session.skills.push(skillName);
    }
    return true;
  }

  addTimelineEntry(sessionId: string, event: string, metadata?: Record<string, unknown>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const entry: TimelineEntry = {
      timestamp: new Date().toISOString(),
      event,
      metadata,
    };

    session.timeline.push(entry);
    return true;
  }

  getTimeline(sessionId: string): TimelineEntry[] {
    const session = this.sessions.get(sessionId);
    return session?.timeline || [];
  }

  setMode(sessionId: string, mode: "plan" | "execute" | "normal"): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.mode = mode;
    this.addTimelineEntry(sessionId, `mode_changed_to_${mode}`);
    return true;
  }

  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  clear(): void {
    this.sessions.clear();
  }

  count(): number {
    return this.sessions.size;
  }
}
