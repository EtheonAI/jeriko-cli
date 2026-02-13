---
name: audio
description: Record and play audio with full playback control.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Audio (expo-audio)

A library that provides an API to implement audio playback and recording in apps.

**Platforms:** android, ios, web, tvos

**Package:** `expo-audio`

`expo-audio` is a cross-platform audio library for accessing the native audio capabilities of the device.

Note that audio automatically stops if headphones/bluetooth audio devices are disconnected.

## Quick Start

Here is a minimal example to play a sound. This assumes you have an `assets` directory with a `sound.mp3` file.

```tsx
import { useAudioPlayer } from 'expo-audio';
import { Button, StyleSheet, View } from 'react-native';

const audioSource = require('./assets/sound.mp3');

export default function App() {
  const player = useAudioPlayer(audioSource);

  return (
    <View style={styles.container}>
      <Button title="Play Sound" onPress={() => player.play()} />
      <Button
        title="Replay Sound"
        onPress={() => {
          player.seekTo(0);
          player.play();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 10,
  },
});
```

## When to Use

Use `expo-audio` for simple audio playback and recording. It is suitable for playing sound effects, background music, and recording short audio clips. For more complex audio processing, such as streaming or real-time communication, consider using a more advanced library.

## Common Pitfalls

- **Problem**: Audio does not play in silent mode on iOS.
  **Solution**: You need to set the audio mode to allow playback in silent mode.

  ```tsx
  import { setAudioModeAsync } from 'expo-audio';

  await setAudioModeAsync({
    playsInSilentMode: true,
  });
  ```

- **Problem**: Memory leaks when using `createAudioPlayer` manually.
  **Solution**: Always call `remove()` when done with players created via `createAudioPlayer`.

  ```tsx
  import { createAudioPlayer } from 'expo-audio';

  const player = createAudioPlayer(source);
  player.play();

  // When done, clean up:
  player.remove();
  ```

## Common Patterns

### Looping Audio

```tsx
import { useAudioPlayer } from 'expo-audio';

const player = useAudioPlayer(source, { loop: true });
player.play();
```

### Tracking Playback Status

```tsx
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

const player = useAudioPlayer(source);
const status = useAudioPlayerStatus(player);

if (status.playing) {
  console.log('Audio is playing');
}
console.log(`Position: ${status.currentTime}s / ${status.duration}s`);
```

## Installation

```bash
$ npx expo install expo-audio
```

## Configuration in app config

You can configure `expo-audio` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-audio",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone."
        }
      ]
    ]
  }
}
```

## Usage

### Quick recipes (copy/paste)

These are the common patterns you'll reach for most often. The full API reference remains below.

#### Basic import

```ts
import {
  createAudioPlayer,
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  RecordingPresets,
} from 'expo-audio';
```

#### Playing sounds

```jsx
import { useAudioPlayer } from 'expo-audio';
import { Button, StyleSheet, View } from 'react-native';

const audioSource = require('./assets/Hello.mp3');

export default function App() {
  const player = useAudioPlayer(audioSource);

  return (
    <View style={styles.container}>
      <Button title="Play sound" onPress={() => player.play()} />
      <Button
        title="Replay sound"
        onPress={() => {
          player.seekTo(0);
          player.play();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 10,
  },
});
```

> **Info** **Note:** If you're migrating from [`expo-av`](av.mdx), you'll notice that `expo-audio` doesn't automatically reset the playback position when audio finishes. After [`play()`](#play), the player stays paused at the end of the sound. To play it again, call [`seekTo(seconds)`](#seektoseconds-tolerancemillisbefore-tolerancemillisafter) to reset the position — as shown in the example above.

#### Recording sounds
```jsx
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Alert, Button, StyleSheet, Text, View } from 'react-native';

export default function App() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder);
  const [uri, setUri] = useState(null);

  const record = async () => {
    await audioRecorder.prepareToRecordAsync();
    audioRecorder.record();
  };

  const stopRecording = async () => {
    // The recording will be available on `audioRecorder.uri`.
    await audioRecorder.stop();
    setUri(audioRecorder.uri);
  };

  useEffect(() => {
    (async () => {
      const status = await requestRecordingPermissionsAsync();
      if (!status.granted) {
        Alert.alert('Permission to access microphone was denied');
      }

      setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Button
        title={recorderState.isRecording ? 'Stop recording' : 'Start recording'}
        onPress={recorderState.isRecording ? stopRecording : record}
      />
      {uri ? <Text>Recording saved: {uri}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 10,
  },
});
```

### Common patterns

#### Stream audio from a URL

```ts
const player = createAudioPlayer('https://stream.example.com/radio');
player.play();
```

> **Note:** If you create players manually with `createAudioPlayer`, you are responsible for cleaning them up (see best practices below).

#### Play multiple sounds

When you need multiple players (for example, sound effects), create them in parallel and remove/release them when the screen unmounts.

```ts
const p1 = createAudioPlayer(require('./sound1.mp3'));
const p2 = createAudioPlayer(require('./sound2.mp3'));

p1.play();
p2.play();

// Later, when you're done:
// p1.remove();
// p2.remove();
```

#### Track playback progress
Prefer `useAudioPlayerStatus()` for progress UI.

```tsx
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Text, View } from 'react-native';

export function AudioPlayerWithProgress() {
  const player = useAudioPlayer(require('./audio.mp3'));
  const status = useAudioPlayerStatus(player);

  const position = Math.floor(status.currentTime);
  const duration = Math.floor(status.duration);
  const pct = duration > 0 ? (status.currentTime / status.duration) * 100 : 0;

  return (
    <View>
      <Text>
        {position}s / {duration}s
      </Text>
      <View style={{ width: '100%', height: 4, backgroundColor: '#ddd' }}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#007AFF' }} />
      </View>
    </View>
  );
}
```

#### Preload audio

```ts
export function preloadSoundsAsync() {
  const players = [
    createAudioPlayer(require('./sound1.mp3')),
    createAudioPlayer(require('./sound2.mp3')),
    createAudioPlayer(require('./sound3.mp3')),
  ];
  return players;
}
```

### Error handling

Wrap creation and playback in `try/catch`, especially for remote URLs and user-controlled inputs.

```ts
try {
  const player = createAudioPlayer({ uri: 'https://example.com/audio.mp3' });
  player.play();
} catch (error) {
  console.error('Audio error:', error);
}
```

### Best practices

1. **Clean up resources**: If you create a player/recorder manually, make sure to call `remove()` (and/or `release()` if you're managing lifetimes explicitly) when you're done to avoid leaks.
2. **Set audio mode early**: Configure global behavior with `setAudioModeAsync()` before starting playback/recording (silent mode, interruptions, background behavior).
3. **Handle permissions for recording**: Check/request microphone permission before recording. On web, the page must be served securely for mic access.
4. **Use listeners sparingly**: Prefer hooks like `useAudioPlayerStatus()`/`useAudioRecorderState()`, and remove listeners if you add them manually.
5. **Preload frequently used sounds**: Preload short UI sounds during app startup to make playback instant.
6. **Plan for interruptions**: Use audio mode settings to define how your audio interacts with other apps (calls, music, navigation).

### Migration from expo-av

If migrating from `expo-av` audio APIs, common mappings:

- `Audio.Sound` -> `AudioPlayer`
- `createAsync()` -> `useAudioPlayer()` / `createAudioPlayer()`
- `unloadAsync()` -> `remove()` (or `release()` for manual lifecycle management)
- Status callbacks: use event listeners or `useAudioPlayerStatus()` instead of relying on `setOnPlaybackStatusUpdate`
- Playback reset: `expo-audio` does **not** automatically reset position at the end; call `seekTo(0)` before replaying

### Playing or recording audio in background&ensp;(platforms: ['ios'])

On iOS, audio playback and recording in background is only available in standalone apps, and it requires some extra configuration.
On iOS, each background feature requires a special key in `UIBackgroundModes` array in your **Info.plist** file.
In standalone apps this array is empty by default, so to use background features you will need to add appropriate keys to your **app.json** configuration.

See an example of **app.json** that enables audio playback in background:

```json
{
  "expo": {
    ...
    "ios": {
      ...
      "infoPlist": {
        ...
        "UIBackgroundModes": [
          "audio"
        ]
      }
    }
  }
}
```

### Using the AudioPlayer directly
In most cases, the [`useAudioPlayer`](#useaudioplayersource-options) hook should be used to create a `AudioPlayer` instance. It manages the player's lifecycle and ensures that it is properly disposed of when the component is unmounted. However, in some advanced use cases, it might be necessary to create a `AudioPlayer` that does not get automatically destroyed when the component is unmounted.
In those cases, the `AudioPlayer` can be created using the [`createAudioPlayer`](#audiocreateaudioplayersource-options) function. You need to be aware of the risks that come with this approach, as it is your responsibility to call the [`release()`](../sdk/expo/#release) method when the player is no longer needed. If not handled properly, this approach may lead to memory leaks.

```tsx
const player = createAudioPlayer(audioSource);
```

### Notes on web usage

- A MediaRecorder issue on Chrome produces WebM files missing the duration metadata. [See the open Chromium issue](https://bugs.chromium.org/p/chromium/issues/detail?id=642012).
- MediaRecorder encoding options and other configurations are inconsistent across browsers, utilizing a Polyfill such as [kbumsik/opus-media-recorder](https://github.com/kbumsik/opus-media-recorder) or [ai/audio-recorder-polyfill](https://github.com/ai/audio-recorder-polyfill) in your application will improve your experience. Any options passed to `prepareToRecordAsync` will be passed directly to the MediaRecorder API and as such the polyfill.
