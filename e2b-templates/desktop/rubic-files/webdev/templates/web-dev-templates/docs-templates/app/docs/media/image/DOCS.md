---
name: image
description: Display images with caching, placeholders, and transitions.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Image

A cross-platform and performant React component that loads and renders images.

**Platforms:** android, ios, tvos, web

**Package:** `expo-image`

`expo-image` is a cross-platform React component that loads and renders images.

**Main features:**

- Designed for speed
- Support for many image formats (including animated ones)
- Disk and memory caching
- Supports [BlurHash](https://blurha.sh) and [ThumbHash](https://evanw.github.io/thumbhash/) - compact representations of a placeholder for an image
- Transitioning between images when the source changes (no more flickering!)
- Implements the CSS [`object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) and [`object-position`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position) properties (see [`contentFit`](#contentfit) and [`contentPosition`](#contentposition) props)
- Uses performant [`SDWebImage`](https://github.com/SDWebImage/SDWebImage) and [`Glide`](https://github.com/bumptech/glide) under the hood

#### Supported image formats

|   Format   |   Android   |     iOS     |                          Web                           |
| :--------: | :---------: | :---------: | :----------------------------------------------------: |
|    WebP    |  |  |                                             |
| PNG / APNG |  |  |                                             |
|    AVIF    |  |  |                                             |
|    HEIC    |  |  |  [not adopted yet](https://caniuse.com/heif) |
|    JPEG    |  |  |                                             |
|    GIF     |  |  |                                             |
|    SVG     |  |  |                                             |
|    ICO     |  |  |                                             |
|    ICNS    |   |  |                                              |

## Quick Start

Here is a minimal example to get you started with the `Image` component:

```jsx
import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Image } from 'expo-image';

export default function App() {
  const imageUrl = 'https://picsum.photos/seed/696/3000/2000';

  return (
    <View style={styles.container}>
      <Image
        style={styles.image}
        source={imageUrl}
        placeholder="L6PZfSi_.AyE_3t7t7R**-oJ-pWB"
        contentFit="cover"
        transition={300}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 200,
    height: 200,
    backgroundColor: '#0553',
  },
});
```

## When to Use

Use the `expo-image` component whenever you need to display images in your application. It is a powerful and performant component that provides caching, placeholders, and smooth transitions, making it a better choice than the default React Native `Image` component in most cases. It is especially useful when loading images from a network source, as it will handle caching automatically and improve the user experience.

## Common Pitfalls

Here are a few common issues you might encounter when using `expo-image`:

### 1. Forgetting to set `contentFit`

- **Problem**: The image does not resize correctly and may appear distorted or cropped. By default, the `contentFit` is set to `cover`, which might not be what you want.
- **Solution**: Explicitly set the `contentFit` property to control how the image is resized. Common values are `contain`, `cover`, `fill`, `none`, and `scale-down`.

```jsx
<Image
  source={{ uri: 'https://example.com/image.png' }}
  style={{ width: 200, height: 200 }}
  contentFit="contain" // Or "cover", "fill", etc.
/>
```

### 2. Issues with local assets on web

- **Problem**: When using local images with `require()`, they might not display correctly on the web platform. This is because the web bundler handles assets differently.
- **Solution**: For web, it's often more reliable to use a direct URL for the image source. If you must use local assets, ensure your bundler configuration is set up correctly to handle them.

```jsx
import { Platform } from 'react-native';

const imageSource = Platform.select({
  web: { uri: 'https://example.com/image.png' },
  default: require('./assets/image.png'),
});

<Image source={imageSource} style={{ width: 200, height: 200 }} />
```

### 3. Caching behavior not as expected

- **Problem**: Images are not being cached, or the cache is not being cleared when expected.
- **Solution**: Understand the `cachePolicy` prop. By default, it's set to `'disk'`, which caches images on disk. You can set it to `'memory'` to cache in memory, or `'none'` to disable caching. To clear the cache, you can use the static methods `Image.clearMemoryCache()` and `Image.clearDiskCache()`.

```jsx
// To disable caching for a specific image
<Image
  source={{ uri: 'https://example.com/image.png' }}
  cachePolicy="none"
  style={{ width: 200, height: 200 }}
/>

// To clear all caches
async function clearCache() {
  await Image.clearMemoryCache();
  await Image.clearDiskCache();
}
```

## Common Patterns

Here are some common patterns for using `expo-image`:

### Responsive Images

This pattern demonstrates how to make images responsive to different screen sizes.

```jsx
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

export default function ResponsiveImage() {
  const { width } = useWindowDimensions();
  const imageUrl = `https://picsum.photos/seed/picsum/${Math.floor(width)}/300`;

  return (
    <View style={styles.container}>
      <Image
        source={imageUrl}
        style={[styles.image, { width: width * 0.9, height: width * 0.9 * (2/3) }]}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    borderRadius: 10,
  },
});
```
## Installation

```bash
$ npx expo install expo-image
```

## Usage

```jsx
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

