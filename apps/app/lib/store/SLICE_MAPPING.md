# Redux Slice Mapping Documentation

This document maps each Redux slice, its state structure, actions, and what triggers each action (API Call, WebSocket/Streaming, State Only).

## Trigger Types

- **API**: Makes HTTP request via RTK Query or tRPC
- **WS**: Sends/receives message via WebSocket
- **Stream**: Handles streaming data via WebSocket
- **State**: Updates Redux state only (no network)
- **Auth**: Integrates with better-auth

---

## Core Slices

### 1. `auth` - Authentication State

**Integration**: better-auth

| Subkey | Type | Description |
|--------|------|-------------|
| `user` | User \| null | Current authenticated user |
| `isAuthenticated` | boolean | Whether user is logged in |
| `isLoading` | boolean | Auth operation in progress |
| `error` | string \| null | Last auth error |
| `accessToken` | string \| null | JWT access token |
| `refreshToken` | string \| null | JWT refresh token |
| `tokenExpiresAt` | string \| null | Token expiration time |
| `loginStep` | enum | Current step in login flow |
| `mfaRequired` | boolean | Whether MFA is required |
| `mfaMethod` | enum \| null | MFA method (totp/sms/email) |
| `registrationStep` | enum | Current registration step |
| `pendingEmail` | string \| null | Email pending verification |
| `verificationCodeSent` | boolean | Verification email sent |
| `passwordResetRequested` | boolean | Password reset requested |
| `oauthProvider` | enum \| null | Active OAuth provider |
| `oauthLoading` | boolean | OAuth operation in progress |
| `pendingInvitation` | object \| null | Pending team invitation |

**Actions & Triggers**:
| Action | Trigger | Description |
|--------|---------|-------------|
| `setUser` | Auth + State | Set user from better-auth session |
| `updateUser` | API + State | Update user profile |
| `setLoading` | State | Set loading state |
| `setError` | State | Set error message |
| `setTokens` | Auth | Store auth tokens |
| `clearTokens` | Auth | Clear auth tokens |
| `setLoginStep` | State | Update login flow step |
| `setMfaRequired` | Auth | MFA required from server |
| `logout` | Auth + WS | Sign out + disconnect WebSocket |

---

### 2. `websocket` - WebSocket Connection State

**Integration**: WebSocket middleware

| Subkey | Type | Description |
|--------|------|-------------|
| `status` | ConnectionStatus | disconnected/connecting/connected/error |
| `socketId` | string \| null | Server-assigned socket ID |
| `rooms` | string[] | Subscribed room IDs |
| `reconnectAttempts` | number | Number of reconnect attempts |
| `lastError` | string \| null | Last connection error |
| `lastConnectedAt` | string \| null | Last successful connection time |

**Actions & Triggers**:
| Action | Trigger | Description |
|--------|---------|-------------|
| `setConnectionStatus` | WS | Update connection status |
| `setSocketId` | WS | Set socket ID from server |
| `joinRoom` | WS + State | Join a room (session/agent) |
| `leaveRoom` | WS + State | Leave a room |
| `clearRooms` | State | Clear all room subscriptions |
| `setLastError` | WS | Set connection error |
| `disconnect` | WS | Force disconnect |

---

### 3. `chat` - Chat/Messaging State

**Integration**: RTK Query + WebSocket Streaming

| Subkey | Type | Description |
|--------|------|-------------|
| `messages` | Record<string, Message[]> | Messages by session ID |
| `isStreaming` | boolean | AI is streaming response |
| `currentStreamingMessageId` | string \| null | ID of message being streamed |
| `inputValue` | string | Current input text |
| `isLoading` | boolean | Loading messages |
| `error` | string \| null | Chat error |
| `taskMode` | TaskMode | standard/adaptive/agent |
| `inputMode` | InputMode | text/voice |
| `microphonePermission` | enum | prompt/granted/denied |
| `sendQuestionBehavior` | enum \| null | enter/ctrl_enter/cmd_enter |
| `files` | ChatFile[] | Attached files |
| `chatExtData` | object \| null | Extended chat context |
| `showSharePopover` | string \| null | Session ID for share popover |
| `playbookInfo` | PlaybookInfo \| null | Active playbook |
| `recommendedPlaybooks` | PlaybookInfo[] | Suggested playbooks |
| `isTyping` | boolean | User is typing |
| `typingUsers` | string[] | Other users typing |

