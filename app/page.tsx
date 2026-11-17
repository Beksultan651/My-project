"use client";

import Link from "next/link";
import { useState } from "react";
import { CurrencySelect, useReportingCurrency } from "@/components/currency-select";
import { currencyLedger } from "@/lib/finance-records";
import { useFinance } from "@/components/finance-provider";
import { useI18n } from "@/components/i18n-provider";
import { Icon } from "@/components/icons";
import { EmptyState, PageHeading, SectionLink, StatCards, TransactionList } from "@/components/ui";
import { TransactionDialog, type TransactionEditor } from "@/components/transaction-dialog";
import { goalProgress, lessons, totals } from "@/lib/finance";
import { localizeLessons } from "@/lib/lesson-translations";

export default function Home() {
  const { data } = useFinance();
  const { t, locale, money } = useI18n();
  const [editor, setEditor] = useState<TransactionEditor | null>(null);
  const reporting = useReportingCurrency(data.accounts);
  const ledger = currencyLedger(data, reporting.currency);
  const stats = totals(ledger.transactions, ledger.initialBalance);
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const steps = [
    { title: t("stepTransaction"), body: t("stepTransactionBody"), href: "/transactions", done: data.transactions.length > 0 },
    { title: t("stepGoal"), body: t("stepGoalBody"), href: "/goals", done: data.goals.length > 0 },
    { title: t("stepLesson"), body: t("stepLessonBody"), href: "/learn", done: data.completedLessons.length > 0 },
  ];
  const done = steps.filter((step) => step.done).length;
  const localizedLessons = localizeLessons(lessons, locale);
  const nextLesson = localizedLessons.find((lesson) => !data.completedLessons.includes(lesson.id)) ?? localizedLessons[0];
  return <div className="space-y-7">
    <PageHeading title={t("homeTitle")} description={t("homeSubtitle")}><button className="button button-primary" disabled={!data.initialized} onClick={() => setEditor({ transaction: null })}><Icon name="plus" size={18}/>{t("addTransaction")}</button></PageHeading>
    <section className="hero-card"><div className="hero-copy"><span className="hero-tag"><span/>{t("heroTag")}</span><h2>{t("heroTitle1")}<br/><span>{t("heroTitle2")}</span></h2><p>{t("heroDescription")}</p><div className="hero-actions"><Link href="/calculator" className="button button-lime">{t("planBudget")}<Icon name="arrow" size={18}/></Link><Link href="/learn" className="hero-secondary"><Icon name="book" size={18}/>{t("learnNow")}</Link></div></div>
      <div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="art-dot art-dot-one"/><div className="art-dot art-dot-two"/><div className="growth-card"><span className="growth-label"><span className="growth-icon"><Icon name="chart" size={20}/></span>{t("growthLabel")}</span><strong>{t("growthTitle1")}<br/>{t("growthTitle2")}</strong><svg viewBox="0 0 245 110" className="growth-chart"><defs><linearGradient id="growth-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8dbb6d" stopOpacity=".35"/><stop offset="1" stopColor="#8dbb6d" stopOpacity="0"/></linearGradient></defs><path d="M5 92C28 92 29 72 53 75S86 91 105 62 132 79 154 47 178 57 197 28 217 40 240 9V110H5Z" fill="url(#growth-fill)"/><path d="M5 92C28 92 29 72 53 75S86 91 105 62 132 79 154 47 178 57 197 28 217 40 240 9" fill="none" stroke="#6b9f50" strokeWidth="3" strokeLinecap="round"/><circle cx="240" cy="9" r="5" fill="#254d3d"/></svg><div className="growth-caption">{t("knowledge")}<span>{t("habit")}</span>{t("result")}</div></div><div className="floating-check"><span><Icon name="check" size={18}/></span><div><strong>{t("todayStep")}</strong><small>{t("growthLabel")}</small></div></div><span className="art-spark">✳</span></div>
    </section>
    {!data.initialized ? <p className="panel loading-panel" role="status">{t("loading")}</p> : <>
    <div><div className="section-heading"><h2>{t("financialSnapshot")}</h2><div className="ledger-links"><CurrencySelect {...reporting}/><SectionLink href="/dashboard">{t("fullOverview")}</SectionLink></div></div><StatCards {...stats} currency={reporting.currency}/></div>
    <div className="dashboard-bottom-grid home-live-grid">
      <section className="panel"><div className="section-heading"><h2>{t("recentTransactions")}</h2><SectionLink href="/transactions">{t("viewAll")}</SectionLink></div>{!data.initialized ? <p className="loading-panel" role="status">{t("loading")}</p> : recent.length ? <TransactionList transactions={recent} onEdit={(transaction) => setEditor({ transaction })}/> : <EmptyState icon="exchange" title={t("noTransactionsTitle")} description={t("noTransactionsBody")}><button className="button button-outline" onClick={() => setEditor({ transaction: null })}><Icon name="plus" size={17}/>{t("firstTransaction")}</button></EmptyState>}</section>
      <section className="panel home-goals-live"><div className="section-heading"><h2>{t("goals")}</h2><SectionLink href="/goals">{t("view")}</SectionLink></div>{data.goals.length ? <div className="dashboard-goals">{data.goals.slice(0, 3).map((goal) => <Link href="/goals" className="home-goal-link" key={goal.id}><div className="flex justify-between gap-3"><strong>{goal.name}</strong><span className="positive">{goalProgress(goal)}%</span></div><div className="progress-track"><span style={{ width: `${goalProgress(goal)}%` }}/></div><p>{money(goal.savedAmount)} <span className="text-muted">/ {money(goal.targetAmount)}</span></p></Link>)}</div> : <EmptyState icon="target" title={t("goalFirstTitle")} description={t("goalFirstBody")}><Link href="/goals" className="button button-outline">{t("viewGoals")}<Icon name="arrow" size={17}/></Link></EmptyState>}</section>
    </div>
    <div className="home-bottom-grid"><section className="panel first-steps"><div className="section-heading"><h2>{t("firstSteps")}</h2><span className="count-badge">{done} / 3</span></div><div className="progress-track"><span style={{ width: `${done / 3 * 100}%` }}/></div><div className="step-list">{steps.map((step, index) => <Link href={step.href} key={step.href} className={`step-item ${step.done ? "complete" : ""}`}><span className="step-number">{step.done ? <Icon name="check" size={17}/> : String(index + 1).padStart(2,"0")}</span><div><h3>{step.title}</h3><p>{step.body}</p></div><Icon name="chevron" size={17}/></Link>)}</div></section><section className="featured-lesson"><div className="flex items-center justify-between"><span className="lesson-tag"><Icon name="book" size={14}/>{t("todayLesson")}</span><span className="featured-flower" aria-hidden="true">✳</span></div><h2>{nextLesson.title}</h2><p>{nextLesson.description}</p><div className="featured-bottom"><span><Icon name="clock" size={15}/>{nextLesson.duration}</span><Link href={`/learn#${nextLesson.id}`} className="round-link" aria-label={t("readLesson")}><Icon name="arrow" size={20}/></Link></div></section></div>
    </>}
    {editor && <TransactionDialog transaction={editor.transaction} onClose={() => setEditor(null)}/>}
  </div>;
}
