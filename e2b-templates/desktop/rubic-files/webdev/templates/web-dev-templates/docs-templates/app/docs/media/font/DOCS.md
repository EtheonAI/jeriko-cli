---
name: font
description: Load and use custom fonts in the app.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Font

A library that allows loading fonts at runtime and using them in React Native components.

**Platforms:** android, ios, tvos, web

**Package:** `expo-font`

`expo-font` allows loading fonts from the web and using them in React Native components. See more detailed usage information in the [Fonts](/develop/user-interface/fonts/) guide.

## Quick Start

Here is a minimal example of how to load and use a custom font:

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, error] = useFonts({
    'Roboto-Regular': 'https://github.com/google/fonts/raw/main/ofl/roboto/Roboto-Regular.ttf',
  });

  useEffect(() => {
    if (fontsLoaded || error) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, error]);

  if (!fontsLoaded && !error) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={{ fontFamily: 'Roboto-Regular', fontSize: 24 }}>This is a custom font.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

## When to Use

Use `expo-font` whenever you need to incorporate custom typefaces into your application to maintain consistent branding or improve visual appeal. It is essential for apps that require fonts not included in the standard React Native library.

## Common Pitfalls

### 1. Font Not Loading Without Errors

**Problem**: The custom font is not applied, and no error is displayed. This is often due to an incorrect font path or a mismatch between the font family name and the key used in the `useFonts` hook.

**Solution**: Add error logging to the `useEffect` hook to identify loading issues. Ensure the font path is correct and the font name is spelled correctly.

```tsx
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    } else if (error) {
      console.error('Error loading fonts:', error);
      SplashScreen.hideAsync(); // Hide splash screen even if fonts fail to load
    }
  }, [fontsLoaded, error]);
```

### 2. Flash of Unstyled Text (FOUT)

**Problem**: The screen displays text in a default font for a moment before the custom font loads, causing a jarring visual flash.

**Solution**: Use `expo-splash-screen` to keep the splash screen visible until the fonts are loaded. This ensures a smooth transition from the splash screen to the app with the correct fonts already applied. The Quick Start example demonstrates this pattern.

### 3. Inefficient Font Loading on Native Platforms

**Problem**: Using `useFonts` or `loadAsync` for fonts that are bundled with the app can be inefficient on Android and iOS, as the fonts are loaded from the file system at runtime.

**Solution**: For fonts that are included in your project, use the `expo-font` config plugin to embed them at build time. This is more performant and ensures fonts are available immediately on app launch.

```json
{
  "expo": {
    "plugins": [
      [
        "expo-font",
        {
          "fonts": ["./assets/fonts/Roboto-Regular.ttf"]
        }
      ]
    ]
  }
}
```

## Common Patterns

### 1. Loading Multiple Fonts and Weights

Load a full font family with different weights and styles. This allows you to use them throughout your app with the `fontWeight` and `fontStyle` style properties.

```tsx
import { Text, View, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';

export default function FontDemo() {
  const [fontsLoaded] = useFonts({
    'Roboto-Light': require('./assets/fonts/Roboto-Light.ttf'),
    'Roboto-Bold': require('./assets/fonts/Roboto-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <View>
      <Text style={{ fontFamily: 'Roboto-Light', fontSize: 20 }}>This is a light font.</Text>
      <Text style={{ fontFamily: 'Roboto-Bold', fontSize: 20 }}>This is a bold font.</Text>
    </View>
  );
}
```

### 2. Creating a Reusable Text Component

Create a custom `Text` component that uses the project's typography system. This ensures consistency and makes it easy to manage font styles.

```tsx
import { Text as RNText, StyleSheet } from 'react-native';
import { useFonts } from 'expo-font';

export function Text({ style, ...props }) {
  const [fontsLoaded] = useFonts({
    'App-Regular': require('./assets/fonts/App-Regular.ttf'),
  });

  const textStyle = [
    styles.base,
    fontsLoaded && { fontFamily: 'App-Regular' },
    style,
  ];

  return <RNText style={textStyle} {...props} />;
}

const styles = StyleSheet.create({
  base: {
    fontSize: 16,
    color: '#333',
  },
});
```

