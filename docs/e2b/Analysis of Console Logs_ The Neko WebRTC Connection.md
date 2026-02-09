# Analysis of Console Logs: The Neko WebRTC Connection

**Author:** Manus AI
**Date:** February 9, 2026

## Introduction

This report addresses your discovery of console logs after pressing the Control key within the virtual computer interface. Your findings are insightful and provide a perfect real-world example of the client-side component of the screen-streaming technology discussed in my previous report. The logs you've captured are from the **Neko WebRTC client**, the JavaScript application running in your browser that is responsible for receiving the video stream and sending your control inputs back to the sandbox.

This document will break down how those specific log entries correlate directly with the server-side processes running inside my E2B sandbox, explaining the end-to-end workflow from your key press to its execution within the virtual environment.

## The Client-Server Connection: Your Browser and My Sandbox

The console output originates from the Neko client's JavaScript file, `app.f5410b2c.js`, which is loaded into your browser from a Content Delivery Network (CDN), as specified in the `index.html` file served by the `neko` server in my sandbox. This client-side application communicates directly with the `neko` server process running on port `8333` inside my sandbox.

This communication happens in two main phases:
1.  **Signaling over WebSockets**: An initial connection is made using WebSockets. This connection is used to exchange metadata and the necessary information for the two parties (your browser and my sandbox server) to find each other on the network.
2.  **Media and Data over WebRTC**: Once the signaling is complete, a direct peer-to-peer (or peer-to-relay-to-peer) WebRTC connection is established. This connection is highly optimized for low-latency video, audio, and data transfer. The video stream of my desktop is sent over this connection, and your keyboard/mouse inputs are sent back.

## Deconstructing Your Console Logs

The log entries you provided map perfectly to this two-phase process. Let's examine the key events:

| Log Entry | Phase | Explanation |
| :--- | :--- | :--- |
| `received websocket event system/init` | Signaling | The `neko` server in my sandbox sends initial configuration data to the client in your browser. This includes details like screen resolution, available configurations, and member lists. |
| `received websocket event signal/provide` | Signaling | This is the start of the WebRTC handshake. The server provides its Session Description Protocol (SDP) offer, which describes its media capabilities. |
| `received websocket event signal/candidate` | Signaling | Both the client and server exchange ICE (Interactive Connectivity Establishment) candidates. These are potential network paths (IP addresses and ports) that can be used to establish a direct connection. |
| `peer signaling state changed have-remote-offer` | WebRTC Setup | The client has received the server's offer and is now processing it. |
| `received audio track from peer: audio` | WebRTC Connection | The WebRTC data channel is established, and the audio stream from the sandbox has started to arrive at your browser. |
| `received video track from peer: video` | WebRTC Connection | The video stream of my desktop has successfully started arriving at your browser. |
| `peer ice connection state changed: connected` | WebRTC Connection | A stable, direct connection path has been successfully negotiated and established between your browser and the `neko` server. |
| `sending event 'control/keyboard'` | User Input | This is the event triggered when you pressed the `Control` key. The client-side JavaScript captures this input and sends it back to the `neko` server over the established WebRTC data channel. |
| `sending event 'control/clipboard'` | User Input | Similarly, this shows the client syncing its clipboard state with the remote sandbox. |

## How Your Keystroke is Processed

Here is the complete, end-to-end journey of your `Control` key press:

1.  **Capture**: The Neko JavaScript client (`app.f5410b2c.js`) running in your browser captures the key press event.
2.  **Transmit**: It sends a `control/keyboard` message containing the key information back to the `neko` server process inside my sandbox via the secure WebRTC data channel.
3.  **Receive**: The `neko` server on port `8333` receives this message.
4.  **Inject**: The `neko` server then uses the Linux input event subsystem (`uinput`) to inject a virtual key press into the `Xorg` virtual display server.
5.  **Execution**: The application currently in focus within the sandbox (e.g., a terminal, a web browser) receives the `Control` key press as if it were typed on a physical keyboard connected directly to the machine.

## Distinction from Agent Code Execution

It is important to distinguish this user-facing interaction from my own operations as an AI agent. 

*   **Your Interaction (Neko/WebRTC)**: You interact with the sandbox visually through the Neko WebRTC stream. Your inputs are sent to the `neko` server on port `8333`. This is for direct, manual control and observation.
*   **My Interaction (Sandbox Runtime API)**: I execute tasks programmatically by calling a separate, internal API server called `sandbox-runtime` on port `8330`. When I use a tool like `shell(command='ls -l')`, I am making a request to this API, which then executes the command and returns the result to me as text. I do not 
I do not "see" the screen or "type" on the keyboard in the same way you do. My interaction is purely programmatic through a dedicated API, which is more efficient and structured for automated tasks.

## Conclusion

The console logs you discovered provide a valuable window into the client-side workings of the sandbox's sophisticated screen-streaming technology. They demonstrate the standard and robust WebRTC protocol in action, establishing a low-latency connection for both video streaming and control input. This mechanism for direct user interaction is a separate and parallel system to the programmatic API that I, the Manus agent, use to execute the tasks you assign to me. Both systems, however, operate within the same secure and isolated E2B sandbox environment.
