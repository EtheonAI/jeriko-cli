---
name: notifications
description: Schedule local and handle push notifications with actions.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Notifications

A library that provides an API to fetch push notification tokens and to present, schedule, receive and respond to notifications.

## Quick Start

This example shows how to schedule a local notification that will appear in 5 seconds.

```tsx
import { Button, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function scheduleNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "You've got mail! 📬",
      body: 'Here is the notification body',
    },
    trigger: { seconds: 5 },
  });
}

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Schedule Notification" onPress={scheduleNotification} />
    </View>
  );
}
```

## When to Use

Use the `expo-notifications` module when you need to implement local or push notifications in your application. This is useful for sending alerts, reminders, or updates to your users, even when the app is in the background or closed.

## Common Pitfalls

### 1. Not requesting permissions

**Problem**: Notifications don't appear on the device.

**Solution**: You must request permission from the user before you can send them notifications. You can do this using the `requestPermissionsAsync` method.

```tsx
async function registerForPushNotificationsAsync() {
  let token;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    alert('Failed to get push token for push notification!');
    return;
  }
}
```

### 2. Not handling notifications in the foreground

**Problem**: Notifications are not visible when the app is in the foreground.

**Solution**: By default, notifications are not shown when the app is in the foreground. To change this, you need to set a notification handler.

```tsx
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
```

## Common Patterns

### 1. Task reminder scheduled from a due date

This pattern shows how to schedule a reminder relative to a task's due date (e.g. 30 minutes before).

```ts
import * as Notifications from 'expo-notifications';

export async function scheduleTaskReminder(task: {
  id: string;
  title: string;
  dueDate: Date;
}) {
  const triggerDate = new Date(task.dueDate);
  triggerDate.setMinutes(triggerDate.getMinutes() - 30);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Task due soon',
      body: task.title,
      data: { taskId: task.id },
    },
    trigger: { type: 'date', date: triggerDate },
  });
}
```

### 1. Scheduling a recurring notification

This pattern shows how to schedule a notification that repeats every day at 9 AM.

```tsx
async function scheduleDailyNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Good morning!',
      body: 'Check out the latest news in your feed.',
    },
    trigger: {
      hour: 9,
      minute: 0,
      repeats: true,
    },
  });
}
```

**Platforms:** android*, ios* (asterisk indicates additional setup/permissions required; not supported on web)

**Package:** `expo-notifications`

`expo-notifications` provides an API to fetch push notification tokens and to present, schedule, receive and respond to notifications.

**[Notification guides](/push-notifications/overview/)**

Do not miss our guides on how to set up, send, and handle push notifications.

> **warning** Push notifications (remote notifications) functionality provided by `expo-notifications` is unavailable in Expo Go on Android from SDK 53. A [development build](/develop/development-builds/introduction/) is required to use push notifications. Local notifications (in-app notifications) remain available in Expo Go.

## Features

- Schedule a one-off notification for a specific date or some time from now
- Schedule a notification repeating in some time interval (or a calendar date match on iOS)
- Get and set the application badge icon number
- Obtain a native device push token, so you can send push notifications with FCM (for Android) and APNs (for iOS)
- Obtain an Expo push token, so you can send push notifications with [Expo Push Service](/push-notifications/sending-notifications/)
- Listen to incoming notifications in the foreground and background
- Listen to interactions with notifications
- Handle notifications when the app is in the foreground
- Imperatively dismiss notifications from Notification Center/tray
- Create, update, and delete [Android notification channels](https://developer.android.com/develop/ui/views/notifications/channels)
- Set custom icon and color for notifications on Android

## Installation

```bash
$ npx expo install expo-notifications
```

Then proceed to [configuration](#configuration) to set up the [config plugin](#app-config) and
obtain the [credentials](#credentials) for push notifications.

### Known issues

When launching the app from a push notification in **Android development builds**, the splash screen may fail to display correctly about 70% of the time. The icon and fade animation may not appear as expected.

- Icon may be missing
- Fade animation may not run
- Only the background color may flash briefly

This issue only affects debug builds and does not occur in release builds. To workaround it, test notification launches in release mode (`npx expo run:android --variant release`) for accurate behavior.

## Usage

Check out the example Snack below to see Notifications in action, make sure to use a physical device to test it. Push notifications don't work on emulators/simulators.

```tsx
import { useState, useEffect, useRef } from 'react';
import { Text, View, Button, Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function App() {
  const [expoPushToken, setExpoPushToken] = useState('');
  const [channels, setChannels] = useState<Notifications.NotificationChannel[]>([]);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(
    undefined
  );

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => token && setExpoPushToken(token));

    if (Platform.OS === 'android') {
      Notifications.getNotificationChannelsAsync().then(value => setChannels(value ?? []));
    }
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'space-around',
      }}>
      <Text>Your expo push token: {expoPushToken}</Text>
      <Text>{`Channels: ${JSON.stringify(
        channels.map(c => c.id),
        null,
        2
      )}`}</Text>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Text>Title: {notification && notification.request.content.title} </Text>
        <Text>Body: {notification && notification.request.content.body}</Text>
        <Text>Data: {notification && JSON.stringify(notification.request.content.data)}</Text>
      </View>
      <Button
        title="Press to schedule a notification"
        onPress={async () => {
          await schedulePushNotification();
        }}
      />
    </View>
  );
}

async function schedulePushNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "You've got mail! 📬",
      body: 'Here is the notification body',
      data: { data: 'goes here', test: { test1: 'more data' } },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
    },
  });
}

async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('myNotificationChannel', {
      name: 'A channel is needed for the permissions prompt to appear',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token for push notification!');
      return null;
    }
    // Learn more about projectId:
    // https://docs.expo.dev/push-notifications/push-notifications-setup/#configure-projectid
    // EAS projectId is used here.
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
        throw new Error('Project ID not found');
      }
      token = (
        await Notifications.getExpoPushTokenAsync({
          projectId,
        })
      ).data;
      console.log(token);
    } catch (e) {
      token = `${e}`;
    }
  } else {
    alert('Must use physical device for Push Notifications');
  }

  return token;
}
```

### Present a local (in-app) notification to the user

```ts
import * as Notifications from 'expo-notifications';

// First, set the handler that will cause the notification
// to show the alert
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Second, call scheduleNotificationAsync()
Notifications.scheduleNotificationAsync({
  content: {
    title: 'Look at that notification',
    body: "I'm so proud of myself!",
  },
  trigger: null,
});
```

### Handle push notifications with navigation

If you'd like to deep link to a specific screen in your app when you receive a push notification, you can configure either of Expo's navigation systems to do that.

You can use Expo Router's [built-in deep linking](/router/basics/core-concepts/#2-all-pages-have-a-url) to handle incoming URLs from push notifications. Simply configure the root layout to listen for incoming and initial notification events.

**Example:** app/_layout.tsx
```tsx

function useNotificationObserver() {
  useEffect(() => {
    function redirect(notification: Notifications.Notification) {
      const url = notification.request.content.data?.url;
      if (typeof url === 'string') {
        /* @info Push the URL. You may want to verify the format before navigating. */
        router.push(url);
        /* @end */
      }
    }

    /* @info Handle the initial push notification. */
    const response = Notifications.getLastNotificationResponse();
    if (response?.notification) {
      redirect(response.notification);
    }

    /* @info Listen for runtime notifications. */
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      /* @end */
      redirect(response.notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

export default function Layout() {
  /* @info Observe at the root. Ensure this layout never returns <b>null</b> or the navigation will go unhandled. */
  useNotificationObserver();
  /* @end */

  return null;
}
```

React Navigation's manual [linking configuration](https://reactnavigation.org/docs/navigation-container#linking) can be configured to handle incoming redirects from push notifications:

**Example:** App.tsx
```tsx

export default function App() {
  return (
    listener(url);

          // Listen to incoming links from deep linking
          const eventListenerSubscription = Linking.addEventListener('url', onReceiveURL);

          // Listen to expo push notifications
          const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const url = response.notification.request.content.data.url;

            // Any custom logic to see whether the URL needs to be handled
            //...

            // Let React Navigation handle the URL
            listener(url);
          });

          return () => {
            // Clean up the event listeners
            eventListenerSubscription.remove();
            subscription.remove();
          };
        },
      }}>
  );
}
```

See more details on [React Navigation documentation](https://reactnavigation.org/docs/deep-linking/#third-party-integrations).

## Configuration

### Credentials

Follow the [setup guide](/push-notifications/push-notifications-setup/#get-credentials-for-development-builds).

### App config

To configure `expo-notifications`, use the built-in [config plugin](/config-plugins/introduction/) in the app config (**app.json** or **app.config.js**) for [EAS Build](/build/introduction) or with `npx expo run:[android|ios]`. The plugin allows you to configure the following properties that cannot be set at runtime and require building a new app binary to take effect:

Here is an example of using the config plugin in the app config file:

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./local/assets/notification_icon.png",
          "color": "#ffffff",
          "defaultChannel": "default",
          "sounds": [
            "./local/assets/notification_sound.wav",
            "./local/assets/notification_sound_other.wav"
          ],
          "enableBackgroundRemoteNotifications": false
        }
      ]
    ]
  }
}
```

> The iOS APNs entitlement is _always_ set to 'development'. Xcode automatically changes this to 'production' in the archive generated by a release build.
> [Learn more](https://stackoverflow.com/a/42293632/4047926).

Learn how to configure the native projects in the [installation instructions in the `expo-notifications` repository](https://github.com/expo/expo/tree/main/packages/expo-notifications#installation-in-bare-react-native-projects).

## Permissions

### Android

- On Android, this module requires permission to subscribe to the device boot. It's used to set up scheduled notifications when the device (re)starts.
  The `RECEIVE_BOOT_COMPLETED` permission is added automatically through the library's **AndroidManifest.xml**.

- Starting from Android 12 (API level 31), to schedule a notification that triggers at an exact time, you need to add
  `<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>` to **AndroidManifest.xml**.
  Read more about the [exact alarm permission](https://developer.android.com/about/versions/12/behavior-changes-12#exact-alarm-permission).

- On Android 13, app users must opt-in to receive notifications via a permissions prompt automatically triggered by the operating system.
  This prompt will not appear until at least one notification channel is created. The `setNotificationChannelAsync` must be called before
  `getDevicePushTokenAsync` or `getExpoPushTokenAsync` to obtain a push token. You can read more about the new notification permission behavior for Android 13
  in the [official documentation](https://developer.android.com/develop/ui/views/notifications/notification-permission#new-apps).

<!-- (Expo docs component omitted) -->

### iOS

No usage description is required, see [notification-related permissions](#fetch-information-about-notifications-related-permissions).

### Interpret the iOS permissions response

On iOS, permissions for sending notifications are a little more granular than they are on Android. This is why you should rely on the `NotificationPermissionsStatus`'s `ios.status` field, instead of the root `status` field.

This value will be one of the following, accessible under `Notifications.IosAuthorizationStatus`:

- `NOT_DETERMINED`: The user hasn't yet made a choice about whether the app is allowed to schedule notifications
- `DENIED`: The app isn't authorized to schedule or receive notifications
- `AUTHORIZED`: The app is authorized to schedule or receive notifications
- `PROVISIONAL`: The app is provisionally authorized to post noninterruptive user notifications
- `EPHEMERAL`: The app is authorized to schedule or receive notifications for a limited amount of time

## Notification events listeners

Notification events include incoming notifications, interactions your users perform with notifications (this can be tapping on a notification, or interacting with it via [notification categories](#manage-notification-categories-interactive-notifications)), and rare occasions when your notifications may be dropped.

Several listeners are exposed and documented in the [Push notification behaviors](/push-notifications/what-you-need-to-know/#push-notification-behaviors) section.

## Headless (Background) notifications

See the [definition](/push-notifications/what-you-need-to-know/#headless-background-notifications) of Headless Background Notifications in the [What you need to know](/push-notifications/what-you-need-to-know) guide.

To handle notifications while the app is in the background or not running, you need to do the following:

- Add `expo-task-manager` package to your project.
- [Configure background notifications](#background-notification-configuration).
- In your application code, set up a [background task](#registertaskasynctaskname) to run when the notification is received.

Then send a push notification which:

- Contains only the `data` key (no `title`, `body`)
- Has `_contentAvailable: true` set for iOS &mdash; see the [Expo push notification service payload format](/push-notifications/sending-notifications/#message-request-format)

### Background notification configuration&ensp;(platforms: ["ios"])

To be able to use background push notifications on iOS, the `remote-notification` value needs to be present in the `UIBackgroundModes` array in your app's **Info.plist** file.

**If you're using [CNG](/workflow/continuous-native-generation/)**, set the [`enableBackgroundRemoteNotifications` property](#configurable-properties) of the config plugin to true, and the correct configuration will be applied automatically by prebuild.

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) or you're using a native iOS project, then you'll need to add the following to your **Expo.plist** file:

**Example:** ios/project-name/Supporting/Expo.plist
```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

