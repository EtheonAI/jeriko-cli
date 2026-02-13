---
name: asset
description: Load and cache bundled assets like images and fonts.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Asset

A universal library that allows downloading assets and using them with other libraries.

**Platforms:** android, ios, tvos, web

**Package:** `expo-asset`

`expo-asset` provides an interface to Expo's asset system. An asset is any file that lives alongside the source code of your app that the app needs at runtime. Examples include images, fonts, and sounds. Expo's asset system integrates with React Native's, so that you can refer to files with `require('path/to/file')`. This is how you refer to static image files in React Native for use in an `Image` component, for example. Check out React Native's [documentation on static image resources](https://reactnative.dev/docs/images#static-image-resources) for more information. This method of referring to static image resources works out of the box with Expo.

## Quick Start

Here is a minimal example of how to load an asset using the `useAssets` hook and display it in an `Image` component.

```javascript
import { Image, View, Text } from 'react-native';
import { useAssets } from 'expo-asset';

export default function App() {
  const [assets, error] = useAssets([require('./assets/icon.png')]);

  if (error) {
    return <Text>Error: {error.message}</Text>;
  }

  if (!assets) {
    return <Text>Loading...</Text>;
  }

  return (
    <View>
      <Image source={{ uri: assets[0].uri }} style={{ width: 200, height: 200 }} />
    </View>
  );
}
```

## When to Use

Use `expo-asset` whenever you need to manage static files that are bundled with your app, such as images, fonts, or sound effects. It is particularly useful for pre-loading and caching assets to ensure they are available when needed, which can significantly improve your app's performance and user experience.

## Common Pitfalls

### 1. Assuming Assets are Available Offline by Default

- **Problem**: Developers often assume that once an asset is imported, it is automatically available for offline use. However, assets are not downloaded and cached by default.
- **Solution**: Explicitly download assets using `downloadAsync()` or the `useAssets` hook to ensure they are available offline. The `useAssets` hook is the recommended approach for functional components.

```javascript
import { Asset } from 'expo-asset';

async function downloadAsset() {
  const asset = Asset.fromModule(require('./assets/icon.png'));
  await asset.downloadAsync();
  console.log('Asset downloaded to:', asset.localUri);
}
```

### 2. Misunderstanding `localUri` vs. `uri`

- **Problem**: It can be confusing to know when to use `localUri` and when to use `uri`. Using the wrong one can lead to assets not loading.
- **Solution**: `uri` is the remote URL of the asset, while `localUri` is the local file path on the device. `localUri` is only available after the asset has been downloaded. Use `localUri` when a component requires a local file path, such as for a video player or a database.

```javascript
import { Video } from 'expo-av';
import { useAssets } from 'expo-asset';

function MyVideoPlayer() {
  const [assets] = useAssets([require('./assets/my-video.mp4')]);

  if (!assets) {
    return null; // Or a loading indicator
  }

  return <Video source={{ uri: assets[0].localUri }} useNativeControls />;
}
```

### 3. Not Handling the Asset Loading State

- **Problem**: The `useAssets` hook returns `undefined` while the assets are being loaded. If you try to access the asset before it has loaded, your app will crash.
- **Solution**: Always check if the assets are available before trying to use them. You can show a loading indicator while the assets are being loaded.

```javascript
import { useAssets } from 'expo-asset';
import { Text } from 'react-native';

function MyComponent() {
  const [assets, error] = useAssets([require('./assets/my-image.png')]);

  if (error) {
    return <Text>Error loading assets</Text>;
  }

  if (!assets) {
    return <Text>Loading assets...</Text>;
  }

  // Now it is safe to use the assets
  return <Image source={{ uri: assets[0].uri }} />;
}
```

## Common Patterns

### 1. Pre-loading Assets for a Component

To improve user experience, you can pre-load assets that a specific component will need before it is mounted. This can be done in a parent component or in a dedicated loading screen.

```javascript
import { useAssets } from 'expo-asset';
import { useState, useEffect } from 'react';

function App() {
  const [assets] = useAssets([
    require('./assets/image1.png'),
    require('./assets/image2.png'),
  ]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (assets) {
      setIsReady(true);
    }
  }, [assets]);

  if (!isReady) {
    return <AppLoading />;
  }

  return <MyMainApp />;
}
```

### 2. Creating a Custom Hook for Asset Loading

For more complex scenarios, you can create a custom hook that wraps `useAssets` to provide a more specific API for loading certain types of assets.

```javascript
import { useAssets } from 'expo-asset';

export function useFont(fontModule) {
  const [fonts, error] = useAssets([fontModule]);
  return [fonts ? fonts[0] : undefined, error];
}

// Usage in a component
function MyTextComponent() {
  const [font, error] = useFont(require('./assets/fonts/MyFont.ttf'));

  if (!font) {
    return null;
  }

  return <Text style={{ fontFamily: font.name }}>Hello, world!</Text>;
}
```

## Installation

```bash
$ npx expo install expo-asset
```

## Configuration in app config

You can configure `expo-asset` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-asset",
        {
          "assets": ["path/to/file.png", "path/to/directory"]
        }
      ]
    ]
  }
}
```

 **Note**: To import an existing database file (`.db`), see instructions in [SQLite API reference](./sqlite/#import-an-existing-database). For other file types (such as `.lottie` or `.riv`), see [how to add a file extension to `assetExts` in metro config](/guides/customizing-metro/#adding-more-file-extensions-to-assetexts).',
      ].join('\n'),
      default: '[]',
    },
  ]}
/>

### Usage

Learn more about how to use the `expo-asset` config plugin to embed an asset file in your project in [Load an asset at build time](/develop/user-interface/assets/#load-an-asset-at-build-time).

## API

```js

