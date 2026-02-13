---
name: crypto
description: Cryptographic functions for hashing and random values.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Crypto

A universal library for crypto operations.

**Platforms:** android, ios, tvos, web

**Package:** `expo-crypto`

`expo-crypto` enables you to hash data in an equivalent manner to the Node.js core `crypto` API.

## Quick Start

```jsx
import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';

export default function App() {
  const [hash, setHash] = useState('');

  useEffect(() => {
    const digest = async () => {
      if (Platform.OS === 'web' && !window.isSecureContext) {
        setHash('WebCrypto API is not available in non-secure contexts.');
        return;
      }
      try {
        const digest = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          'Hello, world!'
        );
        setHash(digest);
      } catch (error) {
        setHash(`Error: ${error.message}`);
      }
    };
    digest();
  }, []);

  return (
    <View style={styles.container}>
      <Text>SHA256 Hash:</Text>
      <Text style={styles.hash}>{hash}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hash: {
    marginTop: 8,
    fontFamily: 'monospace',
  },
});
```

## When to Use

Use `expo-crypto` when you need to perform cryptographic operations like hashing strings or generating random values in your Expo app. It's useful for tasks like verifying data integrity, creating unique identifiers, or implementing secure authentication methods.

## Common Pitfalls

*   **Problem:** Using on the web in a non-secure context. The Web Crypto API, which `expo-crypto` uses on the web, is only available in secure contexts (HTTPS or localhost).
*   **Solution:** Check for a secure context before calling crypto functions on the web.

    ```jsx
    import { Platform } from 'react-native';
    import * as Crypto from 'expo-crypto';

    async function getHash() {
      if (Platform.OS === 'web' && !window.isSecureContext) {
        console.warn('Crypto API not available in non-secure contexts on the web.');
        return null;
      }
      return await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'data');
    }
    ```

*   **Problem:** Incorrectly handling `Promise` results. Many functions in `expo-crypto` are `async` and return `Promise`s. Forgetting to use `await` or `.then()` will result in getting a `Promise` object instead of the value.
*   **Solution:** Always use `await` when calling async crypto functions.

    ```jsx
    // Incorrect
    const digest = Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'data');
    console.log(digest); // Logs a Promise, not the hash

    // Correct
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, 'data');
    console.log(digest); // Logs the hex-encoded hash
    ```

## Common Patterns

*   **Generating a UUID:** Use `randomUUID()` to generate a standard v4 UUID, ideal for unique identifiers.

    ```jsx
    import * as Crypto from 'expo-crypto';

    const newId = Crypto.randomUUID();
    console.log(newId); // e.g., "4c6a5e4d-4a68-4b9c-8b0a-3a0d9b5d9c3d"
    ```

*   **Generating Random Bytes:** Use `getRandomBytesAsync()` to generate cryptographically secure random bytes, which can be used for creating salts or initialization vectors.

    ```jsx
    import * as Crypto from 'expo-crypto';
    import { encode as btoa } from 'base-64';

    async function generateRandomSalt() {
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      // Encode bytes to a Base64 string to safely store or transmit it
      const salt = btoa(String.fromCharCode.apply(null, randomBytes));
      console.log(salt);
      return salt;
    }
    ```

## Installation

```bash
$ npx expo install expo-crypto
```

## Usage

```jsx
import { useEffect } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import * as Crypto from 'expo-crypto';

export default function App() {
  useEffect(() => {
    (async () => {
      const digest = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        'GitHub stars are neat 🌟'
      );
      console.log('Digest: ', digest);
      /* Some crypto operation... */
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Crypto Module Example</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

## API

```js
import * as Crypto from 'expo-crypto';
```

## Error codes

| Code                     | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `ERR_CRYPTO_UNAVAILABLE` | **Web Only.** Access to the WebCrypto API is restricted to secure origins (localhost/https). |
| `ERR_CRYPTO_DIGEST`      | An invalid encoding type provided.                                                           |

## API Reference

### Methods

#### digest

The `digest()` method of `Crypto` generates a digest of the supplied `TypedArray` of bytes `data` with the provided digest `algorithm`.
A digest is a short fixed-length value derived from some variable-length input. **Cryptographic digests** should exhibit _collision-resistance_,
meaning that it's very difficult to generate multiple inputs that have equal digest values.
On web, this method can only be called from a secure origin (HTTPS) otherwise, an error will be thrown.

```typescript
digest(algorithm: CryptoDigestAlgorithm, data: BufferSource): Promise<ArrayBuffer>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `algorithm` | `CryptoDigestAlgorithm` | The cryptographic hash function to use to transform a block of data into a fixed-size output. |
| `data` | `BufferSource` | The value that will be used to generate a digest. |

**Returns:** A Promise which fulfills with an ArrayBuffer representing the hashed input.

#### digestStringAsync
The `digestStringAsync()` method of `Crypto` generates a digest of the supplied `data` string with the provided digest `algorithm`.
A digest is a short fixed-length value derived from some variable-length input. **Cryptographic digests** should exhibit _collision-resistance_,
meaning that it's very difficult to generate multiple inputs that have equal digest values.
You can specify the returned string format as one of `CryptoEncoding`. By default, the resolved value will be formatted as a `HEX` string.
On web, this method can only be called from a secure origin (HTTPS) otherwise, an error will be thrown.

```typescript
digestStringAsync(algorithm: CryptoDigestAlgorithm, data: string, options: CryptoDigestOptions): Promise<Digest>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `algorithm` | `CryptoDigestAlgorithm` | The cryptographic hash function to use to transform a block of data into a fixed-size output. |
| `data` | `string` | The value that will be used to generate a digest. |
| `options` | `CryptoDigestOptions` | Format of the digest string. Defaults to: `CryptoDigestOptions.HEX`. |

**Returns:** Return a Promise which fulfills with a value representing the hashed input.

#### getRandomBytes

Generates completely random bytes using native implementations. The `byteCount` property
is a `number` indicating the number of bytes to generate in the form of a `Uint8Array`.
Falls back to `Math.random` during development to prevent issues with React Native Debugger.

```typescript
getRandomBytes(byteCount: number): Uint8Array
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `byteCount` | `number` | A number within the range from `0` to `1024`. Anything else will throw a `TypeError`. |

**Returns:** An array of random bytes with the same length as the `byteCount`.

#### getRandomBytesAsync

Generates completely random bytes using native implementations. The `byteCount` property
is a `number` indicating the number of bytes to generate in the form of a `Uint8Array`.

```typescript
getRandomBytesAsync(byteCount: number): Promise<Uint8Array>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `byteCount` | `number` | A number within the range from `0` to `1024`. Anything else will throw a `TypeError`. |

**Returns:** A promise that fulfills with an array of random bytes with the same length as the `byteCount`.

#### getRandomValues

The `getRandomValues()` method of `Crypto` fills a provided `TypedArray` with cryptographically secure random values.

```typescript
getRandomValues(typedArray: T): T
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `typedArray` | `T` | An integer based [`TypedArray`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypedArray) to fill with cryptographically secure random values. It modifies the input array in place. |

**Returns:** The input array filled with cryptographically secure random values.

#### randomUUID

The `randomUUID()` method returns a unique identifier based on the V4 UUID spec (RFC4122).
It uses cryptographically secure random values to generate the UUID.

```typescript
randomUUID(): string
```

**Returns:** A string containing a newly generated UUIDv4 identifier

### Types


#### CryptoDigestOptions

| Property | Type | Description |
| --- | --- | --- |
| `encoding` | `CryptoEncoding` | Format the digest is returned in. |

#### Digest

**Type:** `string`

### Enums

#### CryptoDigestAlgorithm

[`Cryptographic hash function`](https://developer.mozilla.org/en-US/docs/Glossary/Cryptographic_hash_function)

| Value | Description |
| --- | --- |
| `MD2` | `128` bits. |
| `MD4` | `128` bits. |
| `MD5` | `128` bits. |
| `SHA1` | `160` bits. |
| `SHA256` | `256` bits. Collision Resistant. |
| `SHA384` | `384` bits. Collision Resistant. |
| `SHA512` | `512` bits. Collision Resistant. |

#### CryptoEncoding

| Value | Description |
| --- | --- |
| `BASE64` | Has trailing padding. Does not wrap lines. Does not have a trailing newline. |
| `HEX` | - |