## Installation

```bash
$ npx expo install expo-font
```

## Configuration in app config

There are two ways to add fonts to your app: using the `expo-font` config plugin (recommended for Android and iOS) or loading them at runtime (which works across all platforms including web).

On Android and iOS, the plugin allows you to embed font files at build time which is more efficient than [`useFonts`](#usefontsmap) or [`loadAsync`](#loadasyncfontfamilyorfontmap-source). After you set up the config plugin and run [prebuild](/workflow/continuous-native-generation/#usage), you can render custom fonts right away. The plugin can be configured in different ways, see the [Fonts](/develop/user-interface/fonts/#with-expo-font-config-plugin) guide on how to use it.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-font",
        {
          /* @info The path to the font file is relative to the project's root. */
          "fonts": ["./path/to/file.ttf"],
          /* @end */
          "android": {
            "fonts": [
              {
                "fontFamily": "Source Serif 4",
                "fontDefinitions": [
                  {
                    "path": "./path/to/SourceSerif4-ExtraBold.ttf",
                    "weight": 800
                  }
                ]
              }
            ]
          }
        }
      ]
    ]
  }
}
```

- **Android:** Copy font files to **android/app/src/main/assets/fonts**.
- **iOS**: See [Adding a Custom Font to Your App](https://developer.apple.com/documentation/uikit/adding-a-custom-font-to-your-app) in the Apple Developer documentation.

## Usage

If you don't want to use the [config plugin](#configuration-in-app-config), you can load a font at runtime with the `useFonts` hook, as shown in the snippet:

```tsx
/* @info Import useFonts hook from 'expo-font'. */ import { useFonts } from 'expo-font'; /* @end */
/* @info Also, import SplashScreen so that when the fonts are not loaded, we can continue to show SplashScreen. */ import * as SplashScreen from 'expo-splash-screen'; /* @end */

/* @info This prevents SplashScreen from auto hiding while the fonts are loaded. */
SplashScreen.preventAutoHideAsync();
/* @end */

