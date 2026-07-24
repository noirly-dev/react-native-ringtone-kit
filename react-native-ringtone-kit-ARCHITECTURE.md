# `react-native-ringtone-kit` — Production Architecture Specification

**Status:** Implemented (v0.1.0) — living reference; keep in sync with code
**Scope:** React Native CLI, New Architecture only (TurboModules + Codegen), Kotlin + Swift, TypeScript public API
**Audience:** Contributors, maintainers, downstream consumers evaluating the library's design
**Package:** `@noirly-dev/react-native-ringtone-kit` (native: `com.noirly.ringtonekit` / `NativeRingtoneKit`)

---

## Table of Contents

1. Library Identity, Naming & Scope Definition
2. Repository Structure & Monorepo Strategy
3. TurboModule Architecture & Codegen Spec Design
4. Public TypeScript API Surface
5. Android Native Architecture (Kotlin)
6. iOS Native Architecture (Swift)
7. Permission Handling Strategy
8. Audio Preview Playback Architecture
9. Event-Based Architecture
10. Error Handling & Error Code Taxonomy
11. Extensibility Architecture (Custom Sound Providers)
12. Backward Compatibility & API Versioning Strategy
13. Testing Strategy
14. Example Application Architecture
15. Documentation Strategy
16. CI/CD Pipeline Design
17. Release & Publishing Strategy
18. Performance Considerations
19. Security & Privacy Considerations

---

## 1. Library Identity, Naming & Scope Definition

### 1.1 Naming

Recommended: **`react-native-ringtone-kit`**, published optionally as `@yourorg/react-native-ringtone-kit`.

- `react-native-*` is the discovery convention for native modules.
- "Kit" signals a multi-capability surface (browse + preview + select + retrieve) rather than a single-purpose picker.
- Native symbol names (Kotlin package `com.ringtonekit`, Swift module `RingtoneKit`, TurboModule name `RingtoneKit`) stay **unscoped and stable** regardless of npm distribution scoping — distribution identity and native identity are decoupled on purpose, so an npm scope/ownership change never touches native code, autolinking config, or Codegen output.

### 1.2 Scope Boundary

**In scope (v1):**
- Enumerate system ringtones, notification sounds, alarm sounds (Android).
- Enumerate/register app-bundled or custom sound catalogs (both platforms).
- Preview playback of any enumerated sound, independent of any picker UI.
- Native system picker integration where the OS provides one (Android).
- Custom in-app picker capability for platforms/categories with no native picker (iOS).
- Return a stable, resolvable sound reference to the consuming app for **use within that app's own context** (e.g., attaching to a local/push notification via `UNNotificationSound` on iOS, or reading the `content://` URI on Android).

**Explicitly out of scope (v1), and why this is a design decision, not a gap:**
- **Writing the system-wide ringtone/notification sound silently.** Android's direct-write path (`Settings.System.RINGTONE` via `WRITE_SETTINGS`) is a special-access permission that Google Play restricts and reviews aggressively; baking it into a general-purpose library invites store rejection for every consumer. The user-mediated picker intent (`RingtoneManager.ACTION_RINGTONE_PICKER`) is in scope; direct silent mutation is not.
- **iOS system-wide ringtone assignment.** There is no public API for this at all — it is a sandbox boundary, not a partial capability, so it cannot be a "future enhancement," only a documented non-goal.

This boundary is treated as a first-class architectural artifact, not a footnote, because it determines what the TurboModule spec (Section 3), permission matrix (Section 7), and error taxonomy (Section 10) even need to express.

### 1.3 Platform Capability Matrix

| Capability | Android | iOS |
|---|---|---|
| Enumerate system ringtones/notification/alarm sounds | ✅ `RingtoneManager` | ❌ No public enumeration API |
| Native system picker UI | ✅ Intent-based | ❌ Does not exist; custom in-app picker required |
| Preview playback | ✅ `Ringtone` / `MediaPlayer` | ✅ `AVAudioPlayer` |
| Stable reference returned to app | ✅ `content://` URI | ✅ Local file URL (bundle/sandbox only) |
| Custom/bundled sound catalogs | ✅ Supported | ✅ Primary mechanism |

**Design consequence:** The public API is a **shared TypeScript contract with divergent native implementations** — not a fake unified UI. Calling an Android-only enumeration method on iOS returns a well-defined "unsupported on this platform" result (see Section 10), never a silently empty array, so consuming apps can branch UI deliberately instead of discovering the limitation at runtime.

### 1.4 New Architecture Framing

Because this is TurboModule-only with Codegen, the public contract must be expressible in a Codegen-compatible spec from day one:
- No loosely-typed (`any`/`Object`) payloads — every `Sound` shape must generate clean Kotlin data classes / Swift structs.
- All async operations are Promise-based JSI calls, not legacy bridge callbacks.
- Native → JS events use the New Architecture's `NativeEventEmitter`/JSI-backed emitter pattern (Section 9), not `DeviceEventEmitter`.

### 1.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Exclude silent system-wide ringtone writes | Avoids Play Store special-permission review risk; avoids promising an impossible iOS feature | Some consumers will request it; must be documented as an explicit non-goal |
| Shared contract, divergent native impl | Stable, backward-compatible public API even as platform capability diverges | Slightly heavier native layer; no free cross-platform UI reuse |
| "Unsupported" results instead of empty arrays | Honest, debuggable DX | Requires a richer result type than a bare array return |

---

## 2. Repository Structure & Monorepo Strategy

### 2.1 Recommended Layout

A **single-package repo with an embedded example app**, not a full monorepo with independent versioned packages. Reasoning: this library has one publishable artifact (the native module + its TS types); a multi-package workspace (Lerna/Nx-style) is justified when there are multiple independently-versioned deliverables, which isn't the case here. Over-engineering the repo topology adds maintenance overhead without benefit.

```
react-native-ringtone-kit/
├── src/                          # TypeScript public API + JS-side logic
│   ├── index.ts                  # Public entrypoint (barrel export)
│   ├── NativeRingtoneKit.ts      # Codegen TurboModule spec
│   ├── types.ts                  # Shared public types
│   ├── errors.ts                 # Error taxonomy (Section 10)
│   ├── providers/                # Extensibility layer (Section 11)
│   └── __tests__/                # JS unit tests
├── android/
│   ├── src/main/java/com/ringtonekit/
│   │   ├── RingtoneKitModule.kt
│   │   ├── RingtoneKitPackage.kt
│   │   ├── catalog/               # RingtoneManager access
│   │   ├── playback/              # Preview player
│   │   └── permissions/
│   └── build.gradle
├── ios/
│   ├── RingtoneKit.swift
│   ├── RingtoneKit.mm             # Objective-C++ bridge shim for Codegen
│   ├── Catalog/
│   ├── Playback/
│   └── RingtoneKit.podspec
├── example/                       # Standalone RN CLI app consuming the lib via local path
├── docs/                          # Extensive documentation (Section 15)
├── .github/workflows/             # CI/CD (Section 16)
├── react-native.config.js
├── RingtoneKit.podspec            # Root podspec (if not nested)
├── package.json
├── tsconfig.json
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

### 2.2 Reasoning

- **`src/` at root, native folders flat (`android/`, `ios/`)** mirrors the convention every RN autolinking tool (CLI, CocoaPods, Gradle) expects out of the box — deviating from this increases integration friction for consumers and contributors alike.
- **`example/` as a real, independent RN CLI app** (not a Storybook-style harness) is required because native module behavior can only be meaningfully verified end-to-end in an actual app shell, on-device or in a simulator/emulator.
- **`providers/` under `src/`** is called out early because Section 11's extensibility design (custom sound providers) needs a stable home in the public API surface, not a bolt-on later.

### 2.3 Monorepo vs. Single-Package Trade-off

| Approach | Benefit | Cost |
|---|---|---|
| Single package (recommended) | Simple versioning, simple CI, simple consumer install | Cannot version native platform code independently of TS |
| Yarn/NPM workspaces monorepo (lib + example + docs site) | Cleaner separation, shared tooling across packages | Overhead not justified until there's a second publishable artifact (e.g., a separate `@ringtonekit/expo-plugin` later) |

**Recommendation:** Start single-package. Revisit workspace structure only if/when a second independently-publishable artifact emerges (e.g., a companion dev-tools package) — this is consistent with the "future extensibility" requirement without premature structural complexity now.

### 2.4 New Architecture Considerations

- `react-native.config.js` must declare Codegen's `codegenConfig` pointer in `package.json` (name, type, `jsSrcsDir`) so both platforms' Codegen tasks discover the spec — this is a New Architecture–specific piece of repo wiring absent from old-architecture libraries.
- The Android `build.gradle` and iOS `podspec` both need New Architecture conditionals removed/simplified since this library is **New Architecture only** — no legacy bridge fallback code path, which actually *simplifies* the repo versus a dual-architecture-supporting library.

---

## 3. TurboModule Architecture & Codegen Spec Design

### 3.1 Core Principle

The **Codegen spec is the contract**, not an implementation detail. Every method, argument, return type, and event must be defined in `src/NativeRingtoneKit.ts` using Codegen-supported types, because Codegen generates the Kotlin/Java interface and the Objective-C++ interface directly from this file. Design discipline here cascades into both native layers automatically.

### 3.2 Codegen Type Constraints (why they shape the API)

Codegen (as of the New Architecture's current TS-based spec format) supports a constrained type system: primitives, arrays, and **object literal type shapes** (not arbitrary interfaces/unions in all positions), `Promise<T>` returns, and typed event emitter shapes. This means:

- `Sound` objects must be flat-ish, Codegen-expressible object shapes — no class instances, no methods on returned objects, no deeply polymorphic unions where Codegen can't generate a single native struct/data class.
- Nullable/optional fields must use Codegen's supported optionality syntax consistently, since Kotlin nullable types and Swift `Optional` are generated from this.
- Enums are represented as **string literal unions** (e.g., `SoundCategory = 'ringtone' | 'notification' | 'alarm'`) since Codegen maps these cleanly to both Kotlin `when` exhaustiveness and Swift `enum` generation patterns.

### 3.3 Module Boundary Decision

**One TurboModule (`RingtoneKit`) with logically grouped methods**, rather than multiple smaller TurboModules (e.g., separate `RingtoneCatalog`, `RingtonePlayer` modules).

Reasoning:
- A single native module instance means one JSI object, one native module registration, and one place consumers import from — simpler mental model and simpler autolinking.
- Internally, the Kotlin/Swift implementation is still cleanly separated into catalog/playback/permission components (Sections 5–6) — the **module boundary is a public API decision**, not a constraint on internal code organization.
- Trade-off: a single module means one Codegen spec file grows large. Mitigated by organizing `NativeRingtoneKit.ts` into clearly commented sections (catalog methods, playback methods, permission methods) rather than splitting the TurboModule itself.

### 3.4 Sync vs. Async Methods

All methods are **async (Promise-returning)**. New Architecture technically permits synchronous JSI methods (`returns T` instead of `Promise<T>`), but:
- Enumerating system ringtones touches `ContentResolver`/`MediaStore` on Android — inherently I/O-bound, must never block the JS thread.
- Even "trivial" calls like `stopPreview()` are kept async for **API consistency** — mixing sync and async method signatures in one module is a common source of confusing consumer-facing inconsistency and brittle native threading assumptions. The minor overhead of a Promise wrapper on a fast native call is negligible next to that consistency win.

### 3.5 Event Emitter in Codegen

New Architecture TurboModules declare events via typed emitter methods in the spec (e.g., `onPreviewPlaybackStateChanged: EventEmitter<PreviewPlaybackEvent>`), which Codegen turns into native emitter scaffolding on both platforms, replacing the old `RCTEventEmitter` pattern. Full design in Section 9; the point here is that **event shapes must also be Codegen-legal types**, same constraint as method payloads.

### 3.6 Trade-offs Summary

| Decision | Benefit | Cost |
|---|---|---|
| Single TurboModule | Simple consumer surface, simple autolinking | Larger spec file to keep organized |
| All-async methods | Consistent mental model, no JS-thread blocking risk | Marginal overhead on trivially fast calls |
| Flat Codegen-legal object shapes | Native code generation stays clean on both platforms | Some TS ergonomics (e.g., class methods on `Sound`) sacrificed; compensated for in the JS-side wrapper layer (Section 4) |

---

## 4. Public TypeScript API Surface

### 4.1 Design Principle: Two-Layer API

- **Layer 1 — Codegen spec (`NativeRingtoneKit.ts`)**: the raw, Codegen-legal native contract. Not exported to consumers directly.
- **Layer 2 — Public API (`index.ts`)**: a hand-authored, ergonomic TypeScript wrapper around Layer 1. This is what consumers actually import.

Reasoning: Codegen's type constraints (Section 3.2) are real but shouldn't leak into consumer-facing ergonomics. The wrapper layer can offer richer TS conveniences (discriminated unions, helper methods, default parameters) while the underlying native contract stays Codegen-simple. This indirection is also what makes **backward compatibility (Section 12)** achievable — Layer 2's shape can stay stable even if Layer 1 has to evolve for native reasons.

### 4.2 Representative Public Shape (types only, no implementation)

```ts
// Core domain types
export type SoundCategory = 'ringtone' | 'notification' | 'alarm' | 'custom';

export interface Sound {
  id: string;                 // stable identifier (platform-specific encoding, opaque to consumer)
  title: string;
  category: SoundCategory;
  uri: string;                // content:// (Android) or file URL (iOS)
  durationMs?: number;
  isSystemDefault?: boolean;
  source: 'system' | 'bundled' | 'custom-provider';
}

export type CapabilityResult<T> =
  | { status: 'available'; data: T }
  | { status: 'unsupported'; reason: string }
  | { status: 'permission-required'; permission: string };

export interface RingtoneKitApi {
  getSounds(category: SoundCategory): Promise<CapabilityResult<Sound[]>>;
  openSystemPicker(category: SoundCategory): Promise<CapabilityResult<Sound | null>>;
  previewSound(soundId: string): Promise<void>;
  stopPreview(): Promise<void>;
  getSelectedSound(category: SoundCategory): Promise<Sound | null>;

  // Event subscriptions (Section 9)
  addPreviewStateListener(cb: (event: PreviewStateEvent) => void): { remove: () => void };
}
```

### 4.3 Why `CapabilityResult<T>` Instead of Throwing/Returning Empty

This is the direct implementation of the Section 1.3 principle: platform capability gaps are **modeled in the type system**, not hidden. A consumer calling `getSounds('ringtone')` on iOS gets `{ status: 'unsupported', reason: '...' }` — a value they must consciously handle per TypeScript's exhaustiveness checking — rather than an empty array indistinguishable from "there really are zero ringtones."

Trade-off: slightly more verbose call sites (`if (result.status === 'available')`) versus a naive `Sound[]` return. Accepted deliberately — silent platform-capability gaps are a worse production bug class than a few extra lines of consumer code.

### 4.4 Backward-Compatible API Design Principles

- **Additive-only evolution**: new optional fields on `Sound`, new `CapabilityResult` variants are additive; existing consumer code (especially exhaustive `switch`/`if` chains) must be re-verified against new union variants — documented explicitly in the changelog process (Section 12).
- **No breaking renames without a major version** — enforced via the versioning strategy (Section 12) and a deprecation-shim pattern (old method name calls new one, emits a dev-only console warning, removed only at next major).
- **Category as a string literal union, not an enum object** — avoids the classic TS enum interop pitfall (numeric enums serializing awkwardly across the JSI boundary) and keeps the type Codegen-compatible at Layer 1 too.

### 4.5 New Architecture Considerations

- Every Layer 2 method is a thin pass-through to Layer 1 (the Codegen `TurboModuleRegistry.getEnforcing<Spec>('RingtoneKit')` instance) — no business logic duplicated in JS, so native behavior is the single source of truth and JS stays a typing/ergonomics layer only.
- `CapabilityResult` and other rich unions live **only at Layer 2** — Layer 1 returns simpler tagged objects (Codegen-legal), which Layer 2 refines into the richer discriminated union, keeping Codegen happy while giving consumers good TS ergonomics.

### 4.6 Trade-offs Summary

| Decision | Benefit | Cost |
|---|---|---|
| Two-layer API (Codegen spec + wrapper) | Codegen constraints never leak to consumers; enables future native contract evolution without breaking consumers | Extra indirection layer to maintain |
| `CapabilityResult<T>` pattern | Explicit, type-safe platform-gap handling | More verbose consumer call sites |
| String literal unions over enums | Clean JSI serialization, Codegen-compatible | Slightly less "enum tooling" (e.g., no reverse mapping) — acceptable trade |

---

## 5. Android Native Architecture (Kotlin)

### 5.1 Layered Internal Structure

```
android/src/main/java/com/ringtonekit/
├── RingtoneKitModule.kt        # TurboModule entrypoint, implements generated Spec
├── RingtoneKitPackage.kt       # TurboReactPackage registration
├── catalog/
│   ├── SoundCatalogProvider.kt # RingtoneManager query abstraction
│   └── SoundMapper.kt          # Cursor/RingtoneManager row -> public Sound shape
├── playback/
│   └── PreviewPlayer.kt        # Wraps android.media.Ringtone / MediaPlayer lifecycle
├── permissions/
│   └── PermissionBridge.kt     # Runtime permission requests + Activity result plumbing
└── errors/
    └── RingtoneKitException.kt # Maps to the shared error taxonomy (Section 10)
