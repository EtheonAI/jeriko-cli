---
name: navigation-bar
description: Configure Android navigation bar appearance.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# NavigationBar

A library that provides access to various interactions with the native navigation bar on Android.

**Platforms:** android

**Package:** `expo-navigation-bar`

`expo-navigation-bar` enables you to modify and observe the native navigation bar on Android devices. Due to some Android platform restrictions, parts of this API overlap with the `expo-status-bar` API.

Properties are named after style properties; visibility, position, backgroundColor, borderColor, and so on.

The APIs in this package have no impact when "Gesture Navigation" is enabled on the Android device. There is currently no native Android API to detect if "Gesture Navigation" is enabled or not.

## Quick Start

Here is a minimal example of how to use the `NavigationBar` API to configure the bottom bar on Android.

```jsx
import { useState, useEffect } from 'react';
import { View, Button, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export default function App() {
  const [barVisible, setBarVisible] = useState(true);

  const toggleNavigationBar = async () => {
    if (Platform.OS !== 'android') return;
    const newVisibility = barVisible ? 'hidden' : 'visible';
    await NavigationBar.setVisibilityAsync(newVisibility);
    setBarVisible(!barVisible);
  };

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setBackgroundColorAsync('#1f2937');
      NavigationBar.setButtonStyleAsync('light');
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Toggle Navigation Bar" onPress={toggleNavigationBar} />
    </View>
  );
}
```

## When to Use

Use the `expo-navigation-bar` module when you need to customize the appearance and behavior of the native Android navigation bar. This is useful for creating immersive user experiences or matching the navigation bar's style to your app's branding. It is not applicable for iOS or web platforms.

## Common Pitfalls

### 1. Attempting to Use on iOS or Web

**Problem**: Calling `expo-navigation-bar` methods on platforms other than Android will have no effect and may lead to unexpected behavior. The functions will return default values, but no native changes will occur.

**Solution**: Always wrap calls to this module in a `Platform.OS` check to ensure they only execute on Android.

```jsx
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

// Correct: Only run on Android
if (Platform.OS === 'android') {
  NavigationBar.setBackgroundColorAsync('#FFFFFF');
}
```

### 2. Ignoring Gesture Navigation

**Problem**: If the user has enabled gesture-based navigation on their Android device, the traditional navigation bar is not visible, and this API will have no effect. There is currently no reliable way to detect if gesture navigation is active.

**Solution**: Design your UI to be functional with or without the navigation bar. Avoid placing critical UI elements in the bottom area where they might be obscured by either the navigation bar or the gesture hint area.

## Common Patterns

### 1. Immersive Mode Toggle

This pattern allows the user to toggle an immersive mode where the navigation bar is hidden, providing an unobstructed view of the content. This is useful for media viewers or games.

```jsx
import { useState } from 'react';
import { View, Button, Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';

export default function ImmersiveMode() {
  const [isImmersive, setIsImmersive] = useState(false);

  const toggleImmersiveMode = async () => {
    if (Platform.OS !== 'android') return;

    try {
      if (isImmersive) {
        await NavigationBar.setVisibilityAsync('visible');
        await NavigationBar.setBehaviorAsync('inset-swipe');
      } else {
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
      }
      setIsImmersive(!isImmersive);
    } catch (error) {
      console.error('Failed to toggle immersive mode:', error);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Button title={isImmersive ? 'Exit Immersive Mode' : 'Enter Immersive Mode'} onPress={toggleImmersiveMode} />
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-navigation-bar
```

## Configuration in app config

You can configure `expo-navigation-bar` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-navigation-bar",
        {
          "backgroundColor": "#0f172a",
          "barStyle": "light",
          "borderColor": "#1f2937",
          "visibility": "visible",
          "behavior": "inset-swipe",
          "position": "relative"
        }
      ]
    ]
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) or you're using a native **android** project manually, then you need to add the following configuration to your native project:

- To apply `backgroundColor` to the navigation bar, add `navigationBarColor` to **android/app/src/main/res/values/colors.xml**:

  ```xml
  <resources>
    <!-- ... -->
    <color name="navigationBarColor">#0f172a</color>
  </resources>
  ```

  Then, apply `android:navigationBarColor` to **android/app/src/main/res/values/styles.xml**:

  ```xml
  <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
    <!-- ... -->
    <item name="android:navigationBarColor">@color/navigationBarColor</item>
  </style>
  ```

