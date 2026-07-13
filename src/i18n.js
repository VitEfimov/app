import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import 'dayjs/locale/es';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/ja';
import 'dayjs/locale/hi';
import 'dayjs/locale/fr';
import 'dayjs/locale/de';
import 'dayjs/locale/it';

import en from './locales/en.json';
import ru from './locales/ru.json';
import es from './locales/es.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';
import hi from './locales/hi.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import it from './locales/it.json';

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  es: { translation: es },
  zh: { translation: zh },
  ja: { translation: ja },
  hi: { translation: hi },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it }
};

export const getDeviceLanguage = () => {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    // Return the language code (e.g., 'en', 'ru')
    return locales[0].languageCode;
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

const currentLang = i18n.language || getDeviceLanguage();
dayjs.locale(currentLang === 'zh' ? 'zh-cn' : currentLang);

i18n.on('languageChanged', (lng) => {
  dayjs.locale(lng === 'zh' ? 'zh-cn' : lng);
});

export default i18n;
