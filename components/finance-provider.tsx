"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { localToday, STORAGE_KEY } from "@/lib/finance";
import { applyFinanceAction, type FinanceAction, type FinanceIssue } from "@/lib/finance-records";
import { blankFinance, commitFinance, loadFinance, newFinance, type FinanceChange, type StorageIssue } from "@/lib/finance-storage";
import type { FinanceData } from "@/types/finance";
import { Icon } from "./icons";

type Snapshot = FinanceData & {
  initialized: boolean;
  today: string;
  storageError: "" | StorageIssue;
};
const initial: Snapshot = { ...blankFinance(), initialized: false, today: "", storageError: "" };
let snapshot = initial;
let fallback = blankFinance();
let migrationTime = "";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const getSnapshot = () => snapshot;
const getServerSnapshot = () => initial;

function publish(data: FinanceData, storageError: Snapshot["storageError"] = "") {
  snapshot = { ...data, initialized: true, today: localToday(), storageError };
  emit();
}

function syncFromStorage() {
  try {
    const result = loadFinance(window.localStorage, fallback, migrationTime);
    if ("error" in result) publish(snapshot, result.error);
    else publish(result.data);
  } catch {
    publish(snapshot, "storageBlocked");
  }
}

function hydrate() {
  if (snapshot.initialized) return;
  migrationTime = new Date().toISOString();
  const theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  fallback = newFinance(migrationTime, theme);
  syncFromStorage();
}

type SaveIssue = FinanceIssue | StorageIssue;
async function commit(change: (data: FinanceData) => FinanceChange): Promise<SaveIssue | null> {
  if (!snapshot.initialized) return "formInvalid";

  function write(): SaveIssue | null {
    let storage: Storage;
    try {
      storage = window.localStorage;
    } catch {
      publish(snapshot, "storageBlocked");
      return "storageBlocked";
    }

    const result = commitFinance(storage, fallback, migrationTime, change);
    if (!("error" in result)) {
      publish(result.data);
      return null;
    }
    const storageError = result.error === "storageInvalid" ||
      result.error === "storageBlocked" || result.error === "storageSave" ? result.error : "";
    publish(result.current ?? snapshot, storageError);
    return result.error;
  }

  try {
    // Re-read under the same lock used by the other tabs when Web Locks are available.
    return navigator.locks ? await navigator.locks.request(STORAGE_KEY, write) : write();
  } catch {
    publish(snapshot, "storageSave");
    return "storageSave";
  }
}

async function update(recipe: (data: FinanceData) => FinanceData) {
  return (await commit((data) => ({ data: recipe(data) }))) === null;
}

const save = (action: FinanceAction) => commit((data) => applyFinanceAction(data, action));

const FinanceContext = createContext<{
  data: Snapshot;
  update: typeof update;
  save: typeof save;
  notify: (message: string) => void;
} | null>(null);

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
      if (event.key === STORAGE_KEY || event.key === null) syncFromStorage();
    }
    function refresh() {
      if (!document.hidden && snapshot.today !== localToday()) {
        snapshot = { ...snapshot, today: localToday() };
        emit();
      }
    }
    window.addEventListener("storage", sync);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", refresh);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (data.initialized) document.documentElement.dataset.theme = data.theme;
  }, [data.theme, data.initialized]);

  return (
    <FinanceContext.Provider value={{ data, update, save, notify }}>
      {children}
      {toast && <div role="status" className="toast"><Icon name="check" size={18}/>{toast}</div>}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("FinanceProvider табылмады");
  return context;
}