export default function App() {
  return (
    <View style={styles.container}>
      <Image
        style={styles.image}
        source="https://picsum.photos/seed/696/3000/2000"
        placeholder={{ blurhash }}
        contentFit="cover"
        transition={1000}
      />
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
  image: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0553',
  },
});
```

## API

```js
import { Image } from 'expo-image';
```

## Generating a blurhash on a server

Images can significantly improve the visual experience, however, they can also slow down app/page loading times due to their large file sizes. To overcome this, you can create placeholder images using blurhash algorithm that provides an immersive experience while deferring the loading of the actual picture until later.

This guide demonstrates how to create a blurhash of an uploaded image on the backend using JavaScript and Express.js. The same techniques and principles apply to other languages and server technologies.

Start by installing a few dependencies: [`multer`](https://github.com/expressjs/multer) for handling multipart requests, [`sharp`](https://github.com/lovell/sharp) for converting files to a data buffer, and the official [`blurhash` JavaScript package](https://github.com/woltapp/blurhash/tree/master/TypeScript).

```bash
$ npm install multer sharp blurhash
```

Next, import all required functions from installed packages and initialize `multer`:

```js
// Multer is a middleware for handling `multipart/form-data`.
const multer = require('multer');
// Sharp allows you to receive a data buffer from the uploaded image.
const sharp = require('sharp');
// Import the encode function from the blurhash package.
const { encode } = require('blurhash');

