---
name: sharing
description: Share content via system share sheet.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Sharing

A library that provides implementing sharing files.

**Platforms:** android, ios, web

**Package:** `expo-sharing`

`expo-sharing` allows you to share files directly with other compatible applications.

## Quick Start

Here's a minimal example of how to share a simple text message:

```javascript
import { Button, View, Platform } from 'react-native';
import * as Sharing from 'expo-sharing';

export default function App() {
  const shareText = async () => {
    if (Platform.OS === 'web') {
      if (!(await Sharing.isAvailableAsync())) {
        alert(`Uh oh, sharing isn't available on your platform`);
        return;
      }
    }

    await Sharing.shareAsync('Check out this cool app!');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Share Text" onPress={shareText} />
    </View>
  );
}
```

## When to Use

Use `expo-sharing` when you want to allow users to share content from your app to other applications on their device, such as social media, messaging apps, or email clients. It's ideal for sharing text, links, and files.

## Common Pitfalls

### 1. Forgetting to Check for Web Availability

- **Problem**: The Web Share API has limited browser support. Calling `shareAsync` on an unsupported browser will fail.
- **Solution**: Always check for availability on the web before attempting to share.

```javascript
if (Platform.OS === 'web') {
  if (!(await Sharing.isAvailableAsync())) {
    alert(`Uh oh, sharing isn't available on your platform`);
    return;
  }
}
await Sharing.shareAsync('My message');
```

### 2. Trying to Share a Local File URI on Web

- **Problem**: Sharing local file URIs is not supported on the web. The `shareAsync` method will not work with a `file://` URI in a web browser.
- **Solution**: For web, you must first upload the file to a server and then share the resulting remote URL.

## Common Patterns

### Sharing a Local File

This pattern demonstrates how to create a local file using `expo-file-system` and then share it.

```javascript
import { Button, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

export default function App() {
  const shareFile = async () => {
    const fileUri = FileSystem.documentDirectory + 'test.txt';
    await FileSystem.writeAsStringAsync(fileUri, 'This is a test file.');

    if (!(await Sharing.isAvailableAsync())) {
      alert(`Uh oh, sharing isn't available on your platform`);
      return;
    }

    await Sharing.shareAsync(fileUri);
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Share File" onPress={shareFile} />
    </View>
  );
}
```

#### Sharing limitations on web

- `expo-sharing` for web is built on top of the Web Share API, which still has [very limited browser support](https://caniuse.com/#feat=web-share). Be sure to check that the API can be used before calling it by using `Sharing.isAvailableAsync()`.
- **HTTPS required on web**: The Web Share API is only available on web when the page is served over https. Run your app with `npx expo start --tunnel` to enable it.
- **No local file sharing on web**: Sharing local files by URI works on Android and iOS, but not on web. You cannot share local files on web by URI &mdash; you will need to upload them somewhere and share that URI.

#### Sharing to your app from other apps

Currently `expo-sharing` only supports sharing _from your app to other apps_ and you cannot register to your app to have content shared to it through the native share dialog on native platforms. You can read more [in the related feature request](https://expo.canny.io/feature-requests/p/share-extension-ios-share-intent-android). You can setup this functionality manually in Xcode and Android Studio and create an [Expo Config Plugin](/config-plugins/introduction/) to continue using [Expo Prebuild](/workflow/prebuild).

## Installation

```bash
$ npx expo install expo-sharing
```

## API

```js
import * as Sharing from 'expo-sharing';
```

## API Reference

### Methods

#### isAvailableAsync

Determine if the sharing API can be used in this app.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise that fulfills with `true` if the sharing API can be used, and `false` otherwise.

#### shareAsync

Opens action sheet to share file to different applications which can handle this type of file.

```typescript
shareAsync(url: string, options: SharingOptions): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | Local file URL to share. |
| `options` | `SharingOptions` | A map of share options. |

### Types

#### SharingOptions

| Property | Type | Description |
| --- | --- | --- |
| `anchor` | `{ height: number; width: number; x: number; y: number }` | set the anchor point for iPad |
| `dialogTitle` | `string` | Sets share dialog title. |
| `mimeType` | `string` | Sets `mimeType` for `Intent`. |
| `UTI` | `string` | [Uniform Type Identifier](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/understanding_utis/understand_utis_conc/understand_utis_conc.html) - the type of the target file. |
