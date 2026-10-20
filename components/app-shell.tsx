"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./icons";
import { useFinance } from "./finance-provider";

const navigation = [
  { href: "/", label: "Басты бет", icon: "home" },
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/transactions", label: "Кірістер мен шығыстар", icon: "exchange" },
  { href: "/calculator", label: "Бюджет калькуляторы", icon: "calculator" },
  { href: "/goals", label: "Жинақ мақсаттары", icon: "target" },
  { href: "/learn", label: "Қаржылық білім", icon: "book" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, update } = useFinance();
  const [menuOpen, setMenuOpen] = useState(false);
  const current = navigation.find((item) => item.href === pathname);
  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", escape);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", escape); };
  }, [menuOpen]);
  return <div className="app-shell">
    <a href="#main-content" className="skip-link">Негізгі мазмұнға өту</a>
    {menuOpen && <button className="sidebar-backdrop" aria-label="Мәзірді жабу" onClick={() => setMenuOpen(false)}/>}
    <aside id="main-navigation" className={`sidebar ${menuOpen ? "is-open" : ""}`} aria-label="Негізгі навигация">
      <div className="sidebar-brand"><Link href="/" onClick={() => setMenuOpen(false)} className="brand"><span className="brand-icon"><Icon name="leaf" size={24}/></span><span>qarjy<span className="brand-dot">.</span><small>Қаржылық сауаттылық</small></span></Link><button className="icon-button mobile-close" aria-label="Мәзірді жабу" onClick={() => setMenuOpen(false)}><Icon name="close"/></button></div>
      <p className="nav-label">МЕНІҢ ҚАРЖЫМ</p>
      <nav>{navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={`nav-item ${pathname === item.href ? "active" : ""}`} aria-current={pathname === item.href ? "page" : undefined}><Icon name={item.icon} size={20}/><span>{item.label}</span>{pathname === item.href && <span className="nav-active-dot"/>}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><Icon name="spark" size={22}/></span><h3>Білім — ең жақсы бастама</h3><p>Күніне бірнеше минутты қаржылық біліміңізге арнаңыз.</p><Link href="/learn" onClick={() => setMenuOpen(false)}>Білімді арттыру <Icon name="arrow" size={17}/></Link></div><div className="local-note"><Icon name="shield" size={17}/><span>Деректер осы браузерде<br/>сақталады</span></div></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="flex items-center gap-3"><button className="icon-button menu-toggle" aria-label="Мәзірді ашу" aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(true)}><Icon name="menu"/></button><span className="breadcrumb">Менің кеңістігім <span>/</span> <strong>{current?.label ?? "Бет табылмады"}</strong></span></div><div className="topbar-actions"><span className="language">ҚАЗ <span className="language-dot"/></span><span className="topbar-separator"/><button className="icon-button theme-toggle" disabled={!data.initialized} onClick={() => update((s) => ({ ...s, theme: s.theme === "light" ? "dark" : "light" }))} aria-label={data.theme === "light" ? "Қараңғы режимге ауысу" : "Жарық режимге ауысу"} title={data.theme === "light" ? "Қараңғы режим" : "Жарық режим"}><Icon name={data.theme === "light" ? "moon" : "sun"}/></button><span className="profile-avatar" aria-label="Жеке кеңістік">Қ</span></div></header>
      <main id="main-content" className="main-content" tabIndex={-1}>{data.storageError && <div className="storage-warning" role="alert"><Icon name="shield" size={20}/>{data.storageError}</div>}{children}</main>
      <footer className="app-footer"><span>© 2026 qarjy. Өз болашағыңызға инвестиция.</span><span><span className="status-dot"/>{data.storageError ? "Сақтауды тексеріңіз" : "Сіздің қаржыңыз. Сіздің бақылауыңыз."}</span></footer>
    </div>
  </div>;
}
