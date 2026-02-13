---
name: contacts
description: Access and manage device contacts.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Contacts

A library that provides access to the phone's system contacts.

**Platforms:** android, ios

**Package:** `expo-contacts`

`expo-contacts` provides access to the device's system contacts, allowing you to get contact information as well as adding, editing, or removing contacts.

On iOS, contacts have a multi-layered grouping system that you can also access through this API.

# Quick Start

This example shows how to request permissions and fetch the first contact with an email address.

```jsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as Contacts from 'expo-contacts';

export default function App() {
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') {
        console.log('Expo Contacts is not available on the web.');
        return;
      }
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Emails],
        });

        if (data.length > 0) {
          const contact = data[0];
          console.log(contact);
        }
      }
    })();
  }, []);

  return (
    <View style={styles.container}>
      <Text>Contacts Module Example</Text>
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

Use `expo-contacts` when your app needs to access, manage, or display the user's device contacts. This is useful for features like contact lists, social sharing, or any functionality that requires interaction with the user's address book.

## Common Pitfalls

### 1. Missing `WRITE_CONTACTS` Permission in Expo Go

- **Problem**: When using `addContactAsync` in Expo Go on Android, you might encounter an error because the Expo Go app doesn't have the `WRITE_CONTACTS` permission.
- **Solution**: Create a [development build](/develop/development-builds/create-a-build/) of your app and manually add the `android.permission.WRITE_CONTACTS` permission in your **android/app/src/main/AndroidManifest.xml**.

### 2. App Store Rejection Due to Vague Permission Message

- **Problem**: Apple may reject your app if the `contactsPermission` message in your **app.json** is too generic (e.g., "Allow $(PRODUCT_NAME) to access your contacts.").
- **Solution**: Provide a clear and specific reason for why your app needs access to contacts. For example: "Our app needs access to your contacts to allow you to easily share your profile with friends."

### 3. Crashing When Filtering Contacts

- **Problem**: The app may crash without a clear error message when using `getContactsAsync` with certain field filters.
- **Solution**: Ensure that you are requesting the necessary fields in your `getContactsAsync` call. For example, if you want to access email addresses, you must include `Contacts.Fields.Emails` in the `fields` array. Also, always check if `data` has any contacts before trying to access an element from the array.

```jsx
const { data } = await Contacts.getContactsAsync({
  fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
});

if (data && data.length > 0) {
  // Access contact data safely
}
```

## Common Patterns

### 1. Getting All Contacts with Phone Numbers

This pattern demonstrates how to fetch all contacts that have at least one phone number.

```jsx
import * as Contacts from 'expo-contacts';

async function getAllContactsWithPhone() {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status === 'granted') {
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });

    if (data.length > 0) {
      const contactsWithPhone = data.filter(
        (contact) => contact.phoneNumbers && contact.phoneNumbers.length > 0
      );
      return contactsWithPhone;
    }
  }
  return [];
}
```

### 2. Adding a New Contact

This pattern shows how to add a new contact to the user's device.

```jsx
import * as Contacts from 'expo-contacts';

