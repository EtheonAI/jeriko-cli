---
name: calendar
description: Access and create calendar events.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Calendar

A library that provides an API for interacting with the device's system calendars, events, reminders, and associated records.

**Platforms:** android, ios

**Package:** `expo-calendar`

`expo-calendar` provides an API for interacting with the device's system calendars, events, reminders, and associated records.

Additionally, it provides methods to launch the [system-provided calendar UI](#launching-system-provided-calendar-dialogs) to allow user view or edit events. On Android, these methods start the system calendar app using an Intent. On iOS, they present either [`EKEventViewController`](https://developer.apple.com/documentation/eventkitui/ekeventviewcontroller) or [`EKEventEditViewController`](https://developer.apple.com/documentation/eventkitui/ekeventeditviewcontroller) as a modal.

## Quick Start

```tsx
import React, { useEffect } from 'react';
import { Button, View, Alert, Platform } from 'react-native';
import * as Calendar from 'expo-calendar';

export default function App() {
  useEffect(() => {
    (async () => {
      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Calendar permission is required to create events.');
      }
    })();
  }, []);

  const createEvent = async () => {
    const defaultCalendar = Platform.OS === 'ios' 
      ? await Calendar.getDefaultCalendarAsync()
      : { id: (await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT))[0].id };

    if (!defaultCalendar.id) {
      Alert.alert('No calendar', 'No default calendar found.');
      return;
    }

    const eventDetails = {
      title: 'My Awesome Event',
      startDate: new Date(),
      endDate: new Date(Date.now() + 60 * 60 * 1000),
      timeZone: 'UTC',
    };

    try {
      const eventId = await Calendar.createEventAsync(defaultCalendar.id, eventDetails);
      Alert.alert('Success', `Event created with ID: ${eventId}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to create event.');
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Button title="Create a Test Event" onPress={createEvent} />
    </View>
  );
}
```

## When to Use

Use the `expo-calendar` module when you need to programmatically interact with the user\'s device calendar. This includes creating, reading, updating, or deleting events, as well as managing calendars themselves. It is ideal for applications that need to schedule appointments, set reminders, or sync with the user\'s existing calendar.

## Common Pitfalls

### 1. Forgetting to Request Permissions

**Problem**: The app crashes or throws an error when trying to access calendar functions because permissions have not been granted.

**Solution**: Always request calendar permissions before calling any other calendar-related functions. Check the status to ensure it is `granted`.

```tsx
const { status } = await Calendar.requestCalendarPermissionsAsync();
if (status === 'granted') {
  // You can now use the Calendar API
}
```

### 2. Not Finding a Writable Calendar

**Problem**: `createEventAsync` fails because the selected calendar is read-only.

**Solution**: Before creating an event, find a calendar that allows modifications. You can filter the list of calendars to find one that is writable.

```tsx
const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
const writableCalendars = calendars.filter(c => c.allowsModifications);
if (writableCalendars.length === 0) {
  Alert.alert('No writable calendars', 'No writable calendars found on this device.');
  return;
}
const calendarId = writableCalendars[0].id;
// Now you can create an event in this calendar
```

### 3. Incorrectly Handling Time Zones

**Problem**: Events are created at the wrong time because the time zone is not specified or is incorrect.

**Solution**: Always specify the `timeZone` when creating or updating events. You can get the device\'s time zone using `expo-localization`.

```tsx
import * as Localization from 'expo-localization';

const eventDetails = {
  title: 'Correct Time Event',
  startDate: new Date(),
  endDate: new Date(Date.now() + 60 * 60 * 1000),
  timeZone: Localization.timezone,
};
```

## Installation

```bash
$ npx expo install expo-calendar
```

## Configuration in app config

You can configure `expo-calendar` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-calendar",
        {
          "calendarPermission": "The app needs to access your calendar."
        }
      ]
    ]
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) (you're using native **android** and **ios** projects manually), then you need to configure following permissions in your native projects:

- For Android, add `android.permission.READ_CALENDAR` and `android.permission.WRITE_CALENDAR` permissions to your project's **android/app/src/main/AndroidManifest.xml**:

  ```xml
  <uses-permission android:name="android.permission.READ_CALENDAR" />
  <uses-permission android:name="android.permission.WRITE_CALENDAR" />
  ```

- For iOS, add `NSCalendarsUsageDescription` and `NSRemindersUsageDescription` to your project's **ios/[app]/Info.plist**:

  ```xml
  <key>NSCalendarsUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your calendar</string>
  <key>NSRemindersUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your reminders</string>
  ```

## Usage

```tsx
import React, { useEffect, useState } from "react";
import { Alert, Button, FlatList, Platform, Text, View } from "react-native";
import * as Calendar from "expo-calendar";

