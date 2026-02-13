---
name: blob
description: Handle binary data and file uploads.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Blob

A web standards-compliant Blob implementation for React Native.

**Platforms:** android, ios, web

**Package:** `expo-blob`

`expo-blob` provides a web standards-compliant Blob implementation for React Native that offers superior performance and works consistently across all platforms. It is more reliable compared to the implementation exported from `react-native`, unlike Blob from `react-native`, which has limitations with the `slice()` method and other Web API features.

## Quick Start

Here is a minimal example of creating a Blob and reading its content.

```tsx
import { Blob } from 'expo-blob';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

export default function BlobQuickStart() {
  const [blobContent, setBlobContent] = useState('');

  const handleCreateBlob = async () => {
    try {
      const blob = new Blob(['Hello, Blob!'], { type: 'text/plain' });
      const text = await blob.text();
      setBlobContent(`Size: ${blob.size}, Content: ${text}`);
    } catch (error) {
      setBlobContent('Failed to create blob.');
      console.error(error);
    }
  };

  return (
    <View>
      <Button title="Create Blob" onPress={handleCreateBlob} />
      <Text>{blobContent}</Text>
    </View>
  );
}
```

## When to Use

Use `expo-blob` when you need to handle binary data in a way that is consistent with web standards. It is especially useful for preparing data for network requests (like file uploads), handling binary responses from APIs, or when working with large data chunks that need to be sliced or processed.

## Common Pitfalls

### 1. Assuming Blobs are Synchronous
**Problem**: Many Blob operations (`text()`, `arrayBuffer()`) are asynchronous and return Promises. Forgetting to use `await` or `.then()` will result in getting a Promise object instead of the content.

**Solution**: Always use `await` when reading Blob content.

```tsx
// Incorrect
const blob = new Blob(['hello']);
const text = blob.text(); // text is a Promise, not a string

// Correct
const blob = new Blob(['hello']);
const text = await blob.text(); // text is "hello"
```

### 2. Incorrectly Creating Blobs from Other Data Types
**Problem**: The `Blob` constructor expects an array of `BlobPart` (strings, `ArrayBuffer`, etc.). Passing other data types directly, like a plain JavaScript object, will not serialize it as expected.

**Solution**: Serialize complex data to a string (like JSON) before creating the Blob.

```tsx
// Incorrect
const data = { id: 1, name: 'example' };
const blob = new Blob([data], { type: 'application/json' }); // This will not work as expected

// Correct
const data = { id: 1, name: 'example' };
const jsonString = JSON.stringify(data);
const blob = new Blob([jsonString], { type: 'application/json' });
```

### 3. Ignoring Blob Immutability
**Problem**: `Blob` objects are immutable. Methods like `slice()` do not modify the original blob but instead return a new one. Ignoring the return value means your intended changes are lost.

**Solution**: Always assign the result of `slice()` to a new variable.

```tsx
const blob = new Blob(['1234567890']);

// Incorrect
blob.slice(0, 5);

// Correct
const slicedBlob = blob.slice(0, 5);
console.log(await slicedBlob.text()); // "12345"
```
## Installation

```bash
$ npx expo install expo-blob
```

## Usage

### Basic usage (React component)

```tsx
import { Blob } from 'expo-blob';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';

export default function BlobExample() {
  const [blobInfo, setBlobInfo] = useState<string>('');

  const createBlob = async () => {
    const blob = new Blob(['Hello, World!'], { type: 'text/plain' });
    const text = await blob.text();
    setBlobInfo(`Size: ${blob.size} bytes, Text: ${text}`);
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Button title="Create Blob" onPress={createBlob} />
      {blobInfo ? <Text style={{ marginTop: 20 }}>{blobInfo}</Text> : null}
    </View>
  );
}
```

### Basic blob creation

```typescript
import { Blob } from 'expo-blob';

// Create an empty blob
const emptyBlob = new Blob();

// Create a blob from text
const textBlob = new Blob(['Hello, World!'], { type: 'text/plain' });

// Create a blob from binary data
const binaryBlob = new Blob([new Uint8Array([1, 2, 3, 4])], {
  type: 'application/octet-stream',
});

// Create a blob from mixed content
const mixedBlob = new Blob(
  [
    'Text content',
    new Uint8Array([65, 66, 67]), // ABC in ASCII
    'More text',
  ],
  { type: 'text/plain' }
);
```

### Blob properties

```typescript
const blob = new Blob(['Hello, World!'], { type: 'text/plain' });

console.log(blob.size); // 13 (bytes)
console.log(blob.type); // "text/plain"
```

### Reading blob content

```typescript
const blob = new Blob(['Hello, World!'], { type: 'text/plain' });

// Read as text
const text = await blob.text();
console.log(text); // "Hello, World!"

// Read as bytes
const bytes = await blob.bytes();
console.log(bytes); // Uint8Array(13) [72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33]

// Read as ArrayBuffer
const arrayBuffer = await blob.arrayBuffer();
console.log(arrayBuffer); // ArrayBuffer(13)
```

### Slicing blobs

```typescript
const blob = new Blob(['Hello, World!'], { type: 'text/plain' });

// Slice from position 0 to 5
const slice1 = blob.slice(0, 5);
console.log(await slice1.text()); // "Hello"

// Slice from position 7 to end
const slice2 = blob.slice(7);
console.log(await slice2.text()); // "World!"

// Slice with custom type
const slice3 = blob.slice(0, 5, 'text/html');
console.log(slice3.type); // "text/html"
```

### Streaming

```typescript
const blob = new Blob(['Large content...'], { type: 'text/plain' });

// Create a readable stream
const stream = blob.stream();
const reader = stream.getReader();

// Read chunks
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  console.log('Chunk:', value);
}
```

## Common patterns

### Creating a Blob from JSON

```tsx
import { Blob } from 'expo-blob';

export function createJSONBlob(data: unknown): Blob {
  const jsonString = JSON.stringify(data, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
}
```

### File upload with Blob + FormData

```tsx
import { Blob } from 'expo-blob';
import * as ImagePicker from 'expo-image-picker';

export async function uploadPickedImage(): Promise<void> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 1,
  });

  if (result.canceled || !result.assets[0]) return null;

  // In Expo, `fetch(uri)` can be used to read a local file as a Blob.
  const response = await fetch(result.assets[0].uri);
  const blob: Blob = await response.blob();

  const formData = new FormData();
  formData.append('image', blob, 'image.jpg');

  await fetch('https://api.example.com/upload', {
    method: 'POST',
    body: formData,
  });
}
```

### Splitting large Blobs into chunks

```tsx
import { Blob } from 'expo-blob';

export function splitBlob(blob: Blob, chunkSize: number): Blob[] {
  const chunks: Blob[] = [];
  let offset = 0;

  while (offset < blob.size) {
    chunks.push(blob.slice(offset, offset + chunkSize));
    offset += chunkSize;
  }

  return chunks;
}
```

### Merging Blobs

```tsx
import { Blob } from 'expo-blob';

export function mergeBlobs(blobs: Blob[], type?: string): Blob {
  return new Blob(blobs, { type: type ?? blobs[0]?.type ?? '' });
}
```

### Reading Blob progressively (stream)

```tsx
import { Blob } from 'expo-blob';

export async function readBlobProgressively(
  blob: Blob,
  onProgress: (progressPercent: number) => void
): Promise<string> {
  const stream = blob.stream();
  const reader = stream.getReader();

  let result = '';
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    received += value.length;
    result += new TextDecoder().decode(value);
    onProgress((received / blob.size) * 100);
  }

  return result;
}
```

### Blob equality check

```tsx
import { Blob } from 'expo-blob';

export async function blobsEqual(blob1: Blob, blob2: Blob): Promise<boolean> {
  if (blob1.size !== blob2.size) return false;
  if (blob1.type !== blob2.type) return false;

  const buffer1 = await blob1.arrayBuffer();
  const buffer2 = await blob2.arrayBuffer();

  const a = new Uint8Array(buffer1);
  const b = new Uint8Array(buffer2);
  return a.every((value, index) => value === b[index]);
}
```

## Best practices

1. Use appropriate MIME types (`type`) when creating blobs.
2. Treat large blobs as memory-heavy; avoid copying data unnecessarily.
3. Prefer `stream()` for processing large payloads.
4. Validate expected `type` before parsing (e.g. JSON).
5. Wrap async blob operations in try/catch.
6. Test on all target platforms (iOS/Android/Web), especially for large binary operations.
7. For large uploads, consider chunking and retrying per-chunk.

## Platform-specific behavior

### All platforms

- The `Blob` implementation follows Web API standards.
- `slice()` behavior is consistent across platforms.
- `text()` / `arrayBuffer()` / `stream()` are supported.

### React Native (iOS/Android)

- More reliable than the built-in `react-native` `Blob`, especially for `slice()`.
- Generally better for binary operations and interoperability with Web-like APIs.

### Web

- Uses the native browser `Blob` implementation under the hood.
- Works seamlessly with other Web APIs.

## Error handling

```tsx
import { Blob } from 'expo-blob';

export async function safeReadText(blob: Blob): Promise<string | null> {
  try {
    return await blob.text();
  } catch (error) {
    console.error('Failed to read blob:', error);
    return null;
  }
}

export function validateBlob(blob: Blob, expectedType: string): boolean {
  if (!(blob instanceof Blob)) return false;
  if (blob.size === 0) return false;
  if (blob.type !== expectedType) return false;
  return true;
}
```

## Notes

- Blobs are immutable; operations like `slice()` create new blobs.
- `stream()` is useful for large data, but see the note in the API reference about current streaming internals.
- Blobs integrate with `fetch` and `FormData` for uploads.

## API

```js
import { Blob } from 'expo-blob';
```

## API Reference

### Classes

#### Blob

**Properties:**

| Property | Type | Description |
| --- | --- | --- |
| `size` | `number` | The size of the `Blob` in bytes. |
| `type` | `string` | The MIME type of the `Blob`, or the empty string if the type cannot be determined. |

**Methods:**

#### arrayBuffer

```ts
arrayBuffer(): Promise<ArrayBuffer>
```

**Returns:** Promise resolving to the `Blob`'s binary data as an `ArrayBuffer`.

#### bytes

```ts
bytes(): Promise<Uint8Array>
```

**Returns:** Promise resolving to the `Blob`'s binary data as a `Uint8Array`.

#### slice

```ts
slice(start?: number, end?: number, contentType?: string): Blob
```

| Parameter | Type | Description |
| --- | --- | --- |
| `start` | `number` | The starting byte index (inclusive) represented as a signed 32 bit integer (up to 2^31 - 1). |
| `end` | `number` | The ending byte index (exclusive) represented as a signed 32 bit integer (up to 2^31 - 1). |
| `contentType` | `string` | The MIME type of the new `Blob`. If not provided, defaults to an empty string. |

**Returns:** A new `Blob` object containing the data in the specified range of bytes of the source `Blob`.

#### stream

```ts
stream(): ReadableStream
```

> **Note**: The current implementation loads the entire `Blob` into memory before streaming.

**Returns:** A `ReadableStream` of the `Blob`'s data.

#### text

```ts
text(): Promise<string>
```

**Returns:** Promise that resolves with the entire contents of the `Blob` as a UTF-8 string.

### Types

#### BlobPart

Represents a part of a `Blob`. Can be a `string`, `ArrayBuffer`, `ArrayBufferView`, or another `Blob`.

**Type:** `string | ArrayBuffer | ArrayBufferView | Blob`
