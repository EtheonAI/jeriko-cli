---
name: light-sensor
description: Read ambient light level from device sensor.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# LightSensor

A library that provides access to the device's light sensor.

**Platforms:** android

**Package:** `expo-sensors`

`LightSensor` from `expo-sensors` provides access to the device's light sensor to respond to illuminance changes.

## Installation

```bash
$ npx expo install expo-sensors
```

## Usage

```jsx
import { useState, useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { LightSensor } from 'expo-sensors';

export default function App() {
  const [{ illuminance }, setData] = useState({ illuminance: 0 });
  const [subscription, setSubscription] = useState(null);

  const toggle = () => {
    if (subscription) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  const subscribe = () => {
    setSubscription(
      LightSensor.addListener(sensorData => {
        setData(sensorData);
      })
    );
  };

  const unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, []);

  return (
    <View style={styles.sensor}>
      <Text>Light Sensor:</Text>
      <Text>
        Illuminance: {Platform.OS === 'android' ? `${illuminance} lx` : `Only available on Android`}
      </Text>
      <View style={styles.buttonContainer}>
        <TouchableOpacity onPress={toggle} style={styles.button}>
          <Text>Toggle</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sensor: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
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
});
```

## API

```js
import { LightSensor } from 'expo-sensors';
```

## API Reference

### Classes

#### LightSensor

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `_nativeEventName` | `string` | - |
| `_nativeModule` | `any` | - |

**Methods:**

- `addListener(listener: Listener<LightSensorMeasurement>): EventSubscription`
  Subscribe for updates to the light sensor.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `listener` | `Listener<LightSensorMeasurement>` | A callback that is invoked when a LightSensor update is available. When invoked,<br>the listener is provided a single argument that is the illuminance value. |
  **Returns:** A subscription that you can call `remove()` on when you would like to unsubscribe the listener.

- `getListenerCount(): number`
  Returns the registered listeners count.

- `getPermissionsAsync(): Promise<PermissionResponse>`
  Checks user's permissions for accessing sensor.

- `hasListeners(): boolean`
  Returns boolean which signifies if sensor has any listeners registered.

- `isAvailableAsync(): Promise<boolean>`
  > **info** You should always check the sensor availability before attempting to use it.

Returns whether the light sensor is available and enabled on the device. Requires at least Android 2.3 (API Level 9).
  **Returns:** A promise that resolves to a `boolean` denoting the availability of the light sensor.

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

#### LightSensorMeasurement

| Property | Type | Description |
| --- | --- | --- |
| `illuminance` | `number` | Ambient light level registered by the device measured in lux (lx). |
| `timestamp` | `number` | Timestamp of the measurement in seconds. |

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
