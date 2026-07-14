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
import localeData from 'dayjs/plugin/localeData';
import { LocaleConfig } from 'react-native-calendars';

dayjs.extend(localeData);

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

const setupCalendarLocale = (langCode) => {
  if (!LocaleConfig.locales[langCode]) {
    const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    
    // Explicitly format a dayjs object to bypass cached array bugs
    const getMonths = (formatStr) => Array.from({length: 12}, (_, i) => capitalize(dayjs().month(i).locale(langCode).format(formatStr)));
    const getDays = (formatStr) => Array.from({length: 7}, (_, i) => capitalize(dayjs().day(i).locale(langCode).format(formatStr)));

    LocaleConfig.locales[langCode] = {
      monthNames: getMonths('MMMM'),
      monthNamesShort: getMonths('MMM'),
      dayNames: getDays('dddd'),
      dayNamesShort: getDays('ddd'),
      today: i18n.t('Today', { lng: langCode })
    };
  }
  LocaleConfig.defaultLocale = langCode;
};

const currentLang = i18n.language || getDeviceLanguage();
const currentDayjsLang = currentLang === 'zh' ? 'zh-cn' : currentLang;
dayjs.locale(currentDayjsLang);
setupCalendarLocale(currentDayjsLang);

i18n.on('languageChanged', (lng) => {
  const newLang = lng === 'zh' ? 'zh-cn' : lng;
  dayjs.locale(newLang);
  setupCalendarLocale(newLang);
});

export default i18n;
