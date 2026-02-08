
# Redux State Slice Explanations

This document provides a detailed, practical explanation of what each of the 44 Redux slices does, based on the actual state data. The purpose and role of each slice in the application are described below.

---

### 1. `_persist`

*   **Slice Type**: Regular
*   **Purpose**: This slice is used by the `redux-persist` library. It doesn't hold application data, but rather metadata about the persistence process itself. The `version` number helps manage migrations between different state structures over time, and `rehydrated: true` indicates that the persisted state has been successfully loaded back into the Redux store upon application startup.

### 2. `agentWorkspace`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the UI state of the main agent interaction workspace. It controls the visibility and layout of various components like the sidebar (`sidebarType`, `isSidebarVisibleInMobile`), the timeline (`isTimelinePlaying`), and dialogs (`vncDialogVisible`). It also tracks UI states like animations (`animationLock`) and whether the planner view is expanded (`isPlannerExpanded`).

### 3. `aiCanvas`

*   **Slice Type**: Regular
*   **Purpose**: This acts as a data store for the AI-powered canvas feature. It holds a map of all created canvas instances (`allAiCanvas`) and caches the results of Optical Character Recognition (`ocrCache`) performed on images within the canvases. This allows the application to store multiple canvas sessions and quickly retrieve OCR data without re-processing.

### 4. `aiCanvasEditor`

*   **Slice Type**: Regular
*   **Purpose**: This is a complex slice that holds the entire state for an active AI canvas *editor* session. It tracks every detail, including all the shapes drawn on the canvas (`shapes`), the user's camera position (pan/zoom via `camera`), the currently selected tool (`interaction.activeTool`), and the state of interactive features like brushing, marking, and text editing. It also manages settings, context menus, and a history for comments.

### 5. `api`

*   **Slice Type**: **RTK Query**
*   **Purpose**: This is the **only** RTK Query slice in the entire application. It is the central point for managing all asynchronous data fetching from the backend API. It automatically handles caching, loading/error states, and data subscriptions for API endpoints. The state contains `queries` (for data retrieval like `getSessionFiles`), `mutations` (for data modification like `uploadToS3`), and configuration for caching behavior. It is the backbone of the application's data communication with the server.

### 6. `auth`

*   **Slice Type**: Regular
*   **Purpose**: This slice is responsible for everything related to the authenticated user. It stores the user's complete profile information (`userInfo`), including their email, name, avatar, subscription status (`membershipVersion`), and specific feature quotas (`fileUploadQuota`). It also holds their available credits and usage data (`usageInfo`), global client settings (`clientConfig`), and any active A/B testing flags assigned to them from the backend (`backendVariants`).

### 7. `biz`

*   **Slice Type**: Regular
*   **Purpose**: As you asked, the **`biz`** slice specifically handles all **business, billing, and subscription-related data**. It stores information about available credit packages (`creditPackages`), different personal and team subscription plans (`personalPlanTiers`, `teamPlanTiers`), and special enterprise features like SSO/SCIM pricing (`teamSSOSubscription`). It also tracks available trial periods (`trials`) and the user's auto top-up settings (`userAutoTopupInfo`). Essentially, it contains all the data needed to display pricing pages, manage subscriptions, and handle user billing.

### 8. `chat`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the state of the chat input area and its associated features. It holds the content of the message being composed (`editorContent`), any attached files (`files`), and the selected task mode (`taskMode`). It also stores lists of available assets for the user to choose from, such as slide presentation templates (`slideTemplateList`), image generation styles (`imageStyleList`), and recommended playbooks (`recommendedPlaybooksV2`).

### 9. `codeViewer`

*   **Slice Type**: Regular
*   **Purpose**: This manages the state for the in-app code viewer and editor. It holds the file and directory structure being viewed (`rootDirectory`, `directoryList`), the content of opened files (`fileDataSource`), the list of open tabs (`fileTabList`), and which tab is currently active (`activeTabId`).

### 10. `community`

*   **Slice Type**: Regular
*   **Purpose**: This slice powers the "Community" or "Explore" page of the application. It stores the list of shared sessions or projects from other users (`dataSource`) and organizes them into groups for display (`groupedIds`, `groupedTotalMap`).

### 11. `configs`

*   **Slice Type**: Regular
*   **Purpose**: This slice stores user-specific, client-side preferences that persist locally on their device. This includes UI preferences like the chosen color theme (`theme`), whether the session list is pinned (`sessionListPinned`), and the client's unique identifier (`clientId`). These are settings that tailor the user's local experience.

### 12. `connectors`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages all third-party integrations, which are called "connectors." It holds a list of all available connectors (`connectors`), which ones the user has installed or enabled, and any associated data, such as a list of the user's GitHub repositories (`githubRepositories`) if the GitHub connector is active.

