"use client";

import { useState } from "react";
import { parseMoney } from "@/lib/finance";
import { investmentScenario, scenarios, type Scenario } from "@/lib/simulation";
import { useI18n } from "./i18n-provider";

const labels = { positive: "simPositive", neutral: "simNeutral", negative: "simNegative" } as const;

export function InvestmentSimulator() {
  const { t, money } = useI18n();
  const [initial, setInitial] = useState("100000");
  const [monthly, setMonthly] = useState("5000");
  const [stocks, setStocks] = useState("60");
  const [months, setMonths] = useState("12");
  const [scenario, setScenario] = useState<Scenario>("neutral");
  const allocation = stocks.trim() ? Number(stocks) : -1;
  const duration = Number(months);
  const values = scenarios.map((key) => ({
    key,
    outcome: investmentScenario(parseMoney(initial) ?? -1, parseMoney(monthly) ?? -1, allocation, duration, key),
  }));
  const current = values.find(({ key }) => key === scenario)?.outcome;

  return <section className="panel form-stack space-y-3">
    <h2>{t("simInvestment")}</h2>
    <p className="text-muted">{t("simInstrumentHelp")}</p>
    <p className="text-muted">{t("simSynthetic")}</p>
    <div className="form-grid">
      <label>{t("simInitial")}<input inputMode="decimal" value={initial} onChange={(event) => setInitial(event.target.value)} /></label>
      <label>{t("simContribution")}<input inputMode="decimal" value={monthly} onChange={(event) => setMonthly(event.target.value)} /></label>
      <label>{t("simStockPercent")}<input type="number" min={0} max={100} step={1} value={stocks} onChange={(event) => setStocks(event.target.value)} /></label>
      <label>{t("simMonths")}<input type="number" min={1} max={120} step={1} value={months} onChange={(event) => setMonths(event.target.value)} /></label>
    </div>
    {Number.isInteger(allocation) && allocation >= 0 && allocation <= 100 && <p>{t("simBondPercent", { percent: 100 - allocation })}</p>}
    {current ? <>
      <div className="flex flex-wrap gap-2">
        {values.map(({ key, outcome }) => outcome && <button key={key} type="button" className={key === scenario ? "button button-primary" : "button button-outline"}
          aria-pressed={key === scenario} onClick={() => setScenario(key)}>
          {t(labels[key])} · {money(outcome.balance)}
        </button>)}
      </div>
      <dl className="form-grid" aria-live="polite">
        <div><dt>{t("simFinal")}</dt><dd><strong>{money(current.balance)}</strong></dd></div>
        <div><dt>{t("simPaid")}</dt><dd>{money(current.paid)}</dd></div>
        <div><dt>{t("simProfit")}</dt><dd className={current.profit < 0 ? "form-error" : ""}>{money(current.profit)}</dd></div>
        <div><dt>{t("simStocks")} / {t("simBonds")}</dt><dd>{money(current.stocks)} / {money(current.bonds)}</dd></div>
      </dl>
      <details>
        <summary>{t("simTrend")}</summary>
        <ol className="space-y-2">
          {current.history.map((value, month) => <li key={month}>
            <p>{t("simMonthLabel", { month })} · {money(value)}</p>
            <progress className="w-full accent-green-600" aria-label={t("simMonthLabel", { month })} value={value} max={Math.max(1, ...current.history)} />
          </li>)}
        </ol>
      </details>
    </> : <p role="status" className="form-error">{t("simInvalid")}</p>}
  </section>;
}
