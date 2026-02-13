---
name: sensors
description: Access device sensors overview and common utilities.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Sensors

A library that provides access to a device's accelerometer, barometer, motion, gyroscope, light, magnetometer, and pedometer.

**Platforms:** android, ios, web

**Package:** `expo-sensors`

`expo-sensors` provide various APIs for accessing device sensors to measure motion, orientation, pressure, magnetic fields, ambient light, and step count.

## Installation

```bash
$ npx expo install expo-sensors
```

## Configuration in app config

You can configure `expo-sensors` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-sensors",
        {
          "motionPermission": "Allow $(PRODUCT_NAME) to access your device motion"
        }
      ]
    ]
  }
}
```

## API

```js

// OR

```

## Permissions

### Android

Starting in Android 12 (API level 31), the system has a 200Hz limit for each sensor updates.

If you need an update interval of greater than 200Hz, you must add the following permissions to your **app.json** inside the [`expo.android.permissions`](../config/app/#permissions) array.

<!-- (Expo docs component omitted) -->

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) or you're using native **android** project manually, add `HIGH_SAMPLING_RATE_SENSORS` permission to your project's **android/app/src/main/AndroidManifest.xml**:

```xml
<uses-permission android:name="android.permission.HIGH_SAMPLING_RATE_SENSORS" />
```

### iOS

The following usage description keys are used by this library:

## Available sensors

For more information, see the documentation for the sensor you are interested in:

**[Accelerometer](accelerometer)**

Measures device acceleration on all platforms.
**[Barometer](barometer)**

Measures pressure on Android and iOS platforms.
**[DeviceMotion](devicemotion)**

Measures device motion on all platforms.
**[Gyroscope](gyroscope)**

Measures device rotation on all platforms.
**[Magnetometer](magnetometer)**

Measures magnetic fields on Android and iOS platforms.
**[LightSensor](light-sensor)**

Measures ambient light on Android platform.
**[Pedometer](pedometer)**

Measures steps count on Android and iOS platforms.
