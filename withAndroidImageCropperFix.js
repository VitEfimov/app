const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withAndroidImageCropperFix(config) {
  return withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    
    // Add resolution strategy to force Android-Image-Cropper 4.5.0
    // which is hosted on Maven Central instead of the dead Sonatype snapshot repo
    const resolutionStrategy = `
allprojects {
    configurations.all {
        resolutionStrategy {
            force 'com.github.CanHub:Android-Image-Cropper:4.5.0'
        }
    }
}
`;
    if (!buildGradle.includes('com.github.CanHub:Android-Image-Cropper:4.5.0')) {
      config.modResults.contents = buildGradle + resolutionStrategy;
    }
    return config;
  });
};
