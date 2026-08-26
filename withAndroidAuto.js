const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const automotiveAppDescXml = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="notification"/>
</automotiveApp>
`;

module.exports = function withAndroidAuto(config) {
  config = withDangerousMod(config, [
    'android',
    async (config) => {
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml'
      );
      if (!fs.existsSync(xmlDir)) {
        fs.mkdirSync(xmlDir, { recursive: true });
      }
      const xmlPath = path.join(xmlDir, 'automotive_app_desc.xml');
      fs.writeFileSync(xmlPath, automotiveAppDescXml, 'utf8');
      return config;
    },
  ]);

  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application?.[0];

    if (application) {
      if (!application['meta-data']) {
        application['meta-data'] = [];
      }

      const hasAutoMetaData = application['meta-data'].some(
        (item) => item.$?.['android:name'] === 'com.google.android.gms.car.application'
      );

      if (!hasAutoMetaData) {
        application['meta-data'].push({
          $: {
            'android:name': 'com.google.android.gms.car.application',
            'android:resource': '@xml/automotive_app_desc',
          },
        });
      }
    }

    return config;
  });
};
