---
name: screen-orientation
description: Lock and detect screen orientation changes.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# ScreenOrientation

A universal library for managing a device's screen orientation.

**Platforms:** android, ios, web

**Package:** `expo-screen-orientation`

Screen Orientation is defined as the orientation in which graphics are painted on the device. For example, the figure below has a device in a vertical and horizontal physical orientation, but a portrait screen orientation. For physical device orientation, see the orientation section of [Device Motion](devicemotion.mdx).

On both Android and iOS platforms, changes to the screen orientation will override any system settings or user preferences. On Android, it is possible to change the screen orientation while taking the user's preferred orientation into account. On iOS, user and system settings are not accessible by the application and any changes to the screen orientation will override existing settings.

> Web has [limited support](https://caniuse.com/#feat=deviceorientation).

## Quick Start

Here's a minimal example of how to lock the screen orientation to landscape and listen for orientation changes.

```jsx
import React, { useEffect, useState } from 'react';
import { Button, View, Text, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function App() {
  const [orientation, setOrientation] = useState(null);

  useEffect(() => {
    const subscription = ScreenOrientation.addOrientationChangeListener(
      (evt) => {
        setOrientation(evt.orientationInfo.orientation);
      }
    );

    (async () => {
      const currentOrientation = await ScreenOrientation.getOrientationAsync();
      setOrientation(currentOrientation);
    })();

    return () => {
      ScreenOrientation.removeOrientationChangeListener(subscription);
    };
  }, []);

  const lockToLandscape = async () => {
    if (Platform.OS !== 'web') {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE_LEFT
      );
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Current Orientation: {orientation}</Text>
      <Button title="Lock to Landscape Left" onPress={lockToLandscape} />
    </View>
  );
}
```

## When to Use

Use the `expo-screen-orientation` module when you need to control the screen orientation of your app, such as locking it to portrait or landscape mode for games, video players, or other specific UI requirements. It is also useful for detecting orientation changes to adapt your layout accordingly.

## Common Pitfalls

### 1. Forgetting to handle web compatibility

**Problem**: The `lockAsync` method is not supported on the web. Calling it without a platform check will result in an error.

**Solution**: Always wrap calls to `lockAsync` and other platform-specific methods in a `Platform.OS` check.

```jsx
import { Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

const lockOrientation = async () => {
  if (Platform.OS !== 'web') {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {
      console.error(e);
    }
  }
};
```

### 2. Not removing orientation change listeners

**Problem**: Failing to remove orientation change listeners can lead to memory leaks and unexpected behavior, especially when the component unmounts.

**Solution**: Always remove the listener in the `useEffect` cleanup function.

```jsx
useEffect(() => {
  const subscription = ScreenOrientation.addOrientationChangeListener(handleOrientationChange);
  return () => {
    ScreenOrientation.removeOrientationChangeListener(subscription);
  };
}, []);
```

## Common Patterns

### 1. Locking and Unlocking Orientation on a Specific Screen

This pattern is useful for screens that require a specific orientation, like a video player or a signature pad.

```jsx
import React from 'react';
import { View, Button, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useFocusEffect } from '@react-navigation/native';

function VideoPlayerScreen() {
  useFocusEffect(
    React.useCallback(() => {
      const lockOrientation = async () => {
        if (Platform.OS !== 'web') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        }
      };

      lockOrientation();

      return () => {
        if (Platform.OS !== 'web') {
          ScreenOrientation.unlockAsync();
        }
      };
    }, [])
  );

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      {/* Your video player component */}
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-screen-orientation
```

### Warning

Apple added support for _split view_ mode to iPads in iOS 9. This changed how the screen orientation is handled by the system. To put the matter shortly, for iOS, your iPad is always in landscape mode unless you open two applications side by side. To be able to lock screen orientation using this module you will need to disable support for this feature. For more information about the _split view_ mode, check out [the official Apple documentation](https://support.apple.com/en-us/HT207582).

## Configuration in app config

You can configure `expo-screen-orientation` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "ios": {
      "requireFullScreen": true
    },
    "plugins": [
      [
        "expo-screen-orientation",
        {
          "initialOrientation": "DEFAULT"
        }
      ]
    ]
  }
}
```

1. Open the **ios** directory in Xcode with `xed ios`. If you don't have the directory, run `npx expo prebuild -p ios` to generate one.
2. Tick the `Requires Full Screen` checkbox in Xcode. It should be located under **Project Target** > **General** > **Deployment Info**.

## API

```js

