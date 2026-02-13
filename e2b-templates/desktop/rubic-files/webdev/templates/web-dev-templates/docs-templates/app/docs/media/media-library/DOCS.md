---
name: media-library
description: Access and manage device photos and videos.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# MediaLibrary

A library that provides access to the device's media library.

**Platforms:** android, ios, tvos

**Package:** `expo-media-library`

`expo-media-library` provides access to the user's media library, allowing them to access their existing images and videos from your app, as well as save new ones. You can also subscribe to any updates made to the user's media library.

> **warning** Android allows full access to the media library (which is the purpose of this package) only for applications needing broad access to photos. See [Details on Google Play's Photo and Video Permissions policy](https://support.google.com/googleplay/android-developer/answer/14115180).

## Quick Start

```jsx
import React, { useState, useEffect } from 'react';
import { Button, Image, View, StyleSheet, Text } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export default function App() {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();
  const [assets, setAssets] = useState([]);

  async function getAssets() {
    if (!permissionResponse.granted) {
      const permission = await requestPermission();
      if (!permission.granted) {
        return;
      }
    }

    const getAssetsOptions = {
      first: 20, // initial number of assets to fetch
      mediaType: ['photo'],
      sortBy: ['creationTime'],
    };

    const { assets } = await MediaLibrary.getAssetsAsync(getAssetsOptions);
    setAssets(assets);
  }

  return (
    <View style={styles.container}>
      <Button title="Get Photos" onPress={getAssets} />
      <View style={styles.grid}>
        {assets.map((asset) => (
          <Image key={asset.id} source={{ uri: asset.uri }} style={styles.image} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  image: {
    width: 100,
    height: 100,
    margin: 5,
  },
});
```

## When to Use

Use `expo-media-library` when your app needs to access, display, or save photos and videos from the user's device. It's ideal for features like custom image pickers, photo editing tools, or any functionality that requires interaction with the device's media gallery.

## Common Pitfalls

### 1. Forgetting to Request Permissions

**Problem**: The app crashes or fails to access media because it doesn't have the necessary permissions.

**Solution**: Always check for and request permissions before calling any `MediaLibrary` methods. Use the `usePermissions` hook to manage the permission flow.

```jsx
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export default function App() {
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  async function askPermission() {
    if (permissionResponse.status !== 'granted') {
      const permission = await requestPermission();
      if (permission.status !== 'granted') {
        // Permission not granted, handle accordingly
      }
    }
  }

  return (
    <View>
      <Button onPress={askPermission} title="Request Permission" />
      <Text>Permission status: {permissionResponse.status}</Text>
    </View>
  );
}
```

### 2. Creating Empty Albums on Android

**Problem**: `createAlbumAsync` throws an error on Android if you try to create an album without an initial asset.

**Solution**: On Android, you must provide an asset to create an album. You can either use an existing asset or create a new one from a local URI.

```jsx
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

async function createAlbum(albumName, asset) {
  if (Platform.OS === 'android') {
    const album = await MediaLibrary.createAlbumAsync(albumName, asset, false);
    return album;
  } else {
    const album = await MediaLibrary.createAlbumAsync(albumName, asset);
    return album;
  }
}
```

### 3. Incorrect Image Orientation on Android

**Problem**: Images fetched with `getAssetsAsync` on Android may have incorrect orientation.

**Solution**: This happens because EXIF data is not read by default. To fix this, set `resolveWithFullInfo: true` in the `getAssetsAsync` options. Note that this may impact performance.

```jsx
const { assets } = await MediaLibrary.getAssetsAsync({
  first: 20,
  resolveWithFullInfo: true, // This is deprecated, use getAssetInfoAsync instead
});

// Correct approach
const { assets } = await MediaLibrary.getAssetsAsync({ first: 20 });
const assetInfo = await MediaLibrary.getAssetInfoAsync(assets[0]);
```

## Common Patterns

### 1. Paginating Through Assets

When dealing with a large number of assets, it's essential to paginate the results to avoid performance issues.

```jsx
import React, { useState } from 'react';
import { Button, View, FlatList, Image, StyleSheet } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export default function App() {
  const [assets, setAssets] = useState([]);
  const [endCursor, setEndCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(true);

  async function loadMoreAssets() {
    if (!hasNextPage) return;

    const { assets: newAssets, endCursor: newEndCursor, hasNextPage: newHasNextPage } = await MediaLibrary.getAssetsAsync({
      first: 20,
      after: endCursor,
    });

    setAssets([...assets, ...newAssets]);
    setEndCursor(newEndCursor);
    setHasNextPage(newHasNextPage);
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={assets}
        renderItem={({ item }) => <Image source={{ uri: item.uri }} style={styles.image} />}
        keyExtractor={(item) => item.id}
        onEndReached={loadMoreAssets}
        onEndReachedThreshold={0.5}
        numColumns={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image: {
    width: 100,
    height: 100,
    margin: 5,
  },
});
```
## Installation

```bash
$ npx expo install expo-media-library
```

## Configuration in app config

You can configure `expo-media-library` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

```json
{
  "expo": {
    "plugins": [
      [
        "expo-media-library",
        {
          "photosPermission": "Allow $(PRODUCT_NAME) to access your photos.",
          "savePhotosPermission": "Allow $(PRODUCT_NAME) to save photos.",
          "isAccessMediaLocationEnabled": true,
          "granularPermissions": ["audio", "photo"]
        }
      ]
    ]
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) or you're using native **android** and **ios** projects manually, then you need to add following permissions and configuration to your native projects:

**Android**

- To access asset location (latitude and longitude EXIF tags), add `ACCESS_MEDIA_LOCATION` permission to your project's **android/app/src/main/AndroidManifest.xml**:

  ```xml
  <uses-permission android:name="android.permission.ACCESS_MEDIA_LOCATION" />
  ```

- [Scoped storage](https://developer.android.com/training/data-storage#scoped-storage) is available from Android 10. To make `expo-media-library` work with scoped storage, you need to add the following configuration to your **android/app/src/main/AndroidManifest.xml**:

  ```xml
  <manifest ... >
    <application android:requestLegacyExternalStorage="true" ...>
  </manifest>
  ```

**iOS**

- Add `NSPhotoLibraryUsageDescription`, and `NSPhotoLibraryAddUsageDescription` keys to your project's **ios/[app]/Info.plist**:

  ```xml
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Give $(PRODUCT_NAME) permission to access your photos</string>
  <key>NSPhotoLibraryAddUsageDescription</key>
  <string>Give $(PRODUCT_NAME) permission to save photos</string>
  ```

## Usage

```jsx
import { useState, useEffect } from 'react';
import { Button, Text, ScrollView, StyleSheet, Image, View, Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

export default function App() {
  const [albums, setAlbums] = useState(null);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  async function getAlbums() {
    if (permissionResponse.status !== 'granted') {
      await requestPermission();
    }
    const fetchedAlbums = await MediaLibrary.getAlbumsAsync({
      includeSmartAlbums: true,
    });
    setAlbums(fetchedAlbums);
  }

  return (
    <View style={styles.container}>
      <Button onPress={getAlbums} title="Get albums" />
      <ScrollView>
        {albums && albums.map((album) => <AlbumEntry album={album} />)}
      </ScrollView>
    </View>
  );
}

function AlbumEntry({ album }) {
  const [assets, setAssets] = useState([]);

  useEffect(() => {
    async function getAlbumAssets() {
      const albumAssets = await MediaLibrary.getAssetsAsync({ album });
      setAssets(albumAssets.assets);
    }
    getAlbumAssets();
  }, [album]);

  return (
    <View key={album.id} style={styles.albumContainer}>
      <Text>
        {album.title} - {album.assetCount ?? 'no'} assets
      </Text>
      <View style={styles.albumAssetsContainer}>
        {assets && assets.map((asset) => (
          <Image source={{ uri: asset.uri }} width={50} height={50} />
        ))}
      </View>
    </View>
  );
}

/* @hide const styles = StyleSheet.create({ ... }); */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 8,
    justifyContent: 'center',
  },
  albumContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 4,
  },
  albumAssetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
/* @end */
````

## Known limitations

### Empty albums

Due to system limitations on Android, it is impossible to create empty albums. It is necessary to either pass an existing asset to add to the album or a URI of a local resource, which will be used to create a new asset inside the album.

### Moving assets between albums

Android 11 introduced permission changes that make the operation of moving assets between albums require confirmation from the user every time.
Therefore, when creating a new asset, instead of creating the asset and then moving it to the album, it is recommended to pass the `album` parameter to the [`createAssetAsync`](#medialibrarycreateassetasynclocaluri-album) method, which will automatically add the asset to the album without the need for user confirmation.

### Wrong orientation of images

On Android, when using `getAssetsAsync` without `resolveWithFullInfo: true`, image orientation may be incorrect because EXIF data (which includes orientation) is only read when that option is enabled.

## API

```js
import * as MediaLibrary from 'expo-media-library';
```

## Permissions

### Android

The following permissions are added automatically through this library's **AndroidManifest.xml**:

### iOS

The following usage description keys are used by this library:

## API Reference

### Methods

#### addAssetsToAlbumAsync

Adds array of assets to the album.

On Android, by default it copies assets from the current album to provided one, however it's also
possible to move them by passing `false` as `copyAssets` argument. In case they're copied you
should keep in mind that `getAssetsAsync` will return duplicated assets.

```typescript
addAssetsToAlbumAsync(assets: AssetRef | AssetRef[], album: AlbumRef, copy: boolean): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `assets` | `AssetRef | AssetRef[]` | An array of [Asset](#asset) or their IDs. |
| `album` | `AlbumRef` | An [Album](#album) or its ID. |
| `copy` | `boolean` | __Android only.__ Whether to copy assets to the new album instead of move them. Defaults to `true`. |

**Returns:** Returns promise which fulfils with `true` if the assets were successfully added to
the album.

#### addListener

Subscribes for updates in user's media library.

```typescript
addListener(listener: (event: MediaLibraryAssetsChangeEvent) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: MediaLibraryAssetsChangeEvent) => void` | A callback that is fired when any assets have been inserted or deleted from the library. On Android it's invoked with an empty object. On iOS, it's invoked with [`MediaLibraryAssetsChangeEvent`](#medialibraryassetschangeevent) object. Additionally, only on iOS, the listener is also invoked when the user changes access to individual assets in the media library using `presentPermissionsPickerAsync()`. |

**Returns:** An [`Subscription`](#subscription) object that you can call `remove()` on when you would
like to unsubscribe the listener.

#### albumNeedsMigrationAsync

Checks if the album should be migrated to a different location. In other words, it checks if the
application has the write permission to the album folder. If not, it returns `true`, otherwise `false`.
> Note: For **Android below R**, **web** or **iOS**, this function always returns `false`.

```typescript
albumNeedsMigrationAsync(album: AlbumRef): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `album` | `AlbumRef` | An [Album](#album) or its ID. |

**Returns:** Returns a promise which fulfils with `true` if the album should be migrated.

#### createAlbumAsync

Creates an album with given name and initial asset. The asset parameter is required on Android,
since it's not possible to create empty album on this platform. On Android, by default it copies
given asset from the current album to the new one, however it's also possible to move it by
passing `false` as `copyAsset` argument.
In case it's copied you should keep in mind that `getAssetsAsync` will return duplicated asset.
> On Android, it's not possible to create an empty album. You must provide an existing asset to copy or move into the album or an uri of a local file, which will be used to create an initial asset for the album.

```typescript
createAlbumAsync(albumName: string, asset: AssetRef, copyAsset: boolean, initialAssetLocalUri: string): Promise<Album>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `albumName` | `string` | Name of the album to create. |
| `asset` | `AssetRef` | An [Asset](#asset) or its ID. On Android you either need to provide an asset or a localUri. |
| `copyAsset` | `boolean` | __Android Only.__ Whether to copy asset to the new album instead of move it. This parameter is ignored if `asset` was not provided. Defaults to `true`. |
| `initialAssetLocalUri` | `string` | A URI to the local media file, which will be used to create the initial asset inside the album. It must contain an extension. On Android it must be a local path, so it must start with `file:///`. If the `asset` was provided, this parameter will be ignored. |

**Returns:** Newly created [`Album`](#album).

#### createAssetAsync

Creates an asset from existing file. The most common use case is to save a picture taken by [Camera]().
This method requires `CAMERA_ROLL` permission.

```typescript
createAssetAsync(localUri: string, album: AlbumRef): Promise<Asset>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `localUri` | `string` | A URI to the image or video file. It must contain an extension. On Android it must be a local path, so it must start with `file:///` |
| `album` | `AlbumRef` | An [Album](#album) or its ID. If provided, the asset will be added to this album upon creation, otherwise it will be added to the default album for the media type. The album has exist. |

**Returns:** A promise which fulfils with an object representing an [`Asset`](#asset).

#### deleteAlbumsAsync

Deletes given albums from the library. On Android by default it deletes assets belonging to given
albums from the library. On iOS it doesn't delete these assets, however it's possible to do by
passing `true` as `deleteAssets`.

```typescript
deleteAlbumsAsync(albums: AlbumRef | AlbumRef[], assetRemove: boolean): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `albums` | `AlbumRef | AlbumRef[]` | An array of [`Album`](#asset)s or their IDs. |
| `assetRemove` | `boolean` | __iOS Only.__ Whether to also delete assets belonging to given albums. Defaults to `false`. |

**Returns:** Returns a promise which fulfils with `true` if the albums were successfully deleted from
the library.

#### deleteAssetsAsync

Deletes assets from the library. On iOS it deletes assets from all albums they belong to, while
on Android it keeps all copies of them (album is strictly connected to the asset). Also, there is
additional dialog on iOS that requires user to confirm this action.

```typescript
deleteAssetsAsync(assets: AssetRef | AssetRef[]): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `assets` | `AssetRef | AssetRef[]` | An array of [Asset](#asset) or their IDs. |

**Returns:** Returns promise which fulfils with `true` if the assets were successfully deleted.

#### getAlbumAsync

Queries for an album with a specific name.

```typescript
getAlbumAsync(title: string): Promise<Album>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `title` | `string` | Name of the album to look for. |

**Returns:** An object representing an [`Album`](#album), if album with given name exists, otherwise
returns `null`.

#### getAlbumsAsync

Queries for user-created albums in media gallery.

```typescript
getAlbumsAsync(__namedParameters: AlbumsOptions): Promise<Album[]>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `AlbumsOptions` | - |

**Returns:** A promise which fulfils with an array of [`Album`](#asset)s. Depending on Android version,
root directory of your storage may be listed as album titled `"0"` or unlisted at all.

#### getAssetInfoAsync

Provides more information about an asset, including GPS location, local URI and EXIF metadata.

```typescript
getAssetInfoAsync(asset: AssetRef, options: MediaLibraryAssetInfoQueryOptions): Promise<AssetInfo>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `asset` | `AssetRef` | An [Asset](#asset) or its ID. |
| `options` | `MediaLibraryAssetInfoQueryOptions` | - |

**Returns:** An [AssetInfo](#assetinfo) object, which is an `Asset` extended by an additional fields.

#### getAssetsAsync

Fetches a page of assets matching the provided criteria.

```typescript
getAssetsAsync(assetsOptions: AssetsOptions): Promise<PagedInfo<Asset>>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `assetsOptions` | `AssetsOptions` | - |

**Returns:** A promise that fulfils with to [`PagedInfo`](#pagedinfo) object with array of [`Asset`](#asset)s.

#### getMomentsAsync

Fetches a list of moments, which is a group of assets taken around the same place
and time.

**Platform:** ios

```typescript
getMomentsAsync(): Promise<any>
```

**Returns:** An array of [albums](#album) whose type is `moment`.

#### getPermissionsAsync

Checks user's permissions for accessing media library.

```typescript
getPermissionsAsync(writeOnly: boolean, granularPermissions: GranularPermission[]): Promise<PermissionResponse>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `writeOnly` | `boolean` | - |
| `granularPermissions` | `GranularPermission[]` | A list of [`GranularPermission`](#granularpermission) values. This parameter has an effect only on Android 13 and newer. By default, `expo-media-library` will ask for all possible permissions. |

**Returns:** A promise that fulfils with [`PermissionResponse`](#permissionresponse) object.

#### isAvailableAsync

Returns whether the Media Library API is enabled on the current device.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise which fulfils with a `boolean`, indicating whether the Media Library API is
available on the current device.

#### migrateAlbumIfNeededAsync

Moves album content to the special media directories on **Android R** or **above** if needed.
Those new locations are in line with the Android `scoped storage` - so your application won't
lose write permission to those directories in the future.

This method does nothing if:
- app is running on **iOS**, **web** or **Android below R**
- app has **write permission** to the album folder

The migration is possible when the album contains only compatible files types.
For instance, movies and pictures are compatible with each other, but music and pictures are not.
If automatic migration isn't possible, the function rejects.
In that case, you can use methods from the `expo-file-system` to migrate all your files manually.

# Why do you need to migrate files?
__Android R__ introduced a lot of changes in the storage system. Now applications can't save
anything to the root directory. The only available locations are from the `MediaStore` API.
Unfortunately, the media library stored albums in folders for which, because of those changes,
the application doesn't have permissions anymore. However, it doesn't mean you need to migrate
all your albums. If your application doesn't add assets to albums, you don't have to migrate.
Everything will work as it used to. You can read more about scoped storage in [the Android documentation](https://developer.android.com/about/versions/11/privacy/storage).

```typescript
migrateAlbumIfNeededAsync(album: AlbumRef): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `album` | `AlbumRef` | An [Album](#album) or its ID. |

**Returns:** A promise which fulfils to `void`.

#### presentPermissionsPickerAsync

Allows the user to update the assets that your app has access to.
The system modal is only displayed if the user originally allowed only `limited` access to their
media library, otherwise this method is a no-op.

**Platform:** android 14+

```typescript
presentPermissionsPickerAsync(mediaTypes: MediaTypeFilter[]): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `mediaTypes` | `MediaTypeFilter[]` | Limits the type(s) of media that the user will be granting access to. By default, a list that shows both photos and videos is presented. |

**Returns:** A promise that either rejects if the method is unavailable, or resolves to `void`.
> __Note:__ This method doesn't inform you if the user changes which assets your app has access to.
That information is only exposed by iOS, and to obtain it, you need to subscribe for updates to the user's media library using [`addListener()`](#medialibraryaddlistenerlistener).
If `hasIncrementalChanges` is `false`, the user changed their permissions.

#### removeAllListeners

Removes all listeners.

```typescript
removeAllListeners(): void
```

#### removeAssetsFromAlbumAsync

Removes given assets from album.

On Android, album will be automatically deleted if there are no more assets inside.

```typescript
removeAssetsFromAlbumAsync(assets: AssetRef | AssetRef[], album: AlbumRef): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `assets` | `AssetRef | AssetRef[]` | An array of [Asset](#asset) or their IDs. |
| `album` | `AlbumRef` | An [Album](#album) or its ID. |

**Returns:** Returns promise which fulfils with `true` if the assets were successfully removed from
the album.

#### removeSubscription

```typescript
removeSubscription(subscription: EventSubscription): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `subscription` | `EventSubscription` | - |

#### requestPermissionsAsync

Asks the user to grant permissions for accessing media in user's media library.

```typescript
requestPermissionsAsync(writeOnly: boolean, granularPermissions: GranularPermission[]): Promise<PermissionResponse>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `writeOnly` | `boolean` | - |
| `granularPermissions` | `GranularPermission[]` | A list of [`GranularPermission`](#granularpermission) values. This parameter has an effect only on Android 13 and newer. By default, `expo-media-library` will ask for all possible permissions. > When using granular permissions with a custom config plugin configuration, make sure that all the requested permissions are included in the plugin. |

**Returns:** A promise that fulfils with [`PermissionResponse`](#permissionresponse) object.

#### saveToLibraryAsync

Saves the file at given `localUri` to the user's media library. Unlike [`createAssetAsync()`](#medialibrarycreateassetasynclocaluri),
This method doesn't return created asset.
On __iOS 11+__, it's possible to use this method without asking for `CAMERA_ROLL` permission,
however then yours `Info.plist` should have `NSPhotoLibraryAddUsageDescription` key.

```typescript
saveToLibraryAsync(localUri: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `localUri` | `string` | A URI to the image or video file. It must contain an extension. On Android it must be a local path, so it must start with `file:///`. |

#### usePermissions

```typescript
usePermissions(options: PermissionHookOptions<{ granularPermissions: GranularPermission[]; writeOnly: boolean }>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PermissionHookOptions<{ granularPermissions: GranularPermission[]; writeOnly: boolean }>` | - |

### Interfaces

#### Subscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

### Types

#### Album

| Property | Type | Description |
| --- | --- | --- |
| `approximateLocation` | `Location` | Apply only to albums whose type is `'moment'`. Approximated location of all assets in the moment. |
| `assetCount` | `number` | Estimated number of assets in the album. |
| `endTime` | `number` | Apply only to albums whose type is `'moment'`. Latest creation timestamp of all assets in the moment. |
| `id` | `string` | Album ID. |
| `locationNames` | `string[]` | Apply only to albums whose type is `'moment'`. Names of locations grouped in the moment. |
| `startTime` | `number` | Apply only to albums whose type is `'moment'`. Earliest creation timestamp of all assets in the moment. |
| `title` | `string` | Album title. |
| `type` | `AlbumType` | The type of the assets album. |

#### AlbumRef

**Type:** `Album | string`

#### AlbumsOptions

| Property | Type | Description |
| --- | --- | --- |
| `includeSmartAlbums` | `boolean` | - |

#### AlbumType

**Type:** `'album' | 'moment' | 'smartAlbum'`

#### Asset

| Property | Type | Description |
| --- | --- | --- |
| `albumId` | `string` | Album ID that the asset belongs to. |
| `creationTime` | `number` | File creation timestamp. |
| `duration` | `number` | Duration of the video or audio asset in seconds. |
| `filename` | `string` | Filename of the asset. |
| `height` | `number` | Height of the image or video. |
| `id` | `string` | Internal ID that represents an asset. |
| `mediaSubtypes` | `MediaSubtype[]` | An array of media subtypes. |
| `mediaType` | `MediaTypeValue` | Media type. |
| `modificationTime` | `number` | Last modification timestamp. |
| `uri` | `string` | URI that points to the asset. `ph://*` (iOS), `file://*` (Android) |
| `width` | `number` | Width of the image or video. |

#### AssetInfo

**Type:** `unknown`

#### AssetRef

**Type:** `Asset | string`

#### AssetsOptions

| Property | Type | Description |
| --- | --- | --- |
| `after` | `AssetRef` | Asset ID of the last item returned on the previous page. To get the ID of the next page, pass [`endCursor`](#pagedinfo) as its value. |
| `album` | `AlbumRef` | [Album](#album) or its ID to get assets from specific album. |
| `createdAfter` | `Date | number` | `Date` object or Unix timestamp in milliseconds limiting returned assets only to those that were created after this date. |
| `createdBefore` | `Date | number` | Similarly as `createdAfter`, but limits assets only to those that were created before specified date. |
| `first` | `number` | The maximum number of items on a single page. |
| `mediaSubtypes` | `MediaSubtype[] | MediaSubtype` | An array of [MediaSubtype](#mediasubtype)s or a single `MediaSubtype`. |
| `mediaType` | `MediaTypeValue[] | MediaTypeValue` | An array of [MediaTypeValue](#mediatypevalue)s or a single `MediaTypeValue`. |
| `resolveWithFullInfo` | `boolean` | Whether to resolve full info for the assets during the query. This is useful to get the full EXIF data for images. It can fix the orientation of the image. |
| `sortBy` | `SortByValue[] | SortByValue` | An array of [`SortByValue`](#sortbyvalue)s or a single `SortByValue` value. By default, all keys are sorted in descending order, however you can also pass a pair `[key, ascending]` where the second item is a `boolean` value that means whether to use ascending order. Note that if the `SortBy.default` key is used, then `ascending` argument will not matter. Earlier items have higher priority when sorting out the results. If empty, this method uses the default sorting that is provided by the platform. |

#### EXPermissionResponse

An object obtained by permissions get and request functions.

| Property | Type | Description |
| --- | --- | --- |
| `canAskAgain` | `boolean` | Indicates if user can be asked again for specific permission. If not, one should be directed to the Settings app in order to enable/disable the permission. |
| `expires` | `PermissionExpiration` | Determines time when the permission expires. |
| `granted` | `boolean` | A convenience boolean that indicates if the permission is granted. |
| `status` | `PermissionStatus` | Determines the status of the permission. |

#### GranularPermission

Determines the type of media that the app will ask the OS to get access to.

**Type:** `'audio' | 'photo' | 'video'`

#### Location

| Property | Type | Description |
| --- | --- | --- |
| `latitude` | `number` | - |
| `longitude` | `number` | - |

#### MediaLibraryAssetInfoQueryOptions

| Property | Type | Description |
| --- | --- | --- |
| `shouldDownloadFromNetwork` | `boolean` | Whether allow the asset to be downloaded from network. Only available in iOS with iCloud assets. |

#### MediaLibraryAssetsChangeEvent

| Property | Type | Description |
| --- | --- | --- |
| `deletedAssets` | `Asset[]` | Available only if `hasIncrementalChanges` is `true`. Array of [`Asset`](#asset)s that have been deleted from the library. |
| `hasIncrementalChanges` | `boolean` | Whether the media library's changes could be described as "incremental changes". `true` indicates the changes are described by the `insertedAssets`, `deletedAssets` and `updatedAssets` values. `false` indicates that the scope of changes is too large and you should perform a full assets reload (eg. a user has changed access to individual assets in the media library). |
| `insertedAssets` | `Asset[]` | Available only if `hasIncrementalChanges` is `true`. Array of [`Asset`](#asset)s that have been inserted to the library. |
| `updatedAssets` | `Asset[]` | Available only if `hasIncrementalChanges` is `true`. Array of [`Asset`](#asset)s that have been updated or completed downloading from network storage (iCloud on iOS). |

#### MediaSubtype

Constants identifying specific variations of asset media, such as panorama or screenshot photos,
and time-lapse or high-frame-rate video. Maps to [`PHAssetMediaSubtype`](https://developer.apple.com/documentation/photokit/phassetmediasubtype#1603888).

**Type:** `'depthEffect' | 'hdr' | 'highFrameRate' | 'livePhoto' | 'panorama' | 'screenshot' | 'stream' | 'timelapse' | 'spatialMedia' | 'videoCinematic'`

#### MediaTypeFilter

Represents the possible types of media that the app will ask the OS to get access to when calling [`presentPermissionsPickerAsync()`](#medialibrarypresentpermissionspickerasyncmediatypes).

**Type:** `'photo' | 'video'`

#### MediaTypeObject

| Property | Type | Description |
| --- | --- | --- |
| `audio` | `'audio'` | - |
| `photo` | `'photo'` | - |
| `unknown` | `'unknown'` | - |
| `video` | `'video'` | - |

#### MediaTypeValue

**Type:** `'audio' | 'photo' | 'video' | 'unknown' | 'pairedVideo'`

#### PagedInfo

| Property | Type | Description |
| --- | --- | --- |
| `assets` | `T[]` | A page of [`Asset`](#asset)s fetched by the query. |
| `endCursor` | `string` | ID of the last fetched asset. It should be passed as `after` option in order to get the next page. |
| `hasNextPage` | `boolean` | Whether there are more assets to fetch. |
| `totalCount` | `number` | Estimated total number of assets that match the query. |

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

#### PermissionHookOptions

**Type:** `unknown`

#### PermissionResponse

**Type:** `unknown`

#### SortByKey

**Type:** `'default' | 'mediaType' | 'width' | 'height' | 'creationTime' | 'modificationTime' | 'duration'`

#### SortByObject

| Property | Type | Description |
| --- | --- | --- |
| `creationTime` | `'creationTime'` | - |
| `default` | `'default'` | - |
| `duration` | `'duration'` | - |
| `height` | `'height'` | - |
| `mediaType` | `'mediaType'` | - |
| `modificationTime` | `'modificationTime'` | - |
| `width` | `'width'` | - |

#### SortByValue

**Type:** `[SortByKey, boolean] | SortByKey`

### Enums

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |
