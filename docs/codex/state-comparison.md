# State Comparison (Manus vs Rubic)

This comparison uses:

- Manus reference: `state.json` → `preloadedState` (stringified JSON)
- Rubic runtime reference: `makeStore().getState()` captured via esbuild runtime dump
- Deep key paths are dot-notation; arrays use `[]` for element paths

**Slice Coverage Summary**
- Manus slices: 41
- Rubic runtime slices: 19
- Common: 10

**Slices Missing in Rubic (present in Manus)**
- `_persist`
- `agentWorkspace`
- `aiCanvas`
- `aiCanvasEditor`
- `biz`
- `codeViewer`
- `community`
- `example`
- `experiment`
- `fileConnector`
- `filePreviewer`
- `fileShare`
- `guestPage`
- `knowledge`
- `library`
- `login`
- `mailManus`
- `mapReduce`
- `myBrowser`
- `navbar`
- `notification`
- `onboarding`
- `products`
- `project`
- `scheduledTask`
- `sessionSwitch`
- `slideEditor`
- `timeline`
- `webDev`
- `webDevUsage`
- `webdevAuth`

**Slices Extra in Rubic (not present in Manus)**
- `agents`
- `billing`
- `chatPage`
- `devices`
- `files`
- `notifications`
- `projects`
- `scheduledTasks`
- `search`

**Naming Mismatches (Rubic ↔ Manus)**
- Rubic `notifications` ↔ Manus `notification`
- Rubic `scheduledTasks` ↔ Manus `scheduledTask`
- Rubic `projects` ↔ Manus `project`

**Common Slice Deep Diffs (Runtime)**
- `api`
  Manus paths: 14
  Rubic paths: 16
  Extra in Rubic:
  - `provided.keys`
  - `provided.tags`
- `auth`
  Manus paths: 106
  Rubic paths: 23
  Missing in Rubic:
  - `authLoading`
  - `avatarUploading`
  - `clientConfig.$typeName`
  - `clientConfig.agentMode`
  - `clientConfig.autoAgentDeploySpace`
  - `clientConfig.autoWideResearch`
  - `clientConfig.cookieOptIn`
  - `clientConfig.enableManusBrowser`
  - `clientConfig.hasInterest`
  - `clientConfig.hasShownEduTeamJoinPopup`
  - `clientConfig.lastUpdateLogTime`
  - `clientConfig.recvMarketingEmail`
  - `clientConfig.sessionWaitDoneEmail`
  - `cookieOptIn`
  - `creditAnimateInfo`
  - `invitationCodeRedDotVisible`
  - `modifying`
  - `profileCardVisible`
  - `refreshKey`
  - `shareHistoryCache`
  - `usageInfo`
  - `usageInfo.$typeName`
  - `usageInfo.addonCredits`
  - `usageInfo.consumeStatus`
  - `usageInfo.cooldownStatus`
  - `usageInfo.eventCredits`
  - `usageInfo.freeCredits`
  - `usageInfo.maxRefreshCredits`
  - `usageInfo.nanoBananaTrial`
  - `usageInfo.nextRefreshTime`
  - `usageInfo.nextRefreshTime.$typeName`
  - `usageInfo.nextRefreshTime.nanos`
  - `usageInfo.nextRefreshTime.seconds`
  - `usageInfo.periodicCredits`
  - `usageInfo.proMonthlyCredits`
  - `usageInfo.qualityTrial`
  - `usageInfo.refreshCredits`
  - `usageInfo.refreshInterval`
  - `usageInfo.totalCredits`
  - `usageInfo.userFlag`
  - `usageInfo.userFlag.$typeName`
  - `usageInfo.userFlag.drc16`
  - `userInfo`
  - `userInfo.$typeName`
  - `userInfo.area`
  - `userInfo.avatar`
  - `userInfo.canReceiveExtraCreditsForSubscribe`
  - `userInfo.canReceiveExtraCreditsForUpgrade`
  - `userInfo.cancelAtPeriodEnd`
  - `userInfo.concurrentScheduleTaskLimit`
  - `userInfo.concurrentSessions`
  - `userInfo.currentPeriodEnd`
  - `userInfo.displayname`
  - `userInfo.email`
  - `userInfo.fileUploadQuota`
  - `userInfo.fileUploadQuota.$typeName`
  - `userInfo.fileUploadQuota.isLimited`
  - `userInfo.fileUploadQuota.maxCount`
  - `userInfo.fileUploadQuota.oneEventMaxFileCount`
  - `userInfo.fileUploadQuota.usedCount`
  - `userInfo.firstname`
  - `userInfo.inWaitlist`
  - `userInfo.isAlpha`
  - `userInfo.isBeta`
  - `userInfo.isMembershipTrial`
  - `userInfo.lastname`
  - `userInfo.membershipInterval`
  - `userInfo.membershipTier`
  - `userInfo.membershipVersion`
  - `userInfo.nextMembershipInterval`
  - `userInfo.nextMembershipTier`
  - `userInfo.nextMembershipVersion`
  - `userInfo.nickname`
  - `userInfo.onboardingStepStatus`
  - `userInfo.paymentPlatform`
  - `userInfo.perks`
  - `userInfo.platformList`
  - `userInfo.platformList[]`
  - `userInfo.registeredAt`
  - `userInfo.registeredAt.$typeName`
  - `userInfo.registeredAt.nanos`
  - `userInfo.registeredAt.seconds`
  - `userInfo.smsVerified`
  - `userInfo.subscriptionStatus`
  - `userInfo.teamInfo`
  - `userInfo.teamInfo.$typeName`
  - `userInfo.teamInfo.count`
  - `userInfo.teamInfo.originalUserId`
  - `userInfo.teamInfo.originalUserUid`
  - `userInfo.trialAvailable`
  - `userInfo.uid`
  - `userInfo.userId`
  - `userInfo.userType`
  - `userRegion`
  - `userRegion.$typeName`
  - `userRegion.code`
  - `userRegion.highValueForTeam`
  - `userRegion.isUnsupported`
  - `userRegion.isUnsupportedV2`
  - `userRegion.iso`
  - `userRegion.needCookieOptIn`
  Extra in Rubic:
  - `accessToken`
  - `error`
  - `isAuthenticated`
  - `isLoading`
  - `loginStep`
  - `mfaMethod`
  - `mfaRequired`
  - `oauthLoading`
  - `oauthProvider`
  - `passwordResetEmail`
  - `passwordResetRequested`
  - `pendingEmail`
  - `pendingInvitation`
  - `refreshToken`
  - `registrationStep`
  - `tokenExpiresAt`
  - `user`
  - `verificationCodeSent`
