---
name: pedometer
description: Track step count and walking/running activity.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Pedometer

A library that provides access to the device's pedometer sensor.

**Platforms:** android, ios

**Package:** `expo-sensors`

`Pedometer` from `expo-sensors` uses the system `hardware.Sensor` on Android and Core Motion on iOS to get the user's step count, and also allows you to subscribe to pedometer updates.

## Installation

```bash
$ npx expo install expo-sensors
```

## Usage

```jsx
import { useState, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pedometer } from 'expo-sensors';

export default function App() {
  const [isPedometerAvailable, setIsPedometerAvailable] = useState('checking');
  const [pastStepCount, setPastStepCount] = useState(0);
  const [currentStepCount, setCurrentStepCount] = useState(0);

  const subscribe = async () => {
    const isAvailable = await Pedometer.isAvailableAsync();
    setIsPedometerAvailable(String(isAvailable));

    if (isAvailable) {
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - 1);

      const pastStepCountResult = await Pedometer.getStepCountAsync(start, end);
      if (pastStepCountResult) {
        setPastStepCount(pastStepCountResult.steps);
      }

      return Pedometer.watchStepCount(result => {
        setCurrentStepCount(result.steps);
      });
    }
  };

  useEffect(() => {
    const subscription = subscribe();
    return () => subscription && subscription.remove();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Pedometer.isAvailableAsync(): {isPedometerAvailable}</Text>
      <Text>Steps taken in the last 24 hours: {pastStepCount}</Text>
      <Text>Walk! And watch this go up: {currentStepCount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

## API

```js
import { Pedometer } from 'expo-sensors';
```

## API Reference

### Methods

#### getPermissionsAsync

Checks user's permissions for accessing pedometer.

```typescript
getPermissionsAsync(): Promise<PermissionResponse>
```

#### getStepCountAsync

Get the step count between two dates.

**Platform:** ios

```typescript
getStepCountAsync(start: Date, end: Date): Promise<PedometerResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `start` | `Date` | A date indicating the start of the range over which to measure steps. |
| `end` | `Date` | A date indicating the end of the range over which to measure steps. |

**Returns:** Returns a promise that fulfills with a [`PedometerResult`](#pedometerresult).

As [Apple documentation states](https://developer.apple.com/documentation/coremotion/cmpedometer/1613946-querypedometerdatafromdate?language=objc):
> Only the past seven days worth of data is stored and available for you to retrieve. Specifying
> a start date that is more than seven days in the past returns only the available data.

#### isAvailableAsync

Returns whether the pedometer is enabled on the device.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** Returns a promise that fulfills with a `boolean`, indicating whether the pedometer is
available on this device.

#### requestPermissionsAsync

Asks the user to grant permissions for accessing pedometer.

```typescript
requestPermissionsAsync(): Promise<PermissionResponse>
```

#### watchStepCount

Subscribe to pedometer updates.

```typescript
watchStepCount(callback: PedometerUpdateCallback): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `callback` | `PedometerUpdateCallback` | A callback that is invoked when new step count data is available. The callback is provided with a single argument that is [`PedometerResult`](#pedometerresult). |

**Returns:** Returns a [`Subscription`](#subscription) that enables you to call
`remove()` when you would like to unsubscribe the listener.

> Pedometer updates will not be delivered while the app is in the background. As an alternative, on Android, use another solution based on
> [`Health Connect API`](https://developer.android.com/health-and-fitness/guides/health-connect).
> On iOS, the `getStepCountAsync` method can be used to get the step count between two dates.

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types

#### PedometerResult

| Property | Type | Description |
| --- | --- | --- |
| `steps` | `number` | Number of steps taken between the given dates. |

#### PedometerUpdateCallback

Callback function providing event result as an argument.

**Type:** `(result: PedometerResult) => void`

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
