---
name: splash-screen
description: Control splash screen visibility and animations.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# SplashScreen

A library that provides access to controlling the visibility behavior of native splash screen.

**Platforms:** android, ios, tvos

**Package:** `expo-splash-screen`

The `SplashScreen` module from the `expo-splash-screen` library provides control over the native splash screen behavior. By default, the splash screen will automatically hide when your app is ready, but you can also manually control its visibility for advanced use cases.

> From **SDK 52**, due to changes supporting the latest Android splash screen API, Expo Go and development builds cannot fully replicate the splash screen experience your users will see in your [standalone app](/more/glossary-of-terms/#standalone-app). Expo Go will show your app icon instead of the splash screen, and the splash screen on development builds will not reflect all properties set in the config plugin. **It is highly recommended that you test your splash screen on a release build to ensure it looks as expected.**

Also, see the guide on [creating a splash screen image](/develop/user-interface/splash-screen-and-app-icon/#splash-screen), or [quickly generate an icon and splash screen using your browser](https://buildicon.netlify.app/).

## Quick Start

```tsx
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        // Artificially delay for two seconds to simulate a slow loading
        // experience. Please remove this if you copy and paste the code!
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.warn(e);
      } finally {
        // Tell the application to render
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>SplashScreen Demo! 👋</Text>
    </View>
  );
}
```

## When to Use

Use the `SplashScreen` module when you need to keep the splash screen visible while your app is loading resources, such as fonts, assets, or data from an API. This prevents the user from seeing a blank or partially loaded screen.

## Common Pitfalls

### 1. Calling `preventAutoHideAsync` too late

- **Problem**: If `preventAutoHideAsync` is called inside a React component, it may be called after the splash screen has already been hidden, causing a flicker.
- **Solution**: Call `preventAutoHideAsync()` in the global scope of your app's entry file (e.g., `App.js` or `app/_layout.tsx`) before the root component is mounted.

```tsx
// App.js or app/_layout.tsx
import * as SplashScreen from 'expo-splash-screen';

// Call this before your app component is rendered
SplashScreen.preventAutoHideAsync();

export default function App() {
  // ...
}
```

### 2. Forgetting to hide the splash screen

- **Problem**: If you call `preventAutoHideAsync`, you must also call `hideAsync` at some point. Forgetting to do so will result in the splash screen being visible forever.
- **Solution**: Ensure that `hideAsync` is called when your app is ready to be displayed. A `useEffect` hook is a good place to do this.

```tsx
useEffect(() => {
  if (appIsReady) {
    SplashScreen.hideAsync();
  }
}, [appIsReady]);
```

## Common Patterns

### Loading Assets Before Hiding the Splash Screen

A common pattern is to load all necessary assets (fonts, images, etc.) before hiding the splash screen. This can be done using a custom hook or a simple function.

```tsx
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';

SplashScreen.preventAutoHideAsync();

export function useLoadedAssets() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [fontsLoaded] = useFonts({
    'space-mono': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      setAppIsReady(true);
    }
  }, [fontsLoaded]);

  return appIsReady;
}

// In your app's root component:
// const appIsReady = useLoadedAssets();
// useEffect(() => {
//   if (appIsReady) {
//     SplashScreen.hideAsync();
//   }
// }, [appIsReady]);
```

## Installation

```bash
$ npx expo install expo-splash-screen
```

## Usage

For most apps, you don't need to do anything special with the splash screen. It will automatically hide when your app is ready. You can optionally configure animation options:

**Example:** app/_layout.tsx
```tsx

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function RootLayout() {
  return null;
}
```

**Example:** App.tsx
```tsx

// Set the animation options. This is optional.
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});

export default function App() {
  return (
    SplashScreen Demo! 👋
  );
}
```

### Delay hiding the splash screen

In some cases, it may be necessary to delay hiding the splash screen until certain resources are loaded. For example, if you need to load API data before displaying the app content, you can use `preventAutoHideAsync()` to manually control when the splash screen hides. The goal should be to hide the splash screen as soon as possible.

**Example:** app/_layout.tsx
```tsx

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function doAsyncStuff() {
      try {
        // do something async here
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }

    doAsyncStuff();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hide();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return null;
}
```

**Example:** App.tsx
```tsx

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function doAsyncStuff() {
      try {
        // do something async here
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    }

    doAsyncStuff();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return (
    SplashScreen Demo! 👋
  );
}
```

## Configuration

You can configure `expo-splash-screen` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Using the config plugin, as shown below, is the recommended method for configuring the splash screen.** The other methods are now considered legacy and will be removed in the future.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-splash-screen",
        {
          "backgroundColor": "#232323",
          "image": "./assets/splash-icon.png",
          "dark": {
            "image": "./assets/splash-icon-dark.png",
            "backgroundColor": "#000000"
          },
          "imageWidth": 200
        }
      ]
    ],
  }
}
```

You can also configure `expo-splash-screen`, using the following [app config](/workflow/configuration/) properties but the config plugin should be preferred.

- [`splash`](../config/app/#splash)
- [`android.splash`](../config/app/#splash-2)
- [`ios.splash`](../config/app/#splash-1)

See how to configure the native projects in the [installation instructions in the `expo-splash-screen` repository](https://github.com/expo/expo/tree/main/packages/expo-splash-screen#-installation-in-bare-react-native-projects).

### Animating the splash screen

`SplashScreen` provides an out-of-the-box fade animation. It can be configured using the `setOptions` method.

```tsx
SplashScreen.setOptions({
  duration: 1000,
  fade: true,
});
```

If you prefer to use custom animation, see the [`with-splash-screen`](https://github.com/expo/examples/tree/master/with-splash-screen) example on how to apply any arbitrary animations to your splash screen. You can initialize a new project from this example by running `npx create-expo-app --example with-splash-screen`.

## API

```tsx

```

## API Reference

### Methods

#### hide

Hides the native splash screen immediately. Be careful to ensure that your app has content ready
to display when you hide the splash screen, or you may see a blank screen briefly. See the
["Usage"](#usage) section for an example.

```typescript
hide(): void
```

#### hideAsync

Hides the native splash screen immediately. This method is provided for backwards compatability. See the
["Usage"](#usage) section for an example.

```typescript
hideAsync(): Promise<void>
```

#### preventAutoHideAsync

Makes the native splash screen (configured in `app.json`) remain visible until `hideAsync` is called.

> **Important note**: It is recommended to call this in global scope without awaiting, rather than
> inside React components or hooks, because otherwise this might be called too late,
> when the splash screen is already hidden.

```typescript
preventAutoHideAsync(): Promise<boolean>
```

#### setOptions

Configures the splashscreens default animation behavior.

```typescript
setOptions(options: SplashScreenOptions): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `SplashScreenOptions` | - |

### Types

#### SplashScreenOptions

| Property | Type | Description |
| --- | --- | --- |
| `duration` | `number` | The duration of the fade out animation in milliseconds. |
| `fade` | `boolean` | Whether to hide the splash screen with a fade out animation. |
