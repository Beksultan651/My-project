"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { useFinanceLabels } from "@/components/finance-labels";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeading, TransactionList } from "@/components/ui";
import { TransactionDialog, type TransactionEditor } from "@/components/transaction-dialog";
import { totals } from "@/lib/finance";
import { currencies } from "@/lib/finance-storage";
import { filterTransactions, type TransactionSort } from "@/lib/transactions";
import type { Transaction } from "@/types/finance";

const sorting = [
  { value: "newest", label: "newest" },
  { value: "oldest", label: "oldest" },
  { value: "amount-desc", label: "amountDesc" },
  { value: "amount-asc", label: "amountAsc" },
] as const;

function Transactions({ initialAccount }: { initialAccount: string }) {
  const { data, notify } = useFinance();
  const { t, money } = useI18n();
  const { accountCurrency, accountLabel, accountName, categoryLabel, categoryName } = useFinanceLabels();
  const [editor, setEditor] = useState<TransactionEditor | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [month, setMonth] = useState("");
  const [accountFilter, setAccountFilter] = useState(initialAccount);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sort, setSort] = useState<TransactionSort>("newest");
  const [deleting, setDeleting] = useState<Transaction | null>(null);

  const account = data.accounts.some((entry) => entry.id === accountFilter) ? accountFilter : "";
  const category = data.categories.some((entry) => entry.id === categoryFilter) ? categoryFilter : "";
  const filtered = filterTransactions(data.transactions, {
    query: search, type: filter, month, category, account, sort,
    accountLabel: accountName, categoryLabel: categoryName, accountCurrency,
  });
  const selectedCurrencies = currencies.filter((currency) => filtered.some((entry) => accountCurrency(entry.accountId) === currency));
  const summaryCurrencies = selectedCurrencies.length ? selectedCurrencies : [accountCurrency(account)];
  const filtersChanged = search || month || filter !== "all" || category || account || sort !== "newest";

  function resetFilters() {
    setSearch("");
    setMonth("");
    setFilter("all");
    setAccountFilter("");
    setCategoryFilter("");
    setSort("newest");
  }

  function exportCsv() {
    const safe = (value: string) => `"${(/^[=+\-@\t\r]/.test(value.trimStart()) ? "'" : "") + value.replaceAll('"', '""')}"`;
    const rows = [
      [t("date"), t("transactionDescription"), t("transactionType"), t("category"), t("amount"), t("account"), t("currency")],
      ...filtered.map((entry) => [
        entry.date, entry.description, t(entry.type), categoryName(entry.categoryId),
        (entry.amount / 100).toFixed(2), accountName(entry.accountId), accountCurrency(entry.accountId),
      ]),
    ];
    const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map((row) => row.map(safe).join(";")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `qarjy-${data.today}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(t("csvReady"));
  }

  return (
    <div className="space-y-7">
      <PageHeading title={t("transactions")} description={t("transactionsSubtitle")}>
        <button className="button button-outline" onClick={exportCsv} disabled={!filtered.length}>
          <Icon name="download" size={17}/>{t("exportCsv")}
        </button>
        <button className="button button-primary" onClick={() => setEditor({ transaction: null })} disabled={!data.initialized}>
          <Icon name="plus" size={18}/>{t("addTransaction")}
        </button>
      </PageHeading>
      <section className="panel transaction-panel">
        <div className="transaction-toolbar">
          <div className="filter-tabs" aria-label={t("transactionType")}>
            {([{ value: "all", label: "all" }, { value: "income", label: "incomes" }, { value: "expense", label: "expenses" }] as const).map(({ value, label }) => (
              <button key={value} className={filter === value ? "selected" : ""} aria-pressed={filter === value}
                onClick={() => setFilter(value)}>{t(label)}</button>
            ))}
          </div>
          <div className="transaction-filters">
            <label className="search-field"><Icon name="search" size={18}/>
              <input aria-label={t("searchTransactions")} placeholder={t("searchTransactions")} value={search}
                onChange={(event) => setSearch(event.target.value)}/>
            </label>
            <input className="month-filter" type="month" aria-label={t("monthFilter")} value={month}
              onChange={(event) => setMonth(event.target.value)}/>
            {filtersChanged && <button className="icon-button" aria-label={t("resetFilters")} onClick={resetFilters}>
              <Icon name="close" size={17}/>
            </button>}
          </div>
        </div>
        <div className="transaction-extra-filters ledger-filters">
          <div className="form-field">
            <label htmlFor="account-filter">{t("account")}</label>
            <select id="account-filter" value={account} onChange={(event) => setAccountFilter(event.target.value)}>
              <option value="">{t("allAccounts")}</option>
              {data.accounts.map((item) => <option key={item.id} value={item.id}>{accountLabel(item)} · {item.currency}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="category-filter">{t("category")}</label>
            <select id="category-filter" value={category} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">{t("allCategories")}</option>
              {data.categories.map((item) => <option key={item.id} value={item.id}>{categoryLabel(item)}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="transaction-sort">{t("sort")}</label>
            <select id="transaction-sort" value={sort} onChange={(event) => {
              const selected = sorting.find((item) => item.value === event.target.value);
              if (selected) setSort(selected.value);
            }}>
              {sorting.map(({ value, label }) => <option key={value} value={value}>{t(label)}</option>)}
            </select>
          </div>
        </div>
        <div className="ledger-links">
          <Link className="text-link" href="/accounts">{t("accounts")}<Icon name="arrow" size={15}/></Link>
          <Link className="text-link" href="/categories">{t("categories")}<Icon name="arrow" size={15}/></Link>
        </div>
        {!data.initialized ? <div className="loading-panel" role="status">{t("loading")}</div> : (
          <>
            <div className="transaction-summary" role="status">
              <span>{t("operationCount", { count: filtered.length })}</span>
              {summaryCurrencies.map((currency) => {
                const stats = totals(filtered.filter((entry) => accountCurrency(entry.accountId) === currency));
                return <span key={currency}>
                  {t("income")}: <strong className="positive">{money(stats.income, currency)}</strong>
                  <span className="ledger-summary-separator">·</span>
                  {t("expense")}: <strong>{money(stats.expense, currency)}</strong>
                </span>;
              })}
            </div>
            {filtered.length ? <TransactionList transactions={filtered} onDelete={setDeleting}
              onEdit={(transaction) => setEditor({ transaction })}/> : (
              <EmptyState icon="exchange" title={t(data.transactions.length ? "noMatchTitle" : "noTransactionsTitle")}
                description={t(data.transactions.length ? "noMatchBody" : "noTransactionsBody")}>
                {!data.transactions.length && <button className="button button-primary"
                  onClick={() => setEditor({ transaction: null })}><Icon name="plus" size={17}/>{t("addTransaction")}</button>}
              </EmptyState>
            )}
          </>
        )}
      </section>
      {editor && <TransactionDialog transaction={editor.transaction} initialAccountId={account} onClose={() => setEditor(null)}/>}
      {deleting && <DeleteRecordDialog action={{ collection: "transactions", previous: deleting, next: null }}
        title="deleteTransaction" done="txDeleted" onClose={() => setDeleting(null)}>
        {t("deleteTransactionPrompt", { title: deleting.description, amount: money(deleting.amount, accountCurrency(deleting.accountId)) })}
      </DeleteRecordDialog>}
    </div>
  );
}

function TransactionsRoute() {
  const account = useSearchParams().get("account") ?? "";
  return <Transactions key={account} initialAccount={account}/>;
}

export default function TransactionsPage() {
  const { t } = useI18n();
  return <Suspense fallback={<p className="panel loading-panel" role="status">{t("loading")}</p>}>
    <TransactionsRoute/>
  </Suspense>;
}
