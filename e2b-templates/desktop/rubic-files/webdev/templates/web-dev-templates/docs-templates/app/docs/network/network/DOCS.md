---
name: network
description: Check network connectivity and connection type.
metadata:
  sdk: expo-54
  type: expo-sdk-module
---

# Network

A library that provides access to the device's network such as its IP address, MAC address, and airplane mode status.

**Platforms:** android, ios, web, tvos

**Package:** `expo-network`

`expo-network` provides useful information about the device's network such as its IP address, MAC address, and airplane mode status.

## Quick Start

```javascript
import React, { useState, useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
import * as Network from 'expo-network';

export default function App() {
  const [ipAddress, setIpAddress] = useState(null);

  useEffect(() => {
    (async () => {
      const ip = await Network.getIpAddressAsync();
      setIpAddress(ip);
    })();
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Your IP Address is: {ipAddress}</Text>
    </View>
  );
}
```

## When to Use

Use the `expo-network` module when you need to check the device's network status, such as determining if the device is connected to a network, the type of network connection, or the device's IP address. This is useful for conditionally enabling or disabling network-dependent features in your app.

## Common Pitfalls

*   **Problem**: Assuming `isConnected` means internet is reachable. The `isConnected` flag only indicates that the device is connected to a network, not that it has internet access.
*   **Solution**: Use the `isInternetReachable` property to check for internet connectivity.

    ```javascript
    const networkState = await Network.getNetworkStateAsync();
    if (networkState.isInternetReachable) {
      console.log('Internet is reachable');
    } else {
      console.log('Internet is not reachable');
    }
    ```

*   **Problem**: Not handling the case where the IP address cannot be retrieved. `getIpAddressAsync` can fail, returning `0.0.0.0`.
*   **Solution**: Check for the `0.0.0.0` return value and handle it gracefully.

    ```javascript
    const ipAddress = await Network.getIpAddressAsync();
    if (ipAddress === '0.0.0.0') {
      // Handle the error, e.g., show a message to the user
    }
    ```

## Common Patterns

*   **Displaying Network Status**: A common pattern is to display the network status to the user, especially in apps that rely heavily on a network connection.

    ```javascript
    import React from 'react';
    import { View, Text } from 'react-native';
    import * as Network from 'expo-network';

    export default function NetworkStatus() {
      const networkState = Network.useNetworkState();

      return (
        <View>
          <Text>Is Connected: {networkState.isConnected.toString()}</Text>
          <Text>Is Internet Reachable: {networkState.isInternetReachable.toString()}</Text>
          <Text>Type: {networkState.type}</Text>
        </View>
      );
    }
    ```

## Installation

```bash
$ npx expo install expo-network
```

## Configuration

On Android, this module requires permissions to access the network and Wi-Fi state. The permissions `ACCESS_NETWORK_STATE` and `ACCESS_WIFI_STATE` are added automatically.

## API

```js
import * as Network from 'expo-network';
```

## Error codes

| Code                                    | Description                                                                                                                                                                                |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ERR_NETWORK_IP_ADDRESS                  | On Android, there may be an unknown Wi-Fi host when trying to access `WifiManager` in `getIpAddressAsync`. On iOS, no network interfaces could be retrieved.                               |
| ERR_NETWORK_UNDEFINED_INTERFACE         | An undefined `interfaceName` was passed as an argument in `getMacAddressAsync`.                                                                                                            |
| ERR_NETWORK_SOCKET_EXCEPTION            | An error was encountered in creating or accessing the socket in `getMacAddressAsync`.                                                                                                      |
| ERR_NETWORK_INVALID_PERMISSION_INTERNET | There are invalid permissions for [`android.permission.ACCESS_WIFI_STATE`](https://developer.android.com/reference/android/Manifest.permission#ACCESS_WIFI_STATE) in `getMacAddressAsync`. |
| ERR_NETWORK_NO_ACCESS_NETWORKINFO       | Unable to access network information                                                                                                                                                       |

## API Reference

### Methods

#### addNetworkStateListener

Adds a listener that will fire whenever the network state changes.

```typescript
addNetworkStateListener(listener: (event: NetworkState) => void): EventSubscription
```

**Parameters:**

| Name | Type | Description |
| --- | --- | --- |
| `listener` | `(event: NetworkState) => void` | Callback to execute when the network state changes. The callback is provided with a single argument that is an object containing information about the network state. |

**Returns:** A subscription object with a remove function to unregister the listener.

#### getIpAddressAsync

Gets the device's current IPv4 address. Returns `0.0.0.0` if the IP address could not be retrieved.

On web, this method uses the third-party [`ipify service`](https://www.ipify.org/) to get the
public IP address of the current device.

```typescript
getIpAddressAsync(): Promise<string>
```

**Returns:** A `Promise` that fulfils with a `string` of the current IP address of the device's main
network interface. Can only be IPv4 address.

#### getNetworkStateAsync

Gets the device's current network connection state.

On web, `navigator.connection.type` is not available on browsers. So if there is an active
network connection, the field `type` returns `NetworkStateType.UNKNOWN`. Otherwise, it returns
`NetworkStateType.NONE`.

```typescript
getNetworkStateAsync(): Promise<NetworkState>
```

**Returns:** A `Promise` that fulfils with a `NetworkState` object.

#### isAirplaneModeEnabledAsync

Tells if the device is in airplane mode.

**Platform:** android

```typescript
isAirplaneModeEnabledAsync(): Promise<boolean>
```

**Returns:** Returns a `Promise` that fulfils with a `boolean` value for whether the device is in
airplane mode or not.

#### useNetworkState

Returns the current network state of the device. This method
initiates a listener for network state changes and cleans up before unmounting.

```typescript
useNetworkState(): NetworkState
```

**Returns:** The current network state of the device, including connectivity and type.

### Types

#### NetworkState

| Property | Type | Description |
| --- | --- | --- |
| `isConnected` | `boolean` | If there is an active network connection. Note that this does not mean that internet is reachable. This field is `false` if the type is either `Network.NetworkStateType.NONE` or `Network.NetworkStateType.UNKNOWN`, `true` otherwise. |
| `isInternetReachable` | `boolean` | If the internet is reachable with the currently active network connection. On Android, this depends on `NetInfo.isConnected()` (API level < 29) or `ConnectivityManager.getActiveNetwork()` (API level >= 29). On iOS, this value will always be the same as `isConnected`. |
| `type` | `NetworkStateType` | A [`NetworkStateType`](#networkstatetype) enum value that represents the current network connection type. |

#### NetworkStateEvent

Represents an event that provides the updated network state when there is a change in the network status.
This is passed as the argument to listeners registered with [`addNetworkStateListener()`](#networkaddnetworkstatelistenerlistener).

**Type:** `NetworkState`

### Enums

#### NetworkStateType

An enum of the different types of devices supported by Expo.

| Value | Description |
| --- | --- |
| `BLUETOOTH` | Active network connection over Bluetooth. |
| `CELLULAR` | Active network connection over mobile data or [`DUN-specific`](https://developer.android.com/reference/android/net/ConnectivityManager#TYPE_MOBILE_DUN)
mobile connection when setting an upstream connection for tethering. |
| `ETHERNET` | Active network connection over Ethernet. |
| `NONE` | No active network connection detected. |
| `OTHER` | Active network connection over other network connection types. |
| `UNKNOWN` | The connection type could not be determined. |
| `VPN` | Active network connection over VPN. |
| `WIFI` | Active network connection over Wi-Fi. |
| `WIMAX` | Active network connection over WiMAX. |
