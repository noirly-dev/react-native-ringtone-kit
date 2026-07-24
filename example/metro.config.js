const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const root = path.resolve(__dirname, '..');

/**
 * Resolve the library from source during development.
 */
const config = {
  watchFolders: [root],
  resolver: {
    extraNodeModules: {
      '@noirly-dev/react-native-ringtone-kit': path.join(root, 'src'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
