---
name: video
description: Video playback component with controls and fullscreen.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Video (expo-video)

A library that provides an API to implement video playback in apps.

**Platforms:** android, ios, web, tvos

**Package:** `expo-video`

`expo-video` is a cross-platform, performant video component for React Native and Expo with Web support.

#### Known issues&ensp;

When two [`VideoView`](#videoview) components are overlapping and have the [`contentFit`](#contentfit) prop set to [`cover`](#videocontentfit), one of the videos may be displayed out of bounds. This is a [known upstream issue](https://github.com/androidx/media/issues/1107). To work around this issue, use the [`surfaceType`](#surfacetype) prop and set it to [`textureView`](#surfacetype-1).

# Quick Start

Here is a minimal example to get you started with `expo-video`. This code will render a video and a button to play or pause it.

```jsx
import React, { useRef } from 'react';
import { Button, Platform, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

const videoSource =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function App() {
  const player = useVideoPlayer(videoSource, (player) => {
    player.loop = true;
    player.play();
  });

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
      />
      <View style={styles.controlsContainer}>
        <Button
          title={player.playing ? 'Pause' : 'Play'}
          onPress={() => {
            if (player.playing) {
              player.pause();
            } else {
              player.play();
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: 320,
    height: 180,
  },
  controlsContainer: {
    padding: 10,
  },
});
```

# When to Use

Use `expo-video` whenever you need to embed and play video content within your Expo or React Native application. It is ideal for applications that require video playback for media players, social media feeds, or any other feature that involves displaying video content to the user.

# Common Pitfalls

### 1. Forgetting to include the `VideoView` component

**Problem:** The `useVideoPlayer` hook creates a video player instance, but it does not automatically render the video. Without a `VideoView` component, the video will not be visible in your application.

**Solution:** Always pair a `useVideoPlayer` hook with a `VideoView` component to render the video. The `player` instance created by the hook should be passed to the `player` prop of the `VideoView`.

```jsx
import { VideoView, useVideoPlayer } from 'expo-video';

// ...

const player = useVideoPlayer(videoSource);

return (
  <VideoView style={styles.video} player={player} />
);
```

### 2. Not handling video loading state

**Problem:** A video may take some time to load, especially on slower network connections. If you don't handle the loading state, your UI might appear frozen or unresponsive.

**Solution:** Use the `useEvent` hook to listen for `statusChange` events and display a loading indicator while the video is buffering.

```jsx
import { ActivityIndicator, View } from 'react-native';
import { useVideoPlayer, useEvent } from 'expo-video';

// ...

const player = useVideoPlayer(videoSource);
const { status } = useEvent(player, 'statusChange', { status: player.status });

return (
  <View>
    {status === 'loading' && <ActivityIndicator />}
    <VideoView style={styles.video} player={player} />
  </View>
);
```

# Common Patterns

### 1. Creating a reusable video player component

For applications that use video extensively, it's a good practice to create a reusable video player component that encapsulates the `VideoView` and its controls.

```jsx
import React from 'react';
import { Button, StyleSheet, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

export function MyVideoPlayer({ source }) {
  const player = useVideoPlayer(source, (player) => {
    player.loop = true;
  });

  return (
    <View style={styles.container}>
      <VideoView
        style={styles.video}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
      />
      <View style={styles.controlsContainer}>
        <Button
          title={player.playing ? 'Pause' : 'Play'}
          onPress={() => {
            if (player.playing) {
              player.pause();
            } else {
              player.play();
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  video: {
    width: 320,
    height: 180,
  },
  controlsContainer: {
    padding: 10,
  },
});
```
## Installation

```bash
$ npx expo install expo-video
```

## Configuration in app config

You can configure `expo-video` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-video",
        {
          "supportsBackgroundPlayback": true,
          "supportsPictureInPicture": true
        }
      ]
    ],
  }
}
```

## Usage

Here's a simple example of a video with a play and pause button.

```jsx

const videoSource =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function VideoScreen() {
  const player = useVideoPlayer(videoSource, player => {
    player.loop = true;
    player.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

  return (
    <Button
          title={isPlaying ? 'Pause' : 'Play'}
          onPress={() => {
            if (isPlaying) {
              player.pause();
            } else {
              player.play();
            }
          }}
        />
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 50,
  },
  video: {
    width: 350,
    height: 275,
  },
  controlsContainer: {
    padding: 10,
  },
});
```

### Receiving events

The changes in properties of the [`VideoPlayer`](#videoplayer) do not update the React state. Therefore, to display the information about the current state of the `VideoPlayer`, it is necessary to listen to the [events](#videoplayerevents) it emits.
The event system is based on the [`EventEmitter`](../sdk/expo/#eventemitter) class and [hooks](../sdk/expo/#hooks) from the [`expo`](../sdk/expo) package. There are a few ways to listen to events:

#### `useEvent` hook

Creates a listener that will return a stateful value that can be used in a component. It also cleans up automatically when the component unmounts.

**Example:** useEvent
```tsx

// ... Other imports, definition of the component, creating the player etc.

const { status, error } = useEvent(player, 'statusChange', { status: player.status });
// Rest of the component...
```

#### `useEventListener` hook

Built around the `Player.addListener` and `Player.removeListener` methods, creates an event listener with automatic cleanup.

**Example:** useEventListener
```tsx

// ...Other imports, definition of the component, creating the player etc.

useEventListener(player, 'statusChange', ({ status, error }) => {
  setPlayerStatus(status);
  setPlayerError(error);
  console.log('Player status changed: ', status);
});
// Rest of the component...
```

#### `Player.addListener` method

Most flexible way to listen to events, but requires manual cleanup and more boilerplate code.

**Example:** Player.addListener
```tsx
// ...Imports, definition of the component, creating the player etc.

useEffect(() => {
  const subscription = player.addListener('statusChange', ({ status, error }) => {
    setPlayerStatus(status);
    setPlayerError(error);
    console.log('Player status changed: ', status);
  });

  return () => {
    subscription.remove();
  };
}, []);
// Rest of the component...
```

### Playing local media from the assets directory

`expo-video` supports playing local media loaded using the `require` function. You can use the result as a source directly, or assign it to the `assetId` parameter of a [`VideoSource`](#videosource) if you also want to configure other properties.

**Example:** Playing local media
```tsx

const assetId = require('./assets/bigbuckbunny.mp4');

const videoSource: VideoSource = {
  assetId,
  metadata: {
    title: 'Big Buck Bunny',
    artist: 'The Open Movie Project',
  },
};

const player1 = useVideoPlayer(assetId); // You can use the `asset` directly as a video source
const player2 = useVideoPlayer(videoSource);
```

### Preloading videos

While another video is playing, a video can be loaded before showing it in the view. This allows for quicker transitions between subsequent videos and a better user experience.

To preload a video, you have to create a `VideoPlayer` with a video source. Even when the player is not connected to a `VideoView`, it will fill the buffers. Once it is connected to the `VideoView`, it will be able to start playing without buffering.

In some cases, it is beneficial to preload a video later in the screen lifecycle. In that case, a `VideoPlayer` with a `null` source should be created. To start preloading, replace the player source with a video source using the `replace()` function.

Here is an example of how to preload a video:

```tsx

const bigBuckBunnySource: VideoSource =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const elephantsDreamSource: VideoSource =
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4';

export default function PreloadingVideoPlayerScreen() {
  const player1 = useVideoPlayer(bigBuckBunnySource, player => {
    player.play();
  });

  const player2 = useVideoPlayer(elephantsDreamSource, player => {
    player.currentTime = 20;
  });

  const [currentPlayer, setCurrentPlayer] = useState(player1);

  const replacePlayer = useCallback(async () => {
    currentPlayer.pause();
    if (currentPlayer === player1) {
      setCurrentPlayer(player2);
      player1.pause();
      player2.play();
    } else {
      setCurrentPlayer(player1);
      player2.pause();
      player1.play();
    }
  }, [player1, currentPlayer]);

  return (
    Replace Player
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 50,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#4630ec',
  },
  buttonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#eeeeee',
    textAlign: 'center',
  },
  video: {
    width: 300,
    height: 168.75,
    marginVertical: 20,
  },
});
```

### Using the VideoPlayer directly

In most cases, the [`useVideoPlayer`](#usevideoplayersource-setup) hook should be used to create a `VideoPlayer` instance. It manages the player's lifecycle and ensures that it is properly disposed of when the component is unmounted. However, in some advanced use cases, it might be necessary to create a `VideoPlayer` that does not get automatically destroyed when the component is unmounted.
In those cases, the `VideoPlayer` can be created using the [`createVideoPlayer`](#videocreatevideoplayersource) function. You need be aware of the risks that come with this approach, as it is your responsibility to call the [`release()`](../sdk/expo/#release) method when the player is no longer needed. If not handled properly, this approach may lead to memory leaks.

**Example:** Creating player instance
```tsx

const player = createVideoPlayer(videoSource);
```

> **warning** On Android, mounting multiple `VideoView` components at the same time with the same `VideoPlayer` instance will not work due to a [platform limitation](https://github.com/expo/expo/issues/35012).

### Caching videos

If your app frequently replays the same video, caching can be utilized to minimize network usage and enhance user experience, albeit at the cost of increased device storage usage. `expo-video` supports video caching on `Android` and `iOS` platforms. This feature can be activated by setting the [`useCaching`](#videosource) property of a [`VideoSource`](#videosource) object to `true`.

The cache is persistent and will be cleared on a least-recently-used basis once the preferred size is exceeded. Furthermore, the system can clear the cache due to low storage availability, so it's not advisable to depend on the cache to store critical data.

The cache functions offline. If a portion or the entirety of a video is cached, it can be played from the cache even when the device is offline until the cached data is exhausted.

> Due to platform limitations, the cache cannot be used with HLS video sources on iOS. Caching DRM-protected videos is not supported on Android and iOS.

### Managing the cache

- The preferred cache size in bytes can be defined using the [`setVideoCacheSizeAsync`](#videosetvideocachesizeasyncsizebytes) function. The default cache size is 1GB.
- The [`getCurrentVideoCacheSize`](#videogetcurrentvideocachesize) can be used to get the current storage occupied by the cache in bytes.
- All cached videos can be cleared using the [`clearVideoCacheAsync`](#videoclearvideocacheasync) function.

## API

```js

```

## API Reference

### Classes

#### VideoPlayer

A class that represents an instance of the video player.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `allowsExternalPlayback` | `boolean` | Determines whether the player should allow external playback. |
| `audioMixingMode` | `AudioMixingMode` | Determines how the player will interact with other audio playing in the system. |
| `audioTrack` | `null | AudioTrack` | Specifies the audio track currently played by the player. `null` when no audio is played. |
| `availableAudioTracks` | `AudioTrack[]` | An array of audio tracks available for the current video. |
| `availableSubtitleTracks` | `SubtitleTrack[]` | An array of subtitle tracks available for the current video. |
| `availableVideoTracks` | `VideoTrack[]` | An array of video tracks available for the current video. > On iOS, when using a HLS source, make sure that the uri contains `.m3u8` extension or that the [`contentType`](#contenttype) property of the [`VideoSource`](#videosource) has been set to `'hls'`. Otherwise, the video tracks will not be available. |
| `bufferedPosition` | `number` | Float value indicating how far the player has buffered the video in seconds. This value is 0 when the player has not buffered up to the current playback time. When it's impossible to determine the buffer state (for example, when the player isn't playing any media), this value is -1. |
| `bufferOptions` | `BufferOptions` | Specifies buffer options which will be used by the player when buffering the video. > You should provide a `BufferOptions` object when setting this property. Setting individual buffer properties is not supported. |
| `currentLiveTimestamp` | `null | number` | The exact timestamp when the currently displayed video frame was sent from the server, based on the `EXT-X-PROGRAM-DATE-TIME` tag in the livestream metadata. If this metadata is missing, this property will return `null`. |
| `currentOffsetFromLive` | `null | number` | Float value indicating the latency of the live stream in seconds. If a livestream doesn't have the required metadata, this will return `null`. |
| `currentTime` | `number` | Float value indicating the current playback time in seconds. If the player is not yet playing, this value indicates the time position at which playback will begin once the `play()` method is called. Setting `currentTime` to a new value seeks the player to the given time. Note that frame accurate seeking may incur additional decoding delay which can impact seeking performance. Consider using the [`seekBy`](#seekbyseconds) function if the time does not have to be set precisely. |
| `duration` | `number` | Float value indicating the duration of the current video in seconds. |
| `isExternalPlaybackActive` | `boolean` | Indicates whether the player is currently playing back the media to an external device via AirPlay. |
| `isLive` | `boolean` | Boolean value indicating whether the player is currently playing a live stream. |
| `loop` | `boolean` | Determines whether the player should automatically replay after reaching the end of the video. |
| `muted` | `boolean` | Boolean value whether the player is currently muted. Setting this property to `true`/`false` will mute/unmute the player. |
| `playbackRate` | `number` | Float value between `0` and `16.0` indicating the current playback speed of the player. |
| `playing` | `boolean` | Boolean value whether the player is currently playing. > Use `play` and `pause` methods to control the playback. |
| `preservesPitch` | `boolean` | Boolean value indicating if the player should correct audio pitch when the playback speed changes. |
| `showNowPlayingNotification` | `boolean` | Boolean value determining whether the player should show the now playing notification. |
| `status` | `VideoPlayerStatus` | Indicates the current status of the player. |
| `staysActiveInBackground` | `boolean` | Determines whether the player should continue playing after the app enters the background. |
| `subtitleTrack` | `null | SubtitleTrack` | Specifies the subtitle track which is currently displayed by the player. `null` when no subtitles are displayed. > To ensure a valid subtitle track, always assign one of the subtitle tracks from the [`availableSubtitleTracks`](#availablesubtitletracks) array. |
| `targetOffsetFromLive` | `number` | Float value indicating the time offset from the live in seconds. |
| `timeUpdateEventInterval` | `number` | Float value indicating the interval in seconds at which the player will emit the [`timeUpdate`](#videoplayerevents) event. When the value is equal to `0`, the event will not be emitted. |
| `videoTrack` | `null | VideoTrack` | Specifies the video track currently played by the player. `null` when no video is displayed. |
| `volume` | `number` | Float value between `0` and `1.0` representing the current volume. Muting the player doesn't affect the volume. In other words, when the player is muted, the volume is the same as when unmuted. Similarly, setting the volume doesn't unmute the player. |

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

- `generateThumbnailsAsync(times: number | number[], options: VideoThumbnailOptions): Promise<VideoThumbnail[]>`
  Generates thumbnails from the currently played asset. The thumbnails are references to native images,
thus they can be used as a source of the `Image` component from `expo-image`.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `times` | `number | number[]` | - |
  | `options` | `VideoThumbnailOptions` | - |

- `listenerCount(eventName: EventName): number`
  Returns a number of listeners added to the given event.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |

- `pause(): void`
  Pauses the player.

- `play(): void`
  Resumes the player.

- `release(): void`
  A function that detaches the JS and native objects to let the native object deallocate
before the JS object gets deallocated by the JS garbage collector. Any subsequent calls to native
functions of the object will throw an error as it is no longer associated with its native counterpart.

In most cases, you should never need to use this function, except some specific performance-critical cases when
manual memory management makes sense and the native object is known to exclusively retain some native memory
(such as binary data or image bitmap). Before calling this function, you should ensure that nothing else will use
this object later on. Shared objects created by React hooks are usually automatically released in the effect's cleanup phase,
for example: `useVideoPlayer()` from `expo-video` and `useImage()` from `expo-image`.

- `removeAllListeners(eventName: unknown): void`
  Removes all listeners for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `unknown` | - |

- `removeListener(eventName: EventName, listener: unknown): void`
  Removes a listener for the given event name.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `eventName` | `EventName` | - |
  | `listener` | `unknown` | - |

- `replace(source: VideoSource, disableWarning: boolean): void`
  Replaces the current source with a new one.

> On iOS, this method loads the asset data synchronously on the UI thread and can block it for extended periods of time.
> Use `replaceAsync` to load the asset asynchronously and avoid UI lags.

> This method will be deprecated in the future.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `source` | `VideoSource` | - |
  | `disableWarning` | `boolean` | - |

- `replaceAsync(source: VideoSource): Promise<void>`
  Replaces the current source with a new one, while offloading loading of the asset to a different thread.

> On Android and Web, this method is equivalent to `replace`.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `source` | `VideoSource` | - |

- `replay(): void`
  Seeks the playback to the beginning.

- `seekBy(seconds: number): void`
  Seeks the playback by the given number of seconds. The time to which the player seeks may differ from the specified requested time for efficiency,
depending on the encoding and what is currently buffered by the player. Use this function to implement playback controls that seek by specific amount of time,
in which case, the actual time usually does not have to be precise. For frame accurate seeking, use the [`currentTime`](#currenttime) property.
  | Parameter | Type | Description |
  | --- | --- | --- |
  | `seconds` | `number` | - |

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

#### VideoThumbnail

Represents a video thumbnail that references a native image.
Instances of this class can be passed as a source to the `Image` component from `expo-image`.

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `actualTime` | `number` | The time in seconds at which the thumbnail was actually generated. |
| `height` | `number` | Height of the created thumbnail. |
| `nativeRefType` | `string` | The type of the native reference. |
| `requestedTime` | `number` | The time in seconds at which the thumbnail was to be created. |
| `width` | `number` | Width of the created thumbnail. |

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

#### VideoView

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `nativeRef` | `RefObject<any>` | - |

**Methods:**

- `enterFullscreen(): Promise<void>`
  Enters fullscreen mode.

- `exitFullscreen(): Promise<void>`
  Exits fullscreen mode.

- `render(): ReactNode`

- `startPictureInPicture(): Promise<void>`
  Enters Picture in Picture (PiP) mode. Throws an exception if the device does not support PiP.
> **Note:** Only one player can be in Picture in Picture (PiP) mode at a time.

> **Note:** The `supportsPictureInPicture` property of the [config plugin](#configuration-in-app-config)
> has to be configured for the PiP to work.

- `stopPictureInPicture(): Promise<void>`
  Exits Picture in Picture (PiP) mode.

### Methods

#### clearVideoCacheAsync

Clears all video cache.
> This function can be called only if there are no existing `VideoPlayer` instances.

**Platform:** android

```typescript
clearVideoCacheAsync(): Promise<void>
```

**Returns:** A promise that fulfills after the cache has been cleaned.

#### createVideoPlayer

Creates a direct instance of `VideoPlayer` that doesn't release automatically.

> **info** For most use cases you should use the [`useVideoPlayer`](#usevideoplayer) hook instead. See the [Using the VideoPlayer Directly](#using-the-videoplayer-directly) section for more details.

```typescript
createVideoPlayer(source: VideoSource): VideoPlayer
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `source` | `VideoSource` | - |

#### getCurrentVideoCacheSize

Returns the space currently occupied by the video cache in bytes.

**Platform:** android

```typescript
getCurrentVideoCacheSize(): number
```

#### isPictureInPictureSupported

Returns whether the current device supports Picture in Picture (PiP) mode.

**Platform:** android

```typescript
isPictureInPictureSupported(): boolean
```

**Returns:** A `boolean` which is `true` if the device supports PiP mode, and `false` otherwise.

#### setVideoCacheSizeAsync

Sets desired video cache size in bytes. The default video cache size is 1GB. Value set by this function is persistent.
The cache size is not guaranteed to be exact and the actual cache size may be slightly larger. The cache is evicted on a least-recently-used basis.
> This function can be called only if there are no existing `VideoPlayer` instances.

**Platform:** android

```typescript
setVideoCacheSizeAsync(sizeBytes: number): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `sizeBytes` | `number` | - |

**Returns:** A promise that fulfills after the cache size has been set.

#### useVideoPlayer

Creates a `VideoPlayer`, which will be automatically cleaned up when the component is unmounted.

```typescript
useVideoPlayer(source: VideoSource, setup: (player: VideoPlayer) => void): VideoPlayer
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `source` | `VideoSource` | A video source that is used to initialize the player. |
| `setup` | `(player: VideoPlayer) => void` | A function that allows setting up the player. It will run after the player is created. |

#### VideoAirPlayButton

A view displaying the [`AVRoutePickerView`](https://developer.apple.com/documentation/avkit/avroutepickerview). Shows a button, when pressed, an AirPlay device picker shows up, allowing users to stream the currently playing video
to any available AirPlay sink.

> When using this view, make sure that the [`allowsExternalPlayback`](#allowsexternalplayback) player property is set to `true`.

**Platform:** ios

```typescript
VideoAirPlayButton(props: VideoAirPlayButtonProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `props` | `VideoAirPlayButtonProps` | - |

### Interfaces

#### VideoAirPlayButtonProps

| Property | Type | Description |
| --- | --- | --- |
| `activeTint` | `ColorValue` | The color of the button icon while AirPlay sharing is active. |
| `onBeginPresentingRoutes` | `() => void` | A callback called when the AirPlay route selection popup is about to show. |
| `onEndPresentingRoutes` | `() => void` | A callback called when the AirPlay route selection popup has disappeared. |
| `prioritizeVideoDevices` | `boolean` | Determines whether the AirPlay device selection popup should show video outputs first. |
| `tint` | `ColorValue` | The color of the button icon while AirPlay sharing is not active. |

#### VideoViewProps

| Property | Type | Description |
| --- | --- | --- |
| `allowsFullscreen` | `boolean` | Determines whether fullscreen mode is allowed or not. > Note: This option has been deprecated in favor of the `fullscreenOptions` prop and will be disabled in the future. |
| `allowsPictureInPicture` | `boolean` | Determines whether the player allows Picture in Picture (PiP) mode. > **Note:** The `supportsPictureInPicture` property of the [config plugin](#configuration-in-app-config) > has to be configured for the PiP to work. |
| `allowsVideoFrameAnalysis` | `boolean` | Specifies whether to perform video frame analysis (Live Text in videos). Check official [Apple documentation](https://developer.apple.com/documentation/avkit/avplayerviewcontroller/allowsvideoframeanalysis) for more details. |
| `contentFit` | `VideoContentFit` | Describes how the video should be scaled to fit in the container. Options are `'contain'`, `'cover'`, and `'fill'`. |
| `contentPosition` | `{ dx: number; dy: number }` | Determines the position offset of the video inside the container. |
| `crossOrigin` | `'anonymous' | 'use-credentials'` | Determines the [cross origin policy](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/crossorigin) used by the underlying native view on web. If `undefined` (default), does not use CORS at all. If set to `'anonymous'`, the video will be loaded with CORS enabled. Note that some videos may not play if CORS is enabled, depending on the CDN settings. If you encounter issues, consider adjusting the `crossOrigin` property. |
| `fullscreenOptions` | `FullscreenOptions` | Determines the fullscreen mode options. |
| `nativeControls` | `boolean` | Determines whether native controls should be displayed or not. |
| `onFirstFrameRender` | `() => void` | A callback to call after the mounted `VideoPlayer` has rendered the first frame into the `VideoView`. This event can be used to hide any cover images that conceal the initial loading of the player. > **Note:** This event may also be called during playback when the current video track changes (for example when the player switches video quality). |
| `onFullscreenEnter` | `() => void` | A callback to call after the video player enters fullscreen mode. |
| `onFullscreenExit` | `() => void` | A callback to call after the video player exits fullscreen mode. |
| `onPictureInPictureStart` | `() => void` | A callback to call after the video player enters Picture in Picture (PiP) mode. |
| `onPictureInPictureStop` | `() => void` | A callback to call after the video player exits Picture in Picture (PiP) mode. |
| `player` | `VideoPlayer` | A video player instance. Use [`useVideoPlayer()`](#usevideoplayersource-setup) hook to create one. |
| `playsInline` | `boolean` | Determines whether a video should be played "inline", that is, within the element's playback area. |
| `requiresLinearPlayback` | `boolean` | Determines whether the player allows the user to skip media content. |
| `showsTimecodes` | `boolean` | Determines whether the timecodes should be displayed or not. |
| `startsPictureInPictureAutomatically` | `boolean` | Determines whether the player should start Picture in Picture (PiP) automatically when the app is in the background. > **Note:** Only one player can be in Picture in Picture (PiP) mode at a time. > **Note:** The `supportsPictureInPicture` property of the [config plugin](#configuration-in-app-config) > has to be configured for the PiP to work. |
| `surfaceType` | `SurfaceType` | Determines the type of the surface used to render the video. > This prop should not be changed at runtime. |
| `useExoShutter` | `boolean` | Determines whether the player should use the default ExoPlayer shutter that covers the `VideoView` before the first video frame is rendered. Setting this property to `false` makes the Android behavior the same as iOS. |

### Types

#### AudioMixingMode

Specifies the audio mode that the player should use. Audio mode is set on per-app basis, if there are multiple players playing and
have different a `AudioMode` specified, the highest priority mode will be used. Priority order: 'doNotMix' > 'auto' > 'duckOthers' > 'mixWithOthers'.

- `mixWithOthers`: The player will mix its audio output with other apps.
- `duckOthers`: The player will lower the volume of other apps if any of the active players is outputting audio.
- `auto`: The player will allow other apps to keep playing audio only when it is muted. On iOS it will always interrupt other apps when `showNowPlayingNotification` is `true` due to system requirements.
- `doNotMix`: The player will pause playback in other apps, even when it's muted.

> On iOS, the Now Playing notification is dependent on the audio mode. If the audio mode is different from `doNotMix` or `auto` this feature will not work.

**Type:** `'mixWithOthers' | 'duckOthers' | 'auto' | 'doNotMix'`

#### AudioTrack

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | A string used by expo-video to identify the audio track. |
| `label` | `string` | Label of the audio track in the language of the device. |
| `language` | `string` | Language of the audio track. For example, 'en', 'pl', 'de'. |

#### BufferOptions

Specifies buffer options which will be used by the player when buffering the video.

| Property | Type | Description |
| --- | --- | --- |
| `maxBufferBytes` | `number | null` | The maximum number of bytes that the player can buffer from the network. When 0 the player will automatically decide appropriate buffer size. |
| `minBufferForPlayback` | `number` | Minimum duration of the buffer in seconds required to continue playing after the player has been paused or started buffering. > This property will be ignored if `preferredForwardBufferDuration` is lower. |
| `preferredForwardBufferDuration` | `number` | The duration in seconds which determines how much media the player should buffer ahead of the current playback time. On iOS when set to `0` the player will automatically decide appropriate buffer duration. Equivalent to [`AVPlayerItem.preferredForwardBufferDuration`](https://developer.apple.com/documentation/avfoundation/avplayeritem/1643630-preferredforwardbufferduration). |
| `prioritizeTimeOverSizeThreshold` | `boolean` | A Boolean value which determines whether the player should prioritize time over size when buffering media. |
| `waitsToMinimizeStalling` | `boolean` | A Boolean value that indicates whether the player should automatically delay playback in order to minimize stalling. Equivalent to [`AVPlayer.automaticallyWaitsToMinimizeStalling`](https://developer.apple.com/documentation/avfoundation/avplayer/1643482-automaticallywaitstominimizestal). |

#### ContentType

Specifies the content type of the source.

- `auto`: The player will automatically determine the content type of the video.
- `progressive`: The player will use progressive download content type. This is the default `ContentType` when the uri does not contain an extension.
- `hls`: The player will use HLS content type.
- `dash`: The player will use DASH content type (Android-only).
- `smoothStreaming`: The player will use SmoothStreaming content type (Android-only).

**Type:** `'auto' | 'progressive' | 'hls' | 'dash' | 'smoothStreaming'`

#### DRMOptions

Specifies DRM options which will be used by the player while loading the video.

| Property | Type | Description |
| --- | --- | --- |
| `base64CertificateData` | `string` | Specifies the base64 encoded certificate data for the FairPlay DRM. When this property is set, the `certificateUrl` property is ignored. |
| `certificateUrl` | `string` | Specifies the certificate URL for the FairPlay DRM. |
| `contentId` | `string` | Specifies the content ID of the stream. |
| `headers` | `Record<string, string>` | Determines headers sent to the license server on license requests. |
| `licenseServer` | `string` | Determines the license server URL. |
| `multiKey` | `boolean` | Specifies whether the DRM is a multi-key DRM. |
| `type` | `DRMType` | Determines which type of DRM to use. |

#### DRMType

Specifies which type of DRM to use:
- Android supports ClearKey, PlayReady and Widevine.
- iOS supports FairPlay.

**Type:** `'clearkey' | 'fairplay' | 'playready' | 'widevine'`

#### IsExternalPlaybackActiveChangeEventPayload

| Property | Type | Description |
| --- | --- | --- |
| `isExternalPlaybackActive` | `boolean` | The current external playback status. |
| `oldIsExternalPlaybackActive` | `boolean` | The previous external playback status. |

#### MutedChangeEventPayload

Data delivered with the [`mutedChange`](#videoplayerevents) event.

| Property | Type | Description |
| --- | --- | --- |
| `muted` | `boolean` | Boolean value whether the player is currently muted. |
| `oldMuted` | `boolean` | Previous value of the `isMuted` property. |

#### PlaybackRateChangeEventPayload

Data delivered with the [`playbackRateChange`](#videoplayerevents) event.

| Property | Type | Description |
| --- | --- | --- |
| `oldPlaybackRate` | `number` | Previous value of the `playbackRate` property. |
| `playbackRate` | `number` | Float value indicating the current playback speed of the player. |

#### PlayerError

Contains information about any errors that the player encountered during the playback

| Property | Type | Description |
| --- | --- | --- |
| `message` | `string` | - |

#### PlayingChangeEventPayload

Data delivered with the [`playingChange`](#videoplayerevents) event.

| Property | Type | Description |
| --- | --- | --- |
| `isPlaying` | `boolean` | Boolean value whether the player is currently playing. |
| `oldIsPlaying` | `boolean` | Previous value of the `isPlaying` property. |

#### SourceChangeEventPayload

Data delivered with the [`sourceChange`](#videoplayerevents) event.

| Property | Type | Description |
| --- | --- | --- |
| `oldSource` | `VideoSource` | Previous source of the player. |
| `source` | `VideoSource` | New source of the player. |

#### SourceLoadEventPayload

Data delivered with the [`sourceLoad`](#videoplayerevents) event, contains information about the video source that has finished loading.

| Property | Type | Description |
| --- | --- | --- |
| `availableAudioTracks` | `AudioTrack[]` | Audio tracks available for the loaded video source. |
| `availableSubtitleTracks` | `SubtitleTrack[]` | Subtitle tracks available for the loaded video source. |
| `availableVideoTracks` | `VideoTrack[]` | Video tracks available for the loaded video source. > On iOS, when using a HLS source, make sure that the uri contains `.m3u8` extension or that the [`contentType`](#contenttype) property of the [`VideoSource`](#videosource) has been set to `'hls'`. Otherwise, the video tracks will not be available. |
| `duration` | `number` | Duration of the video source in seconds. |
| `videoSource` | `VideoSource | null` | The video source that has been loaded. |

#### StatusChangeEventPayload

Data delivered with the [`statusChange`](#videoplayerevents) event.

| Property | Type | Description |
| --- | --- | --- |
| `error` | `PlayerError` | Error object containing information about the error that occurred. |
| `oldStatus` | `VideoPlayerStatus` | Previous status of the player. |
| `status` | `VideoPlayerStatus` | New status of the player. |

#### SubtitleTrack

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | A string used by `expo-video` to identify the subtitle track. |
| `label` | `string` | Label of the subtitle track in the language of the device. |
| `language` | `string` | Language of the subtitle track. For example, `en`, `pl`, `de`. |

#### SubtitleTrackChangeEventPayload

| Property | Type | Description |
| --- | --- | --- |
| `oldSubtitleTrack` | `SubtitleTrack | null` | Previous subtitle track of the player. |
| `subtitleTrack` | `SubtitleTrack | null` | New subtitle track of the player. |

#### SurfaceType

Describes the type of the surface used to render the video.
- `surfaceView`: Uses the `SurfaceView` to render the video. This value should be used in the majority of cases. Provides significantly lower power consumption, better performance, and more features.
- `textureView`: Uses the `TextureView` to render the video. Should be used in cases where the SurfaceView is not supported or causes issues (for example, overlapping video views).

You can learn more about surface types in the official [ExoPlayer documentation](https://developer.android.com/media/media3/ui/playerview#surfacetype).

**Type:** `'textureView' | 'surfaceView'`

#### TimeUpdateEventPayload

Data delivered with the [`timeUpdate`](#videoplayerevents) event, contains information about the current playback progress.

| Property | Type | Description |
| --- | --- | --- |
| `bufferedPosition` | `number` | Float value indicating how far the player has buffered the video in seconds. Same as the [`bufferedPosition`](#bufferedPosition) property. |
| `currentLiveTimestamp` | `number | null` | The exact timestamp when the currently displayed video frame was sent from the server, based on the `EXT-X-PROGRAM-DATE-TIME` tag in the livestream metadata. Same as the [`currentLiveTimestamp`](#currentlivetimestamp) property. |
| `currentOffsetFromLive` | `number | null` | Float value indicating the latency of the live stream in seconds. Same as the [`currentOffsetFromLive`](#currentoffsetfromlive) property. |
| `currentTime` | `number` | Float value indicating the current playback time in seconds. Same as the [`currentTime`](#currenttime) property. |

#### VideoContentFit

Describes how a video should be scaled to fit in a container.
- `contain`: The video maintains its aspect ratio and fits inside the container, with possible letterboxing/pillarboxing.
- `cover`: The video maintains its aspect ratio and covers the entire container, potentially cropping some portions.
- `fill`: The video stretches/squeezes to completely fill the container, potentially causing distortion.

**Type:** `'contain' | 'cover' | 'fill'`

#### VideoMetadata

Contains information that will be displayed in the now playing notification when the video is playing.

| Property | Type | Description |
| --- | --- | --- |
| `artist` | `string` | Secondary text that will be displayed under the title. |
| `artwork` | `string` | The uri of the video artwork. |
| `title` | `string` | The title of the video. |

#### VideoPlayerEvents

Handlers for events which can be emitted by the player.

| Property | Type | Description |
| --- | --- | --- |
| `audioTrackChange` | `any` | - |
| `availableAudioTracksChange` | `any` | - |
| `availableSubtitleTracksChange` | `any` | - |
| `isExternalPlaybackActiveChange` | `any` | - |
| `mutedChange` | `any` | - |
| `playbackRateChange` | `any` | - |
| `playingChange` | `any` | - |
| `playToEnd` | `any` | - |
| `sourceChange` | `any` | - |
| `sourceLoad` | `any` | - |
| `statusChange` | `any` | - |
| `subtitleTrackChange` | `any` | - |
| `timeUpdate` | `any` | - |
| `videoTrackChange` | `any` | - |
| `volumeChange` | `any` | - |

#### VideoPlayerStatus

Describes the current status of the player.
- `idle`: The player is not playing or loading any videos.
- `loading`: The player is loading video data from the provided source
- `readyToPlay`: The player has loaded enough data to start playing or to continue playback.
- `error`: The player has encountered an error while loading or playing the video.

**Type:** `'idle' | 'loading' | 'readyToPlay' | 'error'`

#### VideoSize

Specifies the size of a video track.

| Property | Type | Description |
| --- | --- | --- |
| `height` | `number` | Height of the video track in pixels. |
| `width` | `number` | Width of the video track in pixels. |

#### VideoSource

**Type:** `string | number | null | { assetId: number; contentType: ContentType; drm: DRMOptions; headers: Record<string, string>; metadata: VideoMetadata; uri: string; useCaching: boolean }`

#### VideoThumbnailOptions

Additional options for video thumbnails generation.

| Property | Type | Description |
| --- | --- | --- |
| `maxHeight` | `number` | If provided, the generated thumbnail will not exceed this height in pixels, preserving its aspect ratio. |
| `maxWidth` | `number` | If provided, the generated thumbnail will not exceed this width in pixels, preserving its aspect ratio. |

#### VideoTrack

Specifies a VideoTrack loaded from a [`VideoSource`](#videosource).

| Property | Type | Description |
| --- | --- | --- |
| `bitrate` | `number | null` | Specifies the bitrate in bits per second. This is the peak bitrate if known, or else the average bitrate if known, or else null. |
| `frameRate` | `number | null` | Specifies the frame rate of the video track in frames per second. |
| `id` | `string` | The id of the video track. > This field is platform-specific and may return different depending on the operating system. |
| `isSupported` | `boolean` | Indicates whether the video track format is supported by the device. |
| `mimeType` | `string | null` | MimeType of the video track or null if unknown. |
| `size` | `VideoSize` | Size of the video track. |

#### VideoTrackChangeEventPayload

Data delivered with the [`videoTrackChange`](#videoplayerevents) event, contains information about the video track which is currently being played.

| Property | Type | Description |
| --- | --- | --- |
| `oldVideoTrack` | `VideoTrack | null` | Previous video track of the player. |
| `videoTrack` | `VideoTrack | null` | New video track of the player. |

#### VolumeChangeEventPayload

Data delivered with the [`volumeChange`](#videoplayerevents) event.

| Property | Type | Description |
| --- | --- | --- |
| `oldVolume` | `number` | Previous value of the `volume` property. |
| `volume` | `number` | Float value indicating the current volume of the player. |
