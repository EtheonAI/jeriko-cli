---
name: video-thumbnails
description: Generate thumbnail images from videos.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# VideoThumbnails

A library that allows you to generate an image to serve as a thumbnail from a video file.

**Platforms:** android, ios, tvos

**Package:** `expo-video-thumbnails`

`expo-video-thumbnails` allows you to generate an image to serve as a thumbnail from a video file.

## Quick Start

```jsx
import { useState } from 'react';
import { StyleSheet, Button, View, Image, Text } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';

export default function App() {
  const [image, setImage] = useState(null);

  const generateThumbnail = async () => {
    try {
      const { uri } = await VideoThumbnails.getThumbnailAsync(
        'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
        {
          time: 15000,
        }
      );
      setImage(uri);
    } catch (e) {
      console.warn(e);
    }
  };

  return (
    <View style={styles.container}>
      <Button onPress={generateThumbnail} title="Generate thumbnail" />
      {image && <Image source={{ uri: image }} style={styles.image} />}
      <Text>{image}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5FCFF',
  },
  image: {
    width: 200,
    height: 200,
  },
});
```

## When to Use

Use `expo-video-thumbnails` when you need to display a preview image for a video without loading the entire video player. This is useful for video galleries, lists, or any UI where a static image can represent a video file.

## Common Pitfalls

- **Problem**: The app crashes or throws an error when trying to generate a thumbnail from a remote URL that requires authentication.
- **Solution**: Use the `headers` option to provide authentication tokens.

```jsx
import * as VideoThumbnails from 'expo-video-thumbnails';

const generateThumbnail = async () => {
  try {
    const { uri } = await VideoThumbnails.getThumbnailAsync(
      'https://your-private-video-url.com/video.mp4',
      {
        time: 1000,
        headers: {
          Authorization: 'Bearer your-auth-token',
        },
      }
    );
    // ...
  } catch (e) {
    console.warn('Error generating thumbnail:', e);
  }
};
```

- **Problem**: Thumbnail generation fails for local files on Android.
- **Solution**: Ensure you have the necessary file system permissions and that the file URI is correct. For assets bundled with your app, you might need to use `Asset.fromModule(require('./video.mp4')).uri`.

```jsx
import { Asset } from 'expo-asset';
import * as VideoThumbnails from 'expo-video-thumbnails';

const generateThumbnailFromLocalAsset = async () => {
    const videoAsset = Asset.fromModule(require('./assets/videos/my-video.mp4'));
    await videoAsset.downloadAsync(); // Ensure asset is available

    try {
        const { uri } = await VideoThumbnails.getThumbnailAsync(videoAsset.uri, {
            time: 1000,
        });
        // ...
    } catch (e) {
        console.warn(e);
    }
};
```

## Common Patterns

### Generating a grid of thumbnails from a list of videos

```jsx
import { useState, useEffect } from 'react';
import { View, FlatList, Image, StyleSheet } from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';

const videoUris = [
  'https://d23dyxeqlo5psv.cloudfront.net/big_buck_bunny.mp4',
  // ... more video uris
];

const ThumbnailGrid = () => {
  const [thumbnails, setThumbnails] = useState([]);

  useEffect(() => {
    const generateThumbnails = async () => {
      const thumbPromises = videoUris.map(uri =>
        VideoThumbnails.getThumbnailAsync(uri, { time: 1000 })
      );
      const generatedThumbnails = await Promise.all(thumbPromises);
      setThumbnails(generatedThumbnails);
    };
    generateThumbnails();
  }, []);

  return (
    <FlatList
      data={thumbnails}
      keyExtractor={(item) => item.uri}
      numColumns={3}
      renderItem={({ item }) => (
        <Image source={{ uri: item.uri }} style={styles.thumbnail} />
      )}
    />
  );
};

const styles = StyleSheet.create({
  thumbnail: {
    width: 100,
    height: 100,
    margin: 5,
  },
});
```

## Installation

```bash
$ npx expo install expo-video-thumbnails
```

## API

```js
import * as VideoThumbnails from 'expo-video-thumbnails';
```

## API Reference

### Methods

#### getThumbnailAsync

Create an image thumbnail from video provided via `sourceFilename`.

```typescript
getThumbnailAsync(sourceFilename: string, options: VideoThumbnailsOptions): Promise<VideoThumbnailsResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `sourceFilename` | `string` | An URI of the video, local or remote. |
| `options` | `VideoThumbnailsOptions` | A map defining how modified thumbnail should be created. |

**Returns:** Returns a promise which fulfils with [`VideoThumbnailsResult`](#videothumbnailsresult).

### Types

#### VideoThumbnailsOptions

| Property | Type | Description |
| --- | --- | --- |
| `headers` | `Record<string, string>` | In case `sourceFilename` is a remote URI, `headers` object is passed in a network request. |
| `quality` | `number` | A value in range `0.0` - `1.0` specifying quality level of the result image. `1` means no compression (highest quality) and `0` the highest compression (lowest quality). |
| `time` | `number` | The time position where the image will be retrieved in ms. |

#### VideoThumbnailsResult

| Property | Type | Description |
| --- | --- | --- |
| `height` | `number` | Height of the created image. |
| `uri` | `string` | URI to the created image (usable as the source for an Image/Video element). |
| `width` | `number` | Width of the created image. |
