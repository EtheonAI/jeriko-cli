# COMPLETE REDUX STATE ANALYSIS
================================================================================

## UI SLICE
--------------------------------------------------------------------------------
**Keys (6):**
  - `chatSidebarPercentage`: NoneType = null
  - `isMobile`: bool = false
  - `isShowMaxModeIntroduce`: bool = false
  - `navTasksFolded`: bool = true
  - `showAppDownloadMask`: bool = false
  - `windowWidth`: int = 1792


## CHAT SLICE
--------------------------------------------------------------------------------
**Keys (24):**
  - `agentModeIntroduceScene`: NoneType = null
  - `chatExtData`: NoneType = null
  - `dataVisualization`: NoneType = null
  - `debugModelOverride`: dict = {"enabled": false, "config": null, "configText": ""}
  - `fileSuggestions`: list = []
  - `files`: list = []
  - `imageStyleList`: NoneType = null
  - `imageStyleListLoading`: bool = false
  - `inputMode`: str = "text"
  - `inputPlaybookId`: NoneType = null
  - `inputPlaybookTemplate`: NoneType = null
  - `inputValue`: str = ""
  - `isAppBannerVisible`: bool = false
  - `isPageVisible`: bool = true
  - `microphonePermission`: str = "prompt"
  - `pinnedSlideTemplateId`: NoneType = null
  - `recommendedPlaybooks`: NoneType = null
  - `recommendedPlaybooksLoading`: bool = false
  - `recommendedPlaybooksV2`: dict = {"playbooks": null, "loading": false, "total": 0, "currentPage": 0}
  - `sendQuestionBehavior`: NoneType = null
  - `showSharePopover`: NoneType = null
  - `slideTemplateList`: NoneType = null
  - `slideTemplateListLoading`: bool = false
  - `taskMode`: str = "standard"


## TIMELINE SLICE
--------------------------------------------------------------------------------
**Keys (3):**
  - `percentage`: int = 100
  - `segmentEventsLoadingMap`: dict = {}
  - `segmentEventsMap`: dict = {}


## SESSIONS SLICE
--------------------------------------------------------------------------------
**Keys (16):**
  - `allCollaborators`: dict = {"ids": [], "entities": {}}
  - `currentSessionId`: NoneType = null
  - `groupedSessionState`: dict (complex)
  - `isSearchMode`: bool = false
  - `isShareFileMode`: bool = false
  - `isShareMode`: bool = false
  - `loadBottomSegmentsLoading`: bool = false
  - `loadSessionDetailLoading`: bool = true
  - `loadSessionLoading`: bool = false
  - `loadTopSegmentsLoading`: bool = false
  - `scheduledTaskSessions`: NoneType = null
  - `searchValue`: str = ""
  - `segmentEndpoints`: list = []
  - `sessions`: dict = {"ids": [], "entities": {}}
  - `sharingSessionUid`: NoneType = null
  - `swapSessionDetailMap`: dict = {}


## AICANVAS SLICE
--------------------------------------------------------------------------------
**Keys (2):**
  - `allAiCanvas`: dict = {}
  - `ocrCache`: dict = {}


## AICANVASEDITOR SLICE
--------------------------------------------------------------------------------
**Keys (17):**
  - `altDragCloneIds`: list = []
  - `brushing`: dict = {"isBrushing": false, "startPoint": null, "currentPoint": null}
  - `camera`: dict = {"x": 0, "y": 0, "z": 0.24}
  - `commentHistory`: dict = {"past": [], "future": []}
  - `commentPopup`: dict = {"commentId": "", "isOpen": false}
  - `contextMenu`: dict = {"position": null, "target": null}
  - `editTextMode`: dict (complex)
  - `guides`: list = []
  - `hoveredShapeId`: NoneType = null
  - `interaction`: dict (complex)
  - `isAltPressed`: bool = false
  - `marking`: dict = {"isMarking": false, "startPoint": null, "currentPoint": null, "imageShapeId": null}
  - `previewSelectedId`: NoneType = null
  - `screenshots`: dict = {"markScreenshots": {}, "markedImages": {}}
  - `selectedShapeIds`: list = []
  - `settings`: dict = {"useScrollWheelZoom": false, "rightClickDragToPan": false, "gridState": false}
  - `shapes`: dict = {}


