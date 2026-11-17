"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { useFinanceLabels } from "@/components/finance-labels";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { EmptyState, Modal, PageHeading } from "@/components/ui";
import { parseMoney, totals } from "@/lib/finance";
import { accountTypes, currencies } from "@/lib/finance-storage";
import { createRecordId } from "@/lib/record-id";
import type { MessageKey } from "@/lib/i18n";
import type { Account, Transaction } from "@/types/finance";

function AccountForm({ account, onClose }: { account: Account | null; onClose: () => void }) {
  const { data, save, notify } = useFinance();
  const { t } = useI18n();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<Account["type"]>(account?.type ?? "cash");
  const [currency, setCurrency] = useState<Account["currency"]>(account?.currency ?? "KZT");
  const [balance, setBalance] = useState(account ? (account.initialBalance / 100).toFixed(2) : "0");
  const [error, setError] = useState<MessageKey | null>(null);
  const [pending, setPending] = useState(false);
  const linked = account && data.transactions.some((item) => item.accountId === account.id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError("nameRequired");
    const initialBalance = parseMoney(balance);
    if (initialBalance === null) return setError("accountBalanceInvalid");

    const next: Account = {
      id: account?.id ?? createRecordId(), name: name.trim(), type, currency, initialBalance,
      createdAt: account?.createdAt ?? new Date().toISOString(),
    };
    setPending(true);
    const failure = await save({ collection: "accounts", previous: account ?? undefined, next });
    setPending(false);
    if (failure) return setError(failure);
    onClose();
    notify(t("accountSaved"));
  }

  return (
    <Modal open onClose={onClose} title={t(account ? "editAccount" : "addAccount")}>
      <form className="form-stack" onSubmit={submit}>
        <label>{t("accountName")}
          <input required maxLength={80} value={name} onChange={(event) => setName(event.target.value)}/>
        </label>
        <div className="form-grid">
          <label>{t("accountType")}
            <select value={type} onChange={(event) => {
              const selected = accountTypes.find((item) => item === event.target.value);
              if (selected) setType(selected);
            }}>
              {accountTypes.map((item) => <option key={item} value={item}>{t(item)}</option>)}
            </select>
          </label>
          <label>{t("currency")}
            <select value={currency} disabled={!!linked} onChange={(event) => {
              const selected = currencies.find((item) => item === event.target.value);
              if (selected) setCurrency(selected);
            }}>
              {currencies.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {linked && <p className="contribution-note">{t("accountInUse")}</p>}
        <label>{t("startingBalance")}
          <input required inputMode="decimal" maxLength={15} value={balance}
            onChange={(event) => setBalance(event.target.value)}/>
        </label>
        {error && <p className="form-error" role="alert">{t(error)}</p>}
        <div className="modal-actions">
          <button type="button" className="button button-outline" onClick={onClose}>{t("cancel")}</button>
          <button type="submit" disabled={pending} className="button button-primary">
            <Icon name="check" size={17}/>{t("save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function AccountsPage() {
  const { data } = useFinance();
  const { t, money } = useI18n();
  const { accountLabel } = useFinanceLabels();
  const [editor, setEditor] = useState<{ account: Account | null } | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);

  const byAccount = new Map<string, Transaction[]>();
  for (const transaction of data.transactions) {
    const list = byAccount.get(transaction.accountId);
    if (list) list.push(transaction);
    else byAccount.set(transaction.accountId, [transaction]);
  }

  return (
    <div className="space-y-7">
      <PageHeading title={t("accounts")} description={t("accountsSubtitle")}>
        <button className="button button-primary" disabled={!data.initialized} onClick={() => setEditor({ account: null })}>
          <Icon name="plus" size={18}/>{t("addAccount")}
        </button>
      </PageHeading>
      {!data.initialized ? <p className="panel loading-panel" role="status">{t("loading")}</p> : (
        data.accounts.length ? (
          <div className="goals-grid">
            {data.accounts.map((account) => {
              const name = accountLabel(account);
              const { balance, income, expense } = totals(byAccount.get(account.id) ?? [], account.initialBalance);
              return (
                <article className="panel goal-card" key={account.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="goal-icon mint"><Icon name="wallet" size={24}/></span>
                    <div className="flex gap-1">
                      <button className="icon-button" aria-label={t("namedAction", { action: t("editAccount"), name })}
                        onClick={() => setEditor({ account })}><Icon name="edit" size={17}/></button>
                      <button className="icon-button danger-button"
                        aria-label={t("namedAction", { action: t("deleteAccount"), name })}
                        onClick={() => setDeleting(account)}><Icon name="trash" size={17}/></button>
                    </div>
                  </div>
                  <h2>{name}</h2>
                  <p className="goal-deadline">{t(account.type)} · {account.currency}</p>
                  <dl className="ledger-details">
                    <div><dt>{t("currentBalance")}</dt><dd>{money(balance, account.currency)}</dd></div>
                    <div><dt>{t("startingBalance")}</dt><dd>{money(account.initialBalance, account.currency)}</dd></div>
                    <div><dt>{t("totalIncome")}</dt><dd>{money(income, account.currency)}</dd></div>
                    <div><dt>{t("totalExpense")}</dt><dd>{money(expense, account.currency)}</dd></div>
                  </dl>
                  <Link className="text-link" href={`/transactions?account=${encodeURIComponent(account.id)}`}>
                    {t("transactions")}<Icon name="arrow" size={17}/>
                  </Link>
                </article>
              );
            })}
          </div>
        ) : <section className="panel"><EmptyState icon="wallet" title={t("noAccounts")} description={t("noAccountsBody")}/></section>
      )}
      {editor && <AccountForm account={editor.account} onClose={() => setEditor(null)}/>}
      {deleting && <DeleteRecordDialog action={{ collection: "accounts", previous: deleting, next: null }}
        title="deleteAccount" done="accountDeleted" onClose={() => setDeleting(null)}>
        {t("deleteNamed", { name: accountLabel(deleting) })}
      </DeleteRecordDialog>}
    </div>
  );
}
