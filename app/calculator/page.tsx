"use client";

import { useState, type FormEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { Icon } from "@/components/icons";
import { PageHeading } from "@/components/ui";
import { money, parseMoney, type Budget } from "@/lib/finance";

const fields: { key: keyof Budget; label: string; icon: string; placeholder: string }[] = [
  { key: "income", label: "Айлық кіріс", icon: "down", placeholder: "Мысалы, 300000" },
  { key: "housing", label: "Тұрғын үй және коммуналдық төлемдер", icon: "home", placeholder: "0" },
  { key: "food", label: "Азық-түлік", icon: "bag", placeholder: "0" },
  { key: "transport", label: "Көлік", icon: "exchange", placeholder: "0" },
  { key: "other", label: "Басқа шығындар", icon: "wallet", placeholder: "0" },
];

function CalculatorForm() {
  const { data, update, notify } = useFinance();
  const [draft, setDraft] = useState<Budget>(data.budget);
  const [error, setError] = useState("");
  const values = Object.fromEntries(fields.map(({ key }) => [key, draft[key] === "" ? 0 : parseMoney(draft[key]) ?? 0])) as Record<keyof Budget, number>;
  const expense = values.housing + values.food + values.transport + values.other;
  const balance = values.income - expense;
  const ratio = values.income ? Math.max(0, Math.round(balance / values.income * 100)) : 0;
  const needs = Math.round(values.income * .5);
  const wants = Math.round(values.income * .3);
  const savings = values.income - needs - wants;
  function calculate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fields.some(({ key }) => draft[key] !== "" && parseMoney(draft[key]) === null)) return setError("Сомаларды дұрыс енгізіңіз: теріс сансыз, үтірден кейін 2 таңбаға дейін.");
    if (values.income <= 0) return setError("Нөлден үлкен айлық кірісті енгізіңіз.");
    setError(""); update((s) => ({ ...s, budget: draft })); notify("Бюджет есептелді және сақталды");
  }
  function fromTransactions() {
    const current = data.transactions.filter((t) => t.date.startsWith(data.today.slice(0, 7)));
    const sum = (type: "income" | "expense", category?: string) => current.filter((t) => t.type === type && (!category || t.category === category)).reduce((s, t) => s + t.amount, 0);
    const housing = sum("expense", "Тұрғын үй"), food = sum("expense", "Азық-түлік"), transport = sum("expense", "Көлік");
    const toText = (n: number) => (n / 100).toFixed(2);
    setDraft({ income: toText(sum("income")), housing: toText(housing), food: toText(food), transport: toText(transport), other: toText(sum("expense") - housing - food - transport) });
    setError(""); notify("Осы айдың транзакциялары алынды");
  }
  return <><div className="calculator-grid"><section className="panel"><div className="section-heading"><h2>Айлық жоспарыңыз</h2><span className="neutral-pill">KZT · ₸</span></div><form onSubmit={calculate} className="form-stack calculator-form">{fields.map(({ key, label, icon, placeholder }, i) => <label key={key} className={i === 1 ? "expense-field-start" : ""}><span className="flex items-center gap-2"><Icon name={icon} size={17}/>{label}</span><div className="currency-input"><input inputMode="decimal" placeholder={placeholder} maxLength={15} value={draft[key]} onChange={(e) => setDraft((s) => ({ ...s, [key]: e.target.value }))} aria-label={label}/><span>₸</span></div></label>)}{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary w-full" type="submit"><Icon name="calculator" size={18}/>Есептеу және сақтау</button><button className="text-link self-center" type="button" onClick={fromTransactions}><Icon name="exchange" size={16}/>Осы айдың транзакцияларынан алу</button></form></section><div className="space-y-6"><section className={`budget-result ${balance < 0 ? "budget-negative" : ""}`}><span className="result-icon"><Icon name="wallet" size={25}/></span><p className="result-label">Еркін қаражатыңыз</p><strong className="result-value">{money(balance)}</strong><p className="result-caption">{values.income === 0 ? "Кірісіңізді енгізіп, жоспарыңызды көріңіз." : balance < 0 ? "Шығыстар кірістен көп. Жоспарды қайта қарап көріңіз." : "Мақсаттарыңыз бен жинаққа бөлуге болатын сома."}</p><div className="result-divider"/><div className="result-details"><div><span>Жалпы кіріс</span><strong>{money(values.income)}</strong></div><div><span>Жалпы шығыс</span><strong>{money(expense)}</strong></div><div><span>Бос қаражат үлесі</span><strong>{ratio}%</strong></div></div></section><section className="calculator-tip"><Icon name="spark" size={23}/><div><h3>Алдымен жоспар, содан кейін қадам</h3><p>Сандарды өзгертіп, әр шығынның бюджетіңізге қалай әсер ететінін көріңіз. «Есептеу және сақтау» батырмасы жоспарыңызды сақтайды.</p></div></section></div></div><section className="panel rule-panel"><div className="section-heading"><div><p className="eyebrow">ЖОСПАРЛАУҒА АРНАЛҒАН ҮЛГІ</p><h2>50 / 30 / 20 қағидасы</h2><p className="text-muted text-sm mt-2">Бұл — мысал. Өз жағдайыңызға қарай үлестерді өзгертуге болады.</p></div><Icon name="chart" size={27}/></div><div className="rule-grid">{[{ percent: "50%", title: "Қажеттіліктер", note: "Тұрғын үй, азық-түлік, көлік", value: needs, color: "mint" }, { percent: "30%", title: "Қалаулар", note: "Демалыс, хобби, сыйлықтар", value: wants, color: "peach" }, { percent: "20%", title: "Жинақ және міндеттемелер", note: "Мақсаттар, қор, қарыз төлемдері", value: savings, color: "lilac" }].map((item) => <div className={`rule-card ${item.color}`} key={item.percent}><span>{item.percent}</span><h3>{item.title}</h3><p>{item.note}</p><strong>{money(item.value)}</strong></div>)}</div></section></>;
}

export default function CalculatorPage() {
  const { data } = useFinance();
  return <div className="space-y-7"><PageHeading eyebrow="САНАЛЫ ЖОСПАР" title="Бюджет калькуляторы" description="Кіріс пен шығысты салыстырып, мүмкіндігіңізді алдын ала бағалаңыз."/>{data.initialized ? <CalculatorForm/> : <div className="panel loading-panel" role="status">Сақталған жоспар жүктелуде…</div>}</div>;
}
