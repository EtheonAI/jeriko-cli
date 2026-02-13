---
name: maps
description: Display interactive maps and map controls.
metadata:
  sdk: react-native
  type: react-native-module
---

# react-native-maps

_A library that provides a Map component that uses Google Maps on Android and Apple Maps or Google Maps on iOS._

Available on platforms android, ios

`react-native-maps` provides a Map component that uses Google Maps on Android and Apple Maps or Google Maps on iOS.

No additional setup is required when testing your project using Expo Go. However, **to deploy the app binary on app stores** additional steps are required for Google Maps. For more information, see the [instructions below](#deploy-app-with-google-maps).

## Quick Start

Here is a minimal example of a map with a marker.

```jsx
import React from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet, View, Dimensions } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 37.78825,
          longitude: -122.4324,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        <Marker
          coordinate={{ latitude: 37.78825, longitude: -122.4324 }}
          title={"A Marker"}
          description={"A Description"}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  map: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
});
```

## When to Use

Use `react-native-maps` to display interactive maps in your application. It is ideal for showing a user's location, displaying points of interest, or providing navigation functionality.

## Common Pitfalls

### 1. Map does not appear, or only the Google logo is visible.

*   **Problem**: This is often due to incorrect API key configuration or missing permissions. On Android, if the API key is not correctly configured in `app.json`, the map will not render.
*   **Solution**: Ensure your Google Maps API key is correctly added to your `app.json` file and that the Maps SDK for your platform is enabled in the Google Cloud Console.

### 2. `onRegionChange` is called too frequently, causing performance issues.

*   **Problem**: The `onRegionChange` callback is fired continuously as the user pans and zooms the map, which can lead to performance degradation if you are performing heavy operations in the callback.
*   **Solution**: Use the `onRegionChangeComplete` callback instead, which is only called once after the user has finished interacting with the map.

```jsx
<MapView
  onRegionChangeComplete={(region) => console.log(region)}
/>
```

## Common Patterns

### Animating to a specific location

You can animate the map to a new region or coordinate using a `ref` to the `MapView` component.

```jsx
import React, { useRef } from 'react';
import MapView from 'react-native-maps';
import { StyleSheet, View, Button } from 'react-native';

export default function App() {
  const mapRef = useRef(null);

  const goToNewYork = () => {
    mapRef.current.animateToRegion({
      latitude: 40.7128,
      longitude: -74.0060,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    }, 1000); // 1000ms animation duration
  };

  return (
    <View style={styles.container}>
      <MapView ref={mapRef} style={styles.map} />
      <View style={styles.buttonContainer}>
        <Button onPress={goToNewYork} title="Go to New York" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  buttonContainer: {
    marginBottom: 20,
  },
});
```

## Installation

```bash
$ npx expo install react-native-maps
```

If you are installing this in an existing React Native app, make sure to install `expo` in your project. Follow the installation instructions at https://github.com/react-native-maps/react-native-maps/blob/master/docs/installation.md.

## Usage

See full documentation at [`react-native-maps/react-native-maps`](https://github.com/react-native-maps/react-native-maps).

```jsx
import React from 'react';
import MapView from 'react-native-maps';
import { StyleSheet, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <MapView style={styles.map} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
});
```

## Deploy app with Google Maps

### Android

> If you have already registered a project for another Google service on Android, such as Google Sign In, you enable the **Maps SDK for Android** on your project and jump to step 4.

<Step label="1">
#### Register a Google Cloud API project and enable the Maps SDK for Android

- Open your browser to the [Google API Manager](https://console.developers.google.com/apis) and create a project.
- Once it's created, go to the project and enable the **Maps SDK for Android**.

</Step>

<Step label="2">
#### Copy your app's SHA-1 certificate fingerprint

- **If you are deploying your app to the Google Play Store**, you'll need to [upload your app binary to Google Play console](https://docs.expo.dev/submit/android/) at least once. This is required for Google to generate your app signing credentials.
- Go to the **[Google Play Console](https://play.google.com/console) > (your app) > Test and release > App integrity > Play app signing > Settings > App signing key certificate**.
- Copy the value of **SHA-1 certificate fingerprint**.

- If you have already created a [development build](https://docs.expo.dev/develop/development-builds/introduction/), your project will be signed using a debug keystore.
- After the build is complete, go to your [project's dashboard](https://expo.dev/accounts/[username]/projects/[project-name]), then, under **Configure** > click **Credentials**.
- Under **Application Identifiers**, click your project's package name and under **Android Keystore** copy the value of **SHA-1 Certificate Fingerprint**.

</Step>

<Step label="3">
#### Create an API key
- Go to [Google Cloud Credential manager](https://console.cloud.google.com/apis/credentials) and click **Create Credentials**, then **API Key**.
- In the modal, click **Edit API key**.
- Under **Key restrictions** > **Application restrictions**, choose **Android apps**.
- Under **Restrict usage to your Android apps**, click **Add an item**.
- Add your `android.package` from **app.json** (for example: `com.company.myapp`) to the package name field.
- Then, add the **SHA-1 certificate fingerprint's** value from step 2.
- Click **Done** and then click **Save**.

</Step>

<Step label="4">
#### Add the API key to your project

Since you are using Google as the map provider, you need to add the API key to the `react-native-maps` [config plugin](https://docs.expo.dev/config-plugins/introduction/). Copy your **API Key** into your project to either a **.env** file or copy it directly and then add it to your app config under the `plugins.react-native-maps.androidGoogleMapsApiKey` field like:

```json app.json
{
  "expo": {
    "plugins": [
      [
        "react-native-maps",
        {
          "androidGoogleMapsApiKey": "process.env.YOUR_GOOGLE_MAPS_API_KEY"
        }
      ]
    ]
  }
}
```

- In your code, import `{ PROVIDER_GOOGLE }` from `react-native-maps` and add the property `provider={PROVIDER_GOOGLE}` to your `<MapView>`. This property works on both Android and iOS.
- Rebuild the app binary (or re-submit to the Google Play Store in case your app is already uploaded). An easy way to test if the configuration was successful is to do an [emulator build](https://docs.expo.dev/develop/development-builds/create-a-build/#build-the-native-app-ios-simulator).

</Step>

### iOS

> If you have already registered a project for another Google service on iOS, such as Google Sign In, you enable the **Maps SDK for iOS** on your project and jump to step 3.

<Step label="1">
#### Register a Google Cloud API project and enable the Maps SDK for iOS

- Open your browser to the [Google API Manager](https://console.developers.google.com/apis) and create a project.
- Then, go to the project, click **Enable APIs and Services** and enable the **Maps SDK for iOS**.

</Step>

<Step label="2">
#### Create an API key

- Go to [Google Cloud Credential manager](https://console.cloud.google.com/apis/credentials) and click **Create Credentials**, then **API Key**.
- In the modal, click **Edit API key**.
- Under **Key restrictions** > **Application restrictions**, choose **iOS apps**.
- Under **Accept requests from an iOS application with one of these bundle identifiers**, click the **Add an item** button.
- Add your `ios.bundleIdentifier` from **app.json** (for example: `com.company.myapp`) to the bundle ID field.
- Click **Done** and then click **Save**.

</Step>

<Step label="3">
#### Add the API key to your project

Since you are using Google as the map provider, you need to add the API key to the `react-native-maps` [config plugin](https://docs.expo.dev/config-plugins/introduction/). Copy your **API Key** into your project to either a **.env** file or copy it directly and then add it to your app config under the `plugins.react-native-maps.iosGoogleMapsApiKey` field like:

```json app.json
{
  "expo": {
    "plugins": [
      [
        "react-native-maps",
        {
          "iosGoogleMapsApiKey": "process.env.YOUR_GOOGLE_MAPS_API_KEY"
        }
      ]
    ]
  }
}
```

- In your code, import `{ PROVIDER_GOOGLE }` from `react-native-maps` and add the property `provider={PROVIDER_GOOGLE}` to your `<MapView>`. This property works on both Android and iOS.
- Rebuild the app binary. An easy way to test if the configuration was successful is to do a [simulator build](https://docs.expo.dev/develop/development-builds/create-a-build/#build-the-native-app-ios-simulator).

</Step>
