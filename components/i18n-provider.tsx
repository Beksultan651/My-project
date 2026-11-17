"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { LOCALE_KEY, formatDate, formatMoney, isLocale, resolveLocale, translate, translatedCategory, type Locale, type MessageKey, type MessageParams } from "@/lib/i18n";
import type { Currency } from "@/types/finance";

const initial = { locale: "kk" as Locale, ready: false, saveError: false };
let snapshot = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;
const getServerSnapshot = () => initial;

type I18nContextValue = {
  locale: Locale; ready: boolean; setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: MessageParams) => string;
  money: (amount: number, currency?: Currency) => string; date: (value: string, full?: boolean) => string; categoryName: (value: string) => string;
};
const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    if (!snapshot.ready) {
      let locale: Locale = "kk";
      try { locale = resolveLocale(localStorage.getItem(LOCALE_KEY)); } catch { /* Default language remains available. */ }
      snapshot = { locale, ready: true, saveError: false }; emit();
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== LOCALE_KEY && event.key !== null) return;
      snapshot = { locale: resolveLocale(event.newValue), ready: true, saveError: false }; emit();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const setLocale = useCallback((locale: Locale) => {
    if (!isLocale(locale)) return;
    let saveError = false;
    try { localStorage.setItem(LOCALE_KEY, locale); } catch { saveError = true; }
    snapshot = { locale, ready: true, saveError }; emit();
  }, []);
  const t = useCallback((key: MessageKey, params?: MessageParams) => translate(state.locale, key, params), [state.locale]);
  useEffect(() => {
    document.documentElement.lang = state.locale;
  }, [state.locale]);
  const context = useMemo<I18nContextValue>(() => ({ locale: state.locale, ready: state.ready, setLocale, t, money: (amount, currency) => formatMoney(amount, state.locale, currency), date: (value, full = false) => formatDate(value, state.locale, full), categoryName: (value) => translatedCategory(value, state.locale) }), [state.locale, state.ready, setLocale, t]);
  return <I18nContext.Provider value={context}><meta name="description" content={t("appDescription")}/>{state.saveError && <div className="language-warning" role="alert">{t("languageSaveError")}</div>}{children}</I18nContext.Provider>;
}

export function useI18n() { const value = useContext(I18nContext); if (!value) throw new Error("I18nProvider is required"); return value; }
