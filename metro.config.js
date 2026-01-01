const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
const cssInteropCache = path.resolve(
  __dirname,
  "node_modules/react-native-css-interop/.cache",
);

config.watchFolders = [...(config.watchFolders ?? []), cssInteropCache];

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
