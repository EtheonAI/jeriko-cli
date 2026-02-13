---
name: sms
description: Compose and send SMS messages.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# SMS

A library that provides access to the system's UI/app for sending SMS messages.

## Quick Start

Here is a minimal example of how to send an SMS message.

```jsx
import React from 'react';
import { Button, View, StyleSheet, Platform } from 'react-native';
import * as SMS from 'expo-sms';

export default function App() {
  const sendSms = async () => {
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      const { result } = await SMS.sendSMSAsync(
        ['1234567890', '0987654321'],
        'My sample HelloWorld message',
      );
      console.log(result);
    } else {
      // misfortune... there's no SMS available on this device
      console.log("SMS is not available on this device");
    }
  };

  return (
    <View style={styles.container}>
      <Button onPress={sendSms} title="Send SMS" />
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

## When to Use

Use this module when you want to initiate an SMS message from your app and let the user send it through their default SMS application. It's ideal for features like "share via text" or "contact support via SMS". This module does not allow sending SMS messages programmatically in the background without user interaction.

## Common Pitfalls

### 1. Not Checking for SMS Availability

**Problem:** Calling `sendSMSAsync` without first checking if the device can send SMS messages. This will fail on devices without SMS capabilities, the iOS Simulator, and web platforms.

**Solution:** Always check for availability using `isAvailableAsync` before attempting to send a message.

```jsx
import { Button, Platform } from 'react-native';
import * as SMS from 'expo-sms';

export default function SmsButton() {
  const handleSms = async () => {
    const isAvailable = await SMS.isAvailableAsync();
    if (isAvailable) {
      // Proceed to send SMS
      await SMS.sendSMSAsync(['1234567890'], 'Hello!');
    } else {
      // Handle the case where SMS is not available
      alert("SMS is not available on this device.");
    }
  };

  return <Button onPress={handleSms} title="Send SMS" />;
}
```

### 2. Assuming a 'sent' Result on Android

**Problem:** The `sendSMSAsync` promise resolves with `{ result: 'unknown' }` on Android, regardless of whether the user sends the message or cancels. Developers might incorrectly assume they can track if the message was actually sent.

**Solution:** Design your app logic to handle the `'unknown'` status gracefully on Android. Do not rely on the result to confirm that a message was sent.

```js
const { result } = await SMS.sendSMSAsync(addresses, message);

if (Platform.OS === 'android') {
  console.log("SMS prompt was shown. We can't determine if it was sent.");
} else {
  console.log(`SMS result: ${result}`); // 'sent', 'cancelled', or 'unknown'
}
```

### 3. Using Incorrect File URIs for Attachments

**Problem:** Passing a direct file path (e.g., `file:///path/to/image.png`) as the `uri` for an attachment. This will not work because the SMS application does not have permission to access your app's private files.

**Solution:** Use `FileSystem.getContentUriAsync` to create a content URI that is accessible to other applications.

```jsx
import * as FileSystem from 'expo-file-system';
import * as SMS from 'expo-sms';

const sendSmsWithAttachment = async () => {
  const fileUri = FileSystem.documentDirectory + 'my-image.png';
  // Assume file exists at fileUri

  const contentUri = await FileSystem.getContentUriAsync(fileUri);

  await SMS.sendSMSAsync('1234567890', 'Check out this image!', {
    attachments: {
      uri: contentUri,
      mimeType: 'image/png',
      filename: 'my-image.png',
    },
  });
};
```

## Common Patterns

### Reusable SMS Sending Function

Encapsulate the logic for checking availability and sending an SMS into a reusable function. This makes your components cleaner and your SMS logic easier to manage.

```js
import * as SMS from 'expo-sms';
import { Alert, Platform } from 'react-native';

export async function sendSms(addresses, message) {
  const isAvailable = await SMS.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert("SMS Error", "SMS is not available on this device.");
    return;
  }

  try {
    const { result } = await SMS.sendSMSAsync(addresses, message);
    // On iOS, you can check the result
    if (Platform.OS !== 'android') {
      if (result === 'sent') {
        Alert.alert('Success', 'Message sent successfully!');
      } else if (result === 'cancelled') {
        console.log('User cancelled SMS');
      }
    }
  } catch (error) {
    Alert.alert('SMS Error', 'An unexpected error occurred.');
    console.error(error);
  }
}

// Usage in a component:
// import { sendSms } from './smsUtils';
// <Button onPress={() => sendSms(['1234567890'], 'Hello from my app!')} title="Contact Us" />
```

**Platforms:** android, ios

**Package:** `expo-sms`

`expo-sms` provides access to the system's UI/app for sending SMS messages.

## Installation

```bash
$ npx expo install expo-sms
```

## API

```js
import * as SMS from 'expo-sms';
```

## API Reference

### Methods

#### isAvailableAsync

Determines whether SMS is available. Always returns `false` in the iOS simulator, and in browser.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** Returns a promise that fulfils with a `boolean`, indicating whether SMS is available on this device.

#### sendSMSAsync

Opens the default UI/app for sending SMS messages with prefilled addresses and message.

```typescript
sendSMSAsync(addresses: string | string[], message: string, options: SMSOptions): Promise<SMSResponse>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `addresses` | `string | string[]` | An array of addresses (phone numbers) or single address passed as strings. Those would appear as recipients of the prepared message. |
| `message` | `string` | Message to be sent. |
| `options` | `SMSOptions` | A `SMSOptions` object defining additional SMS configuration options. |

**Returns:** Returns a Promise that fulfils with the SMS action is invoked by the user, with corresponding result:
- If the user cancelled the SMS sending process: `{ result: 'cancelled' }`.
- If the user has sent/scheduled message for sending: `{ result: 'sent' }`.
- If the status of the SMS message cannot be determined: `{ result: 'unknown' }`.

Android does not provide information about the status of the SMS message, so on Android devices
the Promise will always resolve with `{ result: 'unknown' }`.

> Note: The only feedback collected by this module is whether any message has been sent. That
means we do not check actual content of message nor recipients list.

### Types

#### SMSAttachment

An object that is used to describe an attachment that is included with a SMS message.

| Property | Type | Description |
| --- | --- | --- |
| `filename` | `string` | The filename of the attachment. |
| `mimeType` | `string` | The mime type of the attachment such as `image/png`. |
| `uri` | `string` | The content URI of the attachment. The URI needs be a content URI so that it can be accessed by other applications outside of Expo. See [FileSystem.getContentUriAsync]()). |

#### SMSOptions


| Property | Type | Description |
| --- | --- | --- |
| `attachments` | `SMSAttachment | SMSAttachment[]` | - |

#### SMSResponse

| Property | Type | Description |
| --- | --- | --- |
| `result` | `'unknown' | 'sent' | 'cancelled'` | Status of SMS action invoked by the user. |
