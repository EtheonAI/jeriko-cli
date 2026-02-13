---
name: imagemanipulator
description: Resize, crop, rotate, and manipulate images.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# ImageManipulator

A library that provides an API for image manipulation on the local file system.

**Platforms:** android, ios, tvos, web

**Package:** `expo-image-manipulator`

`expo-image-manipulator` provides an API to modify images stored on the local file system.

## Quick Start

Here is a minimal example of how to resize a local image to a width of 200px, maintaining its aspect ratio.

```jsx
import React, { useState, useEffect } from 'react';
import { View, Image, Button, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export default function App() {
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 200 } }],
        { compress: 1, format: ImageManipulator.SaveFormat.PNG }
      );
      setImage(manipResult.uri);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Button title="Pick an image from camera roll" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={{ width: 200, height: 200 }} />}
    </View>
  );
}
```

## When to Use

Use `expo-image-manipulator` for basic image modifications like resizing, cropping, rotating, or flipping images directly on the user's device. It is ideal for preparing images for upload, creating thumbnails, or performing simple edits without needing a server.

## Common Pitfalls

### 1. Forgetting to `await` asynchronous operations

**Problem:** The `manipulateAsync` function returns a Promise. Forgetting to use `await` will result in not getting the manipulated image URI.

**Solution:** Always use `await` with `manipulateAsync` and handle the Promise correctly.

```jsx
// Incorrect
const manipResult = ImageManipulator.manipulateAsync(uri, actions, options);
console.log(manipResult.uri); // undefined

// Correct
const manipResult = await ImageManipulator.manipulateAsync(uri, actions, options);
console.log(manipResult.uri); // file://...
```

### 2. Using unsupported file URIs on web

**Problem:** On web, `expo-image-manipulator` cannot access local file system paths directly. Passing a `file://` URI will fail.

**Solution:** Use a base64 data URI or a remote URL. When picking images, ensure you get a base64 representation for web.

```jsx
const pickImage = async () => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: Platform.OS === 'web',
  });

  if (!result.canceled) {
    const uri = Platform.OS === 'web' ? `data:image/jpeg;base64,${result.assets[0].base64}` : result.assets[0].uri;
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 300 } }]
    );
    setImage(manipResult.uri);
  }
};
```

## Common Patterns

### 1. Resizing and Compressing for Upload

It's common to resize and compress images before uploading them to a server to save bandwidth and storage.

```jsx
async function prepareForUpload(uri) {
  try {
    const manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }], // Resize to a max width of 800px
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Compress to 70% quality as a JPEG
    );
    return manipResult.uri;
  } catch (error) {
    console.error('Error preparing image for upload:', error);
    return null;
  }
}
```

### 2. Creating a Square Thumbnail

This pattern crops the image to a square and then resizes it to a specific dimension, perfect for profile pictures or thumbnails.

```jsx
async function createSquareThumbnail(uri, size = 200) {
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX: 0, originY: 0, width: 1080, height: 1080 } },
      { resize: { width: size, height: size } },
    ],
    { compress: 1, format: ImageManipulator.SaveFormat.PNG }
  );
  return manipResult.uri;
}
```

## Installation

```bash
$ npx expo install expo-image-manipulator
```

## Usage

This will first rotate the image 90 degrees clockwise, then flip the rotated image vertically and save it as a PNG.

```jsx
import { useEffect, useState } from 'react';
import { Button, Image, StyleSheet, Text, View } from 'react-native';
import { Asset } from 'expo-asset';
import { FlipType, SaveFormat, useImageManipulator } from 'expo-image-manipulator';

const IMAGE = Asset.fromModule(require('./assets/snack-icon.png'));

export default function App() {
  const [imageUri, setImageUri] = useState(IMAGE.uri);
  const [isReady, setIsReady] = useState(false);
  const context = useImageManipulator(imageUri);

  const loadImageAsync = async () => {
    await IMAGE.downloadAsync();
    setImageUri(IMAGE.localUri ?? IMAGE.uri);
    setIsReady(true);
  };

  useEffect(() => {
    loadImageAsync();
  }, []);

  const rotate90andFlip = async () => {
    context.rotate(90).flip(FlipType.Vertical);
    const renderedImage = await context.renderAsync();
    const result = await renderedImage.saveAsync({
      format: SaveFormat.PNG,
    });

    setImageUri(result.uri);
  };

  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text>Loading image...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: imageUri }} style={styles.image} />
      </View>
      <Button title="Rotate and Flip" onPress={rotate90andFlip} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  imageContainer: {
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: 300,
    height: 300,
    resizeMode: 'contain',
  },
});
```

## API
```js
import * as ImageManipulator from 'expo-image-manipulator';
```

## API Reference

### Classes

#### ImageManipulator

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

- `manipulate(source: string | SharedRef<'image'>): ImageManipulatorContext`
  Loads an image from the given URI and creates a new image manipulation context.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `source` | `string | SharedRef<'image'>` | - |

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

#### ImageManipulatorContext

A context for an image manipulation. It provides synchronous, chainable functions that schedule transformations on the original image to the background thread.
Use an asynchronous [`renderAsync`](#renderasync) to await for all transformations to finish and access the final image.

**Methods:**

- `addListener(eventName: EventName, listener: unknown): EventSubscription`
  Adds a listener for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `listener` | `unknown` | - |

- `crop(rect: { height: number; originX: number; originY: number; width: number }): ImageManipulatorContext`
  Crops the image to the given rectangle's origin and size.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `rect` | `{ height: number; originX: number; originY: number; width: number }` | Fields specify top-left corner and dimensions of a crop rectangle. |

- `emit(eventName: EventName, args: Parameters<unknown>): void`
  Synchronously calls all the listeners attached to that specific event.
The event can include any number of arguments that will be passed to the listeners.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `args` | `Parameters<unknown>` | - |

- `extent(options: { backgroundColor: null | string; height: number; originX: number; originY: number; width: number }): ImageManipulatorContext`
  Set the image size and offset. If the image is enlarged, unfilled areas are set to the `backgroundColor`.
To position the image, use `originX` and `originY`.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | `{ backgroundColor: null | string; height: number; originX: number; originY: number; width: number }` | - |

- `flip(flipType: 'vertical' | 'horizontal'): ImageManipulatorContext`
  Flips the image vertically or horizontally.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `flipType` | `'vertical' | 'horizontal'` | An axis on which image will be flipped. Only one flip per transformation is available. If you<br>want to flip according to both axes then provide two separate transformations. |

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

- `renderAsync(): Promise<ImageRef>`
  Awaits for all manipulation tasks to finish and resolves with a reference to the resulted native image.

- `reset(): ImageManipulatorContext`
  Resets the manipulator context to the originally loaded image.

- `resize(size: { height: null | number; width: null | number }): ImageManipulatorContext`
  Resizes the image to the given size.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `size` | `{ height: null | number; width: null | number }` | Values correspond to the result image dimensions. If you specify only one value, the other will<br>be calculated automatically to preserve image ratio. |

- `rotate(degrees: number): ImageManipulatorContext`
  Rotates the image by the given number of degrees.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `degrees` | `number` | Degrees to rotate the image. Rotation is clockwise when the value is positive and<br>counter-clockwise when negative. |

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

#### ImageRef
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

- `saveAsync(options: SaveOptions): Promise<ImageResult>`
  Saves the image to a new file.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `options` | `SaveOptions` | A map defining how modified image should be saved. |

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

#### manipulateAsync

Manipulate the image provided via `uri`. Available modifications are rotating, flipping (mirroring),
resizing and cropping. Each invocation results in a new file. With one invocation you can provide
a set of actions to perform over the image. Overwriting the source file would not have an effect
in displaying the result as images are cached.

```typescript
manipulateAsync(uri: string, actions: Action[], saveOptions: SaveOptions): Promise<ImageResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `uri` | `string` | URI of the file to manipulate. Should be on the local file system or a base64 data URI. |
| `actions` | `Action[]` | An array of objects representing manipulation options. Each object should have __only one__ of the keys that corresponds to specific transformation. |
| `saveOptions` | `SaveOptions` | A map defining how modified image should be saved. |

**Returns:** Promise which fulfils with [`ImageResult`](#imageresult) object.

#### useImageManipulator

```typescript
useImageManipulator(source: string | SharedRef<'image'>): ImageManipulatorContext
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `source` | `string | SharedRef<'image'>` | - |

### Types

#### Action

**Type:** `ActionResize | ActionRotate | ActionFlip | ActionCrop | ActionExtent`

#### ActionCrop

| Property | Type | Description |
| --- | --- | --- |
| `crop` | `{ height: number; originX: number; originY: number; width: number }` | Fields specify top-left corner and dimensions of a crop rectangle. |

#### ActionExtent

| Property | Type | Description |
| --- | --- | --- |
| `extent` | `{ backgroundColor: string | null; height: number; originX: number; originY: number; width: number }` | Set the image size and offset. If the image is enlarged, unfilled areas are set to the `backgroundColor`. To position the image, use `originX` and `originY`. |

#### ActionFlip

| Property | Type | Description |
| --- | --- | --- |
| `flip` | `FlipType` | An axis on which image will be flipped. Only one flip per transformation is available. If you want to flip according to both axes then provide two separate transformations. |

#### ActionResize

| Property | Type | Description |
| --- | --- | --- |
| `resize` | `{ height: number; width: number }` | Values correspond to the result image dimensions. If you specify only one value, the other will be calculated automatically to preserve image ratio. |

#### ActionRotate

| Property | Type | Description |
| --- | --- | --- |
| `rotate` | `number` | Degrees to rotate the image. Rotation is clockwise when the value is positive and counter-clockwise when negative. |

#### ImageResult

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `string` | It is included if the `base64` save option was truthy, and is a string containing the JPEG/PNG (depending on `format`) data of the image in Base64. Prepend that with `'data:image/xxx;base64,'` to get a data URI, which you can use as the source for an `Image` element for example (where `xxx` is `jpeg` or `png`). |
| `height` | `number` | Height of the image or video. |
| `uri` | `string` | An URI to the modified image (usable as the source for an `Image` or `Video` element). |
| `width` | `number` | Width of the image or video. |

#### SaveOptions

A map defining how modified image should be saved.

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `boolean` | Whether to also include the image data in Base64 format. |
| `compress` | `number` | A value in range `0.0` - `1.0` specifying compression level of the result image. `1` means no compression (highest quality) and `0` the highest compression (lowest quality). |
| `format` | `SaveFormat` | Specifies what type of compression should be used and what is the result file extension. `SaveFormat.PNG` compression is lossless but slower, `SaveFormat.JPEG` is faster but the image has visible artifacts. Defaults to `SaveFormat.JPEG` |

### Enums

#### FlipType

| Value | Description |
| --- | --- |
| `Horizontal` | - |
| `Vertical` | - |

#### SaveFormat

| Value | Description |
| --- | --- |
| `JPEG` | - |
| `PNG` | - |
| `WEBP` | - |
