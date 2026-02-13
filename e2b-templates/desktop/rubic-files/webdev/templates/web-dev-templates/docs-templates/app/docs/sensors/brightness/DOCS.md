---
name: brightness
description: Control and read screen brightness.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Brightness

A library that provides access to an API for getting and setting the screen brightness.

**Platforms:** android, ios

**Package:** `expo-brightness`

An API to get and set screen brightness.

On Android, there is a global system-wide brightness setting, and each app has its own brightness setting that can optionally override the global setting. It is possible to set either of these values with this API. On iOS, the system brightness setting cannot be changed programmatically; instead, any changes to the screen brightness will persist until the device is locked or powered off.

## Installation

```bash
$ npx expo install expo-brightness
```

## Configuration

### Android permissions (system brightness)

To change **system** brightness on Android (e.g. `setSystemBrightnessAsync`, `setSystemBrightnessModeAsync`) you need `android.permission.WRITE_SETTINGS`.

- If you're using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)), this is typically handled automatically.
- If you're not using CNG or you're using a native Android project manually, add the permission to **AndroidManifest.xml**:

**Example:** android/app/src/main/AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.WRITE_SETTINGS" />
```

## Usage

### Basic usage (read + set app brightness)

Brightness values are floats in the range `0` (minimum) to `1` (maximum).

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Button, Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

export default function BrightnessScreen() {
  const [brightness, setBrightness] = useState<number>(0);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  useEffect(() => {
    if (Platform.OS === 'web') return null;

    (async () => {
      const { status } = await Brightness.requestPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        const currentBrightness = await Brightness.getBrightnessAsync();
        setBrightness(currentBrightness);
      }
    })();
  }, []);

  const increaseBrightness = async () => {
    if (!hasPermission) return null;
    const next = Math.min(brightness + 0.1, 1);
    await Brightness.setBrightnessAsync(next);
    setBrightness(next);
  };

  const decreaseBrightness = async () => {
    if (!hasPermission) return null;
    const next = Math.max(brightness - 0.1, 0);
    await Brightness.setBrightnessAsync(next);
    setBrightness(next);
  };

  if (Platform.OS === 'web') {
    return <Text>Brightness API not supported on web</Text>;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>
        Brightness: {(brightness * 100).toFixed(0)}%
      </Text>
      <Button title="Increase" onPress={increaseBrightness} />
      <View style={{ height: 10 }} />
      <Button title="Decrease" onPress={decreaseBrightness} />
    </View>
  );
}
```

### App brightness vs system brightness (Android)

- `setBrightnessAsync(...)`: sets **app/activity** brightness (foreground override).
- `setSystemBrightnessAsync(...)`: sets **global system** brightness (requires `WRITE_SETTINGS` + permission grant).

## Common patterns

### Brightness slider

This is a good UI pattern for user-controlled brightness overrides.

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import * as Brightness from 'expo-brightness';
import Slider from '@react-native-community/slider';

export function BrightnessSlider() {
  const [brightness, setBrightness] = useState(0.5);
  const [hasPermission, setHasPermission] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return null;

    (async () => {
      const { status } = await Brightness.requestPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        const current = await Brightness.getBrightnessAsync();
        setBrightness(current);
      }
    })();
  }, []);

  const handleBrightnessChange = async (value: number) => {
    setBrightness(value);
    if (hasPermission) {
      await Brightness.setBrightnessAsync(value);
    }
  };

  if (Platform.OS === 'web' || !hasPermission) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Brightness: {(brightness * 100).toFixed(0)}%</Text>
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={1}
        value={brightness}
        onValueChange={handleBrightnessChange}
        minimumTrackTintColor="#007AFF"
        maximumTrackTintColor="#E0E0E0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  slider: {
    width: '100%',
    height: 40,
  },
});
```

### Auto-brightness for specific content (restore on cleanup)

When you temporarily override brightness (e.g. a video player, reading mode), always restore the original value.

```tsx
import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

export function useAutoBrightness(target: number | null) {
  useEffect(() => {
    if (Platform.OS === 'web') return null;
    if (target == null) return null;

    let original: number | undefined;
    let cancelled = false;

    (async () => {
      const { status } = await Brightness.getPermissionsAsync();
      if (status !== 'granted') return null;

      original = await Brightness.getBrightnessAsync();
      if (cancelled) return null;

      await Brightness.setBrightnessAsync(Math.min(Math.max(target, 0), 1));
    })();

    return () => {
      cancelled = true;
      if (original != null) {
        Brightness.setBrightnessAsync(original);
      }
    };
  }, [target]);
}
```

### Reading mode toggle

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Switch, Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

export function ReadingMode() {
  const [readingMode, setReadingMode] = useState(false);
  const [originalBrightness, setOriginalBrightness] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') return null;

    if (readingMode) {
      (async () => {
        const current = await Brightness.getBrightnessAsync();
        setOriginalBrightness(current);
        await Brightness.setBrightnessAsync(0.4);
      })();
    } else if (originalBrightness !== null) {
      Brightness.setBrightnessAsync(originalBrightness);
    }
  }, [readingMode, originalBrightness]);

  if (Platform.OS === 'web') return null;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20 }}>
      <Text style={{ flex: 1 }}>Reading Mode</Text>
      <Switch value={readingMode} onValueChange={setReadingMode} />
    </View>
  );
}
```

