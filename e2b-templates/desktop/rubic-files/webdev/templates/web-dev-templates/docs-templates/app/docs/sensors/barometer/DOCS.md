---
name: barometer
description: Read atmospheric pressure for altitude estimation.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Barometer

A library that provides access to device's barometer sensor.

**Platforms:** android, ios

**Package:** `expo-sensors`

`Barometer` from `expo-sensors` provides access to the device barometer sensor to respond to changes in air pressure, which is measured in hectopascals (`hPa`).

## Installation

```bash
$ npx expo install expo-sensors
```

## Basic Usage (recommended)

This pattern checks availability first, sets a reasonable update interval, subscribes on mount, and cleans up the listener on unmount.

```tsx
import { Barometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export default function BarometerScreen() {
  const [pressure, setPressure] = useState(0);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;

    (async () => {
      const available = await Barometer.isAvailableAsync();
      setIsAvailable(available);
      if (!available) return null;

      // Barometric pressure changes slowly; avoid overly-frequent updates.
      Barometer.setUpdateInterval(1000);

      subscription = Barometer.addListener((data) => {
        setPressure(data.pressure);
      });
    })();

    return () => {
      subscription?.remove();
    };
  }, []);

  if (isAvailable === false) {
    return <Text>Barometer not available on this device</Text>;
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Pressure: {pressure.toFixed(2)} hPa</Text>
    </View>
  );
}
```

## Usage (toggle listener example)

```jsx
import { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { Barometer } from "expo-sensors";

export default function App() {
  const [{ pressure, relativeAltitude }, setData] = useState({
    pressure: 0,
    relativeAltitude: 0,
  });
  const [subscription, setSubscription] = useState(null);

  const toggleListener = () => {
    subscription ? unsubscribe() : subscribe();
  };

  const subscribe = () => {
    setSubscription(Barometer.addListener(setData));
  };

  const unsubscribe = () => {
    subscription && subscription.remove();
    setSubscription(null);
  };

  return (
    <View style={styles.wrapper}>
      <Text>Barometer: Listener {subscription ? "ACTIVE" : "INACTIVE"}</Text>
      <Text>Pressure: {pressure} hPa</Text>
      <Text>
        Relative Altitude:{" "}
        {Platform.OS === "ios"
          ? `${relativeAltitude} m`
          : `Only available on iOS`}
      </Text>
      <TouchableOpacity onPress={toggleListener} style={styles.button}>
        <Text>Toggle listener</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#eee",
    padding: 10,
    marginTop: 15,
  },
  wrapper: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
});
```

## Common Patterns

### Weather Monitoring (pressure trend)

Track pressure over time and interpret _trends_ rather than relying on single readings.

```tsx
import { Barometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export function WeatherMonitor() {
  const [pressure, setPressure] = useState(0);
  const [trend, setTrend] = useState<"rising" | "falling" | "stable">("stable");
  const [history, setHistory] = useState<number[]>([]);

  useEffect(() => {
    const subscription = Barometer.addListener((data) => {
      setPressure(data.pressure);

      setHistory((prev) => {
        const next = [...prev, data.pressure].slice(-10);
        analyzeTrend(next);
        return next;
      });
    });

    // Pressure changes are gradual; polling every few seconds is often enough.
    Barometer.setUpdateInterval(5000);

    return () => subscription.remove();
  }, []);

  const analyzeTrend = (values: number[]) => {
    if (values.length < 6) return null;

    const recent = values.slice(-3);
    const prev = values.slice(-6, -3);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const prevAvg = prev.reduce((a, b) => a + b, 0) / prev.length;

    if (avg > prevAvg + 0.5) setTrend("rising");
    else if (avg < prevAvg - 0.5) setTrend("falling");
    else setTrend("stable");
  };

  const getWeatherPrediction = () => {
    if (pressure > 1022) return "Clear weather";
    if (pressure > 1013) return "Fair weather";
    if (pressure > 1000) return "Changing weather";
    return "Stormy weather likely";
  };

  return (
    <View>
      <Text>Pressure: {pressure.toFixed(2)} hPa</Text>
      <Text>Trend: {trend}</Text>
      <Text>Prediction: {getWeatherPrediction()}</Text>
    </View>
  );
}
```

### Altitude Estimation (barometric formula)

Use pressure to estimate altitude relative to a chosen sea-level reference pressure (calibration matters).

```tsx
import { Barometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export function AltitudeEstimator() {
  const [altitude, setAltitude] = useState(0);
  const seaLevelPressure = 1013.25; // Standard sea level pressure in hPa

  useEffect(() => {
    const subscription = Barometer.addListener((data) => {
      // Estimate altitude (meters) using a simplified barometric formula:
      // https://en.wikipedia.org/wiki/Barometric_formula
      const estimatedAltitude =
        44330 * (1 - Math.pow(data.pressure / seaLevelPressure, 1 / 5.255));
      setAltitude(estimatedAltitude);
    });

    return () => subscription.remove();
  }, []);

  return (
    <View>
      <Text>Estimated Altitude: {altitude.toFixed(1)} m</Text>
    </View>
  );
}
```

### Pressure Change Detection (alerts)

Detect rapid rises/drops relative to a baseline.

```tsx
import { Barometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

export function PressureChangeAlert() {
  const [initialPressure, setInitialPressure] = useState<number | null>(null);
  const [currentPressure, setCurrentPressure] = useState(0);
  const [alert, setAlert] = useState("");

  useEffect(() => {
    const subscription = Barometer.addListener((data) => {
      if (initialPressure === null) {
        setInitialPressure(data.pressure);
      }

      setCurrentPressure(data.pressure);

      if (initialPressure !== null) {
        const change = data.pressure - initialPressure;

        if (change > 3) setAlert("Rapid pressure increase detected!");
        else if (change < -3) setAlert("Rapid pressure drop detected!");
        else setAlert("");
      }
    });

    Barometer.setUpdateInterval(2000);

    return () => subscription.remove();
  }, [initialPressure]);

  return (
    <View>
      <Text>Current: {currentPressure.toFixed(2)} hPa</Text>
      {initialPressure !== null && (
        <Text>
          Change: {(currentPressure - initialPressure).toFixed(2)} hPa
        </Text>
      )}
      {!!alert && <Text style={{ color: "red" }}>{alert}</Text>}
    </View>
  );
}
```

### Calibrated Barometer (offset)

Apply a calibration offset to align to a known reference (e.g., local weather station pressure).

```tsx
import { Barometer } from "expo-sensors";
import { useEffect, useState } from "react";
import { Button, Text, View } from "react-native";

export function CalibratedBarometer() {
  const [pressure, setPressure] = useState(0);
  const [calibrationOffset, setCalibrationOffset] = useState(0);

  useEffect(() => {
    const subscription = Barometer.addListener((data) => {
      setPressure(data.pressure + calibrationOffset);
    });

    return () => subscription.remove();
  }, [calibrationOffset]);

  const calibrate = (knownPressure: number) => {
    const offset = knownPressure - pressure;
    setCalibrationOffset(offset);
  };

  return (
    <View>
      <Text>Calibrated Pressure: {pressure.toFixed(2)} hPa</Text>
      <Button
        title="Calibrate to 1013.25 hPa"
        onPress={() => calibrate(1013.25)}
      />
    </View>
  );
}
```

## Understanding Pressure Values

### Typical Pressure Ranges (sea level)

- **Very High**: > 1030 hPa — usually indicates clear, calm weather
- **High**: 1020–1030 hPa — generally fair weather
- **Normal**: 1010–1020 hPa — average atmospheric pressure
- **Low**: 1000–1010 hPa — possible clouds and precipitation
- **Very Low**: < 1000 hPa — storms and severe weather likely

### Pressure and Altitude

Atmospheric pressure decreases as altitude increases (approximate reference values):

- Sea level: ~1013 hPa
- 1000m: ~900 hPa
- 2000m: ~800 hPa
- 3000m: ~700 hPa

## Best Practices

1. **Check availability first**: Always verify `Barometer.isAvailableAsync()` before subscribing.
2. **Remove listeners**: Clean up subscriptions to prevent memory leaks.
3. **Use appropriate intervals**: Pressure changes slowly; don’t request ultra-high update rates.
4. **Use trends, not absolutes**: For “weather” features, changes over time are more meaningful.
5. **Calibrate when possible**: Compare with a local reference pressure for better altitude estimates.
6. **Account for elevation**: Absolute pressure varies significantly with altitude.

## Error Handling

```ts
import { Barometer } from "expo-sensors";

export async function setupBarometer() {
  try {
    const isAvailable = await Barometer.isAvailableAsync();

    if (!isAvailable) {
      console.log("Barometer not available on this device");
      return null;
    }

    const subscription = Barometer.addListener((data) => {
      // Sanity-check typical ranges; handle unusual readings gracefully.
      if (data.pressure < 800 || data.pressure > 1100) {
        console.warn("Unusual pressure reading:", data.pressure);
        return null;
      }

      // Process normal reading.
    });

    return subscription;
  } catch (error) {
    console.error("Failed to set up barometer:", error);
    return null;
  }
}
```

## Platform-Specific Notes

### iOS

- Provides `relativeAltitude` in measurement data (change in altitude, not absolute altitude).
- Generally more accurate/responsive.
- Typically available on iPhone 6 and later (device-dependent).

### Android

- Availability varies by device; some Android devices do not include a barometer sensor.
- Update rate may be limited by hardware and OS sampling constraints.

### Web

- Not supported by Expo’s Barometer API.
- Attempting to access it will throw an `UnavailabilityError` (use a fallback for web).

## API

```js
import { Barometer } from "expo-sensors";
```

## Units and providers

| OS | Units | Provider | Description |
| --- | --- | --- | --- |
| iOS | _`hPa`_ | [`CMAltimeter`](https://developer.apple.com/documentation/coremotion/cmaltimeter) | Altitude events reflect the change in the current altitude, not the absolute altitude. |
| Android | _`hPa`_ | [`Sensor.TYPE_PRESSURE`](https://developer.android.com/reference/android/hardware/Sensor#TYPE_PRESSURE) | Monitoring air pressure changes. |
| Web | _N/A_ | _N/A_ | This sensor is not available on the web and cannot be accessed. An `UnavailabilityError` will be thrown if you attempt to get data. |

## API Reference

### Classes

#### BarometerSensor

**Properties:**

| Property           | Type     | Description |
| ------------------ | -------- | ----------- |
| `_nativeEventName` | `string` | -           |
| `_nativeModule`    | `any`    | -           |

**Methods:**

- `addListener(listener: Listener<BarometerMeasurement>): EventSubscription`
  Subscribe for updates to the barometer.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `listener` | `Listener<BarometerMeasurement>` | A callback that is invoked when a barometer update is available. When invoked, the listener is provided with a single argument that is `BarometerMeasurement`. |
  **Returns:** A subscription that you can call `remove()` on when you would like to unsubscribe the listener.

- `getListenerCount(): number`
  Returns the registered listeners count.

- `getPermissionsAsync(): Promise<PermissionResponse>`
  Checks user's permissions for accessing sensor.

- `hasListeners(): boolean`
  Returns boolean which signifies if sensor has any listeners registered.

- `isAvailableAsync(): Promise<boolean>`
  > **info** You should always check the sensor availability before attempting to use it.

Check the availability of the device barometer. Requires at least Android 2.3 (API Level 9) and iOS 8.
**Returns:** A promise that resolves to a `boolean` denoting the availability of the sensor.

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

| Property   | Type   | Description |
| ---------- | ------ | ----------- |
| `remove()` | `void` | -           |

### Types

#### BarometerMeasurement

The altitude data returned from the native sensors.

| Property           | Type     | Description                              |
| ------------------ | -------- | ---------------------------------------- |
| `pressure`         | `number` | Measurement in hectopascals (`hPa`).     |
| `relativeAltitude` | `number` | Measurement in meters (`m`). (iOS only)  |
| `timestamp`        | `number` | Timestamp of the measurement in seconds. |

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

#### PermissionResponse

An object obtained by permissions get and request functions.

| Property | Type | Description |
| --- | --- | --- |
| `canAskAgain` | `boolean` | Indicates if user can be asked again for specific permission.<br>If not, one should be directed to the Settings app in order to enable/disable the permission. |
| `expires` | `PermissionExpiration` | Determines time when the permission expires. |
| `granted` | `boolean` | A convenience boolean that indicates if the permission is granted. |
| `status` | `PermissionStatus` | Determines the status of the permission. |

### Enums

#### PermissionStatus

| Value          | Description                                       |
| -------------- | ------------------------------------------------- |
| `DENIED`       | User has denied the permission.                   |
| `GRANTED`      | User has granted the permission.                  |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |
