---
name: keep-awake
description: Prevent device screen from sleeping.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# KeepAwake

A React component that prevents the screen from sleeping when rendered.

**Platforms:** android, ios, tvos, web

**Package:** `expo-keep-awake`

`expo-keep-awake` provides a React hook that prevents the screen from sleeping and a pair of functions to enable this behavior imperatively.

## Quick Start

Here's a minimal example of how to use `expo-keep-awake` to prevent the screen from sleeping.

```jsx
import { useKeepAwake } from 'expo-keep-awake';
import { Text, View, Platform } from 'react-native';

export default function App() {
  if (Platform.OS !== 'web') {
    useKeepAwake();
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>
        {Platform.OS !== 'web'
          ? 'This screen will never sleep!'
          : 'Keep awake is not supported on web.'}
      </Text>
    </View>
  );
}
```

## When to Use

Use `expo-keep-awake` in scenarios where the user needs the screen to remain active without interaction, such as during video playback, presentations, or when displaying QR codes for scanning. It's also useful for long-running background tasks where the screen needs to stay on.

## Common Pitfalls

### 1. Forgetting to Deactivate

**Problem**: Activating keep-awake imperatively with `activateKeepAwake()` but never calling `deactivateKeepAwake()` can drain the user's battery.

**Solution**: Ensure that for every call to `activateKeepAwake()`, there is a corresponding call to `deactivateKeepAwake()`. It's often better to use the `useKeepAwake` hook, which handles this automatically.

```jsx
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, View } from 'react-native';
import React, { useEffect } from 'react';

export default function KeepAwakeComponent() {
  useEffect(() => {
    activateKeepAwake();
    return () => deactivateKeepAwake();
  }, []);

  return (
    <View>
      {/* Your component content */}
    </View>
  );
}
```

### 2. Using on Unsupported Platforms

**Problem**: The Wake Lock API has limited support on web browsers, and using it without checking for availability can lead to unexpected behavior.

**Solution**: Always check for availability using `isAvailableAsync()` before attempting to use the Wake Lock API on the web.

```jsx
import { activateKeepAwake, isAvailableAsync } from 'expo-keep-awake';
import { Platform } from 'react-native';

async function activate() {
  if (Platform.OS === 'web') {
    const isAvailable = await isAvailableAsync();
    if (isAvailable) {
      await activateKeepAwake();
    }
  } else {
    await activateKeepAwake();
  }
}
```

## Common Patterns

### Conditionally Keeping the Screen Awake

This pattern shows how to keep the screen awake based on a state variable. This is useful when you only want to prevent sleeping during a specific user action, like watching a video.

```jsx
import { useKeepAwake } from 'expo-keep-awake';
import React, { useState } from 'react';
import { Button, View } from 'react-native';

export default function VideoPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);

  if (isPlaying) {
    useKeepAwake();
  }

  return (
    <View>
      <Button
        title={isPlaying ? 'Pause' : 'Play'}
        onPress={() => setIsPlaying(!isPlaying)}
      />
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-keep-awake
```

## Usage

### Example: hook

```jsx
import { useKeepAwake } from 'expo-keep-awake';
import React from 'react';
import { Text, View } from 'react-native';

export default function KeepAwakeExample() {
  /* @info As long as this component is mounted, the screen will not turn off from being idle. */
  useKeepAwake();
  /* @end */
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>This screen will never sleep!</Text>
    </View>
  );
}
```

### Example: functions

```jsx
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import React from 'react';
import { Button, View } from 'react-native';

export default class KeepAwakeExample extends React.Component {
  render() {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Button onPress={this._activate} title="Activate" />
        <Button onPress={this._deactivate} title="Deactivate" />
      </View>
    );
  }

  _activate = () => {
    /* @info Screen will remain on after called until <strong>deactivateKeepAwake()</strong> is called. */ activateKeepAwake(); /* @end */
    alert('Activated!');
  };

  _deactivate = () => {
    /* @info Deactivates KeepAwake, or does nothing if it was never activated. */ deactivateKeepAwake(); /* @end */
    alert('Deactivated!');
  };
}
```

## API

```js
import * as KeepAwake from 'expo-keep-awake';
```

## API Reference
### Methods

#### activateKeepAwake

Prevents the screen from sleeping until `deactivateKeepAwake` is called with the same `tag` value.

If the `tag` argument is specified, the screen will not sleep until you call `deactivateKeepAwake`
with the same `tag` argument. When using multiple `tags` for activation you'll have to deactivate
each one in order to re-enable screen sleep. If tag is unspecified, the default `tag` is used.

Web support [is limited](https://caniuse.com/wake-lock).

```typescript
activateKeepAwake(tag: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `tag` | `string` | Tag to lock screen sleep prevention. If not provided, the default tag is used. |

#### activateKeepAwakeAsync

Prevents the screen from sleeping until `deactivateKeepAwake` is called with the same `tag` value.

If the `tag` argument is specified, the screen will not sleep until you call `deactivateKeepAwake`
with the same `tag` argument. When using multiple `tags` for activation you'll have to deactivate
each one in order to re-enable screen sleep. If tag is unspecified, the default `tag` is used.

Web support [is limited](https://caniuse.com/wake-lock).

```typescript
activateKeepAwakeAsync(tag: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `tag` | `string` | Tag to lock screen sleep prevention. If not provided, the default tag is used. |

#### addListener

Observe changes to the keep awake timer.
On web, this changes when navigating away from the active window/tab. No-op on native.

**Platform:** web

```typescript
addListener(tagOrListener: string | KeepAwakeListener, listener: KeepAwakeListener): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `tagOrListener` | `string | KeepAwakeListener` | - |
| `listener` | `KeepAwakeListener` | - |

#### deactivateKeepAwake

Releases the lock on screen-sleep prevention associated with the given `tag` value. If `tag`
is unspecified, it defaults to the same default tag that `activateKeepAwake` uses.

```typescript
deactivateKeepAwake(tag: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `tag` | `string` | Tag to release the lock on screen sleep prevention. If not provided, the default tag is used. |

#### isAvailableAsync

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** `true` on all platforms except [unsupported web browsers](https://caniuse.com/wake-lock).

#### useKeepAwake

A React hook to keep the screen awake for as long as the owner component is mounted.
The optionally provided `tag` argument is used when activating and deactivating the keep-awake
feature. If unspecified, an ID unique to the owner component is used. See the documentation for
`activateKeepAwakeAsync` below to learn more about the `tag` argument.

```typescript
useKeepAwake(tag: string, options: KeepAwakeOptions): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `tag` | `string` | Tag to lock screen sleep prevention. If not provided, an ID unique to the owner component is used. |
| `options` | `KeepAwakeOptions` | Additional options for the keep awake hook. |

### Types

#### KeepAwakeEvent

| Property | Type | Description |
| --- | --- | --- |
| `state` | `KeepAwakeEventState` | Keep awake state. |

#### KeepAwakeListener

**Type:** `(event: KeepAwakeEvent) => void`

#### KeepAwakeOptions

| Property | Type | Description |
| --- | --- | --- |
| `listener` | `KeepAwakeListener` | A callback that is invoked when the keep-awake state changes. |
| `suppressDeactivateWarnings` | `boolean` | The call will throw an unhandled promise rejection on Android when the original Activity is dead or deactivated. Set the value to `true` for suppressing the uncaught exception. |

### Enums

#### KeepAwakeEventState

| Value | Description |
| --- | --- |
| `RELEASE` | - |