### System vs app brightness toggle (Android)

```tsx
import { useState, useEffect } from 'react';
import { View, Text, Switch, Platform, StyleSheet } from 'react-native';
import * as Brightness from 'expo-brightness';

export function BrightnessSettings() {
  const [useSystemBrightness, setUseSystemBrightness] = useState(true);
  const [systemBrightness, setSystemBrightness] = useState(0.5);

  useEffect(() => {
    if (Platform.OS !== 'android') return null;

    (async () => {
      const { status } = await Brightness.requestPermissionsAsync();
      if (status !== 'granted') return null;

      const isUsingSystem = await Brightness.isUsingSystemBrightnessAsync();
      setUseSystemBrightness(isUsingSystem);

      const sys = await Brightness.getSystemBrightnessAsync();
      setSystemBrightness(sys);
    })();
  }, []);

  const toggle = async (value: boolean) => {
    if (Platform.OS !== 'android') return null;

    setUseSystemBrightness(value);
    if (value) {
      await Brightness.useSystemBrightnessAsync();
    } else {
      await Brightness.setBrightnessAsync(0.5);
    }
  };

  if (Platform.OS !== 'android') return null;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.label}>Use system brightness</Text>
        <Switch value={useSystemBrightness} onValueChange={toggle} />
      </View>
      <Text style={styles.info}>System: {(systemBrightness * 100).toFixed(0)}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: { fontSize: 16 },
  info: { fontSize: 14, color: '#666' },
});
```

## Best practices

1. Always check/request permissions before calling system-brightness APIs.
2. Guard calls on unsupported platforms (web).
3. Save and restore the original brightness for temporary overrides.
4. Prefer user-controlled UI (slider/toggle) over forcing changes silently.
5. Keep brightness overrides contextual (reading mode, media playback, etc.).
6. Test on real devices (simulators may not reflect true behavior).

## Platform-specific behavior

### iOS

- You cannot change the system brightness programmatically.
- `setBrightnessAsync` changes are temporary and revert after lock/power off.

### Android

- Supports app/activity brightness and (with permissions) system brightness.
- `setSystemBrightnessAsync` and `setSystemBrightnessModeAsync` require `WRITE_SETTINGS`.
- Use `useSystemBrightnessAsync()` / `restoreSystemBrightnessAsync()` to revert to system settings.

## Error handling helper

```tsx
import { Platform } from 'react-native';
import * as Brightness from 'expo-brightness';

export async function safeSetBrightness(value: number): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const { status } = await Brightness.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Brightness.requestPermissionsAsync();
      if (newStatus !== 'granted') return false;
    }

    await Brightness.setBrightnessAsync(Math.min(Math.max(value, 0), 1));
    return true;
  } catch {
    return false;
  }
}
```

## Notes

- Brightness values range from `0` to `1`.
- Web is not supported (use `Platform` guards).
- iOS brightness changes are temporary and revert after lock/power off.
- Android system brightness changes require `WRITE_SETTINGS` and explicit permission grant.

## API

```js
import * as Brightness from 'expo-brightness';
```

## Error codes

### `ERR_BRIGHTNESS`

An error occurred when getting or setting the app brightness.

### `ERR_BRIGHTNESS_MODE`

An error occurred when getting or setting the system brightness mode. See the `nativeError` property of the thrown error for more information.

### `ERR_BRIGHTNESS_PERMISSIONS_DENIED`

An attempt to set the system brightness was made without the proper permissions from the user. The user did not grant `SYSTEM_BRIGHTNESS` permissions.

### `ERR_BRIGHTNESS_SYSTEM`

An error occurred when getting or setting the system brightness.

### `ERR_INVALID_ARGUMENT`

An invalid argument was passed. Only `BrightnessMode.MANUAL` or `BrightnessMode.AUTOMATIC` are allowed.

## Permissions

### Android

System brightness APIs require `android.permission.WRITE_SETTINGS` (see [Configuration](#configuration)). In managed/CNG workflows this may be handled by config/plugins; in bare projects add the permission to your native `AndroidManifest.xml`.

### iOS

_No permissions required_.

## API Reference

### Methods

#### addBrightnessListener

Subscribe to brightness (iOS) updates. The event fires whenever
the power mode is toggled.

On web and android the event never fires.

**Platform:** ios

```typescript
addBrightnessListener(listener: (event: BrightnessEvent) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: BrightnessEvent) => void` | A callback that is invoked when brightness (iOS) changes. The callback is provided a single argument that is an object with a `brightness` key. |

**Returns:** A `Subscription` object on which you can call `remove()` to unsubscribe from the listener.

#### getBrightnessAsync

Gets the current brightness level of the device's main screen.

```typescript
getBrightnessAsync(): Promise<number>
```

**Returns:** A `Promise` that fulfils with a number between `0` and `1`, inclusive, representing the
current screen brightness.

#### getPermissionsAsync

Checks user's permissions for accessing system brightness.

```typescript
getPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that fulfils with an object of type [PermissionResponse](#permissionresponse).

#### getSystemBrightnessAsync

Gets the global system screen brightness.

**Platform:** android

```typescript
getSystemBrightnessAsync(): Promise<number>
```

**Returns:** A `Promise` that is resolved with a number between `0` and `1`, inclusive, representing
the current system screen brightness.

#### getSystemBrightnessModeAsync

Gets the system brightness mode (e.g. whether or not the OS will automatically
adjust the screen brightness depending on ambient light).

**Platform:** android

```typescript
getSystemBrightnessModeAsync(): Promise<BrightnessMode>
```

**Returns:** A `Promise` that fulfils with a [`BrightnessMode`](#brightnessmode). Requires
`SYSTEM_BRIGHTNESS` permissions.

#### isAvailableAsync

Returns whether the Brightness API is enabled on the current device. This does not check the app
permissions.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** Async `boolean`, indicating whether the Brightness API is available on the current device.
Currently this resolves `true` on iOS and Android only.

#### isUsingSystemBrightnessAsync

Returns a boolean specifying whether or not the current activity is using the
system-wide brightness value.

**Platform:** android

```typescript
isUsingSystemBrightnessAsync(): Promise<boolean>
```

**Returns:** A `Promise` that fulfils with `true` when the current activity is using the system-wide
brightness value, and `false` otherwise.

#### requestPermissionsAsync

Asks the user to grant permissions for accessing system brightness.

```typescript
requestPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that fulfils with an object of type [PermissionResponse](#permissionresponse).

#### restoreSystemBrightnessAsync

Resets the brightness setting of the current activity to use the system-wide
brightness value rather than overriding it.

**Platform:** android

```typescript
restoreSystemBrightnessAsync(): Promise<void>
```

**Returns:** A `Promise` that fulfils when the setting has been successfully changed.

#### setBrightnessAsync

Sets the current screen brightness. On iOS, this setting will persist until the device is locked,
after which the screen brightness will revert to the user's default setting. On Android, this
setting only applies to the current activity; it will override the system brightness value
whenever your app is in the foreground.

```typescript
setBrightnessAsync(brightnessValue: number): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `brightnessValue` | `number` | A number between `0` and `1`, inclusive, representing the desired screen brightness. |

**Returns:** A `Promise` that fulfils when the brightness has been successfully set.

#### setSystemBrightnessAsync

Sets the global system screen brightness and changes the brightness mode to
`MANUAL`. Requires `SYSTEM_BRIGHTNESS` permissions.

**Platform:** android

```typescript
setSystemBrightnessAsync(brightnessValue: number): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `brightnessValue` | `number` | A number between `0` and `1`, inclusive, representing the desired screen brightness. |

**Returns:** A `Promise` that fulfils when the brightness has been successfully set.

#### setSystemBrightnessModeAsync

Sets the system brightness mode.

**Platform:** android

```typescript
setSystemBrightnessModeAsync(brightnessMode: BrightnessMode): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `brightnessMode` | `BrightnessMode` | One of `BrightnessMode.MANUAL` or `BrightnessMode.AUTOMATIC`. The system brightness mode cannot be set to `BrightnessMode.UNKNOWN`. |

#### usePermissions

```typescript
usePermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PermissionHookOptions<object>` | - |

#### useSystemBrightnessAsync

**Platform:** android

```typescript
useSystemBrightnessAsync(): Promise<void>
```

### Types

#### BrightnessEvent

| Property | Type | Description |
| --- | --- | --- |
| `brightness` | `number` | A number between `0` and `1`, inclusive, representing the current screen brightness. |

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

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

#### BrightnessMode

| Value | Description |
| --- | --- |
| `AUTOMATIC` | Mode in which the device OS will automatically adjust the screen brightness depending on the ambient light. |
| `MANUAL` | Mode in which the screen brightness will remain constant and will not be adjusted by the OS. |
| `UNKNOWN` | Means that the current brightness mode cannot be determined. |

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |
