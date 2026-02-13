---
name: devicemotion
description: Combined motion data from accelerometer and gyroscope.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# DeviceMotion

A library that provides access to a device's motion and orientation sensors.

**Platforms:** android, ios, web

**Package:** `expo-sensors`

`DeviceMotion` from `expo-sensors` provides access to the device motion and orientation sensors. All data is presented in terms of three axes that run through a device. According to portrait orientation: X runs from left to right, Y from bottom to top and Z perpendicularly through the screen from back to front.

## Installation

```bash
$ npx expo install expo-sensors
```

## Configuration in app config

You can configure `DeviceMotion` from `expo-sensor` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-sensors",
        {
          "motionPermission": "Allow $(PRODUCT_NAME) to access your device motion."
        }
      ]
    ]
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) or you're using native **ios** project manually, then you need to configure `NSMotionUsageDescription` key in your native project to access `DeviceMotion` stats:

**Example:** ios/[app]/Info.plist
```xml
<key>NSMotionUsageDescription</key>
<string>Allow $(PRODUCT_NAME) to access your device motion</string>
```

## API

```js

```

## Permissions

### iOS

The following usage description keys are used by this library:

## API Reference

### Classes

#### DeviceMotionSensor

A base class for subscribable sensors. The events emitted by this class are measurements
specified by the parameter type `Measurement`.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `_nativeEventName` | `string` | - |
| `_nativeModule` | `any` | - |
| `Gravity` | `number` | Constant value representing standard gravitational acceleration for Earth (`9.80665` m/s^2). |

**Methods:**

- `addListener(listener: Listener<DeviceMotionMeasurement>): EventSubscription`
  Subscribe for updates to the device motion sensor.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `listener` | `Listener<DeviceMotionMeasurement>` | A callback that is invoked when a device motion sensor update is available. When invoked,<br>the listener is provided a single argument that is a `DeviceMotionMeasurement` object. |
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

On mobile web, you must first invoke `DeviceMotion.requestPermissionsAsync()` in a user interaction (i.e. touch event) before you can use this module.
If the `status` is not equal to `granted` then you should inform the end user that they may have to open settings.

On **web** this starts a timer and waits to see if an event is fired. This should predict if the iOS device has the **device orientation** API disabled in
**Settings > Safari > Motion & Orientation Access**. Some devices will also not fire if the site isn't hosted with **HTTPS** as `DeviceMotion` is now considered a secure API.
There is no formal API for detecting the status of `DeviceMotion` so this API can sometimes be unreliable on web.
  **Returns:** A promise that resolves to a `boolean` denoting the availability of device motion sensor.

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

#### DeviceMotionMeasurement

| Property | Type | Description |
| --- | --- | --- |
| `acceleration` | `null | { timestamp: number; x: number; y: number; z: number }` | Device acceleration on the three axis as an object with `x`, `y`, `z` keys. Expressed in meters per second squared (m/s^2). |
| `accelerationIncludingGravity` | `{ timestamp: number; x: number; y: number; z: number }` | Device acceleration with the effect of gravity on the three axis as an object with `x`, `y`, `z` keys. Expressed in meters per second squared (m/s^2). |
| `interval` | `number` | Interval at which data is obtained from the native platform. Expressed in **milliseconds** (ms). |
| `orientation` | `DeviceMotionOrientation` | Device orientation based on screen rotation. Value is one of: - `0` (portrait), - `90` (right landscape), - `180` (upside down), - `-90` (left landscape). |
| `rotation` | `{ alpha: number; beta: number; gamma: number; timestamp: number }` | Device's orientation in space as an object with alpha, beta, gamma keys where alpha is for rotation around Z axis, beta for X axis rotation and gamma for Y axis rotation. |
| `rotationRate` | `null | { alpha: number; beta: number; gamma: number; timestamp: number }` | Device's rate of rotation in space expressed in degrees per second (deg/s). |

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

#### DeviceMotionOrientation

| Value | Description |
| --- | --- |
| `LeftLandscape` | - |
| `Portrait` | - |
| `RightLandscape` | - |
| `UpsideDown` | - |

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |
