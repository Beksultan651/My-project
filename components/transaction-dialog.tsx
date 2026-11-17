"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { parseMoney, validDate } from "@/lib/finance";
import { createRecordId } from "@/lib/record-id";
import type { MessageKey } from "@/lib/i18n";
import type { Transaction, TransactionType } from "@/types/finance";
import { useFinance } from "./finance-provider";
import { useFinanceLabels } from "./finance-labels";
import { useI18n } from "./i18n-provider";
import { Icon } from "./icons";
import { Modal } from "./ui";

export type TransactionEditor = { transaction: Transaction | null };

export function TransactionDialog({ transaction, initialAccountId, onClose }: TransactionEditor & {
  initialAccountId?: string; onClose: () => void;
}) {
  const { data, save, notify } = useFinance();
  const { t } = useI18n();
  const { accountLabel, categoryLabel, accountCurrency } = useFinanceLabels();
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [description, setDescription] = useState(transaction?.description ?? "");
  const [amount, setAmount] = useState(transaction ? (transaction.amount / 100).toFixed(2) : "");
  const [accountId, setAccountId] = useState(transaction?.accountId ?? (initialAccountId || data.accounts[0]?.id || ""));
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ?? data.categories.find((item) => item.type === "expense")?.id ?? "",
  );
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);

  const account = data.accounts.find((item) => item.id === accountId);
  const categories = data.categories.filter((item) => item.type === type);
  const currentCategory = categories.find((item) => item.id === categoryId);
  const currency = account?.currency;
  const currencyName = currency === "KZT" ? "₸" : currency;

  function selectType(value: TransactionType) {
    if (value === type) return;
    setType(value);
    setCategoryId(data.categories.find((item) => item.type === value)?.id ?? "");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const date = String(new FormData(event.currentTarget).get("date") ?? "");
    const parsed = parseMoney(amount);
    if (!description.trim()) return setError("titleRequired");
    if (parsed === null || parsed <= 0) return setError("moneyPositive");
    if (!validDate(date) || date > data.today) return setError("datePast");
    if (!account) return setError("accountRequired");
    if (!currentCategory) return setError("categoryRequired");

    const now = new Date().toISOString();
    const next: Transaction = {
      id: transaction?.id ?? createRecordId(),
      accountId: account.id,
      categoryId: currentCategory.id,
      description: description.trim(),
      type, amount: parsed, date,
      createdAt: transaction?.createdAt ?? now,
      updatedAt: transaction && transaction.updatedAt > now ? transaction.updatedAt : now,
    };
    setPending(true);
    const failure = await save({ collection: "transactions", previous: transaction ?? undefined, next });
    setPending(false);
    if (failure) return setError(failure);
    onClose();
    notify(t(transaction ? "txUpdated" : "txAdded"));
  }

  return (
    <Modal open onClose={onClose} title={t(transaction ? "editTransaction" : "newTransaction")}>
      <form onSubmit={submit} className="form-stack">
        <div className="type-switch">
          {(["income", "expense"] as const).map((value) => (
            <button type="button" key={value}
              className={type === value ? `selected ${value === "expense" ? "expense-selected" : ""}` : ""}
              aria-pressed={type === value} onClick={() => selectType(value)}>
              <Icon name={value === "income" ? "down" : "up"} size={17}/>{t(value)}
            </button>
          ))}
        </div>
        <label>{t("transactionDescription")}
          <input required maxLength={80} placeholder={t("titlePlaceholder")} value={description}
            onChange={(event) => setDescription(event.target.value)}/>
        </label>
        <label>{t("account")}
          <select required value={account ? accountId : ""} onChange={(event) => setAccountId(event.target.value)}>
            <option value="" disabled>{t("accountRequired")}</option>
            {data.accounts.map((item) => (
              <option key={item.id} value={item.id}>{accountLabel(item)} · {item.currency}</option>
            ))}
          </select>
        </label>
        {!data.accounts.length && <Link className="text-link" href="/accounts" onClick={onClose}>{t("addAccount")}</Link>}
        {transaction && currency && currency !== accountCurrency(transaction.accountId) &&
          <p className="contribution-note">{t("transactionCurrencyChanged", { currency })}</p>}
        <label>{currencyName ? `${t("amount")}, ${currencyName}` : t("amount")}
          <input required inputMode="decimal" maxLength={15} placeholder={t("amountPlaceholder")} value={amount}
            onChange={(event) => setAmount(event.target.value)}/>
        </label>
        <div className="form-grid">
          <label>{t("category")}
            <select required value={currentCategory ? categoryId : ""} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="" disabled>{t("categoryRequired")}</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}
            </select>
          </label>
          <label>{t("date")}
            <input required type="date" name="date" max={data.today} defaultValue={transaction?.date ?? data.today}/>
          </label>
        </div>
        {!categories.length && <Link className="text-link" href="/categories" onClick={onClose}>{t("addCategory")}</Link>}
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" className="button button-primary" disabled={pending || !account || !currentCategory}>
            <Icon name="check" size={17}/>{t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
