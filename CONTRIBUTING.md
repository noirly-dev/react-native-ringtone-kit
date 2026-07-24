# Contributing

## Prerequisites

- Node 22+
- React Native 0.76+ with New Architecture enabled
- Android SDK / Xcode for native builds

## Local setup

```bash
yarn install
yarn typescript
yarn test
```

The example app (when bootstrapped) depends on this package via a local path. Metro must resolve `../src` and native Codegen must run during the example app build.

## Architecture

See `react-native-ringtone-kit-ARCHITECTURE.md` for design decisions. Prefer matching `@noirly-dev/react-native-alarm-kit` patterns for package layout, Codegen naming, and error taxonomy.

## Pull requests

- Keep public API changes additive when possible (SemVer)
- Include TSDoc on new public exports
- Add Jest coverage for Layer 2 wrapper changes