### 13. `enterpriseTeam`

*   **Slice Type**: Regular
*   **Purpose**: This slice is dedicated to features for enterprise-level teams. It stores sensitive administrative data such as the team's API keys (`apiKeys`) and audit logs (`auditLogs`) for tracking team member activity.

### 14. `example`

*   **Slice Type**: Regular
*   **Purpose**: This slice holds a list of example prompts or templates (`exampleList`) that are displayed to the user, likely on the homepage or in the chat input to give them ideas for what to ask the AI.

### 15. `experiment`

*   **Slice Type**: Regular
*   **Purpose**: This slice is crucial for A/B testing and feature flagging. It stores two sets of experiment variants: `variants` come from a client-side SDK (like Statsig or LaunchDarkly) and are available immediately on load, while `backendVariants` are sent from the server API. This allows the application to dynamically show different features or UI to different users to test their effectiveness.

### 16. `fileConnector`

*   **Slice Type**: Regular
*   **Purpose**: This slice specifically manages the connection status for file-based cloud storage integrations. It tracks whether the user has successfully authenticated with services like Google Drive, OneDrive, Figma, and various Microsoft/Google services (`fileConnectorList`).

### 17. `fileManagement`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the UI for the main file management panel. It stores the list of files associated with the current session (`sessionFileList`), the user's file spaces (`spaces`), and the state of the panel itself, such as the active tab (`fileTab`) and whether the user is in download mode (`isDownloadMode`).

### 18. `filePreviewer`

*   **Slice Type**: Regular
*   **Purpose**: This slice controls the state of the file previewer modal. When a user clicks on a file to view it, this slice holds the data for that specific file (`previewData`), its save/sync status (`saveStatus`, `syncingFile`), and the UI mode (e.g., `fullscreen`, `currentSlideId`).

### 19. `fileShare`

*   **Slice Type**: Regular
*   **Purpose**: This slice is for the public-facing file sharing page. When a user visits a public link to a shared file, this slice fetches and stores the public information about that share (`shareInfo`) and the file itself (`fileInfo`).

### 20. `guestPage`

*   **Slice Type**: Regular
*   **Purpose**: This is a simple boolean flag (`isInGuestPage`) that tells the UI whether the current user is unauthenticated and viewing a public or guest-accessible page. This allows the UI to adapt and show or hide certain elements accordingly.

### 21. `knowledge`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the user's personal "knowledge base." It stores a list of facts or pieces of information that the user has explicitly saved (`userKnowledgeList`) and also manages knowledge that the AI has suggested adding to the base (`suggestedKnowledgeMap`).

### 22. `library`

*   **Slice Type**: Regular
*   **Purpose**: This slice powers the user's central attachment library. It stores a list of all attachments the user has ever uploaded (`attachmentList`), allows for filtering by document type (`filterDocType`) and favorites (`isFavorite`), and manages the search and view type (`searchValue`, `viewType`).

### 23. `login`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the entire multi-step login and registration process. It holds the user's entered email and password, handles captcha data (`captchaData`), manages the state of email verification codes (`verifyCode`, `verifyCodeTimeout`), and stores information about any team or educational invitations associated with the email address.

### 24. `mailManus`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the settings for the "Mail Manus" feature, which gives the user a special email address (`tattarifi165@manus.bot`) to interact with the agent. It stores the user's agent email info (`agentEmailInfo`), a whitelist of allowed senders (`emailWhiteList`), and whether there are unread emails from unknown senders (`hasUnreadUnknownEmail`).

### 25. `mapReduce`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the UI state for the parallel processing feature, referred to in the UI as "Map/Reduce." It primarily tracks loading states (`startLoading`) and whether the map/reduce view is in fullscreen mode (`isFullscreen`).

### 26. `meeting`

*   **Slice Type**: Regular
*   **Purpose**: This is a simple slice that holds a boolean flag (`shouldShowMeetingIntro`) to determine whether the application should display an introductory guide or pop-up for the meeting-related features.

### 27. `myBrowser`

*   **Slice Type**: Regular
*   **Purpose**: This slice stores settings related to the user's own browser, likely for a browser extension component of the Manus.im service. It holds the user's settings (`browserSettings`) and a flag to check if installation is allowed (`allowInstall`).

### 28. `navbar`

*   **Slice Type**: Regular
*   **Purpose**: This slice controls the state of the main vertical navigation bar on the left side of the application. It tracks the currently active tab (`tabKey`, e.g., 'task', 'library') and UI states like hover and minimal mode (`isNavbarHovering`, `isNavBarMinimal`).

