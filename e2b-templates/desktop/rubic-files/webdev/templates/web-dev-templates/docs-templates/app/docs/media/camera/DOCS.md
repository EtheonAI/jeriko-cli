---
name: camera
description: Capture photos and videos, scan barcodes using device camera.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Camera

A React component that renders a preview for the device's front or back camera.

**Platforms:** android*, ios*, web (asterisk indicates camera/microphone permissions required)

**Package:** `expo-camera`

`expo-camera` provides a React component that renders a preview of the device's front or back camera. The camera's parameters such as zoom, torch, and flash mode are adjustable. Using `CameraView`, you can take photos and record videos that are saved to the app's cache. The component is also capable of detecting bar codes appearing in the preview. Run the [example](#usage) on your device to see all these features working together.

## Installation

```bash
$ npx expo install expo-camera
```

## Configuration in app config

You can configure `expo-camera` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone",
          "recordAudioAndroid": true
        }
      ]
    ]
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) (you're using native **android** and **ios** projects manually), then you need to configure following permissions in your native projects:

**Android**

- `expo-camera` automatically adds `android.permission.CAMERA` permission to your project's **android/app/src/main/AndroidManifest.xml**. If you want to record videos with audio, include `RECORD_AUDIO` permission:

  ```xml
  <!-- Added permission -->
  <uses-permission android:name="android.permission.CAMERA" />

  <!-- Only add when recording videos with audio -->
  <uses-permission android:name="android.permission.RECORD_AUDIO" />
  ```

- Then, adjust the **android/build.gradle** file to add new maven block after all other repositories as show below:

  ```groovy
  allprojects {
    repositories {
        // * Your other repositories here *
        // * Add a new maven block after other repositories / blocks *
        maven {
            // expo-camera bundles a custom com.google.android:cameraview
            url "$rootDir/../node_modules/expo-camera/android/maven"
        }
    }
  }
  ```

**iOS**

- Add `NSCameraUsageDescription` and `NSMicrophoneUsageDescription` keys to your project's **ios/[app]/Info.plist**:

  ```xml
  <key>NSCameraUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your camera</string>
  <key>NSMicrophoneUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your microphone</string>
  ```

## Quick recipes (copy/paste)

These are the “common patterns” you’ll reach for most often. The full API reference remains below.

### Permissions (async)

```ts
import { Camera } from 'expo-camera';

// Camera permission
const cam = await Camera.requestCameraPermissionsAsync();
// cam.status, cam.granted

// Microphone permission (video with audio)
const mic = await Camera.requestMicrophonePermissionsAsync();
```

### Basic camera component (flip front/back)

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function CameraExample() {
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing}>
        <View style={styles.controls}>
          <Button
            title="Flip"
            onPress={() => setFacing(cur => (cur === 'back' ? 'front' : 'back'))}
          />
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  message: { textAlign: 'center', paddingBottom: 10 },
  controls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
});
```

### Take a picture (ref)

```tsx
import { CameraView } from 'expo-camera';
import { useRef } from 'react';
import { Button } from 'react-native';

const cameraRef = useRef<CameraView>(null);

async function takePicture() {
  const camera = cameraRef.current;
  if (!camera) return null;

  const photo = await camera.takePictureAsync({
    quality: 0.8,
    exif: true,
    base64: false,
    skipProcessing: false,
  });

  console.log('Photo URI:', photo.uri);
}

export function TakePhoto() {
  return (
    <CameraView ref={cameraRef} style={{ flex: 1 }}>
      <Button title="Take picture" onPress={takePicture} />
    </CameraView>
  );
}
```

### Record a video (not available on web)

```ts
import { Platform } from 'react-native';

async function recordVideo() {
  if (Platform.OS === 'web') {
    throw new Error('expo-camera: recordAsync() is not available on web');
  }

  const camera = cameraRef.current;
  if (!camera) return null;

  const video = await camera.recordAsync({
    maxDuration: 60, // seconds
    quality: '720p',
    mute: false,
  });

  console.log('Video URI:', video.uri);
}

function stopRecording() {
  cameraRef.current?.stopRecording();
}
```

### Barcode scanning (avoid double-fires)

```tsx
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';

