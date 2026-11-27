// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// three's CommonJS entry (build/three.cjs) calls Node's process.emitWarning, which does not
// exist in React Native and crashes the app on launch. @react-three/fiber/native requires it
// with require('three'), so send every import of 'three' to the ES module build instead.
const threeModule = path.resolve(__dirname, 'node_modules/three/build/three.module.js');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: threeModule };
  }
  return (defaultResolve ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