### 29. `notification`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the in-app notification system. It holds the connection status to the notification service (`connectStatus`), lists of notifications grouped by category (`categoryNotifications`), and the state for the dedicated "What's New" update page (`updatePageNotificationList`). It also tracks whether the notification panel is visible and if there are new, unread items (`hasNew`).

### 30. `onboarding`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the state of the new user onboarding flow. It tracks the `currentStep` of the onboarding process and the `userType` (e.g., 'work', 'personal') they selected to customize the experience.

### 31. `products`

*   **Slice Type**: Regular
*   **Purpose**: You also asked about the **`products`** slice. Based on the data, this slice is used for the **creation of new "Playbooks"** (which seem to be a type of reusable template or workflow). It holds the `inputValue` from the creation form, any `files` attached during the creation process, and the resulting `playbookInfo` once it's created. It appears to be a temporary state for the playbook creation UI.

### 32. `project`

*   **Slice Type**: Regular
*   **Purpose**: This slice is for organizing work into distinct projects. It holds the user's list of created projects (`projectList`) and keeps track of the currently selected project (`currentProjectId`).

### 33. `scheduledTask`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages all scheduled and recurring tasks. It holds a list of all tasks the user has scheduled to run in the future (`allScheduleList`) and also keeps a specific list of task IDs that are associated with the current chat session (`chatScheduledTaskIds`).

### 34. `sessionSwitch`

*   **Slice Type**: Regular
*   **Purpose**: This slice powers the quick session switcher modal (likely a command-K style interface). It stores the user's search `keyword` and the filtered list of `sessions` that match the keyword, allowing for fast navigation between different chat sessions.

### 35. `sessions`

*   **Slice Type**: Regular
*   **Purpose**: This is a core slice that manages all chat sessions. It uses **RTK EntityAdapter** to store a normalized list of all sessions (`sessions.ids` and `sessions.entities`), which is an efficient way to manage collections of data. It tracks the `currentSessionId`, the list of collaborators for each session, and the state of the session list UI (e.g., `navTab`, `searchValue`).

### 36. `skills`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages the AI's "skills" or plugins. It holds two lists: `officialSkills` provided by Manus and `userAddedSkills` that the user has chosen to activate. This allows the AI's capabilities to be extended and customized by the user.

### 37. `slideEditor`

*   **Slice Type**: Regular
*   **Purpose**: This slice holds the state for the presentation slide editor. When a user is creating or editing a slide deck, this slice stores the array of `slides` and the `sessionUid` it belongs to.

### 38. `team`

*   **Slice Type**: Regular
*   **Purpose**: This slice manages all data related to team accounts. It stores the list of teams the user is on (`listTeamResponse`), the members of the currently selected team (`teamMemberList`), team-level settings like subscription renewal (`teamRenewalSettings`), and configurations for enterprise features like SSO and SCIM (`ssoInfo`, `accessControls`).

### 39. `timeline`

*   **Slice Type**: Regular
*   **Purpose**: This slice is for the session replay or "timeline" feature. It stores the events of a session, grouped by segments (`segmentEventsMap`), and tracks the current playback position (`percentage`).

### 40. `ui`

*   **Slice Type**: Regular
*   **Purpose**: This slice holds global UI state that affects the entire application layout. It tracks whether the app is in a mobile view (`isMobile`), the current window width (`windowWidth`), and the dimensions of resizable UI panels like the chat sidebar (`chatSidebarWidth`).

### 41. `webDev`

*   **Slice Type**: Regular
*   **Purpose**: This is a very large and complex slice dedicated to the web development feature. It manages the entire state of the web development workspace, including the project's file structure, the live preview, the database browser (`database`), project settings (`setting`), cloud storage (`storage`), and the state for publishing the app (`mobilePublishActiveTab`, `iosBuildLogs`).

### 42. `webDevUsage`

*   **Slice Type**: Regular
*   **Purpose**: This slice is specifically for tracking the billing and usage related to the web development feature. It stores detailed usage information (`usageDetail`), the status of the project's budget (`projectUsageStatus`), and loading states for managing that budget.

### 43. `webdevAuth`

*   **Slice Type**: Regular
*   **Purpose**: This slice is intended to hold authentication information for the web development environment. However, in the provided state, it is **completely empty**, suggesting it might be a placeholder for a future feature or is only populated in a different context.

### 44. `websocket`

*   **Slice Type**: Regular
*   **Purpose**: This is another critical, core slice that manages the real-time connection to the server via WebSocket. It uses **RTK EntityAdapter** to store a normalized list of all incoming events (`ids`, `entities`), which includes every chat message, agent thought process, tool call, and status update. It also tracks the connection status (`status`) and whether the agent's task is finished (`taskFinished`). It is the firehose of all real-time data that drives the interactive experience.