```

## API Reference

### Classes

#### Asset

The `Asset` class represents an asset in your app. It gives metadata about the asset (such as its
name and type) and provides facilities to load the asset data.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `downloaded` | `boolean` | Whether the asset has finished downloading from a call to [`downloadAsync()`](#downloadasync). |
| `hash` | `null | string` | The MD5 hash of the asset's data. |
| `height` | `null | number` | If the asset is an image, the height of the image data divided by the scale factor. The scale factor is the number after `@` in the filename, or `1` if not present. |
| `localUri` | `null | string` | If the asset has been downloaded (by calling [`downloadAsync()`](#downloadasync)), the `file://` URI pointing to the local file on the device that contains the asset data. |
| `name` | `string` | The name of the asset file without the extension. Also without the part from `@` onward in the filename (used to specify scale factor for images). |
| `type` | `string` | The extension of the asset filename. |
| `uri` | `string` | A URI that points to the asset's data on the remote server. When running the published version of your app, this refers to the location on Expo's asset server where Expo has stored your asset. When running the app from Expo CLI during development, this URI points to Expo CLI's server running on your computer and the asset is served directly from your computer. If you are not using Classic Updates (legacy), this field should be ignored as we ensure your assets are on device before running your application logic. |
| `width` | `null | number` | If the asset is an image, the width of the image data divided by the scale factor. The scale factor is the number after `@` in the filename, or `1` if not present. |

**Methods:**

- `downloadAsync(): Promise<Asset>`
  Downloads the asset data to a local file in the device's cache directory. Once the returned
promise is fulfilled without error, the [`localUri`](#localuri) field of this asset points
to a local file containing the asset data. The asset is only downloaded if an up-to-date local
file for the asset isn't already present due to an earlier download. The downloaded `Asset`
will be returned when the promise is resolved.

> **Note:** There is no guarantee that files downloaded via `downloadAsync` persist between app sessions.
`downloadAsync` stores files in the caches directory, so it's up to the OS to clear this folder at its
own discretion or when the user manually purges the caches directory. Downloaded assets are stored as
`ExponentAsset-{cacheFileId}.{extension}` within the cache directory.
> To manually clear cached assets, you can use [`expo-file-system`]() to
delete the cache directory: `Paths.cache.delete()` or use the legacy API `deleteAsync(cacheDirectory)`.
  **Returns:** Returns a Promise which fulfills with an `Asset` instance.

- `fromMetadata(meta: AssetMetadata): Asset`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `meta` | `AssetMetadata` | - |

- `fromModule(virtualAssetModule: string | number | { height: number; uri: string; width: number }): Asset`
  Returns the [`Asset`](#asset) instance representing an asset given its module or URL.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `virtualAssetModule` | `string | number | { height: number; uri: string; width: number }` | The value of `require('path/to/file')` for the asset or external<br>network URL |
  **Returns:** The [`Asset`](#asset) instance for the asset.

- `fromURI(uri: string): Asset`
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `uri` | `string` | - |

- `loadAsync(moduleId: string | number | number[] | string[]): Promise<Asset[]>`
  A helper that wraps `Asset.fromModule(module).downloadAsync` for convenience.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `moduleId` | `string | number | number[] | string[]` | An array of `require('path/to/file')` or external network URLs. Can also be<br>just one module or URL without an Array. |
  **Returns:** Returns a Promise that fulfills with an array of `Asset`s when the asset(s) has been
saved to disk.

### Methods


#### useAssets

Downloads and stores one or more assets locally.
After the assets are loaded, this hook returns a list of asset instances.
If something went wrong when loading the assets, an error is returned.

> Note, the assets are not "reloaded" when you dynamically change the asset list.

```typescript
useAssets(moduleIds: number | number[]): [Asset[] | undefined, Error | undefined]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `moduleIds` | `number | number[]` | - |

**Returns:** Returns an array containing:
- on the first position, a list of all loaded assets. If they aren't loaded yet, this value is
  `undefined`.
- on the second position, an error which encountered when loading the assets. If there was no
  error, this value is `undefined`.

### Types

#### AssetDescriptor

| Property | Type | Description |
| --- | --- | --- |
| `hash` | `string | null` | - |
| `height` | `number | null` | - |
| `name` | `string` | - |
| `type` | `string` | - |
| `uri` | `string` | - |
| `width` | `number | null` | - |

#### AssetMetadata

**Type:** `unknown`
