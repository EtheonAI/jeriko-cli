---
name: location
description: Get the device location and geofencing utilities.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Location

_A library that provides access to reading geolocation information, polling current location or subscribing location update events from the device._

Available on platforms android, ios, web

`expo-location` allows reading geolocation information from the device. Your app can poll for the current location or subscribe to location update events.

## Quick Start

Here is a minimal example of using the `Location` module to get the current device location:

```tsx
import React, { useState, useEffect } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web' && !window.navigator.geolocation) {
        setErrorMsg('Geolocation is not supported by this browser.');
        return;
      }
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  let text = 'Waiting..';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  paragraph: {
    fontSize: 18,
    textAlign: 'center',
  },
});
```

## When to Use

Use `expo-location` when you need to get the user's current position for features like mapping, location tagging, or local recommendations. It's also suitable for creating location-aware experiences, such as displaying nearby points of interest or tracking a user's journey.

## Common Pitfalls

- **Forgetting to request permissions**: Always request permissions using `Location.requestForegroundPermissionsAsync()` or `Location.requestBackgroundPermissionsAsync()` before calling `Location.getCurrentPositionAsync()` or other location methods.

- **Not handling permission denial**: Check the `status` returned from the permission request and provide feedback to the user if permission is denied. You can guide them to the settings to enable it manually.

- **Assuming location services are enabled**: Check if location services are enabled using `Location.hasServicesEnabledAsync()` and prompt the user to enable them if they are not.

- **Ignoring platform differences**: Location APIs can behave differently on Android, iOS, and web. For example, background location updates have different requirements and limitations on each platform. Always check the documentation and use `Platform.OS` to handle platform-specific code.

## Common Patterns

### Subscribing to Location Updates

This pattern is useful for apps that need to continuously track the user's location, such as a running or navigation app.

```tsx
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import * as Location from 'expo-location';

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let subscriber;
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      subscriber = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 10, // 10 meters
        },
        (newLocation) => {
          setLocation(newLocation);
        }
      );
    })();

    return () => {
      if (subscriber) {
        subscriber.remove();
      }
    };
  }, []);

  let text = 'Waiting..';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = `Latitude: ${location.coords.latitude}, Longitude: ${location.coords.longitude}`;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  paragraph: {
    fontSize: 18,
    textAlign: 'center',
  },
});
```

## Installation

```bash
$ npx expo install expo-location
```

If you are installing this in an existing React Native app, make sure to install `expo` in your project.

## Configuration in app config

