---
name: task-manager
description: Define and manage background tasks and their handlers.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# TaskManager

A library that provides support for tasks that can run in the background.

**Platforms:** android, ios, tvos

**Package:** `expo-task-manager`

`expo-task-manager` provides an API that allows you to manage long-running tasks, in particular those tasks that can run while your app is in the background. Some features of this library are used by other libraries under the hood. Here is a list of Expo SDK libraries that use `TaskManager`.

## Quick Start

Here is a minimal example of how to define and register a background task. This example uses `expo-location` to demonstrate a common use case.

```jsx
import React, { useEffect } from 'react';
import { View, Button, Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const LOCATION_TASK_NAME = 'background-location-task';

// Define the task
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    console.log('Received new locations', locations);
  }
});

export default function App() {
  const registerTask = async () => {
    if (Platform.OS === 'web') {
        console.log("TaskManager is not available on web.")
        return;
    }
    const { status } = await Location.requestBackgroundPermissionsAsync();
    if (status === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 60000, // 1 minute
        deferredUpdatesInterval: 1000, // 1 second
      });
      console.log('Location task registered');
    }
  };

  const unregisterTask = async () => {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    console.log('Location task unregistered');
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Register Background Location Task" onPress={registerTask} />
      <Button title="Unregister Background Location Task" onPress={unregisterTask} />
    </View>
  );
}
```

## When to Use

Use `expo-task-manager` when you need to run code in the background, independent of the app's UI. This is ideal for tasks like fetching data periodically, tracking location, or handling push notifications when the app is not in the foreground.

## Common Pitfalls

Here are some common mistakes to avoid when using `expo-task-manager`:

- **Problem**: Defining a task inside a React component.
  - **Solution**: `TaskManager.defineTask` must be called in the global scope of your application, before your root component is mounted. This ensures the task is defined and available when the app is launched in the background.

- **Problem**: Forgetting to request necessary permissions.
  - **Solution**: Background tasks often require specific permissions. For example, background location tracking requires both foreground and background location permissions. Always request the necessary permissions before starting a task.

  ```jsx
  const requestPermissions = async () => {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus === 'granted') {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus === 'granted') {
        // Permissions granted, now you can start the task
      }
    }
  };
  ```

- **Problem**: Not handling task errors.
  - **Solution**: The task executor function receives an `error` object. Always check for errors and handle them appropriately to prevent your background task from failing silently.

## Common Patterns

### Checking if a Task is Already Registered

Before registering a task, it's good practice to check if it's already running to avoid registration conflicts.

```jsx
import * as TaskManager from 'expo-task-manager';

const MY_TASK = 'my-background-task';

const isTaskRegistered = async () => {
  return await TaskManager.isTaskRegisteredAsync(MY_TASK);
};

// Usage
const handleRegister = async () => {
  if (!(await isTaskRegistered())) {
    // Register the task
  } else {
    console.log('Task is already registered.');
  }
};
```

## Libraries using Expo TaskManager

- [Location](location.mdx)
- [BackgroundTask](background-task.mdx)
- [BackgroundFetch](background-fetch.mdx)
- [Notifications](notifications.mdx)

## Installation

```bash
$ npx expo install expo-task-manager
```

