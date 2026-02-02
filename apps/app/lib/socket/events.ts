// Socket.io event types for type-safe communication

// Client -> Server events
export interface ClientToServerEvents {
  // Room management
  "room:join": (roomId: string) => void;
  "room:leave": (roomId: string) => void;

  // Chat events
  "message:send": (data: { sessionId: string; content: string }) => void;
  "message:typing": (data: { sessionId: string; isTyping: boolean }) => void;

  // Agent events
  "agent:command": (data: {
    agentId: string;
    command: string;
    payload?: Record<string, unknown>;
  }) => void;

  // Presence
  "presence:update": (data: { status: string }) => void;
}

// Server -> Client events
export interface ServerToClientEvents {
  // Connection events
  "connection:established": (data: { socketId: string }) => void;
  "connection:error": (data: { message: string }) => void;

  // Room events
  "room:joined": (roomId: string) => void;
  "room:left": (roomId: string) => void;
  "room:users": (data: { roomId: string; users: string[] }) => void;

  // Message events
  "message:new": (data: {
    sessionId: string;
    message: {
      id: string;
      role: string;
      content: string;
      createdAt: string;
      metadata?: Record<string, unknown>;
    };
  }) => void;
  "message:update": (data: {
    sessionId: string;
    messageId: string;
    content: string;
  }) => void;
  "message:stream": (data: {
    sessionId: string;
    messageId: string;
    chunk: string;
    done?: boolean;
  }) => void;
  "message:typing": (data: {
    sessionId: string;
    userId: string;
    isTyping: boolean;
  }) => void;

  // Agent events
  "agent:created": (data: {
    sessionId: string;
    agent: {
      id: string;
      type: string;
      name: string | null;
      status: string;
    };
  }) => void;
  "agent:update": (data: {
    sessionId: string;
    agentId: string;
    updates: {
      status?: string;
      currentTask?: string;
      progress?: number;
    };
  }) => void;
  "agent:task:new": (data: {
    agentId: string;
    task: {
      id: string;
      title: string;
      description: string | null;
      status: string;
      priority: number;
    };
  }) => void;
  "agent:task:update": (data: {
    agentId: string;
    taskId: string;
    updates: {
      status?: string;
      result?: Record<string, unknown>;
    };
  }) => void;

  // Session events
  "session:new": (data: {
    session: {
      id: string;
      title: string | null;
      status: string;
      createdAt: string;
    };
  }) => void;
  "session:update": (data: {
    sessionId: string;
    updates: {
      title?: string;
      status?: string;
    };
  }) => void;

  // File events
  "file:new": (data: {
    sessionId: string;
    file: {
      id: string;
      name: string;
      path: string;
      mimeType: string | null;
      size: number | null;
    };
  }) => void;
  "file:deleted": (data: { sessionId: string; fileId: string }) => void;

  // Presence events
  "presence:online": (data: { userId: string }) => void;
  "presence:offline": (data: { userId: string }) => void;
}

// Inter-server events (for scaling with Redis)
export interface InterServerEvents {
  ping: () => void;
}

// Socket data attached to each socket
export interface SocketData {
  userId: string;
  sessionIds: string[];
}
