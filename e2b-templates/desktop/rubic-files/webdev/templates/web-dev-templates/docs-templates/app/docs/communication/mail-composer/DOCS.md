---
name: mail-composer
description: Compose emails with attachments.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# MailComposer

A library that provides functionality to compose and send emails with the system's specific UI.

## Quick Start

```jsx
import React from 'react';
import { View, Button, Alert, Platform } from 'react-native';
import * as MailComposer from 'expo-mail-composer';

export default function App() {
  const handlePress = async () => {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      if (Platform.OS === 'web') {
        Alert.alert('Email not available', 'Please configure an email client on your device.');
      } else {
        Alert.alert('Email not available', 'Please configure an email account on your device.');
      }
      return;
    }

    const { status } = await MailComposer.composeAsync({
      recipients: ['support@example.com'],
      subject: 'App Feedback',
      body: 'Hello, I would like to share some feedback...',
    });

    if (status === 'sent') {
      Alert.alert('Feedback sent', 'Thank you for your feedback!');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Send Feedback" onPress={handlePress} />
    </View>
  );
}
```

## When to Use

`expo-mail-composer` is ideal for scenarios where you need to allow users to send emails from within your app using their device's native email client. This is useful for features like "Contact Us," "Send Feedback," or sharing content via email.

## Common Pitfalls

### Not Checking for Mail Client Availability

- **Problem**: Attempting to compose an email on a device without a configured email client will fail and can crash the app or lead to a poor user experience.
- **Solution**: Always check for mail client availability using `MailComposer.isAvailableAsync()` before attempting to send an email. Provide a fallback or a clear message to the user if no mail client is available.

```javascript
const handlePress = async () => {
  const isAvailable = await MailComposer.isAvailableAsync();
  if (!isAvailable) {
    Alert.alert('Email not available', 'Please configure an email account on your device.');
    return;
  }
  // ... compose email
};
```

### Using on iOS Simulator

- **Problem**: The `expo-mail-composer` module cannot be used on the iOS Simulator because you cannot sign in to a mail account on it. This will cause the `composeAsync` method to fail.
- **Solution**: Test on a physical iOS device. For development, you can mock the function or use a conditional check to avoid calling it on a simulator.

### Attaching Files with Incorrect URIs

- **Problem**: Providing an incorrect or inaccessible file URI in the `attachments` array will result in the attachment failing to be included in the email.
- **Solution**: Ensure that the file URIs are correct and point to files that are accessible by the app. Use `expo-file-system` to manage and access files, and verify the URI before passing it to `composeAsync`.

## Common Patterns

### Sending an Email with Attachments

This pattern demonstrates how to send an email with a file attachment. It uses `expo-file-system` to create a temporary file and then attaches it to the email.

```javascript
import React from 'react';
import { View, Button, Alert } from 'react-native';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystem from 'expo-file-system';

export default function App() {
  const sendEmailWithAttachment = async () => {
    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('Email not available', 'Please configure an email account on your device.');
      return;
    }

    const fileUri = FileSystem.cacheDirectory + 'feedback.txt';
    await FileSystem.writeAsStringAsync(fileUri, 'Here is my feedback.');

    const { status } = await MailComposer.composeAsync({
      recipients: ['support@example.com'],
      subject: 'App Feedback with Attachment',
      body: 'Please see the attached file.',
      attachments: [fileUri],
    });

    if (status === 'sent') {
      Alert.alert('Feedback sent', 'Thank you for your feedback!');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Send Feedback with Attachment" onPress={sendEmailWithAttachment} />
    </View>
  );
}
```

**Platforms:** android, ios*, web

**Package:** `expo-mail-composer`

`expo-mail-composer` allows you to compose and send emails quickly and easily using the OS UI. This module can't be used on iOS Simulators since you can't sign into a mail account on them.

## Installation

```bash
$ npx expo install expo-mail-composer
```

## API

```js
import * as MailComposer from 'expo-mail-composer';
```

## API Reference

### Methods

#### composeAsync

Opens a mail modal for iOS and a mail app intent for Android and fills the fields with provided
data. On iOS you will need to be signed into the Mail app.

```typescript
composeAsync(options: MailComposerOptions): Promise<MailComposerResult>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `MailComposerOptions` | - |

**Returns:** A promise fulfilled with an object containing a `status` field that specifies whether an
email was sent, saved, or cancelled. Android does not provide this info, so the status is always
set as if the email were sent.

#### getClients

Retrieves a list of available email clients installed on the device.
This can be used to present options to the user for sending emails through their preferred email client,
or to open an email client so the user can access their mailbox — for example, to open a confirmation email sent by your app.

```typescript
getClients(): MailClient[]
```

**Returns:** An array of available mail clients.

#### isAvailableAsync

Determine if the `MailComposer` API can be used in this app.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise resolves to `true` if the API can be used, and `false` otherwise.
- Returns `true` when the device has a default email setup for sending mail.
- Can return `false` on iOS if an MDM profile is setup to block outgoing mail. If this is the
case, you may want to use the Linking API instead.
- Always returns `true` in the browser.

### Types


#### MailClient

Represents a mail client available on the device.

| Property | Type | Description |
| --- | --- | --- |
| `label` | `string` | The display name of the mail client. |
| `packageName` | `string` | The package name of the mail client application. You can use this package name with the [`getApplicationIconAsync`]() or [`openApplication`]() functions from [`expo-intent-launcher`]() to retrieve the app’s icon or open the mail client directly. |
| `url` | `string` | The URL scheme of the mail client. You can use this URL with the [`openURL`]() function from [`expo-linking`]() to open the mail client. |

#### MailComposerOptions

A map defining the data to fill the mail.

| Property | Type | Description |
| --- | --- | --- |
| `attachments` | `string[]` | An array of app's internal file URIs to attach. |
| `bccRecipients` | `string[]` | An array of e-mail addresses of the BCC recipients. |
| `body` | `string` | Body of the e-mail. |
| `ccRecipients` | `string[]` | An array of e-mail addresses of the CC recipients. |
| `isHtml` | `boolean` | Whether the body contains HTML tags so it could be formatted properly. Not working perfectly on Android. |
| `recipients` | `string[]` | An array of e-mail addresses of the recipients. |
| `subject` | `string` | Subject of the e-mail. |

#### MailComposerResult

| Property | Type | Description |
| --- | --- | --- |
| `status` | `MailComposerStatus` | - |

### Enums

#### MailComposerStatus

| Value | Description |
| --- | --- |
| `CANCELLED` | - |
| `SAVED` | - |
| `SENT` | - |
| `UNDETERMINED` | - |