export function BarcodeScanner() {
  const [scanned, setScanned] = useState(false);

  function onBarcodeScanned({ type, data }: BarcodeScanningResult) {
    setScanned(true);
    console.log('Scanned:', type, data);
  }

  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'] }}
      onBarcodeScanned={scanned ? undefined : onBarcodeScanned}
    />
  );
}
```

### Pause / resume preview (performance)

```ts
await cameraRef.current?.pausePreview();
await cameraRef.current?.resumePreview();
```

## Best practices / gotchas

- Only **one** camera preview should be active at a time (unmount on navigation blur/unfocus).
- Always handle permissions before rendering the preview (and show a fallback UI).
- On web, feature support varies by browser; guard `recordAsync()` and test your target browsers.
- For scanning, guard `onBarcodeScanned` to avoid repeated triggers.
- Pause preview when camera is not visible to save CPU/battery.

## Usage

> **warning** Only one Camera preview can be active at any given time. If you have multiple screens in your app, you should unmount `Camera` components whenever a screen is unfocused.

```tsx

export default function App() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    // Camera permissions are still loading.
    return null;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      We need your permission to show the camera
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  return (
    Flip Camera
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 64,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    width: '100%',
    paddingHorizontal: 64,
  },
  button: {
    flex: 1,
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
});
```

### Advanced usage

<!-- (Expo docs component omitted) | title: Camera app example | description: A complete example that shows how to take a picture and display it. Written in TypeScript. | link: https://github.com/expo/examples/tree/master/with-camera -->

## Web support

Most browsers support a version of web camera functionality, you can check out the [web camera browser support here](https://caniuse.com/#feat=stream). Image URIs are always returned as base64 strings because local file system paths are unavailable in the browser.

### Chrome `iframe` usage

When using **Chrome versions 64+**, if you try to use a web camera in a cross-origin iframe nothing will render. To add support for cameras in your iframe simply add the attribute `allow="microphone; camera;"` to the iframe element:

```html
<iframe src="..." allow="microphone; camera;">
  <!--  -->
</iframe>
```

## API

```js

```

## Permissions

### Android

This package automatically adds the `CAMERA` permission to your app. If you want to record videos with audio, you have to include the `RECORD_AUDIO` in your **app.json** inside the [`expo.android.permissions`](../config/app/#permissions) array.

### iOS

The following usage description keys are used by this library:

## API Reference

### Classes

#### CameraNativeModule

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `dismissScanner` | `() => Promise<void>` | - |
| `getAvailableVideoCodecsAsync` | `() => Promise<VideoCodec[]>` | - |
| `getCameraPermissionsAsync` | `() => Promise<PermissionResponse>` | - |
| `getMicrophonePermissionsAsync` | `() => Promise<PermissionResponse>` | - |
| `isAvailableAsync` | `() => Promise<boolean>` | - |
| `isModernBarcodeScannerAvailable` | `boolean` | - |
| `launchScanner` | `(options: ScanningOptions) => Promise<void>` | - |
| `requestCameraPermissionsAsync` | `() => Promise<PermissionResponse>` | - |
| `requestMicrophonePermissionsAsync` | `() => Promise<PermissionResponse>` | - |
| `scanFromURLAsync` | `(url: string, barcodeTypes: BarcodeType[]) => Promise<BarcodeScanningResult[]>` | - |
| `toggleRecordingAsyncAvailable` | `boolean` | - |

**Methods:**

- `addListener(eventName: EventName, listener: unknown): EventSubscription`
  Adds a listener for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `listener` | `unknown` | - |

- `emit(eventName: EventName, args: Parameters<unknown>): void`
  Synchronously calls all the listeners attached to that specific event.
The event can include any number of arguments that will be passed to the listeners.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `args` | `Parameters<unknown>` | - |

- `listenerCount(eventName: EventName): number`
  Returns a number of listeners added to the given event.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

- `removeAllListeners(eventName: 'onModernBarcodeScanned'): void`
  Removes all listeners for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `'onModernBarcodeScanned'` | - |

- `removeListener(eventName: EventName, listener: unknown): void`
  Removes a listener for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `listener` | `unknown` | - |

- `startObserving(eventName: EventName): void`
  Function that is automatically invoked when the first listener for an event with the given name is added.
Override it in a subclass to perform some additional setup once the event started being observed.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

- `stopObserving(eventName: EventName): void`
  Function that is automatically invoked when the last listener for an event with the given name is removed.
Override it in a subclass to perform some additional cleanup once the event is no longer observed.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

#### CameraView

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `_cameraHandle` | `null | number` | - |
| `_cameraRef` | `RefObject<null | CameraViewRef>` | - |
| `_lastEvents` | `object` | - |
| `_lastEventsTimes` | `object` | - |
| `ConversionTables` | `{ flash: Record<number | unknown | 'toString' | 'charAt' | 'charCodeAt' | 'concat' | 'indexOf' | 'lastIndexOf' | 'localeCompare' | 'match' | 'replace' | 'search' | 'slice' | 'split' | 'substring' | 'toLowerCase' | 'toLocaleLowerCase' | 'toUpperCase' | 'toLocaleUpperCase' | 'trim' | 'length' | 'substr' | 'valueOf' | 'codePointAt' | 'includes' | 'endsWith' | 'normalize' | 'repeat' | 'startsWith' | 'anchor' | 'big' | 'blink' | 'bold' | 'fixed' | 'fontcolor' | 'fontsize' | 'italics' | 'link' | 'small' | 'strike' | 'sub' | 'sup' | 'padStart' | 'padEnd' | 'trimEnd' | 'trimStart' | 'trimLeft' | 'trimRight' | 'matchAll' | 'replaceAll' | 'at' | 'isWellFormed' | 'toWellFormed', undefined | string>; type: Record<number | unknown | 'toString' | 'charAt' | 'charCodeAt' | 'concat' | 'indexOf' | 'lastIndexOf' | 'localeCompare' | 'match' | 'replace' | 'search' | 'slice' | 'split' | 'substring' | 'toLowerCase' | 'toLocaleLowerCase' | 'toUpperCase' | 'toLocaleUpperCase' | 'trim' | 'length' | 'substr' | 'valueOf' | 'codePointAt' | 'includes' | 'endsWith' | 'normalize' | 'repeat' | 'startsWith' | 'anchor' | 'big' | 'blink' | 'bold' | 'fixed' | 'fontcolor' | 'fontsize' | 'italics' | 'link' | 'small' | 'strike' | 'sub' | 'sup' | 'padStart' | 'padEnd' | 'trimEnd' | 'trimStart' | 'trimLeft' | 'trimRight' | 'matchAll' | 'replaceAll' | 'at' | 'isWellFormed' | 'toWellFormed', undefined | string> }` | - |
| `defaultProps` | `CameraViewProps` | - |
| `isModernBarcodeScannerAvailable` | `boolean` | Property that determines if the current device has the ability to use `DataScannerViewController` (iOS 16+) or the Google code scanner (Android). |

**Methods:**

- `_onAvailableLensesChanged(__namedParameters: { nativeEvent: AvailableLenses }): void`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `__namedParameters` | `{ nativeEvent: AvailableLenses }` | - |

- `_onCameraReady(): void`

- `_onMountError(__namedParameters: { nativeEvent: { message: string } }): void`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `__namedParameters` | `{ nativeEvent: { message: string } }` | - |

- `_onObjectDetected(callback: Function): (__namedParameters: { nativeEvent: any }) => void`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `callback` | `Function` | - |

- `_onResponsiveOrientationChanged(__namedParameters: { nativeEvent: { orientation: CameraOrientation } }): void`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `__namedParameters` | `{ nativeEvent: { orientation: CameraOrientation } }` | - |

- `_setReference(ref: Ref<CameraViewRef>): void`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `ref` | `Ref<CameraViewRef>` | - |

- `getAvailableLensesAsync(): Promise<string[]>`
  Returns the available lenses for the currently selected camera.
  **Returns:** Returns a Promise that resolves to an array of strings representing the lens type that can be passed to `selectedLens` prop.

- `getAvailablePictureSizesAsync(): Promise<string[]>`
  Get picture sizes that are supported by the device.
  **Returns:** Returns a Promise that resolves to an array of strings representing picture sizes that can be passed to `pictureSize` prop.
The list varies across Android devices but is the same for every iOS.

- `getSupportedFeatures(): { isModernBarcodeScannerAvailable: boolean; toggleRecordingAsyncAvailable: boolean }`
  Returns an object with the supported features of the camera on the current device.

- `pausePreview(): Promise<void>`
  Pauses the camera preview. It is not recommended to use `takePictureAsync` when preview is paused.

- `recordAsync(options: CameraRecordingOptions): Promise<undefined | { uri: string }>`
  Starts recording a video that will be saved to cache directory. Videos are rotated to match device's orientation.
Flipping camera during a recording results in stopping it.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | `CameraRecordingOptions` | A map of `CameraRecordingOptions` type. |
  **Returns:** Returns a Promise that resolves to an object containing video file `uri` property and a `codec` property on iOS.
The Promise is returned if `stopRecording` was invoked, one of `maxDuration` and `maxFileSize` is reached or camera preview is stopped.

- `render(): Element`

- `resumePreview(): Promise<void>`
  Resumes the camera preview.

- `stopRecording(): void`
  Stops recording if any is in progress.

- `takePictureAsync(optionsWithRef: unknown): Promise<PictureRef>`
  Takes a picture and returns an object that references the native image instance.
> **Note**: Make sure to wait for the [`onCameraReady`](#oncameraready) callback before calling this method.

> **Note:** Avoid calling this method while the preview is paused. On Android, this will throw an error. On iOS, this will take a picture of the last frame that is currently on screen.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `optionsWithRef` | `unknown` | An object in form of `CameraPictureOptions` type and `pictureRef` key set to `true`. |
  **Returns:** Returns a Promise that resolves to `PictureRef` class which contains basic image data, and a reference to native image instance which can be passed
to other Expo packages supporting handling such an instance.

- `toggleRecordingAsync(): Promise<undefined | void>`
  Pauses or resumes the video recording. Only has an effect if there is an active recording. On `iOS`, this method only supported on `iOS` 18.

- `dismissScanner(): Promise<void>`
  Dismiss the scanner presented by `launchScanner`.
> **info** On Android, the scanner is dismissed automatically when a barcode is scanned.

- `getAvailableVideoCodecsAsync(): Promise<VideoCodec[]>`
  Queries the device for the available video codecs that can be used in video recording.
  **Returns:** A promise that resolves to a list of strings that represents available codecs.

- `isAvailableAsync(): Promise<boolean>`
  Check whether the current device has a camera. This is useful for web and simulators cases.
This isn't influenced by the Permissions API (all platforms), or HTTP usage (in the browser).
You will still need to check if the native permission has been accepted.

- `launchScanner(options: ScanningOptions): Promise<void>`
  On Android, we will use the [Google code scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner).
On iOS, presents a modal view controller that uses the [`DataScannerViewController`](https://developer.apple.com/documentation/visionkit/scanning_data_with_the_camera) available on iOS 16+.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | `ScanningOptions` | - |

- `onModernBarcodeScanned(listener: (event: ScanningResult) => void): EventSubscription`
  Invokes the `listener` function when a bar code has been successfully scanned. The callback is provided with
an object of the `ScanningResult` shape, where the `type` refers to the bar code type that was scanned and the `data` is the information encoded in the bar code
(in this case of QR codes, this is often a URL). See [`BarcodeType`](#barcodetype) for supported values.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `listener` | `(event: ScanningResult) => void` | Invoked with the [ScanningResult](#scanningresult) when a bar code has been successfully scanned. |

#### PictureRef

A reference to a native instance of the image.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `height` | `number` | Height of the image. |
| `nativeRefType` | `string` | The type of the native reference. |
| `width` | `number` | Width of the image. |

**Methods:**

- `addListener(eventName: EventName, listener: unknown): EventSubscription`
  Adds a listener for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `listener` | `unknown` | - |

- `emit(eventName: EventName, args: Parameters<unknown>): void`
  Synchronously calls all the listeners attached to that specific event.
The event can include any number of arguments that will be passed to the listeners.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `args` | `Parameters<unknown>` | - |

- `listenerCount(eventName: EventName): number`
  Returns a number of listeners added to the given event.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

- `release(): void`
  A function that detaches the JS and native objects to let the native object deallocate
before the JS object gets deallocated by the JS garbage collector. Any subsequent calls to native
functions of the object will throw an error as it is no longer associated with its native counterpart.

In most cases, you should never need to use this function, except some specific performance-critical cases when
manual memory management makes sense and the native object is known to exclusively retain some native memory
(such as binary data or image bitmap). Before calling this function, you should ensure that nothing else will use
this object later on. Shared objects created by React hooks are usually automatically released in the effect's cleanup phase,
for example: `useVideoPlayer()` from `expo-video` and `useImage()` from `expo-image`.

- `removeAllListeners(eventName: never): void`
  Removes all listeners for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `never` | - |

- `removeListener(eventName: EventName, listener: unknown): void`
  Removes a listener for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `listener` | `unknown` | - |

- `savePictureAsync(options: SavePictureOptions): Promise<PhotoResult>`
  Saves the image to the file system in the cache directory.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | `SavePictureOptions` | A map defining how modified image should be saved. |

- `startObserving(eventName: EventName): void`
  Function that is automatically invoked when the first listener for an event with the given name is added.
Override it in a subclass to perform some additional setup once the event started being observed.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

- `stopObserving(eventName: EventName): void`
  Function that is automatically invoked when the last listener for an event with the given name is removed.
Override it in a subclass to perform some additional cleanup once the event is no longer observed.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

### Methods

#### scanFromURLAsync

Scan bar codes from the image at the given URL.

```typescript
scanFromURLAsync(url: string, barcodeTypes: BarcodeType[]): Promise<BarcodeScanningResult[]>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | URL to get the image from. |
| `barcodeTypes` | `BarcodeType[]` | An array of bar code types. Defaults to all supported bar code types on the platform. Note: Only QR codes are supported on iOS. On Android, the barcode should take up the majority of the image for best results. |

