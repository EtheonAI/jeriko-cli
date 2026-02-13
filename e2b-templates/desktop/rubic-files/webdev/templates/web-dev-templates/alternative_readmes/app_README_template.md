# Expo Mobile Template

React Native mobile app with **Expo SDK 54**, **TypeScript**, and **React 19**.

**Tech Stack:** React Native 0.81 | Expo Router 6 | NativeWind 4 (Tailwind CSS) | TypeScript 5.9 | react-native-reanimated 4.x

---

## Quick Start

1. **Edit the home screen** — `app/(tabs)/index.tsx` is your app's main entry point
2. **Customize theme** — Update tokens in `theme.config.js` (used by Tailwind + runtime) and app details in `app.config.ts`
3. **Add new screens** — Use `ScreenContainer` component for proper SafeArea handling
4. **Add tab icons** — Map icons in `icon-symbol.tsx` BEFORE using in tabs

---

## Project Structure

```
app/
  _layout.tsx        ← Root layout with providers
  (tabs)/
    _layout.tsx      ← Tab bar configuration
    index.tsx        ← Home screen (EDIT THIS FIRST)
  oauth/             ← Auth callback (don't modify)
components/
  screen-container.tsx ← SafeArea wrapper (USE FOR ALL SCREENS)
  themed-view.tsx    ← View with auto theme background
  ui/
    icon-symbol.tsx  ← Tab bar icon mapping (ADD ICONS HERE FIRST)
constants/
  theme.ts           ← Runtime palette re-export (implemented in lib/_core/theme.ts)
theme.config.js      ← Single palette config (edit tokens here first)
theme.config.d.ts    ← Palette typings (update when adding new keys)
lib/_core/theme.ts   ← Runtime palette builder (shared by Tailwind + useColors)
lib/theme-provider.tsx ← Global theme context (light/dark switch)
lib/_core/nativewind-pressable.ts ← Disables Pressable className to avoid NativeWind pitfalls
hooks/
  use-auth.ts        ← Auth state hook
  use-colors.ts      ← Theme colors hook
  use-color-scheme.ts ← Dark/light mode detection
lib/
  trpc.ts            ← API client
  utils.ts           ← Utility functions (cn)
global.css           ← Tailwind directives
tailwind.config.js   ← Tailwind theme configuration
assets/images/       ← App icons and splash
```

---

## Styling with NativeWind (Tailwind CSS)

This template uses **NativeWind v4** for Tailwind CSS support in React Native.

### Basic Usage

```tsx
import { Text, View } from "react-native";

export function MyComponent() {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <Text className="text-2xl font-bold text-foreground">
        Hello World
      </Text>
      <Text className="mt-2 text-muted">
        Subtitle text
      </Text>
    </View>
  );
}
```

### Available Colors (from `theme.config.js`)

Tokens are defined once in `theme.config.js` and shared by Tailwind + runtime (`useColors()`):

| Token | Usage |
|-------|-------|
| `background` | Screen/page background |
| `foreground` | Primary text |
| `muted` | Secondary text |
| `primary` | Accent/tint color |
| `surface` | Cards/elevated surfaces |
| `border` | Borders/dividers |
| `success` | Success states |
| `warning` | Warning states |
| `error` | Error states |

**Dark mode:** Use color tokens directly (e.g., `text-foreground`, `bg-background`); ThemeProvider + CSS variables switch schemes automatically, no `dark:` prefix needed.

### Layout Tips
- If content may overflow, wrap the whole page in a `ScrollView`; short lists inside can use `.map()`.
- When multiple texts/icons must be inline, set parent `flex-row` (Pressable/TouchableOpacity default to column).
- Pressable className is globally disabled; pass interaction styles via `style`.
- For text inputs that submit on keyboard, set `returnKeyType="done"` (and handle submit) to avoid “Enter does nothing” issues on mobile.

### Combining Classes

Use the `cn()` utility from `@/lib/utils`:

```tsx
import { cn } from "@/lib/utils";

<View className={cn(
  "p-4 rounded-lg",
  isActive && "bg-primary",
  disabled && "opacity-50"
)} />
```

---

## State Management Guidance

- Default: React Context + `useReducer`/`useState` (simpler, fewer pitfalls). Persist with `AsyncStorage`/`MMKV` if needed.
- If you choose Zustand:
  - Selectors must return stable references (no new objects/arrays inside selectors).
  - Subscribe to data, not functions: `useStore((s) => s.state.entries)`; derive with `useMemo`.
  - Why: unstable selectors cause stale renders or render loops.
