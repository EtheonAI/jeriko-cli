---
name: imagepicker
description: Select images and videos from device library or camera.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# ImagePicker

A library that provides access to the system's UI for selecting images and videos from the phone's library or taking a photo with the camera.

**Platforms:** android, ios, web

**Package:** `expo-image-picker`

`expo-image-picker` provides access to the system's UI for selecting images and videos from the phone's library or taking a photo with the camera.

## Quick Start

```tsx
import React, { useState } from 'react';
import { Button, Image, View, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export default function ImagePickerExample() {
  const [image, setImage] = useState(null);

  const pickImage = async () => {
    // No permissions request is necessary for launching the image library
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Button title="Pick an image from camera roll" onPress={pickImage} />
      {image && <Image source={{ uri: image }} style={{ width: 200, height: 200 }} />}
    </View>
  );
}
```

## When to Use

Use `expo-image-picker` when you need to allow users to select images or videos from their device's media library or to take a new photo or video with the camera. It is ideal for features like profile picture selection, photo sharing, or video uploads.

## Common Pitfalls

- **Problem**: Forgetting to request camera permissions before launching the camera.
- **Solution**: Always request camera permissions before calling `launchCameraAsync`.

```tsx
const takePhoto = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Sorry, we need camera permissions to make this work!');
    return;
  }

  let result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 1,
  });

  if (!result.canceled) {
    setImage(result.assets[0].uri);
  }
};
```

- **Problem**: Assuming the user will always select an image.
- **Solution**: Always check if the result was canceled before trying to access the selected assets.

```tsx
if (!result.canceled) {
  setImage(result.assets[0].uri);
}
```

- **Problem**: Not handling `MainActivity` destruction on Android.
- **Solution**: Use `getPendingResultAsync` to retrieve the image picker result after the app has been re-initialized.

```tsx
import { useEffect } from 'react';
import { AppState } from 'react-native';

useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
        if (nextAppState === 'active') {
            const result = await ImagePicker.getPendingResultAsync();
            if (result && !result.canceled) {
                setImage(result.assets[0].uri);
            }
        }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
        subscription.remove();
    };
}, []);
```

## Common Patterns

- **Uploading to a server**: After selecting an image, you often need to upload it to a server.

```tsx
const uploadImage = async (uri) => {
  const response = await fetch(uri);
  const blob = await response.blob();
  const formData = new FormData();
  formData.append('image', blob, 'image.jpg');

  // Replace with your server endpoint
  const uploadResponse = await fetch('https://your-server.com/upload', {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const responseData = await uploadResponse.json();
  console.log(responseData);
};
```

## Installation

```bash
$ npx expo install expo-image-picker
```

| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |

#### UIImagePickerControllerQualityType

| Value | Description |
| --- | --- |
| `High` | Highest available resolution. |
| `IFrame1280x720` | 1280 × 720 |
| `IFrame960x540` | 960 × 540 |
| `Low` | Depends on the device. |
| `Medium` | Depends on the device. |
| `VGA640x480` | 640 × 480 |

#### UIImagePickerPreferredAssetRepresentationMode

Picker preferred asset representation mode. Its values are directly mapped to the [`PHPickerConfigurationAssetRepresentationMode`](https://developer.apple.com/documentation/photokit/phpickerconfigurationassetrepresentationmode).

| Value | Description |
| --- | --- |
| `Automatic` | A mode that indicates that the system chooses the appropriate asset representation. |
| `Compatible` | A mode that uses the most compatible asset representation. |
| `Current` | A mode that uses the current representation to avoid transcoding, if possible. |

#### UIImagePickerPresentationStyle

Picker presentation style. Its values are directly mapped to the [`UIModalPresentationStyle`](https://developer.apple.com/documentation/uikit/uiviewcontroller/1621355-modalpresentationstyle).

| Value | Description |
| --- | --- |
| `AUTOMATIC` | The default presentation style chosen by the system.
On older iOS versions, falls back to `WebBrowserPresentationStyle.FullScreen`. |
| `CURRENT_CONTEXT` | A presentation style where the picker is displayed over the app's content. |
| `FORM_SHEET` | A presentation style that displays the picker centered in the screen. |
| `FULL_SCREEN` | A presentation style in which the presented picker covers the screen. |
| `OVER_CURRENT_CONTEXT` | A presentation style where the picker is displayed over the app's content. |
| `OVER_FULL_SCREEN` | A presentation style in which the picker view covers the screen. |
| `PAGE_SHEET` | A presentation style that partially covers the underlying content. |
| `POPOVER` | A presentation style where the picker is displayed in a popover view. |

#### VideoExportPreset

| Value | Description |
| --- | --- |
| `H264_1280x720` | Resolution: __1280 × 720__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `H264_1920x1080` | Resolution: __1920 × 1080__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `H264_3840x2160` | Resolution: __3840 × 2160__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `H264_640x480` | Resolution: __640 × 480__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `H264_960x540` | Resolution: __960 × 540__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `HEVC_1920x1080` | Resolution: __1920 × 1080__ •
Video compression: __HEVC__ •
Audio compression: __AAC__ |
| `HEVC_3840x2160` | Resolution: __3840 × 2160__ •
Video compression: __HEVC__ •
Audio compression: __AAC__ |
| `HighestQuality` | Resolution: __Depends on the device__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `LowQuality` | Resolution: __Depends on the device__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `MediumQuality` | Resolution: __Depends on the device__ •
Video compression: __H.264__ •
Audio compression: __AAC__ |
| `Passthrough` | Resolution: __Unchanged__ •
Video compression: __None__ •
Audio compression: __None__ |
