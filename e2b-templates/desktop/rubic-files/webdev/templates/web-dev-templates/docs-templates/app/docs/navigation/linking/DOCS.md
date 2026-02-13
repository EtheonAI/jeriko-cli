---
name: linking
description: Handle deep links, URL schemes, and universal links.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Linking

An API that provides methods to create and open deep links universally.

**Platforms:** android, ios, web, tvos

**Package:** `expo-linking`

`expo-linking` provides utilities for your app to interact with other installed apps using deep links. It also provides helper methods for constructing and parsing deep links into your app. This library is an extension of the React Native [`Linking`](https://reactnative.dev/docs/linking).

For a more comprehensive explanation of how to use `expo-linking`, refer to the [Linking into other apps](/linking/into-other-apps/).

## Quick Start

```javascript
import * as Linking from 'expo-linking';
import { Button, View, Platform, Alert } from 'react-native';

const App = () => {
  const openUrl = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert(`Don\'t know how to open this URL: ${url}`);
    }
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Button title="Open Expo Website" onPress={() => openUrl('https://expo.dev')} />
      <Button title="Open Settings" onPress={() => Linking.openSettings()} />
    </View>
  );
};

export default App;
```

## When to Use

Use `expo-linking` to handle incoming deep links, open other apps, or prompt users to open their device settings. It's essential for authentication flows, external navigation, and providing shortcuts to specific app features.

## Common Pitfalls

*   **Problem**: `canOpenURL` returns `false` on iOS for custom schemes.
    **Solution**: You must add the URL schemes your app needs to query to the `LSApplicationQueriesSchemes` key in your `Info.plist` file.

    ```xml
    <key>LSApplicationQueriesSchemes</key>
    <array>
      <string>mailto</string>
      <string>tel</string>
    </array>
    ```

*   **Problem**: Deep linking doesn't work in the Expo Go app.
    **Solution**: Custom schemes are not supported in Expo Go. You need to create a development build or a production build of your app to test deep linking.

*   **Problem**: `getInitialURL` is `null` when the app is already open.
    **Solution**: `getInitialURL` only returns a value when the app is launched from a cold start. To handle deep links when the app is already open, you need to listen for the `url` event.

    ```javascript
    import { useEffect } from 'react';
    import * as Linking from 'expo-linking';

    const useDeepLinkHandler = () => {
      useEffect(() => {
        const subscription = Linking.addEventListener('url', ({ url }) => {
          // Handle the deep link
          console.log('Deep link received:', url);
        });

        return () => {
          subscription.remove();
        };
      }, []);
    };
    ```

## Common Patterns

*   **Creating a deep link to your app**

    ```javascript
    import * as Linking from 'expo-linking';

    const url = Linking.createURL('user/123', {
      queryParams: { hello: 'world' },
    });
    // Result: myapp://user/123?hello=world
    ```

*   **Parsing a deep link**

    ```javascript
    import * as Linking from 'expo-linking';

    const parsedUrl = Linking.parse('myapp://user/123?hello=world');
    // Result:
    // {
    //   hostname: null,
    //   path: 'user/123',
    //   queryParams: { hello: 'world' },
    //   scheme: 'myapp',
    // }
    ```

## Installation

```bash
$ npx expo install expo-linking
```

## API

```js
import * as Linking from 'expo-linking';
```

## API Reference

### Methods

#### addEventListener

Add a handler to `Linking` changes by listening to the `url` event type and providing the handler.
It is recommended to use the [`useURL()`](#useurl) hook instead.

```typescript
addEventListener(type: 'url', handler: URLListener): EmitterSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `type` | `'url'` | The only valid type is `'url'`. |
| `handler` | `URLListener` | An [`URLListener`](#urllistener) function that takes an `event` object of the type [`EventType`](#eventtype). |

**Returns:** An EmitterSubscription that has the remove method from EventSubscription

#### canOpenURL

Determine whether or not an installed app can handle a given URL.
On web this always returns `true` because there is no API for detecting what URLs can be opened.

```typescript
canOpenURL(url: string): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | The URL that you want to test can be opened. |

**Returns:** A `Promise` object that is fulfilled with `true` if the URL can be handled, otherwise it
`false` if not.
The `Promise` will reject on Android if it was impossible to check if the URL can be opened, and
on iOS if you didn't [add the specific scheme in the `LSApplicationQueriesSchemes` key inside **Info.plist**](/guides/linking#linking-from-your-app).

#### collectManifestSchemes

Collect a list of platform schemes from the manifest.

This method is based on the `Scheme` modules from `@expo/config-plugins`
which are used for collecting the schemes before prebuilding a native app.

- Android: `scheme` -> `android.scheme` -> `android.package`
- iOS: `scheme` -> `ios.scheme` -> `ios.bundleIdentifier`

```typescript
collectManifestSchemes(): string[]
```

#### createURL

Helper method for constructing a deep link into your app, given an optional path and set of query
parameters. Creates a URI scheme with two slashes by default.

The scheme must be defined in the [app config]() under `expo.scheme`
or `expo.{android,ios}.scheme`. Platform-specific schemes defined under `expo.{android,ios}.scheme`
take precedence over universal schemes defined under `expo.scheme`.

# Examples
- Development and production builds: `<scheme>://path` - uses the optional `scheme` property if provided, and otherwise uses the first scheme defined by your app config
- Web (dev): `https://localhost:19006/path`
- Web (prod): `https://myapp.com/path`
- Expo Go (dev): `exp://128.0.0.1:8081/--/path`

The behavior of this method in Expo Go for published updates is undefined and should not be relied upon.
The created URL in this case is neither stable nor predictable during the lifetime of the app.
If a stable URL is needed, for example in authorization callbacks, a build (or development build)
of your application should be used and the scheme provided.

```typescript
createURL(path: string, namedParameters: CreateURLOptions): string
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `path` | `string` | Addition path components to append to the base URL. |
| `namedParameters` | `CreateURLOptions` | Additional options object. |

**Returns:** A URL string which points to your app with the given deep link information.

#### getInitialURL

Get the URL that was used to launch the app if it was launched by a link.

```typescript
getInitialURL(): Promise<string | null>
```

**Returns:** The URL string that launched your app, or `null`.

#### getLinkingURL

Get the URL that was used to launch the app if it was launched by a link.

```typescript
getLinkingURL(): string | null
```

**Returns:** The URL string that launched your app, or `null`.

#### hasConstantsManifest

Ensure the user has linked the expo-constants manifest in bare workflow.

```typescript
hasConstantsManifest(): boolean
```

#### hasCustomScheme

```typescript
hasCustomScheme(): boolean
```

#### openSettings

Open the operating system settings app and displays the app’s custom settings, if it has any.

```typescript
openSettings(): Promise<void>
```

#### openURL

Attempt to open the given URL with an installed app. See the [Linking guide](/guides/linking)
for more information.

```typescript
openURL(url: string): Promise<true>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | A URL for the operating system to open. For example: `tel:5555555`, `exp://`. |

**Returns:** A `Promise` that is fulfilled with `true` if the link is opened operating system
automatically or the user confirms the prompt to open the link. The `Promise` rejects if there
are no applications registered for the URL or the user cancels the dialog.

#### parse

Helper method for parsing out deep link information from a URL.

```typescript
parse(url: string): ParsedURL
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | A URL that points to the currently running experience (for example, an output of `Linking.createURL()`). |

**Returns:** A `ParsedURL` object.

#### parseInitialURLAsync

Helper method which wraps React Native's `Linking.getInitialURL()` in `Linking.parse()`.
Parses the deep link information out of the URL used to open the experience initially.
If no link opened the app, all the fields will be `null`.
> On the web it parses the current window URL.

```typescript
parseInitialURLAsync(): Promise<ParsedURL>
```

**Returns:** A promise that resolves with `ParsedURL` object.

#### resolveScheme

```typescript
resolveScheme(options: { isSilent: boolean; scheme: string }): string
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `{ isSilent: boolean; scheme: string }` | - |

#### sendIntent

Launch an Android intent with extras.
> Use [`expo-intent-launcher`]() instead. `sendIntent` is only included in
> `Linking` for API compatibility with React Native's Linking API.

**Platform:** android

```typescript
sendIntent(action: string, extras: SendIntentExtras[]): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `action` | `string` | - |
| `extras` | `SendIntentExtras[]` | - |

#### useLinkingURL

Returns the linking URL followed by any subsequent changes to the URL.
Always returns the initial URL immediately on reload.

```typescript
useLinkingURL(): string | null
```

**Returns:** Returns the initial URL or `null`.

#### useURL

Returns the initial URL followed by any subsequent changes to the URL.

```typescript
useURL(): string | null
```

**Returns:** Returns the initial URL or `null`.

### Types


#### CreateURLOptions

| Property | Type | Description |
| --- | --- | --- |
| `isTripleSlashed` | `boolean` | Should the URI be triple slashed `scheme:///path` or double slashed `scheme://path`. |
| `queryParams` | `QueryParams` | An object of parameters that will be converted into a query string. |
| `scheme` | `string` | URI protocol `<scheme>://` that must be built into your native app. |

#### EventType

| Property | Type | Description |
| --- | --- | --- |
| `nativeEvent` | `MessageEvent` | - |
| `url` | `string` | - |

#### NativeURLListener

**Type:** `(nativeEvent: MessageEvent) => void`

#### ParsedURL

| Property | Type | Description |
| --- | --- | --- |
| `hostname` | `string | null` | - |
| `path` | `string | null` | The path into the app specified by the URL. |
| `queryParams` | `QueryParams | null` | The set of query parameters specified by the query string of the url used to open the app. |
| `scheme` | `string | null` | - |

#### QueryParams

**Type:** `Record<string, undefined | string | string[]>`

#### SendIntentExtras

| Property | Type | Description |
| --- | --- | --- |
| `key` | `string` | - |
| `value` | `string | number | boolean` | - |

#### URLListener

**Type:** `(event: EventType) => void`
