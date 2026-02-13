---
name: haptics
description: Trigger haptic feedback and vibrations.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Haptics

A library that provides access to the system's vibration effects on Android, the haptics engine on iOS, and the Web Vibration API on web.

**Platforms:** android, ios, web

**Package:** `expo-haptics`

## Quick Start

```tsx
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// IMPORTANT: Always wrap haptics with platform check for web compatibility
const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

// Use in button press
<Button onPress={() => { triggerHaptic(); doAction(); }} />
```

## When to Use Each Feedback Type

| User Action | Recommended Feedback | Code |
|-------------|---------------------|------|
| Button tap | Light impact | `impactAsync(ImpactFeedbackStyle.Light)` |
| Toggle switch | Medium impact | `impactAsync(ImpactFeedbackStyle.Medium)` |
| Delete/destructive action | Medium impact | `impactAsync(ImpactFeedbackStyle.Medium)` |
| Drag start | Light impact | `impactAsync(ImpactFeedbackStyle.Light)` |
| Success completion | Success notification | `notificationAsync(NotificationFeedbackType.Success)` |
| Error/failure | Error notification | `notificationAsync(NotificationFeedbackType.Error)` |
| Warning | Warning notification | `notificationAsync(NotificationFeedbackType.Warning)` |
| Selection change | Selection | `selectionAsync()` |
| Picker scroll | Selection | `selectionAsync()` |

## Common Pitfalls

### 1. Web Platform Crashes

**Problem:** Calling haptics directly on web can cause errors or silent failures.

**Solution:** Always wrap haptic calls with a platform check:

```tsx
// ❌ Wrong - may fail on web
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

// ✅ Correct - safe for all platforms
if (Platform.OS !== 'web') {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
```

### 2. Overusing Haptics

**Problem:** Too much haptic feedback becomes annoying and loses meaning.

**Solution:** Use haptics sparingly for meaningful interactions:
- Primary button taps: Yes
- Every list item tap: No (use only for important actions)
- Form input changes: No
- Success/error states: Yes

### 3. Haptics in Gesture Handlers

**Problem:** Haptics called from gesture handler worklets may not work correctly.

**Solution:** Use `runOnJS` to call haptics from the JS thread:

```tsx
import { runOnJS } from 'react-native-reanimated';

const triggerHaptic = () => {
  if (Platform.OS !== 'web') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

const gesture = Gesture.Pan()
  .onEnd(() => {
    runOnJS(triggerHaptic)();
  });
```

### 4. Haptics Not Working on iOS

**Problem:** Haptics silently fail on iOS in certain conditions.

**Causes:**
- Low Power Mode is enabled
- User disabled Taptic Engine in settings
- Camera is active
- Dictation is active

**Solution:** Don't rely on haptics as the only feedback. Always pair with visual feedback.

## Installation

```bash
$ npx expo install expo-haptics
```

## Configuration

On Android, this library requires permission to control vibration on the device. The `VIBRATE` permission is added automatically.

## Common Patterns

### Reusable Haptic Helper

Create a utility function for consistent haptic usage across your app:

```tsx
// lib/haptics.ts
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export const haptic = {
  light: () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  },
  medium: () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  },
  heavy: () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  },
  success: () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  },
  error: () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  },
  selection: () => {
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  },
};

// Usage
import { haptic } from '@/lib/haptics';
haptic.light();
```

### Haptic Button Component

```tsx
import { Pressable, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

interface HapticButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  hapticStyle?: Haptics.ImpactFeedbackStyle;
}

export function HapticButton({ 
  onPress, 
  children, 
  hapticStyle = Haptics.ImpactFeedbackStyle.Light 
}: HapticButtonProps) {
  const handlePress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(hapticStyle);
    }
    onPress();
  };

  return (
    <Pressable onPress={handlePress}>
      {children}
    </Pressable>
  );
}
```

## Usage Example

```jsx
import { StyleSheet, View, Text, Button } from 'react-native';
import * as Haptics from 'expo-haptics';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Haptics.selectionAsync</Text>
      <View style={styles.buttonContainer}>
        <Button title="Selection" onPress={() => Haptics.selectionAsync()} />
      </View>
      <Text style={styles.text}>Haptics.notificationAsync</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Success"
          onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)}
        />
        <Button
          title="Error"
          onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)}
        />
        <Button
          title="Warning"
          onPress={() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)}
        />
      </View>
      <Text style={styles.text}>Haptics.impactAsync</Text>
      <View style={styles.buttonContainer}>
        <Button
          title="Light"
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        />
        <Button
          title="Medium"
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
        />
        <Button
          title="Heavy"
          onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: 10,
    marginBottom: 30,
    justifyContent: 'space-between',
  },
});
```

## API

```js
import * as Haptics from 'expo-haptics';
```

## API Reference

### Methods

#### impactAsync

```typescript
impactAsync(style: ImpactFeedbackStyle): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `style` | `ImpactFeedbackStyle` | A collision indicator that on Android is simulated using [`Vibrator`](https://developer.android.com/reference/android/os/Vibrator) and on iOS, it is directly mapped to [`UIImpactFeedbackStyle`](https://developer.apple.com/documentation/uikit/uiimpactfeedbackgenerator/feedbackstyle). You can use one of `Haptics.ImpactFeedbackStyle.{Light, Medium, Heavy, Rigid, Soft}`. |

**Returns:** A `Promise` which fulfills once native size haptics functionality is triggered.

#### notificationAsync

The kind of notification response used in the feedback.

```typescript
notificationAsync(type: NotificationFeedbackType): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `type` | `NotificationFeedbackType` | A notification feedback type that on Android is simulated using [`Vibrator`](https://developer.android.com/reference/android/os/Vibrator) and iOS is directly mapped to [`UINotificationFeedbackType`](https://developer.apple.com/documentation/uikit/uinotificationfeedbacktype). You can use one of `Haptics.NotificationFeedbackType.{Success, Warning, Error}`. |

**Returns:** A `Promise` which fulfills once native size haptics functionality is triggered.

#### performAndroidHapticsAsync

Use the device haptics engine to provide physical feedback to the user.

**Platform:** android

```typescript
performAndroidHapticsAsync(type: AndroidHaptics): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `type` | `AndroidHaptics` | - |

#### selectionAsync

Used to let a user know when a selection change has been registered.

```typescript
selectionAsync(): Promise<void>
```

**Returns:** A `Promise` which fulfills once native size haptics functionality is triggered.

### Enums

#### AndroidHaptics

| Value | Description |
| --- | --- |
| `Clock_Tick` | The user has pressed either an hour or minute tick of a Clock. |
| `Confirm` | A haptic effect to signal the confirmation or successful completion of a user interaction. |
| `Context_Click` | The user has performed a context click on an object. |
| `Drag_Start` | The user has started a drag-and-drop gesture. The drag target has just been "picked up". |
| `Gesture_End` | The user has finished a gesture (for example, on the soft keyboard). |
| `Gesture_Start` | The user has started a gesture (for example, on the soft keyboard). |
| `Keyboard_Press` | The user has pressed a virtual or software keyboard key. |
| `Keyboard_Release` | The user has released a virtual keyboard key. |
| `Keyboard_Tap` | The user has pressed a soft keyboard key. |
| `Long_Press` | The user has performed a long press on an object that results in an action being performed. |
| `No_Haptics` | No haptic feedback should be performed. |
| `Reject` | A haptic effect to signal the rejection or failure of a user interaction. |
| `Segment_Frequent_Tick` | The user is switching between a series of many potential choices. |
| `Segment_Tick` | The user is switching between a series of potential choices. |
| `Text_Handle_Move` | The user has performed a selection/insertion handle move on text field. |
| `Toggle_Off` | The user has toggled a switch or button into the off position. |
| `Toggle_On` | The user has toggled a switch or button into the on position. |
| `Virtual_Key` | The user has pressed on a virtual on-screen key. |
| `Virtual_Key_Release` | The user has released a virtual key. |

#### ImpactFeedbackStyle

The mass of the objects in the collision simulated by a `UIImpactFeedbackGenerator` object.

| Value | Description |
| --- | --- |
| `Heavy` | A collision between large, heavy user interface elements. |
| `Light` | A collision between small, light user interface elements. |
| `Medium` | A collision between moderately sized user interface elements. |
| `Rigid` | A collision between user interface elements that are rigid, exhibiting a small amount of compression or elasticity. |
| `Soft` | A collision between user interface elements that are soft, exhibiting a large amount of compression or elasticity. |

#### NotificationFeedbackType

The type of notification feedback generated by a `UINotificationFeedbackGenerator` object.

| Value | Description |
| --- | --- |
| `Error` | A notification feedback type indicating that a task has failed. |
| `Success` | A notification feedback type indicating that a task has completed successfully. |
| `Warning` | A notification feedback type indicating that a task has produced a warning. |
