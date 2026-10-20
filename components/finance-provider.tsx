"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { emptyData, localToday, readData, STORAGE_KEY, type FinanceData } from "@/lib/finance";
import { Icon } from "./icons";

type Snapshot = FinanceData & { initialized: boolean; today: string; storageError: string };
const initial: Snapshot = { ...emptyData, initialized: false, today: "", storageError: "" };
let snapshot = initial;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const getSnapshot = () => snapshot;
const getServerSnapshot = () => initial;

function hydrate() {
  if (snapshot.initialized) return;
  let data = emptyData;
  let storageError = "";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = readData(raw);
      if (saved) data = saved;
      else storageError = "Сақталған деректерді оқу мүмкін болмады. Бастапқы жазба өзгертілмеді. Жаңа дерек қоссаңыз, ол ауыстырылады.";
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) data = { ...emptyData, theme: "dark" };
  } catch { storageError = "Браузер деректерді сақтауға рұқсат бермеді. Өзгерістер тек осы ашық бетте сақталады."; }
  snapshot = { ...data, initialized: true, today: localToday(), storageError };
  emit();
}

function update(recipe: (data: FinanceData) => FinanceData) {
  if (!snapshot.initialized) return;
  const data = recipe(snapshot);
  const persisted: FinanceData = { version: 1, transactions: data.transactions, goals: data.goals, completedLessons: data.completedLessons, theme: data.theme, budget: data.budget };
  let storageError = "";
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)); }
  catch { storageError = "Өзгеріс браузерге сақталмады. Жады толған немесе сақтау бұғатталған болуы мүмкін. Бетті жапқанша деректер қолжетімді."; }
  snapshot = { ...persisted, initialized: true, today: localToday(), storageError };
  emit();
}

const FinanceContext = createContext<{ data: Snapshot; update: typeof update; notify: (message: string) => void } | null>(null);

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 4000);
  }, []);
  useEffect(() => {
    hydrate();
    function sync(event: StorageEvent) {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const saved = event.newValue ? readData(event.newValue) : emptyData;
      if (saved) { snapshot = { ...saved, initialized: true, today: localToday(), storageError: "" }; emit(); }
    }
    window.addEventListener("storage", sync);
    const refresh = () => { if (!document.hidden && snapshot.today !== localToday()) { snapshot = { ...snapshot, today: localToday() }; emit(); } };
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("storage", sync); document.removeEventListener("visibilitychange", refresh); if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => { if (data.initialized) document.documentElement.dataset.theme = data.theme; }, [data.theme, data.initialized]);
  return <FinanceContext.Provider value={{ data, update, notify }}>{children}{toast && <div role="status" className="toast"><Icon name="check" size={18}/>{toast}</div>}</FinanceContext.Provider>;
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("FinanceProvider табылмады");
  return context;
}