> **info** You can test `TaskManager` in the Expo Go app. However, check the documentation of each [library](#libraries-using-expo-taskmanager) that uses `TaskManager` to confirm whether it supports testing in Expo Go.

## Configuration&ensp;

Standalone apps need some extra configuration: on iOS, each background feature requires a special key in `UIBackgroundModes` array in your **Info.plist** file.

Read more about how to configure this in the reference for each of the [libraries](#libraries-using-expo-taskmanager) that use `TaskManager`.

## Example

```jsx
import React from 'react';
import { Button, View, StyleSheet } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';

const LOCATION_TASK_NAME = 'background-location-task';

const requestPermissions = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
  if (foregroundStatus === 'granted') {
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.Balanced,
      });
    }
  }
};

const PermissionsButton = () => (
  <View style={styles.container}>
    <Button onPress={requestPermissions} title="Enable background location" />
  </View>
);

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    // Error occurred - check `error.message` for more details.
    return null;
  }
  if (data) {
    const { locations } = data;
    // do something with the locations captured in the background
  }
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PermissionsButton;
```

## API
```js
import * as TaskManager from 'expo-task-manager';
```

## API Reference

### Methods

#### defineTask

Defines task function. It must be called in the global scope of your JavaScript bundle.
In particular, it cannot be called in any of React lifecycle methods like `componentDidMount`.
This limitation is due to the fact that when the application is launched in the background,
we need to spin up your JavaScript app, run your task and then shut down — no views are mounted
in this scenario.

```typescript
defineTask(taskName: string, taskExecutor: TaskManagerTaskExecutor<T>): void
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task. It must be the same as the name you provided when registering the task. |
| `taskExecutor` | `TaskManagerTaskExecutor<T>` | A function that will be invoked when the task with given `taskName` is executed. |

#### getRegisteredTasksAsync

Provides information about tasks registered in the app.

```typescript
getRegisteredTasksAsync(): Promise<TaskManagerTask[]>
```

**Returns:** A promise which fulfills with an array of tasks registered in the app.

#### getTaskOptionsAsync

Retrieves `options` associated with the task, that were passed to the function registering the task
(e.g. `Location.startLocationUpdatesAsync`).

```typescript
getTaskOptionsAsync(taskName: string): Promise<TaskOptions>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task. |

**Returns:** A promise which fulfills with the `options` object that was passed while registering task
with given name or `null` if task couldn't be found.

#### isAvailableAsync

Determine if the `TaskManager` API can be used in this app.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise which fulfills with `true` if the API can be used, and `false` otherwise.
With Expo Go, `TaskManager` is not available on Android, and does not support background execution on iOS.
Use a development build to avoid limitations: https://expo.fyi/dev-client.
On the web, it always returns `false`.

#### isTaskDefined

Checks whether the task is already defined.

```typescript
isTaskDefined(taskName: string): boolean
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task. |

#### isTaskRegisteredAsync
Determine whether the task is registered. Registered tasks are stored in a persistent storage and
preserved between sessions.

```typescript
isTaskRegisteredAsync(taskName: string): Promise<boolean>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task. |

**Returns:** A promise which resolves to `true` if a task with the given name is registered, otherwise `false`.

#### unregisterAllTasksAsync

Unregisters all tasks registered for the running app. You may want to call this when the user is
signing out and you no longer need to track his location or run any other background tasks.

```typescript
unregisterAllTasksAsync(): Promise<void>
```

**Returns:** A promise which fulfills as soon as all tasks are completely unregistered.

#### unregisterTaskAsync

Unregisters task from the app, so the app will not be receiving updates for that task anymore.
_It is recommended to use methods specialized by modules that registered the task, eg.
[`Location.stopLocationUpdatesAsync`]()._

```typescript
unregisterTaskAsync(taskName: string): Promise<void>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `taskName` | `string` | Name of the task to unregister. |

**Returns:** A promise which fulfills as soon as the task is unregistered.

### Interfaces

#### TaskManagerError

Error object that can be received through [`TaskManagerTaskBody`](#taskmanagertaskbody) when the
task fails.

| Property | Type | Description |
| --- | --- | --- |
| `code` | `string | number` | - |
| `message` | `string` | - |

#### TaskManagerTask

Represents an already registered task.

| Property | Type | Description |
| --- | --- | --- |
| `options` | `any` | Provides `options` that the task was registered with. |
| `taskName` | `string` | Name that the task is registered with. |
| `taskType` | `string` | Type of the task which depends on how the task was registered. |

#### TaskManagerTaskBody

Represents the object that is passed to the task executor.

| Property | Type | Description |
| --- | --- | --- |
| `data` | `T` | An object of data passed to the task executor. Its properties depend on the type of the task. |
| `error` | `null | TaskManagerError` | Error object if the task failed or `null` otherwise. |
| `executionInfo` | `TaskManagerTaskBodyExecutionInfo` | Additional details containing unique ID of task event and name of the task. |

#### TaskManagerTaskBodyExecutionInfo

Additional details about execution provided in `TaskManagerTaskBody`.

| Property | Type | Description |
| --- | --- | --- |
| `appState` | `'active' | 'background' | 'inactive'` | State of the application. |
| `eventId` | `string` | Unique ID of task event. |
| `taskName` | `string` | Name of the task. |

### Types


#### TaskManagerTaskExecutor

Type of task executor – a function that handles the task.

**Type:** `(body: TaskManagerTaskBody<T>) => Promise<any>`
