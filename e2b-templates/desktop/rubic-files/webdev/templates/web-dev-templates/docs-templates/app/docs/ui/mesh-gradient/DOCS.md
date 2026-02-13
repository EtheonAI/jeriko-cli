---
name: mesh-gradient
description: Render mesh gradient backgrounds with multiple colors.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# MeshGradient

A module that exposes MeshGradient view from SwiftUI to React Native.

**Platforms:** ios, tvos

**Package:** `expo-mesh-gradient`

## Installation

```bash
$ npx expo install expo-mesh-gradient
```

## API

```tsx
import { MeshGradientView } from 'expo-mesh-gradient';

function App() {
  return (
    <MeshGradientView
      style={{ flex: 1 }}
      columns={3}
      rows={3}
      colors={['red', 'purple', 'indigo', 'orange', 'white', 'blue', 'yellow', 'green', 'cyan']}
      points={[
        [0.0, 0.0],
        [0.5, 0.0],
        [1.0, 0.0],
        [0.0, 0.5],
        [0.5, 0.5],
        [1.0, 0.5],
        [0.0, 1.0],
        [0.5, 1.0],
        [1.0, 1.0],
      ]}
    />
  );
}
```

## API Reference

### Methods

#### MeshGradientView

```typescript
MeshGradientView(props: MeshGradientViewProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `props` | `MeshGradientViewProps` | - |

### Interfaces

#### MeshGradientViewProps

| Property | Type | Description |
| --- | --- | --- |
| `colors` | `ColorValue[]` | An array of colors. Must contain `columns * rows` elements. |
| `columns` | `number` | Width of the mesh, i.e. the number of vertices per row. |
| `ignoresSafeArea` | `boolean` | Whether to ignore safe areas when positioning the view. |
| `mask` | `boolean` | Masks the gradient using the alpha channel of the given children views. > **Note**: When this option is enabled, all user interactions (gestures) on children views are ignored. |
| `points` | `number[][]` | An array of two-dimensional points on the mesh. Must contain `columns * rows` elements. |
| `resolution` | `{ x: number; y: number }` | Specifies how many points to sample on the path between points. |
| `rows` | `number` | Height of the mesh, i.e. the number of vertices per column. |
| `smoothsColors` | `boolean` | Whether cubic (smooth) interpolation should be used for the colors in the mesh rather than only for the shape of the mesh. |