export default function CalendarExample() {
  const [calendars, setCalendars] = useState<Calendar.Calendar[]>([]);
  const [events, setEvents] = useState<Calendar.Event[]>([]);

  useEffect(() => {
    (async () => {
      const isAvailable = await Calendar.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert(
          "Unavailable",
          "Calendar API is not available on this device.",
        );
        return null;
      }

      const { status } = await Calendar.requestCalendarPermissionsAsync();
      if (status !== Calendar.PermissionStatus.GRANTED) {
        Alert.alert(
          "Permission required",
          "Calendar permission is required to read calendars.",
        );
        return null;
      }

      const nextCalendars = await Calendar.getCalendarsAsync(
        Calendar.EntityTypes.EVENT,
      );
      setCalendars(nextCalendars);
    })();
  }, []);

  const loadEvents = async (calendarId: string) => {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextEvents = await Calendar.getEventsAsync(
      [calendarId],
      startDate,
      endDate,
    );
    setEvents(nextEvents);
  };

  const createEvent = async (calendarId: string) => {
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    try {
      const eventId = await Calendar.createEventAsync(calendarId, {
        title: "New Event",
        startDate,
        endDate,
        timeZone: "UTC",
        location: "My Location",
        notes: Platform.OS === "ios" ? "Created via expo-calendar" : undefined,
        alarms: [{ relativeOffset: -30 }], // 30 minutes before
      });

      Alert.alert("Success", `Event created: ${eventId}`);
      await loadEvents(calendarId);
    } catch (error) {
      Alert.alert("Error", "Failed to create event");
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 10 }}>
        Calendars
      </Text>

      <FlatList
        data={calendars}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={{
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: "#eee",
            }}
          >
            <Text style={{ fontWeight: "bold" }}>{item.title}</Text>
            <Text style={{ color: item.color ?? "#999" }}>
              {item.source?.name ?? "Unknown source"}
            </Text>
            <Button
              title="Load Events (30d)"
              onPress={() => loadEvents(item.id)}
            />
            {item.allowsModifications && (
              <Button title="Add Event" onPress={() => createEvent(item.id)} />
            )}
          </View>
        )}
      />

      {events.length > 0 && (
        <>
          <Text
            style={{
              fontSize: 20,
              fontWeight: "bold",
              marginTop: 20,
              marginBottom: 10,
            }}
          >
            Events
          </Text>
          <FlatList
            data={events}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: "#eee",
                }}
              >
                <Text style={{ fontWeight: "bold" }}>{item.title}</Text>
                <Text>{new Date(item.startDate).toLocaleString()}</Text>
                {!!item.location && <Text>{item.location}</Text>}
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}
```

## Common Patterns

### Permissions (runtime)

Calendar access requires runtime permission checks when using read/write APIs.

```ts
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

// Calendars/events permission
const calendarPerms = await Calendar.getCalendarPermissionsAsync();
if (calendarPerms.status !== Calendar.PermissionStatus.GRANTED) {
  await Calendar.requestCalendarPermissionsAsync();
}

// Reminders permission (iOS only)
if (Platform.OS === "ios") {
  const remindersPerms = await Calendar.getRemindersPermissionsAsync();
  if (remindersPerms.status !== Calendar.PermissionStatus.GRANTED) {
    await Calendar.requestRemindersPermissionsAsync();
  }
}
```

### Get calendars

```ts
import * as Calendar from "expo-calendar";

const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
const writableCalendars = calendars.filter((c) => c.allowsModifications);
```

### Create a calendar (choose a source)

On iOS you typically use the default calendar's `source`. On Android you can create a local calendar.

```ts
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

async function getDefaultCalendarSource() {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync();
  return defaultCalendar.source;
}

const source =
  Platform.OS === "ios"
    ? await getDefaultCalendarSource()
    : { isLocalAccount: true, name: "Expo Calendar" };

const calendarId = await Calendar.createCalendarAsync({
  title: "My Calendar",
  color: "#FF0000",
  entityType: Calendar.EntityTypes.EVENT,
  sourceId: source.id,
  source,
  name: "myCalendarInternalName",
  ownerAccount: "personal",
  accessLevel: Calendar.CalendarAccessLevel.OWNER,
});
```

### Get events (date range queries)

```ts
import * as Calendar from "expo-calendar";

const startDate = new Date(2026, 0, 1);
const endDate = new Date(2026, 11, 31);
const events = await Calendar.getEventsAsync([calendarId], startDate, endDate);
```

> **Note:** iOS returns events that _overlap_ the range; Android returns events fully contained within the range.

### Create / update / delete an event

```ts
import * as Calendar from "expo-calendar";

const eventId = await Calendar.createEventAsync(calendarId, {
  title: "Meeting",
  startDate: new Date(2026, 0, 1, 10, 0, 0),
  endDate: new Date(2026, 0, 1, 11, 0, 0),
  timeZone: "UTC",
  location: "Conference Room",
  notes: "Discuss project updates",
  alarms: [{ relativeOffset: -30 }],
});

await Calendar.updateEventAsync(
  eventId,
  {
    title: "Updated Meeting Title",
    startDate: new Date(2026, 0, 1, 14, 0, 0),
    endDate: new Date(2026, 0, 1, 15, 0, 0),
  },
  {},
);

await Calendar.deleteEventAsync(eventId, {});
```

### Recurring events

```ts
import * as Calendar from "expo-calendar";

await Calendar.createEventAsync(calendarId, {
  title: "Daily Standup",
  startDate: new Date(2026, 0, 1, 9, 0, 0),
  endDate: new Date(2026, 0, 1, 9, 30, 0),
  recurrenceRule: {
    frequency: Calendar.Frequency.DAILY,
    interval: 1,
    endDate: new Date(2026, 11, 31),
  },
});
```

When updating/deleting recurring events, use `RecurringEventOptions` to control whether you’re affecting just one instance or all future events:

```ts
import * as Calendar from "expo-calendar";

await Calendar.updateEventAsync(
  recurringEventId,
  { location: "Updated location" },
  { instanceStartDate: instanceStartDate, futureEvents: true },
);
```

### Reminders (iOS only)

```ts
import * as Calendar from "expo-calendar";

await Calendar.requestRemindersPermissionsAsync();

const reminders = await Calendar.getRemindersAsync(
  [calendarId],
  null,
  new Date(2026, 0, 1),
  new Date(2026, 11, 31),
);

const reminderId = await Calendar.createReminderAsync(calendarId, {
  title: "Task reminder",
  startDate: new Date(2026, 0, 1),
  dueDate: new Date(2026, 0, 7),
  completed: false,
  notes: "Don't forget!",
});
```

### Attendees (Android only)

Attendee records are managed via attendee APIs (not all platforms support creating/editing attendees).

```ts
import { Platform } from "react-native";
import * as Calendar from "expo-calendar";

if (Platform.OS === "android") {
  const attendeeId = await Calendar.createAttendeeAsync(eventId, {
    email: "colleague@example.com",
    name: "Colleague Name",
    role: Calendar.AttendeeRole.REQUIRED,
    status: Calendar.AttendeeStatus.PENDING,
    type: Calendar.AttendeeType.PERSON,
  });

  const attendees = await Calendar.getAttendeesForEventAsync(eventId, {});
  console.log({ attendeeId, attendees });
}
```

### Calendar sources (iOS)

```ts
import * as Calendar from "expo-calendar";

