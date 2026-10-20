"use client";

import { useState, type FormEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { Icon } from "@/components/icons";
import { EmptyState, Modal, PageHeading, TransactionList } from "@/components/ui";
import { categories, money, parseMoney, totals, validDate, type Transaction } from "@/lib/finance";

export default function TransactionsPage() {
  const { data, update, notify } = useFinance();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(categories.expense[0]);
  const [date, setDate] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState("");
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const filtered = data.transactions.filter((t) => (filter === "all" || t.type === filter) && (!month || t.date.startsWith(month)) && `${t.title} ${t.category}`.toLocaleLowerCase("kk").includes(search.toLocaleLowerCase("kk"))).sort((a, b) => b.date.localeCompare(a.date));
  const stats = totals(filtered);
  function start() { setTitle(""); setAmount(""); setDate(data.today); setError(""); setOpen(true); }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseMoney(amount);
    if (!title.trim()) return setError("Транзакция атауын енгізіңіз.");
    if (parsed === null || parsed <= 0) return setError("Нөлден үлкен соманы енгізіңіз. Үтірден кейін 2 таңбаға дейін рұқсат.");
    if (!validDate(date) || date > data.today) return setError("Бүгінгі немесе өткен күнді таңдаңыз.");
    if (data.transactions.length >= 10000) return setError("Транзакциялар санының шегіне жеттіңіз (10 000). Алдымен CSV көшірмесін жүктеп, қажетсіз жазбаларды жойыңыз.");
    const transaction: Transaction = { id: crypto.randomUUID(), title: title.trim(), type, amount: parsed, category, date };
    update((s) => ({ ...s, transactions: [transaction, ...s.transactions] }));
    setOpen(false); notify("Транзакция қосылды");
  }
  function exportCsv() {
    const safe = (text: string) => `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
    const rows = [["Күні", "Атауы", "Түрі", "Санаты", "Сома (₸)"], ...filtered.map((t) => [t.date, t.title, t.type === "income" ? "Кіріс" : "Шығыс", t.category, (t.amount / 100).toFixed(2)])];
    const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map((r) => r.map(safe).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `qarjy-${data.today}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); notify("CSV файлы дайын");
  }
  return <div className="space-y-7"><PageHeading eyebrow="КҮНДЕЛІКТІ ҚАРЖЫ" title="Кірістер мен шығыстар" description="Әр транзакцияны жазып, ақшаңыздың қозғалысын түсініңіз."><button className="button button-outline" onClick={exportCsv} disabled={!filtered.length}><Icon name="download" size={17}/>CSV жүктеу</button><button className="button button-primary" onClick={start} disabled={!data.initialized}><Icon name="plus" size={18}/>Транзакция қосу</button></PageHeading>
    <section className="panel transaction-panel"><div className="transaction-toolbar"><div className="filter-tabs" aria-label="Транзакция түрі">{[{ value: "all", label: "Барлығы" }, { value: "income", label: "Кірістер" }, { value: "expense", label: "Шығыстар" }].map((f) => <button key={f.value} className={filter === f.value ? "selected" : ""} onClick={() => setFilter(f.value)} aria-pressed={filter === f.value}>{f.label}</button>)}</div><div className="transaction-filters"><label className="search-field"><Icon name="search" size={18}/><input aria-label="Транзакция іздеу" placeholder="Транзакция іздеу..." value={search} onChange={(e) => setSearch(e.target.value)}/></label><input className="month-filter" type="month" aria-label="Ай бойынша сүзу" value={month} onChange={(e) => setMonth(e.target.value)}/>{(search || month || filter !== "all") && <button className="icon-button" aria-label="Сүзгілерді тазалау" title="Сүзгілерді тазалау" onClick={() => { setSearch(""); setMonth(""); setFilter("all"); }}><Icon name="close" size={17}/></button>}</div></div><div className="transaction-summary"><span>{filtered.length} транзакция</span><span>Кіріс: <strong className="positive">{money(stats.income)}</strong></span><span>Шығыс: <strong>{money(stats.expense)}</strong></span></div>{filtered.length ? <TransactionList transactions={filtered} onDelete={setDeleting}/> : <EmptyState icon="exchange" title={data.transactions.length ? "Транзакция табылмады" : "Алғашқы жазбаңызды қосыңыз"} description={data.transactions.length ? "Іздеу мәтінін немесе сүзгілерді өзгертіп көріңіз." : "Жалақы, күнделікті сатып алу немесе қосымша табыс — бәрін осы жерде есепке алыңыз."}>{!data.transactions.length && <button className="button button-primary" onClick={start} disabled={!data.initialized}><Icon name="plus" size={17}/>Транзакция қосу</button>}</EmptyState>}</section><p className="privacy-line"><Icon name="lock" size={15}/>Деректер банкке қосылмайды, тек осы құрылғыдағы браузерде сақталады.</p>
    <Modal open={open} onClose={() => setOpen(false)} title="Жаңа транзакция" description="Қаржыңыздың әр қадамын есепке алыңыз."><form onSubmit={submit} className="form-stack"><div className="type-switch"><button type="button" className={type === "income" ? "selected" : ""} onClick={() => { setType("income"); setCategory(categories.income[0]); }} aria-pressed={type === "income"}><Icon name="down" size={17}/>Кіріс</button><button type="button" className={type === "expense" ? "selected expense-selected" : ""} onClick={() => { setType("expense"); setCategory(categories.expense[0]); }} aria-pressed={type === "expense"}><Icon name="up" size={17}/>Шығыс</button></div><label>Атауы<input required maxLength={80} placeholder="Мысалы, айлық жалақы" value={title} onChange={(e) => setTitle(e.target.value)}/></label><label>Сома, ₸<input required inputMode="decimal" placeholder="0,00" value={amount} onChange={(e) => setAmount(e.target.value)} maxLength={15}/></label><div className="form-grid"><label>Санаты<select value={category} onChange={(e) => setCategory(e.target.value)}>{categories[type].map((c) => <option key={c}>{c}</option>)}</select></label><label>Күні<input type="date" required max={data.today} value={date} onChange={(e) => setDate(e.target.value)}/></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Бас тарту</button><button type="submit" className="button button-primary"><Icon name="check" size={17}/>Сақтау</button></div></form></Modal>
    <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Транзакцияны жою" description="Бұл әрекетті кері қайтару мүмкін емес."><p className="delete-description">«{deleting?.title}» — {money(deleting?.amount ?? 0)} транзакциясын жою керек пе?</p><div className="modal-actions"><button className="button button-outline" onClick={() => setDeleting(null)}>Бас тарту</button><button className="button button-danger" onClick={() => { if (!deleting) return; update((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== deleting.id) })); setDeleting(null); notify("Транзакция жойылды"); }}><Icon name="trash" size={17}/>Жою</button></div></Modal>
  </div>;
}
