import { useState } from 'react';
import { DK, LK } from '../utils/constants';
import { updateSettings } from '../utils/settings';

export const ACCENT_OPTIONS = [
  { key: 'green',  main: '#10b981', dark: '#059669', label: 'Vert' },
  { key: 'blue',   main: '#3b82f6', dark: '#2563eb', label: 'Bleu' },
  { key: 'violet', main: '#8b5cf6', dark: '#7c3aed', label: 'Violet' },
  { key: 'orange', main: '#f97316', dark: '#ea580c', label: 'Orange' },
];

export function useTheme() {
  const [darkMode, setDM] = useState(() => localStorage.getItem('ct_dark') !== '0');
  const [accentKey, setAccentKey] = useState(() => localStorage.getItem('ct_accent') || 'green');
  const [currency, setCurrencyState]     = useState(() => localStorage.getItem('ct_currency') || 'EUR');
  const [language, setLanguageState]     = useState(() => localStorage.getItem('ct_lang')     || 'fr');
  const [dateFormat, setDateFormatState] = useState(() => localStorage.getItem('ct_datefmt')  || 'dd/mm/yyyy');

  const setDarkMode = v => { setDM(v); localStorage.setItem('ct_dark', v ? '1' : '0'); };

  const setAccent = key => {
    setAccentKey(key);
    localStorage.setItem('ct_accent', key);
    const opt = ACCENT_OPTIONS.find(a => a.key === key) || ACCENT_OPTIONS[0];
    document.documentElement.style.setProperty('--color-accent', opt.main);
    document.documentElement.style.setProperty('--color-accent-dark', opt.dark);
  };

  const setCurrency = v => {
    setCurrencyState(v);
    localStorage.setItem('ct_currency', v);
    updateSettings({ currency: v });
  };

  const setLanguage = v => {
    setLanguageState(v);
    localStorage.setItem('ct_lang', v);
    updateSettings({ language: v });
  };

  const setDateFormat = v => {
    setDateFormatState(v);
    localStorage.setItem('ct_datefmt', v);
    updateSettings({ dateFormat: v });
  };

  const accentOpt = ACCENT_OPTIONS.find(a => a.key === accentKey) || ACCENT_OPTIONS[0];
  document.documentElement.style.setProperty('--color-accent', accentOpt.main);
  document.documentElement.style.setProperty('--color-accent-dark', accentOpt.dark);
  const base = darkMode ? DK : LK;
  const T = { ...base, accent: accentOpt.main, accentDark: accentOpt.dark };

  return {
    darkMode, setDarkMode, T, accentKey, setAccent,
    currency, setCurrency, language, setLanguage, dateFormat, setDateFormat,
  };
}
