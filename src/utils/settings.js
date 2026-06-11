import { fr, en } from '../i18n/translations';

export const RATES   = { EUR: 1, USD: 1.08, GBP: 0.85, CHF: 0.96, JPY: 163, CAD: 1.47, AUD: 1.66 };
export const SYMBOLS = { EUR: '€', USD: '$', GBP: '£', CHF: 'CHF', JPY: '¥', CAD: 'CA$', AUD: 'A$' };
const LOCALES        = { EUR: 'fr-FR', USD: 'en-US', GBP: 'en-GB', CHF: 'de-CH', JPY: 'ja-JP', CAD: 'en-CA', AUD: 'en-AU' };
const DICTS          = { fr, en };

const _s = {
  currency:   localStorage.getItem('ct_currency') || 'EUR',
  language:   localStorage.getItem('ct_lang')     || 'fr',
  dateFormat: localStorage.getItem('ct_datefmt')  || 'dd/mm/yyyy',
};

export const updateSettings = (prefs) => {
  if (prefs.currency   !== undefined) _s.currency   = prefs.currency;
  if (prefs.language   !== undefined) _s.language   = prefs.language;
  if (prefs.dateFormat !== undefined) _s.dateFormat = prefs.dateFormat;
};

export const getSettings = () => ({ ..._s });

export const fEur = (n, compact = false) => {
  if (n == null || isNaN(n)) return '—';
  const rate = RATES[_s.currency] || 1;
  const sym  = SYMBOLS[_s.currency] || '€';
  const converted = n * rate;
  if (compact) {
    const abs = Math.abs(converted);
    if (abs >= 1_000_000) return (converted / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M' + sym;
    if (abs >= 1_000)     return (converted / 1_000).toFixed(1).replace(/\.0$/, '') + 'k' + sym;
    return Math.round(converted) + sym;
  }
  const decimals = _s.currency === 'JPY' ? 0 : 2;
  return new Intl.NumberFormat(LOCALES[_s.currency] || 'fr-FR', {
    style: 'currency',
    currency: _s.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted);
};

export const fDate = (d) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  if (_s.dateFormat === 'mm/dd/yyyy') return `${mm}/${dd}/${yyyy}`;
  if (_s.dateFormat === 'yyyy-mm-dd') return `${yyyy}-${mm}-${dd}`;
  return `${dd}/${mm}/${yyyy}`;
};

export const t = (key, ...args) => {
  const dict = DICTS[_s.language] || fr;
  let str = dict[key] ?? fr[key] ?? key;
  args.forEach((arg, i) => { str = str.replace(`{${i}}`, String(arg)); });
  return str;
};
