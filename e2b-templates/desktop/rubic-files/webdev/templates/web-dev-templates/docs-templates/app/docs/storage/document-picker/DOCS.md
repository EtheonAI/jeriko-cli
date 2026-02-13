---
name: document-picker
description: Pick documents and files from the device.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# DocumentPicker

A library that provides access to the system's UI for selecting documents from the available providers on the user's device.

**Platforms:** android, ios, web

**Package:** `expo-document-picker`

`expo-document-picker` provides access to the system's UI for selecting documents from the available providers on the user's device.

## When to Use

Use `expo-document-picker` when you need to allow users to select a file from their device storage. This is ideal for scenarios like uploading a profile picture, attaching a document to a form, or importing data from a file.

## Quick Start

```tsx
import { useState } from 'react';
import { Button, Text, View, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';

export default function App() {
  const [document, setDocument] = useState<DocumentPicker.DocumentPickerAsset | null>(null);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setDocument(result.assets[0]);
      }
    } catch (err) {
      console.error("Error picking document:", err);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Pick a PDF" onPress={pickDocument} />
      {document && <Text>Picked: {document.name}</Text>}
    </View>
  );
}
```

## Common Pitfalls

### 1. Forgetting to Handle Cancellation

- **Problem**: If the user closes the document picker without selecting a file, `result.canceled` is `true` and `result.assets` is `null`. Accessing `result.assets[0]` directly will crash the app.
- **Solution**: Always check if `result.canceled` is `false` before accessing the `assets` array.

```tsx
const result = await DocumentPicker.getDocumentAsync();
if (!result.canceled) {
  console.log(result.assets[0].uri);
} else {
  console.log("Document picking canceled");
}
```

### 2. Assuming File Access is Persistent on iOS

- **Problem**: On iOS, the URI for a picked file is temporary. If you store the URI and try to access it later (e.g., after an app restart), the file may no longer be accessible.
- **Solution**: If you need persistent access, use `expo-file-system` to copy the file from its temporary location to your app's sandboxed `FileSystem.documentDirectory`.

```tsx
import * as FileSystem from 'expo-file-system';

const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });

if (!result.canceled) {
  const asset = result.assets[0];
  const permanentUri = `${FileSystem.documentDirectory}${asset.name}`;
  await FileSystem.copyAsync({ from: asset.uri, to: permanentUri });
  console.log('Copied to:', permanentUri);
}
```

## Common Patterns

### 1. Uploading a Picked File to a Server

This pattern shows how to pick a file and immediately upload it using `expo-file-system`.

```tsx
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

async function pickAndUpload() {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true, // Required for upload
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    const uploadResult = await FileSystem.uploadAsync('https://your-server.com/upload', asset.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      headers: {
        // Add any required headers here
      },
    });

    console.log('Upload complete:', uploadResult.body);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

### 2. Picking Multiple Files

You can allow the user to select multiple files by setting the `multiple` option to `true`.

```ts
import * as DocumentPicker from 'expo-document-picker';

const result = await DocumentPicker.getDocumentAsync({
  multiple: true,
  type: ['image/*', 'application/pdf'], // Can specify multiple MIME types
});

if (!result.canceled) {
  const uris = result.assets.map((asset) => asset.uri);
  console.log({ uris });
}
```

## Installation

```bash
$ npx expo install expo-document-picker
```

If you are installing this in an existing React Native app, make sure to install `expo` in your project.

## Configuration in app config

You can configure `expo-document-picker` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

If you want to enable [iCloud storage features][icloud-entitlement], set the `expo.ios.usesIcloudStorage` key to `true` in the [app config](/workflow/configuration/) file as specified [configuration properties](../config/app/#usesicloudstorage).

Running [EAS Build](/build/introduction) locally will use [iOS capabilities signing](/build-reference/ios-capabilities) to enable the required capabilities before building.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-document-picker",
        {
          "iCloudContainerEnvironment": "Production"
        }
      ]
    ]
  }
}
```

### Configurable properties

| Name | Default | Description |
| --- | --- | --- |
| `iCloudContainerEnvironment` | `undefined` | Only for: ios. Sets the iOS `com.apple.developer.icloud-container-environment` entitlement used for AdHoc iOS builds. Possible values: `Development`, `Production`. |
| `kvStoreIdentifier` | `undefined` | Only for: ios. Overrides the default iOS `com.apple.developer.ubiquity-kvstore-identifier` entitlement, which uses your Apple Team ID and bundle identifier. This may be needed if your app was transferred to another Apple Team after enabling iCloud storage. |

Apps that don't use [EAS Build](/build/introduction) and want [iCloud storage features][icloud-entitlement] must [manually configure](/build-reference/ios-capabilities#manual-setup) the [**iCloud service with CloudKit support**](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_developer_icloud-container-environment) for their bundle identifier.

If you enable the **iCloud** capability through the [Apple Developer Console](/build-reference/ios-capabilities#apple-developer-console), then be sure to add the following entitlements in your `ios/[app]/[app].entitlements` file (where `dev.expo.my-app` if your bundle identifier):

```xml
<key>com.apple.developer.icloud-container-identifiers</key>
<array>
    <string>iCloud.dev.expo.my-app</string>
</array>
<key>com.apple.developer.icloud-services</key>
<array>
    <string>CloudDocuments</string>
</array>
<key>com.apple.developer.ubiquity-container-identifiers</key>
<array>
    <string>iCloud.dev.expo.my-app</string>
</array>
<key>com.apple.developer.ubiquity-kvstore-identifier</key>
<string>$(TeamIdentifierPrefix)dev.expo.my-app</string>
```

Apple Developer Console also requires an **iCloud Container** to be created. When registering the new container, you are asked to provide a description and identifier for the container. You may enter any name under the description. Under the identifier, add `iCloud.<your_bundle_identifier>` (same value used for `com.apple.developer.icloud-container-identifiers` and `com.apple.developer.ubiquity-container-identifiers` entitlements).

## Using with `expo-file-system`
When using `expo-document-picker` with [`expo-file-system`](./filesystem/), it's not always possible for the file system to read the file immediately after the `expo-document-picker` picks it.

To allow the `expo-file-system` to read the file immediately after it is picked, you'll need to ensure that the [`copyToCacheDirectory`](#documentpickeroptions) option is set to `true`.

## API
```js
import * as DocumentPicker from 'expo-document-picker';
```

[icloud-entitlement]: https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_developer_icloud-services

## API Reference

### Methods

#### getDocumentAsync

Display the system UI for choosing a document. By default, the chosen file is copied to [the app's internal cache directory](./filesystem#filesystemcachedirectory).
> **Notes for Web:** The system UI can only be shown after user activation (e.g. a `Button` press).
> Therefore, calling `getDocumentAsync` in `componentDidMount`, for example, will **not** work as
> intended. The `cancel` event will not be returned in the browser due to platform restrictions and
> inconsistencies across browsers.

```typescript
getDocumentAsync(__namedParameters: DocumentPickerOptions): Promise<DocumentPickerResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `DocumentPickerOptions` | - |

**Returns:** On success returns a promise that fulfils with [`DocumentPickerResult`](#documentpickerresult) object.

If the user cancels the document picking, the promise resolves with `{ canceled: true, assets: null }`.

### Types

#### DocumentPickerAsset

| Property | Type | Description |
| --- | --- | --- |
| `base64` *(optional)* | `string` | Base64 string of the file. Available on platform: web. |
| `file` *(optional)* | `File` | `File` object for parity with the web File API. Available on platform: web. |
| `lastModified` | `number` | Timestamp of last document modification. [Web API specs](https://developer.mozilla.org/en-US/docs/Web/API/File/lastModified)<br>The `lastModified` provides the last modified date of the file as the number of milliseconds since the Unix epoch (January 1, 1970 at midnight). Files without a known last modified date return the current date. |
| `mimeType` *(optional)* | `string` | Document MIME type. |
| `name` | `string` | Document original name. |
| `size` *(optional)* | `number` | Document size in bytes. |
| `uri` | `string` | An URI to the local document file. |

#### DocumentPickerCanceledResult

Type representing canceled pick result.

| Property | Type | Description |
| --- | --- | --- |
| `assets` | `null` | Always `null` when the request was canceled. |
| `canceled` | `true` | Always `true` when the request was canceled. |
| `output` *(optional)* | `null` | Always `null` when the request was canceled. Available on platform: web. |

#### DocumentPickerOptions

| Property | Type | Description |
| --- | --- | --- |
| `base64` *(optional)* | `boolean` | If `true`, asset url is base64 from the file. If `false`, asset url is the file url parameter.<br>Default: `true`.<br>Available on platform: web. |
| `copyToCacheDirectory` *(optional)* | `boolean` | If `true`, the picked file is copied to [`FileSystem.CacheDirectory`](./filesystem#filesystemcachedirectory), which allows other Expo APIs to read the file immediately. This may impact performance for large files, so you should consider setting this to `false` if you expect users to pick particularly large files and your app does not need immediate read access.<br>Default: `true`.<br>Available on platforms: ios, android. |
| `multiple` *(optional)* | `boolean` | Allows multiple files to be selected from the system UI.<br>Default: `false`. |
| `type` *(optional)* | `string \| string[]` | The [MIME type(s)](https://en.wikipedia.org/wiki/Media_type) of the documents that are available to be picked. Supports wildcards like `image/*` to choose any image. To allow any type of document you can use `*/*`.<br>Default: `*/*`. |

#### DocumentPickerResult

Type representing successful and canceled document pick result.

**Type:** `DocumentPickerSuccessResult | DocumentPickerCanceledResult`

#### DocumentPickerSuccessResult

Type representing successful pick result.

| Property | Type | Description |
| --- | --- | --- |
| `assets` | `DocumentPickerAsset[]` | An array of picked assets. |
| `canceled` | `false` | If asset data have been returned this should always be `false`. |
| `output` *(optional)* | `FileList` | `FileList` object for parity with the web File API. Available on platform: web. |
