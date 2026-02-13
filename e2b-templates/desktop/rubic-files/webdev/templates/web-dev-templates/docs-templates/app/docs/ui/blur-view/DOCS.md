---
name: blur-view
description: Apply blur effects to views and backgrounds.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# BlurView

A React component that blurs everything underneath the view.

## Quick Start

Here is a minimal example of a `BlurView` over an image:

```jsx
import React from 'react';
import { View, Image, Text, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';

const imageUri = 'https://picsum.photos/seed/picsum/400/400';

export default function App() {
  return (
    <View style={styles.container}>
      <Image style={styles.image} source={{ uri: imageUri }} />
      {Platform.OS !== 'web' && (
        <BlurView intensity={80} tint="light" style={styles.blurContainer}>
          <Text style={styles.text}>Hello, I am blurred!</Text>
        </BlurView>
      )}
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
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  blurContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    overflow: 'hidden',
  },
  text: {
    fontSize: 24,
    fontWeight: '600',
  },
});
```

## When to Use

Use `BlurView` to create modern UI effects like frosted glass, blurred modals, and translucent navigation or tab bars. It's ideal for adding depth and focus to your interface by de-emphasizing content behind other views.

## Common Pitfalls

Here are some common mistakes to avoid when using `BlurView`:

1.  **Blur Not Appearing on Android**
    *   **Problem**: The blur effect works on iOS but appears as a semi-transparent view on Android.
    *   **Solution**: You must enable the experimental blur method on Android by setting the `experimentalBlurMethod` prop to `dimezisBlurView`. Be aware of potential performance implications.

    ```jsx
    <BlurView experimentalBlurMethod="dimezisBlurView" intensity={50} />
    ```

2.  **Rounded Corners Not Working**
    *   **Problem**: Applying `borderRadius` in the style does not clip the blur effect to the rounded corners.
    *   **Solution**: Add `overflow: 'hidden'` to the `BlurView`'s style. This ensures the blur is clipped to the container's bounds.

    ```jsx
    <BlurView style={{ borderRadius: 20, overflow: 'hidden' }} />
    ```

3.  **Blur Not Updating for Dynamic Content**
    *   **Problem**: The blur does not reflect content that loads or changes after the `BlurView` is already rendered, such as items in a `FlatList`.
    *   **Solution**: Ensure the `BlurView` is rendered *after* the dynamic content in the component tree. This allows the blur to capture the final rendered output.

    ```jsx
    <View>
      <FlatList data={myData} renderItem={...} />
      <BlurView style={StyleSheet.absoluteFill} />
    </View>
    ```

**Platforms:** android, ios, tvos, web

**Package:** `expo-blur`

A React component that blurs everything underneath the view. Common usage of this is for navigation bars, tab bars, and modals.

> **info** `BlurView` on Android is an experimental feature. To enable it use the [`experimentalBlurMethod`](#experimentalblurmethod) prop.

#### Known issues

The blur effect does not update when `BlurView` is rendered before dynamic content is rendered using, for example, `FlatList`. To fix this, make sure that `BlurView` is rendered after the dynamic content component. For example:

```jsx
<View>
  <FlatList />
  <BlurView />
</View>
```

## Installation

```bash
$ npx expo install expo-blur
```

## Usage

```jsx
import { Text, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";

export default function App() {
  const text = "Hello, my container is blurring contents underneath!";
  return (
    <View style={styles.container}>
      <View style={styles.background}>
        {[...Array(20).keys()].map((i) => (
          <View
            key={`box-${i}`}
            style={[styles.box, i % 2 === 1 ? styles.boxOdd : styles.boxEven]}
          />
        ))}
      </View>
      <BlurView intensity={100} style={styles.blurContainer}>
        <Text style={styles.text}>{text}</Text>
      </BlurView>
      <BlurView intensity={80} tint="light" style={styles.blurContainer}>
        <Text style={styles.text}>{text}</Text>
      </BlurView>
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
        <Text style={[styles.text, { color: "#fff" }]}>{text}</Text>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  blurContainer: {
    flex: 1,
    padding: 20,
    margin: 16,
    textAlign: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 20,
  },
  background: {
    flex: 1,
    flexWrap: "wrap",
    ...StyleSheet.absoluteFill,
  },
  box: {
    width: "25%",
    height: "20%",
  },
  boxEven: {
    backgroundColor: "orangered",
  },
  boxOdd: {
    backgroundColor: "gold",
  },
  text: {
    fontSize: 24,
    fontWeight: "600",
  },
});
```

## Basic usage (background image)
The most common real UI setup is to blur over an image (or any content) rendered _behind_ the `BlurView` in the same view hierarchy:

```tsx
import { StyleSheet, Text, View, ImageBackground } from "react-native";
import { BlurView } from "expo-blur";

export default function App() {
  return (
    <View style={styles.container}>
      <ImageBackground
        source={{ uri: "https://picsum.photos/800/600" }}
        style={styles.background}
        resizeMode="cover"
      >
        <BlurView intensity={80} style={styles.blurContainer}>
          <Text style={styles.text}>Hello, I blur the content behind me!</Text>
        </BlurView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  background: { flex: 1, justifyContent: "center", alignItems: "center" },
  blurContainer: { padding: 20, borderRadius: 10, overflow: "hidden" },
  text: { fontSize: 16, fontWeight: "600", color: "#fff" },
});
```

## API

```js
import { BlurView } from "expo-blur";
```

## Using `borderRadius` with `BlurView`

When using `BlurView` on Android and iOS, the `borderRadius` property is not applied when provided explicitly. To fix this, you can use the `overflow: 'hidden'` style since `BlurView` inherits props from `<View>`. See [Usage](#usage) for an example.

## Key props (practical notes)

### `intensity`

Controls blur strength.

- **Type**: `number`
- **Default**: `50`
- **Range**: `0-100` (0 = no blur, 100 = maximum blur)

```tsx
<BlurView intensity={100} />
```

### `tint`

Controls the blur tint.

- **Type**: `BlurTint` (see type in this doc)
- **Default**: `'default'`
- **Common values**: `'light'`, `'dark'`, `'default'`
- **Note**: iOS has additional “material” tints (for native iOS look); they may not translate 1:1 to Android/Web.

```tsx
<BlurView tint="dark" />
```

### `style`

Standard React Native `View` style.

- **Important**: if you use `borderRadius`, also set `overflow: 'hidden'` to clip correctly.

```tsx
<BlurView style={{ padding: 20, borderRadius: 10, overflow: "hidden" }} />
```

### `experimentalBlurMethod` (Android only)

Enables an experimental native blur implementation on Android.

```tsx
<BlurView experimentalBlurMethod="dimezisBlurView" />
```

## Common patterns
### Blurred navigation/header bar

```tsx
import { StyleSheet, Text } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function BlurredHeader() {
  const insets = useSafeAreaInsets();

  return (
    <BlurView
      intensity={90}
      tint="light"
      style={[styles.header, { paddingTop: insets.top }]}
    >
      <Text style={styles.headerTitle}>My App</Text>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
});
```

### Blurred card over an image

```tsx
import { StyleSheet, Text, ImageBackground } from "react-native";
import { BlurView } from "expo-blur";

export function BlurredCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <ImageBackground
      source={{ uri: "https://picsum.photos/400/300" }}
      style={styles.cardBackground}
      resizeMode="cover"
    >
      <BlurView intensity={70} tint="dark" style={styles.cardBlur}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </BlurView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  cardBackground: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    overflow: "hidden",
  },
  cardBlur: {
    flex: 1,
    padding: 20,
    justifyContent: "flex-end",
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: "#fff",
    opacity: 0.9,
  },
});
```

### Blurred modal overlay
```tsx
import { StyleSheet, Modal, Pressable } from "react-native";
import { BlurView } from "expo-blur";

export function BlurredModal({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <BlurView intensity={90} tint="dark" style={styles.blurOverlay}>
          <Pressable
            style={styles.modalContent}
            onPress={(e) => e.stopPropagation()}
          >
            {children}
          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1 },
  blurOverlay: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
});
```

### Full-bleed blur with absolute positioning

```tsx
import { StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

<BlurView intensity={80} style={StyleSheet.absoluteFillObject} />;
```

### Image loading placeholder overlay

```tsx
import { useState } from "react";
import { StyleSheet, Image, View, ActivityIndicator } from "react-native";
import { BlurView } from "expo-blur";

export function BlurredImageLoader({ uri }: { uri: string }) {
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <BlurView intensity={50} tint="light" style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </BlurView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: { width: "100%", height: "100%" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
});
```

## Best practices
1. **Always clip rounded corners**: use `overflow: 'hidden'` when using `borderRadius`.
2. **Layer correctly**: `BlurView` only blurs content rendered behind it in the same hierarchy.
3. **Use sparingly**: many `BlurView`s (or very high `intensity`) can hurt performance, especially on Android.
4. **Pick readable contrast**: ensure text on top has enough contrast for accessibility.
5. **Test per-platform**: blur appearance differs across iOS/Android/Web; validate on real devices.

## Platform-specific behavior (quick notes)

- **iOS**: best fidelity/perf (native blur); “material” `tint` values give the most iOS-native look.
- **Android**: blur is experimental; enable with `experimentalBlurMethod` when you truly need real blur.
- **Web**: uses `backdrop-filter` when available; may fall back to a non-blurred translucent overlay.

## Performance considerations

- Avoid nesting multiple `BlurView`s.
- Prefer blurring larger static UI chrome (headers/footers/overlays) rather than many small list items.
- If performance is poor, reduce `intensity` and/or the number of active blur surfaces.

## Troubleshooting

### Blur not showing

Make sure there is actual content behind the `BlurView` and that it’s rendered _before_ the `BlurView` in the hierarchy:

```tsx
import { View, ImageBackground } from "react-native";
import { BlurView } from "expo-.blur";

<View style={{ flex: 1 }}>
  <ImageBackground
    source={{ uri: "https://picsum.photos/800/600" }}
    style={{ flex: 1 }}
  >
    <BlurView intensity={80} style={{ flex: 1 }} />
  </ImageBackground>
</View>;
```

### Rounded corners not working

Add `overflow: 'hidden'` alongside `borderRadius`:

```tsx
<BlurView style={{ borderRadius: 16, overflow: "hidden" }} />
```

## API Reference

### Classes

#### BlurView

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `blurViewRef` | `RefObject<null \| ComponentType<any>>` | - |

**Methods:**

- `render(): Element`

### Types

#### BlurTint

**Type:** `'light' | 'dark' | 'default' | 'extraLight' | 'regular' | 'prominent' | 'systemUltraThinMaterial' | 'systemThinMaterial' | 'systemMaterial' | 'systemThickMaterial' | 'systemChromeMaterial' | 'systemUltraThinMaterialLight' | 'systemThinMaterialLight' | 'systemMaterialLight' | 'systemThickMaterialLight' | 'systemChromeMaterialLight' | 'systemUltraThinMaterialDark' | 'systemThinMaterialDark' | 'systemMaterialDark' | 'systemThickMaterialDark' | 'systemChromeMaterialDark'`

#### BlurViewProps

**Type:** `unknown`

#### ExperimentalBlurMethod

Blur method to use on Android.

- `'none'` - Falls back to a semi-transparent view instead of rendering a blur effect.

- `'dimezisBlurView'` - Uses a native blur view implementation based on [BlurView](https://github.com/Dimezis/BlurView) library. This method may lead to decreased performance.

**Type:** `'none' | 'dimezisBlurView'`
