const { withAndroidManifest, withAppBuildGradle, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const automotiveAppDescXml = `<?xml version="1.0" encoding="utf-8"?>
<automotiveApp>
    <uses name="template"/>
    <uses name="notification"/>
</automotiveApp>
`;

function createCarServiceKotlin(packageName) {
  return `package ${packageName}

import android.content.Intent
import androidx.car.app.CarAppService
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.car.app.validation.HostValidator

class TaskFlowCarService : CarAppService() {
    companion object {
        @Volatile
        @JvmField
        var isCarConnected: Boolean = false
    }

    override fun createHostValidator(): HostValidator {
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
    }

    override fun onCreateSession(): Session {
        isCarConnected = true
        return object : Session() {
            override fun onCreateScreen(intent: Intent): Screen {
                return TaskFlowCarScreen(carContext)
            }
        }
    }

    override fun onDestroy() {
        isCarConnected = false
        super.onDestroy()
    }
}

class TaskFlowCarScreen(carContext: CarContext) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val listBuilder = ItemList.Builder()
        listBuilder.addItem(
            Row.Builder()
                .setTitle("TaskCalendar Connected")
                .addText("Open TaskCalendar on your phone for full task management features.")
                .build()
        )

        return ListTemplate.Builder()
            .setSingleList(listBuilder.build())
            .setTitle("TaskCalendar")
            .setHeaderAction(Action.APP_ICON)
            .build()
    }
}
`;
}

module.exports = function withAndroidAuto(config) {
  config = withAppBuildGradle(config, (config) => {
    const contents = config.modResults.contents;
    if (!contents.includes('androidx.car.app:app:')) {
      config.modResults.contents = contents.replace(
        /implementation\(["']com\.facebook\.react:react-android["']\)/,
        `implementation("com.facebook.react:react-android")\n\n    // Android Auto Car App Library\n    implementation("androidx.car.app:app:1.4.0")\n    implementation("androidx.car.app:app-projected:1.4.0")`
      );
    }
    return config;
  });

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

      const pkgName = config.android?.package || 'com.vitvalef.taskcalendar';
      const javaMainDir = path.join(
        config.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java'
      );

      // Detect actual namespace directory if MainActivity.kt already exists, otherwise use config.android.package
      let targetPkg = pkgName;
      let targetPkgDir = path.join(javaMainDir, ...pkgName.split('.'));
      if (fs.existsSync(javaMainDir)) {
        const legacyDir = path.join(javaMainDir, 'com', 'vitvalef', 'app');
        if (
          !fs.existsSync(path.join(targetPkgDir, 'MainActivity.kt')) &&
          fs.existsSync(path.join(legacyDir, 'MainActivity.kt'))
        ) {
          targetPkg = 'com.vitvalef.app';
          targetPkgDir = legacyDir;
        }
      }
      if (!fs.existsSync(targetPkgDir)) {
        fs.mkdirSync(targetPkgDir, { recursive: true });
      }
      const carServicePath = path.join(targetPkgDir, 'TaskFlowCarService.kt');
      fs.writeFileSync(carServicePath, createCarServiceKotlin(targetPkg), 'utf8');

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

      if (!application.service) {
        application.service = [];
      }

      const hasCarService = application.service.some(
        (s) => s.$?.['android:name'] === '.TaskFlowCarService' || s.$?.['android:name'] === 'com.vitvalef.app.TaskFlowCarService'
      );

      if (!hasCarService) {
        application.service.push({
          $: {
            'android:name': '.TaskFlowCarService',
            'android:exported': 'true',
          },
          'intent-filter': [
            {
              action: [{ $: { 'android:name': 'androidx.car.app.CarAppService' } }],
              category: [{ $: { 'android:name': 'androidx.car.app.category.POI' } }],
            },
          ],
        });
      }

      const mainActivity = application.activity?.find(
        (act) => act.$?.['android:name'] === '.MainActivity'
      );

      if (mainActivity) {
        if (!mainActivity['intent-filter']) {
          mainActivity['intent-filter'] = [];
        }

        // Ensure Android Auto Category PROJECTION_DEF is not on MainActivity (which causes keyboard driving lockout)
        const mainFilter = mainActivity['intent-filter'].find((filter) =>
          filter.action?.some((a) => a.$?.['android:name'] === 'android.intent.action.MAIN')
        );

        if (mainFilter && mainFilter.category) {
          mainFilter.category = mainFilter.category.filter(
            (c) => c.$?.['android:name'] !== 'com.google.android.gms.car.category.CATEGORY_PROJECTION_DEF'
          );
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
