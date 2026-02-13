---
name: cellular
description: Get cellular network information and carrier details.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Cellular

An API that provides information about the user's cellular service provider.

**Platforms:** android, ios, web

**Package:** `expo-cellular`

`expo-cellular` provides information about the user's cellular service provider, such as its unique identifier, cellular connection type, and whether it allows VoIP calls on its network.

## Installation

```bash
$ npx expo install expo-cellular
```

## Configuration

If you're not using Continuous Native Generation ([CNG](/workflow/continuous-native-generation/)) (you're using a native **android** project manually), then you need to add the `android.permission.READ_PHONE_STATE` permission to your project's **AndroidManifest.xml**. This permission is used for `TelephonyManager`.

**Example:** android/app/src/main/AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.READ_PHONE_STATE" />
```

This library does not require the more risky `READ_PRIVILEGED_PHONE_STATE` permission.

## API

```js
import * as Cellular from 'expo-cellular';
```

## Common patterns

### 1) Fetch carrier info once (handle `null` everywhere)

Carrier data is often unavailable due to SIM state, airplane mode, being out of service range, or privacy restrictions. Treat every field as optional and design UI fallbacks.

```ts
import * as Cellular from 'expo-cellular';

export type CarrierInfo = {
  carrierName: string | null;
  isoCountryCode: string | null;
  mobileCountryCode: string | null;
  mobileNetworkCode: string | null;
};

export async function getCarrierInfoAsync(): Promise<CarrierInfo> {
  return {
    carrierName: await Cellular.getCarrierNameAsync(),
    isoCountryCode: await Cellular.getIsoCountryCodeAsync(),
    mobileCountryCode: await Cellular.getMobileCountryCodeAsync(),
    mobileNetworkCode: await Cellular.getMobileNetworkCodeAsync(),
  };
}
```

### 2) Getting cellular generation (request permission on Android)

On Android, `getCellularGenerationAsync()` requires phone state permission to reliably return a value other than `UNKNOWN`. Use the built-in permission helpers before showing 2G/3G/4G/5G UX.

```ts
import * as Cellular from 'expo-cellular';

export async function getCellularGenerationWithPermissionAsync(): Promise<Cellular.CellularGeneration> {
  const perm = await Cellular.getPermissionsAsync();
  if (!perm.granted) {
    const req = await Cellular.requestPermissionsAsync();
    if (!req.granted) return Cellular.CellularGeneration.UNKNOWN;
  }
  return await Cellular.getCellularGenerationAsync();
}
```

### 3) VoIP support checks (cross-platform)

- On **iOS**, this reflects the carrier's policy (and can persist after removing a SIM until replaced).
- On **Android**, this checks whether SIP-based VoIP is supported by the system API.
- On **web**, this returns `null`.

Use `allowsVoipAsync()` when you need an up-to-date value and can handle `null` gracefully.

```ts
import * as Cellular from 'expo-cellular';

const allowsVoip = await Cellular.allowsVoipAsync(); // boolean | null
```

## Example usage

### Basic example: show carrier + MCC/MNC + generation

```tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Cellular from 'expo-cellular';

type CarrierInfo = {
  name: string | null;
  isoCountryCode: string | null;
  mobileCountryCode: string | null;
  mobileNetworkCode: string | null;
  generation: Cellular.CellularGeneration;
  allowsVoip: boolean | null;
};

export default function CellularExample() {
  const [info, setInfo] = useState<CarrierInfo | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const generation = await Cellular.getCellularGenerationAsync();
      const next: CarrierInfo = {
        name: await Cellular.getCarrierNameAsync(),
        isoCountryCode: await Cellular.getIsoCountryCodeAsync(),
        mobileCountryCode: await Cellular.getMobileCountryCodeAsync(),
        mobileNetworkCode: await Cellular.getMobileNetworkCodeAsync(),
        generation,
        allowsVoip: await Cellular.allowsVoipAsync(),
      };
      if (mounted) setInfo(next);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function generationLabel(gen: Cellular.CellularGeneration): string {
    switch (gen) {
      case Cellular.CellularGeneration.CELLULAR_2G:
        return '2G';
      case Cellular.CellularGeneration.CELLULAR_3G:
        return '3G';
      case Cellular.CellularGeneration.CELLULAR_4G:
        return '4G';
      case Cellular.CellularGeneration.CELLULAR_5G:
        return '5G';
      default:
        return 'Unknown';
    }
  }

  if (!info) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Cellular Information</Text>
      <Row label="Carrier" value={info.name ?? 'N/A'} />
      <Row label="Country Code" value={info.isoCountryCode ?? 'N/A'} />
      <Row label="MCC" value={info.mobileCountryCode ?? 'N/A'} />
      <Row label="MNC" value={info.mobileNetworkCode ?? 'N/A'} />
      <Row label="Network Type" value={generationLabel(info.generation)} />
      {info.allowsVoip !== null && <Row label="VoIP Allowed" value={info.allowsVoip ? 'Yes' : 'No'} />}
    </View>
  );
}

