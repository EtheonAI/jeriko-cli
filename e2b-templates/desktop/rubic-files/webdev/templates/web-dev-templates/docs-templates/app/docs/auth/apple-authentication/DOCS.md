---
name: apple-authentication
description: Sign in with Apple authentication.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# AppleAuthentication

A library that provides Sign-in with Apple capability for iOS.

**Platforms:** ios, tvos

**Package:** `expo-apple-authentication`

`expo-apple-authentication` provides Apple authentication for iOS. It does not yet support Android or web.

Any app that includes third-party authentication options **must** provide Apple authentication as an option to comply with App Store Review guidelines. For more information, see Apple authentication on the [Sign In with Apple](https://developer.apple.com/sign-in-with-apple/) website.

## Quick Start

Here is a minimal example of how to use the `expo-apple-authentication` library:

```jsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { View, StyleSheet } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={5}
        style={styles.button}
        onPress={async () => {
          try {
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            // signed in
            console.log(credential);
          } catch (e) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
              // handle that the user canceled the sign-in flow
            } else {
              // handle other errors
            }
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 200,
    height: 44,
  },
});
```

## When to Use

Use `expo-apple-authentication` when you need to provide a Sign in with Apple option in your iOS app. This is required by Apple's App Store Review Guidelines if your app uses any other third-party or social login service. It provides a fast, secure, and familiar login experience for users on iOS devices.

## Common Pitfalls

### User details are only sent once

**Problem:** You only receive the user's full name and email the very first time they sign into your app. Subsequent sign-ins will return `null` for these fields.

**Solution:** You must securely store the user's details (e.g., on your server or using `expo-secure-store`) the first time you receive them. Use the `user` identifier from the credential to associate the user with their data on subsequent logins.

### Authentication fails in TestFlight or production

**Problem:** Apple Sign-In works correctly in Expo Go and the iOS simulator but fails when the app is deployed to TestFlight or the App Store.

**Solution:** This is typically a configuration issue. Ensure that:
1.  The `ios.bundleIdentifier` in your `app.json` matches the one registered in the Apple Developer Console.
2.  The "Sign In with Apple" capability is enabled for your app's identifier in the Apple Developer Console.
3.  You have set `\"usesAppleSignIn\": true` in the `ios` section of your `app.json`.

### `getCredentialStateAsync` fails on the simulator

**Problem:** Calling `getCredentialStateAsync` throws an error when running on the iOS simulator.

**Solution:** This method is not fully supported on the simulator and must be tested on a real iOS device.

## Common Patterns

### Conditionally rendering the sign-in button

Since Sign in with Apple is only available on iOS, you should check for availability before rendering the button.

```jsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform, View } from 'react-native';

function AppleSignInButton() {
  if (Platform.OS !== 'ios') {
    return null;
  }

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      // ... other props
    />
  );
}
```

### Checking user authentication state

You can check if a user is already authenticated with your app on a given device.

```jsx
import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';

function useAppleAuthentication() {
  const [credential, setCredential] = useState(null);

  useEffect(() => {
    const checkCredentialState = async () => {
      // Replace with the actual user identifier you have stored
      const user = 'USER_IDENTIFIER_FROM_STORAGE';
      try {
        const credentialState = await AppleAuthentication.getCredentialStateAsync(user);
        if (credentialState === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) {
          // User is still authorized
        }
      } catch (e) {
        console.error(e);
      }
    };

    checkCredentialState();
  }, []);

  // ... rest of your authentication logic
}
```

## Installation

```bash
$ npx expo install expo-apple-authentication
```

## Configuration in app config

You can configure `expo-apple-authentication` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

### Setup iOS project

To enable the **Sign In with Apple** capability in your app, set the [`ios.usesAppleSignIn`](../config/app/#usesapplesignin) property to `true` in your project's app config:

**Example:** app.json
```json
{
  "expo": {
    "ios": {
      "usesAppleSignIn": true
    }
  }
}
```

Running [EAS Build](/build/introduction) locally will use [iOS capabilities signing](/build-reference/ios-capabilities) to enable the required capabilities before building.

**Example:** app.json
```json
{
  "expo": {
    "plugins": ["expo-apple-authentication"]
  }
}
```

Apps that don't use [EAS Build](/build/introduction) must [manually configure](/build-reference/ios-capabilities#manual-setup) the **Apple Sign In** capability for their bundle identifier.

If you enable the **Apple Sign In** capability through the [Apple Developer Console](/build-reference/ios-capabilities#apple-developer-console), then be sure to add the following entitlements in your **ios/[app]/[app].entitlements** file:

```xml
<key>com.apple.developer.applesignin</key>
<array>
  <string>Default</string>
</array>
```

Also, set `CFBundleAllowMixedLocalizations` to `true` in your **ios/[app]/Info.plist** to ensure the sign-in button uses the device locale.

## Usage

```jsx

export default function App() {
  return (
    <AppleAuthentication.AppleAuthenticationButton
        buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
        buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
        cornerRadius={5}
        style={styles.button}
        onPress={async () => {
          try {
            const credential = await AppleAuthentication.signInAsync({
              requestedScopes: [
                AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                AppleAuthentication.AppleAuthenticationScope.EMAIL,
              ],
            });
            // signed in
          } catch (e) {
            if (e.code === 'ERR_REQUEST_CANCELED') {
              // handle that the user canceled the sign-in flow
            } else {
              // handle other errors
            }
          }
        }}
      />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 200,
    height: 44,
  },
});
```

## Development and testing
You can test this library in Expo Go on iOS without following any of the instructions above.
However, you'll need to add the config plugin to use this library if you are using EAS Build.
When you sign into Expo Go, the identifiers and values you receive will likely be different than what you'll receive in standalone apps.

You can do limited testing of this library on the iOS Simulator. However, not all methods will behave the same as on a device,
so we highly recommend testing on a real device when possible while developing.

## Verifying the Response from Apple

Apple's response includes a signed JWT with information about the user. To ensure that the response came from Apple,
you can cryptographically verify the signature with Apple's public key, which is published at https://appleid.apple.com/auth/keys.
This process is not specific to Expo.

## API

```js

```

## Error codes

Most of the error codes match the official [Apple Authorization errors](https://developer.apple.com/documentation/authenticationservices/asauthorizationerror/code).

| Code                        | Description                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------- |
| ERR_INVALID_OPERATION       | An invalid authorization operation has been performed.                              |
| ERR_INVALID_RESPONSE        | The authorization request received an invalid response.                             |
| ERR_INVALID_SCOPE           | An invalid [`AppleAuthenticationScope`](#appleauthenticationscope) was passed in.   |
| ERR_REQUEST_CANCELED        | The user canceled the authorization attempt.                                        |
| ERR_REQUEST_FAILED          | The authorization attempt failed. See the error message for additional information. |
| ERR_REQUEST_NOT_HANDLED     | The authorization request wasn't correctly handled.                                 |
| ERR_REQUEST_NOT_INTERACTIVE | The authorization request isn't interactive.                                        |
| ERR_REQUEST_UNKNOWN         | The authorization attempt failed for an unknown reason.                             |

## API Reference

### Methods

#### addRevokeListener

```typescript
addRevokeListener(listener: () => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `() => void` | - |

#### AppleAuthenticationButton

This component displays the proprietary "Sign In with Apple" / "Continue with Apple" button on
your screen. The App Store Guidelines require you to use this component to start the
authentication process instead of a custom button. Limited customization of the button is
available via the provided properties.

You should only attempt to render this if [`AppleAuthentication.isAvailableAsync()`](#appleauthenticationisavailableasync)
resolves to `true`. This component will render nothing if it is not available, and you will get
a warning in development mode (`__DEV__ === true`).

The properties of this component extend from `View`; however, you should not attempt to set
`backgroundColor` or `borderRadius` with the `style` property. This will not work and is against
the App Store Guidelines. Instead, you should use the `buttonStyle` property to choose one of the
predefined color styles and the `cornerRadius` property to change the border radius of the
button.

Make sure to attach height and width via the style props as without these styles, the button will
not appear on the screen.

```typescript
AppleAuthenticationButton(__namedParameters: AppleAuthenticationButtonProps): null | Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `AppleAuthenticationButtonProps` | - |

#### formatFullName
Creates a locale-aware string representation of a person's name from an object representing the tokenized portions of a user's full name

```typescript
formatFullName(fullName: AppleAuthenticationFullName, formatStyle: AppleAuthenticationFullNameFormatStyle): string
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `fullName` | `AppleAuthenticationFullName` | The full name object with the tokenized portions |
| `formatStyle` | `AppleAuthenticationFullNameFormatStyle` | The style in which the name should be formatted |

**Returns:** A locale-aware string representation of a person's name

#### getCredentialStateAsync

Queries the current state of a user credential, to determine if it is still valid or if it has been revoked.
> **Note:** This method must be tested on a real device. On the iOS simulator it always throws an error.

```typescript
getCredentialStateAsync(user: string): Promise<AppleAuthenticationCredentialState>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `user` | `string` | The unique identifier for the user whose credential state you'd like to check. This should come from the user field of an [`AppleAuthenticationCredential`](#appleauthenticationcredentialstate) object. |

**Returns:** A promise that fulfills with an [`AppleAuthenticationCredentialState`](#appleauthenticationcredentialstate)
value depending on the state of the credential.

#### isAvailableAsync

Determine if the current device's operating system supports Apple authentication.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise that fulfills with `true` if the system supports Apple authentication, and `false` otherwise.

#### refreshAsync

An operation that refreshes the logged-in user’s credentials.
Calling this method will show the sign in modal before actually refreshing the user credentials.

```typescript
refreshAsync(options: AppleAuthenticationRefreshOptions): Promise<AppleAuthenticationCredential>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `AppleAuthenticationRefreshOptions` | An [`AppleAuthenticationRefreshOptions`](#appleauthenticationrefreshoptions) object |

**Returns:** A promise that fulfills with an [`AppleAuthenticationCredential`](#appleauthenticationcredential)
object after a successful authentication, and rejects with `ERR_REQUEST_CANCELED` if the user cancels the
refresh operation.

#### signInAsync

Sends a request to the operating system to initiate the Apple authentication flow, which will
present a modal to the user over your app and allow them to sign in.

You can request access to the user's full name and email address in this method, which allows you
to personalize your UI for signed in users. However, users can deny access to either or both
of these options at runtime.

Additionally, you will only receive Apple Authentication Credentials the first time users sign
into your app, so you must store it for later use. It's best to store this information either
server-side, or using [SecureStore](), so that the data persists across app installs.
You can use [`AppleAuthenticationCredential.user`](#appleauthenticationcredential) to identify
users in your system on subsequent sign-ins.

```typescript
signInAsync(options: AppleAuthenticationSignInOptions): Promise<AppleAuthenticationCredential>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `AppleAuthenticationSignInOptions` | An [`AppleAuthenticationSignInOptions`](#appleauthenticationsigninoptions) object |

**Returns:** A promise that fulfills with an [`AppleAuthenticationCredential`](#appleauthenticationcredential)
object after a successful authentication, and rejects with an error if the user cancels the
authentication flow.

#### signOutAsync

An operation that signs the user out of the app.

This method is not supported on the iOS simulator. You must test it on a real device.

```typescript
signOutAsync(options: AppleAuthenticationSignOutOptions): Promise<AppleAuthenticationCredential>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `AppleAuthenticationSignOutOptions` | An [`AppleAuthenticationSignOutOptions`](#appleauthenticationsignoutoptions) object |

**Returns:** A promise that fulfills with an [`AppleAuthenticationCredential`](#appleauthenticationcredential)
object after a successful sign out, and rejects with an error if the user cancels the sign out
flow.

### Types

#### AppleAuthenticationButtonProps
| Property | Type | Description |
| --- | --- | --- |
| `buttonStyle` | `AppleAuthenticationButtonStyle` | The style of the button. |
| `buttonType` | `AppleAuthenticationButtonType` | The type of the button. |
| `cornerRadius` | `number` | The corner radius of the button. |
| `onPress` | `() => void` | A callback to be invoked when the user presses the button. |
| `style` | `StyleProp<ViewStyle>` | The style of the button. |

#### AppleAuthenticationCredential
| Property | Type | Description |
| --- | --- | --- |
| `email` | `string` | The user's email address. This is only available on the first sign-in. |
| `fullName` | `AppleAuthenticationFullName` | The user's full name. This is only available on the first sign-in. |
| `identityToken` | `string` | A JSON Web Token (JWT) that contains the user's identity information. |
| `state` | `string` | The state that was passed in the `signInAsync` or `refreshAsync` call. |
| `user` | `string` | A unique identifier for the user. |

#### AppleAuthenticationFullName
| Property | Type | Description |
| --- | --- | --- |
| `familyName` | `string` | The user's family name. |
| `givenName` | `string` | The user's given name. |
| `middleName` | `string` | The user's middle name. |
| `namePrefix` | `string` | The user's name prefix. |
| `nameSuffix` | `string` | The user's name suffix. |
| `nickname` | `string` | The user's nickname. |

#### AppleAuthenticationRefreshOptions
| Property | Type | Description |
| --- | --- | --- |
| `requestedScopes` | `AppleAuthenticationScope[]` | Array of user information scopes to which your app is requesting access. Note that the user can choose to deny your app access to any scope at the time of logging in. You will still need to handle `null` values for any scopes you request. Additionally, note that the requested scopes will only be provided to you the first time each user signs into your app; in subsequent requests they will be `null`. Defaults to `[]` (no scopes). |
| `state` | `string` | An arbitrary string that is returned unmodified in the corresponding credential after a successful authentication. This can be used to verify that the response was from the request you made and avoid replay attacks. More information on this property is available in the OAuth 2.0 protocol [RFC6749](https://tools.ietf.org/html/rfc6749#section-10.12). |
| `user` | `string` | - |
#### AppleAuthenticationSignInOptions
The options you can supply when making a call to [`AppleAuthentication.signInAsync()`](#appleauthenticationsigninasyncoptions).
None of these options are required.
| Property | Type | Description |
| --- | --- | --- |
| `nonce` | `string` | An arbitrary string that is used to prevent replay attacks. See more information on this in the [OpenID Connect specification](https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowSteps). |
| `requestedScopes` | `AppleAuthenticationScope[]` | Array of user information scopes to which your app is requesting access. Note that the user can choose to deny your app access to any scope at the time of logging in. You will still need to handle `null` values for any scopes you request. Additionally, note that the requested scopes will only be provided to you the first time each user signs into your app; in subsequent requests they will be `null`. Defaults to `[]` (no scopes). |
| `state` | `string` | An arbitrary string that is returned unmodified in the corresponding credential after a successful authentication. This can be used to verify that the response was from the request you made and avoid replay attacks. More information on this property is available in the OAuth 2.0 protocol [RFC6749](https://tools.ietf.org/html/rfc6749#section-10.12). |
#### AppleAuthenticationSignOutOptions
The options you can supply when making a call to [`AppleAuthentication.signOutAsync()`](#appleauthenticationsignoutasyncoptions).
You must include the ID string of the user to sign out.
| Property | Type | Description |
| --- | --- | --- |
| `state` | `string` | An arbitrary string that is returned unmodified in the corresponding credential after a successful authentication. This can be used to verify that the response was from the request you made and avoid replay attacks. More information on this property is available in the OAuth 2.0 protocol [RFC6749](https://tools.ietf.org/html/rfc6749#section-10.12). |
| `user` | `string` | - |
### Enums
#### AppleAuthenticationButtonStyle
An enum whose values control which pre-defined color scheme to use when rendering an [`AppleAuthenticationButton`](#appleauthenticationbutton).
| Value | Description |
| --- | --- |
| `BLACK` | Black button with white text. |
| `WHITE` | White button with black text. |
| `WHITE_OUTLINE` | White button with a black outline and black text. |
#### AppleAuthenticationButtonType
An enum whose values control which pre-defined text to use when rendering an [`AppleAuthenticationButton`](#appleauthenticationbutton).
| Value | Description |
| --- | --- |
| `CONTINUE` | "Continue with Apple" |
| `SIGN_IN` | "Sign in with Apple" |
| `SIGN_UP` | "Sign up with Apple" |
#### AppleAuthenticationCredentialState
An enum whose values specify state of the credential when checked with [`AppleAuthentication.getCredentialStateAsync()`](#appleauthenticationgetcredentialstateasyncuser).
| Value | Description |
| --- | --- |
| `AUTHORIZED` | - |
| `NOT_FOUND` | - |
| `REVOKED` | - |
| `TRANSFERRED` | - |
#### AppleAuthenticationOperation
| Value | Description |
| --- | --- |
| `IMPLICIT` | An operation that depends on the particular kind of credential provider. |
| `LOGIN` | - |
| `LOGOUT` | - |
| `REFRESH` | - |
#### AppleAuthenticationScope
An enum whose values specify scopes you can request when calling [`AppleAuthentication.signInAsync()`](#appleauthenticationsigninasyncoptions).
> Note that it is possible that you will not be granted all of the scopes which you request.
> You will still need to handle null values for any fields you request.
| Value | Description |
| --- | --- |
| `EMAIL` | - |
| `FULL_NAME` | - |
#### AppleAuthenticationUserDetectionStatus
An enum whose values specify the system's best guess for how likely the current user is a real person.
| Value | Description |
| --- | --- |
| `LIKELY_REAL` | The user appears to be a real person. |
| `UNKNOWN` | The system has not determined whether the user might be a real person. |
| `UNSUPPORTED` | The system does not support this determination and there is no data. |