- To apply `borderColor`, `visibility`, `position`, and `behavior` to the navigation bar, add `expo_navigation_bar_border_color`, `expo_navigation_bar_visibility`, `expo_navigation_bar_position`, and `expo_navigation_bar_behavior` to **android/app/src/main/res/values/strings.xml**:

  ```xml
  <resources>
    <!-- ... -->
    <!-- For `expo_navigation_bar_border_color`, convert the color string to a 32-bit integer. -->
    <string name="expo_navigation_bar_border_color"
    translatable="false">-14735049</string>
    <string name="expo_navigation_bar_visibility" translatable="false">visible</string>
    <string name="expo_navigation_bar_position" translatable="false">relative</string>
    <string name="expo_navigation_bar_behavior" translatable="false">inset-swipe</string>
  </resources>
  ```

- To apply `legacyVisible` to the navigation bar, add `expo_navigation_bar_legacy_visible` to **android/app/src/main/res/values/strings.xml**:

  ```xml
  <resources>
    <!-- ... -->
    <string name="expo_navigation_bar_legacy_visible" translatable="false">immersive</string>
  </resources>
  ```

## API

```js

```

## API Reference

### Methods

#### addVisibilityListener

Observe changes to the system navigation bar.
Due to platform constraints, this callback will also be triggered when the status bar visibility changes.

```typescript
addVisibilityListener(listener: (event: NavigationBarVisibilityEvent) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: NavigationBarVisibilityEvent) => void` | - |

#### getBackgroundColorAsync

Gets the navigation bar's background color.

> This method is supported only when edge-to-edge is disabled.

```typescript
getBackgroundColorAsync(): Promise<string>
```

**Returns:** Current navigation bar color in hex format. Returns `#00000000` (transparent) on unsupported platforms (iOS, web).

#### getBehaviorAsync

Gets the behavior of the status and navigation bars when the user swipes or touches the screen.

> This method is supported only when edge-to-edge is disabled.

```typescript
getBehaviorAsync(): Promise<NavigationBarBehavior>
```

**Returns:** Navigation bar interaction behavior. Returns `inset-touch` on unsupported platforms (iOS, web).

#### getBorderColorAsync

Gets the navigation bar's top border color, also known as the "divider color".

> This method is supported only when edge-to-edge is disabled.

```typescript
getBorderColorAsync(): Promise<string>
```

**Returns:** Navigation bar top border color in hex format. Returns `#00000000` (transparent) on unsupported platforms (iOS, web).

#### getButtonStyleAsync

Gets the navigation bar's button color styles.

> This method is supported only when edge-to-edge is disabled.

```typescript
getButtonStyleAsync(): Promise<NavigationBarButtonStyle>
```

**Returns:** Navigation bar foreground element color settings. Returns `light` on unsupported platforms (iOS, web).

#### getVisibilityAsync

Get the navigation bar's visibility.

```typescript
getVisibilityAsync(): Promise<NavigationBarVisibility>
```

**Returns:** Navigation bar's current visibility status. Returns `hidden` on unsupported platforms (iOS, web).

#### setBackgroundColorAsync

Changes the navigation bar's background color.

> This method is supported only when edge-to-edge is disabled.

```typescript
setBackgroundColorAsync(color: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `color` | `string` | Any valid [CSS 3 (SVG) color](http://www.w3.org/TR/css3-color/#svg-color). |

#### setBehaviorAsync

Sets the behavior of the status bar and navigation bar when they are hidden and the user wants to reveal them.

For example, if the navigation bar is hidden (`setVisibilityAsync(false)`) and the behavior
is `'overlay-swipe'`, the user can swipe from the bottom of the screen to temporarily reveal the navigation bar.

- `'overlay-swipe'`: Temporarily reveals the System UI after a swipe gesture (bottom or top) without insetting your App's content.
- `'inset-swipe'`: Reveals the System UI after a swipe gesture (bottom or top) and insets your App's content (Safe Area). The System UI is visible until you explicitly hide it again.
- `'inset-touch'`: Reveals the System UI after a touch anywhere on the screen and insets your App's content (Safe Area). The System UI is visible until you explicitly hide it again.

> This method is supported only when edge-to-edge is disabled.

```typescript
setBehaviorAsync(behavior: NavigationBarBehavior): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `behavior` | `NavigationBarBehavior` | Dictates the interaction behavior of the navigation bar. |