- For server data, prefer TanStack Query (already included).
- Expo FileSystem (SDK 54+): default to `import * as FileSystem from "expo-file-system/legacy"` to avoid deprecation warnings. If you need the new API, use `import { File } from "expo-file-system/next"` and `await new File(uri).base64()`.
- Provider wiring checklist: whenever you create a new context/provider, import it in `app/_layout.tsx` and wrap the app (outermost or alongside ThemeProvider) before calling any `useXxx` hook.

## Data & API Guidance

- Keep data flow consistent: define shared types/schemas and ensure sender/receiver param names match (e.g., route params, API payloads).
- No mock/placeholder numbers in UI; if data is unavailable, show loading/unknown, not hardcoded values.
- Platform-specific file handling: on iOS, `MediaLibrary.getAssetsAsync()` URIs (ph://) are not readable—use `MediaLibrary.getAssetInfoAsync()` to get `localUri` before reading/uploading.
- Validate end-to-end: API → data transform → navigation params → UI render. Avoid stopping halfway. 

## Screen Layout

### The Problem

React Native screens need to handle:
- Status bar area (notch on iPhone X+)
- Home indicator area (bottom of iPhone X+)
- Tab bar overlap

### The Solution: ScreenContainer

**Always use `ScreenContainer` for screen content:**

```tsx
import { Text } from "react-native";
import { ScreenContainer } from "@/components/screen-container";

export default function MyScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground">
        Welcome
      </Text>
    </ScreenContainer>
  );
}
```

`ScreenContainer` handles:
- Background color extends behind status bar
- Content stays within safe bounds
- Tab bar area handled correctly

### ScreenContainer Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | string | - | Tailwind classes for content area |
| `edges` | Edge[] | `["top", "left", "right"]` | SafeArea edges to apply |
| `containerClassName` | string | - | Classes for outer background container |

```tsx
// Full-screen modal (needs all edges)
<ScreenContainer edges={["top", "bottom", "left", "right"]}>

// Screen with custom bottom handling
<ScreenContainer edges={["top", "left", "right"]}>
```

---

## Interaction Design

### Priority Order

Build in this order — don't skip to polish before functionality works:

1. **Functionality** — All buttons work, all flows complete, no dead ends
2. **Feedback** — User knows their action was received (press states, loading indicators)
3. **Polish** — Animations and transitions (only if time permits)

### Press Feedback

| Element | Feedback | Implementation |
|---------|----------|----------------|
| Primary buttons | Scale + haptic | `scale: 0.97` + `Haptics.impactAsync(Light)` |
| List items / cards | Opacity | `opacity: 0.7` on press |
| Icons / minor actions | Opacity only | `opacity: 0.6` on press |

```tsx
<Pressable
  onPress={handlePress}
  style={({ pressed }) => [
    styles.button,
    pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 }
  ]}
>
```

### Haptics

Use `expo-haptics` sparingly — overuse diminishes impact:

| Context | Type |
|---------|------|
| Button tap (primary actions) | `impactAsync(ImpactFeedbackStyle.Light)` |
| Toggle / switch | `impactAsync(ImpactFeedbackStyle.Medium)` |
| Success / completion | `notificationAsync(NotificationFeedbackType.Success)` |
| Error / failure | `notificationAsync(NotificationFeedbackType.Error)` |

### Animation (Optional Polish)

Only add animations after core functionality works. Keep them subtle:

```tsx
// ✅ Good: Subtle fade in
withTiming(1, { duration: 250 })

// ✅ Good: Gentle press feedback
withTiming(0.97, { duration: 80 })

// ❌ Bad: Bouncy spring
withSpring(1, { damping: 5 })  // Too bouncy

// ❌ Bad: Dramatic scale
withTiming(0.8, { duration: 200 })  // Too much
```

**Guidelines:**
- Duration: 80-300ms for interactions, up to 400ms for transitions
- Scale changes: 0.95-0.98 range (never below 0.9)
- Prefer `withTiming` with easing over `withSpring`
- Don't animate on mount unless it adds meaning

---

## Native Features

### Audio (expo-audio)

```tsx
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";

// IMPORTANT: Enable playback in iOS silent mode
await setAudioModeAsync({ playsInSilentModeIOS: true });

// Always release player on cleanup
useEffect(() => {
  return () => player.release();
}, []);

// Use real audio sources (no mock/generated placeholders). Track playback state internally for reliable UI:
// type Track = { player: AudioPlayer; volume: number; loop: boolean; isPlaying: boolean };
// track.player.play(); track.isPlaying = true; emit();
// track.player.pause(); track.isPlaying = false; emit();
// const isPlaying = track.isPlaying; // use for UI instead of player.playing (may lag on native)
```

**Getting Free Audio:** Use browser console on [pixabay.com/sound-effects](https://pixabay.com/sound-effects/):
```javascript
// 1) Open a sound page (or search results) on pixabay.com/sound-effects
// 2) Paste this in browser DevTools console to list direct mp3 links
const urls = document.documentElement.innerHTML.match(/https?:\/\/[^"'\s]+\.mp3[^"'\s]*/g) || [];
console.log(urls);
```

### Keep Screen Awake (expo-keep-awake)

```tsx
import { useKeepAwake } from "expo-keep-awake";

// Screen stays on while component is mounted
// Use for: meditation, workout, reading screens
useKeepAwake();
```

### Platform Detection

Disable native-only features on web:

```tsx
import { Platform } from "react-native";

if (Platform.OS !== "web") {
  Haptics.impactAsync(ImpactFeedbackStyle.Light);
}
```

---

## Project Conventions

### Tab Icons
Add mapping in `icon-symbol.tsx` BEFORE using in tabs — otherwise app crashes.

### Data Storage
Prefer `AsyncStorage` for local persistence. Only add backend for cross-device sync.

### Lists
Always use `FlatList` — never `ScrollView` with `.map()`.

### Styles
Use `StyleSheet.create()` outside component, or Tailwind classes. Never inline style objects.

---

## Common Pitfalls

| Pitfall | Solution |
|---------|----------|
| Broken user flows / dead ends | Verify all flows end-to-end before delivery. Every `onPress` must work. |
| Missing icon mapping | Add to `icon-symbol.tsx` BEFORE using in tabs |
| Text clipped at top/bottom | Ensure `lineHeight > fontSize` (1.2-1.5×) |
| Background gap in dark mode | Use `ScreenContainer` |
| Content under notch | Use `ScreenContainer` |
| Slow list scrolling | Use `FlatList`, never `ScrollView` with `.map()` |
| Styles recreated every render | Use `StyleSheet.create()` outside component |
| iOS crash in gesture callbacks | Gesture handlers run as worklets. Use `.runOnJS(true)` on the gesture, or wrap JS calls with `runOnJS()` |
| Web crash with AnimatedSvg | Don't use `Animated.createAnimatedComponent(Svg)`. Wrap `<Svg>` with `<Animated.View>` instead |
| Gesture not responding | Ensure `GestureHandlerRootView` wraps the app |
| State changes not persisted | Call `saveSettings()` or `AsyncStorage.setItem()` after `setState()` |
| Bottom elements hidden by Tab Bar | Use `useSafeAreaInsets().bottom` or increase `bottom` value |
| **Pressable onPress not firing** | **Never use `className` on Pressable** — always use `style` prop |

### Common Crash Patterns

- **iOS crash on gesture**: Check worklet/JS thread issues (see Common Pitfalls)
- **Web white screen**: Check browser console for errors
- **Android ANR**: Check for blocking operations on main thread

---

## Backend Capabilities

The server provides these **built-in** capabilities (no external API keys required):

| Feature | What It Provides | When To Use |
|---------|------------------|-------------|
| **LLM/AI** | Multimodal AI (text, image, audio) | Image recognition, chat, content generation |
| **User Auth** | OAuth login, session management | User accounts |
| **Database** | PostgreSQL + Drizzle ORM | Cross-device data sync |
| **File Storage** | S3-compatible storage | User-uploaded files |
| **Push Notifications** | Server-side delivery | Notify users of events |

> **Important**: For AI features, use the server's built-in LLM — do NOT ask users for API keys.

See `server/README.md` for implementation details.

---

## Delivery Checklist

Before delivering:

- [ ] All buttons and links work (no empty `onPress` handlers)
- [ ] Core user flows tested end-to-end
- [ ] `app/(tabs)/index.tsx` customized
- [ ] `tailwind.config.js` colors match brand
- [ ] `app.config.ts` app name updated
- [ ] Icon mappings added in `icon-symbol.tsx`
- [ ] No console errors on iOS, Android, and Web

---

## Core File References

Note: All TODO comments are remarks for the agent (you), not for the user.

`components/screen-container.tsx`
```tsx
{{FILE:components/screen-container.tsx}}
```

`app/(tabs)/_layout.tsx`
```tsx
{{FILE:app/(tabs)/_layout.tsx}}
```

`app/(tabs)/index.tsx`
```tsx
{{FILE:app/(tabs)/index.tsx}}
```

`lib/utils.ts`
```ts
{{FILE:lib/utils.ts}}
```

`hooks/use-colors.ts`
```tsx
{{FILE:hooks/use-colors.ts}}
```

`components/ui/icon-symbol.tsx`
```tsx
{{FILE:components/ui/icon-symbol.tsx}}
```

`tailwind.config.js`
```js
{{FILE:tailwind.config.js}}
```

`theme.config.js`
```js
{{FILE:theme.config.js}}
```

`app.config.ts`
```ts
{{FILE:app.config.ts}}
```

`package.json`
```json
{{FILE:package.json}}
```
