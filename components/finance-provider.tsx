"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { localToday, STORAGE_KEY } from "@/lib/finance";
import { applyFinanceAction, type FinanceAction, type FinanceIssue } from "@/lib/finance-records";
import { blankFinance, commitFinance, loadFinance, newFinance, type FinanceChange, type StorageIssue } from "@/lib/finance-storage";
import type { FinanceData } from "@/types/finance";
import { Icon } from "./icons";
import { FinanceLogin } from "./finance-login";
import type { MessageKey } from "@/lib/i18n";

type Snapshot = FinanceData & {
  initialized: boolean;
  today: string;
  storageError: "" | StorageIssue | "serverUnavailable";
  authRequired: boolean;
};
const initial: Snapshot = { ...blankFinance(), initialized: false, today: "", storageError: "", authRequired: false };
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
  snapshot = { ...data, initialized: true, today: localToday(), storageError, authRequired: false };
  emit();
}

function requireAuthentication() {
  snapshot = { ...blankFinance(), initialized: false, today: "", storageError: "", authRequired: true };
  emit();
}

function syncFromStorage() {
  if (snapshot.authRequired) return;
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
  syncWithServer();
}

async function syncWithServer() {
  try {
    const response = await fetch("/api/finance", { cache: "no-store" });
    if (response.status === 401) {
      requireAuthentication();
      return;
    }
    if (response.status === 404) {
      syncFromStorage();
      if (snapshot.initialized) {
        await saveToServer(snapshot);
      }
      return;
    }
    if (!response.ok) throw new Error("Server unavailable");
    const result = await response.json() as { data?: FinanceData };
    if (!result.data) throw new Error("Invalid server response");

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data));
    publish(result.data);
  } catch {
    syncFromStorage();
    if (snapshot.initialized) publish(snapshot, "serverUnavailable");
  }
}

async function saveToServer(data: FinanceData) {
  try {
    const response = await fetch("/api/finance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });
    if (response.status === 401) {
      requireAuthentication();
      return;
    }
    if (!response.ok) throw new Error("Server save failed");
    publish(data);
  } catch {
    publish(data, "serverUnavailable");
  }
}

async function login(password: string): Promise<MessageKey | null> {
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (response.status === 401) return "authInvalid";
    if (response.status === 503) return "authUnavailable";
    if (!response.ok) return "authError";
    await syncWithServer();
    return snapshot.authRequired ? "authError" : null;
  } catch {
    return "authError";
  }
}

async function logout(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) return false;
    requireAuthentication();
    return true;
  } catch {
    return false;
  }
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
      void saveToServer(result.data);
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
  logout: typeof logout;
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
    <FinanceContext.Provider value={{ data, update, save, logout, notify }}>
      {data.authRequired ? <FinanceLogin onLogin={login}/> : children}
      {toast && <div role="status" className="toast"><Icon name="check" size={18}/>{toast}</div>}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("FinanceProvider табылмады");
  return context;
}
