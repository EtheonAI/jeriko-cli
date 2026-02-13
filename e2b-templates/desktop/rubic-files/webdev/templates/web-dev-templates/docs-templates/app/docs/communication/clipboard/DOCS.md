---
name: clipboard
description: Read and write to system clipboard.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Clipboard

A universal library that allows getting and setting Clipboard content.

**Platforms:** android, ios, web

**Package:** `expo-clipboard`

`expo-clipboard` provides an interface for getting and setting Clipboard content on Android, iOS, and Web.

## Quick Start

Here's a minimal example of how to copy and paste text using the `expo-clipboard` module.

```jsx
import { useState } from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export default function App() {
  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync('Hello from the clipboard!');
    alert('Copied to clipboard!');
  };

  const fetchCopiedText = async () => {
    // On Web, this will prompt the user for permission
    const text = await Clipboard.getStringAsync();
    setCopiedText(text);
  };

  return (
    <View style={styles.container}>
      <Button title="Copy Text" onPress={copyToClipboard} />
      <Button title="Paste Text" onPress={fetchCopiedText} />
      {copiedText ? <Text style={styles.copiedText}>Copied text: {copiedText}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiedText: {
    marginTop: 10,
    color: 'blue',
  },
});
```

## When to Use

Use the `expo-clipboard` module whenever you need to provide users with the ability to copy text, URLs, or images to the system clipboard, or to paste content from the clipboard into your application. This is useful for sharing functionality, promo code fields, or allowing users to easily move data between applications.

## Common Pitfalls

### 1. Assuming Clipboard Access is Instantaneous

**Problem:** Developers often forget that clipboard operations are asynchronous. Calling `getStringAsync()` and immediately trying to use the result will not work.

**Solution:** Always use `await` with `getStringAsync()` and other async clipboard functions, and handle the result within an `async` function or with `.then()`.

```jsx
const fetchCopiedText = async () => {
  try {
    const text = await Clipboard.getStringAsync();
    setCopiedText(text);
  } catch (error) {
    console.error('Failed to get string from clipboard', error);
  }
};
```

### 2. Ignoring Web Browser Permissions

**Problem:** On the web, the browser's security model requires user permission to access the clipboard. If the user denies permission, your app will not be able to read from the clipboard.

**Solution:** While `expo-clipboard` handles the permission prompt automatically, your UI should account for the possibility of the user denying permission. Provide clear feedback to the user if the operation fails.

```jsx
const fetchCopiedText = async () => {
  if (Platform.OS === 'web') {
    try {
      const text = await Clipboard.getStringAsync();
      setCopiedText(text);
    } catch (e) {
      alert('Could not get text from clipboard. Please allow clipboard access in your browser settings.');
    }
  } else {
    const text = await Clipboard.getStringAsync();
    setCopiedText(text);
  }
};
```

### 3. Not Handling Empty Clipboard

**Problem:** `getStringAsync()` will return an empty string (`''`) if the clipboard is empty. If your app doesn't handle this case, it might lead to unexpected behavior or a confusing user experience.

**Solution:** Always check if the retrieved string is empty and provide appropriate feedback to the user.

```jsx
const fetchCopiedText = async () => {
  const text = await Clipboard.getStringAsync();
  if (text) {
    setCopiedText(text);
  } else {
    alert('Clipboard is empty!');
  }
};
```

## Common Patterns

### Checking for and Pasting a URL

This pattern checks if the clipboard contains a URL. If it does, it pastes the URL; otherwise, it informs the user.

```jsx
import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

const pasteUrl = async () => {
  const hasUrl = await Clipboard.hasUrlAsync();
  if (hasUrl) {
    const url = await Clipboard.getUrlAsync();
    // You can now use the URL, for example, open it in the browser
    Linking.openURL(url);
  } else if (Platform.OS !== 'ios') {
    // hasUrlAsync is only available on iOS. As a fallback, you can get the string and check if it's a URL.
    const text = await Clipboard.getStringAsync();
    const isUrl = text.startsWith('http://') || text.startsWith('https://');
    if(isUrl) {
        Linking.openURL(text);
    } else {
        alert('No URL on clipboard');
    }
  } else {
    alert('No URL on clipboard');
  }
};
```

## Installation

```bash
$ npx expo install expo-clipboard
```