const sources = await Calendar.getSourcesAsync();
const defaultCalendar = await Calendar.getDefaultCalendarAsync();
console.log({ sources, defaultSource: defaultCalendar.source });
```

## Best Practices / Notes

- **Request and check permissions** before calling read/write APIs.
- **Prefer `allowsModifications` calendars** when creating/updating events.
- **Time zones matter**: set `timeZone` (and `endTimeZone` if needed) to avoid DST/locale confusion.
- **Recurring events need extra care**: instances don’t have stable IDs; use `RecurringEventOptions` with `instanceStartDate`.
- **Platform differences**:
  - **Reminders** are iOS-only.
  - **Attendee write APIs** are Android-only.
  - Date-range filtering in `getEventsAsync` differs between iOS and Android (see note above).
- **System calendar UI**: if you only use the system-provided dialogs (`createEventInCalendarAsync`, `openEventInCalendarAsync`, etc.), you may not need to request permissions.

## API

```js
import * as Calendar from "expo-calendar";
```

## Permissions

### Android

If you only intend to use the [system-provided calendar UI](#launching-system-provided-calendar-dialogs), you don't need to request any permissions.

Otherwise, you must add the following permissions to your **app.json** inside the [`expo.android.permissions`](../config/app/#permissions) array.

### iOS

If you only intend to create events using system-provided calendar UI with [`createEventInCalendarAsync`](#createeventincalendarasynceventdata-presentationoptions), you don't need to request permissions.

The following usage description keys are used by this library:

## API Reference

### Methods

#### createAttendeeAsync

Creates a new attendee record and adds it to the specified event. Note that if `eventId` specifies
a recurring event, this will add the attendee to every instance of the event.

**Platform:** android

```typescript
createAttendeeAsync(eventId: string, details: Partial<Attendee>): Promise<string>
```

**Parameters:**

| Name      | Type                | Description                                      |
| --------- | ------------------- | ------------------------------------------------ |
| `eventId` | `string`            | ID of the event to add this attendee to.         |
| `details` | `Partial<Attendee>` | A map of details for the attendee to be created. |

**Returns:** A string representing the ID of the newly created attendee record.

#### createCalendarAsync

Creates a new calendar on the device, allowing events to be added later and displayed in the OS Calendar app.

```typescript
createCalendarAsync(details: Partial<Calendar>): Promise<string>
```

**Parameters:**

| Name      | Type                | Description                                      |
| --------- | ------------------- | ------------------------------------------------ |
| `details` | `Partial<Calendar>` | A map of details for the calendar to be created. |

**Returns:** A string representing the ID of the newly created calendar.

#### createEventAsync

Creates a new event on the specified calendar.

```typescript
createEventAsync(calendarId: string, eventData: Omit<Partial<Event>, 'id' | 'organizer'>): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `calendarId` | `string` | ID of the calendar to create this event in. |
| `eventData` | `Omit<Partial<Event>, 'id' \| 'organizer'>` | A map of details for the event to be created. |

**Returns:** A promise which fulfils with a string representing the ID of the newly created event.

#### createEventInCalendarAsync

Launches the calendar UI provided by the OS to create a new event.

```typescript
createEventInCalendarAsync(eventData: Omit<Partial<Event>, 'id'>, presentationOptions: PresentationOptions): Promise<DialogEventResult>
```

**Parameters:**

| Name                  | Type                         | Description                                                     |
| --------------------- | ---------------------------- | --------------------------------------------------------------- |
| `eventData`           | `Omit<Partial<Event>, 'id'>` | A map of details for the event to be created.                   |
| `presentationOptions` | `PresentationOptions`        | Configuration that influences how the calendar UI is presented. |

**Returns:** A promise which resolves with information about the dialog result.

#### createReminderAsync

Creates a new reminder on the specified calendar.

**Platform:** ios

