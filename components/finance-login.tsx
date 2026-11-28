"use client";

import { useState, type FormEvent } from "react";
import { useI18n } from "./i18n-provider";
import { Icon } from "./icons";
import { isLocale, locales, localeNames, type MessageKey } from "@/lib/i18n";

export function FinanceLogin({ onAuthenticate, loading, unavailable }: {
  onAuthenticate: (mode: "login" | "register", username: string, password: string, registration?: { fullName: string; email: string; invitation: string }) => Promise<MessageKey | null>;
  loading: boolean;
  unavailable: boolean;
}) {
  const { t, locale, setLocale, ready } = useI18n();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const registering = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    if (registering && password !== form.get("confirm")) {
      setError("authMismatch");
      return;
    }
    setPending(true);
    setError(await onAuthenticate(mode, username, password, registering ? {
      fullName: String(form.get('fullName')), email: String(form.get('email')), invitation: String(form.get('invitation')),
    } : undefined));
    setPending(false);
  }

  return (
    <main className="main-content min-h-screen flex items-center justify-center" id="main-content">
      <section className="panel w-full max-w-md p-8" aria-labelledby="auth-heading">
        <div className="section-heading">
          <div><p className="eyebrow">qarjy.</p><h1 id="auth-heading">{t(registering ? "authRegister" : "authTitle")}</h1></div>
          <label className="language-control">
            <span className="sr-only">{t("language")}</span>
            <select className="language-select" value={locale} disabled={!ready} onChange={event => {
              if (isLocale(event.target.value)) setLocale(event.target.value);
            }}>
              {locales.map(value => <option key={value} value={value} lang={value}>{localeNames[value]}</option>)}
            </select>
          </label>
        </div>
        <p className="text-muted">{t("authDescription")}</p>
        <>
          <form key={mode} className="form-stack mt-6" onSubmit={submit}>
            <label>{t("authUsername")}
              <input name="username" required minLength={3} maxLength={40} autoComplete="username"
                autoCapitalize="none" spellCheck={false} aria-describedby="auth-username-hint"/>
            </label>
            <p id="auth-username-hint" className="text-muted text-sm">{t("authUsernameHint")}</p>
            <label>{t("authPassword")}
              <input name="password" type="password" required minLength={12} maxLength={128}
                autoComplete={registering ? "new-password" : "current-password"}/>
            </label>
            {registering && <label>{t("authConfirm")}
              <input name="confirm" type="password" required minLength={12} maxLength={128} autoComplete="new-password"/>
            </label>}
            {registering && <>
              <label>Аты-жөні<input name="fullName" autoComplete="name" maxLength={100} required /></label>
              <label>Email<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
              <label>Шақыру коды<input name="invitation" autoComplete="off" minLength={32} maxLength={32} required /></label>
            </>}
            {error === "registrationPending" && <p role="status">{t(error)}</p>}
            {((error && error !== "registrationPending") || unavailable) && <p className="form-error" role="alert">{t(error || "serverUnavailable")}</p>}
            <button className="button button-primary w-full" type="submit" disabled={loading || pending}>
              <Icon name="lock" size={17}/>{pending || loading ? t("loading") : t(registering ? "authRegister" : "authLogin")}
            </button>
          </form>
          <button className="text-link mt-4" type="button" disabled={loading || pending} onClick={() => {
            setMode(registering ? "login" : "register");
            setError(null);
          }}>{t(registering ? "authLogin" : "authRegister")}</button>
        </>
      </section>
    </main>
  );
}
