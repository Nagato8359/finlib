import { useState } from 'react';
import { DK, LK } from '../utils/constants';

export function useTheme() {
  const [darkMode, setDM] = useState(() => localStorage.getItem('ct_dark') !== '0');

  const setDarkMode = v => {
    setDM(v);
    localStorage.setItem('ct_dark', v ? '1' : '0');
  };

  return { darkMode, setDarkMode, T: darkMode ? DK : LK };
}