## NOTIFICATION SLICE
--------------------------------------------------------------------------------
**Keys (12):**
  - `categoryHasMore`: dict = {"0": true, "1": true, "2": true}
  - `categoryNotifications`: dict = {"0": [], "1": [], "2": []}
  - `connectError`: NoneType = null
  - `connectStatus`: str = "default"
  - `fetchNotificationLoading`: bool = false
  - `hasNew`: bool = false
  - `isNotificationListVisible`: bool = false
  - `notificationTab`: int = 0
  - `updatePageHasMore`: bool = false
  - `updatePageHasNew`: bool = false
  - `updatePageLoading`: bool = true
  - `updatePageNotificationList`: list = []


## WEBDEV SLICE
--------------------------------------------------------------------------------
**Keys (31):**
  - `activeTab`: str = "preview"
  - `cachedInviteUsers`: list = []
  - `currentAppBuildingProgress`: dict = {}
  - `currentProjectInviteUsers`: list = []
  - `database`: dict (complex)
  - `editMobileAppVersionDialogOpen`: bool = false
  - `editMode`: bool = false
  - `fullStyleSelections`: list = []
  - `gitRepoCreation`: dict = {"status": "idle"}
  - `gitSyncStatus`: dict = {"status": null, "isLoading": false}
  - `initPreviewPath`: str = ""
  - `initServerProjectLoading`: bool = false
  - `isFullscreenMode`: bool = false
  - `lastFeatureConfirm`: dict = {"features": []}
  - `mobilePreviewOnPhoneHidden`: bool = false
  - `mountedTabs`: dict (complex)
  - `preview`: dict = {"isHistoricalVersion": false}
  - `previewOldVersion`: NoneType = null
  - `previewOldVersionLoading`: bool = false
  - `previewerBadgeClosedList`: list = []
  - `project`: NoneType = null
  - `projectInited`: bool = false
  - `publishButtonLoading`: bool = false
  - `publishPopoverVisible`: bool = false
  - `setting`: dict (complex)
  - `settingSubTab`: NoneType = null
  - `storage`: dict (complex)
  - `updateCurrentAabVersion`: NoneType = null
  - `updateCurrentApkVersion`: NoneType = null
  - `userClickedTab`: NoneType = null
  - `webview`: dict (complex)


## CODEVIEWER SLICE
--------------------------------------------------------------------------------
**Keys (9):**
  - `activeTabId`: NoneType = null
  - `directoryList`: list = []
  - `directoryMetaData`: dict = {"client/": {"expanded": true}, "client/src/": {"expanded": true}}
  - `fileDataSource`: dict = {}
  - `fileLoadingMap`: dict = {}
  - `fileTabList`: list = []
  - `loadDirectoryLoading`: bool = true
  - `rootDirectory`: NoneType = null
  - `userClickedFileTab`: bool = false


## MAPREDUCE SLICE
--------------------------------------------------------------------------------
**Keys (2):**
  - `isFullscreen`: bool = false
  - `startLoading`: bool = false


## CONNECTORS SLICE
--------------------------------------------------------------------------------
**Keys (8):**
  - `connectors`: list = []
  - `githubRepositories`: list = []
  - `githubRepositoriesLoading`: bool = false
  - `multipleCalendarConfirmedInfo`: dict = {}
  - `multipleEmailConfirmedInfo`: dict = {}
  - `searchQuery`: str = ""
  - `temporaryEnabledOverrides`: dict = {}
  - `temporaryGithubRepositories`: dict = {}

