"use client";

import { useState } from "react";
import { PageHeading } from "@/components/ui";
import { useI18n } from "@/components/i18n-provider";
import { InvestmentSimulator } from "@/components/investment-simulator";
import { parseMoney, money } from "@/lib/finance";
import { deposit } from "@/lib/simulation";

function DepositSimulator() {
  const [fields, setFields] = useState(["100000", "5000", "5", "3", "12"]);
  const [initial, contribution, rate, inflation, months] = fields;
  const result = fields.some(s => !s.trim()) ? null : deposit(
    parseMoney(initial) ?? -1, parseMoney(contribution) ?? -1, Number(rate), Number(inflation), Number(months)
  );
  const labels = ["Бастапқы сома (₸)", "Ай сайынғы жарна (₸)", "Болжамды жылдық мөлшерлеме (%)", "Болжамды жылдық инфляция (%)", "Мерзім (ай)"];
  return <section className="panel form-stack">
      {labels.map((label, i) => <label key={label}>{label}<input type={i < 2 ? "text" : "number"} inputMode="decimal"
        value={fields[i]} onChange={event => setFields(fields.map((v, j) => i === j ? event.target.value : v))}/></label>)}
      <p className="text-sm text-muted">Мерзім 1–120 ай. Мөлшерлеме мен инфляция 0–50%. Пайыз ай сайын есептеледі, жарна ай соңында қосылады.</p>
      {result ? <div aria-live="polite" className="space-y-3">
        <p>Соңғы сома <strong>{money(result.balance)}</strong></p>
        <p>Есептелген пайыз <strong>{money(result.interest)}</strong></p>
        <p>Бүгінгі ақшамен сатып алу қабілеті <strong>{money(result.purchasingPower)}</strong></p>
        <details><summary>Ай сайынғы өсім</summary><ol>{result.history.map((v, i) => <li key={i}><span>{i} ай · {money(v)}</span><progress className="w-full" aria-label={i + " ай"} value={v} max={Math.max(1, result.balance)}/></li>)}</ol></details>
      </div> : <p role="status">Сомаларды, мөлшерлемені және мерзімді тексеріңіз.</p>}
    </section>;
}

export default function SimulationPage() {
  const { t } = useI18n();
  const [active, setActive] = useState<"deposit" | "investment">("deposit");
  return <div className="space-y-7">
    <PageHeading title={t("simulations")} description={t("simOnly")} />
    <nav className="flex flex-wrap gap-2" aria-label={t("simulations")}>
      <button type="button" aria-pressed={active === "deposit"} className={active === "deposit" ? "button button-primary" : "button button-outline"} onClick={() => setActive("deposit")}>{t("simDeposit")}</button>
      <button type="button" aria-pressed={active === "investment"} className={active === "investment" ? "button button-primary" : "button button-outline"} onClick={() => setActive("investment")}>{t("simInvestment")}</button>
    </nav>
    <div hidden={active !== "deposit"}><DepositSimulator /></div>
    <div hidden={active !== "investment"}><InvestmentSimulator /></div>
  </div>;
}
