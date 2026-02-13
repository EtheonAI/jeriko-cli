
---
name: battery
description: Monitor battery level and charging state.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Battery

A library that provides battery information for the physical device, as well as corresponding event listeners.

**Platforms:** android, ios (web support is limited; treat as unsupported and guard with `Platform.OS !== 'web'`)

**Package:** `expo-battery`

`expo-battery` provides battery information for the physical device (such as battery level, whether or not the device is charging, and more) as well as corresponding event listeners.


## Quick Start

Get the current battery level and display it.

```jsx
import React, { useState, useEffect } from 'react';
import { Text, View, Platform } from 'react-native';
import * as Battery from 'expo-battery';

export default function App() {
  const [batteryLevel, setBatteryLevel] = useState(null);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    async function getBatteryLevel() {
      const batteryLevel = await Battery.getBatteryLevelAsync();
      setBatteryLevel(batteryLevel);
    }
    getBatteryLevel();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Current Battery Level: {batteryLevel !== null ? `${Math.round(batteryLevel * 100)}%` : 'Reading...'}</Text>
    </View>
  );
}
```

## When to Use

Use this module when you need to alter your app's behavior based on the device's battery state. For example, you might disable battery-intensive features when the battery is low, or display a notification to the user.

## Common Pitfalls

- **Problem**: Forgetting to unsubscribe from listeners.

  **Solution**: Always store the subscription object and call its `remove()` method in a cleanup function.

  ```jsx
  useEffect(() => {
    const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      console.log("Battery level:", batteryLevel);
    });

    return () => {
      subscription.remove();
    };
  }, []);
  ```

- **Problem**: Assuming the battery level is always available.

  **Solution**: The battery level can be `-1` if it's unavailable. Always check for this value.

  ```jsx
  const batteryLevel = useBatteryLevel();
  const percent = batteryLevel >= 0 ? `${Math.round(batteryLevel * 100)}%` : "Unknown";
  ```

- **Problem**: Using battery-intensive features when the battery is low.

  **Solution**: Check the battery level and disable features accordingly.

  ```jsx
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);

  useEffect(() => {
    const subscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      if (batteryLevel < 0.2) {
        setIsLowPowerMode(true);
      } else {
        setIsLowPowerMode(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
  ```

## Common Patterns

### Disabling Features in Low Power Mode

This pattern shows how to check for low power mode and disable a feature, like background location tracking.

```jsx
import { useState, useEffect } from 'react';
import { Switch, Text, View, Platform } from 'react-native';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';

export default function App() {
  const [isLowPowerMode, setIsLowPowerMode] = useState(false);
  const [locationTracking, setLocationTracking] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    async function checkLowPowerMode() {
      const powerState = await Battery.getPowerStateAsync();
      setIsLowPowerMode(powerState.lowPowerMode);
    }

    checkLowPowerMode();

    const subscription = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
      setIsLowPowerMode(lowPowerMode);
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (isLowPowerMode) {
      setLocationTracking(false);
      Location.stopLocationUpdatesAsync('background-location-task');
    }
  }, [isLowPowerMode]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Low Power Mode: {isLowPowerMode ? 'On' : 'Off'}</Text>
      <Switch
        value={locationTracking}
        onValueChange={setLocationTracking}
        disabled={isLowPowerMode}
      />
      <Text>Background Location Tracking</Text>
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-battery
```

## Usage

### Basic usage (hooks)

```jsx
import { useBatteryLevel } from "expo-battery";
import { Platform } from "react-native";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <Text>Battery API is not supported on web</Text>
      </View>
    );
  }

  const batteryLevel = useBatteryLevel();
  const percent =
    batteryLevel >= 0 ? `${Math.round(batteryLevel * 100)}%` : "Unknown";

  return (
    <View style={styles.container}>
      <Text>Current Battery Level: {percent}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 15,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

### Basic usage (async + listeners)

Use this when you need both the **current state** and **updates**, and always clean up subscriptions.

```tsx
import * as Battery from "expo-battery";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";

export function BatteryStatus() {
  const [level, setLevel] = useState<number>(-1);
  const [state, setState] = useState<Battery.BatteryState>(
    Battery.BatteryState.UNKNOWN,
  );

  useEffect(() => {
    if (Platform.OS === "web") return null;

    let levelSub: Battery.Subscription | undefined;
    let stateSub: Battery.Subscription | undefined;

    (async () => {
      const available = await Battery.isAvailableAsync();
      if (!available) return null;

      setLevel(await Battery.getBatteryLevelAsync());
      setState(await Battery.getBatteryStateAsync());

      levelSub = Battery.addBatteryLevelListener(({ batteryLevel }) =>
        setLevel(batteryLevel),
      );
      stateSub = Battery.addBatteryStateListener(({ batteryState }) =>
        setState(batteryState),
      );
    })();

    return () => {
      levelSub?.remove();
      stateSub?.remove();
    };
  }, []);

  if (Platform.OS === "web")
    return <Text>Battery API not supported on web</Text>;

  const percent = level >= 0 ? `${Math.round(level * 100)}%` : "Unknown";
  const label =
    state === Battery.BatteryState.CHARGING
      ? "Charging"
      : state === Battery.BatteryState.FULL
        ? "Full"
        : state === Battery.BatteryState.UNPLUGGED
          ? "On battery"
          : "Unknown";

  return (
    <View>
      <Text>{percent}</Text>
      <Text>{label}</Text>
    </View>
  );
}
```

## Common patterns
### Low battery warning

```tsx
import * as Battery from "expo-battery";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";

