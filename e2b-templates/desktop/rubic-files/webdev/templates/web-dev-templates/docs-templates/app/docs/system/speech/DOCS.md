---
name: speech
description: Text-to-speech synthesis.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Speech

A library that provides access to text-to-speech functionality.

**Platforms:** android, ios, web

**Package:** `expo-speech`

`expo-speech` provides an API that allows you to utilize Text-to-speech functionality in your app.

> **info** On iOS physical devices, `expo-speech` won't produce sound if the device is in silent mode. Make sure silent mode is turned off.

## Quick Start

```jsx
import React from 'react';
import { View, StyleSheet, Button } from 'react-native';
import * as Speech from 'expo-speech';

export default function App() {
  const speak = () => {
    const thingToSay = 'Hello, world!';
    Speech.speak(thingToSay);
  };

  return (
    <View style={styles.container}>
      <Button title="Press to hear some words" onPress={speak} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 8,
  },
});
```

## When to Use

Use `expo-speech` when you need to convert text to spoken words within your application. This is useful for accessibility features, language learning apps, or providing auditory feedback to users.

## Common Pitfalls

### 1. Speech not working in silent mode on iOS

-   **Problem**: On iOS devices, if the device is in silent mode, no sound will be produced.
-   **Solution**: Inform the user to turn off silent mode. There is no programmatic solution to this.

### 2. Speech is cut off abruptly

-   **Problem**: Calling `Speech.speak()` multiple times in quick succession can cause the previous speech to be cut off.
-   **Solution**: Check if speech is already in progress using `Speech.isSpeakingAsync()` before calling `Speech.speak()` again, or use the `onDone` callback to manage sequential speech.

```jsx
import { Button } from 'react-native';
import * as Speech from 'expo-speech';

const speak = async () => {
  const isSpeaking = await Speech.isSpeakingAsync();
  if (!isSpeaking) {
    Speech.speak('This will not be interrupted.');
  }
};
```

## Common Patterns

### 1. Selecting a Different Voice

You can customize the voice used for speech synthesis by fetching the list of available voices and specifying a voice identifier.

```jsx
import React, { useState, useEffect } from 'react';
import { View, Button } from 'react-native';
import * as Speech from 'expo-speech';

export default function VoiceSelection() {
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    async function loadVoices() {
      const availableVoices = await Speech.getAvailableVoicesAsync();
      setVoices(availableVoices);
      // Select a default voice
      if (availableVoices.length > 0) {
        setSelectedVoice(availableVoices[0].identifier);
      }
    }
    loadVoices();
  }, []);

  const speakWithSelectedVoice = () => {
    if (selectedVoice) {
      Speech.speak('Speaking with a selected voice.', { voice: selectedVoice });
    }
  };

  return (
    <View>
      <Button title="Speak with Selected Voice" onPress={speakWithSelectedVoice} />
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-speech
```

## Usage

```jsx
import { View, StyleSheet, Button } from 'react-native';
import * as Speech from 'expo-speech';

export default function App() {
  const speak = () => {
    const thingToSay = '1';
    Speech.speak(thingToSay);
  };

  return (
    <View style={styles.container}>
      <Button title="Press to hear some words" onPress={speak} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ecf0f1',
    padding: 8,
  },
});
```

## API

```js
import * as Speech from 'expo-speech';
```

## API Reference

### Methods

#### getAvailableVoicesAsync

Returns list of all available voices.

```typescript
getAvailableVoicesAsync(): Promise<Voice[]>
```

**Returns:** List of `Voice` objects.

#### isSpeakingAsync

Determine whether the Text-to-speech utility is currently speaking. Will return `true` if speaker
is paused.

```typescript
isSpeakingAsync(): Promise<boolean>
```

**Returns:** Returns a Promise that fulfils with a boolean, `true` if speaking, `false` if not.

#### pause
Pauses current speech. This method is not available on Android.

```typescript
pause(): Promise<void>
```

#### resume

Resumes speaking previously paused speech or does nothing if there's none. This method is not
available on Android.

```typescript
resume(): Promise<void>
```

#### speak

Speak out loud the text given options. Calling this when another text is being spoken adds
an utterance to queue.

```typescript
speak(text: string, options: SpeechOptions): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `text` | `string` | The text to be spoken. Cannot be longer than [`Speech.maxSpeechInputLength`](#speechmaxspeechinputlength). |
| `options` | `SpeechOptions` | A `SpeechOptions` object. |

#### stop

Interrupts current speech and deletes all in queue.

```typescript
stop(): Promise<void>
```

### Types

#### SpeechEventCallback

**Type:** `(this: SpeechSynthesisUtterance, ev: SpeechSynthesisEvent) => any`

#### SpeechOptions

| Property | Type | Description |
| --- | --- | --- |
| `_voiceIndex` | `number` | - |
| `language` | `string` | The code of a language that should be used to read the `text`, refer to IETF BCP 47 to see valid codes. |
| `onBoundary` | `NativeBoundaryEventCallback | SpeechEventCallback | null` | A callback that is invoked when the spoken utterance reaches a word. |
| `onDone` | `() => void | SpeechEventCallback` | A callback that is invoked when speaking finishes. |
| `onError` | `(error: Error) => void | SpeechEventCallback` | A callback that is invoked when an error occurred while speaking. |
| `onMark` | `SpeechEventCallback | null` | - |
| `onPause` | `SpeechEventCallback | null` | - |
| `onResume` | `SpeechEventCallback | null` | - |
| `onStart` | `() => void | SpeechEventCallback` | A callback that is invoked when speaking starts. |
| `onStopped` | `() => void | SpeechEventCallback` | A callback that is invoked when speaking is stopped by calling `Speech.stop()`. |
| `pitch` | `number` | Pitch of the voice to speak `text`. `1.0` is the normal pitch. |
| `rate` | `number` | Rate of the voice to speak `text`. `1.0` is the normal rate. |
| `useApplicationAudioSession` | `boolean` | If you set this value to `false`, the system creates a separate audio session to automatically manage speech, interruptions, and mixing and ducking the speech with other audio sources. |
| `voice` | `string` | Voice identifier. |
| `volume` | `number` | Volume of the voice to speak `text`. A number between `0.0` (muted) and `1.0` (max volume) |

#### Voice

Object describing the available voices on the device.

| Property | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | Voice unique identifier. |
| `language` | `string` | Voice language. |
| `name` | `string` | Voice name. |
| `quality` | `VoiceQuality` | Voice quality. |

#### WebVoice

**Type:** `unknown`

### Enums


#### VoiceQuality

Enum representing the voice quality.

| Value | Description |
| --- | --- |
| `Default` | - |
| `Enhanced` | - |
