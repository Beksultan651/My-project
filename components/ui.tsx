"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { Icon } from "./icons";
import { useI18n } from "./i18n-provider";
import type { Currency, Transaction } from "@/types/finance";
import { useFinanceLabels } from "./finance-labels";

export function PageHeading({ eyebrow, title, description, children }: { eyebrow?: string; title: string; description?: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{children && <div className="heading-actions">{children}</div>}</div>;
}
export function StatCards({ income, expense, balance, currency }: { income: number; expense: number; balance: number; currency: Currency }) {
  const { t, money } = useI18n();
  return <div className="stats-grid">{[{ label: t("balance"), value: balance, icon: "wallet", name: "balance", note: t("balanceNote") }, { label: t("totalIncome"), value: income, icon: "down", name: "income", note: t("allTime") }, { label: t("totalExpense"), value: expense, icon: "up", name: "expense", note: t("allTime") }].map((item) => <article className={`stat-card ${item.name}`} key={item.name}><div className="stat-top"><span>{item.label}</span><span className={`stat-icon ${item.name}`}><Icon name={item.icon} size={21}/></span></div><strong className="stat-value">{money(item.value, currency)}</strong><p><span className={`tiny-dot ${item.name}`}/>{item.note}</p></article>)}</div>;
}
export function EmptyState({ icon, title, description, children }: { icon: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={28}/></span><h3>{title}</h3><p>{description}</p>{children}</div>;
}
export function Modal({ open, onClose, title, description, children, wide = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: React.ReactNode; wide?: boolean }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      return () => { if (dialog.open) dialog.close(); if (previous?.isConnected) previous.focus({ preventScroll: true }); };
    }
    if (!open && dialog?.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} className={wide ? "modal modal-wide" : "modal"} aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="modal-content"><div className="modal-heading"><div><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" onClick={onClose} aria-label={t("close")}><Icon name="close"/></button></div>{children}</div></dialog>;
}
export function TransactionList({ transactions, onDelete, onEdit }: { transactions: Transaction[]; onDelete?: (item: Transaction) => void; onEdit?: (item: Transaction) => void }) {
  const { t, money, date } = useI18n();
  const { accountName, accountCurrency, categoryName } = useFinanceLabels();
  return <div className="transaction-list">{transactions.map((item) => <div className="transaction-row" key={item.id}><span className={`transaction-icon ${item.type === "income" ? "mint" : "peach"}`}><Icon name={item.type === "income" ? "down" : "up"} size={20}/></span><div className="transaction-info"><strong>{item.description}</strong><span>{categoryName(item.categoryId)} <span className="text-faint">·</span> {date(item.date)} <span className="text-faint">·</span> {accountName(item.accountId)}</span></div><span className={`transaction-amount ${item.type === "income" ? "positive" : ""}`}>{item.type === "income" ? "+" : "−"}{money(item.amount, accountCurrency(item.accountId))}</span>{(onEdit || onDelete) && <div className="transaction-row-actions">{onEdit && <button className="icon-button" aria-label={t("editTransactionAria", { title: item.description })} onClick={() => onEdit(item)}><Icon name="edit" size={17}/></button>}{onDelete && <button className="icon-button danger-button" aria-label={t("deleteTransactionAria", { title: item.description })} onClick={() => onDelete(item)}><Icon name="trash" size={17}/></button>}</div>}</div>)}</div>;
}
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) { return <Link className="text-link" href={href}>{children}<Icon name="arrow" size={17}/></Link>; }
