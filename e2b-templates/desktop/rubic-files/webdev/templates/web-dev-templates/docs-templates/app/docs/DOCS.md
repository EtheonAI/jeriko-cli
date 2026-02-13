---
name: expo-sdk
description: Find the right Expo SDK module for your feature. Use this documentation directory first to discover which module to use, then read that module's DOCS.md for implementation details.
metadata:
  sdk: expo-54
  type: documentation-directory
---

# Expo SDK 54 Documentation Directory

Index of Expo SDK module documentation. Find a module here, then read its `DOCS.md`.

## How to use

Pick a module, then open `{docs-directory}/{category}/{module}/DOCS.md`.

## Index (by Category)

### navigation/

| Module | Description |
|--------|-------------|
| `navigation/linking/DOCS.md` | Handle deep links, URL schemes, and universal links. |
| `navigation/router-ui/DOCS.md` | UI components for Expo Router like Link and navigation helpers. |
| `navigation/webbrowser/DOCS.md` | Open URLs in an in-app browser or system browser. |

### storage/

| Module | Description |
|--------|-------------|
| `storage/blob/DOCS.md` | Web-standard Blob API for binary data, Base64, slicing, and preparing files for upload. |
| `storage/document-picker/DOCS.md` | Pick documents and files from the device. |
| `storage/filesystem/DOCS.md` | Read, write, and manage files in the app filesystem. |
| `storage/securestore/DOCS.md` | Securely store key-value data using device keychain/keystore. |

### media/

| Module | Description |
|--------|-------------|
| `media/asset/DOCS.md` | Load and cache bundled assets like images and fonts. |
| `media/audio/DOCS.md` | Record and play audio with full playback control. |
| `media/camera/DOCS.md` | Capture photos and videos, scan barcodes using device camera. |
| `media/font/DOCS.md` | Load and use custom fonts in the app. |
| `media/image/DOCS.md` | Display images with caching, placeholders, and transitions. |
| `media/imagemanipulator/DOCS.md` | Resize, crop, rotate, and manipulate images. |
| `media/imagepicker/DOCS.md` | Select images and videos from device library or camera. |
| `media/live-photo/DOCS.md` | Display and interact with iOS Live Photos. |
| `media/media-library/DOCS.md` | Browse device photo albums, get assets with pagination, and save media to gallery. |
| `media/video/DOCS.md` | Video playback component with controls and fullscreen. |
| `media/video-thumbnails/DOCS.md` | Generate thumbnail images from videos. |

### sensors/

| Module | Description |
|--------|-------------|
| `sensors/accelerometer/DOCS.md` | Read device acceleration and motion data. |
| `sensors/barometer/DOCS.md` | Read atmospheric pressure for altitude estimation. |
| `sensors/battery/DOCS.md` | Monitor battery level and charging state. |
| `sensors/brightness/DOCS.md` | Control and read screen brightness. |
| `sensors/devicemotion/DOCS.md` | Combined motion data from accelerometer and gyroscope. |
| `sensors/gyroscope/DOCS.md` | Read device rotation rate and orientation. |
| `sensors/light-sensor/DOCS.md` | Read ambient light level from device sensor. |
| `sensors/magnetometer/DOCS.md` | Read magnetic field data for compass functionality. |
| `sensors/pedometer/DOCS.md` | Track step count and walking/running activity. |
| `sensors/sensors/DOCS.md` | Sensors umbrella package: shared subscription patterns and utilities for all sensor modules. |

### ui/

| Module | Description |
|--------|-------------|
| `ui/blur-view/DOCS.md` | Apply blur effects to views and backgrounds. |
| `ui/glass-effect/DOCS.md` | Apply iOS-style glass morphism effects. |
| `ui/linear-gradient/DOCS.md` | Render linear gradient backgrounds. |
| `ui/mesh-gradient/DOCS.md` | Render mesh gradient backgrounds with multiple colors. |
| `ui/splash-screen/DOCS.md` | Control splash screen visibility and animations. |
| `ui/status-bar/DOCS.md` | Configure status bar style, color, and visibility. |
| `ui/system-ui/DOCS.md` | Set root view background color and lock user interface style (light/dark mode). |

### background/

| Module | Description |
|--------|-------------|
| `background/background-task/DOCS.md` | Run JavaScript tasks when app is in background. |
| `background/notifications/DOCS.md` | Schedule local and handle push notifications with actions. |
| `background/task-manager/DOCS.md` | Register and define background task handlers for location, fetch, and notifications. |

### auth/

| Module | Description |
|--------|-------------|
| `auth/apple-authentication/DOCS.md` | Sign in with Apple authentication. |
| `auth/crypto/DOCS.md` | Cryptographic functions for hashing and random values. |
| `auth/local-authentication/DOCS.md` | Biometric authentication using Face ID or fingerprint. |

### location/

| Module | Description |
|--------|-------------|
| `location/location/DOCS.md` | Get the device location and geofencing utilities. |
| `location/maps/DOCS.md` | Display maps with markers for locations and addresses. Works in Expo Go without API key. |

### network/

| Module | Description |
|--------|-------------|
| `network/cellular/DOCS.md` | Get cellular network information and carrier details. |
| `network/network/DOCS.md` | Check network connectivity and connection type. |

### communication/

| Module | Description |
|--------|-------------|
| `communication/clipboard/DOCS.md` | Read and write to system clipboard. |
| `communication/contacts/DOCS.md` | Access and manage device contacts. |
| `communication/mail-composer/DOCS.md` | Compose emails with attachments. |
| `communication/sharing/DOCS.md` | Share content via system share sheet. |
| `communication/sms/DOCS.md` | Compose and send SMS messages. |

### system/

| Module | Description |
|--------|-------------|
| `system/calendar/DOCS.md` | Access and create calendar events. |
| `system/haptics/DOCS.md` | Trigger haptic feedback and vibrations. |
| `system/keep-awake/DOCS.md` | Prevent device screen from sleeping. |
| `system/localization/DOCS.md` | Get device locale, language, and region settings. |
| `system/navigation-bar/DOCS.md` | Configure Android navigation bar appearance. |
| `system/print/DOCS.md` | Print documents and images. |
| `system/screen-capture/DOCS.md` | Detect and prevent screen recording/screenshots. |
| `system/screen-orientation/DOCS.md` | Lock and detect screen orientation changes. |
| `system/speech/DOCS.md` | Text-to-speech: convert text to spoken audio with voice selection and playback control. |
| `system/storereview/DOCS.md` | Prompt users to rate the app in app stores. |
