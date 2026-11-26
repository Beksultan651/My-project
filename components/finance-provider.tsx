"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { localToday, STORAGE_KEY } from "@/lib/finance";
import { applyFinanceAction, type FinanceAction } from "@/lib/finance-records";
import { blankFinance, decodeFinance, isFinanceData, newFinance, type FinanceChange } from "@/lib/finance-storage";
import type { MessageKey } from "@/lib/i18n";
import type { FinanceData } from "@/types/finance";
import { FinanceLogin } from "./finance-login";
import { Icon } from "./icons";

type Viewer = { id: string; username: string };
type Snapshot = FinanceData & {
  initialized: boolean;
  today: string;
  storageError: "" | MessageKey;
  user: Viewer | null;
  revision: number;
  legacyAvailable: boolean;
};
const initial: Snapshot = {
  ...blankFinance(), initialized: false, today: "", storageError: "", user: null, revision: 0, legacyAvailable: false,
};
let snapshot = initial;
let pending: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach(listener => listener());
}

function enqueue<T>(action: () => Promise<T>): Promise<T> {
  const result = pending.then(action, action);
  pending = result;
  return result;
}

async function refresh() {
  try {
    const response = await fetch("/api/finance", { cache: "no-store" });
    if (response.status === 401) {
      publish({ ...initial, initialized: true });
      return false;
    }
    if (!response.ok) throw new Error();
    const saved = await response.json() as { user: Viewer; data: unknown; version: number; legacyAvailable: boolean };
    const sameUser = snapshot.user?.id === saved.user.id;
    const initialFinance = sameUser && snapshot.revision === 0 ? financeOnly(snapshot)
      : newFinance(new Date().toISOString(), matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    if (!(saved.version === 0 && saved.data === null) && !isFinanceData(saved.data)) throw new Error();
    const data = isFinanceData(saved.data) ? saved.data : initialFinance;
    publish({ ...data, user: saved.user, revision: saved.version, initialized: true, today: localToday(),
      storageError: "", legacyAvailable: saved.legacyAvailable });
    return true;
  } catch {
    publish({ ...snapshot, initialized: true, storageError: "serverUnavailable" });
    return false;
  }
}

function financeOnly(data: FinanceData): FinanceData {
  const { accounts, categories, transactions, goals, completedLessons, theme, budget } = data;
  return { version: 2, accounts, categories, transactions, goals, completedLessons, theme, budget };
}

const responseErrors: MessageKey[] = ["forbiddenOrigin", "authInvalid", "authTaken", "authRate", "authFields", "authAlreadyImported", "storageInvalid", "formInvalid", "recordChanged"];
async function readError(response: Response, fallback: MessageKey): Promise<MessageKey> {
  const body = await response.json().catch(() => null);
  return responseErrors.find(error => error === body?.error) ?? fallback;
}

function authenticate(mode: "login" | "register", username: string, password: string) {
  return enqueue(async (): Promise<MessageKey | null> => {
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }),
      });
      if (!response.ok) return readError(response, "authError");
      return await refresh() ? null : "authError";
    } catch {
      return "authError";
    }
  });
}

function logout() {
  return enqueue(async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) return false;
      publish({ ...initial, initialized: true });
      return true;
    } catch {
      return false;
    }
  });
}

async function persist(current: Snapshot, input: { data: FinanceData } | { source: "legacy"; password: string }): Promise<MessageKey | null> {
  if (!current.user) return "authError";
  try {
    const response = await fetch("/api/finance", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, version: current.revision, userId: current.user.id }),
    });
    if (response.status === 401 || response.status === 409) {
      const error = await readError(response, "recordChanged");
      await refresh();
      return error;
    }
    if (!response.ok) {
      const error = await readError(response, "storageSave");
      if (error === "storageSave") publish({ ...current, storageError: error });
      return error;
    }
    const result = await response.json();
    const data = "data" in input ? input.data : result.data;
    if (!isFinanceData(data) || result.version !== current.revision + 1) throw new Error();
    publish({ ...current, ...financeOnly(data), revision: result.version, legacyAvailable: false, today: localToday(), storageError: "" });
    return null;
  } catch {
    publish({ ...current, storageError: "storageSave" });
    return "storageSave";
  }
}

function commit(change: (data: FinanceData) => FinanceChange) {
  const userId = snapshot.user?.id;
  return enqueue(async (): Promise<MessageKey | null> => {
    const current = snapshot;
    if (!userId || current.user?.id !== userId) return "authError";
    const result = change(financeOnly(current));
    if ("error" in result) return result.error;
    return persist(current, { data: financeOnly(result.data) });
  });
}

const update = async (recipe: (data: FinanceData) => FinanceData) => (await commit(data => ({ data: recipe(data) }))) === null;
const save = (action: FinanceAction) => commit(data => applyFinanceAction(data, action));

function importLocal(source: "browser" | "legacy", password = "") {
  const userId = snapshot.user?.id;
  return enqueue(async (): Promise<MessageKey | null> => {
    const current = snapshot;
    if (!userId || current.user?.id !== userId || current.revision !== 0) return "authAlreadyImported";
    if (source === "legacy") return persist(current, { source, password });
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      const data = raw === null ? null : decodeFinance(raw, new Date().toISOString());
      return data ? persist(current, { data }) : "storageInvalid";
    } catch {
      return "storageBlocked";
    }
  });
}

const FinanceContext = createContext<{
  data: Snapshot;
  update: typeof update;
  save: typeof save;
  logout: typeof logout;
  importLocal: typeof importLocal;
  notify: (message: string) => void;
} | null>(null);
const getSnapshot = () => snapshot;
const getServerSnapshot = () => initial;

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
    void enqueue(refresh);
    function syncVisible() {
      if (document.visibilityState === "visible") void enqueue(refresh);
    }
    document.addEventListener("visibilitychange", syncVisible);
    return () => {
      document.removeEventListener("visibilitychange", syncVisible);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = data.user ? data.theme : "light";
  }, [data.user, data.theme]);

  return (
    <FinanceContext.Provider value={{ data, update, save, logout, importLocal, notify }}>
      {data.user ? <div key={data.user.id}>{children}</div> :
        <FinanceLogin onAuthenticate={authenticate} loading={!data.initialized} unavailable={!!data.storageError} />}
      {data.user && toast && <div role="status" className="toast"><Icon name="check" size={18}/>{toast}</div>}
    </FinanceContext.Provider>
  );
}

export function useFinance() {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("FinanceProvider табылмады");
  return context;
}
