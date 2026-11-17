"use client";

import Link from "next/link";
import { useState } from "react";
import { CurrencySelect, useReportingCurrency } from "@/components/currency-select";
import { useFinanceLabels } from "@/components/finance-labels";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { TransactionDialog, type TransactionEditor } from "@/components/transaction-dialog";
import { EmptyState, PageHeading, SectionLink, StatCards, TransactionList } from "@/components/ui";
import { goalProgress, totals } from "@/lib/finance";
import { currencyLedger } from "@/lib/finance-records";
import { shortMonths } from "@/lib/i18n";

export default function DashboardPage() {
  const { data } = useFinance();
  const { t, locale, money } = useI18n();
  const { categoryName } = useFinanceLabels();
  const reporting = useReportingCurrency(data.accounts);
  const { currency } = reporting;
  const [editor, setEditor] = useState<TransactionEditor | null>(null);
  const ledger = currencyLedger(data, currency);
  const stats = totals(ledger.transactions, ledger.initialBalance);
  const [year, month] = data.today.split("-").map(Number);
  const months = data.today ? Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, month - 6 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return {
      key, label: shortMonths[locale][date.getMonth()],
      ...totals(ledger.transactions.filter((item) => item.date.startsWith(key))),
    };
  }) : [];
  const max = Math.max(1, ...months.flatMap((item) => [item.income, item.expense]));
  const spendByCategory = new Map<string, number>();
  for (const item of ledger.transactions) {
    if (item.type === "expense") {
      spendByCategory.set(item.categoryId, (spendByCategory.get(item.categoryId) ?? 0) + item.amount);
    }
  }
  const spending = [...spendByCategory].sort(([, a], [, b]) => b - a);
  const transactions = [...ledger.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const initialAccountId = data.accounts.find((account) => account.currency === currency)?.id;

  return (
    <div className="space-y-7">
      <PageHeading title={t("dashboardTitle")} description={t("dashboardSubtitle")}>
        <CurrencySelect {...reporting}/>
        <button className="button button-primary" disabled={!data.initialized} onClick={() => setEditor({ transaction: null })}>
          <Icon name="plus" size={18}/>{t("addTransaction")}
        </button>
      </PageHeading>
      {!data.initialized ? <p className="panel loading-panel" role="status">{t("loading")}</p> : (
        <>
          <StatCards {...stats} currency={currency}/>
          <div className="dashboard-chart-grid">
            <section className="panel">
              <div className="section-heading">
                <div><h2>{t("cashFlow")}</h2><p className="text-muted text-sm mt-1">{t("flowDescription")}</p></div>
                <span className="neutral-pill">{t("sixMonths")}</span>
              </div>
              <div className="chart-legend">
                <span><i className="legend-income"/>{t("income")}</span>
                <span><i className="legend-expense"/>{t("expense")}</span>
              </div>
              <div className="bar-chart" role="group" aria-label={t("flowDescription")}>
                {months.map((item) => (
                  <div className="chart-month" key={item.key}>
                    <div className="chart-bars">
                      <div className="chart-bar income-bar" style={{ height: `${item.income / max * 100}%`, minHeight: item.income ? 4 : 2 }}
                        title={`${t("income")}: ${money(item.income, currency)}`}/>
                      <div className="chart-bar expense-bar" style={{ height: `${item.expense / max * 100}%`, minHeight: item.expense ? 4 : 2 }}
                        title={`${t("expense")}: ${money(item.expense, currency)}`}/>
                    </div>
                    <span>{item.label}</span>
                    <span className="sr-only">{t("income")} {money(item.income, currency)}, {t("expense")} {money(item.expense, currency)}</span>
                  </div>
                ))}
              </div>
              {!ledger.transactions.length && <p className="chart-empty-note">{t("noChartData")}</p>}
            </section>
            <section className="panel">
              <div className="section-heading"><h2>{t("expensesStructure")}</h2><Icon name="chart"/></div>
              {spending.length ? <div className="spending-list">
                {spending.map(([id, value], index) => {
                  const percent = value / stats.expense * 100;
                  return <div key={id}>
                    <div className="flex justify-between gap-3 text-sm">
                      <span><i className={`category-dot category-${index % 4}`}/>{categoryName(id)}</span>
                      <strong>{money(value, currency)}</strong>
                    </div>
                    <div className="progress-track"><span className={`category-${index % 4}`} style={{ width: `${percent}%` }}/></div>
                    <small>{Math.round(percent)}%</small>
                  </div>;
                })}
              </div> : <EmptyState icon="chart" title={t("noExpensesTitle")} description={t("noExpensesBody")}/>}
            </section>
          </div>
          <div className="dashboard-bottom-grid">
            <section className="panel">
              <div className="section-heading"><h2>{t("recentTransactions")}</h2><SectionLink href="/transactions">{t("viewAll")}</SectionLink></div>
              {transactions.length ? <TransactionList transactions={transactions} onEdit={(transaction) => setEditor({ transaction })}/> : (
                <EmptyState icon="exchange" title={t("noTransactionsTitle")} description={t("noTransactionsBody")}>
                  <button className="button button-outline" onClick={() => setEditor({ transaction: null })}>
                    <Icon name="plus" size={16}/>{t("firstTransaction")}
                  </button>
                </EmptyState>
              )}
            </section>
            <section className="panel">
              <div className="section-heading"><h2>{t("goals")}</h2><SectionLink href="/goals">{t("view")}</SectionLink></div>
              {data.goals.length ? <div className="dashboard-goals">
                {data.goals.slice(0, 3).map((goal) => {
                  const progress = goalProgress(goal);
                  return <div key={goal.id}>
                    <div className="flex justify-between gap-2"><strong>{goal.name}</strong><span className="positive">{progress}%</span></div>
                    <div className="progress-track"><span style={{ width: `${progress}%` }}/></div>
                    <p>{money(goal.savedAmount)} <span className="text-muted">/ {money(goal.targetAmount)}</span></p>
                  </div>;
                })}
              </div> : <EmptyState icon="target" title={t("goalFirstTitle")} description={t("goalFirstBody")}>
                <Link href="/goals" className="text-link">{t("viewGoals")}<Icon name="arrow" size={16}/></Link>
              </EmptyState>}
            </section>
          </div>
        </>
      )}
      {editor && <TransactionDialog transaction={editor.transaction} initialAccountId={initialAccountId} onClose={() => setEditor(null)}/>}
    </div>
  );
}
