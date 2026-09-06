const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('ogg', 'wav');

// Exclude Android build directories and Playwright test artifacts to prevent Metro file watcher errors
config.resolver.blockList = exclusionList([
  /.*\/android\/build\/.*/,
  /.*\/android\/\.gradle\/.*/,
  /.*\/ios\/build\/.*/,
  /.*\/modules\/expo-task-alarm\/package\/.*/,
  /.*\/test-results\/.*/,
  /.*\/playwright-report\/.*/,
  /.*\/e2e\/.*/
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
