"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { FinanceImport } from "./finance-import";
import { useFinance } from "./finance-provider";
import { useI18n } from "./i18n-provider";
import { isLocale, locales, localeNames, type MessageKey } from "@/lib/i18n";

const navigation: { href: string; key: MessageKey; shortKey: MessageKey; icon: string }[] = [
  { href: "/", key: "home", shortKey: "home", icon: "home" },
  { href: "/dashboard", key: "dashboard", shortKey: "dashboard", icon: "dashboard" },
  { href: "/transactions", key: "transactions", shortKey: "transactionsShort", icon: "exchange" },
  { href: "/accounts", key: "accounts", shortKey: "accounts", icon: "wallet" },
  { href: "/categories", key: "categories", shortKey: "categories", icon: "bag" },
  { href: "/calculator", key: "calculator", shortKey: "calculator", icon: "calculator" },
  { href: "/goals", key: "goals", shortKey: "goalsShort", icon: "target" },
  { href: "/learn", key: "learn", shortKey: "learnShort", icon: "book" },
];
const mobileRoutes = new Set(["/", "/dashboard", "/transactions", "/goals", "/learn"]);

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, update, logout, notify } = useFinance();
  const { t, locale, setLocale, ready } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const currentKey = navigation.find((item) => item.href === pathname)?.key ?? "notFound";
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    const returnFocus = menuButton.current;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => sidebar.current?.querySelector<HTMLAnchorElement>("a")?.focus(), 0);
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key !== "Tab") return;
      const controls = Array.from(sidebar.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? []).filter((element) => element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!sidebar.current?.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previous; document.removeEventListener("keydown", keydown); returnFocus?.focus(); };
  }, [menuOpen]);

  return <div className="app-shell">
    <title>{`${t(currentKey)} | qarjy.`}</title>
    <a href="#main-content" className="skip-link">{t("skipContent")}</a>
    {menuOpen && <button className="sidebar-backdrop" aria-label={t("menuClose")} onClick={() => setMenuOpen(false)}/>}
    <aside ref={sidebar} id="main-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label={t("navigation")}>
      <div className="sidebar-brand"><Link href="/" onClick={() => setMenuOpen(false)} className="brand"><span className="brand-icon"><Icon name="leaf" size={24}/></span><span>qarjy<span className="brand-dot">.</span><small>{t("appName")}</small></span></Link><button className="icon-button mobile-close" aria-label={t("menuClose")} onClick={() => setMenuOpen(false)}><Icon name="close"/></button></div>
      <p className="nav-label">{t("myFinance")}</p>
      <nav>{navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`nav-item ${pathname === item.href ? "active" : ""}`} aria-current={pathname === item.href ? "page" : undefined}><Icon name={item.icon} size={20}/><span>{t(item.key)}</span>{pathname === item.href && <span className="nav-active-dot"/>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="local-note"><Icon name="shield" size={17}/><span>{t("accountStorage")}</span></div><button className="text-link" type="button" onClick={async () => { if (!await logout()) notify(t("authLogoutError")); }}>{t("authLogout")} · {data.user?.username}</button></div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="flex items-center gap-3"><button ref={menuButton} className="icon-button menu-toggle" aria-label={t("menuOpen")} aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(true)}><Icon name="menu"/></button><span className="breadcrumb">{t("workspace")} <span>/</span> <strong>{t(currentKey)}</strong></span></div>
        <div className="topbar-actions"><label className="language-control"><span className="sr-only">{t("language")}</span><select className="language-select" aria-label={t("language")} value={locale} disabled={!ready} onChange={(event) => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>{locales.map((value) => <option key={value} value={value} lang={value}>{localeNames[value]}</option>)}</select></label><button className="icon-button theme-toggle" disabled={!data.initialized} onClick={() => update((state) => ({ ...state, theme: state.theme === "light" ? "dark" : "light" }))} aria-label={t(data.theme === "light" ? "darkMode" : "lightMode")}><Icon name={data.theme === "light" ? "moon" : "sun"}/></button><span className="profile-avatar" aria-label={t("workspace")}>Q</span></div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>{data.storageError && <div className="storage-warning" role="alert"><Icon name="shield" size={20}/>{t(data.storageError)}</div>}<FinanceImport/>{children}</main>
      <footer className="app-footer"><span>© 2026 qarjy.</span><span><span className="status-dot"/>{t("accountStorage")}</span></footer>
    </div>
    <nav className="mobile-bottom-nav" aria-label={t("mobileNavigation")}>{navigation.filter((item) => mobileRoutes.has(item.href)).map((item) => <Link href={item.href} key={item.href} aria-current={pathname === item.href ? "page" : undefined} onClick={() => setMenuOpen(false)}><Icon name={item.icon} size={20}/><span>{t(item.shortKey)}</span></Link>)}</nav>
  </div>;
}