async function addNewContact() {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status === 'granted') {
    const contact = {
      [Contacts.Fields.FirstName]: 'John',
      [Contacts.Fields.LastName]: 'Doe',
      [Contacts.Fields.JobTitle]: 'Developer',
    };
    try {
      const contactId = await Contacts.addContactAsync(contact);
      console.log('Contact added with ID:', contactId);
    } catch (error) {
      console.error('Error adding contact:', error);
    }
  }
}
```
## Installation

```bash
$ npx expo install expo-contacts
```

## Configuration in app config

You can configure `expo-contacts` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": [
      [
        "expo-contacts",
        {
          "contactsPermission": "Allow $(PRODUCT_NAME) to access your contacts."
        }
      ]
    ]
  }
}
```

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) (you're using native **android** and **ios** projects manually), then you need to configure following permissions in your native projects:

- For Android, add `android.permission.READ_CONTACTS` and `android.permission.WRITE_CONTACTS` permissions to your project's **android/app/src/main/AndroidManifest.xml**:

  ```xml
  <uses-permission android:name="android.permission.READ_CONTACTS" />
  <uses-permission android:name="android.permission.WRITE_CONTACTS" />
  ```

- For iOS, add the `NSContactsUsageDescription` key to your project's **ios/[app]/Info.plist**:

  ```xml
  <key>NSContactsUsageDescription</key>
  <string>Allow $(PRODUCT_NAME) to access your contacts</string>
  ```

## Usage

```jsx

export default function App() {
  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status === 'granted') {
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Emails],
        });

        if (data.length > 0) {
          const contact = data[0];
          console.log(contact);
        }
      }
    })();
  }, []);

  return (
    Contacts Module Example
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

## API

```js

```

## Permissions

### Android

This library automatically adds `READ_CONTACTS` and `WRITE_CONTACTS` permissions to your app:

### iOS

The following usage description keys are used by this library:

## API Reference

### Classes

#### ContactAccessButton

Creates a contact access button to quickly add contacts under limited-access authorization.

For more details, you can read the Apple docs about the underlying [`ContactAccessButton`](https://developer.apple.com/documentation/contactsui/contactaccessbutton) SwiftUI view.

**Methods:**

- `render(): null | Element`

- `isAvailable(): boolean`
  Returns a boolean whether the `ContactAccessButton` is available on the platform.
This is `true` only on iOS 18.0 and newer.

### Methods

#### addContactAsync

Creates a new contact and adds it to the system.
> **Note**: For Android users, the Expo Go app does not have the required `WRITE_CONTACTS` permission to write to Contacts.
> You will need to create a [development build](/develop/development-builds/create-a-build/) and add permission in there manually to use this method.

```typescript
addContactAsync(contact: Contact, containerId: string): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contact` | `Contact` | A contact with the changes you wish to persist. The `id` parameter will not be used. |
| `containerId` | `string` | @tag-ios The container that will parent the contact. |

**Returns:** A promise that fulfills with ID of the new system contact.

#### addExistingContactToGroupAsync

Add a contact as a member to a group. A contact can be a member of multiple groups.

**Platform:** ios

```typescript
addExistingContactToGroupAsync(contactId: string, groupId: string): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactId` | `string` | ID of the contact you want to edit. |
| `groupId` | `string` | ID for the group you want to add membership to. |

#### addExistingGroupToContainerAsync

Add a group to a container.

**Platform:** ios

```typescript
addExistingGroupToContainerAsync(groupId: string, containerId: string): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupId` | `string` | The group you want to target. |
| `containerId` | `string` | The container you want to add membership to. |

#### createGroupAsync

Create a group with a name, and add it to a container. If the container is `undefined`, the default container will be targeted.

**Platform:** ios

```typescript
createGroupAsync(name: string, containerId: string): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `name` | `string` | Name of the new group. |
| `containerId` | `string` | The container you to add membership to. |

**Returns:** A promise that fulfills with ID of the new group.

#### getContactByIdAsync

Used for gathering precise data about a contact. Returns a contact matching the given `id`.

```typescript
getContactByIdAsync(id: string, fields: FieldType[]): Promise<Contact | undefined>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `id` | `string` | The ID of a system contact. |
| `fields` | `FieldType[]` | If specified, the fields defined will be returned. When skipped, all fields will be returned. |

**Returns:** A promise that fulfills with `Contact` object with ID matching the input ID, or `undefined` if there is no match.

#### getContactsAsync

Return a list of contacts that fit a given criteria. You can get all of the contacts by passing no criteria.

```typescript
getContactsAsync(contactQuery: ContactQuery): Promise<ContactResponse>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactQuery` | `ContactQuery` | Object used to query contacts. |

**Returns:** A promise that fulfills with `ContactResponse` object returned from the query.

#### getContainersAsync

Query a list of system containers.

**Platform:** ios

```typescript
getContainersAsync(containerQuery: ContainerQuery): Promise<Container[]>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `containerQuery` | `ContainerQuery` | Information used to gather containers. |

**Returns:** A promise that fulfills with array of containers that fit the query.

#### getDefaultContainerIdAsync

Get the default container's ID.

**Platform:** ios

```typescript
getDefaultContainerIdAsync(): Promise<string>
```

**Returns:** A promise that fulfills with default container ID.

#### getGroupsAsync

Query and return a list of system groups.

**Platform:** ios

```typescript
getGroupsAsync(groupQuery: GroupQuery): Promise<Group[]>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupQuery` | `GroupQuery` | Information regarding which groups you want to get. |

**Returns:** A promise that fulfills with array of groups that fit the query.

#### getPagedContactsAsync

```typescript
getPagedContactsAsync(contactQuery: ContactQuery): Promise<ContactResponse>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactQuery` | `ContactQuery` | - |

#### getPermissionsAsync

Checks user's permissions for accessing contacts data.

```typescript
getPermissionsAsync(): Promise<ContactsPermissionResponse>
```

**Returns:** A promise that resolves to a [ContactsPermissionResponse](#contactspermissionresponse) object.

#### isAvailableAsync

Returns whether the Contacts API is enabled on the current device. This method does not check the app permissions.

```typescript
isAvailableAsync(): Promise<boolean>
```

**Returns:** A promise that fulfills with a `boolean`, indicating whether the Contacts API is available on the current device. It always resolves to `false` on web.

#### presentAccessPickerAsync

Presents a modal which allows the user to select which contacts the app has access to.
Using this function is reasonable only when the app has "limited" permissions.

**Platform:** ios 18.0+

```typescript
presentAccessPickerAsync(): Promise<string[]>
```

**Returns:** A promise that resolves with an array of contact identifiers that were newly granted to the app.
Contacts which the app lost access to are not listed. On platforms other than iOS and below 18.0, the promise rejects immediately.

#### presentContactPickerAsync

Presents a native contact picker to select a single contact from the system. On Android, the `READ_CONTACTS` permission is required. You can
obtain this permission by calling the [`Contacts.requestPermissionsAsync()`](#contactsrequestpermissionsasync) method. On iOS, no permissions are
required to use this method.

```typescript
presentContactPickerAsync(): Promise<Contact | null>
```

**Returns:** A promise that fulfills with a single `Contact` object if a contact is selected or `null` if no contact is selected (when selection is canceled).

#### presentFormAsync

Present a native form for manipulating contacts.

```typescript
presentFormAsync(contactId: null | string, contact: null | Contact, formOptions: FormOptions): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactId` | `null | string` | The ID of a system contact. |
| `contact` | `null | Contact` | A contact with the changes you want to persist. |
| `formOptions` | `FormOptions` | Options for the native editor. |

#### removeContactAsync

Delete a contact from the system.

**Platform:** ios

```typescript
removeContactAsync(contactId: string): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactId` | `string` | ID of the contact you want to delete. |

#### removeContactFromGroupAsync

Remove a contact's membership from a given group. This will not delete the contact.

**Platform:** ios

```typescript
removeContactFromGroupAsync(contactId: string, groupId: string): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactId` | `string` | ID of the contact you want to remove. |
| `groupId` | `string` | ID for the group you want to remove membership of. |

#### removeGroupAsync

Delete a group from the device.

**Platform:** ios

```typescript
removeGroupAsync(groupId: string): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupId` | `string` | ID of the group you want to remove. |

#### requestPermissionsAsync

Asks the user to grant permissions for accessing contacts data.

```typescript
requestPermissionsAsync(): Promise<ContactsPermissionResponse>
```

**Returns:** A promise that resolves to a [ContactsPermissionResponse](#contactspermissionresponse) object.

#### shareContactAsync

```typescript
shareContactAsync(contactId: string, message: string, shareOptions: ShareOptions): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactId` | `string` | - |
| `message` | `string` | - |
| `shareOptions` | `ShareOptions` | - |

#### updateContactAsync

Mutate the information of an existing contact. Due to an iOS bug, `nonGregorianBirthday` field cannot be modified.

```typescript
updateContactAsync(contact: unknown): Promise<string>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contact` | `unknown` | A contact object including the wanted changes. Contact `id` is required. |

**Returns:** A promise that fulfills with ID of the updated system contact if mutation was successful.

#### updateGroupNameAsync

Change the name of an existing group.

**Platform:** ios

```typescript
updateGroupNameAsync(groupName: string, groupId: string): Promise<any>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `groupName` | `string` | New name for an existing group. |
| `groupId` | `string` | ID of the group you want to edit. |

#### writeContactToFileAsync

Query a set of contacts and write them to a local URI that can be used for sharing.

```typescript
writeContactToFileAsync(contactQuery: ContactQuery): Promise<string | undefined>
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `contactQuery` | `ContactQuery` | Used to query contact you want to write. |

**Returns:** A promise that fulfills with shareable local URI, or `undefined` if there was no match.

### Types

#### Address

| Property | Type | Description |
| --- | --- | --- |
| `city` | `string` | City name. |
| `country` | `string` | Country name |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `isoCountryCode` | `string` | [Standard country code](https://www.iso.org/iso-3166-country-codes.html). |
| `label` | `string` | Localized display name. |
| `neighborhood` | `string` | Neighborhood name. |
| `poBox` | `string` | P.O. Box. |
| `postalCode` | `string` | Local post code. |
| `region` | `string` | Region or state name. |
| `street` | `string` | Street name. |

#### CalendarFormatType

**Type:** `CalendarFormats | unknown`

#### Contact

A set of fields that define information about a single contact entity.

| Property | Type | Description |
| --- | --- | --- |
| `addresses` | `Address[]` | Locations. |
| `birthday` | `Date` | Birthday information in Gregorian format. |
| `company` | `string` | Organization the entity belongs to. |
| `contactType` | `ContactType` | Denoting a person or company. |
| `dates` | `Date[]` | A labeled list of other relevant user dates in Gregorian format. |
| `department` | `string` | Job department. |
| `emails` | `Email[]` | Email addresses. |
| `firstName` | `string` | Given name. |
| `id` | `string` | Immutable identifier used for querying and indexing. This value will be generated by the OS when the contact is created. |
| `image` | `Image` | Thumbnail image. On iOS it size is set to 320×320px, on Android it may vary. |
| `imageAvailable` | `boolean` | Used for efficient retrieval of images. |
| `instantMessageAddresses` | `InstantMessageAddress[]` | Instant messaging connections. |
| `isFavorite` | `boolean` | Whether the contact is starred. |
| `jobTitle` | `string` | Job description. |
| `lastName` | `string` | Last name. |
| `maidenName` | `string` | Maiden name. |
| `middleName` | `string` | Middle name |
| `name` | `string` | Full name with proper format. |
| `namePrefix` | `string` | Dr., Mr., Mrs., and so on. |
| `nameSuffix` | `string` | Jr., Sr., and so on. |
| `nickname` | `string` | An alias to the proper name. |
| `nonGregorianBirthday` | `Date` | Birthday that doesn't conform to the Gregorian calendar format, interpreted based on the [calendar `format`](#date) setting. |
| `note` | `string` | Additional information. > The `note` field [requires your app to request additional entitlements](https://developer.apple.com/documentation/bundleresources/entitlements/com_apple_developer_contacts_notes). > The Expo Go app does not contain those entitlements, so in order to test this feature you will need to [request the entitlement from Apple](https://developer.apple.com/contact/request/contact-note-field), > set the [`ios.accessesContactNotes`]() field in **app config** to `true`, and [create your development build](/develop/development-builds/create-a-build/). |
| `phoneNumbers` | `PhoneNumber[]` | Phone numbers. |
| `phoneticFirstName` | `string` | Pronunciation of the first name. |
| `phoneticLastName` | `string` | Pronunciation of the last name. |
| `phoneticMiddleName` | `string` | Pronunciation of the middle name. |
| `rawImage` | `Image` | Raw image without cropping, usually large. |
| `relationships` | `Relationship[]` | Names of other relevant user connections. |
| `socialProfiles` | `SocialProfile[]` | Social networks. |
| `urlAddresses` | `UrlAddress[]` | Associated web URLs. |

#### ContactAccessButtonProps

**Type:** `unknown`

#### ContactQuery

Used to query contacts from the user's device.

| Property | Type | Description |
| --- | --- | --- |
| `containerId` | `string` | Get all contacts that belong to the container matching this ID. |
| `fields` | `FieldType[]` | If specified, the defined fields will be returned. If skipped, all fields will be returned. |
| `groupId` | `string` | Get all contacts that belong to the group matching this ID. |
| `id` | `string | string[]` | Get contacts with a matching ID or array of IDs. |
| `name` | `string` | Get all contacts whose name contains the provided string (not case-sensitive). |
| `pageOffset` | `number` | The number of contacts to skip before gathering contacts. |
| `pageSize` | `number` | The max number of contacts to return. If skipped or set to `0` all contacts will be returned. |
| `rawContacts` | `boolean` | Prevent unification of contacts when gathering. |
| `sort` | `ContactSort` | Sort method used when gathering contacts. |

#### ContactResponse

The return value for queried contact operations like `getContactsAsync`.

| Property | Type | Description |
| --- | --- | --- |
| `data` | `Contact[]` | An array of contacts that match a particular query. |
| `hasNextPage` | `boolean` | This will be `true` if there are more contacts to retrieve beyond what is returned. |
| `hasPreviousPage` | `boolean` | This will be `true` if there are previous contacts that weren't retrieved due to `pageOffset` limit. |

#### ContactSort

**Type:** `unknown`

#### ContactsPermissionResponse

**Type:** `unknown`

#### ContactType

**Type:** `ContactTypes | unknown`

#### Container

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | - |
| `name` | `string` | - |
| `type` | `ContainerType` | - |

#### ContainerQuery

Used to query native contact containers.

| Property | Type | Description |
| --- | --- | --- |
| `contactId` | `string` | Query all the containers that parent a contact. |
| `containerId` | `string | string[]` | Query all the containers that matches ID or an array od IDs. |
| `groupId` | `string` | Query all the containers that parent a group. |

#### ContainerType

**Type:** `ContainerTypes | unknown`

#### Date

| Property | Type | Description |
| --- | --- | --- |
| `day` | `number` | Day. |
| `format` | `CalendarFormatType` | Format for the date. This is provided by the OS, do not set this manually. |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `label` | `string` | Localized display name. |
| `month` | `number` | Month - adjusted for JavaScript `Date` which starts at `0`. |
| `year` | `number` | Year. |

#### Email

| Property | Type | Description |
| --- | --- | --- |
| `email` | `string` | Email address. |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `isPrimary` | `boolean` | Flag signifying if it is a primary email address. |
| `label` | `string` | Localized display name. |

#### FieldType

**Type:** `Fields | unknown`

#### FormOptions

Denotes the functionality of a native contact form.

| Property | Type | Description |
| --- | --- | --- |
| `allowsActions` | `boolean` | Actions like share, add, create. |
| `allowsEditing` | `boolean` | Allows for contact mutation. |
| `alternateName` | `string` | Used if contact doesn't have a name defined. |
| `cancelButtonTitle` | `string` | The name of the left bar button. |
| `displayedPropertyKeys` | `FieldType[]` | The properties that will be displayed. On iOS those properties does nothing while in editing mode. |
| `groupId` | `string` | The parent group for a new contact. |
| `isNew` | `boolean` | Present the new contact controller. If set to `false` the unknown controller will be shown. |
| `message` | `string` | Controller title. |
| `preventAnimation` | `boolean` | Prevents the controller from animating in. |
| `shouldShowLinkedContacts` | `boolean` | Show or hide the similar contacts. |

#### Group

A parent to contacts. A contact can belong to multiple groups. Here are some query operations you can perform:
- Child Contacts: `getContactsAsync({ groupId })`
- Groups From Container: `getGroupsAsync({ containerId })`
- Groups Named: `getContainersAsync({ groupName })`

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | The editable name of a group. |
| `name` | `string` | Immutable id representing the group. |

#### GroupQuery

Used to query native contact groups.

| Property | Type | Description |
| --- | --- | --- |
| `containerId` | `string` | Query all groups that belong to a certain container. |
| `groupId` | `string` | Query the group with a matching ID. |
| `groupName` | `string` | Query all groups matching a name. |

#### Image

Information regarding thumbnail images.
> On Android you can get dimensions using [`Image.getSize`](https://reactnative.dev/docs/image#getsize) method.

| Property | Type | Description |
| --- | --- | --- |
| `base64` | `string` | Image as Base64 string. |
| `height` | `number` | Image height |
| `uri` | `string` | A local image URI. > **Note**: If you have a remote URI, download it first using  [`FileSystem.downloadAsync`](/versions/latest/sdk/filesystem/#filesystemdownloadasyncuri-fileuri-options). |
| `width` | `number` | Image width. |

#### InstantMessageAddress

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `label` | `string` | Localized display name. |
| `localizedService` | `string` | Localized name of app. |
| `service` | `string` | Name of instant messaging app. |
| `username` | `string` | Username in IM app. |

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

#### PhoneNumber

| Property | Type | Description |
| --- | --- | --- |
| `countryCode` | `string` | Country code. |
| `digits` | `string` | Phone number without format. |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `isPrimary` | `boolean` | Flag signifying if it is a primary phone number. |
| `label` | `string` | Localized display name. |
| `number` | `string` | Phone number. |

#### Relationship

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `label` | `string` | Localized display name. |
| `name` | `string` | Name of related contact. |

#### SocialProfile

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `label` | `string` | Localized display name. |
| `localizedProfile` | `string` | Localized profile name. |
| `service` | `string` | Name of social app. |
| `url` | `string` | Web URL. |
| `userId` | `string` | Username ID in social app. |
| `username` | `string` | Username in social app. |

#### UrlAddress

| Property | Type | Description |
| --- | --- | --- |
| `id` | `string` | Unique ID. This value will be generated by the OS. |
| `label` | `string` | Localized display name. |
| `url` | `string` | Web URL. |

### Enums

#### CalendarFormats

This format denotes the common calendar format used to specify how a date is calculated in `nonGregorianBirthday` fields.

| Value | Description |
| --- | --- |
| `Buddhist` | - |
| `Chinese` | - |
| `Coptic` | - |
| `EthiopicAmeteAlem` | - |
| `EthiopicAmeteMihret` | - |
| `Gregorian` | - |
| `Hebrew` | - |
| `Indian` | - |
| `Islamic` | - |
| `IslamicCivil` | - |
| `IslamicTabular` | - |
| `IslamicUmmAlQura` | - |
| `ISO8601` | - |
| `Japanese` | - |
| `Persian` | - |
| `RepublicOfChina` | - |

#### ContactTypes

| Value | Description |
| --- | --- |
| `Company` | Contact is group or company. |
| `Person` | Contact is a human. |

#### ContainerTypes

| Value | Description |
| --- | --- |
| `CardDAV` | With cardDAV protocol used for sharing. |
| `Exchange` | In association with email server. |
| `Local` | A local non-iCloud container. |
| `Unassigned` | Unknown container. |

#### Fields

Possible fields to retrieve for a contact.

| Value | Description |
| --- | --- |
| `Addresses` | - |
| `Birthday` | - |
| `Company` | - |
| `ContactType` | - |
| `Dates` | - |
| `Department` | - |
| `Emails` | - |
| `ExtraNames` | - |
| `FirstName` | - |
| `ID` | - |
| `Image` | - |
| `ImageAvailable` | - |
| `InstantMessageAddresses` | - |
| `IsFavorite` | - |
| `JobTitle` | - |
| `LastName` | - |
| `MaidenName` | - |
| `MiddleName` | - |
| `Name` | - |
| `NamePrefix` | - |
| `NameSuffix` | - |
| `Nickname` | - |
| `NonGregorianBirthday` | - |
| `Note` | - |
| `PhoneNumbers` | - |
| `PhoneticFirstName` | - |
| `PhoneticLastName` | - |
| `PhoneticMiddleName` | - |
| `RawImage` | - |
| `Relationships` | - |
| `SocialProfiles` | - |
| `UrlAddresses` | - |

#### PermissionStatus

| Value | Description |
| --- | --- |
| `DENIED` | User has denied the permission. |
| `GRANTED` | User has granted the permission. |
| `UNDETERMINED` | User hasn't granted or denied the permission yet. |

#### SortTypes

| Value | Description |
| --- | --- |
| `FirstName` | Sort by first name in ascending order. |
| `LastName` | Sort by last name in ascending order. |
| `None` | No sorting should be applied. |
| `UserDefault` | The user default method of sorting. |
