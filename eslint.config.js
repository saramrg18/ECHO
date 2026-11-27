// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // three.js JSX props (geometry, args, attach...) are not DOM props.
    files: ['src/hexfort/three/**'],
    rules: { 'react/no-unknown-property': 'off' },
  },
]);
