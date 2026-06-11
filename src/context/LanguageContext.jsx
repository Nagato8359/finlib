import { createContext, useContext, useMemo } from 'react';
import { fr, en } from '../i18n/translations';

const DICTS = { fr, en };

export const LanguageContext = createContext({ language: 'fr', t: (k) => k });

export function LanguageProvider({ language, children }) {
  const value = useMemo(() => {
    const dict = DICTS[language] || fr;
    const t = (key, ...args) => {
      let str = dict[key] ?? fr[key] ?? key;
      args.forEach((arg, i) => { str = str.replace(`{${i}}`, String(arg)); });
      return str;
    };
    return { language, t };
  }, [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
