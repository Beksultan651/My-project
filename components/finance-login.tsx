"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "./i18n-provider";
import { Icon } from "./icons";
import type { MessageKey } from "@/lib/i18n";

export function FinanceLogin({ onLogin }: { onLogin: (password: string) => Promise<MessageKey | null> }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(await onLogin(password));
    setPending(false);
  }

  return (
    <main className="main-content min-h-screen flex items-center justify-center" id="main-content">
      <section className="panel w-full max-w-md p-8">
        <div className="section-heading">
          <div>
            <p className="eyebrow">qarjy.</p>
            <h1>{t("authTitle")}</h1>
          </div>
          <Icon name="lock" size={24}/>
        </div>
        <p className="text-muted">{t("authDescription")}</p>
        <form className="form-stack mt-6" onSubmit={submit}>
          <label>{t("authPassword")}
            <input
              required
              autoComplete="current-password"
              type="password"
              maxLength={256}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error && <p className="form-error" role="alert">{t(error)}</p>}
          <button className="button button-primary w-full" type="submit" disabled={pending || !password}>
            <Icon name="lock" size={17}/>{t("authLogin")}
          </button>
        </form>
      </section>
    </main>
  );
}