**Returns:** A possibly empty array of objects of the `BarcodeScanningResult` shape, where the type
refers to the barcode type that was scanned and the data is the information encoded in the barcode.

#### useCameraPermissions

```typescript
useCameraPermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PermissionHookOptions<object>` | - |

#### useMicrophonePermissions

```typescript
useMicrophonePermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PermissionHookOptions<object>` | - |

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types

#### AvailableLenses

| Property | Type | Description |
| --- | --- | --- |
| `lenses` | `string[]` | - |

#### BarcodeBounds

| Property | Type | Description |
| --- | --- | --- |
| `origin` | `BarcodePoint` | The origin point of the bounding box. |
| `size` | `BarcodeSize` | The size of the bounding box. |

#### BarcodePoint

These coordinates are represented in the coordinate space of the camera source (e.g. when you
are using the camera view, these values are adjusted to the dimensions of the view).

**Type:** `Point`

#### BarcodeScanningResult

| Property | Type | Description |
| --- | --- | --- |
| `bounds` | `BarcodeBounds` | The [`BarcodeBounds`](#barcodebounds) object. It may be an empty rectangle and may not bound the whole barcode; for some types it represents the scanner area. |
| `cornerPoints` | `BarcodePoint[]` | Corner points of the bounding box. May be empty; on iOS for `code39` and `pdf417` this value is not provided. Corner point order differs by platform (Android: `topLeft`, `topRight`, `bottomRight`, `bottomLeft`; iOS: `bottomLeft`, `bottomRight`, `topLeft`, `topRight`; Web: `topLeft`, `bottomLeft`, `topRight`, `bottomRight`). |
| `data` | `string` | The parsed information encoded in the barcode. |
| `extra` | `AndroidBarcode` | Extra information returned by the specific type of barcode. |
| `type` | `string` | The barcode type. |

#### BarcodeSettings

| Property | Type | Description |
| --- | --- | --- |
| `barcodeTypes` | `BarcodeType[]` | - |

#### BarcodeSize

| Property | Type | Description |
| --- | --- | --- |
| `height` | `number` | The height value. |
| `width` | `number` | The width value. |

#### BarcodeType

The available barcode types that can be scanned.

**Type:** `'aztec' | 'ean13' | 'ean8' | 'qr' | 'pdf417' | 'upc_e' | 'datamatrix' | 'code39' | 'code93' | 'itf14' | 'codabar' | 'code128' | 'upc_a'`

#### CameraCapturedPicture

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `string` | A Base64 representation of the image. |
| `exif` | `Partial<MediaTrackSettings> | any` | On Android and iOS this object may include various fields based on the device and operating system. On web, it is a partial representation of the [`MediaTrackSettings`](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackSettings) dictionary. |
| `format` | `'jpg' | 'png'` | The format of the captured image. |
| `height` | `number` | Captured image height. |
| `uri` | `string` | On web, the value of `uri` is the same as `base64` because file system URLs are not supported in the browser. |
| `width` | `number` | Captured image width. |

#### CameraEvents

| Property | Type | Description |
| --- | --- | --- |
| `onModernBarcodeScanned` | `(event: ScanningResult) => void` | - |

#### CameraMode

**Type:** `'picture' | 'video'`

#### CameraMountError

| Property | Type | Description |
| --- | --- | --- |
| `message` | `string` | - |

#### CameraOrientation

**Type:** `'portrait' | 'portraitUpsideDown' | 'landscapeLeft' | 'landscapeRight'`

#### CameraPictureOptions

| Property | Type | Description |
| --- | --- | --- |
| `additionalExif` | `Record<string, any>` | Additional EXIF data to be included for the image. Only useful when `exif` option is set to `true`. |
| `base64` | `boolean` | Whether to also include the image data in Base64 format. |
| `exif` | `boolean` | Whether to also include the EXIF data for the image. |
| `imageType` | `ImageType` | - |
| `isImageMirror` | `boolean` | - |
| `mirror` | `boolean` | When set to `true`, the output image will be flipped along the vertical axis when using the front camera. |
| `onPictureSaved` | `(picture: CameraCapturedPicture) => void` | A callback invoked when picture is saved. If set, the promise resolves immediately with no data after capture; the data is passed to this callback. Use this to avoid waiting for file IO when you don't need the saved photo immediately. |
| `pictureRef` | `boolean` | Whether the camera should return an image ref that can be used directly in the `Image` component. |
| `quality` | `number` | Specify the compression quality from `0` to `1`. `0` means compress for small size, and `1` means compress for maximum quality. |
| `scale` | `number` | - |
| `shutterSound` | `boolean` | To programmatically disable the camera shutter sound |
| `skipProcessing` | `boolean` | If `true`, camera skips orientation adjustment and returns an image straight from the device camera. This can significantly reduce capture time, but may result in incorrect orientation when displayed (the `Image` component may not respect EXIF orientation). Different devices behave differently; disable this if you need consistently oriented results. |

#### CameraRatio

**Type:** `'4:3' | '16:9' | '1:1'`

#### CameraRecordingOptions

| Property | Type | Description |
| --- | --- | --- |
| `codec` | `VideoCodec` | This option specifies what codec to use when recording the video. See [`VideoCodec`](#videocodec) for the possible values. |
| `maxDuration` | `number` | Maximum video duration in seconds. |
| `maxFileSize` | `number` | Maximum video file size in bytes. |
| `mirror` | `boolean` | If `true`, the recorded video will be flipped along the vertical axis. iOS flips front camera videos by default; set this to `true` to reverse that. On Android, mirroring is handled by device settings. |

#### CameraType

**Type:** `'front' | 'back'`

#### CameraViewProps

**Type:** `unknown`

#### FlashMode

**Type:** `'off' | 'on' | 'auto'`

#### FocusMode

This option specifies the mode of focus on the device.
- `on` - Indicates that the device should autofocus once and then lock the focus.
- `off` - Indicates that the device should automatically focus when needed.

**Type:** `'on' | 'off'`

#### ImageType

**Type:** `'png' | 'jpg'`

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

#### PermissionHookOptions

**Type:** `unknown`

#### PermissionResponse

An object obtained by permissions get and request functions.

| Property | Type | Description |
| --- | --- | --- |
| `canAskAgain` | `boolean` | Indicates if user can be asked again for the permission. If not, direct them to the Settings app to enable/disable it. |
| `expires` | `PermissionExpiration` | Determines time when the permission expires. |
| `granted` | `boolean` | A convenience boolean that indicates if the permission is granted. |
| `status` | `PermissionStatus` | Determines the status of the permission. |

#### PhotoResult

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `string` | A Base64 representation of the image. |
| `height` | `number` | Height of the image. |
| `uri` | `string` | A URI to the modified image (usable as the source for an `Image` or `Video` element). |
| `width` | `number` | Width of the image. |

#### Point

| Property | Type | Description |
| --- | --- | --- |
| `x` | `number` | - |
| `y` | `number` | - |

#### ResponsiveOrientationChanged

| Property | Type | Description |
| --- | --- | --- |
| `orientation` | `CameraOrientation` | - |

#### SavePictureOptions

A map defining how modified image should be saved.

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `boolean` | Whether to also include the image data in Base64 format. |
| `metadata` | `Record<string, any>` | Additional metadata to be included for the image. |
| `quality` | `number` | Specify the compression quality from `0` to `1`. `0` means compress for small size, and `1` means compress for maximum quality. |

#### ScanningOptions

| Property | Type | Description |
| --- | --- | --- |
| `barcodeTypes` | `BarcodeType[]` | The type of codes to scan for. |
| `isGuidanceEnabled` | `boolean` | Guidance text, such as “Slow Down,” appears over the live video. |
| `isHighlightingEnabled` | `boolean` | Indicates whether the scanner displays highlights around recognized items. |
| `isPinchToZoomEnabled` | `boolean` | Indicates whether people can use a two-finger pinch-to-zoom gesture. |

#### ScanningResult

**Type:** `Omit<BarcodeScanningResult, 'bounds' | 'cornerPoints'>`

#### VideoCodec

This option specifies what codec to use when recording a video.

**Type:** `'avc1' | 'hvc1' | 'jpeg' | 'apcn' | 'ap4h'`

#### VideoQuality

**Type:** `'2160p' | '1080p' | '720p' | '480p' | '4:3'`

#### VideoStabilization

This option specifies the stabilization mode to use when recording a video.

**Type:** `'off' | 'standard' | 'cinematic' | 'auto'`

### Enums

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |## Quick Start

This example shows the minimal code to get a camera preview running. It requests permission and displays the camera view.

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function QuickStart() {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  camera: { flex: 1 },
});
```

## When to Use

Use the `expo-camera` module whenever you need to embed a live camera feed into your app. It's ideal for taking photos, recording videos, or scanning barcodes like QR codes. For picking images or videos from the user's library, use `expo-image-picker` instead.

## Common Pitfalls

Here are some common issues developers face when using `expo-camera`:

### 1. Camera preview is stretched or distorted

**Problem**: The camera preview does not match the aspect ratio of the device's camera, causing the image to appear stretched or squeezed.

**Solution**: Use the `camera.getAvailablePictureSizesAsync()` method to get a list of supported ratios and apply it to the `CameraView` component. This ensures the preview respects the hardware's aspect ratio.

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useEffect, useState, useRef } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function AspectRatio() {
  const [permission, requestPermission] = useCameraPermissions();
  const [ratio, setRatio] = useState('4:3');
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    (async () => {
      if (permission?.granted && cameraRef.current) {
        const ratios = await cameraRef.current.getAvailablePictureSizesAsync('4:3');
        // setRatio(ratios[0]); // Find the best ratio for your UI
      }
    })();
  }, [permission?.granted]);

  if (!permission) return <View />;
  if (!permission.granted) return <Text>No access to camera</Text>;

  return (
    <CameraView style={styles.camera} ratio={ratio} ref={cameraRef} />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
```

### 2. `onBarcodeScanned` fires multiple times for a single scan

**Problem**: When scanning a barcode, the `onBarcodeScanned` callback is triggered continuously as long as the barcode is visible in the camera's view.

**Solution**: Add a state variable to track if a barcode has been scanned. In the callback, update the state and only process the barcode if it hasn't been scanned yet. You can also temporarily disable the scanner by setting `onBarcodeScanned` to `undefined`.

```tsx
import { CameraView, BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';
import { View, StyleSheet } from 'react-native';

export default function BarcodeScanner() {
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = (scanningResult: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    alert(`Bar code with type ${scanningResult.type} and data ${scanningResult.data} has been scanned!`);
    // Reset scanner after a delay
    setTimeout(() => setScanned(false), 2000);
  };

  return (
    <View style={styles.container}>
      <CameraView
        onBarcodeScanned={handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'pdf417'],
        }}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

## Common Patterns

### Taking a photo and displaying it

This pattern shows how to capture a photo and display it on the screen. It uses a state variable to store the photo's URI and conditionally renders an `Image` component.

```tsx
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useState, useRef } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';

export default function PhotoPattern() {
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) return <View />;
  if (!permission.granted) return <Text>No access to camera</Text>;

  const takePicture = async () => {
    if (cameraRef.current) {
      const result = await cameraRef.current.takePictureAsync();
      setPhoto(result.uri);
    }
  };

  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo }} style={styles.preview} />
        <Button title="Take another" onPress={() => setPhoto(null)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} ref={cameraRef}>
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={takePicture}>
            <Text style={styles.text}>Take Photo</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },
  preview: { flex: 1 },
  buttonContainer: { position: 'absolute', bottom: 20, alignSelf: 'center' },
  button: { backgroundColor: 'white', padding: 15, borderRadius: 5 },
  text: { fontSize: 18 },
});
```\n
