import "../styles/global.css"; // Global styles applied to all pages
import { AppProps } from "next/app";
import { I18nextProvider } from "react-i18next";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enTranslation from "../public/locales/en/translation.json";
import esTranslation from "../public/locales/es/translation.json";
import arTranslation from "../public/locales/ar/translation.json";
import frTranslation from "../public/locales/fr/translation.json";

// Initialize i18n
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    es: { translation: esTranslation },
    ar: { translation: arTranslation },
    fr: { translation: frTranslation },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default function App({ Component, pageProps }: AppProps) {
  return (
    <I18nextProvider i18n={i18n}>
      <Component {...pageProps} />
    </I18nextProvider>
  );
}
