module.exports = {
  root: true,
  extends: '@react-native',
  parserOptions: {
    requireConfigFile: false,
  },
  ignorePatterns: ['lib/', 'example/android/', 'example/ios/'],
  rules: {
    'tsdoc/syntax': 'warn',
  },
  plugins: ['tsdoc'],
};
