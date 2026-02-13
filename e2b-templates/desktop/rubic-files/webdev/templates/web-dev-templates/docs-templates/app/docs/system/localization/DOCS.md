---
name: localization
description: Get device locale, language, and region settings.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Localization

A library that provides an interface for native user localization information.

**Platforms:** android, ios, tvos, web

**Package:** `expo-localization`

`expo-localization` allows you to Localize your app, customizing the experience for specific regions, languages, or cultures. It also provides access to the locale data on the native device. Using a localization library such as [`lingui-js`](https://lingui.dev/introduction), [`react-i18next`](https://react.i18next.com/), [`react-intl`](https://formatjs.io/docs/getting-started/installation/) or [`i18n-js`](https://github.com/fnando/i18n-js) with `expo-localization` will enable you to create a very accessible experience for users.

## Quick Start

Here is a minimal example of how to get the device's localization information.

```jsx
import { Text, View, StyleSheet } from 'react-native';
import * as Localization from 'expo-localization';

export default function App() {
  const { locales, timezone } = Localization.getCalendars()[0];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Localization Info</Text>
      <Text>Locales: {JSON.stringify(locales, null, 2)}</Text>
      <Text>Timezone: {timezone}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});
```

## When to Use

Use `expo-localization` to access the user's preferred language, region, and measurement system. This is essential for internationalizing your app and providing a localized user experience. It's often used with a translation library like `i18n-js` or `react-i18next`.

## Common Pitfalls

### 1. Stale Localization Data on Android

- **Problem**: On Android, a user can change their locale settings without restarting the app. If you only fetch the localization data once, it can become stale.
- **Solution**: Re-fetch the localization data when the app returns to the foreground using the `AppState` module.

```jsx
import { AppState } from 'react-native';
import * as Localization from 'expo-localization';
import { useState, useEffect } from 'react';

export function useLocalization() {
  const [locales, setLocales] = useState(Localization.getLocales());

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setLocales(Localization.getLocales());
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return locales;
}
```

### 2. `currencyCode` is `null` on Web

- **Problem**: The `currencyCode` and `measurementSystem` properties are `null` when running on the web because browser APIs do not expose this information directly.
- **Solution**: For web, you may need to infer these values from the `regionCode` using a lookup table or ask the user for their preference directly.

## Common Patterns

### 1. Integrating with a Translation Library (`i18n-js`)

This pattern shows how to combine `expo-localization` with `i18n-js` to provide translations in your app.

```jsx
import { I18n } from 'i18n-js';
import * as Localization from 'expo-localization';

const translations = {
  en: { welcome: 'Hello' },
  es: { welcome: 'Hola' },
};

const i18n = new I18n(translations);
i18n.locale = Localization.getLocales()[0].languageTag;
i18n.enableFallback = true;

export default i18n;
```

## Installation

```bash
$ npx expo install expo-localization
```

## Configuration in app config

You can configure `expo-localization` using its built-in [config plugin](/config-plugins/introduction/) if you use config plugins in your project ([Continuous Native Generation (CNG)](/workflow/continuous-native-generation/)). The plugin allows you to configure various properties that cannot be set at runtime and require building a new app binary to take effect. If your app does **not** use CNG, then you'll need to manually configure the library.

**Example:** app.json
```json
{
  "expo": {
    "plugins": ["expo-localization"]
  }
}
```

## Usage

Find more information about using `expo-localization` and adding support for right-to-left languages in the [Localization](/guides/localization) guide.

## API

```jsx

```

### Behavior

You can use synchronous `getLocales()` and `getCalendars()` methods to get the locale settings of the user device. On iOS, the results will remain the same while the app is running.

On Android, the user can change locale preferences in Settings without restarting apps. To keep the localization current, you can rerun the `getLocales()` and `getCalendars()` methods every time the app returns to the foreground. Use `AppState` to detect this.

## API Reference

### Methods

#### getCalendars

```typescript
getCalendars(): Calendar[]
```

#### getLocales

```typescript
getLocales(): Locale[]
```

#### useCalendars

A hook providing a list of user's preferred calendars, returned as an array of objects of type `Calendar`.
Guaranteed to contain at least 1 element.
For now always returns a single element, but it's likely to return a user preference list on some platforms in the future.
If the OS settings change, the hook will rerender with a new list of calendars.

```typescript
useCalendars(): Calendar[]
```

#### useLocales
A hook providing a list of user's locales, returned as an array of objects of type `Locale`.
Guaranteed to contain at least 1 element.
These are returned in the order the user defines in their device settings.
On the web currency and measurements systems are not provided, instead returned as null.
If needed, you can infer them from the current region using a lookup table.
If the OS settings change, the hook will rerender with a new list of locales.

```typescript
useLocales(): Locale[]
```

### Types

#### Calendar

| Property | Type | Description |
| --- | --- | --- |
| `calendar` | `CalendarIdentifier | null` | The calendar identifier, one of [Unicode calendar types](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar). On Android is limited to one of device's [available calendar types](https://developer.android.com/reference/java/util/Calendar#getAvailableCalendarTypes()). On iOS uses [calendar identifiers](https://developer.apple.com/documentation/foundation/calendar/identifier), but maps them to the corresponding Unicode types, will also never contain `'dangi'` or `'islamic-rgsa'` due to it not being implemented on iOS. |
| `firstWeekday` | `Weekday | null` | The first day of the week. For most calendars Sunday is numbered `1`, with Saturday being number `7`. Can be null on some browsers that don't support the [weekInfo](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/weekInfo) property in [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) API. |
| `timeZone` | `string | null` | Time zone for the calendar. Can be `null` on Web. |
| `uses24hourClock` | `boolean | null` | True when current device settings use 24-hour time format. Can be null on some browsers that don't support the [hourCycle](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/hourCycle) property in [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) API. |

#### Locale

| Property | Type | Description |
| --- | --- | --- |
| `currencyCode` | `string | null` | Currency code for the locale. On iOS, it's the currency code from the `Region` setting under Language & Region, not for the current locale. On Android, it's the currency specifc to the locale in the list, as there are no separate settings for selecting a region. Is `null` on Web, use a table lookup based on region instead. |
| `currencySymbol` | `string | null` | Currency symbol for the currency specified by `currencyCode`. |
| `decimalSeparator` | `string | null` | Decimal separator used for formatting numbers with fractional parts. |
| `digitGroupingSeparator` | `string | null` | Digit grouping separator used for formatting large numbers. |
| `languageCode` | `string | null` | An [IETF BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag) without the region code. |
| `languageCurrencyCode` | `string | null` | Currency code for the locale. On iOS, it's the currency code for the current locale in the list, not the device region. On Android, it's equal to `currencyCode`. Is `null` on Web. Prefer using `currencyCode` for any internalization purposes. |
| `languageCurrencySymbol` | `string | null` | Currency symbol for the currency specified by `languageCurrencyCode`. Prefer using `currencySymbol` for any internalization purposes. |
| `languageRegionCode` | `string | null` | The region code for the preferred language. When the language is not region-specific, it returns the same value as `regionCode`. When the language is region-specific, it returns the region code for the language (`en-CA` -> `CA`). Prefer using `regionCode` for any internalization purposes. |
| `languageScriptCode` | `string | null` | An [ISO 15924](https://en.wikipedia.org/wiki/ISO_15924) 4-letter script code. On Android and Web, it may be `null` if none is defined. |
| `languageTag` | `string` | An [IETF BCP 47 language tag](https://en.wikipedia.org/wiki/IETF_language_tag) with a region code. |
| `measurementSystem` | `'metric' | 'us' | 'uk' | null` | The measurement system used in the locale. Is `null` on Web, as user chosen measurement system is not exposed on the web and using locale to determine measurement systems is unreliable. Ask for user preferences if possible. |
| `regionCode` | `string | null` | The region code for your device that comes from the Region setting under Language & Region on iOS, Region settings on Android and is parsed from locale on Web (can be `null` on Web). |
| `temperatureUnit` | `'celsius' | 'fahrenheit' | null` | The temperature unit used in the locale. Returns `null` if the region code is unknown. |
| `textDirection` | `'ltr' | 'rtl' | null` | Text direction for the locale. One of: `'ltr'`, `'rtl'`, but can also be `null` on some browsers without support for the [textInfo](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/textInfo) property in [Intl](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl) API. |

### Enums

#### CalendarIdentifier

The calendar identifier, one of [Unicode calendar types](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Locale/calendar).
Gregorian calendar is aliased and can be referred to as both `CalendarIdentifier.GREGORIAN` and `CalendarIdentifier.GREGORY`.

| Value | Description |
| --- | --- |
| `BUDDHIST` | Thai Buddhist calendar |
| `CHINESE` | Traditional Chinese calendar |
| `COPTIC` | Coptic calendar |
| `DANGI` | Traditional Korean calendar |
| `ETHIOAA` | Ethiopic calendar, Amete Alem (epoch approx. 5493 B.C.E) |
| `ETHIOPIC` | Ethiopic calendar, Amete Mihret (epoch approx, 8 C.E.) |
| `GREGORIAN` | Gregorian calendar (alias) |
| `GREGORY` | Gregorian calendar |
| `HEBREW` | Traditional Hebrew calendar |
| `INDIAN` | Indian calendar |
| `ISLAMIC` | Islamic calendar |
| `ISLAMIC_CIVIL` | Islamic calendar, tabular (intercalary years [2,5,7,10,13,16,18,21,24,26,29] - civil epoch) |
| `ISLAMIC_RGSA` | Islamic calendar, Saudi Arabia sighting |
| `ISLAMIC_TBLA` | Islamic calendar, tabular (intercalary years [2,5,7,10,13,16,18,21,24,26,29] - astronomical epoch) |
| `ISLAMIC_UMALQURA` | Islamic calendar, Umm al-Qura |
| `ISO8601` | ISO calendar (Gregorian calendar using the ISO 8601 calendar week rules) |
| `JAPANESE` | Japanese imperial calendar |
| `PERSIAN` | Persian calendar |
| `ROC` | Civil (algorithmic) Arabic calendar |

#### Weekday

An enum mapping days of the week in Gregorian calendar to their index as returned by the `firstWeekday` property.

| Value | Description |
| --- | --- |
| `FRIDAY` | - |
| `MONDAY` | - |
| `SATURDAY` | - |
| `SUNDAY` | - |
| `THURSDAY` | - |
| `TUESDAY` | - |
| `WEDNESDAY` | - |
