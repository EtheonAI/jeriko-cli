---
name: system-ui
description: Control system UI elements like navigation bar.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# SystemUI

A library that allows interacting with system UI elements.

**Platforms:** android, ios, tvos, web

**Package:** `expo-system-ui`

`expo-system-ui` enables you to interact with UI elements that fall outside of the React tree. Specifically the root view background color, and locking the user interface style globally on Android.

## Installation

```bash
$ npx expo install expo-system-ui
```

## Configuration in app config

Enable the `expo-system-ui` config plugin when you use [Continuous Native Generation (CNG)](/workflow/continuous-native-generation/). The plugin allows you to configure [`userInterfaceStyle`](../config/app/#userinterfacestyle) on Android and [`backgroundColor`](../config/app/#backgroundcolor) on iOS properties from [app config](../config/app). These properties cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "backgroundColor": "#ffffff",
    "userInterfaceStyle": "light",
    "ios": {
      "backgroundColor": "#ffffff",
    }
    "android": {
      "userInterfaceStyle": "light"
    },
    "plugins": ["expo-system-ui"],
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) or you're using native **android** and **ios** project manually, then you need to add the following configuration to your native project:

**Android**

To apply `userInterfaceStyle` on Android, you need to add the `expo_system_ui_user_interface_style` configuration **android/app/src/main/res/values/strings.xml**:

```xml
<resources>
  <!-- ... -->
  <string name="expo_system_ui_user_interface_style" translatable="false">light</string> <!-- or dark -->
</resources>
```

**iOS**

To apply `backgroundColor` on iOS, you need to add the `UIUserInterfaceStyle` configuration in **ios/your-app/Info.plist**:

```xml
<plist>
  <dict>
    <!-- ... -->
    <key>UIUserInterfaceStyle</key>
    <string>Light</string> <!-- or Dark -->
  </dict>
</plist>
```

## API

```js

```

## API Reference

### Methods

#### getBackgroundColorAsync

Gets the root view background color.

```typescript
getBackgroundColorAsync(): Promise<ColorValue | null>
```

**Returns:** Current root view background color in hex format. Returns `null` if the background color is not set.

#### setBackgroundColorAsync

Changes the root view background color.
Call this function in the root file outside of your component.

```typescript
setBackgroundColorAsync(color: null | ColorValue): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `color` | `null | ColorValue` | Any valid [CSS 3 (SVG) color](http://www.w3.org/TR/css3-color/#svg-color). |