```

## API Reference

### Methods

#### addOrientationChangeListener

Invokes the `listener` function when the screen orientation changes from `portrait` to `landscape`
or from `landscape` to `portrait`. For example, it won't be invoked when screen orientation
change from `portrait up` to `portrait down`, but it will be called when there was a change from
`portrait up` to `landscape left`.

```typescript
addOrientationChangeListener(listener: OrientationChangeListener): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `OrientationChangeListener` | Each orientation update will pass an object with the new [`OrientationChangeEvent`](#orientationchangeevent) to the listener. |

#### getOrientationAsync
Gets the current screen orientation.

```typescript
getOrientationAsync(): Promise<Orientation>
```

**Returns:** Returns a promise that fulfils with an [`Orientation`](#orientation)
value that reflects the current screen orientation.

#### getOrientationLockAsync

Gets the current screen orientation lock type.

```typescript
getOrientationLockAsync(): Promise<OrientationLock>
```

**Returns:** Returns a promise which fulfils with an [`OrientationLock`](#orientationlock)
value.

#### getPlatformOrientationLockAsync

Gets the platform specific screen orientation lock type.

```typescript
getPlatformOrientationLockAsync(): Promise<PlatformOrientationInfo>
```

**Returns:** Returns a promise which fulfils with a [`PlatformOrientationInfo`](#platformorientationinfo)
value.

#### lockAsync

Lock the screen orientation to a particular `OrientationLock`.

```typescript
lockAsync(orientationLock: OrientationLock): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `orientationLock` | `OrientationLock` | The orientation lock to apply. See the [`OrientationLock`](#orientationlock) enum for possible values. |

**Returns:** Returns a promise with `void` value, which fulfils when the orientation is set.

#### lockPlatformAsync

```typescript
lockPlatformAsync(options: PlatformOrientationInfo): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PlatformOrientationInfo` | The platform specific lock to apply. See the [`PlatformOrientationInfo`](#platformorientationinfo) object type for the different platform formats. |

**Returns:** Returns a promise with `void` value, resolving when the orientation is set and rejecting
if an invalid option or value is passed.

#### removeOrientationChangeListener

Unsubscribes the listener associated with the `Subscription` object from all orientation change
updates.

```typescript
removeOrientationChangeListener(subscription: EventSubscription): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `subscription` | `EventSubscription` | A subscription object that manages the updates passed to a listener function on an orientation change. |

#### removeOrientationChangeListeners

Removes all listeners subscribed to orientation change updates.

```typescript
removeOrientationChangeListeners(): void
```

#### supportsOrientationLockAsync
Returns whether the [`OrientationLock`](#orientationlock) policy is supported on
the device.

```typescript
supportsOrientationLockAsync(orientationLock: OrientationLock): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `orientationLock` | `OrientationLock` | - |

**Returns:** Returns a promise that resolves to a `boolean` value that reflects whether or not the
orientationLock is supported.

#### unlockAsync

Sets the screen orientation back to the `OrientationLock.DEFAULT` policy.

```typescript
unlockAsync(): Promise<void>
```

**Returns:** Returns a promise with `void` value, which fulfils when the orientation is set.

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types

#### OrientationChangeEvent

| Property | Type | Description |
| --- | --- | --- |
| `orientationInfo` | `ScreenOrientationInfo` | The current `ScreenOrientationInfo` of the device. |
| `orientationLock` | `OrientationLock` | The current `OrientationLock` of the device. |

#### OrientationChangeListener

**Type:** `(event: OrientationChangeEvent) => void`

#### PlatformOrientationInfo

| Property | Type | Description |
| --- | --- | --- |
| `screenOrientationArrayIOS` | `Orientation[]` | An array of orientations to allow on the iOS platform. |
| `screenOrientationConstantAndroid` | `number` | A constant to set using the Android native [API](https://developer.android.com/reference/android/R.attr#screenOrientation). For example, in order to set the lock policy to [unspecified](https://developer.android.com/reference/android/content/pm/ActivityInfo.html#SCREEN_ORIENTATION_UNSPECIFIED), `-1` should be passed in. |
| `screenOrientationLockWeb` | `WebOrientationLock` | A web orientation lock to apply in the browser. |

#### ScreenOrientationInfo

| Property | Type | Description |
| --- | --- | --- |
| `horizontalSizeClass` | `SizeClassIOS` | The [horizontal size class](https://developer.apple.com/documentation/uikit/uitraitcollection/1623508-horizontalsizeclass) of the device. |
| `orientation` | `Orientation` | The current orientation of the device. |
| `verticalSizeClass` | `SizeClassIOS` | The [vertical size class](https://developer.apple.com/documentation/uikit/uitraitcollection/1623513-verticalsizeclass) of the device. |

### Enums

#### Orientation

| Value | Description |
| --- | --- |
| `LANDSCAPE_LEFT` | Left landscape interface orientation. |
| `LANDSCAPE_RIGHT` | Right landscape interface orientation. |
| `PORTRAIT_DOWN` | Upside down portrait interface orientation. |
| `PORTRAIT_UP` | Right-side up portrait interface orientation. |
| `UNKNOWN` | An unknown screen orientation. For example, the device is flat, perhaps on a table. |

#### OrientationLock

An enum whose values can be passed to the [`lockAsync`](#screenorientationlockasyncorientationlock)
method.
> __Note:__ `OrientationLock.ALL` and `OrientationLock.PORTRAIT` are invalid on devices which
> don't support `OrientationLock.PORTRAIT_DOWN`.

| Value | Description |
| --- | --- |
| `ALL` | All four possible orientations |
| `DEFAULT` | The default orientation. On iOS, this will allow all orientations except `Orientation.PORTRAIT_DOWN`.
On Android, this lets the system decide the best orientation. |
| `LANDSCAPE` | Any landscape orientation. |
| `LANDSCAPE_LEFT` | Left landscape only. |
| `LANDSCAPE_RIGHT` | Right landscape only. |
| `OTHER` | A platform specific orientation. This is not a valid policy that can be applied in [`lockAsync`](#screenorientationlockasyncorientationlock). |
| `PORTRAIT` | Any portrait orientation. |
| `PORTRAIT_DOWN` | Upside down portrait only. |
| `PORTRAIT_UP` | Right-side up portrait only. |
| `UNKNOWN` | An unknown screen orientation lock. This is not a valid policy that can be applied in [`lockAsync`](#screenorientationlockasyncorientationlock). |

#### SizeClassIOS


Each iOS device has a default set of [size classes](https://developer.apple.com/documentation/uikit/uiuserinterfacesizeclass)
that you can use as a guide when designing your interface.

| Value | Description |
| --- | --- |
| `COMPACT` | - |
| `REGULAR` | - |
| `UNKNOWN` | - |

#### WebOrientation

| Value | Description |
| --- | --- |
| `LANDSCAPE_PRIMARY` | - |
| `LANDSCAPE_SECONDARY` | - |
| `PORTRAIT_PRIMARY` | - |
| `PORTRAIT_SECONDARY` | - |

#### WebOrientationLock

An enum representing the lock policies that can be applied on the web platform, modelled after
the [W3C specification](https://w3c.github.io/screen-orientation/#dom-orientationlocktype).
These values can be applied through the [`lockPlatformAsync`](#screenorientationlockplatformasyncoptions)
method.

| Value | Description |
| --- | --- |
| `ANY` | - |
| `LANDSCAPE` | - |
| `LANDSCAPE_PRIMARY` | - |
| `LANDSCAPE_SECONDARY` | - |
| `NATURAL` | - |
| `PORTRAIT` | - |
| `PORTRAIT_PRIMARY` | - |
| `PORTRAIT_SECONDARY` | - |
| `UNKNOWN` | - |
