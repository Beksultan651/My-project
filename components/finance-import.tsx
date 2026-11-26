"use client";

import { useState, type FormEvent } from "react";
import { STORAGE_KEY } from "@/lib/finance";
import type { MessageKey } from "@/lib/i18n";
import { useI18n } from "./i18n-provider";
import { useFinance } from "./finance-provider";

export function FinanceImport() {
  const { data, importLocal, notify } = useFinance();
  const { t } = useI18n();
  const [browserCopy] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  if (data.revision !== 0 || (!browserCopy && !data.legacyAvailable)) return null;

  async function run(source: "browser" | "legacy", password?: string) {
    setPending(true);
    const failure = await importLocal(source, password);
    setPending(false);
    setError(failure);
    if (!failure) notify(t("authImported"));
  }

  function importServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = new FormData(event.currentTarget);
    void run("legacy", String(input.get("legacy-key") ?? ""));
  }

  return (
    <details className="panel mb-4">
      <summary>{t("authImport")}</summary>
      <p className="text-muted mt-3">{t("authImportHint")}</p>
      {browserCopy && <button className="button button-outline mt-3" type="button" disabled={pending}
        onClick={() => void run("browser")}>{t("authImportBrowser")}</button>}
      {data.legacyAvailable && <form className="form-stack mt-3" onSubmit={importServer}>
        <label>{t("authLegacyKey")}
          <input name="legacy-key" type="password" required maxLength={256} autoComplete="off"/>
        </label>
        <button className="button button-outline" disabled={pending} type="submit">{t("authImportServer")}</button>
      </form>}
      {error && <p className="form-error" role="alert">{t(error)}</p>}
    </details>
  );
}