## Additional information

### Set custom notification sounds

To add custom push notification sounds to your app, add the `expo-notifications` plugin to your **app.json** file and then under the `sounds` key, provide an array of local paths to sound files that can be used as custom notification sounds. These local paths are local to your project.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "sounds": ["local/path/to/mySoundFile.wav"]
        }
      ]
    ]
  }
}
```

After building your app, the array of files will be available for use in both [`NotificationContentInput`](#notificationcontentinput) and [`NotificationChannelInput`](#notificationchannelinput).
You only need to provide the base filename. Here's an example using the config above:

```ts
await Notifications.setNotificationChannelAsync('new_emails', {
  name: 'E-mail notifications',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'mySoundFile.wav', // Provide ONLY the base filename
});

await Notifications.scheduleNotificationAsync({
  content: {
    title: "You've got mail! 📬",
    sound: 'mySoundFile.wav', // Provide ONLY the base filename
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 2,
    channelId: 'new_emails',
  },
});
```

You can also manually add notification files to your Android and iOS projects if you prefer:

On Androids 8.0+, playing a custom sound for a notification requires more than setting the `sound` property on the `NotificationContentInput`.
You will also need to configure the `NotificationChannel` with the appropriate `sound`, and use it when sending/scheduling the notification.

For the example below to work, you would place your **email_sound.wav** file in **android/app/src/main/res/raw/**.

```ts
// Prepare the notification channel
await Notifications.setNotificationChannelAsync('new_emails', {
  name: 'E-mail notifications',
  importance: Notifications.AndroidImportance.HIGH,
  sound: 'email_sound.wav', // <- for Android 8.0+, see channelId property below
});

// Eg. schedule the notification
await Notifications.scheduleNotificationAsync({
  content: {
    title: "You've got mail! 📬",
    body: 'Open the notification to read them all',
    sound: 'email_sound.wav', // <- for Android below 8.0
  },
  trigger: {
    type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
    seconds: 2,
    channelId: 'new_emails', // <- for Android 8.0+, see definition above
  },
});
```

On iOS, all that's needed is to place your sound file in your Xcode project (see the screenshot below),
and then specify the sound file in your `NotificationContentInput`, like this:

```ts
await Notifications.scheduleNotificationAsync({
  content: {
    title: "You've got mail! 📬",
    body: 'Open the notification to read them all',
    sound: 'notification.wav',
  },
  trigger: {
    // ...
  },
});
```

<!-- (Expo docs component omitted) | asset: /static/images/notification_sound_ios.jpeg -->

### Push notification payload specification

See [Message request format](/push-notifications/sending-notifications/#message-request-format).

### Manage notification categories for interactive notifications

Notification categories allow you to create interactive push notifications, so that a user can respond directly to the incoming notification
either via buttons or a text response. A category defines the set of actions a user can take, and then those actions are applied to a notification
by specifying the `categoryIdentifier` in the [`NotificationContent`](#notificationcontent).

<!-- (Expo docs component omitted) | asset: /static/images/sdk/notifications/categories.png -->

On iOS, notification categories also allow you to customize your notifications further. With each category, not only can you set interactive actions a user can take, but you can also configure things like the placeholder text to display when the user disables notification previews for your app.

## Platform-specific guides

### Handling notification channels&ensp;(platforms: ['android 8+'])

Starting in Android 8.0 (API level 26), all notifications must be assigned to a channel. For each channel,
you can set the visual and auditory behavior that is applied to all notifications in that channel.
Then, users can change these settings and decide which notification channels from your app should be intrusive or visible at all,
as [Android developer docs](https://developer.android.com/training/notify-user/channels) states.

If you do not specify a notification channel, `expo-notifications` will create a fallback channel for you, named **Miscellaneous**.
We encourage you to always ensure appropriate channels with informative names are set up for the application and to always send notifications to these channels.

> Calling these methods is a no-op for platforms that do not support this feature (Android below version 8.0 (26) and iOS).

### Custom notification icon and colors&ensp;(platforms: ['android'])

You can configure the [`notification.icon`](../config/app/#notification) and [`notification.color`](../config/app/#notification) keys in the project's **app.json** if you are using [Expo Prebuild](/workflow/prebuild) or by using the [`expo-notifications` config plugin directly](#configurable-properties). These are build-time settings, so you'll need to recompile your native Android app with `eas build -p android` or `npx expo run:android` to see the changes.

For your notification icon, make sure you follow [Google's design guidelines](https://material.io/design/iconography/product-icons.html#design-principles)
(the icon must be all white with a transparent background) or else it may not be displayed as intended.

You can also set a custom notification color **per-notification** directly in your [`NotificationContentInput`](#notificationcontentinput) under the `color` attribute.

## API

```js

```

## API Reference

### Methods

#### addNotificationReceivedListener

Listeners registered by this method will be called whenever a notification is received while the app is running.

```typescript
addNotificationReceivedListener(listener: (event: Notification) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: Notification) => void` | A function accepting a notification ([`Notification`](#notification)) as an argument. |

**Returns:** An [`EventSubscription`](#eventsubscription) object represents the subscription of the provided listener.

#### addNotificationResponseReceivedListener

Listeners registered by this method will be called whenever a user interacts with a notification (for example, taps on it).

```typescript
addNotificationResponseReceivedListener(listener: (event: NotificationResponse) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: NotificationResponse) => void` | A function accepting notification response ([`NotificationResponse`](#notificationresponse)) as an argument. |

**Returns:** An [`EventSubscription`](#eventsubscription) object represents the subscription of the provided listener.

#### addNotificationsDroppedListener

Listeners registered by this method will be called whenever some notifications have been dropped by the server.
Applicable only to Firebase Cloud Messaging which we use as a notifications service on Android. It corresponds to `onDeletedMessages()` callback.
More information can be found in [Firebase docs](https://firebase.google.com/docs/cloud-messaging/android/receive#override-ondeletedmessages).

```typescript
addNotificationsDroppedListener(listener: () => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `() => void` | A callback function. |

**Returns:** An [`EventSubscription`](#eventsubscription) object represents the subscription of the provided listener.

#### addPushTokenListener

In rare situations, a push token may be changed by the push notification service while the app is running.
When a token is rolled, the old one becomes invalid and sending notifications to it will fail.
A push token listener will let you handle this situation gracefully by registering the new token with your backend right away.

```typescript
addPushTokenListener(listener: PushTokenListener): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `PushTokenListener` | A function accepting a push token as an argument, it will be called whenever the push token changes. |

**Returns:** An [`EventSubscription`](#eventsubscription) object represents the subscription of the provided listener.

#### cancelAllScheduledNotificationsAsync

Cancels all scheduled notifications.

```typescript
cancelAllScheduledNotificationsAsync(): Promise<void>
```

**Returns:** A Promise that resolves once all the scheduled notifications are successfully canceled, or if there are no scheduled notifications.

#### cancelScheduledNotificationAsync

Cancels a single scheduled notification. The scheduled notification of given ID will not trigger.

```typescript
cancelScheduledNotificationAsync(identifier: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | The notification identifier with which `scheduleNotificationAsync` method resolved when the notification has been scheduled. |

**Returns:** A Promise resolves once the scheduled notification is successfully canceled or if there is no scheduled notification for a given identifier.

#### clearLastNotificationResponse

Clears the notification response that was received most recently. May be used
when an app selects a route based on the notification response, and it is undesirable
to continue selecting the route after the response has already been handled.

If a component is using the [`useLastNotificationResponse`](#uselastnotificationresponse) hook,
this call will also clear the value returned by the hook.

```typescript
clearLastNotificationResponse(): void
```

#### clearLastNotificationResponseAsync

Clears the notification response that was received most recently. May be used
when an app selects a route based on the notification response, and it is undesirable
to continue selecting the route after the response has already been handled.

If a component is using the [`useLastNotificationResponse`](#uselastnotificationresponse) hook,
this call will also clear the value returned by the hook.

```typescript
clearLastNotificationResponseAsync(): Promise<void>
```

**Returns:** A promise that resolves if the native call was successful.

#### deleteNotificationCategoryAsync

Deletes the category associated with the provided identifier.

**Platform:** android

```typescript
deleteNotificationCategoryAsync(identifier: string): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | Identifier initially provided to `setNotificationCategoryAsync` when creating the category. |

**Returns:** A Promise which resolves to `true` if the category was successfully deleted, or `false` if it was not.
An example of when this method would return `false` is if you try to delete a category that doesn't exist.

#### deleteNotificationChannelAsync

Removes the notification channel.

**Platform:** android

```typescript
deleteNotificationChannelAsync(channelId: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | The channel identifier. |

**Returns:** A Promise which resolving once the channel is removed (or if there was no channel for given identifier).

#### deleteNotificationChannelGroupAsync

Removes the notification channel group and all notification channels that belong to it.

**Platform:** android

```typescript
deleteNotificationChannelGroupAsync(groupId: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupId` | `string` | The channel group identifier. |

**Returns:** A Promise which resolves once the channel group is removed (or if there was no channel group for given identifier).

#### dismissAllNotificationsAsync

Removes all application's notifications displayed in the notification tray (Notification Center).

```typescript
dismissAllNotificationsAsync(): Promise<void>
```

**Returns:** A Promise which resolves once the request to dismiss the notifications is successfully dispatched to the notifications manager.

#### dismissNotificationAsync

Removes notification displayed in the notification tray (Notification Center).

```typescript
dismissNotificationAsync(notificationIdentifier: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `notificationIdentifier` | `string` | The notification identifier, obtained either via `setNotificationHandler` method or in the listener added with `addNotificationReceivedListener`. |

**Returns:** A Promise which resolves once the request to dismiss the notification is successfully dispatched to the notifications manager.

#### getAllScheduledNotificationsAsync

Fetches information about all scheduled notifications.

```typescript
getAllScheduledNotificationsAsync(): Promise<NotificationRequest[]>
```

**Returns:** Returns a Promise resolving to an array of objects conforming to the [`Notification`](#notification) interface.

#### getBadgeCountAsync

Fetches the number currently set as the badge of the app icon on device's home screen. A `0` value means that the badge is not displayed.
> **Note:** Not all Android launchers support application badges. If the launcher does not support icon badges, the method will always resolve to `0`.

```typescript
getBadgeCountAsync(): Promise<number>
```

**Returns:** Returns a Promise resolving to a number that represents the current badge of the app icon.

#### getDevicePushTokenAsync

Returns a native FCM, APNs token or a [`PushSubscription` data](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription)
that can be used with another push notification service.

```typescript
getDevicePushTokenAsync(): Promise<DevicePushToken>
```

#### getExpoPushTokenAsync

Returns an Expo token that can be used to send a push notification to the device using Expo's push notifications service.

This method makes requests to the Expo's servers. It can get rejected in cases where the request itself fails
(for example, due to the device being offline, experiencing a network timeout, or other HTTPS request failures).
To provide offline support to your users, you should `try/catch` this method and implement retry logic to attempt
to get the push token later, once the device is back online.

> For Expo's backend to be able to send notifications to your app, you will need to provide it with push notification keys.
For more information, see [credentials](/push-notifications/push-notifications-setup/#get-credentials-for-development-builds) in the push notifications setup.

```typescript
getExpoPushTokenAsync(options: ExpoPushTokenOptions): Promise<ExpoPushToken>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `ExpoPushTokenOptions` | Object allowing you to pass in push notification configuration. |

**Returns:** Returns a `Promise` that resolves to an object representing acquired push token.

#### getLastNotificationResponse

Gets the notification response that was received most recently
(a notification response designates an interaction with a notification, such as tapping on it).

- `null` - if no notification response has been received yet
- a [`NotificationResponse`](#notificationresponse) object - if a notification response was received

```typescript
getLastNotificationResponse(): NotificationResponse | null
```

#### getLastNotificationResponseAsync

Gets the notification response received most recently
(a notification response designates an interaction with a notification, such as tapping on it).

- `null` - if no notification response has been received yet
- a [`NotificationResponse`](#notificationresponse) object - if a notification response was received

```typescript
getLastNotificationResponseAsync(): Promise<NotificationResponse | null>
```

#### getNextTriggerDateAsync

Allows you to check what will be the next trigger date for given notification trigger input.

```typescript
getNextTriggerDateAsync(trigger: SchedulableNotificationTriggerInput): Promise<number | null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `trigger` | `SchedulableNotificationTriggerInput` | The schedulable notification trigger you would like to check next trigger date for (of type [`SchedulableNotificationTriggerInput`](#schedulablenotificationtriggerinput)). |

**Returns:** If the return value is `null`, the notification won't be triggered. Otherwise, the return value is the Unix timestamp in milliseconds
at which the notification will be triggered.

#### getNotificationCategoriesAsync

Fetches information about all known notification categories.

**Platform:** android

```typescript
getNotificationCategoriesAsync(): Promise<NotificationCategory[]>
```

**Returns:** A Promise which resolves to an array of `NotificationCategory`s. On platforms that do not support notification channels,
it will always resolve to an empty array.

#### getNotificationChannelAsync

Fetches information about a single notification channel.

**Platform:** android

```typescript
getNotificationChannelAsync(channelId: string): Promise<NotificationChannel | null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | The channel's identifier. |

**Returns:** A Promise which resolves to the channel object (of type [`NotificationChannel`](#notificationchannel)) or to `null`
if there was no channel found for this identifier. On platforms that do not support notification channels, it will always resolve to `null`.

#### getNotificationChannelGroupAsync

Fetches information about a single notification channel group.

**Platform:** android

```typescript
getNotificationChannelGroupAsync(groupId: string): Promise<NotificationChannelGroup | null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupId` | `string` | The channel group's identifier. |

**Returns:** A Promise which resolves to the channel group object (of type [`NotificationChannelGroup`](#notificationchannelgroup))
or to `null` if there was no channel group found for this identifier. On platforms that do not support notification channels,
it will always resolve to `null`.

#### getNotificationChannelGroupsAsync

Fetches information about all known notification channel groups.

**Platform:** android

```typescript
getNotificationChannelGroupsAsync(): Promise<NotificationChannelGroup[]>
```

**Returns:** A Promise which resoles to an array of channel groups. On platforms that do not support notification channel groups,
it will always resolve to an empty array.

#### getNotificationChannelsAsync

Fetches information about all known notification channels.

**Platform:** android

```typescript
getNotificationChannelsAsync(): Promise<NotificationChannel[]>
```

**Returns:** A Promise which resolves to an array of channels. On platforms that do not support notification channels,
it will always resolve to an empty array.

#### getPermissionsAsync

Calling this function checks current permissions settings related to notifications.
It lets you verify whether the app is currently allowed to display alerts, play sounds, etc.
There is no user-facing effect of calling this.

```typescript
getPermissionsAsync(): Promise<NotificationPermissionsStatus>
```

**Returns:** It returns a `Promise` resolving to an object represents permission settings ([`NotificationPermissionsStatus`](#notificationpermissionsstatus)).
On iOS, make sure you [properly interpret the permissions response](#interpret-the-ios-permissions-response).

#### getPresentedNotificationsAsync

Fetches information about all notifications present in the notification tray (Notification Center).
> This method is not supported on Android below 6.0 (API level 23) – on these devices it will resolve to an empty array.

```typescript
getPresentedNotificationsAsync(): Promise<Notification[]>
```

**Returns:** A Promise which resolves with a list of notifications ([`Notification`](#notification)) currently present in the notification tray (Notification Center).

#### registerTaskAsync

Call `registerTaskAsync` to set a callback (task) that runs when a notification is received while the app is in foreground, background, or terminated.
Only on Android, the task also runs in response to a notification action press when the app is backgrounded or terminated.
When the app is terminated, only a [Headless Background Notification](/push-notifications/what-you-need-to-know/#headless-background-notifications) triggers the task execution.
However, the OS may decide not to deliver the notification to your app in some cases (e.g. when the device is in Doze mode on Android, or when you send too many notifications - Apple recommends to not ["send more than two or three per hour"](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app#overview)).

Under the hood, this function is run using `expo-task-manager`. You **must** define the task first, with [`TaskManager.defineTask`]() and register it with `registerTaskAsync`.

Make sure you define and register the task in the module scope of a JS module which is required early by your app (e.g. in the `index.js` file).
`expo-task-manager` loads your app's JS bundle in the background and executes the task, as well as any side effects which may happen as a consequence of requiring any JS modules.

The callback function you define with `TaskManager.defineTask` receives an object with the following fields:
- `data`: The remote payload delivered by either FCM (Android) or APNs (iOS). See [`NotificationTaskPayload`](#notificationtaskpayload) for details.
- `error`: The error (if any) that occurred during execution of the task.
- `executionInfo`: JSON object of additional info related to the task, including the `taskName`.

```typescript
registerTaskAsync(taskName: string): Promise<null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | The string you passed to `TaskManager.defineTask` as the `taskName` parameter. |

#### requestPermissionsAsync

Prompts the user for notification permissions according to request. **Request defaults to asking the user to allow displaying alerts,
setting badge count and playing sounds**.

```typescript
requestPermissionsAsync(permissions: NotificationPermissionsRequest): Promise<NotificationPermissionsStatus>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `permissions` | `NotificationPermissionsRequest` | An object representing configuration for the request scope. |

**Returns:** It returns a Promise resolving to an object represents permission settings ([`NotificationPermissionsStatus`](#notificationpermissionsstatus)).
On iOS, make sure you [properly interpret the permissions response](#interpret-the-ios-permissions-response).

#### scheduleNotificationAsync

Schedules a notification to be triggered in the future.
> **Note:** This does not mean that the notification will be presented when it is triggered.
For the notification to be presented you have to set a notification handler with [`setNotificationHandler`](#setnotificationhandlerhandler)
that will return an appropriate notification behavior. For more information see the example below.

```typescript
scheduleNotificationAsync(request: NotificationRequestInput): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `request` | `NotificationRequestInput` | An object describing the notification to be triggered. |

**Returns:** Returns a Promise resolving to a string which is a notification identifier you can later use to cancel the notification or to identify an incoming notification.

#### setBadgeCountAsync

Sets the badge of the app's icon to the specified number. Setting it to `0` clears the badge. On iOS, this method requires that you have requested
the user's permission for `allowBadge` via [`requestPermissionsAsync`](#requestpermissionsasyncpermissions),
otherwise it will automatically return `false`.
> **Note:** Not all Android launchers support application badges. If the launcher does not support icon badges, the method will resolve to `false`.

```typescript
setBadgeCountAsync(badgeCount: number, options: SetBadgeCountOptions): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `badgeCount` | `number` | The count which should appear on the badge. A value of `0` will clear the badge. |
| `options` | `SetBadgeCountOptions` | An object of options configuring behavior applied. |

**Returns:** It returns a Promise resolving to a boolean representing whether the setting of the badge succeeded.

#### setNotificationCategoryAsync

Sets the new notification category.

**Platform:** android

```typescript
setNotificationCategoryAsync(identifier: string, actions: NotificationAction[], options: NotificationCategoryOptions): Promise<NotificationCategory>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | A string to associate as the ID of this category. You will pass this string in as the `categoryIdentifier` in your [`NotificationContent`](#notificationcontent) to associate a notification with this category. > Don't use the characters `:` or `-` in your category identifier. If you do, categories might not work as expected. |
| `actions` | `NotificationAction[]` | An array of [`NotificationAction`](#notificationaction), which describe the actions associated with this category. |
| `options` | `NotificationCategoryOptions` | An optional object of additional configuration options for your category. |

**Returns:** A Promise which resolves to the category you just have created.

#### setNotificationChannelAsync

Assigns the channel configuration to a channel of a specified name (creating it if need be).
This method lets you assign given notification channel to a notification channel group.

> **Note:** After a channel has been created, you can modify only its name and description. This limitation is imposed by the Android OS.

> **Note:** For some settings to be applied on all Android versions, it may be necessary to duplicate the configuration across both
> a single notification and its respective notification channel.

For example, for a notification to play a custom sound on Android versions **below** 8.0,
the custom notification sound has to be set on the notification (through the [`NotificationContentInput`](#notificationcontentinput)),
and for the custom sound to play on Android versions **above** 8.0, the relevant notification channel must have the custom sound configured
(through the [`NotificationChannelInput`](#notificationchannelinput)). For more information,
see [Set custom notification sounds on Android](#set-custom-notification-sounds).

**Platform:** android

```typescript
setNotificationChannelAsync(channelId: string, channel: NotificationChannelInput): Promise<NotificationChannel | null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | The channel identifier. |
| `channel` | `NotificationChannelInput` | Object representing the channel's configuration. |

**Returns:** A Promise which resolving to the object (of type [`NotificationChannel`](#notificationchannel)) describing the modified channel
or to `null` if the platform does not support notification channels.

#### setNotificationChannelGroupAsync

Assigns the channel group configuration to a channel group of a specified name (creating it if need be).

**Platform:** android

```typescript
setNotificationChannelGroupAsync(groupId: string, group: NotificationChannelGroupInput): Promise<NotificationChannelGroup | null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupId` | `string` | The channel group's identifier. |
| `group` | `NotificationChannelGroupInput` | Object representing the channel group configuration. |

**Returns:** A `Promise` resolving to the object (of type [`NotificationChannelGroup`](#notificationchannelgroup))
describing the modified channel group or to `null` if the platform does not support notification channels.

#### setNotificationHandler

When a notification is received while the app is running, using this function you can set a callback that will decide
whether the notification should be shown to the user or not.

When a notification is received, `handleNotification` is called with the incoming notification as an argument.
The function should respond with a behavior object within 3 seconds, otherwise, the notification will be discarded.
If the notification is handled successfully, `handleSuccess` is called with the identifier of the notification,
otherwise (or on timeout) `handleError` will be called.

The default behavior when the handler is not set or does not respond in time is not to show the notification.

```typescript
setNotificationHandler(handler: null | NotificationHandler): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `handler` | `null | NotificationHandler` | A single parameter which should be either `null` (if you want to clear the handler) or a [`NotificationHandler`](#notificationhandler) object. |

#### unregisterForNotificationsAsync

```typescript
unregisterForNotificationsAsync(): Promise<void>
```

#### unregisterTaskAsync

Used to unregister tasks registered with `registerTaskAsync` method.

```typescript
unregisterTaskAsync(taskName: string): Promise<null>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | The string you passed to `registerTaskAsync` as the `taskName` parameter. |

#### useLastNotificationResponse

A React hook which returns the notification response that was received most recently
(a notification response designates an interaction with a notification, such as tapping on it).

To clear the last notification response, use [`clearLastNotificationResponseAsync()`](#notificationsclearlastnotificationresponseasync).

> If you don't want to use a hook, you can use `Notifications.getLastNotificationResponseAsync()` instead.

```typescript
useLastNotificationResponse(): MaybeNotificationResponse
```

**Returns:** The hook may return one of these three types/values:
- `undefined` - until we're sure of what to return,
- `null` - if no notification response has been received yet,
- a [`NotificationResponse`](#notificationresponse) object - if a notification response was received.

### Interfaces

#### AudioAttributes

| Property | Type | Description |
| --- | --- | --- |
| `contentType` | `AndroidAudioContentType` | - |
| `flags` | `{ enforceAudibility: boolean; requestHardwareAudioVideoSynchronization: boolean }` | - |
| `usage` | `AndroidAudioUsage` | - |

#### BeaconRegion

A region used to detect the presence of iBeacon devices. Based on Core Location [`CLBeaconRegion`](https://developer.apple.com/documentation/corelocation/clbeaconregion) class.

| Property | Type | Description |
| --- | --- | --- |
| `beaconIdentityConstraint` | `{ major: null | number; minor: null | number; uuid: string }` | The beacon identity constraint that defines the beacon region. |
| `identifier` | `string` | The identifier for the region object. |
| `major` | `null | number` | The major value from the beacon identity constraint that defines the beacon region. |
| `minor` | `null | number` | The minor value from the beacon identity constraint that defines the beacon region. |
| `notifyEntryStateOnDisplay` | `boolean` | A Boolean value that indicates whether Core Location sends beacon notifications when the device’s display is on. |
| `notifyOnEntry` | `boolean` | Indicates whether notifications are generated upon entry into the region. |
| `notifyOnExit` | `boolean` | Indicates whether notifications are generated upon exit from the region. |
| `type` | `'beacon'` | - |
| `uuid` | `string` | The UUID value from the beacon identity constraint that defines the beacon region. |

#### CalendarNotificationTrigger

A trigger related to a [`UNCalendarNotificationTrigger`](https://developer.apple.com/documentation/usernotifications/uncalendarnotificationtrigger?language=objc).

| Property | Type | Description |
| --- | --- | --- |
| `dateComponents` | `{ calendar: string; day: number; era: number; hour: number; isLeapMonth: boolean; minute: number; month: number; nanosecond: number; quarter: number; second: number; timeZone: string; weekday: number; weekdayOrdinal: number; weekOfMonth: number; weekOfYear: number; year: number; yearForWeekOfYear: number }` | - |
| `repeats` | `boolean` | - |
| `type` | `'calendar'` | - |

#### CircularRegion

A circular geographic region, specified as a center point and radius. Based on Core Location [`CLCircularRegion`](https://developer.apple.com/documentation/corelocation/clcircularregion) class.

| Property | Type | Description |
| --- | --- | --- |
| `center` | `{ latitude: number; longitude: number }` | The center point of the geographic area. |
| `identifier` | `string` | The identifier for the region object. |
| `notifyOnEntry` | `boolean` | Indicates whether notifications are generated upon entry into the region. |
| `notifyOnExit` | `boolean` | Indicates whether notifications are generated upon exit from the region. |
| `radius` | `number` | The radius (measured in meters) that defines the geographic area’s outer boundary. |
| `type` | `'circular'` | - |

#### DailyNotificationTrigger

A trigger related to a daily notification.
> The same functionality will be achieved on iOS with a `CalendarNotificationTrigger`.

| Property | Type | Description |
| --- | --- | --- |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `type` | `'daily'` | - |

#### EventSubscription

A subscription object that allows to conveniently remove an event listener from the emitter.

| Property | Type | Description |
| --- | --- | --- |
| `remove()` | `void` | - |

#### ExpoPushToken

Object which contains the Expo push token in the `data` field. Use the value from `data` to send notifications via Expo Notifications service.

| Property | Type | Description |
| --- | --- | --- |
| `data` | `string` | The acquired push token. |
| `type` | `'expo'` | Always set to `"expo"`. |

#### ExpoPushTokenOptions

| Property | Type | Description |
| --- | --- | --- |
| `applicationId` | `string` | The ID of the application to which the token should be attributed. Defaults to [`Application.applicationId`]() exposed by `expo-application`. |
| `baseUrl` | `string` | Endpoint URL override. |
| `development` | `boolean` | On iOS, there are two push notification services: "sandbox" and "production". This defines whether the push token is supposed to be used with the sandbox platform notification service. Defaults to [`Application.getIosPushNotificationServiceEnvironmentAsync()`]() exposed by `expo-application` or `false`. Most probably you won't need to customize that. You may want to customize that if you don't want to install `expo-application` and still use the sandbox APNs. |
| `deviceId` | `string` | - |
| `devicePushToken` | `DevicePushToken` | The device push token with which to register at the backend. Defaults to a token fetched with [`getDevicePushTokenAsync()`](#getdevicepushtokenasync). |
| `projectId` | `string` | The ID of the project to which the token should be attributed. Defaults to [`Constants.expoConfig.extra.eas.projectId`]() exposed by `expo-constants`. When using EAS Build, this value is automatically set. However, it is **recommended** to set it manually. Once you have EAS Build configured, you can find the value in **app.json** under `extra.eas.projectId`. You can copy and paste it into your code. If you are not using EAS Build, it will fallback to [`Constants.expoConfig?.extra?.eas?.projectId`](). |
| `type` | `string` | Request body override. |
| `url` | `string` | Request URL override. |

#### FirebaseRemoteMessage

A Firebase `RemoteMessage` that caused the notification to be delivered to the app.

| Property | Type | Description |
| --- | --- | --- |
| `collapseKey` | `null | string` | - |
| `data` | `Record<string, string>` | - |
| `from` | `null | string` | - |
| `messageId` | `null | string` | - |
| `messageType` | `null | string` | - |
| `notification` | `null | FirebaseRemoteMessageNotification` | - |
| `originalPriority` | `number` | - |
| `priority` | `number` | - |
| `sentTime` | `number` | - |
| `to` | `null | string` | - |
| `ttl` | `number` | - |

#### FirebaseRemoteMessageNotification

| Property | Type | Description |
| --- | --- | --- |
| `body` | `null | string` | - |
| `bodyLocalizationArgs` | `null | string[]` | - |
| `bodyLocalizationKey` | `null | string` | - |
| `channelId` | `null | string` | - |
| `clickAction` | `null | string` | - |
| `color` | `null | string` | - |
| `eventTime` | `null | number` | - |
| `icon` | `null | string` | - |
| `imageUrl` | `null | string` | - |
| `lightSettings` | `null | number[]` | - |
| `link` | `null | string` | - |
| `localOnly` | `boolean` | - |
| `notificationCount` | `null | number` | - |
| `notificationPriority` | `null | number` | - |
| `sound` | `null | string` | - |
| `sticky` | `boolean` | - |
| `tag` | `null | string` | - |
| `ticker` | `null | string` | - |
| `title` | `null | string` | - |
| `titleLocalizationArgs` | `null | string[]` | - |
| `titleLocalizationKey` | `null | string` | - |
| `usesDefaultLightSettings` | `boolean` | - |
| `usesDefaultSound` | `boolean` | - |
| `usesDefaultVibrateSettings` | `boolean` | - |
| `vibrateTimings` | `null | number[]` | - |
| `visibility` | `null | number` | - |

#### IosNotificationPermissionsRequest

Available configuration for permission request on iOS platform.
See Apple documentation for [`UNAuthorizationOptions`](https://developer.apple.com/documentation/usernotifications/unauthorizationoptions) to learn more.

| Property | Type | Description |
| --- | --- | --- |
| `allowAlert` | `boolean` | The ability to display alerts. |
| `allowBadge` | `boolean` | The ability to update the app’s badge. |
| `allowCriticalAlerts` | `boolean` | The ability to play sounds for critical alerts. |
| `allowDisplayInCarPlay` | `boolean` | The ability to display notifications in a CarPlay environment. |
| `allowProvisional` | `boolean` | The ability to post noninterrupting notifications provisionally to the Notification Center. |
| `allowSound` | `boolean` | The ability to play sounds. |
| `provideAppNotificationSettings` | `boolean` | An option indicating the system should display a button for in-app notification settings. |

#### LocationNotificationTrigger

A trigger related to a [`UNLocationNotificationTrigger`](https://developer.apple.com/documentation/usernotifications/unlocationnotificationtrigger?language=objc).

| Property | Type | Description |
| --- | --- | --- |
| `region` | `CircularRegion | BeaconRegion` | - |
| `repeats` | `boolean` | - |
| `type` | `'location'` | - |

#### MonthlyNotificationTrigger

A trigger related to a monthly notification.
> The same functionality will be achieved on iOS with a `CalendarNotificationTrigger`.

| Property | Type | Description |
| --- | --- | --- |
| `day` | `number` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `type` | `'monthly'` | - |

#### NativeDevicePushToken

| Property | Type | Description |
| --- | --- | --- |
| `data` | `string` | - |
| `type` | `'ios' | 'android'` | - |

#### Notification

An object which represents a single notification that has been triggered by some request ([`NotificationRequest`](#notificationrequest)) at some point in time.

| Property | Type | Description |
| --- | --- | --- |
| `date` | `number` | - |
| `request` | `NotificationRequest` | - |

#### NotificationAction

| Property | Type | Description |
| --- | --- | --- |
| `buttonTitle` | `string` | The title of the button triggering this action. |
| `identifier` | `string` | A unique string that identifies this action. If a user takes this action (for example, selects this button in the system's Notification UI), your app will receive this `actionIdentifier` via the [`NotificationResponseReceivedListener`](#addnotificationresponsereceivedlistenerlistener). |
| `options` | `{ isAuthenticationRequired: boolean; isDestructive: boolean; opensAppToForeground: boolean }` | Object representing the additional configuration options. |
| `textInput` | `{ placeholder: string; submitButtonTitle: string }` | Object which, if provided, will result in a button that prompts the user for a text response. |

#### NotificationBehavior

An object which represents behavior that should be applied to the incoming notification. On Android, this influences whether the notification is shown, a sound is played, and priority. On iOS, this maps directly to [`UNNotificationPresentationOptions`](https://developer.apple.com/documentation/usernotifications/unnotificationpresentationoptions).
> On Android, setting `shouldPlaySound: false` will result in the drop-down notification alert **not** showing, no matter what the priority is.
> This setting will also override any channel-specific sounds you may have configured.

| Property | Type | Description |
| --- | --- | --- |
| `priority` | `AndroidNotificationPriority` | - |
| `shouldPlaySound` | `boolean` | - |
| `shouldSetBadge` | `boolean` | - |
| `shouldShowAlert` | `boolean` | - |
| `shouldShowBanner` | `boolean` | - |
| `shouldShowList` | `boolean` | - |

#### NotificationCategory

| Property | Type | Description |
| --- | --- | --- |
| `actions` | `NotificationAction[]` | - |
| `identifier` | `string` | - |
| `options` | `NotificationCategoryOptions` | - |

#### NotificationChannel

An object which represents a notification channel.

| Property | Type | Description |
| --- | --- | --- |
| `audioAttributes` | `AudioAttributes` | - |
| `bypassDnd` | `boolean` | - |
| `description` | `null | string` | - |
| `enableLights` | `boolean` | - |
| `enableVibrate` | `boolean` | - |
| `groupId` | `null | string` | - |
| `id` | `string` | - |
| `importance` | `AndroidImportance` | - |
| `lightColor` | `string` | - |
| `lockscreenVisibility` | `AndroidNotificationVisibility` | - |
| `name` | `null | string` | - |
| `showBadge` | `boolean` | - |
| `sound` | `null | 'default' | 'custom'` | - |
| `vibrationPattern` | `null | number[]` | - |

#### NotificationChannelGroup

An object which represents a notification channel group.

| Property | Type | Description |
| --- | --- | --- |
| `channels` | `NotificationChannel[]` | - |
| `description` | `null | string` | - |
| `id` | `string` | - |
| `isBlocked` | `boolean` | - |
| `name` | `null | string` | - |

#### NotificationChannelGroupInput

An object which represents a notification channel group to be set.

| Property | Type | Description |
| --- | --- | --- |
| `description` | `null | string` | - |
| `name` | `null | string` | - |

#### NotificationChannelGroupManager

| Property | Type | Description |
| --- | --- | --- |
| `addListener` | `(eventName: string) => void` | - |
| `deleteNotificationChannelGroupAsync` | `(groupId: string) => Promise<void>` | - |
| `getNotificationChannelGroupAsync` | `(groupId: string) => Promise<null | NotificationChannelGroup>` | - |
| `getNotificationChannelGroupsAsync` | `() => Promise<NotificationChannelGroup[]>` | - |
| `removeListeners` | `(count: number) => void` | - |
| `setNotificationChannelGroupAsync` | `(groupId: string, group: NotificationChannelGroupInput) => Promise<null | NotificationChannelGroup>` | - |

#### NotificationChannelManager

| Property | Type | Description |
| --- | --- | --- |
| `addListener` | `(eventName: string) => void` | - |
| `deleteNotificationChannelAsync` | `(channelId: string) => Promise<void>` | - |
| `getNotificationChannelAsync` | `(channelId: string) => Promise<null | NotificationChannel>` | - |
| `getNotificationChannelsAsync` | `() => Promise<null | NotificationChannel[]>` | - |
| `removeListeners` | `(count: number) => void` | - |
| `setNotificationChannelAsync` | `(channelId: string, channelConfiguration: NotificationChannelInput) => Promise<null | NotificationChannel>` | - |

#### NotificationHandler

| Property | Type | Description |
| --- | --- | --- |
| `handleError` | `(notificationId: string, error: NotificationHandlingError) => void` | A function called whenever calling `handleNotification()` for an incoming notification fails. |
| `handleNotification` | `(notification: Notification) => Promise<NotificationBehavior>` | A function accepting an incoming notification returning a `Promise` resolving to a behavior ([`NotificationBehavior`](#notificationbehavior)) applicable to the notification |
| `handleSuccess` | `(notificationId: string) => void` | A function called whenever an incoming notification is handled successfully. |

#### NotificationPermissionsRequest

An interface representing the permissions request scope configuration.
Each option corresponds to a different native platform authorization option.

| Property | Type | Description |
| --- | --- | --- |
| `android` | `object` | On Android, all available permissions are granted by default, and if a user declines any permission, an app cannot prompt the user to change. |
| `ios` | `IosNotificationPermissionsRequest` | Available configuration for permission request on iOS platform. |

#### NotificationPermissionsStatus

An object obtained by permissions get and request functions.

| Property | Type | Description |
| --- | --- | --- |
| `android` | `{ importance: number; interruptionFilter: number }` | - |
| `canAskAgain` | `boolean` | Indicates if user can be asked again for specific permission. If not, one should be directed to the Settings app in order to enable/disable the permission. |
| `expires` | `PermissionExpiration` | Determines time when the permission expires. |
| `granted` | `boolean` | A convenience boolean that indicates if the permission is granted. |
| `ios` | `{ alertStyle: IosAlertStyle; allowsAlert: null | boolean; allowsAnnouncements: null | boolean; allowsBadge: null | boolean; allowsCriticalAlerts: null | boolean; allowsDisplayInCarPlay: null | boolean; allowsDisplayInNotificationCenter: null | boolean; allowsDisplayOnLockScreen: null | boolean; allowsPreviews: IosAllowsPreviews; allowsSound: null | boolean; providesAppNotificationSettings: boolean; status: IosAuthorizationStatus }` | - |
| `status` | `PermissionStatus` | Determines the status of the permission. |

#### NotificationRequest

An object represents a request to present a notification. It has content — how it's being represented, and a trigger — what triggers the notification.
Many notifications ([`Notification`](#notification)) may be triggered with the same request (for example, a repeating notification).

| Property | Type | Description |
| --- | --- | --- |
| `content` | `NotificationContent` | - |
| `identifier` | `string` | - |
| `trigger` | `NotificationTrigger` | - |

#### NotificationRequestInput

An object which represents a notification request you can pass into `scheduleNotificationAsync`.

| Property | Type | Description |
| --- | --- | --- |
| `content` | `NotificationContentInput` | - |
| `identifier` | `string` | - |
| `trigger` | `NotificationTriggerInput` | - |

#### NotificationResponse

An object which represents user's interaction with the notification.
> **Note:** If the user taps on a notification, `actionIdentifier` will be equal to [`Notifications.DEFAULT_ACTION_IDENTIFIER`](#notificationsdefault_action_identifier).

| Property | Type | Description |
| --- | --- | --- |
| `actionIdentifier` | `string` | - |
| `notification` | `Notification` | - |
| `userText` | `string` | - |

#### Region

The region used to determine when the system sends the notification.

| Property | Type | Description |
| --- | --- | --- |
| `identifier` | `string` | The identifier for the region object. |
| `notifyOnEntry` | `boolean` | Indicates whether notifications are generated upon entry into the region. |
| `notifyOnExit` | `boolean` | Indicates whether notifications are generated upon exit from the region. |
| `type` | `string` | - |

#### TimeIntervalNotificationTrigger

A trigger related to an elapsed time interval. May be repeating (see `repeats` field).

| Property | Type | Description |
| --- | --- | --- |
| `repeats` | `boolean` | - |
| `seconds` | `number` | - |
| `type` | `'timeInterval'` | - |

#### UnknownNotificationTrigger

Represents a notification trigger that is unknown to `expo-notifications` and that it didn't know how to serialize for JS.

| Property | Type | Description |
| --- | --- | --- |
| `type` | `'unknown'` | - |

#### WeeklyNotificationTrigger

A trigger related to a weekly notification.
> The same functionality will be achieved on iOS with a `CalendarNotificationTrigger`.

| Property | Type | Description |
| --- | --- | --- |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `type` | `'weekly'` | - |
| `weekday` | `number` | - |

#### YearlyNotificationTrigger

A trigger related to a yearly notification.
> The same functionality will be achieved on iOS with a `CalendarNotificationTrigger`.

| Property | Type | Description |
| --- | --- | --- |
| `day` | `number` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `month` | `number` | - |
| `type` | `'yearly'` | - |

### Types

#### AudioAttributesInput

**Type:** `Partial<AudioAttributes>`

#### CalendarTriggerInput

This trigger input will cause the notification to be delivered once or many times
(controlled by the value of `repeats`)
when the date components match the specified values.
Corresponds to native
[`UNCalendarNotificationTrigger`](https://developer.apple.com/documentation/usernotifications/uncalendarnotificationtrigger?language=objc).

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `day` | `number` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `month` | `number` | - |
| `repeats` | `boolean` | - |
| `second` | `number` | - |
| `seconds` | `number` | - |
| `timezone` | `string` | - |
| `type` | `SchedulableTriggerInputTypes.CALENDAR` | - |
| `weekday` | `number` | - |
| `weekdayOrdinal` | `number` | - |
| `weekOfMonth` | `number` | - |
| `weekOfYear` | `number` | - |
| `year` | `number` | - |

#### ChannelAwareTriggerInput

A trigger that will cause the notification to be delivered immediately.

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |

#### DailyTriggerInput

This trigger input will cause the notification to be delivered once per day
when the `hour` and `minute` date components match the specified values.

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `type` | `SchedulableTriggerInputTypes.DAILY` | - |

#### DateTriggerInput

This trigger input will cause the notification to be delivered once
on the specified value of the `date` property. The value of `repeats` will be ignored
for this trigger type.

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `date` | `Date | number` | - |
| `type` | `SchedulableTriggerInputTypes.DATE` | - |

#### DevicePushToken

In simple terms, an object of `type: Platform.OS` and `data: any`. The `data` type depends on the environment - on a native device it will be a string,
which you can then use to send notifications via Firebase Cloud Messaging (Android) or APNs (iOS).

**Type:** `ExplicitlySupportedDevicePushToken | ImplicitlySupportedDevicePushToken`

#### ExplicitlySupportedDevicePushToken

**Type:** `NativeDevicePushToken`

#### ImplicitlySupportedDevicePushToken

| Property | Type | Description |
| --- | --- | --- |
| `data` | `any` | The push token as a string for a native platform. |
| `type` | `Exclude<unknown, unknown>` | Either `android` or `ios`. |

#### MaybeNotificationResponse

**Type:** `NotificationResponse | null | undefined`

#### MonthlyTriggerInput

This trigger input will cause the notification to be delivered once per month
when the `day`, `hour`, and `minute` date components match the specified values.
> **Note:** All properties are specified in JavaScript `Date` object's ranges (i.e. January is represented as 0).

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `day` | `number` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `type` | `SchedulableTriggerInputTypes.MONTHLY` | - |

#### NativeNotificationPermissionsRequest

**Type:** `IosNotificationPermissionsRequest | object`

#### NotificationCategoryOptions

| Property | Type | Description |
| --- | --- | --- |
| `allowAnnouncement` | `boolean` | - |
| `allowInCarPlay` | `boolean` | Indicates whether to allow CarPlay to display notifications of this type. **Apps must be approved for CarPlay to make use of this feature.** |
| `categorySummaryFormat` | `string` | A format string for the summary description used when the system groups the category’s notifications. |
| `customDismissAction` | `boolean` | Indicates whether to send actions for handling when the notification is dismissed (the user must explicitly dismiss the notification interface - ignoring a notification or flicking away a notification banner does not trigger this action). |
| `intentIdentifiers` | `string[]` | Array of [Intent Class Identifiers](https://developer.apple.com/documentation/sirikit/intent_class_identifiers). When a notification is delivered, the presence of an intent identifier lets the system know that the notification is potentially related to the handling of a request made through Siri. |
| `previewPlaceholder` | `string` | Customizable placeholder for the notification preview text. This is shown if the user has disabled notification previews for the app. Defaults to the localized iOS system default placeholder (`Notification`). |
| `showSubtitle` | `boolean` | Indicates whether to show the notification's subtitle, even if the user has disabled notification previews for the app. |
| `showTitle` | `boolean` | Indicates whether to show the notification's title, even if the user has disabled notification previews for the app. |

#### NotificationChannelInput

An object which represents a notification channel to be set.

**Type:** `RequiredBy<unknown, 'name' | 'importance'>`

#### NotificationContent

An object represents notification's content.

**Type:** `unknown`

#### NotificationContentAndroid

See [Android developer documentation](https://developer.android.com/reference/android/app/Notification#fields) for more information on specific fields.

| Property | Type | Description |
| --- | --- | --- |
| `badge` | `number` | Application badge number associated with the notification. |
| `color` | `string` | Accent color (in `#AARRGGBB` or `#RRGGBB` format) to be applied by the standard Style templates when presenting this notification. |
| `priority` | `AndroidNotificationPriority` | Relative priority for this notification. Priority is an indication of how much of the user's valuable attention should be consumed by this notification. Low-priority notifications may be hidden from the user in certain situations, while the user might be interrupted for a higher-priority notification. The system will make a determination about how to interpret this priority when presenting the notification. |
| `vibrationPattern` | `number[]` | The pattern with which to vibrate. |

#### NotificationContentAttachmentIos

| Property | Type | Description |
| --- | --- | --- |
| `hideThumbnail` | `boolean` | - |
| `identifier` | `string | null` | - |
| `thumbnailClipArea` | `{ height: number; width: number; x: number; y: number }` | - |
| `thumbnailTime` | `number` | - |
| `type` | `string | null` | - |
| `typeHint` | `string` | - |
| `url` | `string | null` | - |

#### NotificationContentInput

An object which represents notification content that you pass in as a part of `NotificationRequestInput`.

| Property | Type | Description |
| --- | --- | --- |
| `attachments` | `NotificationContentAttachmentIos[]` | The visual and audio attachments to display alongside the notification’s main content. |
| `autoDismiss` | `boolean` | If set to `false`, the notification will not be automatically dismissed when clicked. The setting will be used when the value is not provided or is invalid is set to `true`, and the notification will be dismissed automatically anyway. Corresponds directly to Android's `setAutoCancel` behavior. See [Android developer documentation](https://developer.android.com/reference/android/app/Notification.Builder#setAutoCancel(boolean)) for more details. |
| `badge` | `number` | Application badge number associated with the notification. |
| `body` | `string | null` | The main content of the notification. |
| `categoryIdentifier` | `string` | The identifier of the notification’s category. |
| `color` | `string` | Accent color (in `#AARRGGBB` or `#RRGGBB` format) to be applied by the standard Style templates when presenting this notification. |
| `data` | `Record<string, unknown>` | Data associated with the notification, not displayed. |
| `interruptionLevel` | `'passive' | 'active' | 'timeSensitive' | 'critical'` | The notification’s importance and required delivery timing. Possible values: - 'passive' - the system adds the notification to the notification list without lighting up the screen or playing a sound - 'active' - the system presents the notification immediately, lights up the screen, and can play a sound - 'timeSensitive' - The system presents the notification immediately, lights up the screen, can play a sound, and breaks through system notification controls - 'critical - the system presents the notification immediately, lights up the screen, and bypasses the mute switch to play a sound |
| `launchImageName` | `string` | The name of the image or storyboard to use when your app launches because of the notification. |
| `priority` | `string` | Relative priority for this notification. Priority is an indication of how much of the user's valuable attention should be consumed by this notification. Low-priority notifications may be hidden from the user in certain situations, while the user might be interrupted for a higher-priority notification. The system will make a determination about how to interpret this priority when presenting the notification. |
| `sound` | `boolean | string` | - |
| `sticky` | `boolean` | If set to `true`, the notification cannot be dismissed by swipe. This setting defaults to `false` if not provided or is invalid. Corresponds directly do Android's `isOngoing` behavior. In Firebase terms this property of a notification is called `sticky`. See [Android developer documentation](https://developer.android.com/reference/android/app/Notification.Builder#setOngoing(boolean)) and [Firebase documentation](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages#AndroidNotification.FIELDS.sticky) for more details. |
| `subtitle` | `string | null` | On Android: `subText` - the display depends on the device. On iOS: `subtitle` - the bold text displayed between title and the rest of the content. |
| `title` | `string | null` | Notification title - the bold text displayed above the rest of the content. |
| `vibrate` | `number[]` | The pattern with which to vibrate. |

#### NotificationContentIos

See [Apple documentation](https://developer.apple.com/documentation/usernotifications/unnotificationcontent?language=objc) for more information on specific fields.

| Property | Type | Description |
| --- | --- | --- |
| `attachments` | `NotificationContentAttachmentIos[]` | The visual and audio attachments to display alongside the notification’s main content. |
| `badge` | `number | null` | The number that your app’s icon displays. |
| `interruptionLevel` | `'passive' | 'active' | 'timeSensitive' | 'critical'` | The notification’s importance and required delivery timing. Possible values: - 'passive' - the system adds the notification to the notification list without lighting up the screen or playing a sound - 'active' - the system presents the notification immediately, lights up the screen, and can play a sound - 'timeSensitive' - The system presents the notification immediately, lights up the screen, can play a sound, and breaks through system notification controls - 'critical - the system presents the notification immediately, lights up the screen, and bypasses the mute switch to play a sound |
| `launchImageName` | `string | null` | The name of the image or storyboard to use when your app launches because of the notification. |
| `summaryArgument` | `string | null` | The text the system adds to the notification summary to provide additional context. |
| `summaryArgumentCount` | `number` | The number the system adds to the notification summary when the notification represents multiple items. |
| `targetContentIdentifier` | `string` | The value your app uses to determine which scene to display to handle the notification. |
| `threadIdentifier` | `string | null` | The identifier that groups related notifications. |

#### NotificationHandlingError

**Type:** `NotificationTimeoutError | Error`

#### NotificationTaskPayload

Payload for the background notification handler task.
[Read more](#run-javascript-in-response-to-incoming-notifications).

**Type:** `NotificationResponse | { aps: Record<string, unknown>; data: { dataString: string }; notification: Record<string, unknown> | null }`

#### NotificationTrigger

A union type containing different triggers which may cause the notification to be delivered to the application.

**Type:** `PushNotificationTrigger | LocationNotificationTrigger | NotificationTriggerInput | UnknownNotificationTrigger`

#### NotificationTriggerInput

A type which represents possible triggers with which you can schedule notifications.
A `null` trigger means that the notification should be scheduled for delivery immediately.

**Type:** `null | ChannelAwareTriggerInput | SchedulableNotificationTriggerInput`

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

#### PermissionResponse

An object obtained by permissions get and request functions.

| Property | Type | Description |
| --- | --- | --- |
| `canAskAgain` | `boolean` | Indicates if user can be asked again for specific permission. If not, one should be directed to the Settings app in order to enable/disable the permission. |
| `expires` | `PermissionExpiration` | Determines time when the permission expires. |
| `granted` | `boolean` | A convenience boolean that indicates if the permission is granted. |
| `status` | `PermissionStatus` | Determines the status of the permission. |

#### PushNotificationTrigger

| Property | Type | Description |
| --- | --- | --- |
| `payload` | `Record<string, unknown>` | - |
| `remoteMessage` | `FirebaseRemoteMessage` | - |
| `type` | `'push'` | - |

#### PushTokenListener

A function accepting a device push token ([`DevicePushToken`](#devicepushtoken)) as an argument.
> **Note:** You should not call `getDevicePushTokenAsync` inside this function, as it triggers the listener and may lead to an infinite loop.

**Type:** `(token: DevicePushToken) => void`

#### RequiredBy

**Type:** `unknown`

#### SchedulableNotificationTriggerInput

Input for time-based, schedulable triggers.
For these triggers you can check the next trigger date with [`getNextTriggerDateAsync`](#getnexttriggerdateasynctrigger).
If you pass in a `number` (Unix timestamp) or `Date`, it will be processed as a
trigger input of type [`SchedulableTriggerInputTypes.DATE`](#date). Otherwise, the input must be
an object, with a `type` value set to one of the allowed values in [`SchedulableTriggerInputTypes`](#schedulabletriggerinputtypes).
If the input is an object, date components passed in will be validated, and
an error is thrown if they are outside their allowed range (for example, the `minute` and
`second` components must be between 0 and 59 inclusive).

**Type:** `CalendarTriggerInput | TimeIntervalTriggerInput | DailyTriggerInput | WeeklyTriggerInput | MonthlyTriggerInput | YearlyTriggerInput | DateTriggerInput`

#### Subscription

**Type:** `EventSubscription`

#### TimeIntervalTriggerInput

This trigger input will cause the notification to be delivered once or many times
(depends on the `repeats` field) after `seconds` time elapse.
> **On iOS**, when `repeats` is `true`, the time interval must be 60 seconds or greater.
Otherwise, the notification won't be triggered.

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `repeats` | `boolean` | - |
| `seconds` | `number` | - |
| `type` | `SchedulableTriggerInputTypes.TIME_INTERVAL` | - |

#### WeeklyTriggerInput

This trigger input will cause the notification to be delivered once every week
when the `weekday`, `hour`, and `minute` date components match the specified values.
> **Note:** Weekdays are specified with a number from `1` through `7`, with `1` indicating Sunday.

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `type` | `SchedulableTriggerInputTypes.WEEKLY` | - |
| `weekday` | `number` | - |

#### YearlyTriggerInput

This trigger input will cause the notification to be delivered once every year
when the `day`, `month`, `hour`, and `minute` date components match the specified values.
> **Note:** All properties are specified in JavaScript `Date` object's ranges (i.e. January is represented as 0).

| Property | Type | Description |
| --- | --- | --- |
| `channelId` | `string` | - |
| `day` | `number` | - |
| `hour` | `number` | - |
| `minute` | `number` | - |
| `month` | `number` | - |
| `type` | `SchedulableTriggerInputTypes.YEARLY` | - |

### Enums

#### AndroidAudioContentType

| Value | Description |
| --- | --- |
| `MOVIE` | - |
| `MUSIC` | - |
| `SONIFICATION` | - |
| `SPEECH` | - |
| `UNKNOWN` | - |

#### AndroidAudioUsage

| Value | Description |
| --- | --- |
| `ALARM` | - |
| `ASSISTANCE_ACCESSIBILITY` | - |
| `ASSISTANCE_NAVIGATION_GUIDANCE` | - |
| `ASSISTANCE_SONIFICATION` | - |
| `GAME` | - |
| `MEDIA` | - |
| `NOTIFICATION` | - |
| `NOTIFICATION_COMMUNICATION_DELAYED` | - |
| `NOTIFICATION_COMMUNICATION_INSTANT` | - |
| `NOTIFICATION_COMMUNICATION_REQUEST` | - |
| `NOTIFICATION_EVENT` | - |
| `NOTIFICATION_RINGTONE` | - |
| `UNKNOWN` | - |
| `VOICE_COMMUNICATION` | - |
| `VOICE_COMMUNICATION_SIGNALLING` | - |

#### AndroidImportance

| Value | Description |
| --- | --- |
| `DEFAULT` | - |
| `HIGH` | - |
| `LOW` | - |
| `MAX` | - |
| `MIN` | - |
| `NONE` | - |
| `UNKNOWN` | - |
| `UNSPECIFIED` | - |

#### AndroidNotificationPriority

An enum corresponding to values appropriate for Android's [`Notification#priority`](https://developer.android.com/reference/android/app/Notification#priority) field.

| Value | Description |
| --- | --- |
| `DEFAULT` | - |
| `HIGH` | - |
| `LOW` | - |
| `MAX` | - |
| `MIN` | - |

#### AndroidNotificationVisibility

| Value | Description |
| --- | --- |
| `PRIVATE` | - |
| `PUBLIC` | - |
| `SECRET` | - |
| `UNKNOWN` | - |

#### IosAlertStyle

| Value | Description |
| --- | --- |
| `ALERT` | - |
| `BANNER` | - |
| `NONE` | - |

#### IosAllowsPreviews

| Value | Description |
| --- | --- |
| `ALWAYS` | - |
| `NEVER` | - |
| `WHEN_AUTHENTICATED` | - |

#### IosAuthorizationStatus

| Value | Description |
| --- | --- |
| `AUTHORIZED` | - |
| `DENIED` | - |
| `EPHEMERAL` | - |
| `NOT_DETERMINED` | - |
| `PROVISIONAL` | - |

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |

#### SchedulableTriggerInputTypes

Schedulable trigger inputs (that are not a plain date value or time value)
must have the "type" property set to one of these values.

| Value | Description |
| --- | --- |
| `CALENDAR` | - |
| `DAILY` | - |
| `DATE` | - |
| `MONTHLY` | - |
| `TIME_INTERVAL` | - |
| `WEEKLY` | - |
| `YEARLY` | - |
