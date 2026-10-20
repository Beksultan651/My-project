"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { money, type Transaction } from "@/lib/finance";

export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{children && <div className="heading-actions">{children}</div>}</div>;
}

export function StatCards({ income, expense, balance, caption = "Барлық кезең бойынша" }: { income: number; expense: number; balance: number; caption?: string }) {
  return <div className="stats-grid">{[{ label: "Жалпы баланс", value: balance, icon: "wallet", className: "balance", note: "Кірістер мен шығыстар айырмасы" }, { label: "Жалпы кіріс", value: income, icon: "down", className: "income", note: caption }, { label: "Жалпы шығыс", value: expense, icon: "up", className: "expense", note: caption }].map((stat) => <article className={`stat-card ${stat.className}`} key={stat.label}><div className="stat-top"><span>{stat.label}</span><span className={`stat-icon ${stat.className}`}><Icon name={stat.icon} size={21}/></span></div><strong className="stat-value">{money(stat.value)}</strong><p><span className={`tiny-dot ${stat.className}`}/>{stat.note}</p></article>)}</div>;
}

export function EmptyState({ icon, title, description, children }: { icon: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;
}

export function Modal({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className="modal" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-content"><div className="modal-heading"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Терезені жабу"><Icon name="close"/></button></div>{children}</div></dialog>;
}

export function TransactionList({ transactions, onDelete }: { transactions: Transaction[]; onDelete?: (item: Transaction) => void }) {
  return <div className="transaction-list">{transactions.map((t) => <div className="transaction-row" key={t.id}><span className={`transaction-icon ${t.type === "income" ? "mint" : "peach"}`}><Icon name={t.type === "income" ? "down" : "up"} size={20}/></span><div className="transaction-info"><strong>{t.title}</strong><span>{t.category} <span className="text-faint">·</span> {t.date.split("-").reverse().join(".")}</span></div><span className={`transaction-amount ${t.type === "income" ? "positive" : ""}`}>{t.type === "income" ? "+" : "−"}{money(t.amount)}</span>{onDelete && <button className="icon-button danger-button" aria-label={`${t.title} транзакциясын жою`} onClick={() => onDelete(t)}><Icon name="trash" size={17}/></button>}</div>)}</div>;
}

export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link className="text-link" href={href}>{children}<Icon name="arrow" size={17}/></Link>; }
