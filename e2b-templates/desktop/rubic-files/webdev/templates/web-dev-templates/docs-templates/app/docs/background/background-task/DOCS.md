---
name: background-task
description: Run JavaScript tasks when app is in background.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# BackgroundTask

A library that provides an API for running background tasks.

## Quick Start

Here is a minimal example of how to register and run a background task.

```tsx
import React, { useState, useEffect } from 'react';
import { View, Button, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const BACKGROUND_FETCH_TASK = 'background-fetch';

// 1. Define the task by providing a name and the function that should be executed
// Note: This needs to be called in the global scope (e.g. outside of your React components)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  const now = Date.now();

  console.log(`Got background fetch call at date: ${new Date(now).toISOString()}`);

  // Be sure to return the successful result type!
  return BackgroundFetch.BackgroundFetchResult.NewData;
});

// 2. Register the task at some point in your app by providing the same name,
// and some configuration options for how the background fetch should behave
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function registerBackgroundFetchAsync() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 60 * 1, // 1 minute
    stopOnTerminate: false, // android only,
    startOnBoot: true, // android only
  });
}

export default function BackgroundFetchScreen() {
  const [isRegistered, setIsRegistered] = React.useState(false);

  useEffect(() => {
    checkStatusAsync();
  }, []);

  const checkStatusAsync = async () => {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
    setIsRegistered(isRegistered);
  };

  const toggleFetchTask = async () => {
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
    } else {
      await registerBackgroundFetchAsync();
    }

    checkStatusAsync();
  };

  return (
    <View>
      <Button
        title={isRegistered ? 'Unregister BackgroundFetch task' : 'Register BackgroundFetch task'}
        onPress={toggleFetchTask}
      />
    </View>
  );
}
```

## When to Use

Use `expo-background-task` for deferrable tasks that can run when the app is not in the foreground. This is ideal for non-urgent operations like syncing data, pre-fetching content, or performing periodic checks.

## Common Pitfalls

### 1. Defining a task inside a component

- **Problem**: `TaskManager.defineTask` is called within a React component, causing it to be redefined on every render and potentially leading to memory leaks or inconsistent behavior.
- **Solution**: Define tasks in the global scope, outside of any components, to ensure they are registered only once.

```tsx
// Correct: Define task in the global scope
TaskManager.defineTask('my-task', () => {
  console.log('Task is running...');
});

function MyComponent() {
  // ...
}
```

### 2. Not returning a result from the task

- **Problem**: The background task function completes without returning a value, leaving the system unsure if the task succeeded or failed.
- **Solution**: Always return a result from your task function, such as `BackgroundTask.BackgroundTaskResult.Success` or `BackgroundTask.BackgroundTaskResult.Failed`.

```tsx
TaskManager.defineTask('my-task', () => {
  try {
    // ... perform task
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});
```

## Common Patterns

### 1. Checking for task registration

It's good practice to check if a task is already registered before attempting to register it again. This prevents unnecessary re-registration and potential errors.

```tsx
import * as TaskManager from 'expo-task-manager';

async function registerTask() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync('my-task');
  if (!isRegistered) {
    await BackgroundTask.registerTaskAsync('my-task');
  }
}
```

**Platforms:** android, ios, tvos

**Package:** `expo-background-task`

`expo-background-task` provides an API to run deferrable background tasks in a way that optimizes battery and power consumption on the end user's device. This module uses the [`WorkManager`](https://developer.android.com/topic/libraries/architecture/workmanager) API on Android and the [`BGTaskScheduler`](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler) API on iOS to schedule tasks. It also uses the [`expo-task-manager`](task-manager.mdx) Native API to run JavaScript tasks.

## Background tasks

A background task is a deferrable unit of work that is performed in the background, outside your app's lifecycle. This is useful for tasks that need to be executed when the app is inactive, such as syncing data with a server, fetching new content, or even checking if there are any [`expo-updates`](updates.mdx).

### When are background tasks run?

The Expo Background Task API leverages each platform to execute tasks at the most optimal time for both the user and the device when the app is in the background.

This means that the task may not run immediately after it is scheduled, but it will run at some point in the future if the system decides so. You can specify a minimum interval in minutes for the task to run. The task will execute sometime after the interval has passed, provided the specified conditions are met.

A background task will only run if the battery has enough charge (or the device is plugged into power) and the network is available. Without these conditions, the task won't execute. The exact behavior will vary depending on the operating system.

### When will they be stopped?

Background tasks are managed by platform APIs and system constraints. Knowing when tasks stop helps plan their use effectively.

- Background tasks are stopped if the user kills the app. Tasks resume when the app is restarted.
- If the system stops the app or the device reboots, background tasks will resume, and the app will be restarted.

On Android, removing an app from the recent apps list doesn't completely stop it, whereas on iOS, swiping it away in the app switcher fully terminates it.

> **Info** On Android, behavior varies by device vendor. For example, some implementations treat removing an app from the recent apps list as killing it. Read more about these differences here: [https://dontkillmyapp.com](https://dontkillmyapp.com).

## Platform differences

### Android&ensp;

On Android, the [`WorkManager`](https://developer.android.com/topic/libraries/architecture/workmanager) API allows specifying a minimum interval for a task to run (minimum 15 minutes). The task will execute sometime after the interval has passed, provided the specified conditions are met.

### iOS&ensp;

On iOS, the [`BGTaskScheduler`](https://developer.apple.com/documentation/backgroundtasks/bgtaskscheduler) API decides the best time to launch your background task. The system will consider the battery level, the network availability, and the user's usage patterns to determine when to run the task. You can still specify a minimum interval for the task to run, but the system may choose to run the task at a later time.

## Known limitations

### iOS&ensp;

The [`Background Tasks`](https://developer.apple.com/documentation/backgroundtasks) API is unavailable on iOS simulators. It is only available when running on a physical device.

## Installation

```bash
$ npx expo install expo-background-task
```

## Configuration&ensp;

To be able to run background tasks on iOS, you need to add the `processing` value to the `UIBackgroundModes` array in your app's **Info.plist** file. This is required for background fetch to work properly.

**If you're using [CNG](/workflow/continuous-native-generation/)**, the required `UIBackgroundModes` configuration will be applied automatically by prebuild.

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)), then you'll need to add the following to your **Info.plist** file:

**Example:** ios/project-name/Supporting/Info.plist
```xml
<key>UIBackgroundModes</key>
  <array>
    <string>processing</string>
  </array>
</key>
```

## Usage
Below is an example that demonstrates how to use `expo-background-task`.

**Example:** App.tsx
```tsx

const BACKGROUND_TASK_IDENTIFIER = 'background-task';

// Register and create the task so that it is available also when the background task screen
// (a React component defined later in this example) is not visible.
// Note: This needs to be called in the global scope, not in a React component.
TaskManager.defineTask(BACKGROUND_TASK_IDENTIFIER, async () => {
  try {
    const now = Date.now();
    console.log(`Got background task call at date: ${new Date(now).toISOString()}`);
  } catch (error) {
    console.error('Failed to execute the background task:', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
  return BackgroundTask.BackgroundTaskResult.Success;
});

// 2. Register the task at some point in your app by providing the same name
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function registerBackgroundTaskAsync() {
  return BackgroundTask.registerTaskAsync(BACKGROUND_TASK_IDENTIFIER);
}

// 3. (Optional) Unregister tasks by specifying the task name
// This will cancel any future background task calls that match the given name
// Note: This does NOT need to be in the global scope and CAN be used in your React components!
async function unregisterBackgroundTaskAsync() {
  return BackgroundTask.unregisterTaskAsync(BACKGROUND_TASK_IDENTIFIER);
}

export default function BackgroundTaskScreen() {
  const [isRegistered, setIsRegistered] = useState<boolean>(false);
  const [status, setStatus] = useState<BackgroundTask.BackgroundTaskStatus | null>(null);

  useEffect(() => {
    updateAsync();
  }, []);

  const updateAsync = async () => {
    const status = await BackgroundTask.getStatusAsync();
    setStatus(status);
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_TASK_IDENTIFIER);
    setIsRegistered(isRegistered);
  };

  const toggle = async () => {
    if (!isRegistered) {
      await registerBackgroundTaskAsync();
    } else {
      await unregisterBackgroundTaskAsync();
    }
    await updateAsync();
  };

  return (
    Background Task Service Availability:{' '}
          {status ? BackgroundTask.BackgroundTaskStatus[status] : null}
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    margin: 10,
  },
  boldText: {
    fontWeight: 'bold',
  },
});
```

## Multiple background tasks
Since the Background Tasks API on iOS and the WorkManager API on Android limit the number of tasks that can be scheduled for a single app, Expo Background Task uses a single worker on both platforms. While you can define multiple JavaScript background tasks, they will all run through this single worker.

The last registered background task determines the minimum interval for execution.

## Testing background tasks

Background tasks can be tested using the [`triggerTaskWorkerForTestingAsync`](#backgroundtasktriggertaskworkerfortestingasync) method. This method will run all registered tasks directly on Android and invoke the `BGTaskScheduler` on iOS. This is useful for testing the behavior of your background tasks without having to wait for the system to trigger them.

This method is only available in development mode. It will not work in production builds.

```tsx

function App() {
  const triggerTask = async () => {
    await BackgroundTask.triggerTaskWorkerForTestingAsync();
  };

  return null;
}
```

## Inspecting background tasks&ensp;(platforms: ['android'])

To troubleshoot or debug issues with background tasks on Android, use the `adb` tool included with the Android SDK to inspect scheduled tasks:

<Terminal
  cmd={['$ adb shell dumpsys jobscheduler | grep -A 40 -m 1 -E "JOB #.* <package-name>"']}
/>

The output from this command will show you the scheduled tasks for your app, including their status, constraints, and other information. Look for the `JOB` line to find the ID of the job and other details in the output:

```text
JOB #u0a453/275: 216a359 <package-name>/androidx.work.impl.background.systemjob.SystemJobService
  u0a453 tag=*job*/<package-name>/androidx.work.impl.background.systemjob.SystemJobService#275
  Source: uid=u0a453 user=0 pkg=<package-name>
  ...
  Required constraints: TIMING_DELAY CONNECTIVITY UID_NOT_RESTRICTED [0x90100000]
  Preferred constraints:
  Dynamic constraints:
  Satisfied constraints: CONNECTIVITY DEVICE_NOT_DOZING BACKGROUND_NOT_RESTRICTED TARE_WEALTH WITHIN_QUOTA UID_NOT_RESTRICTED [0x1b500000]
  Unsatisfied constraints: TIMING_DELAY [0x80000000]
  ...
  Enqueue time: -8m12s280ms
  Run time: earliest=+6m47s715ms, latest=none, original latest=none
  Restricted due to: none.
  Ready: false (job=false user=true !restricted=true !pending=true !active=true !backingup=true comp=true)
```

The first line contains the Job ID (275). The `Run time: earliest` value indicates the earliest time the task may start, while `enqueue time` shows how long ago the task was scheduled.

To force a task to run, use the `adb shell am broadcast` command. Move your app to the background before running this command, as the task will not run if the app is in the foreground.

<Terminal cmd={['$ adb shell cmd jobscheduler run -f <package-name> <JOB_ID>']} />

Where `JOB_ID` would be the identifier of the job you want to run that you found in the previous step.

## Troubleshooting background tasks&ensp;(platforms: ['ios'])

iOS does not have a tool similar to `adb` for inspecting background tasks. To test background tasks on iOS, use the built-in [`triggerTaskWorkerForTestingAsync`](#backgroundtasktriggertaskworkerfortestingasync) method. This method simulates the system triggering the task.

You can trigger this method from your app in debug mode (it does not work in production builds) to test the behavior of your background tasks without waiting for the system. If your background task configuration is incorrect, you will see the error description in the Xcode console:

```text
No task request with identifier com.expo.modules.backgroundtask.processing has been scheduled
```

The above error tells you that you need to run prebuild to apply the changes to your app's configuration.

This error also means you must run prebuild to apply your background task configuration to the app. Additionally, ensure you have defined and registered a background task as shown in [this example](#usage).

## API

```js

```

## API Reference

### Methods
#### getStatusAsync

```typescript
getStatusAsync(): Promise<BackgroundTaskStatus>
```

**Returns:** A BackgroundTaskStatus enum value or `null` if not available.

#### registerTaskAsync

Registers a background task with the given name. Registered tasks are saved in persistent storage and restored once the app is initialized.

```typescript
registerTaskAsync(taskName: string, options: BackgroundTaskOptions): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task to register. The task needs to be defined first - see [`TaskManager.defineTask`]() for more details. |
| `options` | `BackgroundTaskOptions` | An object containing the background task options. |

#### triggerTaskWorkerForTestingAsync

When in debug mode this function will trigger running the background tasks.
This function will only work for apps built in debug mode.
This method is only available in development mode. It will not work in production builds.

```typescript
triggerTaskWorkerForTestingAsync(): Promise<boolean>
```

**Returns:** A promise which fulfils when the task is triggered.

#### unregisterTaskAsync

Unregisters a background task, so the application will no longer be executing this task.

```typescript
unregisterTaskAsync(taskName: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task to unregister. |

**Returns:** A promise which fulfils when the task is fully unregistered.

### Types

#### BackgroundTaskOptions

Options for registering a background task

| Property | Type | Description |
| --- | --- | --- |
| `minimumInterval` | `number` | Inexact interval in minutes between subsequent repeats of the background tasks. The final interval may differ from the specified one to minimize wakeups and battery usage. - Defaults to once every 12 hours (The minimum interval is 15 minutes) - The system controls the background task execution interval and treats the specified value as a minimum delay. Tasks won't run exactly on schedule. On iOS, short intervals are often ignored—the system typically runs background tasks during specific windows, such as overnight. |

### Enums

#### BackgroundTaskResult

Return value for background tasks.

| Value | Description |
| --- | --- |
| `Failed` | The task failed. |
| `Success` | The task finished successfully. |

#### BackgroundTaskStatus

Availability status for background tasks

| Value | Description |
| --- | --- |
| `Available` | Background tasks are available for the app. |
| `Restricted` | Background tasks are unavailable. |