```typescript
createReminderAsync(calendarId: null | string, reminder: Reminder): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `calendarId` | `null \| string` | ID of the calendar to create this reminder in (or `null` to add the reminder to the OS-specified default calendar for reminders). |
| `reminder` | `Reminder` | A map of details for the reminder to be created. |

**Returns:** A promise which fulfils with a string representing the ID of the newly created reminder.

#### deleteAttendeeAsync

Deletes an existing attendee record from the device. **Use with caution.**

**Platform:** android

```typescript
deleteAttendeeAsync(id: string): Promise<void>
```

**Parameters:**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | ID of the attendee to delete. |

#### deleteCalendarAsync

Deletes an existing calendar and all associated events/reminders/attendees from the device. **Use with caution.**

```typescript
deleteCalendarAsync(id: string): Promise<void>
```

**Parameters:**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | ID of the calendar to delete. |

#### deleteEventAsync

Deletes an existing event from the device. Use with caution.

```typescript
deleteEventAsync(id: string, recurringEventOptions: RecurringEventOptions): Promise<void>
```

**Parameters:**

| Name                    | Type                    | Description                            |
| ----------------------- | ----------------------- | -------------------------------------- |
| `id`                    | `string`                | ID of the event to be deleted.         |
| `recurringEventOptions` | `RecurringEventOptions` | A map of options for recurring events. |

#### deleteReminderAsync

Deletes an existing reminder from the device. **Use with caution.**

**Platform:** ios

```typescript
deleteReminderAsync(id: string): Promise<void>
```

**Parameters:**

| Name | Type     | Description                       |
| ---- | -------- | --------------------------------- |
| `id` | `string` | ID of the reminder to be deleted. |

#### editEventInCalendarAsync

Launches the calendar UI provided by the OS to edit or delete an event. On Android, this is the same as `openEventInCalendarAsync`.

```typescript
editEventInCalendarAsync(params: CalendarDialogParams, presentationOptions: PresentationOptions): Promise<DialogEventResult>
```

**Parameters:**

| Name                  | Type                   | Description |
| --------------------- | ---------------------- | ----------- |
| `params`              | `CalendarDialogParams` | -           |
| `presentationOptions` | `PresentationOptions`  | -           |

**Returns:** A promise which resolves with information about the dialog result.

#### getAttendeesForEventAsync

Gets all attendees for a given event (or instance of a recurring event).

```typescript
getAttendeesForEventAsync(id: string, recurringEventOptions: RecurringEventOptions): Promise<Attendee[]>
```

**Parameters:**

| Name                    | Type                    | Description                              |
| ----------------------- | ----------------------- | ---------------------------------------- |
| `id`                    | `string`                | ID of the event to return attendees for. |
| `recurringEventOptions` | `RecurringEventOptions` | A map of options for recurring events.   |

**Returns:** A promise which fulfils with an array of [`Attendee`](#attendee) associated with the
specified event.

#### getCalendarPermissionsAsync

Checks user's permissions for accessing user's calendars.

```typescript
getCalendarPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that resolves to an object of type [`PermissionResponse`](#permissionresponse).

#### getCalendarsAsync

Gets an array of calendar objects with details about the different calendars stored on the device.

```typescript
getCalendarsAsync(entityType: string): Promise<Calendar[]>
```

**Parameters:**

| Name         | Type     | Description                                                                   |
| ------------ | -------- | ----------------------------------------------------------------------------- |
| `entityType` | `string` | **iOS Only.** Not required, but if defined, filters the returned calendars to |

a specific entity type. Possible values are `Calendar.EntityTypes.EVENT` (for calendars shown in
the Calendar app) and `Calendar.EntityTypes.REMINDER` (for the Reminders app).

> **Note:** If not defined, you will need both permissions: **CALENDAR** and **REMINDERS**. |

**Returns:** An array of [calendar objects](#calendar "Calendar") matching the provided entity type (if provided).

#### getDefaultCalendarAsync

Gets an instance of the default calendar object.

**Platform:** ios

```typescript
getDefaultCalendarAsync(): Promise<Calendar>
```

**Returns:** A promise resolving to the [Calendar](#calendar) object that is the user's default calendar.

#### getEventAsync

Returns a specific event selected by ID. If a specific instance of a recurring event is desired,
the start date of this instance must also be provided, as instances of recurring events do not
have their own unique and stable IDs on either iOS or Android.

```typescript
getEventAsync(id: string, recurringEventOptions: RecurringEventOptions): Promise<Event>
```

**Parameters:**

| Name                    | Type                    | Description                            |
| ----------------------- | ----------------------- | -------------------------------------- |
| `id`                    | `string`                | ID of the event to return.             |
| `recurringEventOptions` | `RecurringEventOptions` | A map of options for recurring events. |

**Returns:** A promise which fulfils with an [`Event`](#event) object matching the provided criteria, if one exists.

#### getEventsAsync

Returns all events in a given set of calendars over a specified time period. The filtering has
slightly different behavior per-platform - on iOS, all events that overlap at all with the
`[startDate, endDate]` interval are returned, whereas on Android, only events that begin on or
after the `startDate` and end on or before the `endDate` will be returned.

```typescript
getEventsAsync(calendarIds: string[], startDate: Date, endDate: Date): Promise<Event[]>
```

**Parameters:**

| Name          | Type       | Description                                        |
| ------------- | ---------- | -------------------------------------------------- |
| `calendarIds` | `string[]` | Array of IDs of calendars to search for events in. |
| `startDate`   | `Date`     | Beginning of time period to search for events in.  |
| `endDate`     | `Date`     | End of time period to search for events in.        |

**Returns:** A promise which fulfils with an array of [`Event`](#event) objects matching the search criteria.

#### getReminderAsync

Returns a specific reminder selected by ID.

**Platform:** ios

```typescript
getReminderAsync(id: string): Promise<Reminder>
```

**Parameters:**

| Name | Type     | Description                   |
| ---- | -------- | ----------------------------- |
| `id` | `string` | ID of the reminder to return. |

**Returns:** A promise which fulfils with a [`Reminder`](#reminder) matching the provided ID, if one exists.

#### getRemindersAsync

Returns a list of reminders matching the provided criteria. If `startDate` and `endDate` are defined,
returns all reminders that overlap at all with the [startDate, endDate] interval - i.e. all reminders
that end after the `startDate` or begin before the `endDate`.

**Platform:** ios

```typescript
getRemindersAsync(calendarIds: null | string[], status: null | ReminderStatus, startDate: null | Date, endDate: null | Date): Promise<Reminder[]>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `calendarIds` | `null \| string[]` | Array of IDs of calendars to search for reminders in. |
| `status` | `null \| ReminderStatus` | One of `Calendar.ReminderStatus.COMPLETED` or `Calendar.ReminderStatus.INCOMPLETE`. |
| `startDate` | `null \| Date` | Beginning of time period to search for reminders in. Required if `status` is defined. |
| `endDate` | `null \| Date` | End of time period to search for reminders in. Required if `status` is defined. |

**Returns:** A promise which fulfils with an array of [`Reminder`](#reminder) objects matching the search criteria.

#### getRemindersPermissionsAsync

Checks user's permissions for accessing user's reminders.

**Platform:** ios

```typescript
getRemindersPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that resolves to an object of type [`PermissionResponse`](#permissionresponse).

#### getSourceAsync

Returns a specific source selected by ID.

**Platform:** ios

```typescript
getSourceAsync(id: string): Promise<Source>
```

**Parameters:**

| Name | Type     | Description                 |
| ---- | -------- | --------------------------- |
| `id` | `string` | ID of the source to return. |

**Returns:** A promise which fulfils with an array of [`Source`](#source) object matching the provided
ID, if one exists.

#### getSourcesAsync

**Platform:** ios

```typescript
getSourcesAsync(): Promise<Source[]>
```

**Returns:** A promise which fulfils with an array of [`Source`](#source) objects all sources for
calendars stored on the device.

#### isAvailableAsync

Returns whether the Calendar API is enabled on the current device. This does not check the app permissions.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** Async `boolean`, indicating whether the Calendar API is available on the current device.
Currently, this resolves `true` on iOS and Android only.

#### openEventInCalendar

Sends an intent to open the specified event in the OS Calendar app.

**Platform:** android

```typescript
openEventInCalendar(id: string): void
```

**Parameters:**

| Name | Type     | Description              |
| ---- | -------- | ------------------------ |
| `id` | `string` | ID of the event to open. |

#### openEventInCalendarAsync

Launches the calendar UI provided by the OS to preview an event.

```typescript
openEventInCalendarAsync(params: CalendarDialogParams, presentationOptions: OpenEventPresentationOptions): Promise<OpenEventDialogResult>
```

**Parameters:**

| Name                  | Type                           | Description |
| --------------------- | ------------------------------ | ----------- |
| `params`              | `CalendarDialogParams`         | -           |
| `presentationOptions` | `OpenEventPresentationOptions` | -           |

**Returns:** A promise which resolves with information about the dialog result.

#### requestCalendarPermissionsAsync

Asks the user to grant permissions for accessing user's calendars.

```typescript
requestCalendarPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that resolves to an object of type [`PermissionResponse`](#permissionresponse).

#### requestPermissionsAsync

```typescript
requestPermissionsAsync(): Promise<PermissionResponse>
```

#### requestRemindersPermissionsAsync

Asks the user to grant permissions for accessing user's reminders.

**Platform:** ios

```typescript
requestRemindersPermissionsAsync(): Promise<PermissionResponse>
```

**Returns:** A promise that resolves to an object of type [`PermissionResponse`](#permissionresponse).

#### updateAttendeeAsync

Updates an existing attendee record. To remove a property, explicitly set it to `null` in `details`.

**Platform:** android

```typescript
updateAttendeeAsync(id: string, details: Partial<Attendee>): Promise<string>
```

**Parameters:**

| Name      | Type                | Description                              |
| --------- | ------------------- | ---------------------------------------- |
| `id`      | `string`            | ID of the attendee record to be updated. |
| `details` | `Partial<Attendee>` | A map of properties to be updated.       |

#### updateCalendarAsync

Updates the provided details of an existing calendar stored on the device. To remove a property,
explicitly set it to `null` in `details`.

```typescript
updateCalendarAsync(id: string, details: Partial<Calendar>): Promise<string>
```

**Parameters:**

| Name      | Type                | Description                        |
| --------- | ------------------- | ---------------------------------- |
| `id`      | `string`            | ID of the calendar to update.      |
| `details` | `Partial<Calendar>` | A map of properties to be updated. |

#### updateEventAsync

Updates the provided details of an existing calendar stored on the device. To remove a property,
explicitly set it to `null` in `details`.

```typescript
updateEventAsync(id: string, details: Omit<Partial<Event>, 'id'>, recurringEventOptions: RecurringEventOptions): Promise<string>
```

**Parameters:**

| Name                    | Type                         | Description                            |
| ----------------------- | ---------------------------- | -------------------------------------- |
| `id`                    | `string`                     | ID of the event to be updated.         |
| `details`               | `Omit<Partial<Event>, 'id'>` | A map of properties to be updated.     |
| `recurringEventOptions` | `RecurringEventOptions`      | A map of options for recurring events. |

#### updateReminderAsync

Updates the provided details of an existing reminder stored on the device. To remove a property,
explicitly set it to `null` in `details`.

**Platform:** ios

```typescript
updateReminderAsync(id: string, details: Reminder): Promise<string>
```

**Parameters:**

| Name      | Type       | Description                        |
| --------- | ---------- | ---------------------------------- |
| `id`      | `string`   | ID of the reminder to be updated.  |
| `details` | `Reminder` | A map of properties to be updated. |

#### useCalendarPermissions

```typescript
useCalendarPermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name      | Type                            | Description |
| --------- | ------------------------------- | ----------- |
| `options` | `PermissionHookOptions<object>` | -           |

#### useRemindersPermissions

```typescript
useRemindersPermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name      | Type                            | Description |
| --------- | ------------------------------- | ----------- |
| `options` | `PermissionHookOptions<object>` | -           |

### Types

#### Alarm

A method for having the OS automatically remind the user about a calendar item.

| Property                                                                           | Type            | Description                                                                                   |
| ---------------------------------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `absoluteDate`                                                                     | `string`        | Date object or string representing an absolute time the alarm should occur.                   |
| Overrides `relativeOffset` and `structuredLocation` if specified alongside either. |
| `method`                                                                           | `AlarmMethod`   | Method of alerting the user that this alarm should use. On iOS this is always a notification. |
| `relativeOffset`                                                                   | `number`        | Number of minutes from the `startDate` of the calendar item that the alarm should occur.      |
| Use negative values to have the alarm occur before the `startDate`.                |
| `structuredLocation`                                                               | `AlarmLocation` | -                                                                                             |

#### AlarmLocation

| Property    | Type                                      | Description |
| ----------- | ----------------------------------------- | ----------- |
| `coords`    | `{ latitude: number; longitude: number }` | -           |
| `proximity` | `string`                                  | -           |
| `radius`    | `number`                                  | -           |
| `title`     | `string`                                  | -           |

#### Attendee

A person or entity that is associated with an event by being invited or fulfilling some other role.

| Property        | Type             | Description                                                    |
| --------------- | ---------------- | -------------------------------------------------------------- |
| `email`         | `string`         | Email address of the attendee.                                 |
| `id`            | `string`         | Internal ID that represents this attendee on the device.       |
| `isCurrentUser` | `boolean`        | Indicates whether or not this attendee is the current OS user. |
| `name`          | `string`         | Displayed name of the attendee.                                |
| `role`          | `AttendeeRole`   | Role of the attendee at the event.                             |
| `status`        | `AttendeeStatus` | Status of the attendee in relation to the event.               |
| `type`          | `AttendeeType`   | Type of the attendee.                                          |
| `url`           | `string`         | URL for the attendee.                                          |

#### Calendar

A calendar record upon which events (or, on iOS, reminders) can be stored. Settings here apply to
the calendar as a whole and how its events are displayed in the OS calendar app.

| Property                                                    | Type                  | Description                                                                               |
| --- | --- | --- |
| `accessLevel`                                               | `CalendarAccessLevel` | Level of access that the user has for the calendar.                                       |
| `allowedAttendeeTypes`                                      | `AttendeeType[]`      | Attendee types that this calendar supports.                                               |
| `allowedAvailabilities`                                     | `Availability[]`      | Availability types that this calendar supports.                                           |
| `allowedReminders`                                          | `AlarmMethod[]`       | Alarm methods that this calendar supports.                                                |
| `allowsModifications`                                       | `boolean`             | Boolean value that determines whether this calendar can be modified.                      |
| `color`                                                     | `string`              | Color used to display this calendar's events.                                             |
| `entityType`                                                | `EntityTypes`         | Whether the calendar is used in the Calendar or Reminders OS app.                         |
| `id`                                                        | `string`              | Internal ID that represents this calendar on the device.                                  |
| `isPrimary`                                                 | `boolean`             | Boolean value indicating whether this is the device's primary calendar.                   |
| `isSynced`                                                  | `boolean`             | Indicates whether this calendar is synced and its events stored on the device.<br>Unexpected behavior may occur if this is not set to `true`. |
| `isVisible`                                                 | `boolean`             | Indicates whether the OS displays events on this calendar.                                |
| `name`                                                      | `string \| null`      | Internal system name of the calendar.                                                     |
| `ownerAccount`                                              | `string`              | Name for the account that owns this calendar.                                             |
| `source`                                                    | `Source`              | Object representing the source to be used for the calendar.                               |
| `sourceId`                                                  | `string`              | ID of the source to be used for the calendar. Likely the same as the source for any other locally stored calendars. |
| `timeZone`                                                  | `string`              | Time zone for the calendar.                                                               |
| `title`                                                     | `string`              | Visible name of the calendar.                                                             |
| `type`                                                      | `CalendarType`        | Type of calendar this object represents.                                                  |

#### CalendarDialogParams

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | ID of the event to be presented in the calendar UI. |
| `instanceStartDate` | `string \| Date` | Date object representing the start time of the desired instance, if looking for a single instance of a recurring event.<br>If this is not provided and **id** represents a recurring event, the first instance of that event will be returned by default. |

#### DaysOfTheWeek

| Property       | Type           | Description                                                                                         |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------- |
| `dayOfTheWeek` | `DayOfTheWeek` | Sunday to Saturday - `DayOfTheWeek` enum.                                                           |
| `weekNumber`   | `number`       | `-53` to `53` (`0` ignores this field, and a negative indicates a value from the end of the range). |

#### DialogEventResult

The result of presenting a calendar dialog for creating or editing an event.

| Property | Type | Description |
| --- | --- | --- |
| `action` | `Extract<CalendarDialogResultActions, 'done' \| 'saved' \| 'canceled' \| 'deleted'>` | How user responded to the dialog. |
| `id` | `string \| null` | The ID of the event that was created or edited. |

On Android, `action` is always `done` (Android doesn't provide enough information to determine the user's action — the user may have canceled the dialog, saved, or deleted the event).

On iOS, `action` can be `saved`, `canceled`, or `deleted`. The `id` is a string when permissions are granted and the user confirms creation/editing; otherwise it is `null`.

#### Event

An event record, or a single instance of a recurring event. On iOS, used in the Calendar app.

| Property                           | Type               | Description                                                                                               |
| --- | --- | --- |
| `accessLevel`                      | `EventAccessLevel` | User's access level for the event.                                                                        |
| `alarms`                           | `Alarm[]`          | Array of Alarm objects which control automated reminders to the user.                                     |
| `allDay`                           | `boolean`          | Whether the event is displayed as an all-day event on the calendar                                        |
| `availability`                     | `Availability`     | The availability setting for the event.                                                                   |
| `calendarId`                       | `string`           | ID of the calendar that contains this event.                                                              |
| `creationDate`                     | `string \| Date`   | Date when the event record was created.                                                                   |
| `endDate`                          | `string \| Date`   | Date object or string representing the time when the event ends.                                          |
| `endTimeZone`                      | `string`           | Time zone for the event end time.                                                                         |
| `guestsCanInviteOthers`            | `boolean`          | Whether invited guests can invite other guests.                                                           |
| `guestsCanModify`                  | `boolean`          | Whether invited guests can modify the details of the event.                                               |
| `guestsCanSeeGuests`               | `boolean`          | Whether invited guests can see other guests.                                                              |
| `id`                               | `string`           | Internal ID that represents this event on the device.                                                     |
| `instanceId`                       | `string`           | For instances of recurring events, volatile ID representing this instance. Not guaranteed to always refer to the same instance. |
| `isDetached`                       | `boolean`          | Boolean value indicating whether or not the event is a detached (modified) instance of a recurring event. |
| `lastModifiedDate`                 | `string \| Date`   | Date when the event record was last modified.                                                             |
| `location`                         | `string \| null`   | Location field of the event.                                                                              |
| `notes`                            | `string`           | Description or notes saved with the event.                                                                |
| `organizer`                        | `Organizer`        | Organizer of the event.<br>This property is only available on events associated with calendars that are managed by a service (e.g., Google Calendar or iCloud). The organizer is read-only and cannot be set. |
| `organizerEmail`                   | `string`           | Email address of the organizer of the event.                                                              |
| `originalId`                       | `string`           | For detached (modified) instances of recurring events, the ID of the original recurring event.            |
| `originalStartDate`                | `string \| Date`   | For recurring events, the start date for the first (original) instance of the event.                      |
| `recurrenceRule`                   | `RecurrenceRule \| null` | Object representing rules for recurring or repeating events. Set to `null` for one-time events.      |
| `startDate`                        | `string \| Date`   | Date object or string representing the time when the event starts.                                        |
| `status`                           | `EventStatus`      | Status of the event.                                                                                      |
| `timeZone`                         | `string`           | Time zone the event is scheduled in.                                                                      |
| `title`                            | `string`           | Visible name of the event.                                                                                |
| `url`                              | `string`           | URL for the event.                                                                                        |

#### OpenEventDialogResult

The result of presenting the calendar dialog for opening (viewing) an event.

| Property | Type | Description |
| --- | --- | --- |
| `action` | `Extract<CalendarDialogResultActions, 'done' \| 'canceled' \| 'deleted' \| 'responded'>` | Indicates how user responded to the dialog. |

On Android, the `action` is always `done`. On iOS, it can be `done`, `canceled`, `deleted`, or `responded`.

#### OpenEventPresentationOptions

**Type:** `unknown`

#### PermissionExpiration

Permission expiration time. Currently, all permissions are granted permanently.

**Type:** `'never' | number`

#### PermissionHookOptions

**Type:** `unknown`

#### PermissionResponse

An object obtained by permissions get and request functions.

- **canAskAgain** (`boolean`): Indicates if user can be asked again for specific permission. If not, one should be directed to the Settings app in order to enable/disable the permission.
- **expires** (`PermissionExpiration`): Determines time when the permission expires.
- **granted** (`boolean`): A convenience boolean that indicates if the permission is granted.
- **status** (`PermissionStatus`): Determines the status of the permission.

#### PresentationOptions

- **startNewActivityTask** (`boolean`):  
  Whether to launch the Activity as a new [task](https://developer.android.com/reference/android/content/Intent#FLAG_ACTIVITY_NEW_TASK).
  - If `true`, the promise resolves with `'done'` action immediately after opening the calendar activity.

#### RecurrenceRule

A recurrence rule for events or reminders, allowing the same calendar item to recur multiple times. This type is based on [the iOS interface](https://developer.apple.com/documentation/eventkit/ekrecurrencerule/1507320-initrecurrencewithfrequency) which is in turn based on [the iCal RFC](https://tools.ietf.org/html/rfc5545#section-3.8.5.3) so you can refer to those to learn more about this potentially complex interface.

Not all the combinations make sense. For example, when frequency is `DAILY`, setting `daysOfTheMonth` makes no sense.

- **daysOfTheMonth** (`number[]`): The days of the month this event occurs on.
  - Accepts values from `-31` to `31` (excluding `0`). Negative values indicate counting from the end of the range.
  - Only valid for `Calendar.Frequency.Monthly`.

- **daysOfTheWeek** (`DaysOfTheWeek[]`): The days of the week the event should recur on. An array of [`DaysOfTheWeek`](#daysoftheweek) objects.

- **daysOfTheYear** (`number[]`): The days of the year this event occurs on.
  - Accepts values from `-366` to `366` (excluding `0`). Negative values indicate counting from the end of the range.
  - Only valid for `Calendar.Frequency.Yearly`.

- **endDate** (`string | Date`): Date on which the calendar item should stop recurring; overrides `occurrence` if both are specified.

- **frequency** (`Frequency`): How often the calendar item should recur.

- **interval** (`number`): Interval at which the calendar item should recur. For example, an `interval: 2` with `frequency: DAILY` would yield an event that recurs every other day.

- **monthsOfTheYear** (`MonthOfTheYear[]`): The months this event occurs on.
  - Only valid for `Calendar.Frequency.Yearly`.

- **occurrence** (`number`): Number of times the calendar item should recur before stopping.

- **setPositions** (`number[]`): An array of numbers that filters which recurrences to include. For example, for an event that recurs every Monday, passing `2` here will make it recur every other Monday.
  - Accepts values from `-366` to `366` (excluding `0`). Negative values indicate counting from the end of the range.
  - Only valid for `Calendar.Frequency.Yearly`.

- **weeksOfTheYear** (`number[]`): The weeks of the year this event occurs on.
  - Accepts values from `-53` to `53` (excluding `0`). Negative values indicate counting from the end of the range.
  - Only valid for `Calendar.Frequency.Yearly`.

#### RecurringEventOptions

- **futureEvents** (`boolean`):  
  Whether future events in the recurring series should also be updated.  
  - If `true`, applies the given changes to the recurring instance specified by `instanceStartDate` and all future events in the series.
  - If `false`, only applies the given changes to the instance specified by `instanceStartDate`.

- **instanceStartDate** (`string | Date`):  
  Date object representing the start time of the desired instance, if looking for a single instance of a recurring event.  
  - If this is not provided and **id** represents a recurring event, the first instance of that event will be returned by default.

#### Reminder

A reminder record, used in the iOS Reminders app. No direct analog on Android.

- **alarms** (`Alarm[]`): Array of Alarm objects which control automated alarms to the user about the task.
- **calendarId** (`string`): ID of the calendar that contains this reminder.
- **completed** (`boolean`): Indicates whether or not the task has been completed.
- **completionDate** (`string | Date`): Date object or string representing the date of completion, if `completed` is `true`.  
  Setting this property of a nonnull `Date` will automatically set the reminder's `completed` value to `true`.
- **creationDate** (`string | Date`): Date when the reminder record was created.
- **dueDate** (`string | Date`): Date object or string representing the time when the reminder task is due.
- **id** (`string`): Internal ID that represents this reminder on the device.
- **lastModifiedDate** (`string | Date`): Date when the reminder record was last modified.
- **location** (`string`): Location field of the reminder.
- **notes** (`string`): Description or notes saved with the reminder.
- **recurrenceRule** (`RecurrenceRule | null`): Object representing rules for recurring or repeated reminders. `null` for one-time tasks.
- **startDate** (`string | Date`): Date object or string representing the start date of the reminder task.
- **timeZone** (`string`): Time zone the reminder is scheduled in.
- **title** (`string`): Visible name of the reminder.
- **url** (`string`): URL for the reminder.

#### Source

A source account that owns a particular calendar. Expo apps will typically not need to interact with `Source` objects.

- **id** (`string`): Internal ID that represents this source on the device.
- **isLocalAccount** (`boolean`): Whether this source is the local phone account. Must be `true` if `type` is `undefined`.
- **name** (`string`): Name for the account that owns this calendar and was used to sync the calendar to the device.
- **type** (`string | SourceType`): Type of the account that owns this calendar and was used to sync it to the device. If `isLocalAccount` is falsy then this must be defined, and must match an account on the device along with `name`, or the OS will delete the calendar. On iOS, one of [`SourceType`](#sourcetype)s.

### Enums

#### AlarmMethod

| Value     | Description |
| --------- | ----------- |
| `ALARM`   | -           |
| `ALERT`   | -           |
| `DEFAULT` | -           |
| `EMAIL`   | -           |
| `SMS`     | -           |

#### AttendeeRole

| Value             | Description |
| ----------------- | ----------- |
| `ATTENDEE`        | -           |
| `CHAIR`           | -           |
| `NON_PARTICIPANT` | -           |
| `NONE`            | -           |
| `OPTIONAL`        | -           |
| `ORGANIZER`       | -           |
| `PERFORMER`       | -           |
| `REQUIRED`        | -           |
| `SPEAKER`         | -           |
| `UNKNOWN`         | -           |

#### AttendeeStatus

| Value        | Description |
| ------------ | ----------- |
| `ACCEPTED`   | -           |
| `COMPLETED`  | -           |
| `DECLINED`   | -           |
| `DELEGATED`  | -           |
| `IN_PROCESS` | -           |
| `INVITED`    | -           |
| `NONE`       | -           |
| `PENDING`    | -           |
| `TENTATIVE`  | -           |
| `UNKNOWN`    | -           |

#### AttendeeType

| Value      | Description |
| ---------- | ----------- |
| `GROUP`    | -           |
| `NONE`     | -           |
| `OPTIONAL` | -           |
| `PERSON`   | -           |
| `REQUIRED` | -           |
| `RESOURCE` | -           |
| `ROOM`     | -           |
| `UNKNOWN`  | -           |

#### Availability

| Value           | Description |
| --------------- | ----------- |
| `BUSY`          | -           |
| `FREE`          | -           |
| `NOT_SUPPORTED` | -           |
| `TENTATIVE`     | -           |
| `UNAVAILABLE`   | -           |

#### CalendarAccessLevel

| Value         | Description |
| ------------- | ----------- |
| `CONTRIBUTOR` | -           |
| `EDITOR`      | -           |
| `FREEBUSY`    | -           |
| `NONE`        | -           |
| `OVERRIDE`    | -           |
| `OWNER`       | -           |
| `READ`        | -           |
| `RESPOND`     | -           |
| `ROOT`        | -           |

#### CalendarDialogResultActions

Enum containing all possible user responses to the calendar UI dialogs. Depending on what dialog is presented, a subset of the values applies.

- **`canceled`**: The user canceled or dismissed the dialog.
- **`deleted`**: The user deleted the event.
- **`done`**: On Android, this is the only possible result because the OS doesn't provide enough information to determine the user's action (the user may have canceled the dialog, modified the event, or deleted it).

On iOS, this means the user simply closed the dialog. |
| `responded` | The user responded to and saved a pending event invitation. |
| `saved` | The user saved a new event or modified an existing one. |

#### CalendarType

| Value        | Description |
| ------------ | ----------- |
| `BIRTHDAYS`  | -           |
| `CALDAV`     | -           |
| `EXCHANGE`   | -           |
| `LOCAL`      | -           |
| `SUBSCRIBED` | -           |
| `UNKNOWN`    | -           |

#### DayOfTheWeek

| Value       | Description |
| ----------- | ----------- |
| `Friday`    | -           |
| `Monday`    | -           |
| `Saturday`  | -           |
| `Sunday`    | -           |
| `Thursday`  | -           |
| `Tuesday`   | -           |
| `Wednesday` | -           |

#### EntityTypes

platform ios

| Value      | Description |
| ---------- | ----------- |
| `EVENT`    | -           |
| `REMINDER` | -           |

#### EventAccessLevel

| Value          | Description |
| -------------- | ----------- |
| `CONFIDENTIAL` | -           |
| `DEFAULT`      | -           |
| `PRIVATE`      | -           |
| `PUBLIC`       | -           |

#### EventStatus

| Value       | Description |
| ----------- | ----------- |
| `CANCELED`  | -           |
| `CONFIRMED` | -           |
| `NONE`      | -           |
| `TENTATIVE` | -           |

#### Frequency

| Value     | Description |
| --------- | ----------- |
| `DAILY`   | -           |
| `MONTHLY` | -           |
| `WEEKLY`  | -           |
| `YEARLY`  | -           |

#### MonthOfTheYear

| Value       | Description |
| ----------- | ----------- |
| `April`     | -           |
| `August`    | -           |
| `December`  | -           |
| `February`  | -           |
| `January`   | -           |
| `July`      | -           |
| `June`      | -           |
| `March`     | -           |
| `May`       | -           |
| `November`  | -           |
| `October`   | -           |
| `September` | -           |

#### PermissionStatus

| Value          | Description                                       |
| -------------- | ------------------------------------------------- |
| `DENIED`       | User has denied the permission.                   |
| `GRANTED`      | User has granted the permission.                  |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |

#### ReminderStatus

| Value        | Description |
| ------------ | ----------- |
| `COMPLETED`  | -           |
| `INCOMPLETE` | -           |

#### SourceType

| Value        | Description |
| ------------ | ----------- |
| `BIRTHDAYS`  | -           |
| `CALDAV`     | -           |
| `EXCHANGE`   | -           |
| `LOCAL`      | -           |
| `MOBILEME`   | -           |
| `SUBSCRIBED` | -           |
