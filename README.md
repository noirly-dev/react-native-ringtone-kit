# @noirly-dev/react-native-ringtone-kit

Browse, preview, and select system / custom ringtones and notification sounds in React Native apps.

## Why this library

Headless sound catalog layer — no picker UI chrome, no system-wide ringtone mutation. The library enumerates sounds where the OS allows it, previews them, and returns stable URIs your app can attach to alarms/notifications.

**In scope:** system ringtone/notification/alarm enumeration (Android), native system picker (Android), preview playback, custom/bundled catalogs, JS sound providers.

**Out of scope:** silently writing the device ringtone, iOS system sound enumeration (no public API), shipping a branded picker UI.

## Platform capability matrix

| Capability | Android | iOS |
|---|---|---|
| Enumerate system ringtones/notification/alarm sounds | ✅ | ❌ `unsupported` |
| Native system picker UI | ✅ | ❌ `unsupported` — use custom JS picker |
| Preview playback | ✅ | ✅ (bundled/custom URIs) |
| Stable reference returned to app | ✅ `content://` | ✅ `file://` |
| Custom/bundled sound catalogs | ✅ | ✅ |

## Requirements

- React Native CLI (no Expo)
- New Architecture enabled
- React Native 0.76+

| Library | React Native | Android min | iOS min |
|---------|--------------|-------------|---------|
| 0.1.x   | 0.76+        | 24          | 15.1    |

## Installation

This package is published to [GitHub Packages](https://github.com/noirly-dev/react-native-ringtone-kit/packages) under the `@noirly-dev` scope.

### 1. Configure npm for GitHub Packages

```ini
@noirly-dev:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### 2. Install

```bash
npm install @noirly-dev/react-native-ringtone-kit
# or
yarn add @noirly-dev/react-native-ringtone-kit
```

Autolinking handles native setup. Run `pod install` in your iOS project after installing.

## Quick start

```typescript
import {
  RingtoneKit,
  registerSoundProvider,
  isRingtoneKitError,
} from '@noirly-dev/react-native-ringtone-kit';

const result = await RingtoneKit.getSounds('alarm');
if (result.status === 'available') {
  const sound = result.data[0];
  await RingtoneKit.previewSound(sound.id);
}

const unsubscribe = RingtoneKit.addListener('onPreviewStateChanged', event => {
  console.log(event.status, event.soundId);
});

// iOS / custom catalogs
registerSoundProvider({
  id: 'noirly.bundled',
  getSounds: async () => [
    {
      id: 'radar',
      title: 'Radar',
      category: 'custom',
      uri: 'file:///path/to/radar.m4a',
      source: 'custom-provider',
    },
  ],
  getSoundUri: async id => `file:///path/to/${id}.m4a`,
});

const custom = await RingtoneKit.getSounds('custom');
```

On platforms where a capability is unavailable, methods return a typed `CapabilityResult` with `status: 'unsupported'` — not an empty array and not a thrown error.

## API reference

| Group | Methods |
|-------|---------|
| Catalog | `getSounds`, `getSelectedSound` |
| Picker | `openSystemPicker` |
| Preview | `previewSound`, `stopPreview` |
| Events | `addListener`, `addPreviewStateListener` |
| Providers | `registerSoundProvider`, `unregisterSoundProvider` |

Architecture details live in [`react-native-ringtone-kit-ARCHITECTURE.md`](./react-native-ringtone-kit-ARCHITECTURE.md).

## License

MIT
