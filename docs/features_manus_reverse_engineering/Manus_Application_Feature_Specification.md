# Manus Application Feature Specification

**Comprehensive UI/UX Documentation for AI Agent Platform Development**

**Version:** 1.0  
**Author:** Manus AI  
**Date:** February 5, 2026

---

## Executive Summary

This document provides a complete feature specification for building an AI agent platform similar to Manus, with enhanced capabilities including Google Drive-style folder management, Composio application integrations, and Home Assistant smart device control. The specification covers every page, component, button, action, and state across the entire application, serving as a definitive reference for frontend and backend development teams.

---

## Table of Contents

1. [Authentication Module](#1-authentication-module)
2. [Dashboard & Navigation](#2-dashboard--navigation)
3. [Library (File Management)](#3-library-file-management)
4. [Chat Interface](#4-chat-interface)
5. [Settings Module](#5-settings-module)
6. [Billing & Usage](#6-billing--usage)
7. [Applications (Composio)](#7-applications-composio)
8. [Devices (Home Assistant)](#8-devices-home-assistant)
9. [Global Components](#9-global-components)
10. [State Management](#10-state-management)

---

## 1. Authentication Module

### 1.1 Login/Signup Page

**Route:** `/auth/login` | `/auth/signup`

| Component | Element                   | Type           | Properties                              |
| --------- | ------------------------- | -------------- | --------------------------------------- |
| Header    | Logo                      | Image/Link     | Navigates to homepage                   |
| Header    | Theme Toggle              | Icon Button    | Light/Dark/System modes                 |
| Form      | Email Input               | Text Field     | Required, email validation              |
| Form      | Password Input            | Password Field | Required, min 8 chars, show/hide toggle |
| Form      | Full Name (signup)        | Text Field     | Required for signup, 2-50 chars         |
| Form      | Confirm Password (signup) | Password Field | Must match password                     |
| Form      | Remember Me               | Checkbox       | Persist session                         |
| Actions   | Submit Button             | Primary Button | Login/Create Account                    |
| Actions   | Forgot Password           | Text Link      | Navigate to reset flow                  |
| OAuth     | Google Sign-in            | OAuth Button   | Redirect to Google OAuth                |
| OAuth     | GitHub Sign-in            | OAuth Button   | Redirect to GitHub OAuth                |
| OAuth     | Microsoft Sign-in         | OAuth Button   | Redirect to Microsoft OAuth             |
| Footer    | Terms Link                | Text Link      | Navigate to terms page                  |
| Footer    | Privacy Link              | Text Link      | Navigate to privacy page                |

**States:**

| State      | Trigger       | UI Behavior                         |
| ---------- | ------------- | ----------------------------------- |
| Default    | Page load     | Empty form, buttons enabled         |
| Validating | Field blur    | Show validation messages            |
| Loading    | Form submit   | Spinner on button, form disabled    |
| Error      | API error     | Toast notification, form re-enabled |
| Success    | Auth complete | Redirect to dashboard               |

**API Endpoints:**

| Endpoint                     | Method | Payload                   | Response        |
| ---------------------------- | ------ | ------------------------- | --------------- |
| `/api/auth/login`            | POST   | `{email, password}`       | `{token, user}` |
| `/api/auth/register`         | POST   | `{name, email, password}` | `{token, user}` |
| `/api/auth/oauth/{provider}` | GET    | -                         | Redirect URL    |

---

### 1.2 Forgot Password Page

**Route:** `/auth/forgot-password`

| Component | Element         | Type           | Properties                 |
| --------- | --------------- | -------------- | -------------------------- |
| Header    | Back Button     | Icon Button    | Navigate to login          |
| Content   | Title           | Heading        | "Reset your password"      |
| Content   | Description     | Text           | Instructions for reset     |
| Form      | Email Input     | Text Field     | Required, email validation |
| Actions   | Send Reset Link | Primary Button | Submit reset request       |
| Actions   | Back to Login   | Text Link      | Navigate to login          |

**States:**

| State   | Trigger       | UI Behavior                          |
| ------- | ------------- | ------------------------------------ |
| Default | Page load     | Empty email field                    |
| Loading | Form submit   | Spinner, form disabled               |
| Success | Email sent    | Success message, countdown to resend |
| Error   | Invalid email | Error message displayed              |

---

### 1.3 Reset Password Page

**Route:** `/auth/reset-password?token={token}`

| Component | Element           | Type           | Properties                 |
| --------- | ----------------- | -------------- | -------------------------- |
| Form      | New Password      | Password Field | Required, complexity rules |
| Form      | Confirm Password  | Password Field | Must match new password    |
| Form      | Password Strength | Progress Bar   | Visual strength indicator  |
| Actions   | Reset Password    | Primary Button | Submit new password        |

**States:**

| State         | Trigger           | UI Behavior                     |
| ------------- | ----------------- | ------------------------------- |
| Valid Token   | Token verified    | Form displayed                  |
| Invalid Token | Token check fails | Error message, request new link |
| Expired Token | Token expired     | Error message, request new link |
| Success       | Password reset    | Redirect to login with success  |

---

### 1.4 Invitation Page

**Route:** `/invite/{code}` | `/auth/invite?code={code}`

| Component | Element             | Type             | Properties                  |
| --------- | ------------------- | ---------------- | --------------------------- |
| Info      | Inviter Avatar      | Image            | Inviter profile picture     |
| Info      | Inviter Name        | Text             | Who sent invitation         |
| Info      | Team Name           | Text             | Team/workspace name         |
| Info      | Message             | Text             | Optional invitation message |
| Form      | Name (new user)     | Text Field       | Required if new user        |
| Form      | Password (new user) | Password Field   | Required if new user        |
| Actions   | Accept              | Primary Button   | Join team                   |
| Actions   | Decline             | Secondary Button | Reject invitation           |
| Actions   | Sign In             | Text Link        | For existing users          |

---

## 2. Dashboard & Navigation

### 2.1 Side Navigation (Expanded)

**Component:** Persistent sidebar, collapsible

| Section      | Element          | Icon        | Action                      | Badge        |
| ------------ | ---------------- | ----------- | --------------------------- | ------------ |
| Top          | Logo             | Manus icon  | Navigate to dashboard       | -            |
| Top          | Collapse Toggle  | Chevron     | Collapse sidebar            | -            |
| Main         | Dashboard        | Home        | Navigate to `/dashboard`    | -            |
| Main         | Library          | Folder      | Navigate to `/library`      | File count   |
| Main         | New Chat         | Plus        | Navigate to `/chat/new`     | -            |
| Main         | Applications     | Grid        | Navigate to `/applications` | -            |
| Main         | Devices          | CPU         | Navigate to `/devices`      | Device count |
| Chat History | Today            | -           | Expandable section          | -            |
| Chat History | Yesterday        | -           | Expandable section          | -            |
| Chat History | Previous 7 Days  | -           | Expandable section          | -            |
| Chat History | Previous 30 Days | -           | Expandable section          | -            |
| Chat History | Older            | Archive     | View all chats              | -            |
| Bottom       | User Avatar      | Profile pic | Open profile dropdown       | -            |
| Bottom       | Username         | -           | Display only                | -            |
| Bottom       | Credits          | Coins       | Show credits balance        | Amount       |
| Bottom       | Settings         | Gear        | Navigate to `/settings`     | -            |

**Chat Item Actions (on hover):**

| Action  | Icon    | Behavior                    |
| ------- | ------- | --------------------------- |
| Rename  | Pencil  | Inline edit mode            |
| Pin     | Pin     | Pin to top of list          |
| Archive | Archive | Move to archive             |
| Delete  | Trash   | Confirm dialog, then delete |

---

### 2.2 Side Navigation (Collapsed)

**Component:** Icon-only sidebar with tooltips

| Element      | Icon    | Tooltip        | Action                      |
| ------------ | ------- | -------------- | --------------------------- |
| Logo         | Manus   | "Manus"        | Navigate to dashboard       |
| Expand       | Chevron | "Expand"       | Expand sidebar              |
| Dashboard    | Home    | "Dashboard"    | Navigate to `/dashboard`    |
| Library      | Folder  | "Library"      | Navigate to `/library`      |
| New Chat     | Plus    | "New Chat"     | Navigate to `/chat/new`     |
| Applications | Grid    | "Applications" | Navigate to `/applications` |
| Devices      | CPU     | "Devices"      | Navigate to `/devices`      |
| Settings     | Gear    | "Settings"     | Navigate to `/settings`     |
| User         | Avatar  | Username       | Open profile dropdown       |

---

### 2.3 Profile Dropdown

**Trigger:** Click on user avatar

| Section       | Element        | Icon        | Action                          |
| ------------- | -------------- | ----------- | ------------------------------- |
| User Info     | Avatar         | -           | Display only                    |
| User Info     | Full Name      | -           | Display only                    |
| User Info     | Email          | -           | Display only                    |
| User Info     | Plan Badge     | -           | Current subscription tier       |
| Quick Actions | View Profile   | User        | Navigate to `/settings/profile` |
| Quick Actions | Account        | Settings    | Navigate to `/settings/account` |
| Quick Actions | Billing        | Credit Card | Navigate to `/settings/billing` |
| Quick Actions | Usage          | Chart       | Navigate to `/settings/usage`   |
| Theme         | Light Mode     | Sun         | Set light theme                 |
| Theme         | Dark Mode      | Moon        | Set dark theme                  |
| Theme         | System         | Monitor     | Follow system preference        |
| Session       | Switch Account | Switch      | Show account switcher           |
| Session       | Sign Out       | Logout      | Clear session, redirect         |

---

### 2.4 Global Search Modal

**Trigger:** Click search icon or `Cmd/Ctrl + K`

| Component | Element         | Type        | Properties                                      |
| --------- | --------------- | ----------- | ----------------------------------------------- |
| Header    | Search Input    | Text Field  | Placeholder: "Search chats, files, settings..." |
| Header    | Clear Button    | Icon Button | Clear search query                              |
| Header    | Close Button    | Icon Button | Close modal (also Esc)                          |
| Filters   | Type Filter     | Chip Group  | All, Chats, Files, Settings                     |
| Filters   | Date Filter     | Dropdown    | Any time, Today, This week, This month          |
| Results   | Recent Searches | List        | Previously searched queries                     |
| Results   | Chats           | List        | Matching chat titles                            |
| Results   | Files           | List        | Matching file names                             |
| Results   | Settings        | List        | Matching settings pages                         |
| Footer    | Shortcuts       | Text        | ↑↓ Navigate, Enter Select, Esc Close            |

**Keyboard Navigation:**

| Key   | Action                    |
| ----- | ------------------------- |
| ↑ / ↓ | Navigate through results  |
| Enter | Select highlighted result |
| Esc   | Close modal               |
| Tab   | Cycle through filters     |

---

### 2.5 Notifications Panel

**Trigger:** Click bell icon in header

| Component    | Element          | Type        | Properties                        |
| ------------ | ---------------- | ----------- | --------------------------------- |
| Header       | Title            | Text        | "Notifications"                   |
| Header       | Mark All Read    | Text Button | Mark all as read                  |
| Header       | Settings         | Icon Button | Navigate to notification settings |
| Tabs         | All              | Tab         | All notifications                 |
| Tabs         | Unread           | Tab         | Only unread                       |
| Tabs         | Tasks            | Tab         | Task-related                      |
| Tabs         | System           | Tab         | System announcements              |
| Item         | Icon             | Icon        | Type indicator                    |
| Item         | Title            | Text        | Notification headline             |
| Item         | Description      | Text        | Detailed message                  |
| Item         | Timestamp        | Text        | Relative time                     |
| Item         | Unread Indicator | Dot         | Blue dot for unread               |
| Item Actions | Mark Read        | Icon Button | Mark as read                      |
| Item Actions | Delete           | Icon Button | Remove notification               |
| Empty State  | Illustration     | Image       | No notifications image            |
| Empty State  | Message          | Text        | "You're all caught up!"           |

---

## 3. Library (File Management)

### 3.1 Page Header

**Route:** `/library`

| Component | Element     | Type              | Properties          |
| --------- | ----------- | ----------------- | ------------------- |
| Title     | Page Title  | Heading           | "Library"           |
| Title     | File Count  | Badge             | Total files count   |
| Actions   | Upload      | Primary Button    | Open upload modal   |
| Actions   | New Folder  | Secondary Button  | Create folder modal |
| Actions   | Sort        | Dropdown Button   | Sort options        |
| Actions   | View Toggle | Icon Button Group | Grid/List view      |

---

### 3.2 Filter System

**Primary Navigation (Left Sidebar or Tabs):**

| Filter         | Icon  | Description                      |
| -------------- | ----- | -------------------------------- |
| My Files       | User  | Files owned by current user      |
| Shared with Me | Share | Files shared by others           |
| Recent         | Clock | Recently accessed files          |
| Starred        | Star  | Favorited files                  |
| Trash          | Trash | Deleted files (30-day retention) |

**Type Filters:**

| Filter        | Icon     | File Types                |
| ------------- | -------- | ------------------------- |
| All           | Grid     | All file types            |
| Folders       | Folder   | Folders only              |
| Documents     | Document | PDF, Word, Markdown, Text |
| Spreadsheets  | Table    | Excel, CSV, Google Sheets |
| Presentations | Slides   | PPT, Google Slides        |
| Images        | Image    | PNG, JPG, SVG, GIF, WebP  |
| Videos        | Video    | MP4, WebM, MOV, AVI       |
| Audio         | Audio    | MP3, WAV, M4A, FLAC       |
| Archives      | Archive  | ZIP, RAR, TAR, 7Z         |
| Code          | Code     | JS, PY, HTML, CSS, JSON   |

**Advanced Filters:**

| Filter        | Type           | Options                                                   |
| ------------- | -------------- | --------------------------------------------------------- |
| Owner         | Dropdown       | Me, Anyone, Specific user                                 |
| Modified Date | Date Picker    | Today, Yesterday, Last 7 days, Last 30 days, Custom range |
| Created Date  | Date Picker    | Same options                                              |
| File Size     | Range Selector | Any, <1MB, 1-10MB, 10-100MB, >100MB                       |
| Location      | Folder Picker  | Any folder, Specific folder                               |

---

### 3.3 Search

| Component | Element         | Type        | Properties                     |
| --------- | --------------- | ----------- | ------------------------------ |
| Input     | Search Field    | Text Input  | Placeholder: "Search files..." |
| Input     | Search Icon     | Icon        | Visual indicator               |
| Input     | Clear Button    | Icon Button | Clear query                    |
| Advanced  | Advanced Search | Text Link   | Open advanced search modal     |

**Search Capabilities:**

| Search Type | Description                   |
| ----------- | ----------------------------- |
| File Name   | Search by file name           |
| Content     | Full-text search in documents |
| Tags        | Search by assigned tags       |
| Owner       | Search by file owner          |
| Date Range  | Search within date range      |

---

### 3.4 View Modes

**Grid View:**

| Element            | Description                            |
| ------------------ | -------------------------------------- |
| Thumbnail          | File preview image (200x150px)         |
| File Name          | Truncated with ellipsis (max 25 chars) |
| File Type Icon     | Small icon overlay (bottom-right)      |
| Selection Checkbox | Top-left corner                        |
| Star Icon          | Top-right corner (if starred)          |
| Quick Actions      | Hover to reveal (3-dot menu)           |

**List View:**

| Column   | Width | Sortable | Content            |
| -------- | ----- | -------- | ------------------ |
| Checkbox | 40px  | No       | Selection checkbox |
| Name     | Flex  | Yes      | Icon + File name   |
| Owner    | 150px | Yes      | Owner name/avatar  |
| Modified | 150px | Yes      | Last modified date |
| Size     | 100px | Yes      | File size          |
| Actions  | 50px  | No       | 3-dot menu         |

---

### 3.5 File Actions Menu

**Per-File Actions (3-dot menu):**

| Action           | Icon      | Description              | Shortcut |
| ---------------- | --------- | ------------------------ | -------- |
| Preview          | Eye       | Open file preview modal  | Space    |
| Open With        | App       | Choose application       | -        |
| Locate in Task   | Link      | Navigate to source task  | -        |
| Send to Manus    | Send      | Use file in new chat     | -        |
| Add to Starred   | Star      | Star/unstar file         | S        |
| Share            | Share     | Open sharing modal       | -        |
| Get Link         | Link      | Copy shareable link      | -        |
| Move to          | Folder    | Move to different folder | M        |
| Copy to          | Copy      | Copy to different folder | -        |
| Rename           | Pencil    | Rename file              | F2       |
| Make a Copy      | Duplicate | Create duplicate         | -        |
| Download         | Download  | Download file            | D        |
| Version History  | History   | View previous versions   | -        |
| File Information | Info      | View detailed metadata   | I        |
| Delete           | Trash     | Move to trash            | Del      |

**Download Sub-menu:**

| Format   | Description                 |
| -------- | --------------------------- |
| Original | Download in original format |
| Markdown | Convert to .md              |
| PDF      | Convert to .pdf             |
| Docs     | Convert to .docx            |

**Cloud Save Options:**

| Service                        | Icon     | Description                     |
| ------------------------------ | -------- | ------------------------------- |
| Convert to Google Docs         | Google   | Convert and open in Google Docs |
| Save to Google Drive           | Drive    | Save copy to Google Drive       |
| Save to OneDrive (Personal)    | OneDrive | Save to personal OneDrive       |
| Save to OneDrive (Work/School) | OneDrive | Save to work/school OneDrive    |
| Save to Dropbox                | Dropbox  | Save to Dropbox                 |

---

### 3.6 Folder System (Google Drive-style Enhancement)

**Folder Creation Modal:**

| Field         | Type         | Validation              |
| ------------- | ------------ | ----------------------- |
| Folder Name   | Text Input   | Required, max 255 chars |
| Parent Folder | Dropdown     | Optional, default root  |
| Color         | Color Picker | 12 preset colors        |
| Description   | Textarea     | Optional, max 500 chars |

**Folder Actions:**

| Action         | Icon     | Description          |
| -------------- | -------- | -------------------- |
| Open           | Click    | Navigate into folder |
| Rename         | Pencil   | Rename folder        |
| Change Color   | Palette  | Change folder color  |
| Share          | Share    | Share folder         |
| Move           | Folder   | Move folder          |
| Add to Starred | Star     | Star folder          |
| Download       | Download | Download as ZIP      |
| Delete         | Trash    | Move to trash        |

**Folder Navigation:**

| Element     | Description                                |
| ----------- | ------------------------------------------ |
| Breadcrumb  | Path navigation (Home > Projects > Design) |
| Back Button | Navigate to parent folder                  |
| Folder Tree | Sidebar folder hierarchy (collapsible)     |

---

### 3.7 Bulk Actions

**Selection Methods:**

| Method         | Description            |
| -------------- | ---------------------- |
| Click Checkbox | Select individual file |
| Shift+Click    | Select range of files  |
| Ctrl/Cmd+Click | Add to selection       |
| Select All     | Header checkbox        |

**Bulk Action Bar (appears when items selected):**

| Action          | Icon     | Description             |
| --------------- | -------- | ----------------------- |
| Move            | Folder   | Move selected to folder |
| Copy            | Copy     | Copy selected to folder |
| Download        | Download | Download as ZIP         |
| Share           | Share    | Share selected files    |
| Delete          | Trash    | Delete selected         |
| Add to Starred  | Star     | Star all selected       |
| Clear Selection | X        | Deselect all            |

**Selection Info Display:**

| Element | Description        |
| ------- | ------------------ |
| Count   | "X items selected" |
| Size    | "Total: X MB"      |

---

### 3.8 Sharing Modal

| Field        | Type           | Options                        |
| ------------ | -------------- | ------------------------------ |
| People       | Email Input    | Add by email with autocomplete |
| Access Level | Dropdown       | Viewer, Commenter, Editor      |
| Link Sharing | Toggle         | Enable/disable public link     |
| Link Access  | Dropdown       | Anyone with link, Restricted   |
| Expiration   | Date Picker    | Optional link expiration       |
| Password     | Toggle + Input | Optional password protection   |

**Share Actions:**

| Action             | Description                      |
| ------------------ | -------------------------------- |
| Copy Link          | Copy shareable link to clipboard |
| Send Invite        | Send email invitation            |
| Remove Access      | Revoke user access               |
| Transfer Ownership | Transfer to another user         |

---

### 3.9 Upload Modal

**Upload Methods:**

| Method        | Description           |
| ------------- | --------------------- |
| Drag & Drop   | Drop files onto modal |
| File Picker   | Click to browse files |
| Folder Upload | Upload entire folder  |
| URL Import    | Import from URL       |

**Upload Settings:**

| Setting          | Type          | Description            |
| ---------------- | ------------- | ---------------------- |
| Destination      | Folder Picker | Target folder          |
| Replace Existing | Checkbox      | Replace if name exists |
| Auto-organize    | Checkbox      | Auto-sort by type      |

**Upload Progress:**

| Element      | Description                 |
| ------------ | --------------------------- |
| File Name    | Current file being uploaded |
| Progress Bar | Upload progress percentage  |
| Speed        | Upload speed (MB/s)         |
| Cancel       | Cancel upload button        |
| Pause/Resume | Pause or resume upload      |

---

### 3.10 Storage Information

| Element      | Description                    |
| ------------ | ------------------------------ |
| Used Space   | "X GB of Y GB used"            |
| Progress Bar | Visual storage usage           |
| Breakdown    | Usage by file type (pie chart) |
| Upgrade Link | Link to upgrade storage        |

---

## 4. Chat Interface

### 4.1 Chat Page Layout

**Route:** `/chat` (new) | `/chat/{id}` (existing)

```
+------------------+------------------------------------------+------------------+
|   Side Menu      |           Chat Area                      |   Context Panel  |
|   (Navigation)   |                                          |   (Optional)     |
|                  |   +----------------------------------+   |                  |
|                  |   |     Message History              |   |                  |
|                  |   +----------------------------------+   |                  |
|                  |                                          |                  |
|                  |   +----------------------------------+   |                  |
|                  |   |     Input Area                   |   |                  |
|                  |   +----------------------------------+   |                  |
+------------------+------------------------------------------+------------------+
```

---

### 4.2 Chat Header

| Element       | Type          | Action                    |
| ------------- | ------------- | ------------------------- |
| Chat Title    | Editable Text | Click to rename           |
| Status Badge  | Badge         | Running, Completed, Error |
| Share Button  | Icon Button   | Open share modal          |
| Export Button | Icon Button   | Export conversation       |
| More Options  | Icon Button   | Open options menu         |

**More Options Menu:**

| Option     | Icon     | Action                   |
| ---------- | -------- | ------------------------ |
| Rename     | Pencil   | Edit chat title          |
| Duplicate  | Copy     | Create copy of chat      |
| Pin to Top | Pin      | Pin chat in sidebar      |
| Archive    | Archive  | Move to archive          |
| Export     | Download | Export options           |
| Delete     | Trash    | Delete with confirmation |

---

### 4.3 Message Components

**User Message:**

| Element       | Description                   |
| ------------- | ----------------------------- |
| Avatar        | User profile picture          |
| Username      | "You" or user name            |
| Timestamp     | Message time (hover for full) |
| Content       | Text message with markdown    |
| Attachments   | Uploaded files preview        |
| Edit Button   | Edit message (hover)          |
| Delete Button | Delete message (hover)        |

**AI Response:**

| Element         | Description                   |
| --------------- | ----------------------------- |
| Avatar          | Manus logo                    |
| Name            | "Manus"                       |
| Timestamp       | Response time                 |
| Content         | Formatted response (markdown) |
| Code Blocks     | Syntax highlighted code       |
| Generated Files | File cards                    |
| Action Buttons  | Response actions              |

---

### 4.4 AI Response Actions

| Action        | Icon        | Description         | Shortcut |
| ------------- | ----------- | ------------------- | -------- |
| Copy          | Copy        | Copy response text  | C        |
| Regenerate    | Refresh     | Regenerate response | R        |
| Good Response | Thumbs Up   | Positive feedback   | -        |
| Bad Response  | Thumbs Down | Negative feedback   | -        |
| Share         | Share       | Share this response | -        |
| More          | 3-dot       | Additional options  | -        |

**More Options:**

| Option             | Description                 |
| ------------------ | --------------------------- |
| Copy as Markdown   | Copy with formatting        |
| Copy as Plain Text | Copy without formatting     |
| View Raw           | View raw response           |
| Report Issue       | Report problematic response |

---

### 4.5 Task Execution Panel

**Status Display:**

| Element            | Description                   |
| ------------------ | ----------------------------- |
| Status Badge       | Running, Planning, Executing  |
| Progress Indicator | Spinner or progress bar       |
| Current Step       | Description of current action |
| Time Elapsed       | Duration since start          |

**Execution Step Types:**

| Step       | Icon     | Description        |
| ---------- | -------- | ------------------ |
| Planning   | Brain    | Creating task plan |
| Searching  | Search   | Web search         |
| Browsing   | Globe    | Visiting websites  |
| Coding     | Code     | Writing code       |
| Executing  | Terminal | Running commands   |
| Generating | Magic    | Creating content   |
| Analyzing  | Chart    | Data analysis      |

**Control Actions:**

| Action | Icon   | Description        |
| ------ | ------ | ------------------ |
| Pause  | Pause  | Pause execution    |
| Resume | Play   | Resume paused task |
| Stop   | Stop   | Cancel task        |
| Expand | Expand | Full screen view   |

---

### 4.6 Generated Artifacts

**File Card:**

| Element     | Description             |
| ----------- | ----------------------- |
| Icon        | File type icon          |
| Name        | File name               |
| Type & Size | "PDF Document • 2.4 MB" |
| Preview     | Preview button          |
| Download    | Download button         |
| Share       | Share button            |
| More        | Additional options      |

**Website Artifact:**

| Element  | Description         |
| -------- | ------------------- |
| Icon     | Globe icon          |
| Title    | "Generated Website" |
| URL      | Preview URL         |
| Open     | Open in new tab     |
| Download | Download source     |
| Deploy   | Deploy to hosting   |

---

### 4.7 Input Area

**Main Input:**

| Element         | Type     | Description                   |
| --------------- | -------- | ----------------------------- |
| Text Area       | Textarea | Multi-line input, auto-resize |
| Placeholder     | Text     | "Message Manus..."            |
| Character Count | Badge    | Optional character limit      |

**Attachment Button Menu:**

| Option          | Icon   | Description              |
| --------------- | ------ | ------------------------ |
| Upload File     | Upload | Select files from device |
| From Library    | Folder | Select from library      |
| From URL        | Link   | Import from URL          |
| Take Screenshot | Camera | Capture screen           |
| Record Audio    | Mic    | Voice input              |

**Send Button States:**

| State       | Appearance      | Action       |
| ----------- | --------------- | ------------ |
| Default     | Disabled/gray   | -            |
| Has Content | Enabled/blue    | Send message |
| Sending     | Loading spinner | -            |

**Input Settings:**

| Setting                 | Type   | Description         |
| ----------------------- | ------ | ------------------- |
| Auto-send on Enter      | Toggle | Send on Enter key   |
| Shift+Enter for newline | Toggle | Line break behavior |
| Show character count    | Toggle | Display char count  |

---

### 4.8 Quick Actions / Suggestions

| Element          | Description         |
| ---------------- | ------------------- |
| Suggestion Chips | Pre-defined prompts |
| Recent Prompts   | Previously used     |
| Popular Prompts  | Trending prompts    |

**Example Suggestions:**

- "Create a presentation about..."
- "Analyze this data..."
- "Build a website for..."
- "Research and summarize..."
- "Generate an image of..."

---

### 4.9 Context Panel (Right Sidebar)

| Section          | Content                            |
| ---------------- | ---------------------------------- |
| Task Information | Task ID, Created, Status, Duration |
| Generated Files  | All files from this chat           |
| Related Chats    | Related conversations              |
| Task Plan        | Execution plan with progress       |

---

### 4.10 Export Options

| Format   | Description   |
| -------- | ------------- |
| Markdown | .md file      |
| PDF      | Formatted PDF |
| HTML     | Web page      |
| JSON     | Raw data      |
| Text     | Plain text    |

**Export Settings:**

| Setting                 | Type     | Description      |
| ----------------------- | -------- | ---------------- |
| Include Attachments     | Checkbox | Bundle files     |
| Include Timestamps      | Checkbox | Show times       |
| Include System Messages | Checkbox | Show system info |

---

## 5. Settings Module

### 5.1 Settings Navigation

**Route:** `/settings`

| Item            | Icon    | Route                       | Description          |
| --------------- | ------- | --------------------------- | -------------------- |
| Account         | User    | `/settings/account`         | Account settings     |
| Profile         | ID Card | `/settings/profile`         | Personal info        |
| Integrations    | Plug    | `/settings/integrations`    | Third-party services |
| Connectors      | Link    | `/settings/connectors`      | API connections      |
| Mail            | Mail    | `/settings/mail`            | Email settings       |
| Skills          | Wand    | `/settings/skills`          | AI skills            |
| Scheduled Tasks | Clock   | `/settings/scheduled-tasks` | Automation           |
| Cloud Browser   | Globe   | `/settings/cloud-browser`   | Browser settings     |
| Data Controls   | Shield  | `/settings/data-controls`   | Privacy & data       |

---

### 5.2 Account Settings

**Route:** `/settings/account`

**Account Information:**

| Field        | Type | Editable          |
| ------------ | ---- | ----------------- |
| Email        | Text | No (display only) |
| Account ID   | Text | No                |
| Created Date | Text | No                |
| Last Login   | Text | No                |

**Email Management:**

| Action              | Description                |
| ------------------- | -------------------------- |
| Change Email        | Initiate email change flow |
| Verify Email        | Resend verification email  |
| Add Secondary Email | Add backup email           |

**Password Section:**

| Field            | Type     | Validation              |
| ---------------- | -------- | ----------------------- |
| Current Password | Password | Required                |
| New Password     | Password | Min 8 chars, complexity |
| Confirm Password | Password | Must match              |

**Two-Factor Authentication:**

| Setting      | Type   | Description                   |
| ------------ | ------ | ----------------------------- |
| Enable 2FA   | Toggle | Turn on/off 2FA               |
| Method       | Radio  | Authenticator App, SMS, Email |
| Backup Codes | Button | Generate backup codes         |

**Session Management:**

| Column      | Description       |
| ----------- | ----------------- |
| Device Name | Browser/OS info   |
| Location    | IP-based location |
| Last Active | Timestamp         |
| Actions     | Revoke session    |

**Danger Zone:**

| Action         | Description            | Confirmation            |
| -------------- | ---------------------- | ----------------------- |
| Export Data    | Download all user data | Email confirmation      |
| Delete Account | Permanently delete     | Password + confirmation |

---

### 5.3 Profile / Personalization

**Route:** `/settings/profile`

**Profile Picture:**

| Element        | Action                                    |
| -------------- | ----------------------------------------- |
| Current Avatar | Display current image                     |
| Upload Button  | Upload new image (JPG, PNG, GIF, max 5MB) |
| Remove Button  | Remove current image                      |
| Crop Tool      | Adjust image crop                         |

**Personal Information:**

| Field        | Type     | Required | Validation    |
| ------------ | -------- | -------- | ------------- |
| First Name   | Text     | Yes      | 1-50 chars    |
| Last Name    | Text     | Yes      | 1-50 chars    |
| Display Name | Text     | No       | 1-30 chars    |
| Bio          | Textarea | No       | Max 500 chars |
| Location     | Text     | No       | Free text     |
| Website      | URL      | No       | Valid URL     |
| Company      | Text     | No       | Free text     |
| Job Title    | Text     | No       | Free text     |

**Preferences:**

| Setting     | Type     | Options                        |
| ----------- | -------- | ------------------------------ |
| Language    | Dropdown | English, Spanish, French, etc. |
| Timezone    | Dropdown | All timezones                  |
| Date Format | Dropdown | MM/DD/YYYY, DD/MM/YYYY, etc.   |
| Time Format | Dropdown | 12-hour, 24-hour               |

**AI Personalization:**

| Setting              | Type     | Options                        |
| -------------------- | -------- | ------------------------------ |
| Response Style       | Dropdown | Concise, Detailed, Balanced    |
| Tone                 | Dropdown | Professional, Casual, Friendly |
| Default Language     | Dropdown | Response language              |
| Remember Preferences | Toggle   | Learn from interactions        |

---

### 5.4 Integrations

**Route:** `/settings/integrations`

**Integration Categories:**

| Category      | Integrations                                   |
| ------------- | ---------------------------------------------- |
| Cloud Storage | Google Drive, OneDrive, Dropbox, iCloud        |
| Productivity  | Google Workspace, Microsoft 365, Notion, Slack |
| Development   | GitHub, GitLab, Bitbucket                      |

**Integration Card:**

| Element     | Description             |
| ----------- | ----------------------- |
| Logo        | Service logo            |
| Name        | Integration name        |
| Status      | Connected/Not Connected |
| Account     | Connected account email |
| Last Synced | Sync timestamp          |
| Actions     | Settings, Disconnect    |

**Integration Actions:**

| Action           | Description             |
| ---------------- | ----------------------- |
| Connect          | Initiate OAuth flow     |
| Disconnect       | Revoke access           |
| Settings         | Configure integration   |
| Refresh          | Re-sync connection      |
| View Permissions | See granted permissions |

---

### 5.5 Connectors

**Route:** `/settings/connectors`

**Connector Types:**

| Type                | Examples                      |
| ------------------- | ----------------------------- |
| API Connectors      | OpenAI, Anthropic, Custom API |
| Database Connectors | PostgreSQL, MySQL, MongoDB    |

**Connector Configuration:**

| Field           | Type      | Description            |
| --------------- | --------- | ---------------------- |
| Name            | Text      | Connector display name |
| Type            | Dropdown  | API, Database, Service |
| Endpoint        | URL       | Connection URL         |
| API Key         | Password  | Authentication key     |
| Headers         | Key-Value | Custom headers         |
| Test Connection | Button    | Verify connectivity    |

---

### 5.6 Mail Settings

**Route:** `/settings/mail`

**Email Account Card:**

| Element       | Description                       |
| ------------- | --------------------------------- |
| Provider Logo | Gmail, Outlook, etc.              |
| Email Address | Connected email                   |
| Status        | Connected/Disconnected            |
| Primary       | Primary account indicator         |
| Actions       | Set Primary, Settings, Disconnect |

**Email Settings:**

| Setting           | Type     | Description             |
| ----------------- | -------- | ----------------------- |
| Default Account   | Dropdown | Primary sending account |
| Signature         | Textarea | Email signature         |
| Reply-to Address  | Email    | Reply-to email          |
| Send Copy to Self | Toggle   | BCC self on sends       |

---

### 5.7 Skills

**Route:** `/settings/skills`

**Skill Card:**

| Element     | Description                   |
| ----------- | ----------------------------- |
| Icon        | Skill icon                    |
| Name        | Skill name                    |
| Description | What the skill does           |
| Version     | Version number                |
| Author      | Skill author                  |
| Status      | Enabled/Disabled              |
| Actions     | Configure, Disable, Uninstall |

**Skill Actions:**

| Action         | Description                |
| -------------- | -------------------------- |
| Install        | Add skill from marketplace |
| Uninstall      | Remove skill               |
| Enable/Disable | Toggle skill active state  |
| Configure      | Open skill settings        |
| Update         | Update to latest version   |

---

### 5.8 Scheduled Tasks

**Route:** `/settings/scheduled-tasks`

**Task List Columns:**

| Column   | Description                 |
| -------- | --------------------------- |
| Name     | Task name                   |
| Schedule | Cron expression or interval |
| Next Run | Next execution time         |
| Last Run | Previous execution time     |
| Status   | Active, Paused, Failed      |
| Actions  | Edit, Run Now, Delete       |

**Create/Edit Task Modal:**

| Field           | Type          | Description              |
| --------------- | ------------- | ------------------------ |
| Name            | Text          | Task name                |
| Prompt          | Textarea      | Task instructions        |
| Schedule Type   | Radio         | Cron, Interval, One-time |
| Cron Expression | Text          | Cron schedule            |
| Interval        | Number + Unit | Repeat interval          |
| One-time Date   | Datetime      | Specific date/time       |
| Timezone        | Dropdown      | Execution timezone       |
| Expiration      | Datetime      | Task end date            |
| Enabled         | Toggle        | Active state             |

---

### 5.9 Cloud Browser

**Route:** `/settings/cloud-browser`

**Browser Settings:**

| Setting         | Type     | Description             |
| --------------- | -------- | ----------------------- |
| Default Browser | Dropdown | Chrome, Firefox, etc.   |
| User Agent      | Text     | Custom user agent       |
| Viewport Size   | Dropdown | Desktop, Tablet, Mobile |
| JavaScript      | Toggle   | Enable/disable JS       |
| Cookies         | Toggle   | Accept cookies          |
| Images          | Toggle   | Load images             |

**Saved Logins:**

| Field      | Type     | Description     |
| ---------- | -------- | --------------- |
| Site URL   | URL      | Website URL     |
| Username   | Text     | Login username  |
| Password   | Password | Login password  |
| Auto-login | Toggle   | Automatic login |
| 2FA Method | Dropdown | None, TOTP, SMS |
| 2FA Secret | Password | TOTP secret key |

---

### 5.10 Data Controls

**Route:** `/settings/data-controls`

**Data Retention:**

| Setting         | Type     | Options                                      |
| --------------- | -------- | -------------------------------------------- |
| Chat History    | Dropdown | Forever, 1 year, 6 months, 3 months, 1 month |
| Generated Files | Dropdown | Forever, 1 year, 6 months, 3 months          |
| Activity Logs   | Dropdown | Forever, 1 year, 6 months, 90 days, 30 days  |

**Privacy Settings:**

| Setting         | Type   | Description                   |
| --------------- | ------ | ----------------------------- |
| Training Data   | Toggle | Allow data for model training |
| Analytics       | Toggle | Share usage analytics         |
| Error Reporting | Toggle | Automatic error reports       |
| Personalization | Toggle | Use data for personalization  |

**Data Export:**

| Action          | Description                    |
| --------------- | ------------------------------ |
| Export All Data | Download complete data archive |
| Export Chats    | Download chat history          |
| Export Files    | Download all files             |
| Export Settings | Download settings backup       |

**Data Deletion:**

| Action             | Description          | Confirmation                  |
| ------------------ | -------------------- | ----------------------------- |
| Clear Chat History | Delete all chats     | Password required             |
| Clear Files        | Delete all files     | Password required             |
| Clear Activity     | Delete activity logs | Password required             |
| Delete Everything  | Complete data wipe   | Password + email confirmation |

---

## 6. Billing & Usage

### 6.1 Usage Page

**Route:** `/settings/usage`

**Usage Summary:**

| Metric            | Description                |
| ----------------- | -------------------------- |
| Total Tasks       | Tasks executed this period |
| Credits Used      | Credits consumed           |
| Credits Remaining | Available credits          |
| Period            | Billing period dates       |

**Usage Breakdown:**

| Category         | Metric     | Visual       |
| ---------------- | ---------- | ------------ |
| Chat Messages    | Count      | Progress bar |
| File Generation  | Count/Size | Progress bar |
| Web Browsing     | Minutes    | Progress bar |
| Code Execution   | Minutes    | Progress bar |
| Image Generation | Count      | Progress bar |

**Usage Chart:**

| Element        | Description               |
| -------------- | ------------------------- |
| Chart Type     | Line/Bar chart            |
| Time Range     | Day, Week, Month, Year    |
| Metrics Toggle | Select metrics to display |

---

### 6.2 Credits Page

**Route:** `/settings/credits`

**Balance Display:**

| Element            | Description                      |
| ------------------ | -------------------------------- |
| Current Balance    | Available credits                |
| Monthly Allocation | Credits per month (subscription) |
| Bonus Credits      | Promotional credits              |
| Expiring Soon      | Credits expiring within 30 days  |

**Credit Packages:**

| Package      | Credits | Price | Savings |
| ------------ | ------- | ----- | ------- |
| Starter      | 100     | $10   | -       |
| Standard     | 500     | $45   | 10%     |
| Professional | 1,000   | $80   | 20%     |
| Enterprise   | 5,000   | $350  | 30%     |

**Auto-Recharge:**

| Setting              | Type     | Description            |
| -------------------- | -------- | ---------------------- |
| Enable Auto-Recharge | Toggle   | Automatic purchase     |
| Threshold            | Number   | Trigger balance        |
| Recharge Amount      | Dropdown | Package to purchase    |
| Monthly Limit        | Number   | Maximum auto-purchases |

---

### 6.3 Billing Page

**Route:** `/settings/billing`

**Current Plan Display:**

| Element   | Description               |
| --------- | ------------------------- |
| Plan Name | Current subscription tier |
| Price     | Monthly/annual price      |
| Features  | List of included features |
| Actions   | Change Plan, Cancel       |

**Plan Comparison:**

| Feature          | Free   | Starter | Pro          | Enterprise |
| ---------------- | ------ | ------- | ------------ | ---------- |
| Monthly Credits  | 50     | 200     | 1,000        | Unlimited  |
| Chat History     | 7 days | 30 days | 1 year       | Forever    |
| File Storage     | 1 GB   | 10 GB   | 100 GB       | Unlimited  |
| Priority Support | No     | Email   | Email + Chat | Dedicated  |
| API Access       | No     | Limited | Full         | Full       |
| Team Members     | 1      | 3       | 10           | Unlimited  |
| Price            | Free   | $9/mo   | $29/mo       | Custom     |

**Payment Methods:**

| Element       | Description               |
| ------------- | ------------------------- |
| Card List     | Saved credit/debit cards  |
| Default Badge | Primary payment method    |
| Card Info     | Last 4 digits, expiry     |
| Actions       | Edit, Remove, Set Default |

**Add Payment Method:**

| Method        | Description            |
| ------------- | ---------------------- |
| Credit Card   | Visa, Mastercard, Amex |
| Debit Card    | Bank debit cards       |
| PayPal        | PayPal account         |
| Bank Transfer | Direct bank transfer   |

**Invoice List:**

| Column    | Description           |
| --------- | --------------------- |
| Invoice # | Invoice number        |
| Date      | Invoice date          |
| Amount    | Total amount          |
| Status    | Paid, Pending, Failed |
| Actions   | Download, View        |

---

## 7. Applications (Composio)

### 7.1 Applications Page

**Route:** `/applications`

**Page Header:**

| Element     | Type           | Action                    |
| ----------- | -------------- | ------------------------- |
| Page Title  | Heading        | "Applications"            |
| Add App     | Primary Button | Open app marketplace      |
| Search      | Text Input     | Search applications       |
| Filter      | Dropdown       | Filter by category/status |
| View Toggle | Icon Buttons   | Grid/List view            |

**Filter Options:**

| Filter   | Options                                                                       |
| -------- | ----------------------------------------------------------------------------- |
| Status   | All, Connected, Available                                                     |
| Category | Productivity, Communication, Development, Storage, Marketing, Finance, Social |
| Sort     | Name A-Z, Name Z-A, Recently Added, Most Popular                              |

---

### 7.2 Connected App Card

| Element        | Description           |
| -------------- | --------------------- |
| App Logo       | Service logo          |
| App Name       | Application name      |
| Status Badge   | "Connected"           |
| Category       | App category          |
| Connected Date | When connected        |
| Account        | Connected account     |
| Actions        | Configure, Disconnect |

**Connected App Actions:**

| Action     | Icon    | Description        |
| ---------- | ------- | ------------------ |
| Configure  | Gear    | Open app settings  |
| Disconnect | Unlink  | Remove connection  |
| View Logs  | List    | View activity logs |
| Refresh    | Refresh | Re-authenticate    |
| Test       | Play    | Test connection    |

---

### 7.3 Available App Card

| Element     | Description         |
| ----------- | ------------------- |
| App Logo    | Service logo        |
| App Name    | Application name    |
| Category    | App category        |
| Description | Brief description   |
| Actions     | Connect, Learn More |

---

### 7.4 App Categories

| Category      | Icon      | Example Apps                          |
| ------------- | --------- | ------------------------------------- |
| Productivity  | Briefcase | Notion, Asana, Trello, Monday         |
| Communication | Message   | Slack, Discord, Teams, Telegram       |
| Development   | Code      | GitHub, GitLab, Bitbucket, Jira       |
| Storage       | Folder    | Google Drive, Dropbox, OneDrive, Box  |
| Marketing     | Megaphone | Mailchimp, HubSpot, Salesforce        |
| Finance       | Dollar    | Stripe, QuickBooks, Xero              |
| Social        | Share     | Twitter/X, LinkedIn, Facebook         |
| Calendar      | Calendar  | Google Calendar, Outlook, Calendly    |
| CRM           | Users     | Salesforce, HubSpot, Pipedrive        |
| E-commerce    | Shopping  | Shopify, WooCommerce, Amazon          |
| Analytics     | Chart     | Google Analytics, Mixpanel, Amplitude |
| AI/ML         | Brain     | OpenAI, Anthropic, Hugging Face       |

---

### 7.5 Connect App Flow

**Step 1: Select App**

- Click on app card
- View permissions and features

**Step 2: Authorization**

- Redirect to app's OAuth page
- Review requested permissions
- Grant access

**Step 3: Configuration**

- Choose account (if multiple)
- Configure integration options
- Complete connection

---

### 7.6 App Configuration Modal

**General Settings:**

| Setting        | Type     | Description                |
| -------------- | -------- | -------------------------- |
| Enabled        | Toggle   | Enable/disable integration |
| Auto-sync      | Toggle   | Automatic data sync        |
| Sync Frequency | Dropdown | Real-time, Hourly, Daily   |
| Notifications  | Toggle   | Receive notifications      |

**Permissions:**

| Permission | Type     | Description           |
| ---------- | -------- | --------------------- |
| Read       | Checkbox | Read access           |
| Write      | Checkbox | Write access          |
| Delete     | Checkbox | Delete access         |
| Admin      | Checkbox | Administrative access |

---

## 8. Devices (Home Assistant)

### 8.1 Devices Page

**Route:** `/devices`

**Page Header:**

| Element    | Type       | Action                |
| ---------- | ---------- | --------------------- |
| Page Title | Heading    | "Devices"             |
| Add Device | Button     | Add new device        |
| Add Hub    | Button     | Connect new hub       |
| Search     | Text Input | Search devices        |
| Filter     | Dropdown   | Filter by type/status |
| Rooms      | Dropdown   | Filter by room        |

**Filter Options:**

| Filter | Options                                                         |
| ------ | --------------------------------------------------------------- |
| Status | All, Online, Offline, Error                                     |
| Type   | Lights, Switches, Sensors, Climate, Media, Security, Appliances |
| Room   | All Rooms, Living Room, Bedroom, Kitchen, etc.                  |
| Hub    | All Hubs, Home Assistant, SmartThings, etc.                     |

---

### 8.2 Hub Card

| Element      | Description                 |
| ------------ | --------------------------- |
| Hub Logo     | Hub service logo            |
| Hub Name     | "Home Assistant"            |
| Status       | Online/Offline indicator    |
| IP Address   | Hub IP address              |
| Device Count | Connected devices           |
| Last Sync    | Sync timestamp              |
| Actions      | Configure, Sync, Disconnect |

**Hub Actions:**

| Action     | Icon    | Description            |
| ---------- | ------- | ---------------------- |
| Configure  | Gear    | Hub settings           |
| Sync       | Refresh | Force sync devices     |
| Disconnect | Unlink  | Remove hub             |
| View Logs  | List    | Activity logs          |
| Restart    | Power   | Restart hub connection |

---

### 8.3 Add Hub Flow

**Step 1: Select Hub Type**

| Hub Type       | Description            |
| -------------- | ---------------------- |
| Home Assistant | Connect to HA instance |
| SmartThings    | Samsung SmartThings    |
| Hubitat        | Hubitat Elevation      |
| Apple HomeKit  | Apple Home             |
| Google Home    | Google Nest            |
| Amazon Alexa   | Echo devices           |

**Step 2: Connection Details**

| Field        | Type     | Description                |
| ------------ | -------- | -------------------------- |
| Hub URL      | URL      | Hub address (IP or domain) |
| Port         | Number   | Connection port            |
| Access Token | Password | Long-lived access token    |
| SSL          | Toggle   | Use HTTPS                  |

**Step 3: Discovery**

- Scanning for devices
- Found devices list
- Select devices to import
- Assign to rooms

---

### 8.4 Device Categories

| Category   | Icon        | Device Types                               |
| ---------- | ----------- | ------------------------------------------ |
| Lights     | Lightbulb   | Bulbs, Strips, Dimmers                     |
| Switches   | Toggle      | Smart plugs, Wall switches                 |
| Climate    | Thermometer | Thermostats, AC, Fans, Heaters             |
| Sensors    | Sensor      | Motion, Temperature, Humidity, Door/Window |
| Media      | TV          | TVs, Speakers, Receivers                   |
| Security   | Shield      | Cameras, Locks, Alarms                     |
| Blinds     | Window      | Curtains, Shades, Blinds                   |
| Appliances | Plug        | Vacuums, Washers, Refrigerators            |

---

### 8.5 Device Cards

**Light Device:**

| Element           | Description                  |
| ----------------- | ---------------------------- |
| Icon              | Lightbulb icon               |
| Name              | "Living Room Light"          |
| Status            | On/Off toggle                |
| Brightness        | Percentage                   |
| Color             | Current color                |
| Brightness Slider | Adjust brightness            |
| Color Picker      | Change color                 |
| Actions           | Schedule, Automate, Settings |

**Thermostat Device:**

| Element       | Description                  |
| ------------- | ---------------------------- |
| Icon          | Thermometer icon             |
| Name          | "Living Room Thermostat"     |
| Current Temp  | Current temperature          |
| Target Temp   | Target temperature           |
| Mode          | Heating/Cooling/Auto         |
| Humidity      | Current humidity             |
| Temp Controls | +/- buttons                  |
| Mode Selector | Mode dropdown                |
| Actions       | Schedule, Automate, Settings |

**Sensor Device:**

| Element        | Description                      |
| -------------- | -------------------------------- |
| Icon           | Sensor icon                      |
| Name           | "Front Door Sensor"              |
| Status         | Open/Closed                      |
| Battery        | Battery percentage               |
| Last Triggered | Timestamp                        |
| Actions        | View History, Automate, Settings |

---

### 8.6 Device Actions

**Common Actions:**

| Action   | Icon  | Description       |
| -------- | ----- | ----------------- |
| Toggle   | Power | Turn on/off       |
| Settings | Gear  | Device settings   |
| Schedule | Clock | Set schedules     |
| Automate | Robot | Create automation |
| History  | Chart | View history      |
| Remove   | Trash | Remove device     |

---

### 8.7 Rooms Management

**Room Actions:**

| Action      | Description                  |
| ----------- | ---------------------------- |
| Add Room    | Create new room              |
| Edit Room   | Rename room                  |
| Delete Room | Remove room                  |
| All Off     | Turn off all devices in room |
| All On      | Turn on all devices in room  |
| Scene       | Apply room scene             |

---

### 8.8 Scenes & Automations

**Scene Card:**

| Element      | Description            |
| ------------ | ---------------------- |
| Icon         | Scene icon             |
| Name         | "Morning Routine"      |
| Device Count | Number of devices      |
| Actions      | Description of actions |
| Buttons      | Activate, Edit, Delete |

**Automation Card:**

| Element | Description                  |
| ------- | ---------------------------- |
| Icon    | Robot icon                   |
| Name    | "Motion Light"               |
| Trigger | Trigger description          |
| Action  | Action description           |
| Status  | Active/Inactive              |
| Buttons | Enable/Disable, Edit, Delete |

---

### 8.9 Create Automation Flow

**Step 1: Trigger**

| Trigger Type   | Description               |
| -------------- | ------------------------- |
| Device State   | When device changes state |
| Time           | At specific time          |
| Sunrise/Sunset | Based on sun position     |
| Location       | When arriving/leaving     |
| Voice Command  | When phrase spoken        |

**Step 2: Conditions (Optional)**

| Condition Type | Description                      |
| -------------- | -------------------------------- |
| Time Range     | Only during certain hours        |
| Day of Week    | Only on certain days             |
| Device State   | Only if device in state          |
| Mode           | Only in certain mode (Home/Away) |

**Step 3: Actions**

| Action Type    | Description             |
| -------------- | ----------------------- |
| Device Control | Control a device        |
| Scene          | Activate a scene        |
| Notification   | Send notification       |
| Delay          | Wait before next action |
| AI Task        | Trigger Manus task      |

---

## 9. Global Components

### 9.1 Toast Notifications

| Type    | Icon  | Color  | Duration  |
| ------- | ----- | ------ | --------- |
| Success | Check | Green  | 3 seconds |
| Error   | X     | Red    | 5 seconds |
| Warning | Alert | Yellow | 4 seconds |
| Info    | Info  | Blue   | 3 seconds |

### 9.2 Confirmation Dialogs

| Element        | Description              |
| -------------- | ------------------------ |
| Title          | Action being confirmed   |
| Message        | Detailed explanation     |
| Cancel Button  | Secondary, closes dialog |
| Confirm Button | Primary, executes action |

### 9.3 Loading States

| Type         | Usage                         |
| ------------ | ----------------------------- |
| Spinner      | Button loading, small areas   |
| Skeleton     | Page loading, content areas   |
| Progress Bar | File uploads, long operations |
| Shimmer      | List items, cards             |

### 9.4 Empty States

| Element      | Description                 |
| ------------ | --------------------------- |
| Illustration | Relevant empty state image  |
| Title        | "No [items] yet"            |
| Description  | Helpful explanation         |
| CTA Button   | Primary action to add items |

### 9.5 Error States

| Element      | Description            |
| ------------ | ---------------------- |
| Icon         | Error icon             |
| Title        | Error type             |
| Message      | Detailed error message |
| Retry Button | Attempt action again   |
| Help Link    | Link to support        |

---

## 10. State Management

### 10.1 Authentication States

| State           | Description      | UI Behavior         |
| --------------- | ---------------- | ------------------- |
| Unauthenticated | No valid session | Redirect to login   |
| Authenticating  | Checking session | Show loading        |
| Authenticated   | Valid session    | Show app            |
| Session Expired | Token expired    | Show re-login modal |

### 10.2 Subscription States

| State     | Description            | Visual       |
| --------- | ---------------------- | ------------ |
| Active    | Subscription active    | Green badge  |
| Trialing  | In trial period        | Blue badge   |
| Past Due  | Payment failed         | Yellow badge |
| Cancelled | Will end at period end | Orange badge |
| Expired   | Subscription ended     | Red badge    |

### 10.3 Task States

| State     | Description        | Visual     |
| --------- | ------------------ | ---------- |
| Idle      | No task running    | -          |
| Planning  | Creating task plan | Brain icon |
| Running   | Task in progress   | Spinner    |
| Paused    | Task paused        | Pause icon |
| Completed | Task finished      | Check icon |
| Failed    | Task failed        | X icon     |

### 10.4 Device States

| State    | Icon           | Description           |
| -------- | -------------- | --------------------- |
| Online   | Green dot      | Device responsive     |
| Offline  | Red dot        | Device not responding |
| Updating | Blue spinner   | Firmware updating     |
| Error    | Yellow warning | Device error          |
| Unknown  | Gray dot       | State unknown         |

---

## Appendix A: API Endpoints Summary

| Module  | Endpoint                           | Method | Description            |
| ------- | ---------------------------------- | ------ | ---------------------- |
| Auth    | `/api/auth/login`                  | POST   | User login             |
| Auth    | `/api/auth/register`               | POST   | User registration      |
| Auth    | `/api/auth/logout`                 | POST   | User logout            |
| Auth    | `/api/auth/refresh`                | POST   | Refresh token          |
| Auth    | `/api/auth/forgot-password`        | POST   | Request password reset |
| Auth    | `/api/auth/reset-password`         | POST   | Reset password         |
| Users   | `/api/users/me`                    | GET    | Get current user       |
| Users   | `/api/users/me`                    | PATCH  | Update current user    |
| Files   | `/api/files`                       | GET    | List files             |
| Files   | `/api/files`                       | POST   | Upload file            |
| Files   | `/api/files/:id`                   | GET    | Get file               |
| Files   | `/api/files/:id`                   | PATCH  | Update file            |
| Files   | `/api/files/:id`                   | DELETE | Delete file            |
| Folders | `/api/folders`                     | GET    | List folders           |
| Folders | `/api/folders`                     | POST   | Create folder          |
| Folders | `/api/folders/:id`                 | PATCH  | Update folder          |
| Folders | `/api/folders/:id`                 | DELETE | Delete folder          |
| Chats   | `/api/chats`                       | GET    | List chats             |
| Chats   | `/api/chats`                       | POST   | Create chat            |
| Chats   | `/api/chats/:id`                   | GET    | Get chat               |
| Chats   | `/api/chats/:id/messages`          | POST   | Send message           |
| Tasks   | `/api/tasks`                       | GET    | List scheduled tasks   |
| Tasks   | `/api/tasks`                       | POST   | Create task            |
| Tasks   | `/api/tasks/:id`                   | PATCH  | Update task            |
| Tasks   | `/api/tasks/:id`                   | DELETE | Delete task            |
| Apps    | `/api/applications`                | GET    | List applications      |
| Apps    | `/api/applications/:id/connect`    | POST   | Connect app            |
| Apps    | `/api/applications/:id/disconnect` | POST   | Disconnect app         |
| Devices | `/api/devices`                     | GET    | List devices           |
| Devices | `/api/devices/:id/control`         | POST   | Control device         |
| Hubs    | `/api/hubs`                        | GET    | List hubs              |
| Hubs    | `/api/hubs`                        | POST   | Add hub                |
| Billing | `/api/billing/subscription`        | GET    | Get subscription       |
| Billing | `/api/billing/invoices`            | GET    | List invoices          |
| Credits | `/api/credits/balance`             | GET    | Get credit balance     |
| Credits | `/api/credits/purchase`            | POST   | Purchase credits       |

---

## Appendix B: Keyboard Shortcuts

| Shortcut         | Action             | Context       |
| ---------------- | ------------------ | ------------- |
| Cmd/Ctrl + K     | Open search        | Global        |
| Cmd/Ctrl + N     | New chat           | Global        |
| Cmd/Ctrl + Enter | Send message       | Chat          |
| Cmd/Ctrl + /     | Show shortcuts     | Global        |
| Esc              | Close modal/Cancel | Global        |
| Space            | Preview file       | Library       |
| Delete           | Delete selected    | Library       |
| S                | Star/Unstar        | Library       |
| D                | Download           | Library       |
| F2               | Rename             | Library       |
| ↑ / ↓            | Navigate           | Search, Lists |
| Enter            | Select             | Search, Lists |

---

## Appendix C: Color Palette

| Color          | Hex     | Usage                    |
| -------------- | ------- | ------------------------ |
| Primary        | #2D2D2D | Primary actions, headers |
| Primary Light  | #E5E5E5 | Backgrounds, borders     |
| Success        | #2E7D32 | Success states, positive |
| Error          | #C62828 | Error states, negative   |
| Warning        | #F57C00 | Warning states           |
| Info           | #1976D2 | Info states              |
| Text Primary   | #1A1A1A | Main text                |
| Text Secondary | #666666 | Secondary text           |
| Background     | #FFFFFF | Page background          |
| Surface        | #F5F5F5 | Card backgrounds         |
| Border         | #E0E0E0 | Borders, dividers        |

---

_This specification document provides a comprehensive blueprint for developing an AI agent platform with enhanced file management, application integrations, and smart home device control capabilities. All components, states, and actions are documented to ensure consistent implementation across the development team._
