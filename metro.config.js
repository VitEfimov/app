const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const exclusionList = require('metro-config/src/defaults/exclusionList');

const config = getDefaultConfig(__dirname);

config.maxWorkers = 1;

config.resolver.assetExts.push('ogg', 'wav');

const appModalPath = path.resolve(__dirname, 'src/components/AppModal.js');
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-modal') {
    return {
      filePath: appModalPath,
      type: 'sourceFile',
    };
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// Exclude Android build directories and Playwright test artifacts to prevent Metro file watcher errors
config.resolver.blockList = exclusionList([
  /.*[/\\]android[/\\]build[/\\]?.*/,
  /.*[/\\]android[/\\]\.gradle[/\\]?.*/,
  /.*[/\\]ios[/\\]build[/\\]?.*/,
  /.*[/\\]modules[/\\]expo-task-alarm[/\\]package[/\\]?.*/,
  /.*[/\\]test-results[/\\]?.*/,
  /.*[/\\]playwright-report[/\\]?.*/,
  /.*[/\\]e2e[/\\]?.*/
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
