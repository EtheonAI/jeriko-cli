# Complete Application Feature Specification

## Manus-Like AI Agent Platform

---

# TABLE OF CONTENTS

1. [Authentication System](#1-authentication-system)
2. [Dashboard / Homepage](#2-dashboard--homepage)
3. [Chat / Task Interface](#3-chat--task-interface)
4. [Library (Enhanced with Folders)](#4-library-enhanced-with-folders)
5. [Search System](#5-search-system)
6. [Projects](#6-projects)
7. [Notifications](#7-notifications)
8. [Profile & Account](#8-profile--account)
9. [Settings](#9-settings)
10. [Billing & Credits](#10-billing--credits)
11. [Usage Tracking](#11-usage-tracking)
12. [Invitation & Referral System](#12-invitation--referral-system)
13. [Applications (Composio Integration)](#13-applications-composio-integration)
14. [Devices (Home Assistant MCP)](#14-devices-home-assistant-mcp)
15. [Sidebar Navigation](#15-sidebar-navigation)

---

# 1. AUTHENTICATION SYSTEM

## 1.1 Sign Up / Sign In Page

### Layout & Components:

- **Logo**: Top-left corner (Manus logo)
- **Center Card**: Contains all authentication options
- **Background**: Dot pattern on dark/light theme
- **Footer**: "from Meta" branding, Terms of service, Privacy policy links

### Features:

#### Social Authentication:

| Provider  | Action                      | State                                      |
| --------- | --------------------------- | ------------------------------------------ |
| Google    | `continue_with_google()`    | Shows "Last used" badge if previously used |
| Microsoft | `continue_with_microsoft()` | Standard OAuth flow                        |
| Apple     | `continue_with_apple()`     | Standard OAuth flow                        |

#### Email Authentication:

1. **Email Input Field**

   - Placeholder: "Enter your email address"
   - Validation: Email format check
   - State: `email_input_focus`, `email_valid`, `email_invalid`

2. **CAPTCHA Verification**

   - Provider: Cloudflare Turnstile
   - State: `verifying`, `success`, `failed`
   - Actions: `verify_human()`

3. **Continue Button**
   - State: `disabled` (until email valid + CAPTCHA passed)
   - State: `loading` (during verification)
   - Action: `proceed_to_password()`

### States:

- `initial` - First load
- `verifying_email` - Checking if email exists
- `new_user` - Email not found, create account flow
- `existing_user` - Email found, login flow
- `error` - Display error message

---

## 1.2 Create Account (Sign Up)

### Components:

1. **Email Display**

   - Shows pre-filled email from previous step
   - Action: `edit_email()` - goes back to email input

2. **Password Field**

   - Placeholder: "Enter password"
   - Toggle: Show/hide password (eye icon)
   - Validation: Minimum 8 characters, complexity requirements
   - State: `password_weak`, `password_medium`, `password_strong`

3. **Continue Button**

   - Disabled until password meets requirements
   - Action: `create_account()`

4. **Back Button**
   - Action: `go_back_to_email()`

### States:

- `password_input` - Entering password
- `creating_account` - API call in progress
- `account_created` - Success, redirect to verification
- `error` - Display error

---

## 1.3 Login Page

### Components:

1. **Email Display**

   - Shows pre-filled email
   - Action: `edit_email()`

2. **Password Field**

   - Placeholder: "Enter password"
   - Toggle: Show/hide password

3. **Forgot Password Link**

   - Action: `navigate_to_forgot_password()`

4. **Continue Button**

   - Action: `login()`

5. **Back Button**
   - Action: `go_back()`

### States:

- `password_input` - Entering password
- `logging_in` - API call in progress
- `login_success` - Redirect to dashboard
- `login_failed` - Show error message
- `account_locked` - Too many attempts

---

## 1.4 Email Verification

### Components:

1. **Instructions**

   - Shows: "Enter the code sent to [email] to complete verification"

2. **Verification Code Input**

   - 6-digit code field
   - Auto-focus on first digit
   - Auto-advance to next digit
   - Timer display: Shows countdown (e.g., "58s")

3. **Resend Code**

   - Action: `resend_verification_code()`
   - Disabled until timer expires

4. **Verify Button**

   - Action: `verify_code()`
   - State: `verifying`, `success`, `invalid_code`

5. **Back Button**
   - Action: `go_back()`

### States:

- `code_input` - Entering code
- `verifying` - Checking code
- `verified` - Success, redirect to dashboard
- `code_expired` - Show resend option
- `invalid_code` - Show error, clear input

---

## 1.5 Forgot Password

### Components:

1. **Email Display**

   - Pre-filled email

2. **CAPTCHA**

   - Cloudflare verification

3. **Reset Password Button**

   - Action: `send_reset_email()`

4. **Success Message**
   - "We have sent a password recovery email if you have registered before"

### States:

- `initial` - Ready to send
- `sending` - Email sending
- `sent` - Success message shown
- `email_not_found` - Generic success (security)

---

## 1.6 Reset Password

### Components:

1. **Verification Code Input**

   - 6-digit code with timer

2. **New Password Field**

   - Placeholder: "Enter new password"
   - Strength indicator

3. **Confirm Password Field**

   - Placeholder: "Enter confirm password"
   - Validation: Must match new password

4. **Update Password Button**

   - Action: `update_password()`

5. **Back Button**
   - Action: `go_back()`

### States:

- `code_verification` - Verify the code first
- `password_reset` - Enter new passwords
- `updating` - API call
- `updated` - Success, redirect to login
- `password_mismatch` - Error state

---

# 2. DASHBOARD / HOMEPAGE

## Layout:

- **Header**: Model selector ("Manus 1.6 Max"), Notifications, Credits, Profile
- **Main Content**: Centered prompt input
- **Sidebar**: Collapsible navigation

## Components:

### 2.1 Model Selector Dropdown

- Options: "Manus 1.6 Max", "Manus 1.6 Lite"
- Action: `switch_model(version)`

### 2.2 Subscription Banner

- Shows: "Manus Pro expires on [date]"
- Action: `reactivate_subscription()`

### 2.3 Main Prompt Input

#### Input Area:

- Placeholder: "Assign a task or ask anything"
- Auto-expand textarea
- Character limit indicator

#### Toolbar (Below Input):

| Icon        | Action                    | Description             |
| ----------- | ------------------------- | ----------------------- |
| +           | `attach_file()`           | Upload files            |
| Gmail icon  | `connect_gmail()`         | Connect Gmail           |
| Google icon | `connect_google()`        | Connect Google services |
| +1          | `show_more_connections()` | More integrations       |
| Sparkles    | `enhance_prompt()`        | AI prompt enhancement   |

#### Right Side Actions:

| Icon       | Action            | Description           |
| ---------- | ----------------- | --------------------- |
| Brain      | `use_knowledge()` | Access knowledge base |
| Microphone | `voice_input()`   | Voice-to-text input   |
| Send Arrow | `submit_task()`   | Submit the task       |

### 2.4 Connected Tools Bar

- Shows: "Connect your tools to Manus"
- Displays connected service icons
- Action: `manage_connections()`
- Close button: `hide_connections_bar()`

### 2.5 Quick Action Chips:

- "Create slides" → `quick_action('slides')`
- "Build website" → `quick_action('website')`
- "Develop apps" → `quick_action('apps')`
- "Design" → `quick_action('design')`
- "More" → `show_all_quick_actions()`

### 2.6 Feature Cards (3 columns):

| Card | Title           | Description                                         | Action                   |
| ---- | --------------- | --------------------------------------------------- | ------------------------ |
| 1    | Download app    | "Download app to access Manus anytime and anywhere" | `download_app()`         |
| 2    | Custom skills   | "Get new capabilities with custom skills"           | `explore_skills()`       |
| 3    | Personalization | "Let Manus know more about you"                     | `open_personalization()` |

### 2.7 "What are you building?" Section

- Grid of use case templates
- Each card has: Icon, Title, Description
- Action: `select_template(template_id)`

### 2.8 Collapsed Sidebar Icons (when collapsed):

- New task (pencil icon)
- Search (magnifying glass)
- Library (building icon)
- Projects (folder icon)
- All tasks (list icon)
- Share (share icon)
- Settings (gear icon)
- Collapse toggle (at bottom)

---

# 3. CHAT / TASK INTERFACE

## Layout:

- **Header**: Model version, Collaborate button, Share button, More options
- **Left Sidebar**: Task list
- **Main Area**: Chat conversation
- **Bottom**: Message input

## Components:

### 3.1 Task Header:

- Title: Current task name
- Status indicator:
  - "No" - Not started
  - "In progress" - Processing
  - "Task completed" - Done

### 3.2 Chat Messages:

#### User Message:

- Right-aligned
- Shows user avatar
- Timestamp

#### AI Message (Manus):

- Left-aligned
- Manus avatar with "Lite/Max" badge
- Formatted content (markdown support)
- Action buttons:
  - Copy message
  - Regenerate
  - Rate (thumbs up/down)

### 3.3 Task Progress Panel:

- Collapsible section
- Shows: "Task progress X / Y"
- List of steps with checkmarks
- Each step: `search_zagreb_weather`, `extract_information`, `send_email`

### 3.4 Manus's Computer Panel:

- Shows what Manus is currently doing
- Terminal/code display
- Action: `view_full_terminal()`

### 3.5 Message Input:

- Placeholder: "Send message to Manus"
- Same toolbar as dashboard
- Submit button

### 3.6 Task Completion:

- Green checkmark: "Task completed"
- Rating: "How was this result?" with 5 stars
- Suggested follow-ups:
  - "Explain the CodeAct architecture in more detail"
  - "Generate a presentation script..."
  - "Create slides summarizing..."

---

# 4. LIBRARY (ENHANCED WITH FOLDERS)

## Layout:

- **Header**: Filters, Search, View toggle
- **Main**: File/Folder grid or list
- **Sidebar**: Same as dashboard

## Components:

### 4.1 Filter Tabs:

| Filter       | Action               | Description          |
| ------------ | -------------------- | -------------------- |
| All          | `filter_all()`       | Show all items       |
| My favorites | `filter_favorites()` | Only favorited items |

### 4.2 Search Bar:

- Placeholder: "Search files"
- Real-time search
- Action: `search_files(query)`

### 4.3 View Toggle:

- Grid view icon
- List view icon
- Action: `toggle_view_mode()`

### 4.4 Breadcrumb Navigation (NEW - Google Drive style):

- Shows: Home > Folder1 > Folder2 > Current
- Action: `navigate_to_folder(path)`
- Back button for parent folder

### 4.5 NEW: Folder Actions Bar:

| Button     | Action              | Description                    |
| ---------- | ------------------- | ------------------------------ |
| + New      | `create_new_menu()` | Dropdown: Folder, File, Upload |
| Upload     | `upload_files()`    | File upload dialog             |
| New Folder | `create_folder()`   | Create new folder              |

### 4.6 Folder Display (NEW):

#### Folder Card:

- Folder icon
- Folder name
- Item count (e.g., "3 items")
- Last modified date
- Actions (on hover/right-click):
  - Open
  - Rename
  - Move to
  - Copy to
  - Share
  - Delete
  - Add to favorites

#### Context Menu for Folders:

| Option           | Action                          |
| ---------------- | ------------------------------- |
| Open             | `open_folder(folder_id)`        |
| Rename           | `rename_folder(folder_id)`      |
| Move to          | `move_folder_dialog(folder_id)` |
| Copy to          | `copy_folder_dialog(folder_id)` |
| Share            | `share_folder(folder_id)`       |
| Delete           | `delete_folder(folder_id)`      |
| Add to favorites | `toggle_favorite(folder_id)`    |
| Color label      | `set_folder_color(color)`       |

### 4.7 File Display:

#### File Card (Grid View):

- File type icon (based on extension)
- File name
- Preview (if available)
- Source task indicator
- "X more files" dropdown

#### File Card (List View):

- Checkbox (for multi-select)
- File icon
- File name
- Type
- Size
- Created date
- Modified date
- Owner
- Actions menu

### 4.8 File Actions (Right-click / 3-dot menu):

| Option           | Action                           | Description               |
| ---------------- | -------------------------------- | ------------------------- |
| Locate in task   | `navigate_to_task(task_id)`      | Jump to originating task  |
| Send to Manus    | `send_to_chat(file_id)`          | Attach to current chat    |
| Add to favorites | `toggle_favorite(file_id)`       | Star/unstar file          |
| Share            | `open_share_dialog(file_id)`     | Share options             |
| Download         | `download_file(file_id, format)` | Format submenu            |
| Move to          | `move_file_dialog(file_id)`      | Select destination folder |
| Copy to          | `copy_file_dialog(file_id)`      | Select destination folder |
| Rename           | `rename_file(file_id)`           | Inline rename             |
| Delete           | `delete_file(file_id)`           | Move to trash             |
| Properties       | `show_properties(file_id)`       | File details              |

### 4.9 Download Submenu:

- Markdown
- PDF
- Docs
- Original format

### 4.10 Cloud Save Options:

- Convert to Google Docs
- Save to Google Drive
- Save to OneDrive (personal)
- Save to OneDrive (work/school)

### 4.11 Drag & Drop (NEW):

- `drag_start(item)` - Begin drag
- `drag_over(folder)` - Hover over folder
- `drop(item, target_folder)` - Complete move
- Visual feedback during drag

### 4.12 Multi-Select (NEW):

- Checkbox on each item
- Select all checkbox
- Bulk actions toolbar:
  - Move to
  - Copy to
  - Download
  - Delete
  - Share
  - Add to favorites

---

# 5. SEARCH SYSTEM

## Layout:

- Modal overlay
- Search input at top
- Results grouped by time

## Components:

### 5.1 Search Input:

- Placeholder: "Search tasks..."
- Clear button (X)
- Loading indicator

### 5.2 Results Groups:

#### "New task" Option:

- Always shown at top
- Action: `create_new_task_with_query()`

#### "Today":

- Tasks from today
- Shows: Icon, Title, Subtitle, Time

#### "Yesterday":

- Tasks from yesterday

#### "Last 30 days":

- Older tasks

### 5.3 Result Item:

- Task icon (varies by type)
- Task title
- Subtitle/description
- Timestamp
- File count (if applicable)

### 5.4 Empty State:

- "No results found"
- Suggested searches

---

# 6. PROJECTS

## Layout:

- Project header with folder icon
- Instructions section
- Files section

## Components:

### 6.1 Project Header:

- Folder icon
- Project name
- Created by [user]
- Updated [date]
- Share button (top right)

### 6.2 Project Input:

- Placeholder: "Tasks are independent for focus. Use project instructions and files for shared context."
- Same toolbar as dashboard

### 6.3 Instructions Section:

- Header: "Instructions"
- Subtitle: "Add instructions to tailor Manus's responses"
- Add button (+)
- Action: `add_instruction()`

### 6.4 Files Section:

- Header: "Files"
- Subtitle: "Start by attaching files to your project."
- Add button (+)
- Shows: "0 files"
- Action: `attach_files()`

### 6.5 Privacy Note:

- "Your tasks stay private unless shared"

---

# 7. NOTIFICATIONS

## Layout:

- Full page or modal
- Tabs for different notification types

## Components:

### 7.1 Tabs:

| Tab      | Description            |
| -------- | ---------------------- |
| All      | All notifications      |
| Updates  | Product updates        |
| Messages | Collaboration messages |

### 7.2 Notification Item:

- Date header (e.g., "Jan 28, 2026")
- Thumbnail/image
- Title
- Description
- Action buttons (if applicable)

### 7.3 Notification Types:

#### Product Updates:

- New feature announcements
- Version releases
- Partnership announcements

#### Collaboration Messages:

- Access requests
- Task shares
- Comments

#### System Messages:

- Credit alerts
- Subscription reminders
- Task completions

### 7.4 Actions:

- Mark as read
- Dismiss
- View details
- Approve/Reject (for requests)

---

# 8. PROFILE & ACCOUNT

## Layout:

- Modal with sidebar navigation
- Main content area

## Components:

### 8.1 Profile Header:

- Avatar (with edit option)
- Username
- Email
- Edit profile button
- Share profile button

### 8.2 Subscription Card:

- Plan name: "Manus Pro"
- Expiration date
- Actions:
  - Manage
  - Add credits

### 8.3 Credits Display:

- Current credits: 0
- Free credits: 0
- Monthly credits: 0 / 4,000
- Daily refresh credits: 300
- Info: "Refresh to 300 at 00:00 every day"

### 8.4 Menu Items:

| Item      | Icon      | Action                    |
| --------- | --------- | ------------------------- |
| Knowledge | Lightbulb | `open_knowledge()`        |
| Account   | User      | `open_account_settings()` |
| Settings  | Sliders   | `open_settings()`         |
| Homepage  | Home      | `go_to_homepage()`        |
| Get help  | Question  | `open_help()`             |
| Sign out  | Log-out   | `sign_out()`              |

---

# 9. SETTINGS

## 9.1 Main Settings Modal

### Sidebar Menu:

| Item            | Icon        | Description              |
| --------------- | ----------- | ------------------------ |
| Account         | User        | Profile and subscription |
| Settings        | Sliders     | General settings         |
| Usage           | Chart       | Usage statistics         |
| Billing         | Credit card | Payment and invoices     |
| Scheduled tasks | Calendar    | Recurring tasks          |
| Mail Manus      | Mail        | Email integration        |
| Data controls   | Database    | Data management          |
| Cloud browser   | Cloud       | Browser settings         |
| Personalization | User-cog    | Profile customization    |
| Skills          | Sparkles    | Custom skills            |
| Connectors      | Plug        | API connectors           |
| Integrations    | Puzzle      | App integrations         |
| Get help        | Help-circle | Support                  |

### 9.2 General Settings

#### Language:

- Dropdown: English (default)
- Options: [List of supported languages]

#### Appearance:

- Light theme
- Dark theme
- Follow System

#### Communication Preferences:

- "Receive exclusive content" - Toggle
- "Email me when my queued task starts" - Toggle

#### Manage Cookies:

- Button: "Manage"
- Action: `open_cookie_settings()`

### 9.3 Account Settings

- Same as Profile section

### 9.4 Cloud Browser Settings

#### Persist Login State:

- Toggle: "Persist login state across tasks"
- Learn more link

#### Cookies and Data:

- Button: "Manage"
- Action: `manage_browser_data()`

### 9.5 Connectors

#### Connected Connectors List:

| Connector           | Description                            | Status    |
| ------------------- | -------------------------------------- | --------- |
| My Browser          | Access the web on your own browser     | Connected |
| Gmail               | Draft replies, search inbox, summarize | Connected |
| Cats Facts          | Custom API                             | Connected |
| My website database | Custom API                             | Connected |

#### Actions:

- Add connector: `+ Add connectors`
- Configure each connector
- Disconnect connector

### 9.6 Data Controls

#### Management Options:

| Section              | Action |
| -------------------- | ------ |
| My shared tasks      | Manage |
| My shared files      | Manage |
| My deployed websites | Manage |
| My purchased domains | Manage |

### 9.7 Integrations

#### Available Integrations:

| Integration          | Description                          | Action          |
| -------------------- | ------------------------------------ | --------------- |
| Build with Manus API | Use API to build custom integrations | Go to configure |
| Use Manus in Zapier  | Connect to thousands of apps         | Go to configure |
| Use Manus in Slack   | Use @Manus in Slack                  | Go to configure |

### 9.8 Mail Manus

#### Tabs: Settings | Inbox

##### Settings:

- Manus's email address (unique per user)
- Workflow email configuration
- Approved senders list
- Add approved sender button

### 9.9 Personalization

#### Tabs: Profile | Knowledge

##### Profile:

- Nickname input
- Occupation input
- "More about you" textarea (2000 chars)
- Custom Instructions textarea (3000 chars)

##### Actions:

- Cancel
- Save

### 9.10 Scheduled Tasks

#### Tabs: Scheduled | Completed

#### Scheduled List:

| Task                        | Schedule         | Status   | Actions      |
| --------------------------- | ---------------- | -------- | ------------ |
| Daily Zagreb Weather Email  | Daily at 08:00   | Enabled  | Toggle, More |
| Weekly Traffic Report       | Weekly Mon 09:00 | Enabled  | Toggle, More |
| Daily Zagreb Traffic Report | Daily at 08:00   | Disabled | Toggle, More |

#### Actions:

- New schedule button
- Enable/disable toggle
- Edit (via more menu)
- Delete (via more menu)

### 9.11 Skills

#### Header:

- Description: "Prepackaged and repeatable best practices & tools for your agents"

#### Filters:

- All type dropdown
- Search skill input
- Official library toggle

#### Skills List:

| Skill                | Description                         | Status   |
| -------------------- | ----------------------------------- | -------- |
| skill-creator        | Guide for creating effective skills | Enabled  |
| stock-analysis       | Analyze stocks using financial data | Disabled |
| similarweb-analytics | Analyze websites using SimilarWeb   | Disabled |

#### Actions:

- Add custom skills
- Enable/disable toggle
- View details (via more menu)

---

# 10. BILLING & CREDITS

## Layout:

- Modal with sidebar
- Main content area

## Components:

### 10.1 Billing Dashboard Header:

- Title: "Billing Dashboard"
- Subtitle: "Manage your subscription and credits"

### 10.2 Subscription Card:

- Plan: "Manus Pro"
- Expiration date
- Actions: Manage, Add credits

### 10.3 Credits Breakdown:

- Credits: 0
- Free credits: 0
- Monthly credits: 0 / 4,000
- Daily refresh credits: 300

### 10.4 Recent Activity:

| Date        | Amount | Action   |
| ----------- | ------ | -------- |
| Jan 9, 2026 | $20.00 | Download |
| Jan 9, 2026 | -      | Download |

### 10.5 Actions:

- View all invoices
- Download invoice

---

# 11. USAGE TRACKING

## Components:

### 11.1 Usage Summary:

- Same as credits display

### 11.2 Website Usage & Billing:

- Expandable section
- Action: `view_website_usage()`

### 11.3 Usage History Table:

| Details                                         | Date             | Credits Change |
| ----------------------------------------------- | ---------------- | -------------- |
| This task has been deleted                      | 2026-01-11 08:02 | 0              |
| This task has been deleted                      | 2026-01-10 08:11 | 0              |
| Manus.im Tech Stack and Package Details Inquiry | 2026-01-09 13:10 | -402           |

### 11.4 Pagination:

- Previous/Next buttons
- Page numbers

---

# 12. INVITATION & REFERRAL SYSTEM

## Layout:

- Modal dialog

## Components:

### 12.1 Header:

- Icon: Hand with heart
- Title: "Invite to get credits"
- Subtitle: "Share your invitation link with friends, get 500 credits each."

### 12.2 Share Link Section:

- Label: "Share your invitation link"
- URL display: `https://manus.in/invitation/[CODE]`
- Copy button

### 12.3 Email Invitation:

- Label: "Email your invitation"
- Input: "Enter email address"
- Send button

### 12.4 Invitation History:

- Credits earned: 0
- Referrals: 0

### 12.5 Actions:

- Redeem
- View invitation history

---

# 13. APPLICATIONS (COMPOSIO INTEGRATION)

## NEW PAGE - Not in original Manus

## Layout:

- Similar to Connectors page
- Grid of connected applications

## Components:

### 13.1 Header:

- Title: "Applications"
- Subtitle: "Manage your connected applications via Composio"
- Add Application button

### 13.2 Connected Apps Grid:

#### App Card:

| Element   | Description                       |
| --------- | --------------------------------- |
| App Icon  | Application logo                  |
| App Name  | e.g., "GitHub", "Notion", "Slack" |
| Status    | Connected / Disconnected          |
| Last Used | Timestamp                         |
| Actions   | Configure, Disconnect             |

### 13.3 Available Apps (Composio):

| Category      | Apps                            |
| ------------- | ------------------------------- |
| Productivity  | Notion, Asana, Trello, Monday   |
| Communication | Slack, Discord, Teams           |
| Development   | GitHub, GitLab, Jira            |
| Storage       | Google Drive, Dropbox, OneDrive |
| CRM           | Salesforce, HubSpot             |
| Marketing     | Mailchimp, SendGrid             |

### 13.4 App Configuration:

- OAuth connection flow
- Permission scopes
- Webhook settings
- Action triggers

### 13.5 Actions:

| Action                    | Description         |
| ------------------------- | ------------------- |
| `connect_app(app_id)`     | Initiate OAuth      |
| `disconnect_app(app_id)`  | Remove connection   |
| `configure_app(app_id)`   | Settings dialog     |
| `test_connection(app_id)` | Verify connectivity |
| `view_app_logs(app_id)`   | Activity logs       |

---

# 14. DEVICES (HOME ASSISTANT MCP)

## NEW PAGE - Not in original Manus

## Layout:

- Dashboard-style layout
- Device categories
- Device cards

## Components:

### 14.1 Header:

- Title: "Devices"
- Subtitle: "Manage your smart home devices via Home Assistant MCP"
- Add Device button
- Discover Devices button

### 14.2 Device Categories:

| Category    | Icon        | Description            |
| ----------- | ----------- | ---------------------- |
| Lights      | Lightbulb   | Smart lighting         |
| Switches    | Toggle      | Smart switches         |
| Sensors     | Activity    | Motion, temp, humidity |
| Climate     | Thermometer | HVAC control           |
| Media       | Speaker     | Media players          |
| Security    | Lock        | Locks, cameras         |
| Automations | Zap         | Device automations     |

### 14.3 Device Card:

| Element     | Description                     |
| ----------- | ------------------------------- |
| Device Icon | Category icon                   |
| Device Name | e.g., "Living Room Light"       |
| Entity ID   | Home Assistant entity ID        |
| Status      | On/Off/Unavailable              |
| State Info  | Brightness %, Temperature, etc. |
| Room        | Assigned room                   |
| Actions     | Toggle, Settings, More          |

### 14.4 Device Actions:

| Action                             | Description         |
| ---------------------------------- | ------------------- |
| `toggle_device(entity_id)`         | On/Off toggle       |
| `set_brightness(entity_id, value)` | 0-100%              |
| `set_color(entity_id, color)`      | RGB color           |
| `set_temperature(entity_id, temp)` | Climate control     |
| `view_history(entity_id)`          | State history       |
| `edit_device(entity_id)`           | Rename, assign room |
| `remove_device(entity_id)`         | Remove from system  |

### 14.5 Automations:

#### Automation Card:

- Name
- Trigger conditions
- Actions
- Status (Enabled/Disabled)
- Last triggered

#### Actions:

- Enable/disable
- Edit
- Delete
- Run now

### 14.6 Scenes:

- Predefined device states
- "Movie Night", "Away", "Good Morning"
- Activate scene button

### 14.7 MCP Server Status:

- Connection status indicator
- Server URL
- Reconnect button
- Logs viewer

---

# 15. SIDEBAR NAVIGATION

## 15.1 Expanded Sidebar:

| Item           | Icon     | Badge     | Action                   |
| -------------- | -------- | --------- | ------------------------ |
| New task       | Pencil   | -         | `create_new_task()`      |
| Search         | Search   | -         | `open_search()`          |
| Library        | Building | -         | `navigate_to_library()`  |
| Projects       | Folder   | -         | `navigate_to_projects()` |
| [Project Name] | Folder   | -         | `open_project(id)`       |
| All tasks      | List     | Sort icon | `view_all_tasks()`       |
| [Task 1]       | [Icon]   | -         | `open_task(id)`          |
| [Task 2]       | [Icon]   | -         | `open_task(id)`          |
| ...            | ...      | ...       | ...                      |

### 15.2 Bottom Section:

- Share Manus with a friend
- Get 500 credits each
- Action: `open_invitation()`

### 15.3 Footer Icons:

- Settings
- Grid view toggle
- Collapse sidebar

### 15.4 Collapsed Sidebar:

- Icons only
- Tooltip on hover
- Same actions as expanded

---

# STATE MANAGEMENT SUMMARY

## Global States:

- `user` - Current user object
- `subscription` - Plan details
- `credits` - Current credit balance
- `theme` - Light/dark mode
- `language` - Selected language
- `sidebar_collapsed` - Boolean
- `current_task` - Active task ID
- `notifications` - Unread count

## Page States:

- `loading` - Data fetching
- `error` - Error state with message
- `empty` - No data to display
- `success` - Operation completed
- `confirming` - Awaiting user confirmation

---

# API ENDPOINTS SUMMARY

## Authentication:

- POST `/auth/email/check`
- POST `/auth/register`
- POST `/auth/login`
- POST `/auth/verify-email`
- POST `/auth/resend-code`
- POST `/auth/forgot-password`
- POST `/auth/reset-password`

## Tasks:

- GET `/tasks`
- POST `/tasks`
- GET `/tasks/:id`
- POST `/tasks/:id/message`
- GET `/tasks/:id/progress`

## Library:

- GET `/files`
- POST `/files/upload`
- GET `/files/:id/download`
- DELETE `/files/:id`
- POST `/files/:id/move`
- POST `/files/:id/copy`
- GET `/folders`
- POST `/folders`
- PUT `/folders/:id`
- DELETE `/folders/:id`

## Search:

- GET `/search?q={query}`

## Settings:

- GET `/settings`
- PUT `/settings`
- GET `/connectors`
- POST `/connectors`
- DELETE `/connectors/:id`

## Billing:

- GET `/billing`
- GET `/billing/invoices`
- POST `/billing/credits/add`

## Applications (Composio):

- GET `/apps`
- POST `/apps/connect`
- DELETE `/apps/:id`
- GET `/apps/:id/config`

## Devices (Home Assistant):

- GET `/devices`
- GET `/devices/:entity_id`
- POST `/devices/:entity_id/command`
- GET `/devices/automations`
- POST `/devices/automations`

---

_Document Version: 1.0_
_Last Updated: 2026-02-05_
