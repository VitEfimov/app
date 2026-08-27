const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const automotiveAppDescXml = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="template"/>
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

      const mainActivity = application.activity?.find(
        (act) => act.$?.['android:name'] === '.MainActivity'
      );

      if (mainActivity) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }

        // Add Android Auto Category PROJECTION_DEF to LAUNCHER intent-filter
        const mainFilter = mainActivity['intent-filter'].find((filter) =>
          filter.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.MAIN')
        );

        if (mainFilter) {
          if (!mainFilter.category) mainFilter.category = [];
          const hasProjectionCategory = mainFilter.category.some(
            (c) => c.$?.['android:name'] === 'com.google.android.gms.car.category.CATEGORY_PROJECTION_DEF'
          );
          if (!hasProjectionCategory) {
            mainFilter.category.push({
              $: { 'android:name': 'com.google.android.gms.car.category.CATEGORY_PROJECTION_DEF' },
            });
          }
        }

        // Add image/media SEND intent-filter if missing
        const hasImageSendFilter = mainActivity['intent-filter'].some(
          (filter) =>
            filter.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SEND') &&
            filter.data?.some((d) => d.$?.['android:mimeType']?.startsWith('image/'))
        );

        if (!hasImageSendFilter) {
          mainActivity['intent-filter'].push({
            action: [{ $: { 'android:name': 'android.intent.action.SEND' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [
              { $: { 'android:mimeType': 'text/*' } },
              { $: { 'android:mimeType': 'image/*' } },
              { $: { 'android:mimeType': '*/*' } },
            ],
          });
        }

        // Add image/media SEND_MULTIPLE intent-filter if missing
        const hasSendMultipleFilter = mainActivity['intent-filter'].some((filter) =>
          filter.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.SEND_MULTIPLE')
        );

        if (!hasSendMultipleFilter) {
          mainActivity['intent-filter'].push({
            action: [{ $: { 'android:name': 'android.intent.action.SEND_MULTIPLE' } }],
            category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
            data: [
              { $: { 'android:mimeType': 'image/*' } },
              { $: { 'android:mimeType': '*/*' } },
            ],
          });
        }
      }
    }

    return config;
  });
};
