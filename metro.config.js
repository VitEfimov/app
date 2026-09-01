const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('ogg', 'wav');

// Exclude Android build directories to prevent Out Of Memory (OOM) errors in Metro
config.resolver.blockList = exclusionList([
  /.*\/android\/build\/.*/,
  /.*\/android\/\.gradle\/.*/,
  /.*\/ios\/build\/.*/,
  /.*\/modules\/expo-task-alarm\/package\/.*/
]);

config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = config;