**Actions & Triggers**:
| Action | Trigger | Description |
|--------|---------|-------------|
| `setMessages` | API | Load messages from server |
| `addMessage` | API + WS | Add new message |
| `updateMessage` | WS | Update message content |
| `appendToMessage` | Stream | Append streaming chunk |
| `setStreaming` | WS | Set streaming state |
| `setInputValue` | State | Update input text |
| `addChatFile` | State | Add file attachment |
| `removeChatFile` | State | Remove file attachment |
| `setTaskMode` | State | Change task mode |
| `addTypingUser` | WS | Add typing indicator |
| `removeTypingUser` | WS | Remove typing indicator |

---

### 4. `sessions` - Session Management

**Integration**: RTK Query + WebSocket

| Subkey | Type | Description |
|--------|------|-------------|
| `sessions` | AgentSession[] | All sessions |
| `currentSessionId` | string \| null | Active session |
| `isLoading` | boolean | Loading sessions |
| `error` | string \| null | Session error |
| `groups` | SessionGroup[] | Session folders |
| `searchQuery` | string | Filter search |
| `filterStatus` | enum | Status filter |
| `filterMode` | enum | Mode filter |
| `sortBy` | enum | Sort field |
| `sortOrder` | asc/desc | Sort direction |
| `showArchived` | boolean | Show archived |
| `hasMore` | boolean | Pagination flag |
| `cursor` | string \| null | Pagination cursor |
| `totalCount` | number | Total sessions |
| `selectedSessionIds` | string[] | Selected for bulk |
| `recentSessionIds` | string[] | Recent sessions |

**Actions & Triggers**:
| Action | Trigger | Description |
|--------|---------|-------------|
| `setSessions` | API | Load sessions from server |
| `addSession` | API + WS | Create new session |
| `updateSession` | API + WS | Update session |
| `removeSession` | API | Delete session |
| `archiveSession` | API | Archive session |
| `setCurrentSession` | State + WS | Select session + join room |
| `toggleSessionPinned` | API | Pin/unpin session |
| `setSearchQuery` | State | Update search filter |
| `setFilterStatus` | State | Update status filter |

---

### 5. `notifications` - Notifications

**Integration**: RTK Query + WebSocket (real-time)

| Subkey | Type | Description |
|--------|------|-------------|
| `notifications` | Notification[] | All notifications |
| `unreadCount` | number | Total unread |
| `unreadByType` | Record<type, number> | Unread by type |
| `preferences` | NotificationPreferences | User prefs |
| `hasMore` | boolean | Pagination flag |
| `cursor` | string \| null | Pagination cursor |
| `isLoading` | boolean | Loading state |
| `isLoadingMore` | boolean | Loading more |
| `filter` | object | Current filter |
| `hasNewNotifications` | boolean | New notifications arrived |
| `lastFetchedAt` | string \| null | Last fetch time |
| `error` | string \| null | Error message |

**Actions & Triggers**:
| Action | Trigger | Description |
|--------|---------|-------------|
| `setNotifications` | API | Load notifications |
| `addNotification` | WS | Real-time new notification |
| `markAsRead` | API + WS | Mark as read |
| `markAllAsRead` | API | Mark all as read |
| `deleteNotification` | API | Delete notification |
| `setPreferences` | API | Update preferences |
| `setFilter` | State | Change filter |

---

### 6. `agents` - AI Agent State

**Integration**: RTK Query + WebSocket

| Subkey | Type | Description |
|--------|------|-------------|
| `agents` | Record<string, Agent[]> | Agents by session |
| `tasks` | Record<string, AgentTask[]> | Tasks by agent |
| `selectedAgentId` | string \| null | Selected agent |
| `isLoading` | boolean | Loading state |
| `error` | string \| null | Error message |

**Actions & Triggers**:
| Action | Trigger | Description |
|--------|---------|-------------|
| `setAgents` | API | Load agents |
| `updateAgent` | WS | Real-time agent update |
| `addTask` | WS | New task from agent |
| `updateTask` | WS | Task status update |
| `setSelectedAgent` | State | Select agent |

---

## Feature Slices (Manus-style)

### 7. `connectors` - External Integrations

**Integration**: RTK Query