```

### 5.2 Catalog Access Design

- Uses `RingtoneManager` with `setType(RingtoneManager.TYPE_RINGTONE | TYPE_NOTIFICATION | TYPE_ALARM)` to query the appropriate cursor per category, rather than raw `MediaStore` queries — `RingtoneManager` is the documented, stable Android API surface for this exact purpose, and using `MediaStore` directly would mean reimplementing filtering logic Android already provides, plus higher risk of OEM-specific `MediaStore` quirks.
- Each cursor row is mapped through `SoundMapper` into the public `Sound` shape (Section 4.2), keeping raw Android cursor/URI concerns fully out of the TurboModule entrypoint — `RingtoneKitModule.kt` should be a thin coordinator, not where parsing logic lives, for testability (Section 13) and readability.
- **URI stability**: Android ringtone URIs are `content://` references. These are documented as stable for the duration of app usage but not guaranteed stable across device reboots/OS updates for *all* OEMs — this nuance is surfaced in documentation (Section 15) rather than papered over, since consumers persisting a `Sound.uri` long-term need to know this.

### 5.3 System Picker Integration

- `openSystemPicker(category)` launches `RingtoneManager.ACTION_RINGTONE_PICKER` via an `Intent`, requiring the module to hook into `Activity.onActivityResult` (bridged through RN's `ActivityEventListener`).
- **New Architecture consideration**: TurboModules still use the same `ReactContext.addActivityEventListener` mechanism as before for activity-result flows — this part of the Android lifecycle integration is *not* changed by the New Architecture, only the module registration and JSI plumbing are. This is called out explicitly because it's a common point of confusion when porting mental models to TurboModules.
- The picker result (an intent extra URI) is mapped through the same `SoundMapper` used for catalog queries, so a picker-selected sound and a catalog-enumerated sound produce identically-shaped `Sound` objects — one mapping code path, not two, to avoid shape drift.

### 5.4 Threading Model

- All `RingtoneManager`/`MediaStore` access is dispatched onto a background executor (not the main/UI thread) since cursor queries are I/O and can be slow on some OEM content providers; results are marshalled back to resolve the Promise, consistent with the "all methods async" decision in Section 3.4.
- TurboModules by default can run native methods off the JS thread depending on configuration; this library explicitly runs catalog queries on a dedicated background thread pool regardless, rather than relying on default TurboModule threading behavior, because catalog queries are the single most likely operation to jank if mishandled.

### 5.5 Preview Playback

- Uses `android.media.Ringtone` (obtained via `RingtoneManager.getRingtone(context, uri)`) for previewing system sounds — this correctly respects system audio stream routing (ringtone volume vs. media volume) which a raw `MediaPlayer` would not automatically do.
- For custom/bundled provider sounds (Section 11), falls back to `MediaPlayer` since those aren't `RingtoneManager`-backed URIs.
- Only one preview can play at a time; starting a new preview stops any in-flight one — state is tracked in `PreviewPlayer` and surfaced via the event system (Section 9), not polled.

### 5.6 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| `RingtoneManager` over raw `MediaStore` | Stable, documented, handles OEM variance better | Slightly less query flexibility |
| Background executor for all catalog access | No main-thread jank risk regardless of TurboModule threading defaults | Small added complexity in thread marshalling |
| Single shared `SoundMapper` for picker + catalog results | No shape drift between selection paths | Requires picker intent extras and cursor rows to be reconciled into one mapping function |

---

## 6. iOS Native Architecture (Swift)

### 6.1 Layered Internal Structure

```
ios/
├── RingtoneKit.swift            # TurboModule implementation (Swift)
├── RingtoneKit.mm               # Objective-C++ shim satisfying Codegen's ObjC interface requirement
├── Catalog/
│   └── BundledSoundCatalog.swift # Enumerates app-registered custom sounds (Section 11)
├── Playback/
│   └── PreviewPlayer.swift       # AVAudioPlayer wrapper
└── Errors/
    └── RingtoneKitError.swift    # Maps to shared error taxonomy (Section 10)
```

### 6.2 Why No "Catalog" of System Sounds

As established in Section 1.3, iOS exposes **no public API to enumerate system ringtones/notification sounds** (Apple's system sound catalog is not accessible outside Settings/first-party apps). This is a hard platform boundary, not an oversight to work around with a private API — using private APIs would jeopardize App Store approval for every consumer of this library, which is unacceptable for a production-grade OSS dependency.

Consequence for the Swift layer: `getSounds('ringtone' | 'notification' | 'alarm')` on iOS **always resolves to `{ status: 'unsupported', ... }`** at the native layer — this isn't a partial implementation to "finish later," it's the correct, permanent, documented behavior for this platform. `getSounds('custom')` is the one path that's fully functional on iOS, backed by `BundledSoundCatalog`.

### 6.3 Custom Sound Handling Strategy

Since iOS's real capability is **app-bundled/custom sounds usable within the app's own notification context**, the Swift layer focuses on:
- Registering and enumerating sounds the *consuming app* bundles (via the extensibility provider system, Section 11) — files placed in the app bundle or app's `Library/Sounds` directory per Apple's `UNNotificationSound` conventions (custom notification sounds must be ≤30 seconds, in a supported format, and placed in the app bundle or the app's Library/Sounds folder to be usable by `UNNotificationSound(named:)`).
- Returning `Sound.uri` as a `file://` reference resolvable both for `AVAudioPlayer` preview and for constructing a `UNNotificationSound` on the consumer's own notification code — the library does not manage `UNNotificationSound` registration itself since that's an app-level notification-content concern, out of this library's scope (per Section 1.2's boundary), but it documents the integration pattern (Section 15).

### 6.4 "System Picker" on iOS

There is no iOS system sound picker equivalent to Android's `ACTION_RINGTONE_PICKER`. `openSystemPicker()` on iOS is therefore **not implemented as a native picker** — instead, the architecture recommends (and the example app demonstrates) building the picker UI in **JS/React Native**, backed by `getSounds('custom')` data from the native layer. This is documented as the correct pattern rather than the library attempting to ship a bundled native-UI picker component, which would constrain consuming apps' design systems unnecessarily — the library's job is data + preview + retrieval; picker *presentation* is left to the app, consistent with "library not framework" design philosophy. `openSystemPicker()` on iOS resolves `{ status: 'unsupported', reason: 'iOS has no system sound picker; use getSounds() with a custom UI' }`, guiding consumers to the right pattern via the type system itself.

### 6.5 Codegen / TurboModule Bridging Specifics

- iOS TurboModules require an Objective-C++ (`.mm`) shim that conforms to the Codegen-generated protocol, even when the implementation itself is Swift — this is standard New Architecture plumbing (`RCTRingtoneKitSpec` protocol conformance bridged into Swift via a bridging header), and is called out here because it's a common source of setup friction for contributors unfamiliar with Swift/TurboModule interop.
- Event emission (Section 9) on iOS TurboModules uses the generated `EventEmitter` base class methods rather than `RCTEventEmitter`'s old `sendEvent(withName:body:)` pattern — this is a New Architecture-specific change from legacy Swift-based RN modules that Swift-experienced-but-RN-new contributors often get wrong.

### 6.6 Preview Playback

- `AVAudioPlayer` for previewing bundled/custom sound files, with `AVAudioSession` category set appropriately (`.playback` with `.mixWithOthers` unset, since a ringtone preview should momentarily interrupt other audio, matching expected UX for a sound-preview feature) — this session-category decision is explicitly documented since it affects host-app audio behavior and is a common integration surprise if undocumented.
- Same one-preview-at-a-time state machine as Android (Section 5.5), implemented independently but conforming to the same shared event contract (Section 9), so JS-side consumer code doesn't need platform branching for preview state handling.

### 6.7 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| No system sound enumeration (honest `unsupported`) | No private-API risk, App Store safe, honest DX | Feature parity gap vs. Android is real and permanent, must be well-documented |
| JS-driven custom picker UI (no native iOS picker component) | Library stays unopinionated about UI/design system | Consuming apps must build their own picker UI (mitigated by example app reference implementation) |
| Swift + ObjC++ shim for Codegen | Modern, idiomatic Swift implementation | Slightly more setup complexity than pure Swift for contributors unfamiliar with the pattern |

---

## 7. Permission Handling Strategy

### 7.1 Principle: Permission-Only-When-Required

Per the stated requirement, this library must **not** request broad permissions upfront. Design accordingly:

| Operation | Android Permission Needed | iOS Permission Needed |
|---|---|---|
| Enumerate system ringtones/notification/alarm sounds via `RingtoneManager` | None (reading via `RingtoneManager` on modern Android does not require `READ_EXTERNAL_STORAGE`) | N/A (unsupported, Section 6.2) |
| Open system ringtone picker | None | N/A |
| Preview a system sound | None | N/A |
| Enumerate/preview custom bundled sounds | None (bundled in app) | None (bundled in app) |
| Access user-provided custom sound files from device storage (extensibility, Section 11) | Scoped storage access via `ACTION_OPEN_DOCUMENT` (Storage Access Framework) — no broad storage permission needed since SAF grants URI-scoped access | No permission needed if using `UIDocumentPickerViewController` (scoped, sandboxed access) |

**Key architectural decision:** by relying on `RingtoneManager` (Android) and app-bundle/document-picker access (iOS/Android custom sounds) rather than broad filesystem access, **this library requires zero dangerous runtime permissions for its core v1 feature set.** This is a significant production/App-Store-review advantage and should be treated as a design constraint to preserve, not just a nice-to-have — any future feature proposal that would require `READ_EXTERNAL_STORAGE` or similarly broad permissions should be scrutinized against this principle before being added.

### 7.2 Permission Bridge Design (for the one path that might need it)

If a future custom-provider extension needs broader storage access (e.g., scanning a whole custom directory rather than user-picked files), the `PermissionBridge` (Android) is designed as an isolated, opt-in component:
- Exposes a `checkPermission()`/`requestPermission()` pair on the TurboModule, **only invoked by the JS layer when a specific operation actually needs it** — never at module init/import time.
- Returns a `CapabilityResult`-style outcome (Section 4.3) rather than throwing, so denial is a typed, handleable state rather than an exception path consumers must remember to catch.
- iOS equivalent is largely moot for v1 given the document-picker-based approach above, but the same bridge shape is reserved in the architecture for consistency if a future iOS permission (e.g., media library access for a hypothetical future feature) becomes necessary.

### 7.3 New Architecture Considerations

- Permission request flows that require `Activity` interaction (Android runtime permission dialogs) go through the same `ActivityEventListener`/`PermissionListener` RN plumbing as pre-New-Architecture modules — TurboModules changed module registration and JSI calling convention, not the underlying Android permission-callback lifecycle, so this is standard, not novel, integration work.
- All permission check/request methods are async/Promise-based (consistent with Section 3.4), since permission dialogs are inherently asynchronous, user-mediated flows.

### 7.4 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Zero dangerous permissions for core v1 features | Better App/Play Store review posture, better install-time trust, aligns with "permission only when required" | Slightly constrains what "browse arbitrary device audio files" could mean (SAF/document-picker-scoped only, not full filesystem) |
| Typed `CapabilityResult`-style permission outcomes | Consistent, catchable-without-try/catch DX | One more variant type consumers must handle |

---

## 8. Audio Preview Playback Architecture

### 8.1 Shared Behavioral Contract (cross-platform)

Regardless of platform implementation (`Ringtone`/`MediaPlayer` on Android, `AVAudioPlayer` on iOS), the **public behavior contract** is:

- `previewSound(soundId)` starts playback of exactly one sound; if another preview is in-flight, it is stopped first (no overlapping previews — this matches user expectation for a "tap to preview" list UI and avoids a whole class of audio-focus bugs).
- `stopPreview()` is idempotent — calling it with nothing playing is a safe no-op, not an error.
- Preview state changes are pushed via events (Section 9), not required to be polled — a picker UI needs to reactively update a "now playing" indicator, and polling would be both wasteful and laggy.

### 8.2 Why Not Expose Raw Player Controls (seek, volume, etc.)

Deliberately **not** exposing scrubbing/seek/volume controls in v1. Reasoning: the purpose of "preview" in this library's scope is quick audio identification before selection, not a full audio player component — scope discipline here keeps the native surface small (fewer methods = fewer Codegen entries = smaller native maintenance surface = fewer cross-platform behavioral edge cases to keep in sync). If richer playback control becomes a real demand, it's a natural, additive (non-breaking) v2 feature — consistent with the backward-compatibility strategy (Section 12).

### 8.3 Audio Focus / Session Behavior

- **Android**: Preview playback should request appropriate audio focus (`AudioManager.requestAudioFocus`) so it correctly ducks/pauses other audio and correctly yields on interruption (e.g., incoming call) — this is standard platform-respecting behavior expected of any audio-playing library, not optional polish.
- **iOS**: `AVAudioSession` category/activation as discussed in Section 6.6, with proper deactivation on preview stop so the library doesn't hold onto exclusive audio session state longer than necessary, which would be a bad-citizen pattern for a library embedded in a larger host app.

### 8.4 New Architecture Considerations

- Preview start/stop are Promise-returning TurboModule methods; playback **progress/completion** is event-driven (Section 9) — this method/event split is intentional: "did the command succeed" (Promise) is a different concern from "what is the ongoing state" (event stream), and conflating them (e.g., a Promise that only resolves on playback completion) would block JS-side UI responsiveness unnecessarily.

### 8.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Single-preview-at-a-time model | Simple, predictable, matches picker UX | No "compare two sounds simultaneously" capability (a legitimate but out-of-scope request) |
| No seek/volume controls in v1 | Small, maintainable native surface | Consumers wanting a full player must build their own on top of `Sound.uri` |
| Proper audio focus/session handling | Good host-app citizenship, avoids audio conflicts | Slightly more native code than a naive "just play it" implementation |

---

## 9. Event-Based Architecture

### 9.1 What Warrants an Event vs. a Promise

Design rule: a capability is event-based **only if the JS layer needs to react to state changes it didn't directly initiate**, or state changes that unfold over time after a Promise already resolved. Otherwise, a Promise-returning method is preferred (simpler, more predictable, easier to test).

| Signal | Mechanism | Reasoning |
|---|---|---|
| Preview playback started/progressed/completed/errored | Event (`onPreviewStateChanged`) | Unfolds over time after `previewSound()`'s Promise already resolved (playback *started*, not *finished*) |
| System picker result | Promise (resolves with selected `Sound \| null`) | One-shot, directly caused by the calling code's own `openSystemPicker()` invocation — no ongoing state to stream |
| Catalog query result | Promise | One-shot request/response, no benefit from event modeling |
| Permission changes made outside the app (e.g., user revokes in system settings) | **Not covered in v1** — polled via `checkPermission()` on next relevant call, not proactively pushed | Avoids requiring a persistent native observer/broadcast-receiver just for a low-frequency edge case; documented as a known limitation rather than solved with disproportionate complexity |

### 9.2 Event Payload Design

```ts
export type PreviewPlaybackStatus = 'started' | 'completed' | 'stopped' | 'error';

export interface PreviewStateEvent {
  soundId: string;
  status: PreviewPlaybackStatus;
  errorMessage?: string; // present only when status === 'error'
}
```

Kept as a single event name with a discriminated `status` field rather than four separate event names (`onPreviewStarted`, `onPreviewCompleted`, etc.) — one subscription point is simpler for consumers to manage (one `addListener`/`remove` pair instead of four), and Codegen's event emitter generation is cleaner with fewer distinct emitter declarations to keep in sync across Kotlin/Swift.

### 9.3 New Architecture Event Mechanics

- TurboModule events are declared in the Codegen spec as typed emitter members, and Codegen generates the native emission scaffolding — this replaces the legacy pattern of manually implementing `RCTEventEmitter`'s `supportedEvents()` / `sendEvent(withName:body:)` (iOS) or extending `ReactContextBaseJavaModule` with a raw `RCTDeviceEventEmitter.emit(...)` call (Android). Both platforms now emit through the generated, type-checked emitter class methods, which means an event payload shape mismatch is caught by Codegen/TypeScript rather than surfacing as a runtime bridge error — a meaningful reliability improvement the New Architecture provides over the old bridge.
- The public JS API (`addPreviewStateListener`) wraps `NativeEventEmitter` subscription management and returns a `{ remove }` handle — a familiar RN convention — rather than exposing the raw emitter, so the two-layer API principle (Section 4.1) holds for events too.

### 9.4 Listener Lifecycle & Leak Prevention

- Documentation (Section 15) explicitly instructs consumers to call `.remove()` in a `useEffect` cleanup — a common RN memory-leak footgun otherwise.
- Native side: the emitter only does work (registers observers/players) while at least one JS listener is attached, using RN's `addListener`/`removeListeners` TurboModule lifecycle hooks — avoids native background work when no one's listening, which matters for battery/performance discipline (Section 18).

### 9.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Single discriminated-union event vs. multiple named events | Simpler subscription model, fewer Codegen emitter declarations | Slightly less granular native emitter typing per status |
| No proactive external-permission-change events | Avoids disproportionate native observer complexity for a rare case | Consumers relying on real-time permission revocation detection must poll |
| `addListener`/`removeListeners` lifecycle hooks | No native work when nobody's listening | Requires careful native reference counting to avoid premature teardown with multiple simultaneous listeners |

---

## 10. Error Handling & Error Code Taxonomy

### 10.1 Two Distinct Failure Modes

Following Section 4.3, this library distinguishes:
1. **Expected, modeled outcomes** (unsupported platform capability, permission not granted) — represented as **typed result values** (`CapabilityResult`), not thrown errors, because these are routine, anticipated branches of normal control flow that every consumer must handle.
2. **Genuine exceptional failures** (native crash-adjacent conditions, unexpected OS-level failures, malformed input) — represented as **thrown/rejected errors** with a stable, documented error code taxonomy, because these are truly exceptional and should interrupt normal flow (via `try/catch` or Promise `.catch`).

This split is the core design decision of this section: **don't make consumers `try/catch` routine platform differences, and don't make consumers if/else-branch genuine native failures.**

### 10.2 Error Code Taxonomy

```ts
export type RingtoneKitErrorCode =
  | 'E_INVALID_ARGUMENT'
  | 'E_SOUND_NOT_FOUND'
  | 'E_PLAYBACK_FAILED'
  | 'E_NATIVE_MODULE_UNAVAILABLE'
  | 'E_UNKNOWN';

export class RingtoneKitError extends Error {
  code: RingtoneKitErrorCode;
  nativeMessage?: string; // raw underlying platform error, for debugging/logging only
}
```

- A **small, closed set of error codes**, not a sprawling one-per-failure-mode enumeration — a large error taxonomy tends to be aspirational (most consumers only ever branch on 2–3 codes in practice) and becomes a maintenance burden to keep synchronized across two native platforms. Codes are chosen to be **actionable** (a consumer can meaningfully do something different for each), not merely descriptive.
- `nativeMessage` deliberately kept **separate from the primary `message`/`code`** — it's for logging/bug-report purposes, not for building user-facing or control-flow logic against, since its content/format isn't a stable contract across Android/iOS or even across OS versions.

### 10.3 Native-to-JS Error Mapping

- **Android**: Kotlin exceptions are caught at the `RingtoneKitModule` boundary and mapped to a `(code, message)` pair passed to the Promise's `reject`, rather than letting raw exceptions/stack traces cross the bridge — consistent, controlled error shape regardless of which internal Kotlin component threw.
- **iOS**: Same pattern via Swift's `Error` protocol conformance (`RingtoneKitError` mapped at the Swift TurboModule boundary), rejecting the Promise with the same `(code, message)` shape — **both platforms funnel into one shared JS-side error shape**, so consumer error-handling code is never platform-branched for basic error handling.

### 10.4 New Architecture Considerations

- TurboModule Promise rejection still uses the standard `RCTPromiseRejectBlock`-equivalent mechanics under the hood on both platforms — error/rejection plumbing itself isn't fundamentally changed by the New Architecture, but Codegen enforces that reject reasons conform to expected shapes more strictly than the old loosely-typed bridge did, which is a reliability improvement worth documenting for contributors used to old-architecture error handling being looser.

### 10.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Small closed error-code enum | Easy to keep in sync across platforms, easy for consumers to exhaustively handle | Less granular than a large taxonomy; some failures get lumped into `E_UNKNOWN` |
| Split "expected outcomes" (typed results) vs. "exceptions" (thrown errors) | Consumers don't `try/catch` routine platform gaps; genuine errors are truly exceptional | Requires consistent discipline across the codebase to classify every failure correctly at introduction time |
| `nativeMessage` kept out of control-flow contract | Prevents consumers from brittle-matching on unstable platform strings | Slightly less immediately actionable debugging info without opening `nativeMessage` |

---

## 11. Extensibility Architecture (Future Custom Sound Providers)

### 11.1 Motivation

The stated requirement is "future extensibility for custom sound providers" — meaning consuming apps (or even third-party companion packages) should be able to register additional sound sources (e.g., a bundled brand sound pack, a remotely-fetched sound library, a CMS-backed catalog) **without forking this library or waiting on a new release** for each new source type.

### 11.2 Provider Interface Design (JS-side)

```ts
export interface SoundProvider {
  id: string; // unique namespace, e.g. "myapp.brand-pack"
  getSounds(): Promise<Sound[]>;
  getSoundUri(soundId: string): Promise<string>; // resolvable file/content URI for playback
}

export function registerSoundProvider(provider: SoundProvider): void;
export function unregisterSoundProvider(providerId: string): void;
```

**Key architectural decision: providers are registered and resolved at the JavaScript layer, not the native layer.** Reasoning:
- A JS-side provider registry means adding a new sound source requires **zero native code changes** — a provider can fetch from a remote API, read from `react-native-fs`, or wrap another RN library entirely, all in JS, and the core native module never needs to know about it.
- The native module's job stays narrow and stable: enumerate system sounds (Android) and play/resolve arbitrary URIs handed to it — it doesn't need a "provider" concept natively at all, since `previewSound`/native playback just needs a resolvable URI, regardless of which JS-side provider produced it.
- This keeps the native Codegen surface (Section 3) **stable** even as the ecosystem of sound sources grows — a critical property for backward compatibility (Section 12), since expanding native capability is a much higher-cost, higher-risk change than expanding JS-side composition.

### 11.3 How Providers Compose With Core Categories

- `category: 'custom'` in `getSounds()` (Section 4.2) is the integration point: the core library's `getSounds('custom')` aggregates results from all registered providers (deduplicated by `provider.id` + sound id namespacing) in addition to any natively-bundled custom sounds, presenting one unified list to the picker UI.
- Provider-sourced `Sound.source` is tagged `'custom-provider'` (per the `Sound.source` field in Section 4.2), so UI code can visually distinguish (e.g., "From MyBrand Pack") if desired, without it being required.

### 11.4 Why Not a Native Plugin System (v1)

Considered and rejected for v1: a native-side plugin architecture (e.g., dynamic native module registration for third-party provider plugins) is significantly higher complexity (separate native packaging/versioning/ABI concerns per platform) for a benefit the JS-side registry already delivers for the realistic use cases (remote catalogs, bundled packs, CMS-backed sources) — nearly all of which don't need native code at all. This is documented as a deliberate **v1 scope boundary**, with the JS-side registry designed so it doesn't foreclose a native plugin system later if a genuine native-only provider need emerges (e.g., a provider needing direct low-level media store access) — that would be an additive, non-breaking v2+ capability layered on top of, not replacing, the JS registry.

### 11.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| JS-side provider registry (not native plugin system) | Zero native code needed for new sound sources; keeps native Codegen surface stable | Providers can't do anything a JS/RN environment can't already do (acceptable — covers the realistic use cases) |
| `category: 'custom'` as the single integration seam | Simple, one clear extension point instead of scattered hooks | All custom sources are lumped under one category conceptually; providers differentiate via `source`/`id` metadata instead of separate categories |

---

## 12. Backward Compatibility & API Versioning Strategy

### 12.1 Guiding Principle

The public API (Layer 2, Section 4.1) is the **compatibility contract**; the native/Codegen layer (Layer 1) can evolve more freely as long as Layer 2's shape and behavior are preserved or only additively extended. This two-layer separation (established in Section 4) is what makes disciplined backward compatibility *practically achievable* rather than just an aspiration.

### 12.2 Semantic Versioning Application

| Change type | Version bump | Example |
|---|---|---|
| New optional field on `Sound`, new `SoundProvider` capability, new non-breaking method | **Minor** | Adding `Sound.fileSizeBytes?` |
| Bug fix, internal native refactor with no public shape/behavior change | **Patch** | Fixing an Android cursor-closing leak |
| Removing/renaming a public method or type, changing a method's required parameters, changing a `CapabilityResult`/error code's meaning | **Major** | Removing a deprecated method after its deprecation window |
| New `SoundCategory` or `RingtoneKitErrorCode` union variant | **Minor, but flagged prominently in changelog** | Since exhaustive `switch` statements in consumer code will fail to compile (a "technically additive, practically breaking for exhaustiveness-checked consumers" case) — documented explicitly as a known sharp edge of union-type extension, with guidance to always include a `default`/`_exhaustiveCheck` fallback in consumer code |

### 12.3 Deprecation Workflow

1. New replacement API is introduced (minor version).
2. Old API is marked `@deprecated` in TSDoc (surfaces in consumer IDEs) and internally forwards to the new implementation — no logic duplication, so deprecated paths can't silently drift out of sync with current behavior.
3. Deprecated API is documented in `CHANGELOG.md` and the migration guide (Section 15) with a concrete migration snippet.
4. Removed only at the **next major version**, never a minor/patch — giving consumers a full major-version cycle to migrate, which is the standard OSS courtesy expectation.

### 12.4 New Architecture Considerations

- Because this library is **New Architecture only** (no legacy bridge fallback), there is no "supporting both architectures simultaneously" compatibility burden that many transitional-era RN libraries carry — this actually *simplifies* the compatibility matrix considerably (one architecture, one Codegen contract to keep stable) at the cost of excluding apps that haven't migrated to the New Architecture, which is an explicit, accepted project constraint per the original requirements.
- Codegen spec changes (Layer 1) are still constrained by SemVer discipline even though consumers don't interact with Layer 1 directly — a Layer 1 shape change that forces a Layer 2 breaking change is transitively a major-version change, so Layer 1 PRs are reviewed with this transitive impact in mind, not evaluated in isolation.

### 12.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Two-layer compatibility contract (Layer 2 stable, Layer 1 flexible) | Native implementation can evolve/be refactored without forcing consumer breakage | Requires discipline to never let Layer 1 changes leak into Layer 2 without a deliberate versioning decision |
| Deprecate-then-remove-at-major workflow | Predictable, courteous upgrade path for consumers | Slower to fully remove old code paths; some maintenance overhead carrying deprecated shims |
| New Architecture only, no dual-architecture support | Simpler compatibility matrix, less legacy-bridge maintenance | Excludes apps not yet on New Architecture — accepted given explicit project requirements |

---

## 13. Testing Strategy

### 13.1 Test Pyramid for a Native Module

A native-module library needs a different pyramid shape than a typical app: **native unit tests matter more than they would in pure-JS libraries**, because the highest-risk logic (catalog querying, URI mapping, playback state machines) lives natively, not in JS.

### 13.2 Layer-by-Layer Strategy

| Layer | Tooling | What's covered | What's explicitly NOT covered here |
|---|---|---|---|
| JS unit tests | Jest | Layer 2 wrapper logic (Section 4.1): `CapabilityResult` shaping, provider registry (Section 11) composition/dedup logic, error mapping, event listener lifecycle wrapper | Native behavior (mocked at the `NativeRingtoneKit` boundary) |
| Android native unit tests | JUnit + Robolectric/Mockito | `SoundMapper` cursor-row-to-`Sound` mapping (pure logic, highly testable in isolation), `PermissionBridge` state logic, error-code mapping | Real `RingtoneManager`/`ContentResolver` I/O (requires instrumented tests instead) |
| Android instrumented tests | Android Instrumented Test (on emulator/device) | Real `RingtoneManager` enumeration against emulator's seeded system sounds, real picker intent round-trip, real preview playback lifecycle | Full end-to-end RN JS-to-native bridge (covered by E2E layer) |
| iOS native unit tests | XCTest | `BundledSoundCatalog` enumeration logic, `PreviewPlayer` state machine, error mapping | Real `AVAudioSession`/hardware audio output behavior (manual/E2E territory) |
| Integration/E2E | Detox (RN-native, New Architecture compatible) against the `example/` app | Full JS→TurboModule→native→JS round trip: enumerate sounds, preview, verify event delivery, verify picker flow on Android | Exhaustive OEM-variance testing (impractical to automate fully; covered by a documented manual test matrix, see 13.4) |

### 13.3 Why Robolectric/Mockito for Android Unit vs. Instrumented Split

Pure-logic pieces (`SoundMapper`'s row→`Sound` transformation, error taxonomy mapping) are deliberately **decoupled from live `RingtoneManager`/`ContentResolver` objects** (Section 5.2's design already isolates this) specifically so they're testable via fast, JVM-only unit tests rather than requiring an emulator for every test run — this is a direct payoff of the layered internal architecture from Section 5.1, not an afterthought. Only genuinely OS-integration-dependent behavior (real cursor queries, real intents, real audio focus) goes into the slower instrumented-test tier.

### 13.4 Manual/Device Test Matrix (documented, not automated)

Given real OEM variance in `RingtoneManager` behavior (Section 5.2), the project maintains a **documented manual test checklist** (in `docs/testing/device-matrix.md`) covering a representative device/OS-version spread (e.g., stock Android emulator, a Samsung OneUI device, a couple of iOS versions) run before each release — explicitly acknowledged as a necessary complement to automated testing rather than pretending full OEM coverage is achievable through CI alone.

### 13.5 New Architecture Testing Considerations

- Detox and the RN testing tooling used must be confirmed New-Architecture-compatible versions — since this library has no legacy-architecture fallback, the CI test app (Section 16) always builds with New Architecture flags enabled (`newArchEnabled=true` / `RCT_NEW_ARCH_ENABLED=1`), with no dual-mode test matrix needed (a simplification versus libraries supporting both architectures).
- Codegen-generated code itself is not unit-tested directly (it's generated, not authored) — instead, tests validate that the **hand-written implementation satisfies the generated `Spec` interface** correctly (a compile-time guarantee on both Kotlin and Swift sides) plus behavioral correctness via the unit/instrumented tiers above.

### 13.6 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Split native unit (fast, JVM/XCTest-only) vs. instrumented (slow, real OS) tests | Fast feedback loop for pure logic; realistic coverage where it matters | Requires disciplined architectural separation (Section 5/6) to keep logic testable in isolation |
| Documented manual device matrix instead of claiming full automated OEM coverage | Honest about real-world Android fragmentation risk | Manual step in the release process, not fully CI-automatable |
| New Architecture-only CI test matrix | Simpler CI (one config, not two) | No safety net for accidental legacy-architecture regressions (acceptable — out of scope by design) |

---

## 14. Example Application Architecture

### 14.1 Purpose

The `example/` app serves three roles simultaneously: (1) a manual/E2E testbed (Section 13), (2) the primary "living documentation" for integration patterns (especially the iOS custom-picker-UI pattern from Section 6.4, since that's not obvious from types alone), and (3) a contributor sanity-check environment for verifying native changes before release.

### 14.2 Structure

```
example/
├── src/
│   ├── screens/
│   │   ├── CatalogScreen.tsx       # Demonstrates getSounds() + CapabilityResult handling
│   │   ├── PreviewScreen.tsx       # Demonstrates preview + event subscription lifecycle
│   │   ├── SystemPickerScreen.tsx  # Android native picker demo; iOS shows the "unsupported" branch UI
│   │   ├── CustomPickerScreen.tsx  # Reference implementation of a JS-driven picker (the recommended iOS pattern, Section 6.4)
│   │   └── ProviderDemoScreen.tsx  # Demonstrates registerSoundProvider() (Section 11) with a mock remote provider
│   └── App.tsx
├── android/                        # Standard RN CLI Android project, New Architecture enabled
├── ios/                            # Standard RN CLI iOS project, New Architecture enabled
├── package.json                    # Depends on the library via a local file/workspace reference
└── metro.config.js                 # Configured to resolve the library from ../ correctly (watchFolders/symlink handling)
```

### 14.3 Why a Full RN CLI App, Not a Minimal Harness

A minimal "just call the API" harness would fail to exercise real integration friction points: autolinking correctness, Codegen build-step correctness, Metro's handling of a locally-linked (non-npm-installed) native module, and realistic UI patterns like the picker screens above. A full app is the only way to genuinely validate "does this work the way a real consumer will experience it," which is the actual point of an example app for a native library, not just an API usage snippet.

### 14.4 Metro/Local-Linking Considerations (New Architecture specific)

- The example app's `metro.config.js` must correctly configure `watchFolders`/`nodeModulesPaths` (or use `npm`/`yarn` workspace linking) so Metro picks up live library changes during development, and both platforms' native build tooling (Gradle/CocoaPods) must correctly resolve the local library including running its Codegen step — this is a common pain point specifically because New Architecture's Codegen must run for the example app's own build, not just the library's, so contributors need clear setup docs (Section 15) covering this exact flow (`pod install` triggering Codegen codegen artifacts, `bundle exec pod install` if using CocoaPods' Ruby-gem-managed workflow, etc.).

### 14.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Full RN CLI app vs. minimal harness | Realistic validation of autolinking/Codegen/Metro integration | More setup/maintenance surface than a bare API-usage script |
| Screens organized 1:1 with architectural concepts (catalog, preview, picker, provider) | Doubles as living documentation mapped directly to this spec's sections | Must be kept in sync with the public API as it evolves (enforced via CI, Section 16) |

---

## 15. Documentation Strategy

### 15.1 Documentation Layers

| Layer | Location | Audience | Content |
|---|---|---|---|
| API Reference | `docs/api/` (generated from TSDoc via TypeDoc) | Consumers integrating the library | Every public type/method, including `CapabilityResult` variants and when each occurs |
| Guides | `docs/guides/` | Consumers | "Building a custom iOS picker," "Registering a custom sound provider," "Handling platform capability differences," "Migrating major versions" |
| Architecture docs | `docs/architecture/` | Contributors | This document (or a maintained derivative of it) — kept as a living reference, updated alongside major design decisions, not just written once and abandoned |
| Platform notes | `docs/platform-notes/android.md`, `docs/platform-notes/ios.md` | Consumers + contributors | The capability matrix (Section 1.3), URI stability caveats (Section 5.2), audio session behavior (Section 6.6/8.3) — the "gotchas" that don't fit cleanly into API reference format |
| Contributing guide | `CONTRIBUTING.md` | Contributors | Local dev setup (including the Metro/Codegen linking flow from Section 14.4), test-running instructions per Section 13, PR/versioning conventions per Section 12 |
| Changelog | `CHANGELOG.md` | Everyone | SemVer-disciplined, auto-generated where possible (Section 17) but human-reviewed for the "flagged prominently" cases noted in Section 12.2 |

### 15.2 Why TSDoc-Generated API Reference, Not Hand-Maintained

Hand-maintained API docs drift from the actual type signatures almost immediately in any actively-developed library. Generating the reference from TSDoc comments directly on the Layer 2 public API (Section 4) guarantees the reference **cannot** silently diverge from the real type signatures — CI (Section 16) can even fail the build if TSDoc coverage drops below a threshold on public exports, enforcing documentation discipline structurally rather than by convention alone.

### 15.3 The Platform Capability Matrix as a First-Class Doc, Not a Footnote

Given how central the Android/iOS capability asymmetry is to this library's honest design (Section 1.3), it is **not** buried in prose — it's a maintained, prominent table at the top of the main README, cross-linked from every relevant guide, so a developer evaluating whether this library fits their needs sees the real capability boundaries in the first 30 seconds of reading, not after installing and hitting `unsupported` results in production.

### 15.4 New Architecture Considerations for Docs

- Setup documentation explicitly states New Architecture and Codegen prerequisites up front (minimum RN version, `newArchEnabled` requirement, no legacy bridge support) — since this is a hard requirement (not a "recommended" setting), burying it would cause avoidable installation-failure issues for consumers on older RN/bridge setups, so it's stated as a clearly flagged prerequisite in the README's first section, not deep in a troubleshooting page.

### 15.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Generated API reference from TSDoc | Cannot drift from real signatures; enforceable via CI | Requires disciplined TSDoc comments on every public export as a PR-merge gate |
| Architecture doc maintained as living reference | Contributors get accurate design rationale, not just "what," but "why" | Must be actively updated alongside significant design changes, or it becomes misleading rather than merely stale |

---

## 16. CI/CD Pipeline Design

### 16.1 Pipeline Stages (GitHub Actions, given `.github/workflows/` in the repo layout)

| Stage | Trigger | What runs |
|---|---|---|
| Lint & Typecheck | Every PR | ESLint, TypeScript `tsc --noEmit` across `src/` and `example/src/` |
| JS Unit Tests | Every PR | Jest suite (Section 13.2) with coverage threshold enforcement |
| Android Native Build + Unit Tests | Every PR | Gradle build of `android/` in isolation + against `example/android`, with New Architecture flags enabled; JUnit/Robolectric suite |
| iOS Native Build + Unit Tests | Every PR | `pod install` (triggering Codegen) + Xcode build of `example/ios`, with New Architecture enabled; XCTest suite |
| Codegen Verification | Every PR | Explicit step confirming Codegen output is generated cleanly with no type errors on both platforms — a dedicated stage rather than folding it silently into the native build steps, since Codegen failures need to be immediately obvious and distinguishable from "normal" native build failures for fast contributor debugging |
| E2E (Detox) | Every PR (or nightly, if runtime is heavy — see 16.3) | Full example-app flows against Android emulator + iOS simulator |
| TSDoc Coverage Check | Every PR | Fails if public API TSDoc coverage regresses (Section 15.2) |
| Release (npm publish + GitHub Release) | On merge to `main` with a version bump / on tag push | Build, pack, publish to npm, generate changelog entry, create GitHub Release (Section 17) |

### 16.2 Why Separate Android/iOS Build Stages From Their Test Stages Conceptually (Even if Run in the Same Job)

Native build failures and native test failures are different failure classes with different debugging paths — a build failure usually means a Codegen/toolchain/dependency problem, while a test failure means a logic regression. Keeping these clearly delineated in CI output (even if technically sequential steps within one job for efficiency) means contributors can immediately tell which category their PR broke, reducing debugging time — a small pipeline-design choice with outsized DX payoff for a native library where build failures are common and often environment-related.

### 16.3 Runtime/Cost Considerations

- Full Detox E2E runs (real emulator/simulator boot) are the most expensive CI stage by far. Recommendation: run the full Android+iOS E2E matrix on PRs targeting `main` and on release tags, but consider a lighter/skipped E2E path for draft PRs or a documented "run E2E" label-gated trigger, to avoid burning CI minutes on early-stage/WIP PRs — a pragmatic cost/thoroughness trade-off appropriate for an OSS project without unlimited CI budget.
- Native build stages are cached aggressively (Gradle cache, CocoaPods cache, derived data) since native build times are the single biggest CI latency contributor for RN native-module repos.

### 16.4 New Architecture-Specific CI Considerations

- Every native build stage explicitly sets New Architecture environment flags (`ORG_GRADLE_PROJECT_newArchEnabled=true` for Android; `RCT_NEW_ARCH_ENABLED=1` for iOS CocoaPods install) since this library has no legacy-architecture code path to fall back to if misconfigured — a misconfigured CI job here wouldn't just under-test, it would build an entirely wrong (non-functional) artifact, so this flag-setting is treated as a load-bearing, prominently-commented part of the workflow YAML rather than an easily-overlooked env var.
- Codegen artifacts are **not** committed to the repo (generated fresh in CI and in consumer builds) — deliberately, since committing generated code risks drift between the spec and the checked-in generated output, which Codegen's own generate-on-build model is specifically designed to avoid.

### 16.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Dedicated Codegen verification stage | Fast, unambiguous diagnosis of spec-related failures | One more CI stage to maintain |
| Full E2E gated to `main`-targeting PRs / releases (not every WIP push) | Manages CI cost/time realistically | Slightly later feedback loop for E2E-breaking changes on draft work |
| No committed Codegen output | No spec/generated-code drift risk | Every consumer/CI build pays the Codegen generation cost (acceptable — it's fast and this is the standard, correct New Architecture pattern) |

---

## 17. Release & Publishing Strategy

### 17.1 SemVer in Practice

Building directly on Section 12's versioning rules, releases follow **Conventional Commits** (`feat:`, `fix:`, `feat!:`/`BREAKING CHANGE:`) to drive automated version bump determination and changelog generation (e.g., via `semantic-release` or an equivalent conventional-commits-aware release tool), reducing human error in version-bump judgment calls for routine changes, while **major version bumps and their migration notes are always human-authored/reviewed** before publish, never fully automated — the mechanical bump-detection is automatable; the judgment about migration-path clarity is not.

### 17.2 Pre-release Channels

- `next` npm dist-tag for pre-release/RC builds of upcoming major versions, allowing early adopters to test breaking changes against real apps before general availability — important for a native module specifically because native-code breakage is often only discoverable through real device/build testing, not just type-checking, so a soak period on the `next` tag before promoting to `latest` is a meaningful risk-reduction step, not just process ceremony.
- `canary`/commit-hash-tagged builds are considered out of scope for v1 process (adds tooling overhead disproportionate to an early-stage OSS library's likely contributor volume) but noted as a natural future addition if the contributor/consumer base grows.

### 17.3 What Gets Published to npm

- `src/` compiled output (`lib/` — CJS + ESM + type declarations, per standard RN library dual-format expectations), `android/`, `ios/`, `RingtoneKit.podspec`, `react-native.config.js`, `package.json`, `README.md`, `LICENSE`.
- **Not published**: `example/`, `docs/`, test files, CI config — kept out of the npm tarball via `.npmignore`/`files` field in `package.json`, both to keep install size reasonable and because these directories serve contributors, not consumers.

### 17.4 New Architecture Considerations for Publishing

- `package.json`'s `codegenConfig` field must be correctly present in the **published** package (not just the dev repo), since consumer app builds run Codegen against the installed package's spec files — an easy-to-miss publishing bug if `files`/`.npmignore` config accidentally excludes `src/NativeRingtoneKit.ts` or the compiled type declarations it depends on, so this is explicitly called out as a release-checklist verification item.
- Minimum supported React Native version (the first version with stable TurboModule/Codegen support the library targets) is pinned via `peerDependencies` with an explicit version range, and this range itself follows the library's own SemVer discipline — raising the minimum supported RN version is treated as a **major** version bump for this library, since it can break consumers on older RN versions, even though no library code changed.

### 17.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Conventional Commits + automated bump detection | Reduces human error on routine version decisions | Requires contributor discipline on commit message format (enforced via commit-lint in CI) |
| Human-reviewed major version releases | Migration guidance quality stays high | Slower release cadence for breaking changes (acceptable — breaking changes should be deliberate, not fast) |
| `next` pre-release tag for RCs | Real-world soak testing before GA, critical for native code | Adds a release-process step; requires early-adopter goodwill to be effective |

---

## 18. Performance Considerations

### 18.1 Where Performance Actually Matters in This Library

Given the domain, the two genuine performance-sensitive paths are: (1) catalog enumeration (potentially many system sounds, cursor iteration cost) and (2) preview playback responsiveness (perceived latency between tap and sound start). Everything else (permission checks, single-sound lookups) is low-frequency enough that micro-optimizing it would be disproportionate effort.

### 18.2 Catalog Enumeration Performance

- Android cursor iteration for `RingtoneManager` results is done off the JS/UI thread (Section 5.4) — this is a correctness requirement more than a raw-speed optimization, since the actual query is typically fast, but blocking the JS thread even briefly on any I/O is an anti-pattern for a "high performance" requirement.
- **No built-in caching layer within the native module for v1** — deliberately. Catalog contents rarely change within a single app session, so caching is better handled at the JS/consumer layer (e.g., a consumer calling `getSounds()` once and storing the result in their own state/React Query cache) than baked into the native module, which would add cache-invalidation complexity (when does a native-side cache go stale? On what signal?) for a problem the consuming app is better positioned to solve simply. This is documented explicitly in the guides (Section 15) as the recommended consumer-side pattern, rather than left as an unstated assumption.

### 18.3 Preview Playback Latency

- Section 5.5/6.6's choice of `Ringtone`/`AVAudioPlayer` (over building a custom playback engine) is itself a performance decision — these are the OS's own optimized, hardware-integrated audio paths; reimplementing playback would be strictly worse for both latency and battery.
- Preview player instances are **not** torn down and recreated between consecutive previews unnecessarily — the `PreviewPlayer`/native player wrapper is designed to reuse its underlying resources where the platform API allows, minimizing tap-to-sound latency for rapid sequential browsing (a realistic usage pattern: user tapping through a list previewing several sounds quickly).

### 18.4 JSI/TurboModule Performance Characteristics (New Architecture-specific)

- TurboModules' JSI-based invocation (vs. the old bridge's async JSON serialization) is itself a meaningful performance win for this library "for free," since even the batch of `Sound` objects returned from `getSounds()` avoids the old bridge's JSON serialize/deserialize round trip — this requirement (New Architecture only) is not purely an architectural-purity choice but has genuine performance grounding worth stating explicitly, since it substantiates the "high performance" requirement rather than treating New Architecture adoption as an assumed given.
- Large payload consideration: if a device has an unusually large system sound catalog, returning the full `Sound[]` array in one Promise resolution is still bounded and reasonable (typical system catalogs are dozens, not thousands, of entries) — pagination is explicitly **not** designed for v1 given realistic data volumes, but this assumption is documented so it can be revisited if real-world usage ever surfaces a pathological case (e.g., a provider, Section 11, backing a very large remote catalog — which is a JS-side provider concern to paginate internally if needed, not a core native catalog concern).

### 18.5 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| No native-side catalog caching | Simpler native module, no stale-cache bugs, leverages consumer's own state management | Consumers must be informed/documented to cache appropriately themselves for repeated-access performance |
| Reused player resources across sequential previews | Lower tap-to-sound latency for realistic browsing patterns | Slightly more complex player lifecycle management than naive create/destroy-per-preview |
| No built-in pagination for `getSounds()` | Simpler API, matches realistic data volumes | Not designed for pathologically large catalogs (explicitly documented assumption, revisitable) |

---

## 19. Security & Privacy Considerations

### 19.1 Attack/Risk Surface Assessment

This library's risk surface is comparatively low relative to many native modules, because (per Section 7) it deliberately avoids broad filesystem/storage permissions and doesn't transmit data off-device on its own. The main considerations are about **scope discipline and data handling correctness**, not classic security vulnerabilities like injection or auth bypass.

### 19.2 Specific Considerations

- **No network activity in the core library.** The core module never makes network requests — any remote-sourced custom sound provider (Section 11) is entirely the consuming app's own JS-side responsibility and code, keeping the native module's trust boundary small and auditable. This is stated explicitly in documentation (Section 15) as a security property worth highlighting for security-conscious consumers/auditors evaluating the dependency.
- **URI handling and path traversal considerations**: when resolving user/provider-supplied file paths into `file://` URIs (iOS custom sounds, Section 6.3) or when accepting SAF/document-picker URIs (Android, Section 7.1), the native layer validates that resolved URIs stay within expected scopes (app bundle, app sandbox, or the specific SAF-granted URI) rather than naively trusting/concatenating consumer-supplied path strings — even though the primary "attacker" model here is a misbehaving/buggy consuming app rather than a malicious external actor, defensive validation is retained as standard defensive-programming practice for any native code handling file paths.
- **Permission minimalism as a privacy property, not just a UX one** (Section 7.1's zero-dangerous-permissions design) — fewer permissions requested means less user-facing privacy surface for every app that depends on this library, which is a meaningful aggregate privacy benefit across the library's entire consumer base, worth stating as a deliberate design value, not just an incidental Play-Store-review convenience.
- **No PII or usage analytics collected by the library itself.** The library does not phone home, collect telemetry, or log usage data — any analytics are entirely a consuming-app-level concern outside this library's responsibility, and this is stated explicitly as a trust commitment in the README, consistent with open-source quality/trust expectations for a widely-depended-upon native module.

### 19.3 New Architecture Considerations

- JSI's more direct native-JS binding (vs. the old bridge's serialized message-passing) means native code has a somewhat more direct execution relationship with JS than before — this doesn't introduce new *library-specific* risk given this module's narrow scope (no `eval`-like dynamic code execution, no dynamic native method dispatch based on untrusted JS-supplied strings), but is worth noting for security-reviewing contributors unfamiliar with JSI's trust model relative to the old bridge, so it's called out in `CONTRIBUTING.md`'s security-review guidance rather than assumed as common knowledge.

### 19.4 Trade-offs

| Decision | Benefit | Cost |
|---|---|---|
| Zero network activity in core library | Small, auditable trust boundary; strong privacy story | Any "smart"/remote features are pushed entirely to consumer-authored providers (acceptable, consistent with Section 11's scope boundary) |
| Defensive URI/path validation despite low external-attacker likelihood | Standard-of-care defensive programming; protects against buggy consumer input too | Marginal added native code complexity |
| No telemetry/analytics collection | Strong trust/privacy posture for an OSS dependency | No usage-data-driven insight into real-world feature adoption for maintainers (acceptable trade for an OSS library's trust model) |

---

## Closing Summary

The architecture rests on a small number of load-bearing decisions that recur across nearly every section:

1. **Honesty about platform asymmetry** (Section 1.3) — modeled in the type system (`CapabilityResult`), not hidden behind empty arrays or silent no-ops.
2. **Two-layer API** (Codegen-constrained native contract vs. ergonomic public TypeScript surface) — the single biggest enabler of backward compatibility, testability, and Codegen compliance simultaneously.
3. **Permission and scope minimalism** — zero dangerous permissions, no system-wide mutation, no network activity — a deliberate, narrow trust boundary rather than a maximal feature set.
4. **JS-side extensibility over native plugin architecture** — keeps the native/Codegen surface stable while still delivering genuine future extensibility for custom sound providers.
5. **New Architecture-only, no legacy fallback** — simplifies the entire project (CI, compatibility matrix, module registration) in exchange for excluding pre-New-Architecture consumers, an explicit and accepted project constraint.

This document is intended to function as `docs/architecture/` itself (Section 15.1) — a living reference kept in sync with real implementation decisions as the library is built.