- `chat`
  Manus paths: 33
  Rubic paths: 37
  Missing in Rubic:
  - `debugModelOverride`
  - `debugModelOverride.config`
  - `debugModelOverride.configText`
  - `debugModelOverride.enabled`
  - `recommendedPlaybooksV2`
  - `recommendedPlaybooksV2.currentPage`
  - `recommendedPlaybooksV2.loading`
  - `recommendedPlaybooksV2.playbooks`
  - `recommendedPlaybooksV2.total`
  Extra in Rubic:
  - `currentStreamingMessageId`
  - `currentStreamingSessionId`
  - `error`
  - `imageStyleList[]`
  - `isLoading`
  - `isStreaming`
  - `isTyping`
  - `messages`
  - `playbookInfo`
  - `recommendedPlaybooks[]`
  - `slideTemplateList[]`
  - `typingUsers`
  - `typingUsers[]`
- `configs`
  Manus paths: 12
  Rubic paths: 22
  Missing in Rubic:
  - `agentWorkspaceAutoExpanded`
  - `automaticallyLearnKnowledge`
  - `chatSidebarMode`
  - `clientId`
  - `disableContextExpensiveErrorSessions`
  - `disableContextExpensiveErrorSessions[]`
  - `firstClickWorkflowEmailAddButton`
  - `gotoComputerTipsShowed`
  - `mailManusCardShowed`
  - `sessionListPinned`
  - `theme`
  Extra in Rubic:
  - `agentEmailInfo`
  - `clientConfig`
  - `emailWhiteList`
  - `emailWhiteList[]`
  - `error`
  - `features`
  - `features.aiCanvasEnabled`
  - `features.connectorLimit`
  - `features.freeMapReduceCount`
  - `features.mapReduceEnabled`
  - `features.scheduledTasksEnabled`
  - `features.slideEditorEnabled`
  - `features.storageLimit`
  - `features.teamEnabled`
  - `features.webDevEnabled`
  - `invitationCodes`
  - `invitationCodes[]`
  - `isInitialized`
  - `isLoading`
  - `isUpdating`
  - `paymentInfo`