function Row(props: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{props.label}:</Text>
      <Text style={styles.value}>{props.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: { fontSize: 16, fontWeight: '600' },
  value: { fontSize: 16, color: '#666' },
});
```

### Advanced example: network quality indicator (polling)

If you need the UI to react to changing conditions, poll at a **low frequency** (and stop polling off-screen) to avoid battery drain.

```tsx
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Cellular from 'expo-cellular';

export default function NetworkQualityIndicator() {
  const [generation, setGeneration] = useState<Cellular.CellularGeneration>(
    Cellular.CellularGeneration.UNKNOWN
  );

  useEffect(() => {
    let mounted = true;

    async function refresh() {
      const gen = await Cellular.getCellularGenerationAsync();
      if (mounted) setGeneration(gen);
    }

    refresh();
    const interval = setInterval(refresh, 5000); // keep this conservative

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const quality = (() => {
    switch (generation) {
      case Cellular.CellularGeneration.CELLULAR_5G:
        return { text: 'Excellent (5G)', color: '#4CAF50' };
      case Cellular.CellularGeneration.CELLULAR_4G:
        return { text: 'Good (4G)', color: '#8BC34A' };
      case Cellular.CellularGeneration.CELLULAR_3G:
        return { text: 'Fair (3G)', color: '#FFC107' };
      case Cellular.CellularGeneration.CELLULAR_2G:
        return { text: 'Poor (2G)', color: '#FF9800' };
      default:
        return { text: 'Unknown', color: '#9E9E9E' };
    }
  })();

  return (
    <View style={styles.container}>
      <View style={[styles.badge, { backgroundColor: quality.color }]}>
        <Text style={styles.text}>{quality.text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 10 },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  text: { color: '#fff', fontWeight: 'bold' },
});
```

## Use cases

1. **Network-aware features**
   - Limit media quality on 2G/3G
   - Pre-fetch content on 4G/5G (or when on Wi-Fi using `expo-network`)
   - Warn before data-intensive operations
2. **Analytics & debugging**
   - Identify carrier-specific issues (consider hashing/anonymizing identifiers)
   - Segment performance metrics by network type
3. **Carrier / region adaptations**
   - Use country code for localization
   - Enable/disable features based on carrier capabilities (e.g., VoIP policy)

## Best practices & gotchas

- **Always handle `null`**: carrier fields commonly resolve to `null` (SIM missing, airplane mode, out of service, privacy limits, web).
- **Prefer one-time reads**: carrier identifiers rarely change; cache results per session unless you have a reason to refresh.
- **Poll sparingly**: if you must reflect changing generation, keep intervals conservative and stop polling when the screen is not visible.
- **Expect dynamic changes**: generation can switch during runtime (e.g., 5G -> 4G -> 3G).
- **Be privacy-conscious**: avoid logging raw MCC/MNC/carrier names unless you truly need them; aggregate or anonymize where possible.
- **Web is limited**: most carrier APIs return `null`; generation may be derived from `navigator.connection.effectiveType` when supported by the browser.

## Error codes

| Code                                         | Description                                                          |
| -------------------------------------------- | -------------------------------------------------------------------- |
| ERR_CELLULAR_GENERATION_UNKNOWN_NETWORK_TYPE | Unable to access network type or not connected to a cellular network |

## Permissions

### Android

You must add the following permissions to your **app.json** inside the [`expo.android.permissions`](../config/app/#permissions) array.

**Example:** app.json
```json
{
  "expo": {
    "android": {
      "permissions": ["READ_PHONE_STATE"]
    }
  }
}
```

### iOS

_No permissions required_.

## API Reference

### Methods

#### allowsVoipAsync

```typescript
allowsVoipAsync(): Promise<boolean | null>
```

**Returns:** Returns if the carrier allows making VoIP calls on its network. On Android, this checks whether
the system supports SIP-based VoIP API. See [here](https://developer.android.com/reference/android/net/sip/SipManager.html#isVoipSupported(android.content.Context))
to view more information.

On iOS, if you configure a device for a carrier and then remove the SIM card, this property
retains the `boolean` value indicating the carrier's policy regarding VoIP. If you then install
a new SIM card, its VoIP policy `boolean` replaces the previous value of this property.

On web, this returns `null`.

#### getCarrierNameAsync

```typescript
getCarrierNameAsync(): Promise<string | null>
```

**Returns:** Returns name of the user's home cellular service provider. If the device has dual SIM cards, only the
carrier for the currently active SIM card will be returned.

On Android, this value is only available when the SIM state is [`SIM_STATE_READY`](https://developer.android.com/reference/android/telephony/TelephonyManager.html#SIM_STATE_READY).
Otherwise, this returns `null`.

On iOS, if you configure a device for a carrier and then remove the SIM card, this property
retains the name of the carrier. If you then install a new SIM card, its carrier name replaces
the previous value of this property. The value for this property is `null` if the user never
configured a carrier for the device.

On web, this returns `null`.

#### getCellularGenerationAsync

```typescript
getCellularGenerationAsync(): Promise<CellularGeneration>
```

**Returns:** Returns a promise which fulfils with a [`Cellular.CellularGeneration`](#cellulargeneration)
enum value that represents the current cellular-generation type.

You will need to check if the native permission has been accepted to obtain generation.
If the permission is denied `getCellularGenerationAsync` will resolve to `Cellular.Cellular Generation.UNKNOWN`.

On web, this method uses [`navigator.connection.effectiveType`](https://developer.mozilla.org/en-US/docs/Web/API/NetworkInformation/effectiveType)
to detect the effective type of the connection using a combination of recently observed
round-trip time and downlink values. See [here](https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API)
to view browser compatibility.

#### getIsoCountryCodeAsync

```typescript
getIsoCountryCodeAsync(): Promise<string | null>
```

**Returns:** Returns the ISO country code for the user's cellular service provider.

On iOS, the value is `null` if any of the following apply:
- The device is in airplane mode.
- There is no SIM card in the device.
- The device is outside of cellular service range.

On web, this returns `null`.

#### getMobileCountryCodeAsync

```typescript
getMobileCountryCodeAsync(): Promise<string | null>
```

**Returns:** Returns mobile country code (MCC) for the user's current registered cellular service provider.

On Android, this value is only available when SIM state is [`SIM_STATE_READY`](https://developer.android.com/reference/android/telephony/TelephonyManager.html#SIM_STATE_READY). Otherwise, this
returns `null`. On iOS, the value may be null on hardware prior to iPhone 4S when in airplane mode.
Furthermore, the value for this property is `null` if any of the following apply:
- There is no SIM card in the device.
- The device is outside of cellular service range.

On web, this returns `null`.

#### getMobileNetworkCodeAsync

```typescript
getMobileNetworkCodeAsync(): Promise<string | null>
```

**Returns:** Returns the mobile network code (MNC) for the user's current registered cellular service provider.

On Android, this value is only available when SIM state is [`SIM_STATE_READY`](https://developer.android.com/reference/android/telephony/TelephonyManager.html#SIM_STATE_READY). Otherwise, this
returns `null`. On iOS, the value may be null on hardware prior to iPhone 4S when in airplane mode.
Furthermore, the value for this property is `null` if any of the following apply:
- There is no SIM card in the device.
- The device is outside of cellular service range.

On web, this returns `null`.

#### getPermissionsAsync

Checks user's permissions for accessing phone state.

```typescript
getPermissionsAsync(): Promise<PermissionResponse>
```

#### requestPermissionsAsync

Asks the user to grant permissions for accessing the phone state.

```typescript
requestPermissionsAsync(): Promise<PermissionResponse>
```

#### usePermissions

```typescript
usePermissions(options: PermissionHookOptions<object>): [null | PermissionResponse, RequestPermissionMethod<PermissionResponse>, GetPermissionMethod<PermissionResponse>]
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `options` | `PermissionHookOptions<object>` | - |

### Enums

#### CellularGeneration

Describes the current generation of the cellular connection. It is an enum with these possible
values:

| Value | Description |
| --- | --- |
| `CELLULAR_2G` | Currently connected to a 2G cellular network. Includes CDMA, EDGE, GPRS, and IDEN type connections. |
| `CELLULAR_3G` | Currently connected to a 3G cellular network. Includes EHRPD, EVDO, HSPA, HSUPA, HSDPA, HSPAP, and UTMS type connections. |
| `CELLULAR_4G` | Currently connected to a 4G cellular network. Includes LTE type connections. |
| `CELLULAR_5G` | Currently connected to a 5G cellular network. Includes NR and NRNSA type connections. |
| `UNKNOWN` | Either we are not currently connected to a cellular network or type could not be determined. |