export function LowBatteryWarning() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return null;
    const sub = Battery.addBatteryLevelListener(({ batteryLevel }) => {
      setShow(batteryLevel >= 0 && batteryLevel < 0.2);
    });
    return () => sub.remove();
  }, []);

  if (!show) return null;
  return (
    <View style={{ padding: 12, backgroundColor: "#ff9800", borderRadius: 8 }}>
      <Text style={{ color: "white", fontWeight: "bold" }}>Low battery</Text>
    </View>
  );
}
```

### Low power mode indicator (iOS)

```tsx
import * as Battery from "expo-battery";
import { useEffect, useState } from "react";
import { Platform, Text } from "react-native";

export function LowPowerModeIndicator() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return null;
    Battery.getPowerStateAsync().then((s) => setEnabled(s.lowPowerMode));
    const sub = Battery.addLowPowerModeListener(({ lowPowerMode }) =>
      setEnabled(lowPowerMode),
    );
    return () => sub.remove();
  }, []);

  if (Platform.OS !== "ios" || !enabled) return null;
  return <Text>Low Power Mode is enabled</Text>;
}
```

## Best practices / gotchas

- Prefer **listeners** over polling (`getBatteryLevelAsync`) to avoid unnecessary work.
- Always **remove subscriptions** on unmount.
- Handle `batteryLevel === -1` (unknown/unavailable).
- Use `isAvailableAsync()` (especially important on iOS simulators).
- Android may emit battery level events less frequently (OS dependent).

## API

```js
import * as Battery from "expo-battery";
```

## API Reference

### Methods

#### addBatteryLevelListener

Subscribe to the battery level change updates.

On Android devices, the event fires only when significant changes happens, which is when the
battery level drops below [`android.intent.action.BATTERY_LOW`](https://developer.android.com/reference/android/content/Intent#ACTION_BATTERY_LOW)
or rises above [`android.intent.action.BATTERY_OKAY`](https://developer.android.com/reference/android/content/Intent#ACTION_BATTERY_OKAY)
from a low battery level. See [Monitor the Battery Level and Charging State](https://developer.android.com/training/monitoring-device-state/battery-monitoring)
in Android documentation for more information.

On iOS devices, the event fires when the battery level drops one percent or more, but is only
fired once per minute at maximum.

On web, the event never fires.

```typescript
addBatteryLevelListener(listener: (event: BatteryLevelEvent) => void): EventSubscription
```

**Parameters:**

- **listener**: `(event: BatteryLevelEvent) => void`
  - A callback that is invoked when battery level changes. The callback is provided a single argument that is an object with a `batteryLevel` key.

**Returns:** A `Subscription` object on which you can call `remove()` to unsubscribe from the listener.

#### addBatteryStateListener
Subscribe to the battery state change updates to receive an object with a [`Battery.BatteryState`](#batterystate)
enum value for whether the device is any of the four states.

On web, the event never fires.

```typescript
addBatteryStateListener(listener: (event: BatteryStateEvent) => void): EventSubscription
```

**Parameters:**

- **listener**: `(event: BatteryStateEvent) => void`
  - A callback that is invoked when battery state changes. The callback is provided a single argument that is an object with a `batteryState` key.

**Returns:** A `Subscription` object on which you can call `remove()` to unsubscribe from the listener.

#### addLowPowerModeListener

Subscribe to Power Saver Mode (Android) or Low Power Mode (iOS) updates. The event fires whenever
the power mode is toggled.

On web, the event never fires.

```typescript
addLowPowerModeListener(listener: (event: PowerModeEvent) => void): EventSubscription
```

**Parameters:**

- **listener**: `(event: PowerModeEvent) => void`
  - A callback that is invoked when Power Saver Mode (Android) or Low Power Mode (iOS) changes. The callback is provided a single argument that is an object with a `lowPowerMode` key.

**Returns:** A `Subscription` object on which you can call `remove()` to unsubscribe from the listener.

#### getBatteryLevelAsync

Gets the battery level of the device as a number between `0` and `1`, inclusive. If the device
does not support retrieving the battery level, this method returns `-1`. On web, this method
always returns `1`.

```typescript
getBatteryLevelAsync(): Promise<number>
```

**Returns:** A `Promise` that fulfils with a number between `0` and `1` representing the battery level,
or `-1` if the device does not provide it.

#### getBatteryStateAsync

Tells the battery's current state. On web, this always returns `BatteryState.UNKNOWN`.

```typescript
getBatteryStateAsync(): Promise<BatteryState>
```

**Returns:** Returns a `Promise` which fulfills with a [`Battery.BatteryState`](#batterystate) enum
value for whether the device is any of the four states.

#### getPowerStateAsync

Gets the power state of the device including the battery level, whether it is plugged in, and if
the system is currently operating in Power Saver Mode (Android) or Low Power Mode (iOS). This
method re-throws any errors that occur when retrieving any of the power-state information.

```typescript
getPowerStateAsync(): Promise<PowerState>
```

**Returns:** Returns a `Promise` which fulfills with [`PowerState`](#powerstate) object.

#### isAvailableAsync

Resolves with whether the battery API is available on the current device. The value of this
property is `true` on Android and physical iOS devices and `false` on iOS simulators. On web,
it depends on whether the browser supports the web battery API.

```typescript
isAvailableAsync(): Promise<boolean>
```

#### isBatteryOptimizationEnabledAsync
Checks whether battery optimization is enabled for your application.
If battery optimization is enabled for your app, background tasks might be affected
when your app goes into doze mode state. (only on Android 6.0 or later)

```typescript
isBatteryOptimizationEnabledAsync(): Promise<boolean>
```

**Returns:** Returns a `Promise` which fulfills with a `boolean` value of either `true` or `false`,
indicating whether the battery optimization is enabled or disabled, respectively. (Android only)

#### isLowPowerModeEnabledAsync

Gets the current status of Power Saver mode on Android and Low Power mode on iOS. If a platform
doesn't support Low Power mode reporting (like web, older Android devices), the reported low-power
state is always `false`, even if the device is actually in low-power mode.

```typescript
isLowPowerModeEnabledAsync(): Promise<boolean>
```

**Returns:** Returns a `Promise` which fulfills with a `boolean` value of either `true` or `false`,
indicating whether low power mode is enabled or disabled.

#### useBatteryLevel

Gets the device's battery level, as in [`getBatteryLevelAsync`](#getbatterylevelasync).

```typescript
useBatteryLevel(): number
```

**Returns:** The battery level of the device.

#### useBatteryState

Gets the device's battery state, as in [`getBatteryStateAsync`](#getbatterystateasync).

```typescript
useBatteryState(): BatteryState
```

**Returns:** The battery state of the device.

#### useLowPowerMode

Boolean that indicates if the device is in low power or power saver mode, as in [`isLowPowerModeEnabledAsync`](#islowpowermodeenabledasync).

```typescript
useLowPowerMode(): boolean
```

**Returns:** Returns a boolean indicating if the device is in low power mode.

#### usePowerState

Gets the device's power state information, as in [`getPowerStateAsync`](#getpowerstateasync).

```typescript
usePowerState(): PowerState
```

**Returns:** Returns power state information.

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property   | Type   | Description |
| ---------- | ------ | ----------- |
| `remove()` | `void` | -           |

### Types

#### BatteryLevelEvent

| Property       | Type     | Description                                                                       |
| -------------- | -------- | --------------------------------------------------------------------------------- |
| `batteryLevel` | `number` | A number between `0` and `1`, inclusive, or `-1` if the battery level is unknown. |

#### BatteryStateEvent


| Property       | Type           | Description                                   |
| -------------- | -------------- | --------------------------------------------- |
| `batteryState` | `BatteryState` | An enum value representing the battery state. |

#### PowerModeEvent

| Property       | Type      | Description                                                                    |
| -------------- | --------- | ------------------------------------------------------------------------------ |
| `lowPowerMode` | `boolean` | A boolean value, `true` if lowPowerMode is on, `false` if lowPowerMode is off. |

#### PowerState

| Property       | Type           | Description                                                                       |
| -------------- | -------------- | --------------------------------------------------------------------------------- |
| `batteryLevel` | `number`       | A number between `0` and `1`, inclusive, or `-1` if the battery level is unknown. |
| `batteryState` | `BatteryState` | An enum value representing the battery state.                                     |
| `lowPowerMode` | `boolean`      | A boolean value, `true` if lowPowerMode is on, `false` if lowPowerMode is off.    |

### Enums

#### BatteryState

| Value       | Description                                      |
| ----------- | ------------------------------------------------ |
| `CHARGING`  | If battery is charging.                          |
| `FULL`      | If the battery level is full.                    |
| `UNKNOWN`   | If the battery state is unknown or inaccessible. |
| `UNPLUGGED` | If battery is not charging or discharging.       |
