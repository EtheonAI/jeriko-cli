---
name: local-authentication
description: Biometric authentication using Face ID or fingerprint.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# LocalAuthentication

A library that provides functionality for implementing the Fingerprint API (Android) or FaceID and TouchID (iOS) to authenticate the user with a face or fingerprint scan.

**Platforms:** android, ios

**Package:** `expo-local-authentication`

## Quick Start

```tsx
import * as LocalAuthentication from 'expo-local-authentication';

async function authenticate() {
  // 1. Check if hardware exists
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    return { success: false, error: 'No biometric hardware' };
  }

  // 2. Check if biometrics are enrolled
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    return { success: false, error: 'No biometrics enrolled' };
  }

  // 3. Authenticate
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to continue',
  });

  return result;
}
```

## When to Use

Use biometric authentication for:
- Protecting sensitive data access (viewing passwords, financial info)
- Confirming destructive actions (delete account, large transfers)
- App unlock after timeout
- Authorizing payments or purchases

Do NOT use for:
- Every app launch (annoying UX)
- Non-sensitive actions
- As the only authentication method (always have fallback)

## Common Pitfalls

### 1. Not Checking Hardware/Enrollment First

**Problem:** Calling `authenticateAsync` without checking if biometrics are available causes confusing errors.

**Solution:** Always check hardware and enrollment before authenticating:

```tsx
// ❌ Wrong - may fail unexpectedly
const result = await LocalAuthentication.authenticateAsync();

// ✅ Correct - check first
const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();

if (hasHardware && isEnrolled) {
  const result = await LocalAuthentication.authenticateAsync();
}
```

### 2. FaceID Not Working in Expo Go

**Problem:** FaceID authentication fails or falls back to passcode in Expo Go.

**Solution:** FaceID requires a development build. Use `npx expo run:ios` or EAS Build.

### 3. Missing NSFaceIDUsageDescription

**Problem:** FaceID silently falls back to passcode without the permission description.

**Solution:** Add the config plugin or Info.plist entry:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID."
        }
      ]
    ]
  }
}
```

### 4. Not Handling User Cancellation

**Problem:** App crashes or behaves unexpectedly when user cancels authentication.

**Solution:** Always check the result and handle cancellation gracefully:

```tsx
const result = await LocalAuthentication.authenticateAsync();

if (!result.success) {
  if (result.error === 'user_cancel') {
    // User cancelled - don't show error, just return
    return;
  }
  // Handle other errors
  Alert.alert('Authentication Failed', result.warning);
}
```

### 5. No Fallback for Devices Without Biometrics

**Problem:** App becomes unusable on devices without biometric hardware.

**Solution:** Always provide an alternative authentication method:

```tsx
async function secureAction() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (hasHardware && isEnrolled) {
    const result = await LocalAuthentication.authenticateAsync();
    if (result.success) return performAction();
    if (result.error === 'user_cancel') return;
  }

  // Fallback to PIN/password
  showPinDialog();
}
```

## Common Patterns

### Protect Sensitive Action

Wrap any sensitive operation with biometric authentication:

```tsx
async function withBiometricAuth<T>(
  action: () => Promise<T>,
  options?: { fallbackToPin?: boolean }
): Promise<T | null> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();

  if (hasHardware && isEnrolled) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to continue',
      disableDeviceFallback: !options?.fallbackToPin,
    });

    if (result.success) {
      return action();
    }

    if (result.error === 'user_cancel') {
      return null;
    }

    throw new Error(result.warning || 'Authentication failed');
  }

  // No biometrics available - proceed or require alternative auth
  if (options?.fallbackToPin) {
    return action(); // Let device fallback handle it
  }

  return action(); // Or implement custom fallback
}

// Usage
const sensitiveData = await withBiometricAuth(
  () => fetchSensitiveData(),
  { fallbackToPin: true }
);
```

### App Lock on Resume

Lock the app after it's been in the background:

```tsx
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

export function useAppLock(timeoutMs = 60000) {
  const backgroundTime = useRef<number | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (state) => {
      if (state === 'background') {
        backgroundTime.current = Date.now();
      } else if (state === 'active' && backgroundTime.current) {
        const elapsed = Date.now() - backgroundTime.current;
        if (elapsed > timeoutMs) {
          setIsLocked(true);
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock app',
          });
          setIsLocked(!result.success);
        }
        backgroundTime.current = null;
      }
    });

    return () => subscription.remove();
  }, [timeoutMs]);

  return isLocked;
}
```

### Check Biometric Type

Show appropriate UI based on available biometric type:

```tsx
async function getBiometricType(): Promise<'face' | 'fingerprint' | 'none'> {
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'face';
  }
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'fingerprint';
  }
  return 'none';
}

// Usage in UI
const biometricType = await getBiometricType();
const buttonText = biometricType === 'face' 
  ? 'Unlock with Face ID' 
  : biometricType === 'fingerprint'
  ? 'Unlock with Fingerprint'
  : 'Enter PIN';
```

## Installation

```bash
$ npx expo install expo-local-authentication
```

## Configuration in app config

You can configure `expo-local-authentication` using its built-in config plugin.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-local-authentication",
        {
          "faceIDPermission": "Allow $(PRODUCT_NAME) to use Face ID."
        }
      ]
    ]
  }
}
```

## Known Limitations

### iOS

The FaceID authentication for iOS is not supported in Expo Go. You will need to create a development build to test FaceID.

## API

```js
import * as LocalAuthentication from 'expo-local-authentication';
```

## API Reference

### Methods

#### authenticateAsync

Attempts to authenticate via Fingerprint/TouchID (or FaceID if available on the device).

```typescript
authenticateAsync(options: LocalAuthenticationOptions): Promise<LocalAuthenticationResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `LocalAuthenticationOptions` | Configuration options for the authentication prompt |

**Returns:** Returns a promise which fulfils with `LocalAuthenticationResult`.

#### cancelAuthenticate

Cancels authentication flow.

**Platform:** android

```typescript
cancelAuthenticate(): Promise<void>
```

#### getEnrolledLevelAsync

Determine what kind of authentication is enrolled on the device.

```typescript
getEnrolledLevelAsync(): Promise<SecurityLevel>
```

**Returns:** Returns a promise which fulfils with `SecurityLevel`.

#### hasHardwareAsync

Determine whether a face or fingerprint scanner is available on the device.

```typescript
hasHardwareAsync(): Promise<boolean>
```

**Returns:** Returns a promise which fulfils with a `boolean` value indicating whether a face or fingerprint scanner is available on this device.

#### isEnrolledAsync

Determine whether the device has saved fingerprints or facial data to use for authentication.

```typescript
isEnrolledAsync(): Promise<boolean>
```

**Returns:** Returns a promise which fulfils to `boolean` value indicating whether the device has saved fingerprints or facial data for authentication.

#### supportedAuthenticationTypesAsync

Determine what kinds of authentications are available on the device.

```typescript
supportedAuthenticationTypesAsync(): Promise<AuthenticationType[]>
```

**Returns:** Returns a promise which fulfils to an array containing `AuthenticationType`s.

### Types

#### LocalAuthenticationOptions

| Property | Type | Description |
| --- | --- | --- |
| `biometricsSecurityLevel` | `'weak' \| 'strong'` | Sets the security class of biometric authentication to allow. |
| `cancelLabel` | `string` | Allows customizing the default `Cancel` label shown. |
| `disableDeviceFallback` | `boolean` | Disable fallback to device passcode. Defaults to `false`. |
| `fallbackLabel` | `string` | Customize the `Use Passcode` label. Empty string hides the button. |
| `promptMessage` | `string` | A message shown alongside the TouchID or FaceID prompt. |
| `promptDescription` | `string` | A description displayed in the middle of the authentication prompt. |
| `promptSubtitle` | `string` | A subtitle displayed below the prompt message. |
| `requireConfirmation` | `boolean` | Require user confirmation after authentication. Defaults to `true`. |

#### LocalAuthenticationResult

**Type:** `{ success: true } | { error: LocalAuthenticationError; success: false; warning: string }`

#### LocalAuthenticationError

**Type:** `'not_enrolled' | 'user_cancel' | 'app_cancel' | 'not_available' | 'lockout' | 'no_space' | 'timeout' | 'unable_to_process' | 'unknown' | 'system_cancel' | 'user_fallback' | 'invalid_context' | 'passcode_not_set' | 'authentication_failed'`

### Enums

#### AuthenticationType

| Value | Description |
| --- | --- |
| `FACIAL_RECOGNITION` | Indicates facial recognition support. |
| `FINGERPRINT` | Indicates fingerprint support. |
| `IRIS` | Indicates iris recognition support. |

#### SecurityLevel

| Value | Description |
| --- | --- |
| `BIOMETRIC_STRONG` | Strong biometric authentication (fingerprint, 3D face). |
| `BIOMETRIC_WEAK` | Weak biometric authentication (2D face unlock). |
| `NONE` | No enrolled authentication. |
| `SECRET` | Non-biometric authentication (PIN, Pattern). |