- `connectors`
  Manus paths: 10
  Rubic paths: 18
  Missing in Rubic:
  - `connectors`
  - `connectors[]`
  - `githubRepositories`
  - `githubRepositoriesLoading`
  - `githubRepositories[]`
  - `multipleCalendarConfirmedInfo`
  - `multipleEmailConfirmedInfo`
  - `temporaryEnabledOverrides`
  - `temporaryGithubRepositories`
  Extra in Rubic:
  - `availableConnectors`
  - `availableConnectors[]`
  - `categories`
  - `categories[]`
  - `connectionFlow`
  - `connectionFlow.connectorId`
  - `connectionFlow.error`
  - `connectionFlow.isOpen`
  - `connectionFlow.step`
  - `error`
  - `installedConnectors`
  - `installedConnectors[]`
  - `isInstalling`
  - `isLoadingAvailable`
  - `isLoadingInstalled`
  - `selectedCategory`
  - `selectedConnectorId`
- `fileManagement`
  Manus paths: 16
  Rubic paths: 21
  Extra in Rubic:
  - `currentSpaceId`
  - `error`
  - `isUploading`
  - `uploadQueue`
  - `uploadQueue[]`
- `sessions`
  Manus paths: 41
  Rubic paths: 34
  Missing in Rubic:
  - `allCollaborators.entities`
  - `allCollaborators.ids`
  - `allCollaborators.ids[]`
  - `groupedSessionState`
  - `groupedSessionState.all`
  - `groupedSessionState.all.ids`
  - `groupedSessionState.all.ids[]`
  - `groupedSessionState.all.initialized`
  - `groupedSessionState.all.loading`
  - `groupedSessionState.all.total`
  - `groupedSessionState.favorites`
  - `groupedSessionState.favorites.ids`
  - `groupedSessionState.favorites.ids[]`
  - `groupedSessionState.favorites.initialized`
  - `groupedSessionState.favorites.loading`
  - `groupedSessionState.favorites.total`
  - `groupedSessionState.scheduled`
  - `groupedSessionState.scheduled.ids`
  - `groupedSessionState.scheduled.ids[]`
  - `groupedSessionState.scheduled.initialized`
  - `groupedSessionState.scheduled.loading`
  - `groupedSessionState.scheduled.total`
  - `searchValue`
  - `segmentEndpoints[]`
  - `sessions.entities`
  - `sessions.ids`
  - `sessions.ids[]`
  Extra in Rubic:
  - `allCollaborators[]`
  - `cursor`
  - `error`
  - `filterMode`
  - `filterStatus`
  - `groups`
  - `groups[]`
  - `hasMore`
  - `isLoading`
  - `recentSessionIds`
  - `recentSessionIds[]`
  - `scheduledTaskSessions[]`
  - `searchQuery`
  - `selectedSessionIds`
  - `selectedSessionIds[]`
  - `sessions[]`
  - `showArchived`
  - `sortBy`
  - `sortOrder`
  - `totalCount`
- `team`
  Manus paths: 28
  Rubic paths: 23
  Missing in Rubic:
  - `initTeamLoading`
  - `listTeamResponse.$typeName`
  - `listTeamResponse.teams`
  - `listTeamResponse.teams[]`
  - `listTeamResponse.totalCount`
  - `listTeamResponse.userAvatar`
  - `listTeamResponse.userId`
  - `listTeamResponse.userName`
  - `ssoInfo.connection`
  - `ssoInfo.domains`
  - `ssoInfo.domains[]`
  - `ssoInfo.enabled`
  - `ssoInfo.expired`
  - `ssoInfo.howMemberCanLogin`
  - `ssoInfo.memberAddPolicy`
  - `ssoInfo.ssoId`
  - `ssoInfoLoading`
  - `teamListLoading`
  - `teamMemberList`
  - `teamMemberList[]`
  - `teamRenewalSettings`
  - `teamRenewalSettingsLoading`
  Extra in Rubic:
  - `accessControls[]`
  - `currentTeamId`
  - `error`
  - `invitations`
  - `invitations[]`
  - `isInviting`
  - `isLoadingInvitations`
  - `isLoadingMembers`
  - `isLoadingSSO`
  - `isLoadingTeams`
  - `members`
  - `members[]`
  - `renewalSettings`
  - `scimUnmanagedAccounts`
  - `scimUnmanagedAccounts[]`
  - `teams`
  - `teams[]`
- `ui`
  Manus paths: 6
  Rubic paths: 11
  Missing in Rubic:
  - `chatSidebarPercentage`
  - `isShowMaxModeIntroduce`
  - `navTasksFolded`
  - `showAppDownloadMask`
  - `windowWidth`
  Extra in Rubic:
  - `breadcrumbs`
  - `breadcrumbs[]`
  - `isCommandPaletteOpen`
  - `isSearchOpen`
  - `modals`
  - `modals[]`
  - `sidebarState`
  - `theme`
  - `toasts`
  - `toasts[]`
- `websocket`
  Manus paths: 9
  Rubic paths: 15
  Extra in Rubic:
  - `lastConnectedAt`
  - `lastPongTime`
  - `reconnectAttempts`
  - `rooms`
  - `rooms[]`
  - `socketId`

**Mapped Slice Deep Diffs (Runtime)**
- `notifications` (Manus `notification`)
  Manus paths: 22
  Rubic paths: 62
  Missing in Rubic:
  - `hasNew`
  - `isNotificationListVisible`
  - `updatePageHasMore`
  - `updatePageHasNew`
  - `updatePageLoading`
  - `updatePageNotificationList`
  - `updatePageNotificationList[]`
  Extra in Rubic:
  - `cursor`
  - `error`
  - `filter`
  - `filter.showArchived`
  - `filter.showRead`
  - `filter.type`
  - `hasMore`
  - `hasNewNotifications`
  - `isLoading`
  - `isLoadingMore`
  - `isUpdatingPreferences`
  - `lastFetchedAt`
  - `notifications`
  - `notifications[]`
  - `preferences`
  - `preferences.desktopEnabled`
  - `preferences.emailDigest`
  - `preferences.emailEnabled`
  - `preferences.emailTaskComplete`
  - `preferences.emailTaskFailed`
  - `preferences.pushAgentUpdate`
  - `preferences.pushEnabled`
  - `preferences.pushScheduledTask`
  - `preferences.pushTaskComplete`
  - `preferences.pushTaskFailed`
  - `preferences.pushTeamInvite`
  - `preferences.quietHoursEnabled`
  - `preferences.soundEnabled`
  - `unreadByType`
  - `unreadByType.agent`
  - `unreadByType.agent_update`
  - `unreadByType.billing`
  - `unreadByType.comment`
  - `unreadByType.connector`
  - `unreadByType.connector_sync`
  - `unreadByType.mention`
  - `unreadByType.scheduled_task`
  - `unreadByType.session`
  - `unreadByType.session_update`
  - `unreadByType.share`
  - `unreadByType.system`
  - `unreadByType.task`
  - `unreadByType.task_complete`
  - `unreadByType.task_failed`
  - `unreadByType.team`
  - `unreadByType.team_invite`
  - `unreadCount`
- `scheduledTasks` (Manus `scheduledTask`)
  Manus paths: 4
  Rubic paths: 11
  Missing in Rubic:
  - `allScheduleList`
  - `allScheduleList[]`
  Extra in Rubic:
  - `editingTask`
  - `error`
  - `executions`
  - `isCreating`
  - `isLoading`
  - `isLoadingExecutions`
  - `selectedTaskId`
  - `tasks`
  - `tasks[]`
- `projects` (Manus `project`)
  Manus paths: 6
  Rubic paths: 17
  Missing in Rubic:
  - `currentProjectSessionLoading`
  - `initProjectLoading`
  - `projectList`
  - `projectList[]`
  Extra in Rubic:
  - `currentProject`
  - `editingProject`
  - `error`
  - `filterStatus`
  - `filterType`
  - `isCreating`
  - `isLoading`
  - `isLoadingSessions`
  - `projectSessions`
  - `projects`
  - `projects[]`
  - `searchQuery`
  - `sortBy`
  - `sortOrder`
  - `viewMode`

**Reducer Actions (Rubic)**
This is a best-effort extraction of action names from `reducers: {}` blocks.
- `agents` actions (1): `setAgents`
- `auth` actions (1): `setUser`
- `billing` actions (1): `setCreditPackages`
- `chat` actions (1): `setMessages`
- `chatPage` actions (1): `setDagExpanded`
- `configs` actions (2): `initializeConfigs`, `action`
- `connectors` actions (1): `setAvailableConnectors`
- `devices` actions (1): `setDevices`
- `fileManagement` actions (1): `setSpaces`
- `files` actions (1): `setFiles`
- `notifications` actions (5): `setNotifications`, `action`, `notifications`, `hasMore`, `cursor`
- `projects` actions (1): `setProjects`
- `scheduledTasks` actions (1): `setScheduledTasks`
- `search` actions (1): `openSearch`
- `sessions` actions (3): `setSessions`, `action`, `sessions`
- `team` actions (1): `setTeams`
- `ui` actions (1): `setTheme`
- `websocket` actions (1): `setConnectionStatus`
