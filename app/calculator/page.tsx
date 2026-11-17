"use client";

import { useState, type FormEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { PageHeading } from "@/components/ui";
import { parseMoney } from "@/lib/finance";
import { currencyLedger } from "@/lib/finance-records";
import type { Budget } from "@/types/finance";
import type { MessageKey } from "@/lib/i18n";

const fields: { key: keyof Budget; label: MessageKey; icon: string }[] = [{ key: "income", label: "monthlyIncome", icon: "down" }, { key: "housing", label: "housing", icon: "home" }, { key: "food", label: "food", icon: "bag" }, { key: "transport", label: "transport", icon: "exchange" }, { key: "other", label: "otherExpenses", icon: "wallet" }];

function CalculatorForm() {
  const { data, update, notify } = useFinance();
  const { t, money } = useI18n();
  const [draft, setDraft] = useState<Budget>(data.budget);
  const [error, setError] = useState<MessageKey | null>(null);
  const values = Object.fromEntries(fields.map(({ key }) => [key, draft[key] === "" ? 0 : parseMoney(draft[key]) ?? 0])) as Record<keyof Budget, number>;
  const expense = values.housing + values.food + values.transport + values.other;
  const balance = values.income - expense;
  const ratio = values.income ? Math.max(0, Math.round(balance / values.income * 100)) : 0;
  const needs = Math.round(values.income * .5), wants = Math.round(values.income * .3), savings = values.income - needs - wants;
  async function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fields.some(({ key }) => draft[key] !== "" && parseMoney(draft[key]) === null)) return setError("budgetMoneyError");
    if (values.income <= 0) return setError("budgetIncomeError");
    setError(null);
    if (await update((state) => ({ ...state, budget: draft }))) notify(t("budgetSaved"));
  }
  function fromTransactions() {
    const current = currencyLedger(data, "KZT").transactions.filter((item) => item.date.startsWith(data.today.slice(0, 7)));
    const sum = (type: "income" | "expense", category?: string) => current.filter((item) => item.type === type && (!category || item.categoryId === category)).reduce((total, item) => total + item.amount, 0);
    const housing = sum("expense", "housing"), food = sum("expense", "food"), transport = sum("expense", "transport");
    const text = (value: number) => (value / 100).toFixed(2);
    setDraft({ income: text(sum("income")), housing: text(housing), food: text(food), transport: text(transport), other: text(sum("expense") - housing - food - transport) });
    setError(null); notify(t("importedTransactions"));
  }
  const ruleCards = [{ percent: "50%", title: "ruleNeeds", note: "ruleNeedsNote", value: needs, color: "mint" }, { percent: "30%", title: "ruleWants", note: "ruleWantsNote", value: wants, color: "peach" }, { percent: "20%", title: "ruleSavings", note: "ruleSavingsNote", value: savings, color: "lilac" }] as const;
  return <><div className="calculator-grid"><section className="panel"><div className="section-heading"><h2>{t("monthlyPlan")}</h2><span className="neutral-pill">KZT · ₸</span></div><form onSubmit={calculate} className="form-stack calculator-form">{fields.map(({ key, label, icon }, index) => <label key={key} className={index === 1 ? "expense-field-start" : ""}><span className="flex items-center gap-2"><Icon name={icon} size={17}/>{t(label)}</span><div className="currency-input"><input inputMode="decimal" placeholder={t("amountPlaceholder")} maxLength={15} value={draft[key]} onChange={(event) => setDraft((state) => ({ ...state, [key]: event.target.value }))} aria-label={t(label)}/><span>₸</span></div></label>)}{error && <p className="form-error" role="alert">{t(error)}</p>}<button className="button button-primary w-full" type="submit"><Icon name="calculator" size={18}/>{t("calculateSave")}</button><button className="text-link self-center" type="button" onClick={fromTransactions}><Icon name="exchange" size={16}/>{t("useThisMonth")}</button><p className="text-muted text-xs">{t("calculatorCurrency")}</p></form></section>
      <section className={`budget-result ${balance < 0 ? "budget-negative" : ""}`}><span className="result-icon"><Icon name="wallet" size={25}/></span><p className="result-label">{t("freeMoney")}</p><strong className="result-value">{money(balance)}</strong><p className="result-caption">{t(values.income === 0 ? "emptyBudget" : balance < 0 ? "insufficientBudget" : "availableForSavings")}</p><div className="result-divider"/><div className="result-details"><div><span>{t("totalIncome")}</span><strong>{money(values.income)}</strong></div><div><span>{t("totalExpense")}</span><strong>{money(expense)}</strong></div><div><span>{t("availableShare")}</span><strong>{ratio}%</strong></div></div></section></div>
    <section className="panel rule-panel"><div className="section-heading"><div><h2>{t("ruleTitle")}</h2><p className="text-muted text-sm mt-2">{t("ruleNote")}</p></div><Icon name="chart" size={27}/></div><div className="rule-grid">{ruleCards.map((item) => <div className={`rule-card ${item.color}`} key={item.percent}><span>{item.percent}</span><h3>{t(item.title)}</h3><p>{t(item.note)}</p><strong>{money(item.value)}</strong></div>)}</div></section>
  </>;
}
export default function CalculatorPage() {
  const { data } = useFinance(); const { t } = useI18n();
  return <div className="space-y-7"><PageHeading title={t("calculator")} description={t("calculatorSubtitle")}/>{data.initialized ? <CalculatorForm/> : <div className="panel loading-panel" role="status">{t("loading")}</div>}</div>;
}
