---
name: screen-capture
description: Detect and prevent screen recording/screenshots.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# ScreenCapture

A library that allows you to protect screens in your app from being captured or recorded.

**Platforms:** android, ios

**Package:** `expo-screen-capture`

`expo-screen-capture` allows you to protect screens in your app from being captured or recorded, as well as be notified if a screenshot is taken while your app is foregrounded. The two most common reasons you may want to prevent screen capture are:

- If a screen is displaying sensitive information (password, credit card data, and so on)
- You are displaying paid content that you don't want to be recorded and shared

This is especially important on Android since the [`android.media.projection`](https://developer.android.com/about/versions/android-5.0.html#ScreenCapture) API allows third-party apps to perform screen capture or screen sharing (even if the app is in the background).

## Quick Start

Here's a minimal example of how to prevent screen capture in your app. This component will block screenshots and recordings as long as it is mounted.

```jsx
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Text, View, Platform } from 'react-native';

export default function App() {
  if (Platform.OS !== 'web') {
    // This hook is not supported on web.
    usePreventScreenCapture();
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>This screen is protected from screen capture.</Text>
    </View>
  );
}
```

## When to Use

Use this module whenever you need to protect sensitive information or paid content from being captured. It's ideal for screens that display financial data, personal details, or exclusive media.

## Common Pitfalls

### 1. Forgetting to Handle Web

**Problem**: The `usePreventScreenCapture` hook will throw an error on web because it's not supported.

**Solution**: Always wrap the hook in a `Platform.OS` check to ensure it only runs on native platforms (iOS and Android).

```jsx
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

export default function SecureScreen() {
  if (Platform.OS !== 'web') {
    usePreventScreenCapture();
  }
  // ...
}
```

### 2. Misunderstanding Screenshot Listener Permissions

**Problem**: The `addScreenshotListener` requires specific permissions on older Android versions, and developers often forget to request them, leading to the listener not firing.

**Solution**: On Android 13 and lower, you must request `READ_MEDIA_IMAGES` permission. On Android 14 and higher, no permissions are needed.

```jsx
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export default function ScreenshotDetector() {
  useEffect(() => {
    const subscription = ScreenCapture.addScreenshotListener(() => {
      alert('Screenshot taken!');
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // ...
}
```

## Common Patterns

### 1. Conditionally Protecting Screens

This pattern shows how to protect a screen based on a certain condition (e.g., user role or content type).

```jsx
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Platform } from 'react-native';

export default function ConditionallySecureScreen({ isProtected }) {
  if (Platform.OS !== 'web' && isProtected) {
    usePreventScreenCapture();
  }

  return (
    <View>
      {isProtected ? <Text>Protected Content</Text> : <Text>Public Content</Text>}
    </View>
  );
}
```

On Android, the screen capture callback works without additional permissions only for Android 14+. **You don't need to request or check permissions for blocking screen capture or using the callback on Android 14+.**

If you want to use the screen capture callback on Android 13 or lower, you need to add the `READ_MEDIA_IMAGES` permission to your **AndroidManifest.xml** file. You can use the `android.permissions` key in your app config. See [Android permissions](/guides/permissions/#android) for more information.

> **warning** The `READ_MEDIA_IMAGES` permission can be added only for apps needing broad access to photos. See [Details on Google Play's Photo and Video Permissions policy](https://support.google.com/googleplay/android-developer/answer/14115180).

> **important** For testing screen capture functionality: On Android Emulator, run `adb shell input keyevent 120` in a separate terminal to trigger a screenshot. On iOS Simulator, you can trigger screenshots using **Device** > **Trigger Screenshot** from the menu bar.

## Installation

```bash
$ npx expo install expo-screen-capture
```

## Usage

### Example: hook

```jsx
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Text, View } from 'react-native';

export default function ScreenCaptureExample() {
  usePreventScreenCapture();

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>As long as this component is mounted, this screen is unrecordable!</Text>
    </View>
  );
}
```

### Example: Blocking screen capture imperatively

```jsx
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Button, StyleSheet, View } from 'react-native';

export default function ScreenCaptureExample() {
  const activate = async () => {
    await ScreenCapture.preventScreenCaptureAsync();
  };

  const deactivate = async () => {
    await ScreenCapture.allowScreenCaptureAsync();
  };

  return (
    <View style={styles.container}>
      <Button title="Activate" onPress={activate} />
      <Button title="Deactivate" onPress={deactivate} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

### Example: Callback for screen capture

```jsx
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect } from 'react';
import { Button, StyleSheet, View } from 'react-native';

export default function useScreenCaptureCallback() {
  // Only use this if you add the READ_MEDIA_IMAGES permission to your AndroidManifest.xml
  const hasPermissions = async () => {
    const { status } = await ScreenCapture.requestPermissionsAsync();
    return status === 'granted';
  };

  useEffect(() => {
    let subscription;

    const addListenerAsync = async () => {
      if (await hasPermissions()) {
        subscription = ScreenCapture.addScreenshotListener(() => {
          alert('Thanks for screenshotting my beautiful app 😊');
        });
      } else {
        console.error('Permissions needed to subscribe to screenshot events are missing!');
      }
    };
    addListenerAsync();

    return () => {
      subscription?.remove();
    };
  }, []);
}
```

## API

```js
import * as ScreenCapture from 'expo-screen-capture';
```

## API Reference

### Methods

#### addScreenshotListener

Adds a listener that will fire whenever the user takes a screenshot while the app is foregrounded.

Permission requirements for this method depend on your device’s Android version:
- **Before Android 13**: Requires `READ_EXTERNAL_STORAGE`.
- **Android 13**: Switches to `READ_MEDIA_IMAGES`.
- **Post-Android 13**: No additional permissions required.
You can request the appropriate permissions by using [`MediaLibrary.requestPermissionsAsync()`]().

```typescript
addScreenshotListener(listener: () => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `() => void` | The function that will be executed when the user takes a screenshot. This function accepts no arguments. |

**Returns:** A `Subscription` object that you can use to unregister the listener, either by calling
`remove()` or passing it to `removeScreenshotListener`.

#### allowScreenCaptureAsync

Re-allows the user to screen record or screenshot your app. If you haven't called
`preventScreenCapture()` yet, this method does nothing.

```typescript
allowScreenCaptureAsync(key: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `key` | `string` | This will prevent multiple instances of the `preventScreenCaptureAsync` and `allowScreenCaptureAsync` methods from conflicting with each other. If provided, the value must be the same as the key passed to `preventScreenCaptureAsync` in order to re-enable screen capturing. |

#### disableAppSwitcherProtectionAsync

Disables the privacy protection overlay that was previously enabled with `enableAppSwitcherProtectionAsync`.

**Platform:** ios

```typescript
disableAppSwitcherProtectionAsync(): Promise<void>
```

#### enableAppSwitcherProtectionAsync

Enables a privacy protection blur overlay that hides sensitive content when the app is not in focus.
The overlay applies a customizable blur effect when the app is in the app switcher, background, or during interruptions
(calls, Siri, Control Center, etc.), and automatically removes it when the app becomes active again.

This provides visual privacy protection by preventing sensitive app content from being visible in:
- App switcher previews
- Background app snapshots
- Screenshots taken during inactive states

For Android, app switcher protection is automatically provided by `preventScreenCaptureAsync()`
using the FLAG_SECURE window flag, which shows a blank screen in the recent apps preview.

**Platform:** ios

```typescript
enableAppSwitcherProtectionAsync(blurIntensity: number): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `blurIntensity` | `number` | The intensity of the blur effect, from 0.0 (no blur) to 1.0 (maximum blur). Default is 0.5. |

#### getPermissionsAsync

Checks user's permissions for detecting when a screenshot is taken.
> Only Android requires additional permissions to detect screenshots. On iOS devices, this method will always resolve to a `granted` permission response.

```typescript
getPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that resolves to a [`PermissionResponse`](#permissionresponse) object.

#### isAvailableAsync

Returns whether the Screen Capture API is available on the current device.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise that resolves to a `boolean` indicating whether the Screen Capture API is available on the current
device.

#### preventScreenCaptureAsync

Prevents screenshots and screen recordings until `allowScreenCaptureAsync` is called or the app is restarted. If you are
already preventing screen capture, this method does nothing (unless you pass a new and unique `key`).

> On iOS, this prevents screen recordings and screenshots, and is only available on iOS 11+ (recordings) and iOS 13+ (screenshots). On older
iOS versions, this method does nothing.

**Platform:** android

```typescript
preventScreenCaptureAsync(key: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `key` | `string` | Optional. If provided, this will help prevent multiple instances of the `preventScreenCaptureAsync` and `allowScreenCaptureAsync` methods (and `usePreventScreenCapture` hook) from conflicting with each other. When using multiple keys, you'll have to re-allow each one in order to re-enable screen capturing. |

#### removeScreenshotListener

Removes the subscription you provide, so that you are no longer listening for screenshots.
You can also call `remove()` on that `Subscription` object.

```typescript
removeScreenshotListener(subscription: EventSubscription): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `subscription` | `EventSubscription` | Subscription returned by `addScreenshotListener`. |

#### requestPermissionsAsync

Asks the user to grant permissions necessary for detecting when a screenshot is taken.
> Only Android requires additional permissions to detect screenshots. On iOS devices, this method will always resolve to a `granted` permission response.

```typescript
requestPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that resolves to a [`PermissionResponse`](#permissionresponse) object.

#### usePermissions

```typescript
usePermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PermissionHookOptions<object>` | - |

#### usePreventScreenCapture

A React hook to prevent screen capturing for as long as the owner component is mounted.

```typescript
usePreventScreenCapture(key: string): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `key` | `string` | If provided, this will prevent multiple instances of this hook or the `preventScreenCaptureAsync` and `allowScreenCaptureAsync` methods from conflicting with each other. This argument is useful if you have multiple active components using the `allowScreenCaptureAsync` hook. |

#### useScreenshotListener

A React hook that listens for screenshots taken while the component is mounted.

```typescript
useScreenshotListener(listener: () => void): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `() => void` | A function that will be called whenever a screenshot is detected. This hook automatically starts listening when the component mounts, and stops listening when the component unmounts. |

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types

#### PermissionHookOptions

**Type:** `unknown`

#### PermissionResponse

An object obtained by permissions get and request functions.

| Property | Type | Description |
| --- | --- | --- |
| `canAskAgain` | `boolean` | Indicates if user can be asked again for specific permission. If not, one should be directed to the Settings app in order to enable/disable the permission. |
| `expires` | `PermissionExpiration` | Determines time when the permission expires. |
| `granted` | `boolean` | A convenience boolean that indicates if the permission is granted. |
| `status` | `PermissionStatus` | Determines the status of the permission. |

### Enums

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |
