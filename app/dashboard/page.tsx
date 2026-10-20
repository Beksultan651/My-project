"use client";

import Link from "next/link";
import { useFinance } from "@/components/finance-provider";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeading, SectionLink, StatCards, TransactionList } from "@/components/ui";
import { categories, goalProgress, money, totals } from "@/lib/finance";

function recentMonths(today: string) {
  if (!today) return [];
  const [year, month] = today.split("-").map(Number);
  return Array.from({ length: 6 }, (_, i) => {
    const date = new Date(year, month - 6 + i, 1);
    return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat("kk-KZ", { month: "short" }).format(date) };
  });
}

export default function DashboardPage() {
  const { data } = useFinance();
  const stats = totals(data.transactions);
  const months = recentMonths(data.today).map((month) => ({ ...month, ...totals(data.transactions.filter((t) => t.date.startsWith(month.key))) }));
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const spending = categories.expense.map((category) => ({ category, value: data.transactions.filter((t) => t.type === "expense" && t.category === category).reduce((sum, t) => sum + t.amount, 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const transactions = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  return <div className="space-y-7"><PageHeading eyebrow="ҚАРЖЫЛЫҚ ШОЛУ" title="Қаржыңыз бақылауда" description="Баланс, ақша қозғалысы және мақсаттар — бәрі бір жерде."><Link className="button button-primary" href="/transactions"><Icon name="plus" size={18}/>Транзакция қосу</Link></PageHeading><StatCards {...stats}/>
    <div className="dashboard-chart-grid"><section className="panel"><div className="section-heading"><div><h2>Ақша қозғалысы</h2><p className="text-muted text-sm mt-1">Соңғы 6 айдағы кірістер мен шығыстар</p></div><span className="neutral-pill">6 ай</span></div><div className="chart-legend"><span><i className="legend-income"/>Кіріс</span><span><i className="legend-expense"/>Шығыс</span></div><div className="bar-chart" role="img" aria-label="Соңғы алты айдағы кіріс пен шығыс диаграммасы">{months.map((month) => <div className="chart-month" key={month.key}><div className="chart-bars"><div className="chart-bar income-bar" style={{ height: `${month.income / max * 100}%`, minHeight: month.income ? 4 : 2 }} title={`Кіріс: ${money(month.income)}`}/><div className="chart-bar expense-bar" style={{ height: `${month.expense / max * 100}%`, minHeight: month.expense ? 4 : 2 }} title={`Шығыс: ${money(month.expense)}`}/></div><span>{month.label}</span><span className="sr-only">Кіріс {money(month.income)}, шығыс {money(month.expense)}</span></div>)}</div>{data.transactions.length === 0 && <p className="chart-empty-note">Алғашқы транзакцияны қосқанда диаграмма жаңарады.</p>}</section>
    <section className="panel"><div className="section-heading"><h2>Шығыстар құрылымы</h2><Icon name="chart" size={20}/></div>{spending.length ? <div className="spending-list">{spending.map((item, i) => <div key={item.category}><div className="flex justify-between gap-3 text-sm"><span><i className={`category-dot category-${i % 4}`}/>{item.category}</span><strong>{money(item.value)}</strong></div><div className="progress-track"><span className={`category-${i % 4}`} style={{ width: `${item.value / stats.expense * 100}%` }}/></div><small>{Math.round(item.value / stats.expense * 100)}%</small></div>)}</div> : <EmptyState icon="chart" title="Әзірге шығыс жоқ" description="Шығыстарды қосып, қай санатқа қанша жұмсағаныңызды көріңіз."/>}</section></div>
    <div className="dashboard-bottom-grid"><section className="panel"><div className="section-heading"><h2>Соңғы транзакциялар</h2><SectionLink href="/transactions">Барлығын көру</SectionLink></div>{transactions.length ? <TransactionList transactions={transactions}/> : <EmptyState icon="exchange" title="Таза парақтан бастайық" description="Кірісіңізді немесе шығысыңызды жазып, қаржыңызды бақылауға алыңыз."><Link href="/transactions" className="button button-outline"><Icon name="plus" size={16}/>Алғашқы транзакция</Link></EmptyState>}</section><section className="panel"><div className="section-heading"><h2>Жинақ мақсаттары</h2><SectionLink href="/goals">Көру</SectionLink></div>{data.goals.length ? <div className="dashboard-goals">{data.goals.slice(0, 3).map((g) => <div key={g.id}><div className="flex justify-between gap-2"><strong>{g.title}</strong><span className="positive">{goalProgress(g)}%</span></div><div className="progress-track"><span style={{ width: `${goalProgress(g)}%` }}/></div><p>{money(g.saved)} <span className="text-muted">/ {money(g.target)}</span></p></div>)}</div> : <EmptyState icon="target" title="Арманға жоспар қажет" description="Бірінші мақсатыңызды құрып, жинағыңыздың өсуін бақылаңыз."><Link href="/goals" className="text-link">Мақсат құру<Icon name="arrow" size={16}/></Link></EmptyState>}</section></div>
  </div>;
}