| Subkey | Type | Description |
|--------|------|-------------|
| `availableConnectors` | Connector[] | All available connectors |
| `installedConnectors` | InstalledConnector[] | User's installed |
| `isLoading` | boolean | Loading state |
| `isSyncing` | boolean | Sync in progress |
| `syncingConnectorId` | string \| null | Currently syncing |
| `error` | string \| null | Error message |
| `filter` | object | Filter state |

### 8. `projects` - Project Management

**Integration**: RTK Query

| Subkey | Type | Description |
|--------|------|-------------|
| `projects` | Project[] | All projects |
| `currentProject` | Project \| null | Active project |
| `projectSessions` | Record<string, Session[]> | Sessions by project |
| `isLoading` | boolean | Loading state |
| `error` | string \| null | Error message |

### 9. `team` - Team Management

**Integration**: RTK Query + better-auth organization

| Subkey | Type | Description |
|--------|------|-------------|
| `teams` | Team[] | User's teams |
| `currentTeam` | Team \| null | Active team |
| `members` | TeamMember[] | Team members |
| `invitations` | TeamInvitation[] | Pending invites |
| `isLoading` | boolean | Loading state |

### 10. `knowledge` - Knowledge Base

**Integration**: RTK Query

| Subkey | Type | Description |
|--------|------|-------------|
| `attachments` | Attachment[] | All attachments |
| `groups` | AttachmentGroup[] | Attachment groups |
| `knowledgeBases` | KnowledgeBase[] | Knowledge bases |
| `selectedGroupId` | string \| null | Selected group |
| `isLoading` | boolean | Loading state |

### 11. `scheduledTasks` - Scheduled Tasks

**Integration**: RTK Query

| Subkey | Type | Description |
|--------|------|-------------|
| `tasks` | ScheduledTask[] | All scheduled tasks |
| `executions` | Record<string, Execution[]> | Task executions |
| `selectedTaskId` | string \| null | Selected task |
| `isLoading` | boolean | Loading state |

### 12. `billing` - Billing & Subscription

**Integration**: RTK Query

| Subkey | Type | Description |
|--------|------|-------------|
| `subscription` | Subscription \| null | Current subscription |
| `creditBalance` | number | Credit balance |
| `usageHistory` | UsageRecord[] | Usage history |
| `invoices` | Invoice[] | Billing invoices |
| `paymentMethods` | PaymentMethod[] | Payment methods |

---

## UI Slices

### 13. `ui` - Global UI State

**Integration**: State only

| Subkey | Type | Description |
|--------|------|-------------|
| `theme` | light/dark/system | Color theme |
| `sidebarState` | open/collapsed/hidden | Sidebar state |
| `toasts` | Toast[] | Toast notifications |
| `modals` | Modal[] | Open modals |
| `isMobile` | boolean | Mobile viewport |
| `breakpoint` | string | Current breakpoint |

### 14. `workspace` - Workspace Layout

**Integration**: State only

| Subkey | Type | Description |
|--------|------|-------------|
| `activePanel` | string \| null | Active panel |
| `panels` | Panel[] | Open panels |
| `layout` | LayoutConfig | Layout configuration |

### 15-39. Additional Slices

The remaining slices follow similar patterns:

- `navbar` - Navigation bar state
- `webDev` - Web development features
- `codeViewer` - Code viewer state
- `filePreviewer` - File preview state
- `slideEditor` - Slide editor state
- `aiCanvas` - AI canvas state
- `onboarding` - Onboarding flow
- `sessionSwitch` - Session switcher
- `community` - Community features
- `fileManagement` - File management
- `fileConnector` - File connector OAuth
- `products` - Products catalog
- `fileShare` - File sharing
- `mapReduce` - Map-reduce operations
- `mailAgent` - Email agent
- `webDevUsage` - Usage tracking
- `library` - Attachment library
- `timeline` - Session timeline
- `login` - Login flow UI
- `example` - Example templates
- `guestPage` - Guest mode
- `myBrowser` - Browser extension
- `experiment` - Feature flags
- `configs` - Client configuration

---

## Integration Summary

| Integration Type | Slices |
|-----------------|--------|
| **better-auth** | `auth`, `team` |
| **WebSocket (real-time)** | `websocket`, `chat`, `sessions`, `notifications`, `agents` |
| **WebSocket (streaming)** | `chat` |
| **RTK Query (API)** | All feature slices |
| **State only** | `ui`, `workspace`, `navbar`, `login`, etc. |
