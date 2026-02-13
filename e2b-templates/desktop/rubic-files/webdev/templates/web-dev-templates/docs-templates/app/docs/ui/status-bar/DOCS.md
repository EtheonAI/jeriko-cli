---
name: status-bar
description: Configure status bar style, color, and visibility.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# StatusBar

A library that provides the same interface as the React Native StatusBar API, but with slightly different defaults to work great in Expo environments.

**Platforms:** android, ios, tvos, web (web support is limited; most APIs are no-ops)

**Package:** `expo-status-bar`

`expo-status-bar` gives you a component and imperative interface to control the app status bar to change its text color, background color, hide it, make it translucent or opaque, and apply animations to any of these changes. Exactly what you are able to do with the `StatusBar` component depends on the platform you're using.

> **tvOS and web support**
>
> For **tvOS**, the `expo-status-bar` code will compile and run, but no status bar will show.
>
> For **web**, there is no API available to control the operating system's status bar, so `expo-status-bar` will do nothing and won't throw an error.

## Quick Start

Here's a minimal example to get you started with `expo-status-bar`. This will render a view with a dark background and light-colored status bar text.

```jsx
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Open up App.js to start working on your app!</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
  },
});
```

## When to Use

Use `expo-status-bar` whenever you need to control the appearance of the device's status bar. This is common in apps that use dark mode, have full-screen images, or need to dynamically change the status bar style based on the current screen or content.

## Common Pitfalls

### 1. StatusBar component not working on Android

**Problem**: The `StatusBar` component may not have any effect on Android devices if the `translucent` property is not set correctly. By default, the status bar is not translucent on Android, which can prevent background colors from being visible.

**Solution**: Explicitly set the `translucent` prop to `true` and provide a `backgroundColor` with alpha transparency. This ensures the app content is drawn underneath the status bar.

```jsx
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" backgroundColor="rgba(0,0,0,0.2)" translucent />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
```

### 2. Imperative methods conflicting with the component

**Problem**: Mixing imperative calls (e.g., `setBarStyle`) with the `<StatusBar>` component can lead to unexpected behavior, as the component's props will always take precedence.

**Solution**: Stick to one approach. If you need dynamic control, use the component and manage its props with state. Avoid mixing the two.

```jsx
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { View, Button } from 'react-native';

export default function App() {
  const [barStyle, setBarStyle] = useState('dark');

  return (
    <View>
      <StatusBar style={barStyle} />
      <Button title="Toggle Style" onPress={() => setBarStyle(barStyle === 'dark' ? 'light' : 'dark')} />
    </View>
  );
}
```

## Common Patterns

### 1. Per-Screen StatusBar Configuration

In a navigation-based app, you often need different status bar styles for different screens. The recommended way to handle this is to include a `<StatusBar>` component in each screen component.

```jsx
import { StatusBar } from 'expo-status-bar';
import { View, Text } from 'react-native';

function HomeScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar style="dark" />
      <Text>Home Screen</Text>
    </View>
  );
}

function ProfileScreen() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#333' }}>
      <StatusBar style="light" />
      <Text style={{ color: 'white' }}>Profile Screen</Text>
    </View>
  );
}
```

## Installation

```bash
$ npx expo install expo-status-bar
```

## Usage

**Example:** collapseHeight=310
```jsx

export default function App() {
  return (
    Notice that the status bar has light text!
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
  },
});
```

## API

```js

```

## API Reference

### Methods

#### setStatusBarBackgroundColor

Set the background color of the status bar.

**Platform:** android

```typescript
setStatusBarBackgroundColor(backgroundColor: ColorValue, animated: boolean): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `backgroundColor` | `ColorValue` | The background color of the status bar. |
| `animated` | `boolean` | `true` to animate the background color change, `false` to change immediately. |

#### setStatusBarHidden

Toggle visibility of the status bar.

```typescript
setStatusBarHidden(hidden: boolean, animation: StatusBarAnimation): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `hidden` | `boolean` | If the status bar should be hidden. |
| `animation` | `StatusBarAnimation` | Animation to use when toggling hidden, defaults to `'none'`. |

#### setStatusBarNetworkActivityIndicatorVisible

Toggle visibility of the network activity indicator.

**Platform:** ios

```typescript
setStatusBarNetworkActivityIndicatorVisible(visible: boolean): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `visible` | `boolean` | If the network activity indicator should be visible. |

#### setStatusBarStyle

Set the bar style of the status bar.

```typescript
setStatusBarStyle(style: StatusBarStyle, animated: boolean): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `style` | `StatusBarStyle` | The color of the status bar text. |
| `animated` | `boolean` | If the transition should be animated. |

#### setStatusBarTranslucent

Set the translucency of the status bar.

**Platform:** android

```typescript
setStatusBarTranslucent(translucent: boolean): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `translucent` | `boolean` | Whether the app can draw under the status bar. When `true`, content will be rendered under the status bar. This is always `true` on iOS and cannot be changed. |

#### StatusBar

A component that allows you to configure your status bar without directly calling imperative
methods like `setBarStyle`.

You will likely have multiple `StatusBar` components mounted in the same app at the same time.
For example, if you have multiple screens in your app, you may end up using one per screen.
The props of each `StatusBar` component will be merged in the order that they were mounted.
This component is built on top of the [StatusBar](https://reactnative.dev/docs/statusbar)
component exported from React Native, and it provides defaults that work better for Expo users.

```typescript
StatusBar(__namedParameters: StatusBarProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `StatusBarProps` | - |

### Types


#### StatusBarAnimation

**Type:** `'none' | 'fade' | 'slide'`

#### StatusBarProps

| Property | Type | Description |
| --- | --- | --- |
| `animated` | `boolean` | If the transition between status bar property changes should be animated. Supported for `backgroundColor`, `barStyle` and `hidden`. |
| `backgroundColor` | `string` | The background color of the status bar. |
| `hidden` | `boolean` | If the status bar is hidden. |
| `hideTransitionAnimation` | `StatusBarAnimation` | The transition effect when showing and hiding the status bar using the hidden prop. |
| `networkActivityIndicatorVisible` | `boolean` | If the network activity indicator should be visible. |
| `style` | `StatusBarStyle` | Sets the color of the status bar text. Default value is `auto` which picks the appropriate value according to the active color scheme, eg: if your app is dark mode, the style will be `light`. |
| `translucent` | `boolean` | If the status bar is translucent. When translucent is set to `true`, the app will draw under the status bar. This is the default behaviour in projects created with Expo tools because it is consistent with iOS. |

#### StatusBarStyle

**Type:** `'auto' | 'inverted' | 'light' | 'dark'`
