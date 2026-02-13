---
name: live-photo
description: Display and interact with iOS Live Photos.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# LivePhoto

A library that allows displaying Live Photos on iOS.

## Quick Start

Here is a minimal example of how to display a Live Photo. Note that you need to provide valid URIs for a paired photo and video.

```tsx
import { LivePhotoAsset, LivePhotoView } from 'expo-live-photo';
import { View, StyleSheet, Text, Platform } from 'react-native';

export default function App() {
  if (Platform.OS !== 'ios') {
    return (
      <View style={styles.container}>
        <Text>Live Photos are only available on iOS.</Text>
      </View>
    );
  }

  // Note: These URIs must point to a valid, paired Live Photo.
  // Using a library like expo-image-picker is the recommended way to get these.
  const livePhotoAsset: LivePhotoAsset = {
    photoUri: 'file:///path/to/your/photo.HEIC',
    pairedVideoUri: 'file:///path/to/your/video.MOV',
  };

  return (
    <View style={styles.container}>
      <LivePhotoView
        source={livePhotoAsset}
        style={styles.livePhoto}
        useDefaultGestureRecognizer
        onLoadError={(e) => console.error('Failed to load Live Photo:', e.message)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  livePhoto: {
    width: 300,
    height: 400,
  },
});
```

## When to Use

Use `expo-live-photo` when you need to display and interact with iOS Live Photos in your Expo application. This is ideal for social media apps, photo gallery apps, or any application where you want to provide a richer media experience by supporting Apple's Live Photo format.

## Common Pitfalls

- **Problem**: Attempting to use the module on a non-iOS platform.
  **Solution**: Always check for platform compatibility before rendering the `LivePhotoView`.

  ```tsx
  import { Platform, View, Text } from 'react-native';
  import { LivePhotoView } from 'expo-live-photo';

  export default function LivePhotoComponent() {
    if (Platform.OS !== 'ios') {
      return <Text>Live Photos are not supported on this platform.</Text>;
    }
    // ... render LivePhotoView
  }
  ```

- **Problem**: Providing incorrect or unpaired photo and video URIs.
  **Solution**: Ensure that the `photoUri` and `pairedVideoUri` in the `LivePhotoAsset` object are valid and belong to a genuine Live Photo. The pairing is created by the camera and cannot be replicated. Using a library like `expo-image-picker` with the `livePhotos` media type is the recommended way to obtain a valid asset.

  ```tsx
  import * as ImagePicker from 'expo-image-picker';

  async function pickLivePhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.LivePhotos,
    });

    if (!result.canceled && result.assets[0].pairedVideoAsset) {
      return {
        photoUri: result.assets[0].uri,
        pairedVideoUri: result.assets[0].pairedVideoAsset.uri,
      };
    }
    return null;
  }
  ```

- **Problem**: The `LivePhotoView` does not display, or shows an error.
  **Solution**: Implement the `onLoadError` prop to catch and log any loading errors. This can help diagnose issues with the asset URIs or other native-level problems.

  ```tsx
  <LivePhotoView
    source={livePhotoAsset}
    style={styles.livePhoto}
    onLoadError={(error) => {
      console.error('Failed to load the live photo: ', error.message);
    }}
  />
  ```

## Common Patterns

### Picking and Displaying a Live Photo

This pattern combines `expo-image-picker` with `expo-live-photo` to allow users to select a Live Photo from their library and display it.

```tsx
import * as ImagePicker from 'expo-image-picker';
import { LivePhotoAsset, LivePhotoView } from 'expo-live-photo';
import { useState } from 'react';
import { View, StyleSheet, Button, Platform } from 'react-native';

export default function LivePhotoPicker() {
  const [livePhoto, setLivePhoto] = useState<LivePhotoAsset | null>(null);

  const pickImage = async () => {
    if (Platform.OS !== 'ios') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.LivePhotos,
    });

    if (!result.canceled && result.assets[0].pairedVideoAsset) {
      setLivePhoto({
        photoUri: result.assets[0].uri,
        pairedVideoUri: result.assets[0].pairedVideoAsset.uri,
      });
    } else {
      alert('Failed to pick a live photo');
    }
  };

  return (
    <View style={styles.container}>
      {livePhoto && (
        <LivePhotoView source={livePhoto} style={styles.livePhoto} useDefaultGestureRecognizer />
      )}
      <Button title="Pick a Live Photo" onPress={pickImage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  livePhoto: {
    width: 300,
    height: 400,
    marginBottom: 20,
  },
});
```

**Platforms:** ios

**Package:** `expo-live-photo`

## Installation

```bash
$ npx expo install expo-live-photo
```

## Usage

Here's a simple example of `expo-live-photo` usage combined with `expo-image-picker`.

```tsx
import * as ImagePicker from 'expo-image-picker';
import { LivePhotoAsset, LivePhotoView, LivePhotoViewType } from 'expo-live-photo';
import { useRef, useState } from 'react';
import { View, StyleSheet, Text, Button } from 'react-native';

export default function LivePhotoScreen() {
  const viewRef = useRef<LivePhotoViewType>(null);
  const [livePhoto, setLivePhoto] = useState<LivePhotoAsset | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['livePhotos'],
    });

    if (!result.canceled && result.assets[0].pairedVideoAsset?.uri) {
      setLivePhoto({
        photoUri: result.assets[0].uri,
        pairedVideoUri: result.assets[0].pairedVideoAsset.uri,
      });
    } else {
      console.error('Failed to pick a live photo');
    }
  };

  if (!LivePhotoView.isAvailable()) {
    return (
      <View style={styles.container}>
        <Text>expo-live-photo is not available on this platform 😕</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LivePhotoView
        ref={viewRef}
        source={livePhoto}
        style={[styles.livePhotoView, { display: livePhoto ? 'flex' : 'none' }]}
        onLoadComplete={() => {
          console.log('Live photo loaded successfully!');
        }}
        onLoadError={error => {
          console.error('Failed to load the live photo: ', error.message);
        }}
      />
      <View style={livePhoto ? styles.pickImageCollapsed : styles.pickImageExpanded}>
        <Button title={livePhoto ? 'Change Image' : 'Pick an image'} onPress={pickImage} />
      </View>
      <Button title="Start Playback Hint" onPress={() => viewRef.current?.startPlayback('hint')} />
      <Button title="Start Playback" onPress={() => viewRef.current?.startPlayback('full')} />
      <Button title="Stop Playback" onPress={() => viewRef.current?.stopPlayback()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
  },
  livePhotoView: {
    alignSelf: 'stretch',
    height: 300,
  },
  pickImageExpanded: {
    alignSelf: 'stretch',
    height: 300,
    justifyContent: 'center',
  },
  pickImageCollapsed: {
    marginVertical: 10,
  },
  button: {
    marginVertical: 10,
  },
});
```

## API
```js
import { LivePhotoView } from 'expo-live-photo';
```

## API Reference

### Methods

#### LivePhotoView

```typescript
LivePhotoView(__namedParameters: unknown): null | Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `unknown` | - |

### Interfaces

#### LivePhotoViewProps

| Property | Type | Description |
| --- | --- | --- |
| `contentFit` | `ContentFit` | Determines how the image should be scaled to fit the container. - `'contain'` - Scales the image so that its larger dimension fits the target size. - `'cover'` - Scales the image so that it completely fills the target size. |
| `isMuted` | `boolean` | Determines whether the live photo should also play audio. |
| `onLoadComplete` | `() => void` | Called when the live photo is loaded and ready to play. |
| `onLoadError` | `(error: LivePhotoLoadError) => void` | Called when an error occurred while loading. |
| `onLoadStart` | `() => void` | Called when the live photo starts loading. |
| `onPlaybackStart` | `() => void` | Called when the playback starts. |
| `onPlaybackStop` | `() => void` | Called when the playback stops. |
| `onPreviewPhotoLoad` | `() => void` | Called when the live photo preview photo is loaded. |
| `source` | `null | LivePhotoAsset` | The live photo asset to display. |
| `useDefaultGestureRecognizer` | `boolean` | Determines whether the default iOS gesture recognizer should be used. When `true` the playback will start if the user presses and holds on the `LivePhotoView`. |

### Types

#### ContentFit

Determines how the image should be scaled to fit the container.

- `'contain'` - Scales the image so that its larger dimension fits the target size.
- `'cover'` - Scales the image so that it completely fills the target size.

**Type:** `'contain' | 'cover'`

#### LivePhotoAsset

A live photo asset.

> **Note:** Due to native limitations, the photo and video parts of the live photo must come from a valid live photo file and be unaltered.
> When taken, the photo is paired with the video via metadata. If the pairing is broken, joining them into a live photo is impossible.

| Property | Type | Description |
| --- | --- | --- |
| `pairedVideoUri` | `string` | The URI of the video part of the live photo. |
| `photoUri` | `string` | The URI of the photo part of the live photo. |

#### LivePhotoLoadError

| Property | Type | Description |
| --- | --- | --- |
| `message` | `string` | Reason for the load failure. |

#### LivePhotoViewType

| Property | Type | Description |
| --- | --- | --- |
| `startPlayback` | `(playbackStyle: PlaybackStyle) => void` | Start the playback of the video part of the live photo. |
| `stopPlayback` | `() => void` | Stop the playback of the video part of the live photo. |

#### PlaybackStyle

Determines what style to use when playing the live photo.

- `'hint'` - A short part of the video will be played to indicate that a live photo is being displayed.
- `'full'` - The full video part will be played.

**Type:** `'hint' | 'full'`