You can configure `expo-location` using its built-in [config plugin](https://docs.expo.dev/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](https://docs.expo.dev/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

```json app.json
{
  "expo": {
    "plugins": [
      [
        "expo-location",
        {
          "locationAlwaysAndWhenInUsePermission": "Allow $(PRODUCT_NAME) to use your location."
        }
      ]
    ]
  }
}
```

### Configurable properties
| Name | Default | Description |
| --- | --- | --- |
| `locationAlwaysAndWhenInUsePermission` | `"Allow $(PRODUCT_NAME) to use your location"` | Only for: ios. A string to set the [`NSLocationAlwaysAndWhenInUseUsageDescription`](#permission-nslocationalwaysandwheninuseusagedescription) permission message. |
| `locationAlwaysPermission` | `"Allow $(PRODUCT_NAME) to use your location"` | **Deprecated.** Only for: ios. A string to set the [`NSLocationAlwaysUsageDescription`](#permission-nslocationalwaysusagedescription) permission message. |
| `locationWhenInUsePermission` | `"Allow $(PRODUCT_NAME) to use your location"` | Only for: ios. A string to set the [`NSLocationWhenInUseUsageDescription`](#permission-nslocationwheninuseusagedescription) permission message. |
| `isIosBackgroundLocationEnabled` | `false` | Only for: ios. A boolean to enable `location` in the `UIBackgroundModes` in **Info.plist**. |
| `isAndroidBackgroundLocationEnabled` | `false` | Only for: android. A boolean to enable the [`ACCESS_BACKGROUND_LOCATION`](#permission-access_background_location) permission. |
| `isAndroidForegroundServiceEnabled` | - | Only for: android. A boolean to enable the [`FOREGROUND_SERVICE`](#permission-foreground_service) permission and [`FOREGROUND_SERVICE_LOCATION`](#permission-foreground_service_location). Defaults to `true` if `isAndroidBackgroundLocationEnabled` is `true`, otherwise `false`. |
| `androidForegroundServiceIcon` | - | Only for: android. Local path to an image to use as the icon for the foreground service started by `startLocationUpdatesAsync`. 96x96 all-white png with transparency. If not set, the app icon will be used. |

<ConfigReactNative>

If you're not using Continuous Native Generation ([CNG](https://docs.expo.dev/workflow/continuous-native-generation/)) or you're using native **ios** project manually, then you need to add the `NSLocationAlwaysAndWhenInUseUsageDescription`, `NSLocationAlwaysUsageDescription` and `NSLocationWhenInUseUsageDescription` keys to your project's **ios/[app]/Info.plist**:

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Allow $(PRODUCT_NAME) to use your location</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Allow $(PRODUCT_NAME) to use your location</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Allow $(PRODUCT_NAME) to use your location</string>
```

</ConfigReactNative>

### Background location

Background location allows your app to receive location updates while it is running in the background and includes both location updates and region monitoring through geofencing. This feature is subject to platform API limitations and system constraints:

- Background location will stop if the user terminates the app.
- Background location resumes if the user restarts the app.
- <PlatformTag platform="android" /> A terminated app will not automatically restart when a location
  or geofencing event occurs due to platform limitations.
- <PlatformTag platform="ios" /> The system will restart the terminated app when a new geofence
  event occurs.

> **Info** On Android, the result of removing an app from the recent apps list varies by device vendor. For example, some implementations treat removing an app from the recent apps list as killing it. Read more about these differences here: [https://dontkillmyapp.com](https://dontkillmyapp.com).

### Background location configuration&ensp;<PlatformTag platform="ios" />

To be able to run background location on iOS, you need to add the `location` value to the `UIBackgroundModes` array in your app's **Info.plist** file.

**If you're using [CNG](https://docs.expo.dev/workflow/continuous-native-generation/)**, the required `UIBackgroundModes` configuration will be applied automatically by prebuild.

#### Configure UIBackgroundModes manually on iOS

If you're not using Continuous Native Generation ([CNG](https://docs.expo.dev/workflow/continuous-native-generation/)) or you're using a native iOS project, then you'll need to add the following to your **Expo.plist** file:

```xml ios/project-name/Supporting/Expo.plist
<key>UIBackgroundModes</key>
  <array>
    <string>location</string>
  </array>
```

### Background location methods

To use Background Location methods, the following requirements apply:

- Location permissions must be granted.
- Background location task must be defined in the top-level scope, using [`TaskManager.defineTask`](task-manager.mdx#taskmanagerdefinetasktaskname-taskexecutor).
- <PlatformTag platform="ios" className="float-left" /> `"location"` background mode must be
  specified in **Info.plist** file. See [Background location
  configuration](#background-location-configuration).
- <PlatformTag platform="ios" className="float-left" /> You must use a [development
  build](https://docs.expo.dev/develop/development-builds/introduction/) to use background location since it is not
  supported in the Expo Go app.

### Geofencing methods

To use Geofencing methods, the following requirements apply:

- Location permissions must be granted.
- The Geofencing task must be defined in the top-level scope, using [`TaskManager.defineTask`](task-manager.mdx#taskmanagerdefinetasktaskname-taskexecutor).

When using Geofencing, the following platform differences apply:

- <PlatformTag platform="android" /> You are allowed [up to
  100](https://developer.android.com/develop/sensors-and-location/location/geofencing) active
  geofences per app.
- <PlatformTag platform="ios" /> Expo Location will report the initial state of the registered
  geofence(s) at app startup.
- <PlatformTag platform="ios" /> There is a [limit of
  20](https://developer.apple.com/documentation/corelocation/monitoring_the_user_s_proximity_to_geographic_regions)
  `regions` that can be simultaneously monitored.

### Background permissions

To use location tracking or Geofencing in the background, you must request the appropriate permissions:

- On Android, you must request both foreground and background permissions.
- On iOS, it must be granted with the `Always` option using [`requestBackgroundPermissionsAsync`](#locationrequestbackgroundpermissionsasync).

#### Expo and iOS permissions

iOS permissions are divided into the two categories `When In Use` and `Always` and maps to Expo's foreground and background location permissions requested via:

- [`requestForegroundPermissionsAsync`](#locationrequestforegroundpermissionsasync) maps to `When In Use`
- [`requestBackgroundPermissionsAsync`](#locationrequestbackgroundpermissionsasync) maps to `Always`

> **Note:** When requesting `When In Use` authorization, the user can grant **temporary access** by selecting `Allow Once` in the system permission dialog. This authorization will be valid **only for the current app session** and is automatically revoked when the app is closed.

**Detecting "Allow Once" versus "Allow While Using the App"**

Unfortunately, **iOS does not provide a way to detect whether the user selected `Allow Once` or `Allow While Using the App`**. Both responses result in `When In Use` authorization.

If the user selected `Allow Once` and you subsequently call [`requestBackgroundPermissionsAsync`](#locationrequestbackgroundpermissionsasync) in the same session, the system **will not show another prompt**. Instead, the request will **silently fail**, and the returned background permission status will be **denied**.

**Handling "Allow Once" scenarios**

If you suspect the user selected `Allow Once` and needs to request background permissions, they must **manually enable background location** in the Settings app. You can use `Linking` to open the Settings app within your app:

```js
import { Linking } from 'react-native';

function openSettings() {
  Linking.openURL('app-settings:');
}
```

**Incremental permission requests**

It is possible to request foreground location access first and then ask for background location access later. This can improve the user experience by requesting permissions only when necessary.

**Requesting Background Permissions directly**

If you call [`requestBackgroundPermissionsAsync`](#locationrequestbackgroundpermissionsasync) without first requesting foreground permissions, iOS treats it as a request for both `When In Use` and `Always` authorization. The system will then prompt the user for `When In Use` access, and the `Always` authorization prompt will be displayed when the system determines that `Always` authorization is required.

Remember that the user has the option of granting your app `When In Use` authorization instead. You must always be prepared to run with `When In Use` permission.

## Deferred locations

When using background locations, you can configure the location manager to defer updates. This helps save battery by reducing update frequency. You can set updates to trigger only after the device has moved a certain distance or after a specified time interval.

Deferred updates are configured through [`LocationTaskOptions`](#locationtaskoptions) using the [`deferredUpdatesDistance`](#locationtaskoptions), [`deferredUpdatesInterval`](#locationtaskoptions) and [`deferredTimeout`](#locationtaskoptions) properties.

> Deferred locations apply only when the app is in the background.

## Usage

If you're using the Android Emulator or iOS Simulator, ensure that [Location is enabled](#enable-emulator-location).

```tsx
import { useState, useEffect } from 'react';
import { Platform, Text, View, StyleSheet } from 'react-native';
/* @hide */
import * as Device from 'expo-device';
/* @end */
import * as Location from 'expo-location';

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function getCurrentLocation() {
      /* @hide */
      if (Platform.OS === 'android' && !Device.isDevice) {
        setErrorMsg(
          'Oops, this will not work on Snack in an Android Emulator. Try it on your device!'
        );
        return;
      }
      /* @end */
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    }

    getCurrentLocation();
  }, []);

  let text = 'Waiting...';
  if (errorMsg) {
    text = errorMsg;
  } else if (location) {
    text = JSON.stringify(location);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.paragraph}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  paragraph: {
    fontSize: 18,
    textAlign: 'center',
  },
});
```

## Enable emulator location

### Android Emulator

Open Android Studio, and launch the Android Emulator. Inside it, go to **Settings** > **Location** and enable **Use location**.

[Location settings in Android Emulator for versions 12 and higher](https://docs.expo.dev/static/images/sdk/location/enable-android-emulator-location.png)

If you don't receive the locations in the emulator, you may have to turn off the **Improve Location Accuracy** setting. This will turn off Wi-Fi location and only use GPS. Then you can manipulate the location with GPS data through the emulator.

For Android 12 and higher, go to **Settings** > **Location** > **Location Services** > **Google Location Accuracy**, and turn off **Improve Location Accuracy**. For Android 11 and lower, go to **Settings** > **Location** > **Advanced** > **Google Location Accuracy**, and turn off **Google Location Accuracy**.

### iOS Simulator

With Simulator open, go to **Features** > **Location** and choose any option besides **None**.

[Location settings in iOS simulator.](https://docs.expo.dev/static/images/sdk/location/ios-simulator-location.png)

## API

```js
import * as Location from 'expo-location';
```

## API: expo-location

### Hooks

#### useBackgroundPermissions (*Function*)
Check or request permissions for the background location.
This uses both `requestBackgroundPermissionsAsync` and `getBackgroundPermissionsAsync` to
interact with the permissions.
- `useBackgroundPermissions(options?: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]`
  Check or request permissions for the background location.
  This uses both `requestBackgroundPermissionsAsync` and `getBackgroundPermissionsAsync` to
  interact with the permissions.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` *(optional)* | PermissionHookOptions<object> | - |
  Example:
  ```ts
  const [status, requestPermission] = Location.useBackgroundPermissions();
  ```

#### useForegroundPermissions (*Function*)
Check or request permissions for the foreground location.
This uses both `requestForegroundPermissionsAsync` and `getForegroundPermissionsAsync` to interact with the permissions.
- `useForegroundPermissions(options?: PermissionHookOptions<object>): [null | LocationPermissionResponse, RequestPermissionMethod<LocationPermissionResponse>, GetPermissionMethod<LocationPermissionResponse>]`
  Check or request permissions for the foreground location.
  This uses both `requestForegroundPermissionsAsync` and `getForegroundPermissionsAsync` to interact with the permissions.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` *(optional)* | PermissionHookOptions<object> | - |
  Example:
  ```ts
  const [status, requestPermission] = Location.useForegroundPermissions();
  ```

### Location Methods

#### enableNetworkProviderAsync (*Function*)
- `enableNetworkProviderAsync(): Promise<void>`
  Asks the user to turn on high accuracy location mode which enables network provider that uses
  Google Play services to improve location accuracy and location-based services.
  Available on platform: android
  Returns: A promise resolving as soon as the user accepts the dialog. Rejects if denied.

#### geocodeAsync (*Function*)
- `geocodeAsync(address: string): Promise<LocationGeocodedLocation[]>`
  Geocode an address string to latitude-longitude location.

  On Android, you must request location permissions with [`requestForegroundPermissionsAsync`](#locationrequestforegroundpermissionsasync)
  before geocoding can be used.

  > **Note**: Geocoding is resource consuming and has to be used reasonably. Creating too many
  > requests at a time can result in an error, so they have to be managed properly.
  > It's also discouraged to use geocoding while the app is in the background and its results won't
  > be shown to the user immediately.
  Available on platforms: android, ios
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `address` | string | A string representing address, eg. `"Baker Street London"`. |
  Returns: A promise which fulfills with an array (in most cases its size is 1) of [`LocationGeocodedLocation`](#locationgeocodedlocation)
  objects.

#### getBackgroundPermissionsAsync (*Function*)
- `getBackgroundPermissionsAsync(): Promise<PermissionResponse>`
  Checks user's permissions for accessing location while the app is in the background.
  Returns: A promise that fulfills with an object of type [`PermissionResponse`](#permissionresponse).

#### getCurrentPositionAsync (*Function*)
- `getCurrentPositionAsync(options: LocationOptions): Promise<LocationObject>`
  Requests for one-time delivery of the user's current location.
  Depending on given `accuracy` option it may take some time to resolve,
  especially when you're inside a building.
  > __Note:__ Calling it causes the location manager to obtain a location fix which may take several
  > seconds. Consider using [`getLastKnownPositionAsync`](#locationgetlastknownpositionasyncoptions)
  > if you expect to get a quick response and high accuracy is not required.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | LocationOptions | - |
  Returns: A promise which fulfills with an object of type [`LocationObject`](#locationobject).

#### getForegroundPermissionsAsync (*Function*)
- `getForegroundPermissionsAsync(): Promise<LocationPermissionResponse>`
  Checks user's permissions for accessing location while the app is in the foreground.
  Returns: A promise that fulfills with an object of type [`LocationPermissionResponse`](#locationpermissionresponse).

#### getHeadingAsync (*Function*)
- `getHeadingAsync(): Promise<LocationHeadingObject>`
  Gets the current heading information from the device. To simplify, it calls `watchHeadingAsync`
  and waits for a couple of updates, and then returns the one that is accurate enough.
  Returns: A promise which fulfills with an object of type [`LocationHeadingObject`](#locationheadingobject).

#### getLastKnownPositionAsync (*Function*)
- `getLastKnownPositionAsync(options: LocationLastKnownOptions): Promise<LocationObject | null>`
  Gets the last known position of the device or `null` if it's not available or doesn't match given
  requirements such as maximum age or required accuracy.
  It's considered to be faster than `getCurrentPositionAsync` as it doesn't request for the current
  location, but keep in mind the returned location may not be up-to-date.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | LocationLastKnownOptions | - |
  Returns: A promise which fulfills with an object of type [`LocationObject`](#locationobject) or
  `null` if it's not available or doesn't match given requirements such as maximum age or required
  accuracy.

#### getProviderStatusAsync (*Function*)
- `getProviderStatusAsync(): Promise<LocationProviderStatus>`
  Check status of location providers.
  Returns: A promise which fulfills with an object of type [`LocationProviderStatus`](#locationproviderstatus).

#### hasServicesEnabledAsync (*Function*)
- `hasServicesEnabledAsync(): Promise<boolean>`
  Checks whether location services are enabled by the user.
  Returns: A promise which fulfills to `true` if location services are enabled on the device,
  or `false` if not.

#### hasStartedGeofencingAsync (*Function*)
- `hasStartedGeofencingAsync(taskName: string): Promise<boolean>`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `taskName` | string | Name of the geofencing task to check. |
  Returns: A promise which fulfills with boolean value indicating whether the geofencing task is
  started or not.

#### hasStartedLocationUpdatesAsync (*Function*)
- `hasStartedLocationUpdatesAsync(taskName: string): Promise<boolean>`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `taskName` | string | Name of the location task to check. |
  Returns: A promise which fulfills with boolean value indicating whether the location task is
  started or not.

#### installWebGeolocationPolyfill (*Function*)
- `installWebGeolocationPolyfill()`
  Polyfills `navigator.geolocation` for interop with the core React Native and Web API approach to geolocation.

#### isBackgroundLocationAvailableAsync (*Function*)
- `isBackgroundLocationAvailableAsync(): Promise<boolean>`

#### requestBackgroundPermissionsAsync (*Function*)
- `requestBackgroundPermissionsAsync(): Promise<PermissionResponse>`
  Asks the user to grant permissions for location while the app is in the background.
  On __Android 11 or higher__: this method will open the system settings page - before that happens
  you should explain to the user why your application needs background location permission.
  For example, you can use `Modal` component from `react-native` to do that.
  > __Note__: Foreground permissions should be granted before asking for the background permissions
  (your app can't obtain background permission without foreground permission).
  Returns: A promise that fulfills with an object of type [`PermissionResponse`](#permissionresponse).

#### requestForegroundPermissionsAsync (*Function*)
- `requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>`
  Asks the user to grant permissions for location while the app is in the foreground.
  Returns: A promise that fulfills with an object of type [`LocationPermissionResponse`](#locationpermissionresponse).

#### reverseGeocodeAsync (*Function*)
- `reverseGeocodeAsync(location: Pick<LocationGeocodedLocation, 'latitude' | 'longitude'>): Promise<LocationGeocodedAddress[]>`
  Reverse geocode a location to postal address.

  On Android, you must request location permissions with [`requestForegroundPermissionsAsync`](#locationrequestforegroundpermissionsasync)
  before geocoding can be used.

  > **Note**: Geocoding is resource consuming and has to be used reasonably. Creating too many
  > requests at a time can result in an error, so they have to be managed properly.
  > It's also discouraged to use geocoding while the app is in the background and its results won't
  > be shown to the user immediately.
  Available on platforms: android, ios
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `location` | Pick<LocationGeocodedLocation, 'latitude' \| 'longitude'> | An object representing a location. |
  Returns: A promise which fulfills with an array (in most cases its size is 1) of [`LocationGeocodedAddress`](#locationgeocodedaddress) objects.

#### startGeofencingAsync (*Function*)
- `startGeofencingAsync(taskName: string, regions: LocationRegion[]): Promise<void>`
  Starts geofencing for given regions. When the new event comes, the task with specified name will
  be called with the region that the device enter to or exit from.
  If you want to add or remove regions from already running geofencing task, you can just call
  `startGeofencingAsync` again with the new array of regions.

  # Task parameters

  Geofencing task will be receiving following data:
   - `eventType` - Indicates the reason for calling the task, which can be triggered by entering or exiting the region.
     See [`GeofencingEventType`](#geofencingeventtype).
   - `region` - Object containing details about updated region. See [`LocationRegion`](#locationregion) for more details.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `taskName` | string | Name of the task that will be called when the device enters or exits from specified regions. |
  | `regions` | LocationRegion[] | Array of region objects to be geofenced. |
  Returns: A promise resolving as soon as the task is registered.
  Example:
  ```ts
  import { GeofencingEventType } from 'expo-location';
  import * as TaskManager from 'expo-task-manager';

   TaskManager.defineTask(YOUR_TASK_NAME, ({ data: { eventType, region }, error }) => {
    if (error) {
      // check `error.message` for more details.
      return;
    }
    if (eventType === GeofencingEventType.Enter) {
      console.log("You've entered region:", region);
    } else if (eventType === GeofencingEventType.Exit) {
      console.log("You've left region:", region);
    }
  });
  ```

#### startLocationUpdatesAsync (*Function*)
- `startLocationUpdatesAsync(taskName: string, options: LocationTaskOptions): Promise<void>`
  Registers for receiving location updates that can also come when the app is in the background.

  # Task parameters

  Background location task will be receiving following data:
  - `locations` - An array of the new locations.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `taskName` | string | Name of the task receiving location updates. |
  | `options` | LocationTaskOptions | An object of options passed to the location manager. |
  Returns: A promise resolving once the task with location updates is registered.
  Example:
  ```ts
  import * as TaskManager from 'expo-task-manager';

  TaskManager.defineTask(YOUR_TASK_NAME, ({ data: { locations }, error }) => {
   if (error) {
     // check `error.message` for more details.
     return;
   }
   console.log('Received new locations', locations);
  });
  ```

#### stopGeofencingAsync (*Function*)
- `stopGeofencingAsync(taskName: string): Promise<void>`
  Stops geofencing for specified task. It unregisters the background task so the app will not be
  receiving any updates, especially in the background.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `taskName` | string | Name of the task to unregister. |
  Returns: A promise resolving as soon as the task is unregistered.

#### stopLocationUpdatesAsync (*Function*)
- `stopLocationUpdatesAsync(taskName: string): Promise<void>`
  Stops location updates for specified task.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `taskName` | string | Name of the background location task to stop. |
  Returns: A promise resolving as soon as the task is unregistered.

#### watchHeadingAsync (*Function*)
- `watchHeadingAsync(callback: LocationHeadingCallback, errorHandler?: LocationErrorCallback): Promise<LocationSubscription>`
  Subscribe to compass updates from the device.
  Available on platforms: android, ios
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `callback` | LocationHeadingCallback | This function is called on each compass update. It receives an object of type<br>[LocationHeadingObject](#locationheadingobject) as the first argument. |
  | `errorHandler` *(optional)* | LocationErrorCallback | This function is called when an error occurs. It receives a string with the<br>error message as the first argument. |
  Returns: A promise which fulfills with a [`LocationSubscription`](#locationsubscription) object.

#### watchPositionAsync (*Function*)
- `watchPositionAsync(options: LocationOptions, callback: LocationCallback, errorHandler?: LocationErrorCallback): Promise<LocationSubscription>`
  Subscribe to location updates from the device. Updates will only occur while the application is in
  the foreground. To get location updates while in background you'll need to use
  [`startLocationUpdatesAsync`](#locationstartlocationupdatesasynctaskname-options).
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | LocationOptions | - |
  | `callback` | LocationCallback | This function is called on each location update. It receives an object of type<br>[`LocationObject`](#locationobject) as the first argument. |
  | `errorHandler` *(optional)* | LocationErrorCallback | This function is called when an error occurs. It receives a string with the<br>error message as the first argument. |
  Returns: A promise which fulfills with a [`LocationSubscription`](#locationsubscription) object.

### Types

#### LocationCallback (*Type*)
Represents `watchPositionAsync` callback.
Type: (location: LocationObject) => any

#### LocationErrorCallback (*Type*)
Error callback for location methods.
Type: (reason: string) => void

#### LocationGeocodedAddress (*Type*)
Type representing a result of `reverseGeocodeAsync`.
| Property | Type | Description |
| --- | --- | --- |
| `city` | string \| null | City name of the address. |
| `country` | string \| null | Localized country name of the address. |
| `district` | string \| null | Additional city-level information like district name. |
| `formattedAddress` | string \| null | Composed string of the address components, for example, "111 8th Avenue, New York, NY". Available on platform: android |
| `isoCountryCode` | string \| null | Localized (ISO) country code of the address, if available. |
| `name` | string \| null | The name of the placemark, for example, "Tower Bridge". |
| `postalCode` | string \| null | Postal code of the address. |
| `region` | string \| null | The state or province associated with the address. |
| `street` | string \| null | Street name of the address. |
| `streetNumber` | string \| null | Street number of the address. |
| `subregion` | string \| null | Additional information about administrative area. |
| `timezone` | string \| null | The timezone identifier associated with the address. Available on platform: ios |

#### LocationGeocodedLocation (*Type*)
Type representing a result of `geocodeAsync`.
| Property | Type | Description |
| --- | --- | --- |
| `accuracy` *(optional)* | number | The radius of uncertainty for the location, measured in meters. |
| `altitude` *(optional)* | number | The altitude in meters above the WGS 84 reference ellipsoid. |
| `latitude` | number | The latitude in degrees. |
| `longitude` | number | The longitude in degrees. |

#### LocationHeadingCallback (*Type*)
Represents `watchHeadingAsync` callback.
Type: (location: LocationHeadingObject) => any

#### LocationHeadingObject (*Type*)
Type of the object containing heading details and provided by `watchHeadingAsync` callback.
| Property | Type | Description |
| --- | --- | --- |
| `accuracy` | number | Level of calibration of compass:<br>- `3`: high accuracy<br>- `2`: medium accuracy<br>- `1`: low accuracy<br>- `0`: none<br><br>Reference for iOS:<br>- `3`: < 20 degrees uncertainty<br>- `2`: < 35 degrees<br>- `1`: < 50 degrees<br>- `0`: > 50 degrees |
| `magHeading` | number | Measure of magnetic north in degrees. |
| `trueHeading` | number | Measure of true north in degrees (needs location permissions, will return `-1` if not given). |

#### LocationLastKnownOptions (*Type*)
Type representing options object that can be passed to `getLastKnownPositionAsync`.
| Property | Type | Description |
| --- | --- | --- |
| `maxAge` *(optional)* | number | A number of milliseconds after which the last known location starts to be invalid and thus<br>`null` is returned. |
| `requiredAccuracy` *(optional)* | number | The maximum radius of uncertainty for the location, measured in meters. If the last known<br>location's accuracy radius is bigger (less accurate) then `null` is returned. |

#### LocationObject (*Type*)
Type representing the location object.
| Property | Type | Description |
| --- | --- | --- |
| `coords` | LocationObjectCoords | The coordinates of the position. |
| `mocked` *(optional)* | boolean | Whether the location coordinates is mocked or not. Available on platform: android |
| `timestamp` | number | The time at which this position information was obtained, in milliseconds since epoch. |

#### LocationObjectCoords (*Type*)
Type representing the location GPS related data.
| Property | Type | Description |
| --- | --- | --- |
| `accuracy` | number \| null | The radius of uncertainty for the location, measured in meters. Can be `null` on Web if it's not available. |
| `altitude` | number \| null | The altitude in meters above the WGS 84 reference ellipsoid. Can be `null` on Web if it's not available. |
| `altitudeAccuracy` | number \| null | The accuracy of the altitude value, in meters. Can be `null` on Web if it's not available. |
| `heading` | number \| null | Horizontal direction of travel of this device, measured in degrees starting at due north and<br>continuing clockwise around the compass. Thus, north is 0 degrees, east is 90 degrees, south is<br>180 degrees, and so on. Can be `null` on Web if it's not available. |
| `latitude` | number | The latitude in degrees. |
| `longitude` | number | The longitude in degrees. |
| `speed` | number \| null | The instantaneous speed of the device in meters per second. Can be `null` on Web if it's not available. |

#### LocationOptions (*Type*)
Type representing options argument in `getCurrentPositionAsync`.
| Property | Type | Description |
| --- | --- | --- |
| `accuracy` *(optional)* | LocationAccuracy | Location manager accuracy. Pass one of `Accuracy` enum values.<br>For low-accuracies the implementation can avoid geolocation providers<br>that consume a significant amount of power (such as GPS). Default: `LocationAccuracy.Balanced` |
| `distanceInterval` *(optional)* | number | Receive updates only when the location has changed by at least this distance in meters.<br>Default value may depend on `accuracy` option. |
| `mayShowUserSettingsDialog` *(optional)* | boolean | Specifies whether to ask the user to turn on improved accuracy location mode<br>which uses Wi-Fi, cell networks and GPS sensor. Default: `true` Available on platform: android |
| `timeInterval` *(optional)* | number | Minimum time to wait between each update in milliseconds.<br>Default value may depend on `accuracy` option. Available on platform: android |

#### LocationPermissionResponse (*Type*)
`LocationPermissionResponse` extends [`PermissionResponse`](#permissionresponse)
type exported by `expo-modules-core` and contains additional platform-specific fields.
| Property | Type | Description |
| --- | --- | --- |
| `android` *(optional)* | PermissionDetailsLocationAndroid | - |
| `ios` *(optional)* | PermissionDetailsLocationIOS | - |

#### LocationProviderStatus (*Type*)
Represents the object containing details about location provider.
| Property | Type | Description |
| --- | --- | --- |
| `backgroundModeEnabled` | boolean | - |
| `gpsAvailable` *(optional)* | boolean | Whether the GPS provider is available. If `true` the location data will come<br>from GPS, especially for requests with high accuracy. Available on platform: android |
| `locationServicesEnabled` | boolean | Whether location services are enabled. See [Location.hasServicesEnabledAsync](#locationhasservicesenabledasync)<br>for a more convenient solution to get this value. |
| `networkAvailable` *(optional)* | boolean | Whether the network provider is available. If `true` the location data will<br>come from cellular network, especially for requests with low accuracy. Available on platform: android |
| `passiveAvailable` *(optional)* | boolean | Whether the passive provider is available. If `true` the location data will<br>be determined passively. Available on platform: android |

#### LocationRegion (*Type*)
Type representing geofencing region object.
| Property | Type | Description |
| --- | --- | --- |
| `identifier` *(optional)* | string | The identifier of the region object. Defaults to auto-generated UUID hash. |
| `latitude` | number | The latitude in degrees of region's center point. |
| `longitude` | number | The longitude in degrees of region's center point. |
| `notifyOnEnter` *(optional)* | boolean | Boolean value whether to call the task if the device enters the region. Default: `true` |
| `notifyOnExit` *(optional)* | boolean | Boolean value whether to call the task if the device exits the region. Default: `true` |
| `radius` | number | The radius measured in meters that defines the region's outer boundary. |
| `state` *(optional)* | LocationGeofencingRegionState | One of [GeofencingRegionState](#geofencingregionstate) region state. Determines whether the<br>device is inside or outside a region. |

#### LocationSubscription (*Type*)
Represents subscription object returned by methods watching for new locations or headings.
| Property | Type | Description |
| --- | --- | --- |
| `remove` | () => void | Call this function with no arguments to remove this subscription. The callback will no longer<br>be called for location updates. |

#### LocationTaskOptions (*Type*)
Type representing background location task options.
| Property | Type | Description |
| --- | --- | --- |
| `activityType` *(optional)* | LocationActivityType | The type of user activity associated with the location updates. Default: `ActivityType.Other` Available on platform: ios |
| `deferredUpdatesDistance` *(optional)* | number | The distance in meters that must occur between last reported location and the current location<br>before deferred locations are reported. Default: `0` |
| `deferredUpdatesInterval` *(optional)* | number | Minimum time interval in milliseconds that must pass since last reported location before all<br>later locations are reported in a batched update Default: `0` |
| `deferredUpdatesTimeout` *(optional)* | number | - |
| `foregroundService` *(optional)* | LocationTaskServiceOptions | - |
| `pausesUpdatesAutomatically` *(optional)* | boolean | A boolean value indicating whether the location manager can pause location<br>updates to improve battery life without sacrificing location data. When this option is set to<br>`true`, the location manager pauses updates (and powers down the appropriate hardware) at times<br>when the location data is unlikely to change. You can help the determination of when to pause<br>location updates by assigning a value to the `activityType` property. Default: `false` Available on platform: ios |
| `showsBackgroundLocationIndicator` *(optional)* | boolean | A boolean indicating whether the status bar changes its appearance when<br>location services are used in the background. Default: `false` Available on platform: ios |

#### LocationTaskServiceOptions (*Type*)
| Property | Type | Description |
| --- | --- | --- |
| `killServiceOnDestroy` *(optional)* | boolean | Boolean value whether to destroy the foreground service if the app is killed. |
| `notificationBody` | string | Subtitle of the foreground service notification. |
| `notificationColor` *(optional)* | string | Color of the foreground service notification. Accepts `#RRGGBB` and `#AARRGGBB` hex formats. |
| `notificationTitle` | string | Title of the foreground service notification. |

#### PermissionDetailsLocationAndroid (*Type*)
| Property | Type | Description |
| --- | --- | --- |
| `accuracy` | 'fine' \| 'coarse' \| 'none' | Indicates the type of location provider. |

#### PermissionDetailsLocationIOS (*Type*)
| Property | Type | Description |
| --- | --- | --- |
| `scope` | 'whenInUse' \| 'always' \| 'none' | The scope of granted permission. Indicates when it's possible to use location. |

#### PermissionExpiration (*Type*)
Permission expiration time. Currently, all permissions are granted permanently.
Type: 'never' | number

#### PermissionHookOptions (*Type*)
Type: PermissionHookBehavior & Options

#### PermissionResponse (*Type*)
An object obtained by permissions get and request functions.
| Property | Type | Description |
| --- | --- | --- |
| `canAskAgain` | boolean | Indicates if user can be asked again for specific permission.<br>If not, one should be directed to the Settings app<br>in order to enable/disable the permission. |
| `expires` | PermissionExpiration | Determines time when the permission expires. |
| `granted` | boolean | A convenience boolean that indicates if the permission is granted. |
| `status` | PermissionStatus | Determines the status of the permission. |

### Enums

#### Accuracy (*Enum*)
Enum with available location accuracies.
#### Members
- `Balanced` — Accurate to within one hundred meters.
- `BestForNavigation` — The highest possible accuracy that uses additional sensor data to facilitate navigation apps.
- `High` — Accurate to within ten meters of the desired target.
- `Highest` — The best level of accuracy available.
- `Low` — Accurate to the nearest kilometer.
- `Lowest` — Accurate to the nearest three kilometers.

#### ActivityType (*Enum*)
Enum with available activity types of background location tracking.
#### Members
- `Airborne` — Intended for airborne activities. Fall backs to `ActivityType.Other` if
unsupported.
- `AutomotiveNavigation` — Location updates are being used specifically during vehicular navigation to track location
changes to the automobile.
- `Fitness` — Use this activity type if you track fitness activities such as walking, running, cycling,
and so on.
- `Other` — Default activity type. Use it if there is no other type that matches the activity you track.
- `OtherNavigation` — Activity type for movements for other types of vehicular navigation that are not automobile
related.

#### GeofencingEventType (*Enum*)
A type of the event that geofencing task can receive.
#### Members
- `Enter` — Emitted when the device entered observed region.
- `Exit` — Occurs as soon as the device left observed region

#### GeofencingRegionState (*Enum*)
State of the geofencing region that you receive through the geofencing task.
#### Members
- `Inside` — Indicates that the device is inside the region.
- `Outside` — Inverse of inside state.
- `Unknown` — Indicates that the device position related to the region is unknown.

#### PermissionStatus (*Enum*)
#### Members
- `DENIED` — User has denied the permission.
- `GRANTED` — User has granted the permission.
- `UNDETERMINED` — User hasn't granted or denied the permission yet.

## Permissions

### Android

> **warning** Foreground and background services are not available in Expo Go for Android. Instead, we recommend using a [development build](https://docs.expo.dev/develop/development-builds/introduction/) to avoid limitations.

When you install the `expo-location` module, it automatically adds the following permissions:

- `ACCESS_COARSE_LOCATION`: for approximate device location
- `ACCESS_FINE_LOCATION`: for precise device location

The following permissions are optional:

- `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_LOCATION`: to be able to access location while the app is open but backgrounded. `FOREGROUND_SERVICE_LOCATION` is only required as of Android 14. When you enable this in a new build, you will need to [submit your app for review and request access to use the foreground service permission](https://support.google.com/googleplay/android-developer/answer/13392821?hl=en).
- `ACCESS_BACKGROUND_LOCATION`: to be able to access location while the app is backgrounded or closed. When you enable this in a new build, you will need to [submit your app for review and request access to use the background location permission](https://support.google.com/googleplay/android-developer/answer/9799150?hl=en).

<AndroidPermissions
  permissions={[
    'ACCESS_COARSE_LOCATION',
    'ACCESS_FINE_LOCATION',
    'FOREGROUND_SERVICE',
    'FOREGROUND_SERVICE_LOCATION',
    'ACCESS_BACKGROUND_LOCATION',
  ]}
/>

#### Excluding a permission

> **Note**: Excluding a **required permission** from a module in your app can break the functionality corresponding to that permission. Always make sure to include all permissions a module is dependent on.

When your Expo project doesn't benefit from having particular permission included, you can omit it. For example, if your application doesn't need access to the precise location, you can exclude the `ACCESS_FINE_LOCATION` permission.

Another example can be stated using [available location accuracies](#accuracy). Android defines the approximate location accuracy estimation within about 3 square kilometers, and the precise location accuracy estimation within about 50 meters. For example, if the location accuracy value is [Low](#low), you can exclude `ACCESS_FINE_LOCATION` permission. To learn more about levels of location accuracies, see [Android documentation](https://developer.android.com/training/location/permissions#accuracy).

To learn more on how to exclude permission, see [Excluding Android permissions](https://docs.expo.dev/guides/permissions/#excluding-android-permissions).

### iOS

The following usage description keys are used by this library:

<IOSPermissions
  permissions={[
    'NSLocationAlwaysAndWhenInUseUsageDescription',
    'NSLocationAlwaysUsageDescription',
    'NSLocationWhenInUseUsageDescription',
  ]}
/>

`NSLocationAlwaysUsageDescription` is deprecated in favor of `NSLocationAlwaysAndWhenInUseUsageDescription` from iOS 11.