#### setBorderColorAsync

Changes the navigation bar's border color.

> This method is supported only when edge-to-edge is disabled.

```typescript
setBorderColorAsync(color: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `color` | `string` | Any valid [CSS 3 (SVG) color](http://www.w3.org/TR/css3-color/#svg-color). |

#### setButtonStyleAsync

Changes the navigation bar's button colors between white (`light`) and a dark gray color (`dark`).

```typescript
setButtonStyleAsync(style: NavigationBarButtonStyle): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `style` | `NavigationBarButtonStyle` | Dictates the color of the foreground element color. |

#### setPositionAsync

Sets positioning method used for the navigation bar (and status bar).
Setting position `absolute` will float the navigation bar above the content,
whereas position `relative` will shrink the screen to inline the navigation bar.

When drawing behind the status and navigation bars, ensure the safe area insets are adjusted accordingly.

> This method is supported only when edge-to-edge is disabled.

```typescript
setPositionAsync(position: NavigationBarPosition): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `position` | `NavigationBarPosition` | Based on CSS position property. |

#### setStyle

Sets the style of the navigation bar.
> This will have an effect when the following conditions are met:
> - Edge-to-edge is enabled
> - The `enforceNavigationBarContrast` option of the `react-native-edge-to-edge` plugin is set to `false`.
> - The device is using the three-button navigation bar.

> Due to a bug in the Android 15 emulator this function may have no effect. Try a physical device or an emulator with a different version of Android.

**Platform:** android

```typescript
setStyle(style: NavigationBarStyle): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `style` | `NavigationBarStyle` | - |

#### setVisibilityAsync

Set the navigation bar's visibility.

**Platform:** android

```typescript
setVisibilityAsync(visibility: NavigationBarVisibility): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `visibility` | `NavigationBarVisibility` | Based on CSS visibility property. |

#### unstable_getPositionAsync

Whether the navigation and status bars float above the app (absolute) or sit inline with it (relative).
This value can be incorrect if `androidNavigationBar.visible` is used instead of the config plugin `position` property.

This method is unstable because the position can be set via another native module and get out of sync.
Alternatively, you can get the position by measuring the insets returned by `react-native-safe-area-context`.

> This method is supported only when edge-to-edge is disabled.

```typescript
unstable_getPositionAsync(): Promise<NavigationBarPosition>
```

**Returns:** Navigation bar positional rendering mode. Returns `relative` on unsupported platforms (iOS, web).

#### useVisibility

React hook that statefully updates with the visibility of the system navigation bar.

```typescript
useVisibility(): NavigationBarVisibility | null
```

**Returns:** Visibility of the navigation bar, `null` during async initialization.

### Types

#### NavigationBarBehavior

Interaction behavior for the system navigation bar.

**Type:** `'overlay-swipe' | 'inset-swipe' | 'inset-touch'`

#### NavigationBarButtonStyle

Appearance of the foreground elements in the navigation bar, i.e. the color of the menu, back, home button icons.

- `dark` makes buttons **darker** to adjust for a mostly light nav bar.
- `light` makes buttons **lighter** to adjust for a mostly dark nav bar.

**Type:** `'light' | 'dark'`

#### NavigationBarPosition

Navigation bar positional mode.

**Type:** `'relative' | 'absolute'`

#### NavigationBarStyle

Navigation bar style.

- `auto` will automatically adjust based on the current theme.
- `light` a light navigation bar with dark content.
- `dark` a dark navigation bar with light content.
- `inverted` the bar colors are inverted in relation to the current theme.

**Type:** `'auto' | 'inverted' | 'light' | 'dark'`

#### NavigationBarVisibility

Visibility of the navigation bar.

**Type:** `'visible' | 'hidden'`

#### NavigationBarVisibilityEvent

Current system UI visibility state. Due to platform constraints, this will return when the status bar visibility changes as well as the navigation bar.

| Property | Type | Description |
| --- | --- | --- |
| `rawVisibility` | `number` | Native Android system UI visibility state, returned from the native Android `setOnSystemUiVisibilityChangeListener` API. |
| `visibility` | `NavigationBarVisibility` | Current navigation bar visibility. |
