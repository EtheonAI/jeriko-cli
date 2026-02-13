---
name: accelerometer
description: Read device acceleration and motion data.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Accelerometer

A library that provides access to the device's accelerometer sensor.

**Platforms:** android, ios*, web (asterisk on iOS indicates motion permission required via Settings > Safari > Motion & Orientation Access)

**Package:** `expo-sensors`

`Accelerometer` from `expo-sensors` provides access to the device accelerometer sensor(s) and associated listeners to respond to changes in acceleration in three-dimensional space, meaning any movement or vibration.

## Quick Start

Here is a minimal example of how to use the `Accelerometer` module.

```jsx
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export default function App() {
  const [data, setData] = useState({ x: 0, y: 0, z: 0 });

  useEffect(() => {
    let subscription;
    const subscribe = async () => {
      if (Platform.OS === 'web') {
        const { status } = await Accelerometer.requestPermissionsAsync();
        if (status !== 'granted') {
          alert('Permission to access accelerometer was denied');
          return;
        }
      }

      subscription = Accelerometer.addListener(accelerometerData => {
        setData(accelerometerData);
      });
    };

    subscribe();

    return () => {
      subscription && subscription.remove();
    };
  }, []);

  const { x, y, z } = data;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Accelerometer:</Text>
      <Text style={styles.text}>
        x: {round(x)} y: {round(y)} z: {round(z)}
      </Text>
    </View>
  );
}

function round(n) {
  if (!n) {
    return 0;
  }
  return Math.floor(n * 100) / 100;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 18,
  },
});
```

## When to Use

Use the accelerometer to detect motion, orientation changes, and device-related gestures. It's ideal for applications that need to respond to the device being shaken, tilted, or moved in any direction.

## Common Pitfalls

### 1. Forgetting to Unsubscribe

**Problem**: Listeners continue to run in the background even after the component unmounts, causing memory leaks and performance issues.

**Solution**: Always store the subscription and call its `remove()` method in the cleanup function of `useEffect`.

```jsx
useEffect(() => {
  const subscription = Accelerometer.addListener(setData);
  return () => subscription.remove();
}, []);
```

### 2. Not Checking for Availability

**Problem**: The app might crash or behave unexpectedly on devices that do not have an accelerometer or if the user has disabled it.

**Solution**: Use `isAvailableAsync()` to check for the sensor's availability before attempting to use it.

```jsx
useEffect(() => {
  const checkAvailability = async () => {
    const isAvailable = await Accelerometer.isAvailableAsync();
    if (isAvailable) {
      // Subscribe to the accelerometer
    } else {
      // Handle the case where the sensor is not available
    }
  };
  checkAvailability();
}, []);
```

### 3. High Update Interval on Android

**Problem**: Requesting a very high update frequency (interval less than 200ms) on Android 12+ without the necessary permission will result in the system enforcing a 200ms interval.

**Solution**: If high-frequency updates are required, add the `HIGH_SAMPLING_RATE_SENSORS` permission to your `app.json` or `AndroidManifest.xml`.

```json
// app.json
{
  "expo": {
    "android": {
      "permissions": ["android.permission.HIGH_SAMPLING_RATE_SENSORS"]
    }
  }
}
```

## Common Patterns

### 1. Shake Detection

This pattern demonstrates how to detect a shake gesture by monitoring the magnitude of the acceleration vector.

```jsx
import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';

const SHAKE_THRESHOLD = 1.5; // Adjust this value to change sensitivity

export default function ShakeDetector() {
  const [shaked, setShaked] = useState(false);

  useEffect(() => {
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      if (magnitude > SHAKE_THRESHOLD) {
        setShaked(true);
        setTimeout(() => setShaked(false), 1000); // Reset after 1 second
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <View>
      <Text>{shaked ? 'Device was shaken!' : 'Shake the device'}</Text>
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-sensors
```

## Usage

