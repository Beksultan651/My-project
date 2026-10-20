"use client";

import { useState, type FormEvent } from "react";
import { useFinance } from "@/components/finance-provider";
import { Icon } from "@/components/icons";
import { EmptyState, Modal, PageHeading } from "@/components/ui";
import { displayDate, goalProgress, money, parseMoney, validDate, type Goal } from "@/lib/finance";

export default function GoalsPage() {
  const { data, update, notify } = useFinance();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [saved, setSaved] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [adding, setAdding] = useState<Goal | null>(null);
  const [contribution, setContribution] = useState("");
  const [deleting, setDeleting] = useState<Goal | null>(null);
  const savedTotal = data.goals.reduce((s, g) => s + g.saved, 0);
  const targetTotal = data.goals.reduce((s, g) => s + g.target, 0);
  const completed = data.goals.filter((g) => g.saved >= g.target).length;
  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedTarget = parseMoney(target), parsedSaved = saved === "" ? 0 : parseMoney(saved);
    if (!title.trim()) return setError("Мақсат атауын енгізіңіз.");
    if (parsedTarget === null || parsedTarget <= 0 || parsedSaved === null) return setError("Мақсат сомасы нөлден үлкен, ал жинақ теріс емес болуы керек. Үтірден кейін 2 таңбаға дейін рұқсат.");
    if (parsedSaved > parsedTarget) return setError("Бастапқы жинақ мақсат сомасынан аспауы керек.");
    if (deadline && (!validDate(deadline) || deadline < data.today)) return setError("Мақсат мерзімі бүгіннен ерте болмауы керек.");
    if (data.goals.length >= 100) return setError("100 мақсат шегіне жеттіңіз. Алдымен қажетсіз мақсатты жойыңыз.");
    update((s) => ({ ...s, goals: [...s.goals, { id: crypto.randomUUID(), title: title.trim(), target: parsedTarget, saved: parsedSaved, deadline }] }));
    setOpen(false); notify("Жаңа мақсат құрылды");
  }
  function contribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adding) return;
    const current = data.goals.find((g) => g.id === adding.id);
    if (!current) { setAdding(null); return; }
    const amount = parseMoney(contribution);
    if (amount === null || amount <= 0) return setError("Нөлден үлкен, дұрыс соманы енгізіңіз.");
    if (amount > current.target - current.saved) return setError(`Қалған сома: ${money(current.target - current.saved)}. Осы сомадан асырмаңыз.`);
    update((s) => ({ ...s, goals: s.goals.map((g) => g.id === current.id ? { ...g, saved: g.saved + amount } : g) }));
    setAdding(null); notify(current.saved + amount === current.target ? "Құттықтаймыз! Мақсатыңыз орындалды!" : "Жинақ сомасы толықтырылды");
  }
  const start = () => { setTitle(""); setTarget(""); setSaved(""); setDeadline(""); setError(""); setOpen(true); };
  return <div className="space-y-7"><PageHeading eyebrow="АРМАННАН НАҚТЫ ҚАДАМҒА" title="Жинақ мақсаттары" description="Маңызды нәрсеге жинаңыз. Әр қадамды көріп, алға жылжыңыз."><button className="button button-primary" onClick={start} disabled={!data.initialized}><Icon name="plus" size={18}/>Жаңа мақсат</button></PageHeading><section className="goals-overview"><div><span className="soft-icon mint"><Icon name="target" size={24}/></span><div><p>Жалпы жинақ</p><strong>{money(savedTotal)}</strong></div></div><div><p>Барлық мақсат сомасы</p><strong>{money(targetTotal)}</strong></div><div><p>Орындалған мақсаттар</p><strong>{completed} <span>/ {data.goals.length}</span></strong></div></section>
    {data.goals.length ? <div className="goals-grid">{data.goals.map((goal, i) => { const progress = goalProgress(goal), complete = goal.saved === goal.target; return <article key={goal.id} className="panel goal-card"><div className="flex justify-between items-center"><span className={`goal-icon ${["mint", "peach", "lilac", "butter"][i % 4]}`}><Icon name={complete ? "check" : "target"} size={25}/></span><button className="icon-button danger-button" aria-label={`${goal.title} мақсатын жою`} onClick={() => setDeleting(goal)}><Icon name="trash" size={17}/></button></div><h2>{goal.title}</h2><p className="goal-deadline"><Icon name="clock" size={15}/>{goal.deadline ? `${displayDate(goal.deadline, true)}${!complete && goal.deadline < data.today ? " · Мерзімі өтті" : ""}` : "Мерзімі белгіленбеген"}</p><div className="goal-amount"><strong>{money(goal.saved)}</strong><span>/ {money(goal.target)}</span></div><div className="progress-track"><span style={{ width: `${progress}%` }}/></div><div className="goal-progress-caption"><span>{complete ? "Мақсат орындалды!" : `Қалды: ${money(goal.target - goal.saved)}`}</span><strong>{progress}%</strong></div><button className={`button w-full ${complete ? "button-complete" : "button-outline"}`} disabled={complete} onClick={() => { setAdding(goal); setContribution(""); setError(""); }}><Icon name={complete ? "check" : "plus"} size={17}/>{complete ? "Керемет нәтиже!" : "Жинақты толықтыру"}</button></article>; })}</div> : <section className="panel goals-empty"><EmptyState icon="target" title="Үлкен арманға алғашқы қадам" description="Жаңа ноутбук, саяхат немесе қауіпсіздік қоры. Бір мақсат таңдап, жинауды бүгін бастаңыз."><button className="button button-primary" onClick={start} disabled={!data.initialized}><Icon name="plus" size={18}/>Алғашқы мақсатты құру</button></EmptyState><div className="goal-suggestions"><span>Шабыт үшін:</span>{["Қауіпсіздік қоры", "Жаңа ноутбук", "Саяхат"].map((name) => <button key={name} onClick={() => { start(); setTitle(name); }} disabled={!data.initialized}>{name}<Icon name="plus" size={14}/></button>)}</div></section>}
    <p className="info-note"><Icon name="spark" size={19}/><span>Бұл — жинақ есебі. Мақсатқа қосылған сома банкке аударылмайды және транзакциялар балансын өзгертпейді.</span></p>
    <Modal open={open} onClose={() => setOpen(false)} title="Жаңа жинақ мақсаты" description="Арманыңызды нақты жоспарға айналдырыңыз."><form className="form-stack" onSubmit={create}><label>Мақсат атауы<input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Мысалы, жаңа ноутбук" maxLength={80}/></label><label>Қажетті сома, ₸<input required inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="0,00" maxLength={15}/></label><label>Қазірдің өзінде жиналған сома, ₸<input inputMode="decimal" value={saved} onChange={(e) => setSaved(e.target.value)} placeholder="0" maxLength={15}/></label><label>Мақсат мерзімі <span className="optional">(міндетті емес)</span><input type="date" min={data.today} value={deadline} onChange={(e) => setDeadline(e.target.value)}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setOpen(false)}>Бас тарту</button><button className="button button-primary" type="submit">Мақсат құру<Icon name="arrow" size={17}/></button></div></form></Modal>
    <Modal open={!!adding} onClose={() => setAdding(null)} title="Жинақты толықтыру" description={adding?.title}><form className="form-stack" onSubmit={contribute}><p className="contribution-note">Қажетті қалдық: <strong>{money(adding ? adding.target - adding.saved : 0)}</strong></p><label>Қосылатын сома, ₸<input required inputMode="decimal" value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="0,00" maxLength={15}/></label>{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setAdding(null)}>Бас тарту</button><button className="button button-primary" type="submit"><Icon name="plus" size={17}/>Толықтыру</button></div></form></Modal>
    <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Мақсатты жою" description="Мақсат пен оның жинақ есебі өшіріледі."><p className="delete-description">«{deleting?.title}» мақсатын жою керек пе?</p><div className="modal-actions"><button className="button button-outline" onClick={() => setDeleting(null)}>Бас тарту</button><button className="button button-danger" onClick={() => { if (!deleting) return; update((s) => ({ ...s, goals: s.goals.filter((g) => g.id !== deleting.id) })); setDeleting(null); notify("Мақсат жойылды"); }}><Icon name="trash" size={17}/>Жою</button></div></Modal>
  </div>;
}
