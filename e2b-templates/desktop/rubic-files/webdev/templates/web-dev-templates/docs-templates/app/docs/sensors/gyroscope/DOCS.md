---
name: gyroscope
description: Read device rotation rate and orientation.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Gyroscope

A library that provides access to the device's gyroscope sensor.

**Platforms:** android, ios*, web (asterisk on iOS indicates motion permission required via Settings > Safari > Motion & Orientation Access)

**Package:** `expo-sensors`

`Gyroscope` from `expo-sensors` provides access to the device's gyroscope sensor to respond to changes in rotation in three-dimensional space.

## Installation

```bash
$ npx expo install expo-sensors
```

## Usage

```jsx
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gyroscope } from 'expo-sensors';

export default function App() {
  const [{ x, y, z }, setData] = useState({
    x: 0,
    y: 0,
    z: 0,
  });
  const [subscription, setSubscription] = useState(null);

  const _slow = () => Gyroscope.setUpdateInterval(1000);
  const _fast = () => Gyroscope.setUpdateInterval(16);

  const _subscribe = () => {
    setSubscription(
      Gyroscope.addListener(gyroscopeData => {
        setData(gyroscopeData);
      })
    );
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
      <Text style={styles.text}>Gyroscope:</Text>
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
    paddingHorizontal: 10,
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
import { Gyroscope } from 'expo-sensors';
```

## API Reference

### Classes

#### GyroscopeSensor

A base class for subscribable sensors. The events emitted by this class are measurements
specified by the parameter type `Measurement`.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `_nativeEventName` | `string` | - |
| `_nativeModule` | `any` | - |

**Methods:**

- `addListener(listener: Listener<GyroscopeMeasurement>): EventSubscription`
  Subscribe for updates to the gyroscope.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `listener` | `Listener<GyroscopeMeasurement>` | A callback that is invoked when a gyroscope update is available. When invoked,<br>the listener is provided a single argument that is an `GyroscopeMeasurement` object. |
  **Returns:** A subscription that you can call `remove()` on when you would like to unsubscribe the listener.

- `getListenerCount(): number`
  Returns the registered listeners count.

- `getPermissionsAsync(): Promise<PermissionResponse>`
  Checks user's permissions for accessing sensor.

- `hasListeners(): boolean`
  Returns boolean which signifies if sensor has any listeners registered.

- `isAvailableAsync(): Promise<boolean>`
  > **info** You should always check the sensor availability before attempting to use it.

Returns whether the gyroscope is enabled on the device.

On mobile web, you must first invoke `Gyroscope.requestPermissionsAsync()` in a user interaction (i.e. touch event) before you can use this module.
If the `status` is not equal to `granted` then you should inform the end user that they may have to open settings.

On **web** this starts a timer and waits to see if an event is fired. This should predict if the iOS device has the **device orientation** API disabled in
**Settings > Safari > Motion & Orientation Access**. Some devices will also not fire if the site isn't hosted with **HTTPS** as `DeviceMotion` is now considered a secure API.
There is no formal API for detecting the status of `DeviceMotion` so this API can sometimes be unreliable on web.
  **Returns:** A promise that resolves to a `boolean` denoting the availability of the gyroscope.

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

#### GyroscopeMeasurement

Each of these keys represents the rotation along that particular axis measured in radians per second (rad/s).

| Property | Type | Description |
| --- | --- | --- |
| `timestamp` | `number` | Timestamp of the measurement in seconds. |
| `x` | `number` | Value of rotation in radians per second device reported in X axis. |
| `y` | `number` | Value of rotation in radians per second device reported in Y axis. |
| `z` | `number` | Value of rotation in radians per second device reported in Z axis. |

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