export default function App() {
  // Use `useFonts` only if you can't use the config plugin.
  const [loaded, error] = useFonts({
    'Inter-Black': require('./assets/fonts/Inter-Black.otf'),
  });

  useEffect(() => {
    if (loaded || error) {
      /* @info After the custom fonts have loaded, we can hide the splash screen and display the app screen. */
      SplashScreen.hideAsync();
      /* @end */
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    Inter Black
      Platform Default
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
```

## API
```js

```

## Error codes

| Code                | Description                                                       |
| ------------------- | ----------------------------------------------------------------- |
| ERR_FONT_API        | If the arguments passed to `loadAsync` are invalid.               |
| ERR_FONT_SOURCE     | The provided resource was of an incorrect type.                   |
| ERR_WEB_ENVIRONMENT | The browser's `document` element doesn't support injecting fonts. |
| ERR_DOWNLOAD        | Failed to download the provided resource.                         |
| ERR_FONT_FAMILY     | Invalid font family name was provided.                            |
| ERR_UNLOAD          | Attempting to unload fonts that haven't finished loading yet.     |

## API Reference

### Methods

#### getLoadedFonts

Synchronously get all the fonts that have been loaded.
This includes fonts that were bundled at build time using the config plugin, as well as those loaded at runtime using `loadAsync`.

```typescript
getLoadedFonts(): string[]
```

**Returns:** Returns array of strings which you can use as `fontFamily` [style prop](https://reactnative.dev/docs/text#style).

#### isLoaded

Synchronously detect if the font for `fontFamily` has finished loading.

```typescript
isLoaded(fontFamily: string): boolean
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `fontFamily` | `string` | The name used to load the `FontResource`. |

**Returns:** Returns `true` if the font has fully loaded.

#### isLoading

Synchronously detect if the font for `fontFamily` is still being loaded.

```typescript
isLoading(fontFamily: string): boolean
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `fontFamily` | `string` | The name used to load the `FontResource`. |

**Returns:** Returns `true` if the font is still loading.

#### loadAsync

An efficient method for loading fonts from static or remote resources which can then be used
with the platform's native text elements. In the browser, this generates a `@font-face` block in
a shared style sheet for fonts. No CSS is needed to use this method.

> **Note**: We recommend using the [config plugin](#configuration-in-app-config) instead whenever possible.

```typescript
loadAsync(fontFamilyOrFontMap: string | Record<string, FontSource>, source: FontSource): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `fontFamilyOrFontMap` | `string | Record<string, FontSource>` | String or map of values that can be used as the `fontFamily` [style prop](https://reactnative.dev/docs/text#style) with React Native `Text` elements. |
| `source` | `FontSource` | The font asset that should be loaded into the `fontFamily` namespace. |

**Returns:** Returns a promise that fulfils when the font has loaded. Often you may want to wrap the
method in a `try/catch/finally` to ensure the app continues if the font fails to load.

#### renderToImageAsync
Creates an image with provided text.

**Platform:** android

```typescript
renderToImageAsync(glyphs: string, options: RenderToImageOptions): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `glyphs` | `string` | Text to be exported. |
| `options` | `RenderToImageOptions` | RenderToImageOptions. |

**Returns:** Promise which fulfils with uri to image.

#### useFonts

```typescript
useFonts(map: string | Record<string, FontSource>): [boolean, null | Error]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `map` | `string | Record<string, FontSource>` | A map of `fontFamily`s to [`FontSource`](#fontsource)s. After loading the font you can use the key in the `fontFamily` style prop of a `Text` element. |

**Returns:** - __loaded__ (`boolean`) - A boolean to detect if the font for `fontFamily` has finished
loading.
- __error__ (`Error | null`) - An error encountered when loading the fonts.

### Interfaces

#### RenderToImageOptions

| Property | Type | Description |
| --- | --- | --- |
| `color` | `string` | Font color |
| `fontFamily` | `string` | Font family name. |
| `size` | `number` | Size of the font. |

### Types

#### FontResource

An object used to dictate the resource that is loaded into the provided font namespace when used
with [`loadAsync`](#loadasyncfontfamilyorfontmap-source).

| Property | Type | Description |
| --- | --- | --- |
| `default` | `string` | - |
| `display` | `FontDisplay` | Sets the [`font-display`](#fontdisplay) property for a given typeface in the browser. |
| `uri` | `string | number` | - |

#### FontSource

The different types of assets you can provide to the [`loadAsync()`](#loadasyncfontfamilyorfontmap-source) function.
A font source can be a URI, a module ID, or an Expo Asset.

**Type:** `string | number | Asset | FontResource`

### Enums

#### FontDisplay

Sets the [font-display](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
for a given typeface. The default font value on web is `FontDisplay.AUTO`.
Even though setting the `fontDisplay` does nothing on native platforms, the default behavior
emulates `FontDisplay.SWAP` on flagship devices like iOS, Samsung, Pixel, etc. Default
functionality varies on One Plus devices. In the browser this value is set in the generated
`@font-face` CSS block and not as a style property meaning you cannot dynamically change this
value based on the element it's used in.

| Value | Description |
| --- | --- |
| `AUTO` | __(Default)__ The font display strategy is defined by the user agent or platform.
This generally defaults to the text being invisible until the font is loaded.
Good for buttons or banners that require a specific treatment. |
| `BLOCK` | The text will be invisible until the font has loaded. If the font fails to load then nothing
will appear - it's best to turn this off when debugging missing text. |
| `FALLBACK` | Splits the behavior between `SWAP` and `BLOCK`.
There will be a [100ms timeout](https://developers.google.com/web/updates/2016/02/font-display?hl=en)
where the text with a custom font is invisible, after that the text will either swap to the
styled text or it'll show the unstyled text and continue to load the custom font. This is good
for buttons that need a custom font but should also be quickly available to screen-readers. |
| `OPTIONAL` | This works almost identically to `FALLBACK`, the only difference is that the browser will
decide to load the font based on slow connection speed or critical resource demand. |
| `SWAP` | Fallback text is rendered immediately with a default font while the desired font is loaded.
This is good for making the content appear to load instantly and is usually preferred. |
