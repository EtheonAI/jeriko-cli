---
name: webbrowser
description: Open URLs in an in-app browser or system browser.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# WebBrowser

A library that provides access to the system's web browser and supports handling redirects.

## Quick Start

```jsx
import React, { useState } from 'react';
import { Button, View, StyleSheet, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export default function App() {
  const [result, setResult] = useState(null);

  const openBrowser = async () => {
    if (Platform.OS === 'web') {
      // For web, window.open is used. It returns null.
      await WebBrowser.openBrowserAsync('https://expo.dev');
      setResult({ type: 'opened' });
    } else {
      let browserResult = await WebBrowser.openBrowserAsync('https://expo.dev');
      setResult(browserResult);
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Open Browser" onPress={openBrowser} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

## When to Use

Use `expo-web-browser` to open a web browser inside your app. This is useful for displaying external websites, privacy policies, terms of service, or for authentication flows where you need to direct the user to a web-based login page.

## Common Pitfalls

### 1. Not Handling Web Platform Differences

*   **Problem**: The `openBrowserAsync` method returns a different result on web compared to native platforms. On web, it returns `null`, while on native it returns an object with a `type` property. Not accounting for this can lead to unexpected behavior or crashes.
*   **Solution**: Use `Platform.OS` to check for the web platform and handle the result accordingly.

```jsx
const openBrowser = async () => {
  if (Platform.OS === 'web') {
    await WebBrowser.openBrowserAsync('https://expo.dev');
    setResult({ type: 'opened' }); // Manually set a result for web
  } else {
    let browserResult = await WebBrowser.openBrowserAsync('https://expo.dev');
    setResult(browserResult);
  }
};
```

### 2. Blocking Popups on Web

*   **Problem**: On web, browsers may block popups that are not initiated by a direct user action. If you call `openBrowserAsync` after a long-running task, the browser might block it.
*   **Solution**: Ensure that `openBrowserAsync` is called as directly as possible in response to a user event, such as a button press.

## Common Patterns

### 1. Opening a URL in the In-App Browser

This pattern demonstrates how to open a URL in the in-app browser and handle the result.

```jsx
import React, { useState } from 'react';
import { Button, View, StyleSheet, Text } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