## Usage

```jsx
import { useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export default function App() {
  const [copiedText, setCopiedText] = useState('');

  const copyToClipboard = async () => {
    /* @info Copy the text to the clipboard */
    await Clipboard.setStringAsync('hello world');
    /* @end */
  };

  const fetchCopiedText = async () => {
    const text = /* @info Paste the text from the clipboard */ await Clipboard.getStringAsync();
    /* @end */
    setCopiedText(text);
  };

  return (
    <View style={styles.container}>
      <Button title="Click here to copy to Clipboard" onPress={copyToClipboard} />
      <Button title="View copied text" onPress={fetchCopiedText} />
      <Text style={styles.copiedText}>{copiedText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  copiedText: {
    marginTop: 10,
    color: 'red',
  },
});
```

## API

```js
import * as Clipboard from 'expo-clipboard';
```

> **warning** On Web, this module uses the [`AsyncClipboard` API](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API),
> which might behave differently between browsers or not be fully supported.
> Especially on WebKit, there's an issue which makes this API unusable in asynchronous code.
> [Click here for more details](https://bugs.webkit.org/show_bug.cgi?id=222262).

## API Reference
### Methods

#### addClipboardListener

Adds a listener that will fire whenever the content of the user's clipboard changes. This method
is a no-op on Web.

```typescript
addClipboardListener(listener: (event: ClipboardEvent) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: ClipboardEvent) => void` | Callback to execute when listener is triggered. The callback is provided a single argument that is an object containing information about clipboard contents. |

#### ClipboardPasteButton

This component displays the `UIPasteControl` button on your screen. This allows pasting from the clipboard without requesting permission from the user.

You should only attempt to render this if [`Clipboard.isPasteButtonAvailable`](#ispastebuttonavailable)
is `true`. This component will render nothing if it is not available, and you will get
a warning in development mode (`__DEV__ === true`).

The properties of this component extend from `View`; however, you should not attempt to set
`backgroundColor`, `color` or `borderRadius` with the `style` property. Apple restricts customisation of this view.
Instead, you should use the backgroundColor and foregroundColor properties to set the colors of the button, the cornerStyle property to change the border radius,
and the displayMode property to change the appearance of the icon and label. The word "Paste" is not editable and neither is the icon.

Make sure to attach height and width via the style props as without these styles, the button will
not appear on the screen.

```typescript
ClipboardPasteButton(__namedParameters: ClipboardPasteButtonProps): null | Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `ClipboardPasteButtonProps` | - |

#### getImageAsync

Gets the image from the user's clipboard and returns it in the specified
format. Calling this method on web will prompt the user to grant your app
permission to "see text and images copied to the clipboard."

```typescript
getImageAsync(options: GetImageOptions): Promise<ClipboardImage | null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `GetImageOptions` | A `GetImageOptions` object to specify the desired format of the image. |

**Returns:** If there was an image in the clipboard, the promise resolves to
a [`ClipboardImage`](#clipboardimage) object containing the base64 string and metadata of the image.
Otherwise, it resolves to `null`.

#### getStringAsync

Gets the content of the user's clipboard. Calling this method on web will prompt
the user to grant your app permission to "see text and images copied to the clipboard."

```typescript
getStringAsync(options: GetStringOptions): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `GetStringOptions` | Options for the clipboard content to be retrieved. |

**Returns:** A promise that resolves to the content of the clipboard.

#### getUrlAsync
Gets the URL from the user's clipboard.

**Platform:** ios

```typescript
getUrlAsync(): Promise<string | null>
```

**Returns:** A promise that fulfills to the URL in the clipboard.

#### hasImageAsync

Returns whether the clipboard has an image content.

On web, this requires the user to grant your app permission to _"see text and images copied to the clipboard"_.

```typescript
hasImageAsync(): Promise<boolean>
```

**Returns:** A promise that fulfills to `true` if clipboard has image content, resolves to `false` otherwise.

#### hasStringAsync

Returns whether the clipboard has text content. Returns true for both plain text and rich text (e.g. HTML).

On web, this requires the user to grant your app permission to _"see text and images copied to the clipboard"_.

```typescript
hasStringAsync(): Promise<boolean>
```

**Returns:** A promise that fulfills to `true` if clipboard has text content, resolves to `false` otherwise.

#### hasUrlAsync

Returns whether the clipboard has a URL content.

**Platform:** ios

```typescript
hasUrlAsync(): Promise<boolean>
```

**Returns:** A promise that fulfills to `true` if clipboard has URL content, resolves to `false` otherwise.

#### removeClipboardListener

Removes the listener added by addClipboardListener. This method is a no-op on Web.

```typescript
removeClipboardListener(subscription: EventSubscription): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `subscription` | `EventSubscription` | The subscription to remove (created by addClipboardListener). |

#### setImageAsync

Sets an image in the user's clipboard.

```typescript
setImageAsync(base64Image: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `base64Image` | `string` | Image encoded as a base64 string, without MIME type. |

#### setString

Sets the content of the user's clipboard.

```typescript
setString(text: string): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `text` | `string` | - |

**Returns:** On web, this returns a boolean value indicating whether or not the string was saved to
the user's clipboard. On iOS and Android, nothing is returned.

#### setStringAsync
Sets the content of the user's clipboard.

```typescript
setStringAsync(text: string, options: SetStringOptions): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `text` | `string` | The string to save to the clipboard. |
| `options` | `SetStringOptions` | Options for the clipboard content to be set. |

**Returns:** On web, this returns a promise that fulfills to a boolean value indicating whether or not
the string was saved to the user's clipboard. On iOS and Android, the promise always resolves to `true`.

#### setUrlAsync

Sets a URL in the user's clipboard.

This function behaves the same as [`setStringAsync()`](#setstringasynctext-options), except that
it sets the clipboard content type to be a URL. It lets your app or other apps know that the
clipboard contains a URL and behave accordingly.

**Platform:** ios

```typescript
setUrlAsync(url: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | The URL to save to the clipboard. |

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types

#### AcceptedContentType

**Type:** `'plain-text' | 'image' | 'url' | 'html'`

#### ClipboardEvent

| Property | Type | Description |
| --- | --- | --- |
| `content` | `string` | - |
| `contentTypes` | `ContentType[]` | An array of content types that are available on the clipboard. |

#### ClipboardImage

| Property | Type | Description |
| --- | --- | --- |
| `data` | `string` | A Base64-encoded string of the image data. Its format is dependent on the `format` option. You can use it directly as the source of an `Image` element. > **NOTE:** The string is already prepended with `data:image/png;base64,` or `data:image/jpeg;base64,` prefix. |
| `size` | `{ height: number; width: number }` | Dimensions (`width` and `height`) of the image pasted from clipboard. |

#### ClipboardPasteButtonProps

**Type:** `unknown`

#### CornerStyleType

**Type:** `'dynamic' | 'fixed' | 'capsule' | 'large' | 'medium' | 'small'`

#### DisplayModeType

**Type:** `'iconAndLabel' | 'iconOnly' | 'labelOnly'`

#### GetImageOptions


| Property | Type | Description |
| --- | --- | --- |
| `format` | `'png' | 'jpeg'` | The format of the clipboard image to be converted to. |
| `jpegQuality` | `number` | Specify the quality of the returned image, between `0` and `1`. Defaults to `1` (highest quality). Applicable only when `format` is set to `jpeg`, ignored otherwise. |

#### GetStringOptions

| Property | Type | Description |
| --- | --- | --- |
| `preferredFormat` | `StringFormat` | The target format of the clipboard string to be converted to, if possible. |

#### ImagePasteEvent

**Type:** `unknown`

#### PasteEventPayload

**Type:** `TextPasteEvent | ImagePasteEvent`

#### SetStringOptions

| Property | Type | Description |
| --- | --- | --- |
| `inputFormat` | `StringFormat` | The input format of the provided string. Adjusting this option can help other applications interpret copied string properly. |

#### TextPasteEvent

| Property | Type | Description |
| --- | --- | --- |
| `text` | `string` | - |
| `type` | `'text'` | - |

### Enums

#### ContentType

Type used to define what type of data is stored in the clipboard.

| Value | Description |
| --- | --- |
| `HTML` | - |
| `IMAGE` | - |
| `PLAIN_TEXT` | - |
| `URL` | - |

#### StringFormat

Type used to determine string format stored in the clipboard.

| Value | Description |
| --- | --- |
| `HTML` | - |
| `PLAIN_TEXT` | - |
