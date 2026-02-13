---
name: router-ui
description: UI components for Expo Router like Link and navigation helpers.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Router UI

An Expo Router submodule that provides headless tab components to create custom tab layouts.

**Platforms:** android, ios, tvos, web

**Package:** `expo-router`

`expo-router/ui` is a submodule of `expo-router` library and exports components and hooks to build custom tab layouts, rather than using the default [React Navigation](https://reactnavigation.org/) navigators provided by `expo-router`.

> See the [Expo Router](./router) reference for more information about the file-based routing library for native and web app.

## Quick Start

Here is a minimal example of how to use `Tabs` to create a custom tab navigation.

```tsx
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <Tabs>
      <TabList>
        <TabTrigger href="/one">
          <Text>Tab One</Text>
        </TabTrigger>
        <TabTrigger href="/two">
          <Text>Tab Two</Text>
        </TabTrigger>
      </TabList>
      <TabSlot />
    </Tabs>
  );
}
```

## When to Use

Use `expo-router/ui` when you need to create a custom tab-based navigation that deviates from the default styles provided by Expo Router. This is ideal for unique branding or complex UI requirements that standard tab navigators cannot accommodate.

## Common Pitfalls

### 1. Forgetting to include `<TabSlot />`

**Problem**: The content of your tabs does not render, and you see a blank screen.

**Solution**: Ensure you have included the `<TabSlot />` component within your `<Tabs>` component. This component is responsible for rendering the content of the currently active tab.

```tsx
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';

export default function App() {
  return (
    <Tabs>
      <TabList>
        {/* ... your TabTriggers */}
      </TabList>
      {/* Make sure TabSlot is included */}
      <TabSlot />
    </Tabs>
  );
}
```

### 2. Incorrectly nesting components

**Problem**: Your tab layout does not work as expected, or you get errors about incorrect component hierarchy.

**Solution**: Follow the correct component structure. `<TabTrigger>` components should be direct children of `<TabList>`, and `<TabList>` and `<TabSlot>` should be direct children of `<Tabs>`.

```tsx
<Tabs>
  <TabList>
    <TabTrigger href="/one">
      <Text>Tab One</Text>
    </TabTrigger>
  </TabList>
  <TabSlot />
</Tabs>
```

## Common Patterns

### 1. Styling the Active Tab

This pattern shows how to apply different styles to the active tab using the `isFocused` property provided by `TabTrigger`.

```tsx
import { Tabs, TabList, TabTrigger, TabSlot } from 'expo-router/ui';
import { View, Text, StyleSheet } from 'react-native';

export default function App() {
  return (
    <Tabs>
      <TabList>
        <TabTrigger href="/one">
          {({ isFocused }) => (
            <View style={[styles.tab, isFocused && styles.activeTab]}>
              <Text style={isFocused ? styles.activeText : styles.text}>Tab One</Text>
            </View>
          )}
        </TabTrigger>
        <TabTrigger href="/two">
          {({ isFocused }) => (
            <View style={[styles.tab, isFocused && styles.activeTab]}>
              <Text style={isFocused ? styles.activeText : styles.text}>Tab Two</Text>
            </View>
          )}
        </TabTrigger>
      </TabList>
      <TabSlot />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tab: {
    padding: 10,
  },
  activeTab: {
    borderBottomColor: 'blue',
    borderBottomWidth: 2,
  },
  text: {
    color: 'black',
  },
  activeText: {
    color: 'blue',
    fontWeight: 'bold',
  },
});
```

## Installation

To use `expo-router/ui` in your project, you need to install `expo-router` in your project. Follow the instructions from the Expo Router's installation guide:

**[Install Expo Router](/router/installation/)**

Learn how to install Expo Router in your project.

## Configuration in app config

If you are using the [default](/more/create-expo/#--template) template to create a new project, `expo-router`'s [config plugin](/config-plugins/introduction/) is already configured in your app config.

**Example:** app.json
```json
{
  "expo": {
    "plugins": ["expo-router"]
  }
}
```

## Usage

For information about using `expo-router/ui` in Custom tab layouts guide:

<!-- (Expo docs component omitted) | title: Custom tab layouts | link: /router/advanced/custom-tabs/ -->

## API

```js

```

## API Reference

### Methods

#### TabContext

```typescript
TabContext(props: ProviderProps<ExpoTabsNavigatorScreenOptions>): ReactNode
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `props` | `ProviderProps<ExpoTabsNavigatorScreenOptions>` | - |

#### TabList

Wrapper component for `TabTriggers`. `TabTriggers` within the `TabList` define the tabs.

```typescript
TabList(__namedParameters: TabListProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `TabListProps` | - |

#### Tabs
Root component for the headless tabs.

```typescript
Tabs(props: TabsProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `props` | `TabsProps` | - |

#### TabSlot

Renders the current tab.

```typescript
TabSlot(props: TabSlotProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `props` | `TabSlotProps` | - |

#### TabTrigger

Creates a trigger to navigate to a tab. When used as child of `TabList`, its
functionality slightly changes since the `href` prop is required,
and the trigger also defines what routes are present in the `Tabs`.

When used outside of `TabList`, this component no longer requires an `href`.

```typescript
TabTrigger(__namedParameters: TabTriggerProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `TabTriggerProps` | - |

#### useTabSlot

Returns a `ReactElement` of the current tab.

```typescript
useTabSlot(__namedParameters: TabSlotProps): Element
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `__namedParameters` | `TabSlotProps` | - |

#### useTabsWithChildren

Hook version of `Tabs`. The returned NavigationContent component
should be rendered. Using the hook requires using the `<TabList />`
and `<TabTrigger />` components exported from Expo Router.

The `useTabsWithTriggers()` hook can be used for custom components.

```typescript
useTabsWithChildren(options: UseTabsWithChildrenOptions): object
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `UseTabsWithChildrenOptions` | - |

#### useTabsWithTriggers

Alternative hook version of `Tabs` that uses explicit triggers
instead of `children`.

```typescript
useTabsWithTriggers(options: UseTabsWithTriggersOptions): TabsContextValue
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `UseTabsWithTriggersOptions` | - |

#### useTabTrigger
Utility hook creating custom `TabTrigger`.

```typescript
useTabTrigger(options: TabTriggerProps): UseTabTriggerResult
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `TabTriggerProps` | - |

### Types

#### ExpoTabsNavigationProp

**Type:** `NavigationProp<ParamList, RouteName, NavigatorID, TabNavigationState<ParamListBase>, ExpoTabsScreenOptions, TabNavigationEventMap>`

#### ExpoTabsNavigatorOptions

**Type:** `unknown`

#### ExpoTabsNavigatorScreenOptions

| Property | Type | Description |
| --- | --- | --- |
| `detachInactiveScreens` | `boolean` | - |
| `freezeOnBlur` | `boolean` | - |
| `lazy` | `boolean` | - |
| `unmountOnBlur` | `boolean` | - |

#### ExpoTabsProps

**Type:** `ExpoTabsNavigatorOptions`

#### ExpoTabsResetValue

**Type:** `'always' | 'onFocus' | 'never'`

#### ExpoTabsScreenOptions

**Type:** `unknown`

#### Route

**Type:** `unknown`

#### SwitchToOptions

Options for `switchTab` function.

| Property | Type | Description |
| --- | --- | --- |
| `reset` | `ExpoTabsResetValue` | Navigate and reset the history. |

#### TabContextValue

**Type:** `unknown`

#### TabListProps

**Type:** `unknown`

#### TabNavigationEventMap

| Property | Type | Description |
| --- | --- | --- |
| `tabLongPress` | `{ data: undefined }` | Event which fires on long press on the tab in the tab bar. |
| `tabPress` | `{ canPreventDefault: true; data: undefined }` | Event which fires on tapping on the tab in the tab bar. |

#### TabsContextValue

The React Navigation custom navigator.

**Type:** `ReturnType<unknown>`

#### TabsDescriptor

**Type:** `unknown`

#### TabSlotProps


**Type:** `unknown`

#### TabsProps

**Type:** `unknown`

#### TabsSlotRenderOptions

Options provided to the `UseTabSlotOptions`.

| Property | Type | Description |
| --- | --- | --- |
| `detachInactiveScreens` | `boolean` | Should the screen be unloaded when inactive. |
| `index` | `number` | Index of screen. |
| `isFocused` | `boolean` | Whether the screen is focused. |
| `loaded` | `boolean` | Whether the screen has been loaded. |

#### TabTriggerOptions

| Property | Type | Description |
| --- | --- | --- |
| `href` | `Href` | - |
| `name` | `string` | - |

#### TabTriggerProps

**Type:** `unknown`

#### TabTriggerSlotProps

**Type:** `unknown`

#### Trigger

**Type:** `unknown`

#### TriggerProps

| Property | Type | Description |
| --- | --- | --- |
| `isFocused` | `boolean` | - |
| `onLongPress` | `unknown` | - |
| `onPress` | `unknown` | - |

#### UseTabsOptions

Options to provide to the Tab Router.

**Type:** `unknown`

#### UseTabsWithChildrenOptions

**Type:** `PropsWithChildren<UseTabsOptions>`

#### UseTabsWithTriggersOptions

**Type:** `unknown`

#### UseTabTriggerResult

| Property | Type | Description |
| --- | --- | --- |
| `getTrigger` | `(name: string) => Trigger | undefined` | - |
| `switchTab` | `(name: string, options: SwitchToOptions) => void` | - |
| `trigger` | `Trigger` | - |
| `triggerProps` | `TriggerProps` | - |