// Initialize `multer`.
const upload = multer();
```

Assuming the `app` is a variable that holds a reference to the Express server, an endpoint can be created that accepts an image and returns a JSON response containing the generated blurhash.

```js
app.post('/blurhash', upload.single('image'), async (req, res) => {
  const { file } = req;
  // If the file is not available we're returning with error.
  if (file === null) {
    res.status(400).json({ message: 'Image is missing' });
    return null;
  }

  // Users can specify number of components in each axes.
  const componentX = req.body.componentX ?? 4;
  const componentY = req.body.componentY ?? 3;

  // We're converting provided image to a byte buffer.
  // Sharp currently supports multiple common formats like JPEG, PNG, WebP, GIF, and AVIF.
  const { data, info } = await sharp(file.buffer).ensureAlpha().raw().toBuffer({
    resolveWithObject: true,
  });

  const blurhash = encode(
    new Uint8ClampedArray(data),
    info.width,
    info.height,
    componentX,
    componentY
  );
  res.json({ blurhash });
});
```

Additionally, the request can include two parameters: `componentX` and `componentY`, are passed through the algorithm. These values can be calculated or hard-coded on the server or specified by the user. However, they must be within the range of 1 to 9 and have an aspect ratio similar to the uploaded image. A value of 9 will give the best results but may take longer to generate the hash.

The process of generating a blurhash can be accomplished in various languages and server technologies, similar to the one using JavaScript. The key step is to locate an encoder for your chosen language, which can often be found in the [`woltapp/blurhash`](https://github.com/woltapp/blurhash#implementations) repository. Once you have the encoder, you will need to obtain a representation of the image. Some libraries use a default image class (for example, the Swift implementation uses `UIImage`). In other cases, you will have to provide raw byte data. Make sure to check the encoder's documentation to confirm the expected data format.

> When working with raw byte data, ensure that the alpha layer is present (each pixel is represented by red, green, blue, and alpha values). Failing to do so will lead to errors such as "width and height must match the pixels array".

## API Reference

### Classes

#### Image

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `containerViewRef` | `RefObject<null | View>` | - |
| `nativeViewRef` | `RefObject<null | ExpoImage>` | - |

**Methods:**

- `getAnimatableRef(): null | View | Image`

- `lockResourceAsync(): Promise<void>`
  Prevents the resource from being reloaded by locking it.

- `reloadAsync(): Promise<void>`
  Reloads the resource, ignoring lock.

- `render(): Element`

- `startAnimating(): Promise<void>`
  Asynchronously starts playback of the view's image if it is animated.

- `stopAnimating(): Promise<void>`
  Asynchronously stops the playback of the view's image if it is animated.

- `unlockResourceAsync(): Promise<void>`
  Releases the lock on the resource, allowing it to be reloaded.

- `clearDiskCache(): Promise<boolean>`
  Asynchronously clears all images from the disk cache.
  **Returns:** A promise resolving to `true` when the operation succeeds.
It may resolve to `false` on Android when the activity is no longer available.
Resolves to `false` on Web.

- `clearMemoryCache(): Promise<boolean>`
  Asynchronously clears all images stored in memory.
  **Returns:** A promise resolving to `true` when the operation succeeds.
It may resolve to `false` on Android when the activity is no longer available.
Resolves to `false` on Web.

- `generateBlurhashAsync(source: string | ImageRef, numberOfComponents: [number, number] | { height: number; width: number }): Promise<null | string>`
  Asynchronously generates a [Blurhash](https://blurha.sh) from an image.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `source` | `string | ImageRef` | The image source, either a URL (string) or an ImageRef |
  | `numberOfComponents` | `[number, number] | { height: number; width: number }` | The number of components to encode the blurhash with.<br>Must be between 1 and 9. Defaults to `[4, 3]`. |
  **Returns:** A promise resolving to the blurhash string.

- `generateThumbhashAsync(source: string | ImageRef): Promise<string>`
  Asynchronously generates a [Thumbhash](https://evanw.github.io/thumbhash/) from an image.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `source` | `string | ImageRef` | The image source, either a URL (string) or an ImageRef |
  **Returns:** A promise resolving to the thumbhash string.

- `getCachePathAsync(cacheKey: string): Promise<null | string>`
  Asynchronously checks if an image exists in the disk cache and resolves to
the path of the cached image if it does.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `cacheKey` | `string` | The cache key for the requested image. Unless you have set<br>a custom cache key, this will be the source URL of the image. |
  **Returns:** A promise resolving to the path of the cached image. It will resolve
to `null` if the image does not exist in the cache.

- `loadAsync(source: string | number | ImageSource, options: ImageLoadOptions): Promise<ImageRef>`
  Loads an image from the given source to memory and resolves to
an object that references the native image instance.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `source` | `string | number | ImageSource` | - |
  | `options` | `ImageLoadOptions` | - |

- `prefetch(urls: string | string[], cachePolicy: 'disk' | 'memory' | 'memory-disk'): Promise<boolean>`
  Preloads images at the given URLs that can be later used in the image view.
Preloaded images are cached to the memory and disk by default, so make sure
to use `disk` (default) or `memory-disk` [cache policy](#cachepolicy).
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `urls` | `string | string[]` | A URL string or an array of URLs of images to prefetch. |
  | `cachePolicy` | `'disk' | 'memory' | 'memory-disk'` | The cache policy for prefetched images. |
  **Returns:** A promise resolving to `true` as soon as all images have been
successfully prefetched. If an image fails to be prefetched, the promise
will immediately resolve to `false` regardless of whether other images have
finished prefetching.

#### ImageRef

An object that is a reference to a native image instance – [Drawable](https://developer.android.com/reference/android/graphics/drawable/Drawable)
on Android and [UIImage](https://developer.apple.com/documentation/uikit/uiimage) on iOS.
Instances of this class can be passed as a source to the [Image](#image) component in which case the image is rendered immediately
since its native representation is already available in the memory.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `height` | `number` | Logical height of the image. Multiply it by the value in the `scale` property to get the height in pixels. |
| `isAnimated` | `boolean` | Whether the referenced image is an animated image. |
| `mediaType` | `null | string` | Media type (also known as MIME type) of the image, based on its format. Returns `null` when the format is unknown or not supported. |
| `nativeRefType` | `string` | The type of the native reference. |
| `scale` | `number` | On iOS, if you load an image from a file whose name includes the `@2x` modifier, the scale is set to **2.0**. All other images are assumed to have a scale factor of **1.0**. On Android, it calculates the scale based on the bitmap density divided by screen density. On all platforms, if you multiply the logical size of the image by this value, you get the dimensions of the image in pixels. |
| `width` | `number` | Logical width of the image. Multiply it by the value in the `scale` property to get the width in pixels. |

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

#### ImageBackground

```typescript
ImageBackground(__namedParameters: ImageBackgroundProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `ImageBackgroundProps` | - |

#### useImage

A hook that loads an image from the given source and returns a reference
to the native image instance, or `null` until the first image is successfully loaded.

It loads a new image every time the `uri` of the provided source changes.
To trigger reloads in some other scenarios, you can provide an additional dependency list.

**Platform:** android

```typescript
useImage(source: string | number | ImageSource, options: ImageLoadOptions, dependencies: DependencyList): ImageRef | null
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `source` | `string | number | ImageSource` | - |
| `options` | `ImageLoadOptions` | - |
| `dependencies` | `DependencyList` | - |

### Interfaces

#### ImageBackgroundProps

It allows you to use an image as a background while rendering other content on top of it.
It extends all `Image` props but provides separate styling controls for the container and the background image itself.

| Property | Type | Description |
| --- | --- | --- |
| `accessibilityLabel` | `string` | The text that's read by the screen reader when the user interacts with the image. Sets the `alt` tag on web which is used for web crawlers and link traversal. |
| `accessible` | `boolean` | When true, indicates that the view is an accessibility element. When a view is an accessibility element, it groups its children into a single selectable component. On Android, the `accessible` property will be translated into the native `isScreenReaderFocusable`, so it's only affecting the screen readers behaviour. |
| `allowDownscaling` | `boolean` | Whether the image should be downscaled to match the size of the view container. Turning off this functionality could negatively impact the application's performance, particularly when working with large assets. However, it would result in smoother image resizing, and end-users would always have access to the highest possible asset quality. Downscaling is never used when the `contentFit` prop is set to `none` or `fill`. |
| `alt` | `string` | The text that's read by the screen reader when the user interacts with the image. Sets the `alt` tag on web which is used for web crawlers and link traversal. Is an alias for `accessibilityLabel`. |
| `autoplay` | `boolean` | Determines if an image should automatically begin playing if it is an animated image. |
| `blurRadius` | `number` | The radius of the blur in points, `0` means no blur effect. This effect is not applied to placeholders. |
| `cachePolicy` | `null | 'none' | 'disk' | 'memory' | 'memory-disk'` | Determines whether to cache the image and where: on the disk, in the memory or both. - `'none'` - Image is not cached at all. - `'disk'` - Image is queried from the disk cache if exists, otherwise it's downloaded and then stored on the disk. - `'memory'` - Image is cached in memory. Might be useful when you render a high-resolution picture many times. Memory cache may be purged very quickly to prevent high memory usage and the risk of out of memory exceptions. - `'memory-disk'` - Image is cached in memory, but with a fallback to the disk cache. |
| `contentFit` | `ImageContentFit` | Determines how the image should be resized to fit its container. This property tells the image to fill the container in a variety of ways; such as "preserve that aspect ratio" or "stretch up and take up as much space as possible". It mirrors the CSS [`object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) property. - `'cover'` - The image is sized to maintain its aspect ratio while filling the container box. If the image's aspect ratio does not match the aspect ratio of its box, then the object will be clipped to fit. - `'contain'` - The image is scaled down or up to maintain its aspect ratio while fitting within the container box. - `'fill'` - The image is sized to entirely fill the container box. If necessary, the image will be stretched or squished to fit. - `'none'` - The image is not resized and is centered by default. When specified, the exact position can be controlled with [`contentPosition`](#contentposition) prop. - `'scale-down'` - The image is sized as if `none` or `contain` were specified, whichever would result in a smaller concrete image size. |
| `contentPosition` | `ImageContentPosition` | It is used together with [`contentFit`](#contentfit) to specify how the image should be positioned with x/y coordinates inside its own container. An equivalent of the CSS [`object-position`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position) property. |
| `decodeFormat` | `ImageDecodeFormat` | The format in which the image data should be decoded. It's not guaranteed that the platform will use the specified format. - `'argb'` - The image is decoded into a 32-bit color space with alpha channel (https://developer.android.com/reference/android/graphics/Bitmap.Config#ARGB_8888). - `'rgb'` - The image is decoded into a 16-bit color space without alpha channel (https://developer.android.com/reference/android/graphics/Bitmap.Config#RGB_565). |
| `defaultSource` | `null | ImageSource` | - |
| `enableLiveTextInteraction` | `boolean` | Enables Live Text interaction with the image. Check official [Apple documentation](https://developer.apple.com/documentation/visionkit/enabling_live_text_interactions_with_images) for more details. |
| `enforceEarlyResizing` | `boolean` | Force early resizing of the image to match the container size. This option helps to reduce the memory usage of the image view, especially when the image is larger than the container. It may affect the `resizeType` and `contentPosition` properties when the image view is resized dynamically. |
| `fadeDuration` | `number` | - |
| `focusable` | `boolean` | Whether this View should be focusable with a non-touch input device and receive focus with a hardware keyboard. |
| `imageStyle` | `StyleProp<ImageStyle>` | Style object for the image. |
| `loadingIndicatorSource` | `null | ImageSource` | - |
| `onDisplay` | `() => void` | Called when the image view successfully rendered the source image. |
| `onError` | `(event: ImageErrorEventData) => void` | Called on an image fetching error. |
| `onLoad` | `(event: ImageLoadEventData) => void` | Called when the image load completes successfully. |
| `onLoadEnd` | `() => void` | Called when the image load either succeeds or fails. |
| `onLoadStart` | `() => void` | Called when the image starts to load. |
| `onProgress` | `(event: ImageProgressEventData) => void` | Called when the image is loading. Can be called multiple times before the image has finished loading. The event object provides details on how many bytes were loaded so far and what's the expected total size. |
| `placeholder` | `null | string | number | ImageSource | SharedRef<'image'> | ImageSource[] | string[]` | An image to display while loading the proper image and no image has been displayed yet or the source is unset. > **Note**: The default value for placeholder's content fit is 'scale-down', which differs from the source image's default value. > Using a lower-resolution placeholder may cause flickering due to scaling differences between it and the final image. > To prevent this, you can set the [`placeholderContentFit`](#placeholdercontentfit) to match the [`contentFit`](#contentfit) value. |
| `placeholderContentFit` | `ImageContentFit` | Determines how the placeholder should be resized to fit its container. Available resize modes are the same as for the [`contentFit`](#contentfit) prop. |
| `preferHighDynamicRange` | `boolean` | Controls whether the image view can leverage the extended dynamic range (EDR). Use this prop if you want to support high dynamic range (HDR) images, otherwise all images are rendered as standard dynamic range (SDR). |
| `priority` | `null | 'low' | 'normal' | 'high'` | Priorities for completing loads. If more than one load is queued at a time, the load with the higher priority will be started first. Priorities are considered best effort, there are no guarantees about the order in which loads will start or finish. |
| `recyclingKey` | `null | string` | Changing this prop resets the image view content to blank or a placeholder before loading and rendering the final image. This is especially useful for any kinds of recycling views like [FlashList](https://github.com/shopify/flash-list) to prevent showing the previous source before the new one fully loads. |
| `resizeMode` | `'cover' | 'contain' | 'center' | 'stretch' | 'repeat'` | - |
| `responsivePolicy` | `'live' | 'initial' | 'static'` | Controls the selection of the image source based on the container or viewport size on the web. If set to `'static'`, the browser selects the correct source based on user's viewport width. Works with static rendering. Make sure to set the `'webMaxViewportWidth'` property on each source for best results. For example, if an image occupies 1/3 of the screen width, set the `'webMaxViewportWidth'` to 3x the image width. The source with the largest `'webMaxViewportWidth'` is used even for larger viewports. If set to `'initial'`, the component will select the correct source during mount based on container size. Does not work with static rendering. If set to `'live'`, the component will select the correct source on every resize based on container size. Does not work with static rendering. |
| `source` | `null | string | number | ImageSource | SharedRef<'image'> | ImageSource[] | string[]` | The image source, either a remote URL, a local file resource or a number that is the result of the `require()` function. When provided as an array of sources, the source that fits best into the container size and is closest to the screen scale will be chosen. In this case it is important to provide `width`, `height` and `scale` properties. |
| `style` | `StyleProp<ViewStyle>` | The style of the image container. |
| `tintColor` | `null | string` | A color used to tint template images (a bitmap image where only the opacity matters). The color is applied to every non-transparent pixel, causing the image's shape to adopt that color. This effect is not applied to placeholders. |
| `transition` | `null | number | ImageTransition` | Describes how the image view should transition the contents when switching the image source.\ If provided as a number, it is the duration in milliseconds of the `'cross-dissolve'` effect. |
| `useAppleWebpCodec` | `boolean` | Whether to use the Apple's default WebP codec. Set this prop to `false` to use the official standard-compliant [libwebp](https://github.com/webmproject/libwebp) codec for WebP images. The default implementation from Apple is faster and uses less memory but may render animated images with incorrect blending or play them at the wrong framerate. |

#### ImageProps

Some props are from React Native Image that Expo Image supports (more or less) for easier migration,
but all of them are deprecated and might be removed in the future.

| Property | Type | Description |
| --- | --- | --- |
| `accessibilityLabel` | `string` | The text that's read by the screen reader when the user interacts with the image. Sets the `alt` tag on web which is used for web crawlers and link traversal. |
| `accessible` | `boolean` | When true, indicates that the view is an accessibility element. When a view is an accessibility element, it groups its children into a single selectable component. On Android, the `accessible` property will be translated into the native `isScreenReaderFocusable`, so it's only affecting the screen readers behaviour. |
| `allowDownscaling` | `boolean` | Whether the image should be downscaled to match the size of the view container. Turning off this functionality could negatively impact the application's performance, particularly when working with large assets. However, it would result in smoother image resizing, and end-users would always have access to the highest possible asset quality. Downscaling is never used when the `contentFit` prop is set to `none` or `fill`. |
| `alt` | `string` | The text that's read by the screen reader when the user interacts with the image. Sets the `alt` tag on web which is used for web crawlers and link traversal. Is an alias for `accessibilityLabel`. |
| `autoplay` | `boolean` | Determines if an image should automatically begin playing if it is an animated image. |
| `blurRadius` | `number` | The radius of the blur in points, `0` means no blur effect. This effect is not applied to placeholders. |
| `cachePolicy` | `null | 'none' | 'disk' | 'memory' | 'memory-disk'` | Determines whether to cache the image and where: on the disk, in the memory or both. - `'none'` - Image is not cached at all. - `'disk'` - Image is queried from the disk cache if exists, otherwise it's downloaded and then stored on the disk. - `'memory'` - Image is cached in memory. Might be useful when you render a high-resolution picture many times. Memory cache may be purged very quickly to prevent high memory usage and the risk of out of memory exceptions. - `'memory-disk'` - Image is cached in memory, but with a fallback to the disk cache. |
| `contentFit` | `ImageContentFit` | Determines how the image should be resized to fit its container. This property tells the image to fill the container in a variety of ways; such as "preserve that aspect ratio" or "stretch up and take up as much space as possible". It mirrors the CSS [`object-fit`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-fit) property. - `'cover'` - The image is sized to maintain its aspect ratio while filling the container box. If the image's aspect ratio does not match the aspect ratio of its box, then the object will be clipped to fit. - `'contain'` - The image is scaled down or up to maintain its aspect ratio while fitting within the container box. - `'fill'` - The image is sized to entirely fill the container box. If necessary, the image will be stretched or squished to fit. - `'none'` - The image is not resized and is centered by default. When specified, the exact position can be controlled with [`contentPosition`](#contentposition) prop. - `'scale-down'` - The image is sized as if `none` or `contain` were specified, whichever would result in a smaller concrete image size. |
| `contentPosition` | `ImageContentPosition` | It is used together with [`contentFit`](#contentfit) to specify how the image should be positioned with x/y coordinates inside its own container. An equivalent of the CSS [`object-position`](https://developer.mozilla.org/en-US/docs/Web/CSS/object-position) property. |
| `decodeFormat` | `ImageDecodeFormat` | The format in which the image data should be decoded. It's not guaranteed that the platform will use the specified format. - `'argb'` - The image is decoded into a 32-bit color space with alpha channel (https://developer.android.com/reference/android/graphics/Bitmap.Config#ARGB_8888). - `'rgb'` - The image is decoded into a 16-bit color space without alpha channel (https://developer.android.com/reference/android/graphics/Bitmap.Config#RGB_565). |
| `defaultSource` | `null | ImageSource` | - |
| `enableLiveTextInteraction` | `boolean` | Enables Live Text interaction with the image. Check official [Apple documentation](https://developer.apple.com/documentation/visionkit/enabling_live_text_interactions_with_images) for more details. |
| `enforceEarlyResizing` | `boolean` | Force early resizing of the image to match the container size. This option helps to reduce the memory usage of the image view, especially when the image is larger than the container. It may affect the `resizeType` and `contentPosition` properties when the image view is resized dynamically. |
| `fadeDuration` | `number` | - |
| `focusable` | `boolean` | Whether this View should be focusable with a non-touch input device and receive focus with a hardware keyboard. |
| `loadingIndicatorSource` | `null | ImageSource` | - |
| `onDisplay` | `() => void` | Called when the image view successfully rendered the source image. |
| `onError` | `(event: ImageErrorEventData) => void` | Called on an image fetching error. |
| `onLoad` | `(event: ImageLoadEventData) => void` | Called when the image load completes successfully. |
| `onLoadEnd` | `() => void` | Called when the image load either succeeds or fails. |
| `onLoadStart` | `() => void` | Called when the image starts to load. |
| `onProgress` | `(event: ImageProgressEventData) => void` | Called when the image is loading. Can be called multiple times before the image has finished loading. The event object provides details on how many bytes were loaded so far and what's the expected total size. |
| `placeholder` | `null | string | number | ImageSource | SharedRef<'image'> | ImageSource[] | string[]` | An image to display while loading the proper image and no image has been displayed yet or the source is unset. > **Note**: The default value for placeholder's content fit is 'scale-down', which differs from the source image's default value. > Using a lower-resolution placeholder may cause flickering due to scaling differences between it and the final image. > To prevent this, you can set the [`placeholderContentFit`](#placeholdercontentfit) to match the [`contentFit`](#contentfit) value. |
| `placeholderContentFit` | `ImageContentFit` | Determines how the placeholder should be resized to fit its container. Available resize modes are the same as for the [`contentFit`](#contentfit) prop. |
| `preferHighDynamicRange` | `boolean` | Controls whether the image view can leverage the extended dynamic range (EDR). Use this prop if you want to support high dynamic range (HDR) images, otherwise all images are rendered as standard dynamic range (SDR). |
| `priority` | `null | 'low' | 'normal' | 'high'` | Priorities for completing loads. If more than one load is queued at a time, the load with the higher priority will be started first. Priorities are considered best effort, there are no guarantees about the order in which loads will start or finish. |
| `recyclingKey` | `null | string` | Changing this prop resets the image view content to blank or a placeholder before loading and rendering the final image. This is especially useful for any kinds of recycling views like [FlashList](https://github.com/shopify/flash-list) to prevent showing the previous source before the new one fully loads. |
| `resizeMode` | `'cover' | 'contain' | 'center' | 'stretch' | 'repeat'` | - |
| `responsivePolicy` | `'live' | 'initial' | 'static'` | Controls the selection of the image source based on the container or viewport size on the web. If set to `'static'`, the browser selects the correct source based on user's viewport width. Works with static rendering. Make sure to set the `'webMaxViewportWidth'` property on each source for best results. For example, if an image occupies 1/3 of the screen width, set the `'webMaxViewportWidth'` to 3x the image width. The source with the largest `'webMaxViewportWidth'` is used even for larger viewports. If set to `'initial'`, the component will select the correct source during mount based on container size. Does not work with static rendering. If set to `'live'`, the component will select the correct source on every resize based on container size. Does not work with static rendering. |
| `source` | `null | string | number | ImageSource | SharedRef<'image'> | ImageSource[] | string[]` | The image source, either a remote URL, a local file resource or a number that is the result of the `require()` function. When provided as an array of sources, the source that fits best into the container size and is closest to the screen scale will be chosen. In this case it is important to provide `width`, `height` and `scale` properties. |
| `tintColor` | `null | string` | A color used to tint template images (a bitmap image where only the opacity matters). The color is applied to every non-transparent pixel, causing the image's shape to adopt that color. This effect is not applied to placeholders. |
| `transition` | `null | number | ImageTransition` | Describes how the image view should transition the contents when switching the image source.\ If provided as a number, it is the duration in milliseconds of the `'cross-dissolve'` effect. |
| `useAppleWebpCodec` | `boolean` | Whether to use the Apple's default WebP codec. Set this prop to `false` to use the official standard-compliant [libwebp](https://github.com/webmproject/libwebp) codec for WebP images. The default implementation from Apple is faster and uses less memory but may render animated images with incorrect blending or play them at the wrong framerate. |

### Types

#### ImageContentPosition

Specifies the position of the image inside its container. One value controls the x-axis and the second value controls the y-axis.

Additionally, it supports stringified shorthand form that specifies the edges to which to align the image content:\
`'center'`, `'top'`, `'right'`, `'bottom'`, `'left'`, `'top center'`, `'top right'`, `'top left'`, `'right center'`, `'right top'`,
`'right bottom'`, `'bottom center'`, `'bottom right'`, `'bottom left'`, `'left center'`, `'left top'`, `'left bottom'`.\
If only one keyword is provided, then the other dimension is set to `'center'` (`'50%'`), so the image is placed in the middle of the specified edge.\
As an example, `'top right'` is the same as `{ top: 0, right: 0 }` and `'bottom'` is the same as `{ bottom: 0, left: '50%' }`.

**Type:** `{ right: ImageContentPositionValue; top: ImageContentPositionValue } | { left: ImageContentPositionValue; top: ImageContentPositionValue } | { bottom: ImageContentPositionValue; right: ImageContentPositionValue } | { bottom: ImageContentPositionValue; left: ImageContentPositionValue } | ImageContentPositionString`

#### ImageContentPositionValue

A value that represents the relative position of a single axis.

If `number`, it is a distance in points (logical pixels) from the respective edge.\
If `string`, it must be a percentage value where `'100%'` is the difference in size between the container and the image along the respective axis,
or `'center'` which is an alias for `'50%'` that is the default value. You can read more regarding percentages on the MDN docs for
[`background-position`](https://developer.mozilla.org/en-US/docs/Web/CSS/background-position#regarding_percentages) that describes this concept well.

**Type:** `number | string | unknown | unknown | 'center'`

#### ImageErrorEventData

| Property | Type | Description |
| --- | --- | --- |
| `error` | `string` | - |

#### ImageLoadEventData

| Property | Type | Description |
| --- | --- | --- |
| `cacheType` | `'none' | 'disk' | 'memory'` | - |
| `source` | `{ height: number; isAnimated: boolean; mediaType: string | null; url: string; width: number }` | - |

#### ImageLoadOptions

An object with options for the [`useImage`](#useimage) hook.

| Property | Type | Description |
| --- | --- | --- |
| `maxHeight` | `number` | If provided, the image will be automatically resized to not exceed this height in pixels, preserving its aspect ratio. |
| `maxWidth` | `number` | If provided, the image will be automatically resized to not exceed this width in pixels, preserving its aspect ratio. |
| `onError` | `any` | - |

#### ImagePrefetchOptions

| Property | Type | Description |
| --- | --- | --- |
| `cachePolicy` | `'disk' | 'memory-disk' | 'memory'` | The cache policy for prefetched images. |
| `headers` | `Record<string, string>` | A map of headers to use when prefetching the images. |

#### ImageProgressEventData

| Property | Type | Description |
| --- | --- | --- |
| `loaded` | `number` | - |
| `total` | `number` | - |

#### ImageSource

| Property | Type | Description |
| --- | --- | --- |
| `blurhash` | `string` | A string used to generate the image [`placeholder`](#placeholder). For example, `placeholder={blurhash}`.  If `uri` is provided as the value of the `source` prop, this is ignored since the `source` can only have `blurhash` or `uri`. When using the blurhash, you should also provide `width` and `height` (higher values reduce performance), otherwise their default value is `16`. For more information, see [`woltapp/blurhash`](https://github.com/woltapp/blurhash) repository. |
| `cacheKey` | `string` | The cache key used to query and store this specific image. If not provided, the `uri` is used also as the cache key. |
| `headers` | `Record<string, string>` | An object representing the HTTP headers to send along with the request for a remote image. On web requires the `Access-Control-Allow-Origin` header returned by the server to include the current domain. |
| `height` | `number | null` | Can be specified if known at build time, in which case the value will be used to set the default `<Image/>` component dimension. |
| `isAnimated` | `boolean` | Whether the image is animated (an animated GIF or WebP for example). |
| `thumbhash` | `string` | A string used to generate the image [`placeholder`](#placeholder). For example, `placeholder={thumbhash}`.  If `uri` is provided as the value of the `source` prop, this is ignored since the `source` can only have `thumbhash` or `uri`. For more information, see [`thumbhash website`](https://evanw.github.io/thumbhash/). |
| `uri` | `string` | A string representing the resource identifier for the image, which could be an HTTPS address, a local file path, or the name of a static image resource. |
| `webMaxViewportWidth` | `number` | The max width of the viewport for which this source should be selected. Has no effect if `source` prop is not an array or has only 1 element. Has no effect if `responsivePolicy` is not set to `static`. Ignored if `blurhash` or `thumbhash` is provided (image hashes are never selected if passed in an array). |
| `width` | `number | null` | Can be specified if known at build time, in which case the value will be used to set the default `<Image/>` component dimension. |

#### ImageTransition

An object that describes the smooth transition when switching the image source.

| Property | Type | Description |
| --- | --- | --- |
| `duration` | `number` | The duration of the transition in milliseconds. |
| `effect` | `'cross-dissolve' | 'flip-from-top' | 'flip-from-right' | 'flip-from-bottom' | 'flip-from-left' | 'curl-up' | 'curl-down' | null` | An animation effect used for transition. |
| `timing` | `'ease-in-out' | 'ease-in' | 'ease-out' | 'linear'` | Specifies the speed curve of the transition effect and how intermediate values are calculated. |
## Quick Start

Here is a minimal example to get you started with the `Image` component:

```jsx
import React from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Image } from 'expo-image';

export default function App() {
  const imageUrl = 'https://picsum.photos/seed/696/3000/2000';

  return (
    <View style={styles.container}>
      <Image
        style={styles.image}
        source={imageUrl}
        placeholder="L6PZfSi_.AyE_3t7t7R**-oJ-pWB"
        contentFit="cover"
        transition={300}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 200,
    height: 200,
    backgroundColor: '#0553',
  },
});
```

## When to Use

Use the `expo-image` component whenever you need to display images in your application. It is a powerful and performant component that provides caching, placeholders, and smooth transitions, making it a better choice than the default React Native `Image` component in most cases. It is especially useful when loading images from a network source, as it will handle caching automatically and improve the user experience.

## Common Pitfalls

Here are a few common issues you might encounter when using `expo-image`:

### 1. Forgetting to set `contentFit`

- **Problem**: The image does not resize correctly and may appear distorted or cropped. By default, the `contentFit` is set to `cover`, which might not be what you want.
- **Solution**: Explicitly set the `contentFit` property to control how the image is resized. Common values are `contain`, `cover`, `fill`, `none`, and `scale-down`.

```jsx
<Image
  source={{ uri: 'https://example.com/image.png' }}
  style={{ width: 200, height: 200 }}
  contentFit="contain" // Or "cover", "fill", etc.
/>
```

### 2. Issues with local assets on web

- **Problem**: When using local images with `require()`, they might not display correctly on the web platform. This is because the web bundler handles assets differently.
- **Solution**: For web, it's often more reliable to use a direct URL for the image source. If you must use local assets, ensure your bundler configuration is set up correctly to handle them.

```jsx
import { Platform } from 'react-native';

const imageSource = Platform.select({
  web: { uri: 'https://example.com/image.png' },
  default: require('./assets/image.png'),
});

<Image source={imageSource} style={{ width: 200, height: 200 }} />
```

### 3. Caching behavior not as expected

- **Problem**: Images are not being cached, or the cache is not being cleared when expected.
- **Solution**: Understand the `cachePolicy` prop. By default, it's set to `'disk'`, which caches images on disk. You can set it to `'memory'` to cache in memory, or `'none'` to disable caching. To clear the cache, you can use the static methods `Image.clearMemoryCache()` and `Image.clearDiskCache()`.

```jsx
// To disable caching for a specific image
<Image
  source={{ uri: 'https://example.com/image.png' }}
  cachePolicy="none"
  style={{ width: 200, height: 200 }}
/>

// To clear all caches
async function clearCache() {
  await Image.clearMemoryCache();
  await Image.clearDiskCache();
}
```

## Common Patterns

Here are some common patterns for using `expo-image`:

### Responsive Images

This pattern demonstrates how to make images responsive to different screen sizes.

```jsx
import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';

export default function ResponsiveImage() {
  const { width } = useWindowDimensions();
  const imageUrl = `https://picsum.photos/seed/picsum/${Math.floor(width)}/300`;

  return (
    <View style={styles.container}>
      <Image
        source={imageUrl}
        style={[styles.image, { width: width * 0.9, height: width * 0.9 * (2/3) }]}
        contentFit="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    borderRadius: 10,
  },
});
```
