# Deployment, Build & Performance Optimization Guide

## 1. Web Deployment & Production Build

TaskFlow Redux supports static web exports and live hosting on Vercel or Netlify.

### Building Web Production Assets
To create an optimized production web build:
```bash
# Generate static web distribution in /dist
npx expo export --platform web
```

### Vercel Deployment Settings
- **Framework Preset**: Expo / Create React App / Other
- **Build Command**: `npx expo export --platform web`
- **Output Directory**: `dist`
- **Node.js Version**: `18.x` or `20.x`

---

## 2. Android Native Build & Release Guide

### Prerequisites
- Android Studio Jellyfish / Ladybug with Android SDK (`API 34`)
- Java Development Kit (JDK) 17
- Expo Application Services CLI (`eas-cli`) installed globally:
  ```bash
  npm install -g eas-cli
  ```

### Local APK Build Command
To compile a standalone Android Debug or Release APK locally:
```bash
# Navigate to android directory
cd android

# Clean previous build artifacts
./gradlew clean

# Build Debug APK
./gradlew assembleDebug

# Build Release APK
./gradlew assembleRelease
```
Output APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### EAS Cloud Build Configuration (`eas.json`)
```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

To trigger an EAS cloud preview APK build:
```bash
eas build -p android --profile preview
```

---

## 3. Native Compatibility & Android 16KB Page Size Alignment

Modern Android versions (Android 15 / API 35+) require native `.so` dynamic libraries to be aligned to $16\text{ KB}$ memory page boundaries.

### Pre-requisites & Fix Applied (`withAndroidImageCropperFix.js`)
TaskFlow Redux enforces 16KB page alignment in `android/app/build.gradle`:
```groovy
android {
    defaultConfig {
        ndk {
            abiFilters "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }
}
```

---

## 4. Performance Tuning & Optimization Matrix

| Component / Layer | Optimization Technique Applied | Technical Benefit |
| :--- | :--- | :--- |
| `BoardScreen.js` | Redux Primitive Selectors | Re-renders only when target primitives change (e.g. `sourceColor`, `themeMode`) |
| `BoardScreen.js` | Memoized Set Selection (`selectedTaskIdsSet`) | Reduces selection state checks from $O(N)$ to $O(1)$ constant time |
| `BoardScreen.js` | FlashList Cell Type Recycling (`getItemType`) | Recycles DOM nodes efficiently between headers, task rows, and footers |
| `BoardScreen.js` | Estimated Item Height (`estimatedItemSize={85}`) | Eliminates list layout jitter and layout calculation passes |
| `TaskRow.js` | Line Height Capping (`numberOfLines={2}`) | Caps title height variance for predictable FlashList cell measurement |
| `TaskRow.js` | Memoized Action Callbacks (`useCallback`) | Prevents unnecessary re-renders of gesture handler action elements |
| `filters.js` | Single-Pass Date Bucket Categorization | Reduces categorization pass time from $O(5N)$ to $O(N)$ single iteration |
| `TaskDetailsModal.js` | `getValidDateString` & `XDate.toDate()` | Prevents invalid date parsing and ensures smooth calendar navigation |