```jsx
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Accelerometer } from 'expo-sensors';

export default function App() {
  const [{ x, y, z }, setData] = useState({
    x: 0,
    y: 0,
    z: 0,
  });
  const [subscription, setSubscription] = useState(null);

  const _slow = () => Accelerometer.setUpdateInterval(1000);
  const _fast = () => Accelerometer.setUpdateInterval(16);

  const _subscribe = () => {
    setSubscription(Accelerometer.addListener(setData));
  };

  const _unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  useEffect(() => {
    _subscribe();
    return () => _unsubscribe();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>Accelerometer: (in gs where 1g = 9.81 m/s^2)</Text>
      <Text style={styles.text}>x: {x}</Text>
      <Text style={styles.text}>y: {y}</Text>
      <Text style={styles.text}>z: {z}</Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={subscription ? _unsubscribe : _subscribe} style={styles.button}>
          <Text>{subscription ? 'On' : 'Off'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={_slow} style={[styles.button, styles.middleButton]}>
          <Text>Slow</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={_fast} style={styles.button}>
          <Text>Fast</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  text: {
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 15,
  },
  button: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    padding: 10,
  },
  middleButton: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#ccc',
  },
});
```

## API
```js
import { Accelerometer } from 'expo-sensors';
```

## API Reference

### Classes

#### AccelerometerSensor

A base class for subscribable sensors. The events emitted by this class are measurements
specified by the parameter type `Measurement`.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `_nativeEventName` | `string` | - |
| `_nativeModule` | `any` | - |

**Methods:**

- `addListener(listener: Listener<AccelerometerMeasurement>): EventSubscription`
  Subscribe for updates to the accelerometer.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `listener` | `Listener<AccelerometerMeasurement>` | A callback that is invoked when an accelerometer update is available. When invoked,<br>the listener is provided a single argument that is an `AccelerometerMeasurement` object. |
  **Returns:** A subscription that you can call `remove()` on when you would like to unsubscribe the listener.

- `getListenerCount(): number`
  Returns the registered listeners count.

- `getPermissionsAsync(): Promise<PermissionResponse>`
  Checks user's permissions for accessing sensor.

- `hasListeners(): boolean`
  Returns boolean which signifies if sensor has any listeners registered.

- `isAvailableAsync(): Promise<boolean>`
  > **info** You should always check the sensor availability before attempting to use it.

Returns whether the accelerometer is enabled on the device.

On mobile web, you must first invoke `Accelerometer.requestPermissionsAsync()` in a user interaction (i.e. touch event) before you can use this module.
If the `status` is not equal to `granted` then you should inform the end user that they may have to open settings.

On **web** this starts a timer and waits to see if an event is fired. This should predict if the iOS device has the **device orientation** API disabled in
**Settings > Safari > Motion & Orientation Access**. Some devices will also not fire if the site isn't hosted with **HTTPS** as `DeviceMotion` is now considered a secure API.
There is no formal API for detecting the status of `DeviceMotion` so this API can sometimes be unreliable on web.
  **Returns:** A promise that resolves to a `boolean` denoting the availability of the accelerometer.

- `removeAllListeners(): void`
  Removes all registered listeners.

- `removeSubscription(subscription: EventSubscription): void`
  Removes the given subscription.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `subscription` | `EventSubscription` | A subscription to remove. |

- `requestPermissionsAsync(): Promise<PermissionResponse>`
  Asks the user to grant permissions for accessing sensor.

- `setUpdateInterval(intervalMs: number): void`
  Set the sensor update interval.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `intervalMs` | `number` | Desired interval in milliseconds between sensor updates.<br>> Starting from Android 12 (API level 31), the system has a 200ms limit for each sensor updates.<br>><br>> If you need an update interval less than 200ms, you should:<br>> * add `android.permission.HIGH_SAMPLING_RATE_SENSORS` to [**app.json** `permissions` field](/versions/latest/config/app/#permissions)<br>> * or if you are using bare workflow, add `<uses-permission android:name="android.permission.HIGH_SAMPLING_RATE_SENSORS"/>` to **AndroidManifest.xml**. |

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types


#### AccelerometerMeasurement

Each of these keys represents the acceleration along that particular axis in g-force (measured in `g`s).

A `g` is a unit of gravitational force equal to that exerted by the earth’s gravitational field (`9.81 m/s^2`).

| Property | Type | Description |
| --- | --- | --- |
| `timestamp` | `number` | Timestamp of the measurement in seconds. |
| `x` | `number` | Value of `g`s device reported in X axis. |
| `y` | `number` | Value of `g`s device reported in Y axis. |
| `z` | `number` | Value of `g`s device reported in Z axis. |

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

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
