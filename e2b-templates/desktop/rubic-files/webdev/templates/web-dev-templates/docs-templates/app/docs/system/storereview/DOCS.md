---
name: storereview
description: Prompt users to rate the app in app stores.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# StoreReview

A library that provides access to native APIs for in-app reviews.

**Platforms:** android, ios

**Package:** `expo-store-review`

`expo-store-review` is a library that provides access to `ReviewManager` API on Android 5+ and `SKStoreReviewController` API on iOS. It allows you to ask the user to rate your app without leaving the app itself.

## Quick Start

Here's a minimal example of how to request an in-app review. This code checks if the API is available and then triggers the review prompt.

```tsx
import * as StoreReview from 'expo-store-review';
import { Button, View, Platform } from 'react-native';

export default function App() {
  const handleRequestReview = async () => {
    if (Platform.OS === 'web') {
      alert("StoreReview is not available on web.");
      return;
    }
    const isAvailable = await StoreReview.isAvailableAsync();
    if (isAvailable) {
      // Timing is crucial. Don't ask for a review on a button press.
      // Instead, call this after a user has completed a positive interaction.
      StoreReview.requestReview();
    } else {
      alert("In-app review is not available on this device.");
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Request Review (For Demo)" onPress={handleRequestReview} />
    </View>
  );
}
```

## When to Use

Use this module to ask for an app rating after a user has had a positive experience, such as completing a key task or a level in a game. Avoid triggering the prompt from a button or interrupting the user's workflow. The goal is to ask for a review at a time when the user is most likely to give positive feedback.

## Common Pitfalls

### 1. Triggering a Review from a Button

- **Problem**: Apple's Human Interface Guidelines and Google's Play Store Guidelines explicitly advise against triggering the review prompt from a button or other user-initiated action. Doing so can lead to a poor user experience and may be rejected by app stores.
- **Solution**: Trigger the review prompt programmatically after a significant positive interaction. For example, after a user successfully completes a major feature flow in your app.

### 2. Not Checking for Availability

- **Problem**: Calling `StoreReview.requestReview()` without first checking `StoreReview.isAvailableAsync()` can cause errors on platforms where the API is not supported, such as web or older OS versions.
- **Solution**: Always check for availability before requesting a review to ensure the function is only called on supported devices.

```tsx
import * as StoreReview from 'expo-store-review';

async function safeRequestReview() {
  const isAvailable = await StoreReview.isAvailableAsync();
  if (isAvailable) {
    StoreReview.requestReview();
  } else {
    console.log("In-app review is not available.");
  }
}
```

### 3. Requesting a Review Too Frequently

- **Problem**: The underlying native APIs on both iOS and Android have their own internal logic to determine if and when to show the prompt. Requesting it too often will result in the prompt not being shown, and it provides a poor user experience.
- **Solution**: You should not trigger the review prompt more than a few times a year. Let the system decide the best time to show it. You can build your own logic to limit how often you call `requestReview()`, for example, by saving a timestamp in `AsyncStorage`.

## Common Patterns

### 1. Requesting a Review After a Key Action

This pattern involves triggering a review after a user has completed a meaningful task, which increases the likelihood of receiving high-quality feedback.

```tsx
import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Call this function after a user completes a positive action (e.g., finishes a level)
async function requestReviewAfterAction() {
  const hasReviewed = await AsyncStorage.getItem('hasReviewed');
  if (hasReviewed === 'true') {
    return; // Don't ask again if they've already been prompted
  }

  const isAvailable = await StoreReview.isAvailableAsync();
  if (isAvailable) {
    StoreReview.requestReview();
    // Assume the prompt was shown and save a flag
    await AsyncStorage.setItem('hasReviewed', 'true');
  }
}
```

## Installation

## Usage

It is important that you follow the [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews) for iOS and [Guidelines](https://developer.android.com/guide/playcore/in-app-review#when-to-request) for Android when using this API.

**Specifically:**

- Don't call `StoreReview.requestReview()` from a button - instead try calling it after the user has finished some signature interaction in the app.
- Don't spam the user.
- Don't request a review when the user is doing something time sensitive like navigating.
- Don't ask the user any questions before or while presenting the rating button or card.

### Write reviews

#### Android

There is no equivalent redirect on Android, you can still open the Play Store to the reviews sections using the query parameter `showAllReviews=true` like this:

**Example:** Android Play Store example
```ts
const androidPackageName = 'host.exp.exponent';
// Open the Android Play Store in the browser -> redirects to Play Store on Android
Linking.openURL(
  `https://play.google.com/store/apps/details?id=${androidPackageName}&showAllReviews=true`
);
// Open the Android Play Store directly
Linking.openURL(`market://details?id=${androidPackageName}&showAllReviews=true`);
```

#### iOS

You can redirect an app user to the **"Write a Review"** screen for an app in the iOS App Store by using the query parameter `action=write-review`. For example:

**Example:** iOS App Store example
```ts
const itunesItemId = 982107779;
// Open the iOS App Store in the browser -> redirects to App Store on iOS
Linking.openURL(`https://apps.apple.com/app/apple-store/id${itunesItemId}?action=write-review`);
// Open the iOS App Store directly
Linking.openURL(
  `itms-apps://itunes.apple.com/app/viewContentsUserReviews/id${itunesItemId}?action=write-review`
);
```

## API

```js

```

## Error codes

### `ERR_STORE_REVIEW_FAILED`

This error occurs when the store review request was not successful.

## API Reference

### Methods

#### hasAction


```typescript
hasAction(): Promise<boolean>
```

**Returns:** This returns a promise that fulfills to `true` if `StoreReview.requestReview()` is capable
directing the user to some kind of store review flow. If the app config (`app.json`) does not
contain store URLs and native store review capabilities are not available then the promise
will fulfill to `false`.

#### isAvailableAsync

Determines if the platform has the capabilities to use `StoreReview.requestReview()`.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** This returns a promise fulfills with `boolean`, depending on the platform:
- On iOS, it will resolve to `true` unless the app is distributed through TestFlight.
- On Android, it will resolve to `true` if the device is running Android 5.0+.
- On Web, it will resolve to `false`.

#### requestReview

In ideal circumstances this will open a native modal and allow the user to select a star rating
that will then be applied to the App Store, without leaving the app. If the device is running
a version of Android lower than 5.0, this will attempt to get the store URL and link the user to it.

```typescript
requestReview(): Promise<void>
```

#### storeUrl

This uses the `Constants` API to get the `Constants.expoConfig.ios.appStoreUrl` on iOS, or the
`Constants.expoConfig.android.playStoreUrl` on Android.

On Web this will return `null`.

```typescript
storeUrl(): string | null
```
