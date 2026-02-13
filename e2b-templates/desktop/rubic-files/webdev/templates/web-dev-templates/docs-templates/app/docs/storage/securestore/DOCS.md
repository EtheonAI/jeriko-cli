---
name: securestore
description: Securely store key-value data using device keychain/keystore.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# SecureStore

A library that provides a way to encrypt and securely store key-value pairs locally on the device.

**Platforms:** android, ios, tvos (NOT web)

**Package:** `expo-secure-store`

## Quick Start

```tsx
import * as SecureStore from 'expo-secure-store';

// Save a value
await SecureStore.setItemAsync('auth_token', 'your-secret-token');

// Get a value
const token = await SecureStore.getItemAsync('auth_token');

// Delete a value
await SecureStore.deleteItemAsync('auth_token');
```

## When to Use SecureStore vs AsyncStorage vs SQLite

| Data Type | Use | Example |
|-----------|-----|---------|
| **Sensitive credentials** | SecureStore | Auth tokens, API keys, passwords |
| **User preferences** | AsyncStorage | Theme, language, onboarding status |
| **Structured app data** | SQLite | Tasks, messages, user content |
| **Large data (>2KB)** | SQLite/FileSystem | Documents, images, large JSON |

**Decision Guide:**
- **SecureStore**: Small, sensitive key-value data that needs encryption
- **AsyncStorage**: Non-sensitive app settings and preferences
- **SQLite**: Structured data with relationships, queries, or large datasets

## Common Pitfalls

### 1. Web Platform Not Supported

**Problem:** SecureStore throws errors on web platform.

**Solution:** Use platform check or provide web fallback:

```tsx
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

async function saveSecurely(key: string, value: string) {
  if (Platform.OS === 'web') {
    // Fallback to localStorage (NOT secure, but functional)
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getSecurely(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}
```

### 2. Value Size Limit

**Problem:** Large values (>2KB) may fail on some iOS versions.

**Solution:** Keep values small. For larger data, store a reference and use FileSystem:

```tsx
// ❌ Wrong - may fail with large data
await SecureStore.setItemAsync('user_data', JSON.stringify(largeObject));

// ✅ Correct - store only sensitive parts
await SecureStore.setItemAsync('auth_token', user.token);
// Store non-sensitive data elsewhere
await AsyncStorage.setItem('user_profile', JSON.stringify(user.profile));
```

### 3. Data Lost on Android Uninstall

**Problem:** SecureStore data is deleted when app is uninstalled on Android (but persists on iOS).

**Solution:** Don't rely on SecureStore for irreplaceable data. Always have server-side backup for critical data.

### 4. Biometric Data Becomes Inaccessible

**Problem:** Data stored with `requireAuthentication: true` becomes inaccessible if user changes biometric settings.

**Solution:** Handle the error gracefully and prompt user to re-authenticate:

```tsx
try {
  const value = await SecureStore.getItemAsync('protected_data', {
    requireAuthentication: true,
  });
} catch (error) {
  // Biometrics changed - data is lost
  // Prompt user to log in again
  showLoginScreen();
}
```

### 5. Synchronous API Blocking UI

**Problem:** Using `getItem` (sync) blocks the JS thread.

**Solution:** Prefer async methods:

```tsx
// ❌ Avoid - blocks UI
const token = SecureStore.getItem('auth_token');

// ✅ Prefer - non-blocking
const token = await SecureStore.getItemAsync('auth_token');
```

## Common Patterns

### Auth Token Storage

```tsx
const AUTH_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const tokenStorage = {
  async saveTokens(accessToken: string, refreshToken: string) {
    await SecureStore.setItemAsync(AUTH_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  },

  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(AUTH_TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
  },

  async clearTokens() {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  },
};
```

### Biometric-Protected Storage

```tsx
async function saveWithBiometric(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    requireAuthentication: true,
    authenticationPrompt: 'Authenticate to save sensitive data',
  });
}

async function getWithBiometric(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key, {
      requireAuthentication: true,
      authenticationPrompt: 'Authenticate to access sensitive data',
    });
  } catch (error) {
    // Handle biometric failure or data invalidation
    return null;
  }
}
```

### Cross-Platform Secure Storage Hook

```tsx
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export function useSecureStorage() {
  const setItem = async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      // Web fallback - consider using a more secure solution
      sessionStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  };

  const getItem = async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return sessionStorage.getItem(key);
    }
    return SecureStore.getItemAsync(key);
  };

  const removeItem = async (key: string) => {
    if (Platform.OS === 'web') {
      sessionStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  };

  return { setItem, getItem, removeItem };
}
```

## Installation

```bash
$ npx expo install expo-secure-store
```

## Configuration in app config

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-secure-store",
        {
          "configureAndroidBackup": true,
          "faceIDPermission": "Allow $(PRODUCT_NAME) to access your Face ID biometric data."
        }
      ]
    ]
  }
}
```

## Platform Behavior

### Android
- Values stored in `SharedPreferences`, encrypted with Android Keystore
- **Data deleted on app uninstall**

### iOS
- Values stored in Keychain as `kSecClassGenericPassword`
- **Data persists across app uninstalls** (same bundle ID)
- Can set `kSecAttrAccessible` for access control

## API

```js
import * as SecureStore from 'expo-secure-store';
```

## API Reference

### Methods

#### setItemAsync

Store a key-value pair.

```typescript
setItemAsync(key: string, value: string, options?: SecureStoreOptions): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `key` | `string` | Key to store the value under. Alphanumeric, `.`, `-`, `_` allowed. |
| `value` | `string` | The value to store. |
| `options` | `SecureStoreOptions` | Optional configuration. |

#### getItemAsync

Read a stored value.

```typescript
getItemAsync(key: string, options?: SecureStoreOptions): Promise<string | null>
```

**Returns:** The stored value, or `null` if not found.

#### deleteItemAsync

Delete a stored value.

```typescript
deleteItemAsync(key: string, options?: SecureStoreOptions): Promise<void>
```

#### setItem (Sync)

Synchronously store a value. **Blocks JS thread.**

```typescript
setItem(key: string, value: string, options?: SecureStoreOptions): void
```

#### getItem (Sync)

Synchronously read a value. **Blocks JS thread.**

```typescript
getItem(key: string, options?: SecureStoreOptions): string | null
```

#### isAvailableAsync

Check if SecureStore is available on this device.

```typescript
isAvailableAsync(): Promise<boolean>
```

#### canUseBiometricAuthentication (Android)

Check if biometric authentication can be used.

```typescript
canUseBiometricAuthentication(): boolean
```

### Types

#### SecureStoreOptions

| Property | Type | Description |
| --- | --- | --- |
| `keychainAccessible` | `KeychainAccessibilityConstant` | iOS only. When the value can be accessed. |
| `keychainService` | `string` | iOS only. Custom keychain service name. |
| `requireAuthentication` | `boolean` | Require biometric auth to access. |
| `authenticationPrompt` | `string` | Message shown during biometric prompt. |

#### KeychainAccessibilityConstant

| Value | Description |
| --- | --- |
| `AFTER_FIRST_UNLOCK` | Accessible after device unlocked once since boot. |
| `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` | Same, but not transferred to new device. |
| `ALWAYS` | Always accessible (deprecated). |
| `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY` | Only when device has passcode set. |
| `WHEN_UNLOCKED` | Only when device is unlocked. Default. |
| `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Same, but not transferred to new device. |
