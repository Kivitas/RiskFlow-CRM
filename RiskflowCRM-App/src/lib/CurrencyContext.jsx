import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'riskflow_crm:currency:v1';
const RATES_CACHE_KEY = 'riskflow_crm:fx_rates:v1';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000;

export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US', decimals: 2 },
  { code: 'EUR', symbol: '€', name: 'Euro', locale: 'de-DE', decimals: 2 },
  { code: 'GBP', symbol: '£', name: 'British Pound', locale: 'en-GB', decimals: 2 },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'de-CH', decimals: 2 },
  { code: 'ILS', symbol: '₪', name: 'Israeli New Shekel', locale: 'he-IL', decimals: 2 },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU', decimals: 2 },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', locale: 'sv-SE', decimals: 2 },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', locale: 'nb-NO', decimals: 2 },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', locale: 'da-DK', decimals: 2 },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', locale: 'pl-PL', decimals: 2 },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', locale: 'cs-CZ', decimals: 2 },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', locale: 'hu-HU', decimals: 2 },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', locale: 'ro-RO', decimals: 2 },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', locale: 'bg-BG', decimals: 2 },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', locale: 'en-CA', decimals: 2 },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', decimals: 2 },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', locale: 'en-NZ', decimals: 2 },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', decimals: 2 },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', decimals: 0 },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', decimals: 2 },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', locale: 'zh-HK', decimals: 2 },
  { code: 'TWD', symbol: 'NT$', name: 'New Taiwan Dollar', locale: 'zh-TW', decimals: 2 },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', locale: 'ko-KR', decimals: 0 },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', decimals: 2 },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', locale: 'th-TH', decimals: 2 },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', locale: 'ms-MY', decimals: 2 },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', locale: 'id-ID', decimals: 0 },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', locale: 'en-PH', decimals: 2 },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', locale: 'vi-VN', decimals: 0 },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', locale: 'en-PK', decimals: 2 },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', locale: 'en-AE', decimals: 2 },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', locale: 'ar-SA', decimals: 2 },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal', locale: 'ar-QA', decimals: 2 },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar', locale: 'ar-KW', decimals: 3 },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar', locale: 'ar-BH', decimals: 3 },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial', locale: 'ar-OM', decimals: 3 },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', locale: 'pt-BR', decimals: 2 },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', locale: 'es-MX', decimals: 2 },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', locale: 'en-ZA', decimals: 2 },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', locale: 'tr-TR', decimals: 2 },
];

const FALLBACK_RATES = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CHF: 0.90,
  ILS: 3.68,
  RUB: 90.5,
  SEK: 10.7,
  NOK: 10.9,
  DKK: 6.86,
  PLN: 3.95,
  CZK: 22.9,
  HUF: 359,
  RON: 4.58,
  BGN: 1.8,
  CAD: 1.36,
  AUD: 1.53,
  NZD: 1.67,
  INR: 83.5,
  JPY: 149.5,
  CNY: 7.24,
  HKD: 7.81,
  TWD: 32.4,
  KRW: 1330,
  SGD: 1.34,
  THB: 36.1,
  MYR: 4.68,
  IDR: 16250,
  PHP: 57.1,
  VND: 24650,
  PKR: 278,
  AED: 3.67,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.31,
  BHD: 0.376,
  OMR: 0.385,
  BRL: 4.97,
  MXN: 17.1,
  ZAR: 18.6,
  TRY: 32.3,
};

const CurrencyContext = createContext(null);

const getCurrencyMeta = (code) =>
  SUPPORTED_CURRENCIES.find((currency) => currency.code === code) || SUPPORTED_CURRENCIES[0];

const readSavedCurrency = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'USD';
  } catch {
    return 'USD';
  }
};

const readCachedRates = () => {
  try {
    const raw = localStorage.getItem(RATES_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    if (!parsed?.rates || !parsed?.timestamp) {
      return null;
    }
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const saveCachedRates = (rates) => {
  const payload = { rates, timestamp: Date.now() };
  try {
    localStorage.setItem(RATES_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage failures
  }
  return payload;
};

const formatWithCurrency = (amount, meta) =>
  new Intl.NumberFormat(meta.locale, {
    style: 'currency',
    currency: meta.code,
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(Number(amount || 0));

const formatCompactWithCurrency = (amount, meta) =>
  `${meta.symbol}${new Intl.NumberFormat(meta.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(amount || 0))}`;

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(readSavedCurrency);
  const [rates, setRates] = useState(FALLBACK_RATES);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState(null);
  const [ratesSource, setRatesSource] = useState('fallback');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchRates = useCallback(async (force = false) => {
    if (!force) {
      const cached = readCachedRates();
      if (cached) {
        setRates(cached.rates);
        setRatesSource('cache');
        setLastUpdated(new Date(cached.timestamp));
        return;
      }
    }

    setRatesLoading(true);
    setRatesError(null);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (data.result !== 'success') {
        throw new Error(data['error-type'] || 'API error');
      }
      const cached = saveCachedRates(data.rates);
      setRates(cached.rates);
      setRatesSource('live');
      setLastUpdated(new Date(cached.timestamp));
    } catch (error) {
      const cached = readCachedRates();
      if (cached) {
        setRates(cached.rates);
        setRatesSource('cache');
        setLastUpdated(new Date(cached.timestamp));
      } else {
        setRates(FALLBACK_RATES);
        setRatesSource('fallback');
        setLastUpdated(null);
      }
      setRatesError(error.message || 'Failed to load exchange rates');
    } finally {
      setRatesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  const setCurrency = useCallback((code) => {
    setCurrencyState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore storage failures
    }
  }, []);

  const currencyInfo = useMemo(() => getCurrencyMeta(currency), [currency]);

  const getExchangeRate = useCallback((code = currency) => {
    const nextCode = code || currency;
    return Number(rates?.[nextCode] || 1);
  }, [currency, rates]);

  const convertAmount = useCallback((usdAmount, targetCode = currency) => {
    const num = Number(usdAmount || 0);
    return num * getExchangeRate(targetCode);
  }, [currency, getExchangeRate]);

  const toBaseAmount = useCallback((displayAmount, sourceCode = currency) => {
    const num = Number(displayAmount || 0);
    const rate = getExchangeRate(sourceCode);
    if (!rate) {
      return num;
    }
    return num / rate;
  }, [currency, getExchangeRate]);

  const formatMoney = useCallback((usdAmount, targetCode = currency) => {
    const meta = getCurrencyMeta(targetCode);
    return formatWithCurrency(convertAmount(usdAmount, targetCode), meta);
  }, [convertAmount, currency]);

  const formatMoneyCompact = useCallback((usdAmount, targetCode = currency) => {
    const meta = getCurrencyMeta(targetCode);
    return formatCompactWithCurrency(convertAmount(usdAmount, targetCode), meta);
  }, [convertAmount, currency]);

  const formatConvertedMoney = useCallback((convertedAmount, targetCode = currency) => {
    const meta = getCurrencyMeta(targetCode);
    return formatWithCurrency(convertedAmount, meta);
  }, [currency]);

  const value = useMemo(() => ({
    currency,
    setCurrency,
    currencyInfo,
    rates,
    ratesLoading,
    ratesError,
    ratesSource,
    lastUpdated,
    getExchangeRate,
    convertAmount,
    toBaseAmount,
    formatMoney,
    formatMoneyCompact,
    formatConvertedMoney,
    fetchRates,
  }), [
    convertAmount,
    currency,
    currencyInfo,
    fetchRates,
    formatConvertedMoney,
    formatMoney,
    formatMoneyCompact,
    getExchangeRate,
    lastUpdated,
    rates,
    ratesError,
    ratesLoading,
    ratesSource,
    setCurrency,
    toBaseAmount,
  ]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