export default function App() {
  const [result, setResult] = useState(null);

  const openLink = async (url) => {
    try {
      const browserResult = await WebBrowser.openBrowserAsync(url);
      setResult(browserResult);
    } catch (error) {
      console.error('Error opening browser:', error);
      setResult({ type: 'error', message: error.message });
    }
  };

  return (
    <View style={styles.container}>
      <Button title="Open Expo Website" onPress={() => openLink('https://expo.dev')} />
      {result && <Text>Result: {JSON.stringify(result)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```


**Platforms:** android, ios, web

**Package:** `expo-web-browser`

`expo-web-browser` provides access to the system's web browser and supports handling redirects. On Android, it uses `ChromeCustomTabs` and on iOS, it uses `SFSafariViewController` or `ASWebAuthenticationSession`, depending on the method you call. As of iOS 11, `SFSafariViewController` no longer shares cookies with Safari, so if you are using `WebBrowser` for authentication you will want to use `WebBrowser.openAuthSessionAsync`, and if you just want to open a webpage (such as your app privacy policy), then use `WebBrowser.openBrowserAsync`.

## Installation

```bash
$ npx expo install expo-web-browser
```

## Configuration in app config

You can configure `expo-web-browser` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-web-browser",
        {
          "experimentalLauncherActivity": true
        }
      ]
    ]
  }
}
```

## Usage

```jsx

/* @hide */

/* @end */

export default function App() {
  const [result, setResult] = useState(null);

  const _handlePressButtonAsync = async () => {
    let result = await WebBrowser.openBrowserAsync('https://expo.dev');
    setResult(result);
  };
  return (
    {result && JSON.stringify(result)}
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Constants.statusBarHeight,
    backgroundColor: '#ecf0f1',
  },
});
```

### Handling deep links from the WebBrowser

If your project uses Expo Router, deep links are handled automatically.

If you use the `WebBrowser` window for authentication or another use case where you want to pass information back into your app through a deep link, add a handler with `Linking.addEventListener` before opening the browser. When the listener fires, you should call [`dismissBrowser`](#webbrowserdismissbrowser). It will not automatically be dismissed when a deep link is handled. Aside from that, redirects from `WebBrowser` work the same as other deep links. Read more about it in [Linking](/linking/into-your-app/#handle-urls).

## API

```js

```

## Error codes

### `ERR_WEB_BROWSER_REDIRECT`

**Web only:** The window cannot complete the redirect request because the invoking window doesn't have a reference to its parent. This can happen if the parent window was reloaded.

### `ERR_WEB_BROWSER_BLOCKED`

**Web only:** The popup window was blocked by the browser or failed to open. This can happen in mobile browsers when the `window.open()` method was invoked too long after a user input was fired.

Mobile browsers do this to prevent malicious websites from opening many unwanted popups on mobile.

You're method can still run in an async function but there cannot be any long running tasks before it. You can use hooks to disable user-inputs until any other processes have finished loading.

### `ERR_WEB_BROWSER_CRYPTO`

**Web only:** The current environment doesn't support crypto. Ensure you are running from a secure origin (localhost/https).

## API Reference

### Methods

#### coolDownAsync

This methods removes all bindings to services created by [`warmUpAsync`](#webbrowserwarmupasyncbrowserpackage)
or [`mayInitWithUrlAsync`](#webbrowsermayinitwithurlasyncurl-browserpackage). You should call
this method once you don't need them to avoid potential memory leaks. However, those binding
would be cleared once your application is destroyed, which might be sufficient in most cases.

**Platform:** android

```typescript
coolDownAsync(browserPackage: string): Promise<WebBrowserCoolDownResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `browserPackage` | `string` | Package of browser to be cooled. If not set, preferred browser will be used. |

**Returns:** The promise which fulfils with ` WebBrowserCoolDownResult` when cooling is performed, or
an empty object when there was no connection to be dismissed.

#### dismissAuthSession

Dismisses the current authentication session. On web, it will close the popup window associated with auth process.

**Platform:** ios

```typescript
dismissAuthSession(): void
```

**Returns:** The `void` on the successful attempt or throws an error if dismiss functionality is not available.

#### dismissBrowser

Dismisses the presented web browser.

**Platform:** ios

```typescript
dismissBrowser(): Promise<{ type: WebBrowserResultType.DISMISS }>
```

**Returns:** The promise that resolves with `{ type: 'dismiss' }` on the successful attempt or throws an error if dismiss functionality is not available.

#### getCustomTabsSupportingBrowsersAsync

Returns a list of applications package names supporting Custom Tabs, Custom Tabs
service, user chosen and preferred one. This may not be fully reliable, since it uses
`PackageManager.getResolvingActivities` under the hood. (For example, some browsers might not be
present in browserPackages list once another browser is set to default.)

**Platform:** android

```typescript
getCustomTabsSupportingBrowsersAsync(): Promise<WebBrowserCustomTabsResults>
```

**Returns:** The promise which fulfils with [`WebBrowserCustomTabsResults`](#webbrowsercustomtabsresults) object.

#### maybeCompleteAuthSession

Possibly completes an authentication session on web in a window popup. The method
should be invoked on the page that the window redirects to.

**Platform:** web

```typescript
maybeCompleteAuthSession(options: WebBrowserCompleteAuthSessionOptions): WebBrowserCompleteAuthSessionResult
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `WebBrowserCompleteAuthSessionOptions` | - |

**Returns:** Returns an object with message about why the redirect failed or succeeded:

If `type` is set to `failed`, the reason depends on the message:
- `Not supported on this platform`: If the platform doesn't support this method (Android, iOS).
- `Cannot use expo-web-browser in a non-browser environment`: If the code was executed in an SSR
  or node environment.
- `No auth session is currently in progress`: (the cached state wasn't found in local storage).
  This can happen if the window redirects to an origin (website) that is different to the initial
  website origin. If this happens in development, it may be because the auth started on localhost
  and finished on your computer port (Ex: `128.0.0.*`). This is controlled by the `redirectUrl`
  and `returnUrl`.
- `Current URL "<URL>" and original redirect URL "<URL>" do not match`: This can occur when the
  redirect URL doesn't match what was initial defined as the `returnUrl`. You can skip this test
  in development by passing `{ skipRedirectCheck: true }` to the function.

If `type` is set to `success`, the parent window will attempt to close the child window immediately.

If the error `ERR_WEB_BROWSER_REDIRECT` was thrown, it may mean that the parent window was
reloaded before the auth was completed. In this case you'll need to close the child window manually.

#### mayInitWithUrlAsync

This method initiates (if needed) [CustomTabsSession](https://developer.android.com/reference/android/support/customtabs/CustomTabsSession.html#maylaunchurl)
and calls its `mayLaunchUrl` method for browser specified by the package.

**Platform:** android

```typescript
mayInitWithUrlAsync(url: string, browserPackage: string): Promise<WebBrowserMayInitWithUrlResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | The url of page that is likely to be loaded first when opening browser. |
| `browserPackage` | `string` | Package of browser to be informed. If not set, preferred browser will be used. |

**Returns:** A promise which fulfils with `WebBrowserMayInitWithUrlResult` object.

#### openAuthSessionAsync

# On Android:
This will be done using a "custom Chrome tabs" browser, [AppState](https://reactnative.dev/docs/appstate),
and [Linking]() APIs.

# On iOS:
Opens the url with Safari in a modal using `ASWebAuthenticationSession`. The user will be asked
whether to allow the app to authenticate using the given url.
To handle redirection back to the mobile application, the redirect URI set in the authentication server
has to use the protocol provided as the scheme in **app.json** [`expo.scheme`]().
For example, `demo://` not `https://` protocol.
Using `Linking.addEventListener` is not needed and can have side effects.

# On web:
> This API can only be used in a secure environment (localhost/https).
to test this. Otherwise, an error with code [`ERR_WEB_BROWSER_CRYPTO`](#err_web_browser_crypto) will be thrown.
This will use the browser's [`window.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open) API.
- _Desktop_: This will create a new web popup window in the browser that can be closed later using `WebBrowser.maybeCompleteAuthSession()`.
- _Mobile_: This will open a new tab in the browser which can be closed using `WebBrowser.maybeCompleteAuthSession()`.

How this works on web:
- A crypto state will be created for verifying the redirect.
  - This means you need to run with `npx expo start --https`
- The state will be added to the window's `localstorage`. This ensures that auth cannot complete
  unless it's done from a page running with the same origin as it was started.
  Ex: if `openAuthSessionAsync` is invoked on `https://localhost:19006`, then `maybeCompleteAuthSession`
  must be invoked on a page hosted from the origin `https://localhost:19006`. Using a different
  website, or even a different host like `https://128.0.0.*:19006` for example will not work.
- A timer will be started to check for every 1000 milliseconds (1 second) to detect if the window
  has been closed by the user. If this happens then a promise will resolve with `{ type: 'dismiss' }`.

> On mobile web, Chrome and Safari will block any call to [`window.open()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/open)
which takes too long to fire after a user interaction. This method must be invoked immediately
after a user interaction. If the event is blocked, an error with code [`ERR_WEB_BROWSER_BLOCKED`](#err_web_browser_blocked) will be thrown.

```typescript
openAuthSessionAsync(url: string, redirectUrl: null | string, options: AuthSessionOpenOptions): Promise<WebBrowserAuthSessionResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | The url to open in the web browser. This should be a login page. |
| `redirectUrl` | `null | string` | _Optional_ - The url to deep link back into your app. On web, this defaults to the output of [`Linking.createURL("")`](). |
| `options` | `AuthSessionOpenOptions` | _Optional_ - An object extending the [`WebBrowserOpenOptions`](#webbrowseropenoptions). If there is no native AuthSession implementation available (which is the case on Android) these params will be used in the browser polyfill. If there is a native AuthSession implementation, these params will be ignored. |

**Returns:** - If the user does not permit the application to authenticate with the given url, the Promise fulfills with `{ type: 'cancel' }` object.
- If the user closed the web browser, the Promise fulfills with `{ type: 'cancel' }` object.
- If the browser is closed using [`dismissBrowser`](#webbrowserdismissbrowser),
the Promise fulfills with `{ type: 'dismiss' }` object.

#### openBrowserAsync

Opens the url with Safari in a modal on iOS using [`SFSafariViewController`](https://developer.apple.com/documentation/safariservices/sfsafariviewcontroller),
and Chrome in a new [custom tab](https://developer.chrome.com/multidevice/android/customtabs)
on Android. On iOS, the modal Safari will not share cookies with the system Safari. If you need
this, use [`openAuthSessionAsync`](#webbrowseropenauthsessionasyncurl-redirecturl-options).

```typescript
openBrowserAsync(url: string, browserParams: WebBrowserOpenOptions): Promise<WebBrowserResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `url` | `string` | The url to open in the web browser. |
| `browserParams` | `WebBrowserOpenOptions` | A dictionary of key-value pairs. |

**Returns:** The promise behaves differently based on the platform.
On Android promise resolves with `{ type: 'opened' }` if we were able to open browser.
On iOS:
- If the user closed the web browser, the Promise resolves with `{ type: 'cancel' }`.
- If the browser is closed using [`dismissBrowser`](#webbrowserdismissbrowser), the Promise resolves with `{ type: 'dismiss' }`.

#### warmUpAsync

This method calls `warmUp` method on [CustomTabsClient](https://developer.android.com/reference/android/support/customtabs/CustomTabsClient.html#warmup(long))
for specified package.

**Platform:** android

```typescript
warmUpAsync(browserPackage: string): Promise<WebBrowserWarmUpResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `browserPackage` | `string` | Package of browser to be warmed up. If not set, preferred browser will be warmed. |

**Returns:** A promise which fulfils with `WebBrowserWarmUpResult` object.

### Types

#### AuthSessionOpenOptions

If there is no native AuthSession implementation available (which is the case on Android) the params inherited from
[`WebBrowserOpenOptions`](#webbrowseropenoptions) will be used in the browser polyfill. Otherwise, the browser parameters will be ignored.

**Type:** `unknown`

#### WebBrowserAuthSessionResult

**Type:** `WebBrowserRedirectResult | WebBrowserResult`

#### WebBrowserCompleteAuthSessionOptions

| Property | Type | Description |
| --- | --- | --- |
| `skipRedirectCheck` | `boolean` | Attempt to close the window without checking to see if the auth redirect matches the cached redirect URL. |

#### WebBrowserCompleteAuthSessionResult

| Property | Type | Description |
| --- | --- | --- |
| `message` | `string` | Additional description or reasoning of the result. |
| `type` | `'success' | 'failed'` | Type of the result. |

#### WebBrowserCoolDownResult

**Type:** `ServiceActionResult`

#### WebBrowserCustomTabsResults

| Property | Type | Description |
| --- | --- | --- |
| `browserPackages` | `string[]` | All packages recognized by `PackageManager` as capable of handling Custom Tabs. Empty array means there is no supporting browsers on device. |
| `defaultBrowserPackage` | `string` | Default package chosen by user, `null` if there is no such packages. Also `null` usually means, that user will be prompted to choose from available packages. |
| `preferredBrowserPackage` | `string` | Package preferred by `CustomTabsClient` to be used to handle Custom Tabs. It favors browser chosen by user as default, as long as it is present on both `browserPackages` and `servicePackages` lists. Only such browsers are considered as fully supporting Custom Tabs. It might be `null` when there is no such browser installed or when default browser is not in `servicePackages` list. |
| `servicePackages` | `string[]` | All packages recognized by `PackageManager` as capable of handling Custom Tabs Service. This service is used by [`warmUpAsync`](#webbrowserwarmupasyncbrowserpackage), [`mayInitWithUrlAsync`](#webbrowsermayinitwithurlasyncurl-browserpackage) and [`coolDownAsync`](#webbrowsercooldownasyncbrowserpackage). |

#### WebBrowserMayInitWithUrlResult

**Type:** `ServiceActionResult`

#### WebBrowserOpenOptions

| Property | Type | Description |
| --- | --- | --- |
| `browserPackage` | `string` | Package name of a browser to be used to handle Custom Tabs. List of available packages is to be queried by [`getCustomTabsSupportingBrowsers`](#webbrowsergetcustomtabssupportingbrowsersasync) method. |
| `controlsColor` | `string` | Tint color for controls in SKSafariViewController. Supports React Native [color formats](https://reactnative.dev/docs/colors). |
| `createTask` | `boolean` | A boolean determining whether the browser should open in a new task or in the same task as your app. |
| `dismissButtonStyle` | `'done' | 'close' | 'cancel'` | The style of the dismiss button. Should be one of: `done`, `close`, or `cancel`. |
| `enableBarCollapsing` | `boolean` | A boolean determining whether the toolbar should be hiding when a user scrolls the website. |
| `enableDefaultShareMenuItem` | `boolean` | A boolean determining whether a default share item should be added to the menu. |
| `presentationStyle` | `WebBrowserPresentationStyle` | The [presentation style](https://developer.apple.com/documentation/uikit/uiviewcontroller/1621355-modalpresentationstyle) of the browser window. |
| `readerMode` | `boolean` | A boolean determining whether Safari should enter Reader mode, if it is available. |
| `secondaryToolbarColor` | `string` | Color of the secondary toolbar. Supports React Native [color formats](https://reactnative.dev/docs/colors). |
| `showInRecents` | `boolean` | A boolean determining whether browsed website should be shown as separate entry in Android recents/multitasking view. Requires `createTask` to be `true` (default). |
| `showTitle` | `boolean` | A boolean determining whether the browser should show the title of website on the toolbar. |
| `toolbarColor` | `string` | Color of the toolbar. Supports React Native [color formats](https://reactnative.dev/docs/colors). |
| `windowFeatures` | `string | WebBrowserWindowFeatures` | Features to use with `window.open()`. |
| `windowName` | `string` | Name to assign to the popup window. |

#### WebBrowserRedirectResult

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'success'` | Type of the result. |
| `url` | `string` | - |

#### WebBrowserResult

| Property | Type | Description |
| --- | --- | --- |
| `type` | `WebBrowserResultType` | Type of the result. |

#### WebBrowserWarmUpResult

**Type:** `ServiceActionResult`

#### WebBrowserWindowFeatures

**Type:** `Record<string, number | boolean | string>`

### Enums

#### WebBrowserPresentationStyle

A browser presentation style. Its values are directly mapped to the [`UIModalPresentationStyle`](https://developer.apple.com/documentation/uikit/uiviewcontroller/1621355-modalpresentationstyle).

| Value | Description |
| --- | --- |
| `AUTOMATIC` | The default presentation style chosen by the system.
On older iOS versions, falls back to `WebBrowserPresentationStyle.FullScreen`. |
| `CURRENT_CONTEXT` | A presentation style where the browser is displayed over the app's content. |
| `FORM_SHEET` | A presentation style that displays the browser centered in the screen. |
| `FULL_SCREEN` | A presentation style in which the presented browser covers the screen. |
| `OVER_CURRENT_CONTEXT` | A presentation style where the browser is displayed over the app's content. |
| `OVER_FULL_SCREEN` | A presentation style in which the browser view covers the screen. |
| `PAGE_SHEET` | A presentation style that partially covers the underlying content. |
| `POPOVER` | A presentation style where the browser is displayed in a popover view. |

#### WebBrowserResultType

| Value | Description |
| --- | --- |
| `CANCEL` | - |
| `DISMISS` | - |
| `LOCKED` | - |
| `OPENED` | - |
