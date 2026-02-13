---
name: linear-gradient
description: Render linear gradient backgrounds.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# LinearGradient

A universal React component that renders a gradient view.

**Platforms:** android, ios, tvos, web

**Package:** `expo-linear-gradient`

`expo-linear-gradient` provides a native React view that transitions between multiple colors in a linear direction.

## Installation

```bash
$ npx expo install expo-linear-gradient
```

## Usage

```tsx
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function App() {
  return (
    <View style={styles.container}>
      <LinearGradient
        // Background Linear Gradient
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={styles.background}
      />
      <LinearGradient
        // Button Linear Gradient
        colors={['#4c669f', '#3b5998', '#192f6a']}
        style={styles.button}>
        <Text style={styles.text}>Sign in with Facebook</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'orange',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 300,
  },
  button: {
    padding: 15,
    alignItems: 'center',
    borderRadius: 5,
  },
  text: {
    backgroundColor: 'transparent',
    fontSize: 15,
    color: '#fff',
  },
});
```

## API

```js
import { LinearGradient } from 'expo-linear-gradient';
```

## API Reference

### Classes

#### LinearGradient

Renders a native view that transitions between multiple colors in a linear direction.

**Methods:**

- `render(): Element`

### Types

#### LinearGradientPoint

An object `{ x: number; y: number }` or array `[x, y]` that represents the point
at which the gradient starts or ends, as a fraction of the overall size of the gradient ranging
from `0` to `1`, inclusive.

**Type:** `{ x: number; y: number } | NativeLinearGradientPoint`

#### LinearGradientProps

**Type:** `unknown`

#### NativeLinearGradientPoint

**Type:** `[x, y]`
