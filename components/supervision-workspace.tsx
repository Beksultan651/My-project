"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/ui";
import { LearningWorkspace } from "@/components/learning-workspace";
import { createRecordId } from "@/lib/record-id";

type Operation = {
  date: string;
  amount: number;
  type: string;
  description: string;
  category: string;
  currency: string;
};
type Row = {
  id: string;
  name: string;
  active: boolean;
  permissions: string[];
  grants: { date: string; amount: number; note: string }[];
  operations: Operation[];
  goals: { name: string; saved: number; target: number }[];
  budget: number | null;
};
type Payload = {
  registered: number;
  isAdmin: boolean;
  admins: { id: string; username: string }[];
  rows: Row[];
  messages: {
    id: string;
    studentId: string;
    adminId: string;
    fromAdmin: boolean;
    body: string;
    readAt: string | null;
    createdAt: string;
    advice: boolean;
  }[];
};
const money = (n: number) =>
  new Intl.NumberFormat("kk-KZ", { maximumFractionDigits: 2 }).format(n / 100) +
  " ₸";
const sum = (rows: { amount: number }[]) =>
  rows.reduce((s, x) => s + x.amount, 0);
const expenses = (r: Row) =>
  r.operations.filter((x) => x.type === "expense" && x.currency === "KZT");
const today = () => new Date().toLocaleDateString("sv-SE");
const panels = [
  "Шолу",
  "Пайдаланушылар",
  "Тапсырмалар",
  "Қаржы профилі",
  "Қаражат",
  "Аналитика",
  "Хабарламалар",
  "Есептер",
] as const;
function exportCsv(rows: string[][]) {
  const csv = rows
    .map((row) =>
      row
        .map(
          (value) =>
            '"' +
            (/^[=+@\-\t\r]/.test(value) ? "'" : "") +
            value.replaceAll('"', '""') +
            '"',
        )
        .join(";"),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "qarjy-report.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function SupervisionPage() {
  const [data, setData] = useState<Payload | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [directoryScope, setDirectoryScope] = useState<"all" | "consent">("all");
  const [panel, setPanel] = useState<string>("Шолу"),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(false),
    [selected, setSelected] = useState("");
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [category, setCategory] = useState(""),
    [period, setPeriod] = useState("month");
  const [note, setNote] = useState(""),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(today),
    [message, setMessage] = useState(""),
    [advice, setAdvice] = useState(false);
  const retry = useRef({ signature: "", key: "" }),
    inFlight = useRef(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const r = await fetch("/api/supervision", { cache: "no-store", signal });
      if (!r.ok) throw Error();
      const result = await r.json();
      if (!signal?.aborted) {
        setData(result);
        setError("");
      }
    } catch {
      if (!signal?.aborted)
        setError("Деректерді жүктеу мүмкін болмады. Қайталап көріңіз.");
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const first = setTimeout(() => void refresh(controller.signal), 0);
    const timer = setInterval(() => void refresh(controller.signal), 30000);
    return () => {
      controller.abort();
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh]);
  async function send(body: Record<string, unknown>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/supervision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw Error();
      await refresh();
      return true;
    } catch {
      setError(
        "Әрекет сақталмады. Рұқсат пен енгізілген деректерді тексеріңіз.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="panel" role="status">
        {error || "Жүктелуде…"}{" "}
        {error && <button onClick={() => void refresh()}>Қайталау</button>}
      </section>
    );
  const learningView = panel === "Пайдаланушылар" || panel === "Тапсырмалар";
  const admin = data.isAdmin,
    visible = data.rows.filter(
      (r) =>
        r.name.toLowerCase().includes(search.toLowerCase()) &&
        (!active || r.active),
    );
  const peers = admin
    ? visible.map((r) => ({ id: r.id, username: r.name }))
    : data.admins;
  const peer = peers.find((p) => p.id === selected)?.id ?? peers[0]?.id ?? "";
  const person = admin ? visible.find((r) => r.id === peer) : data.rows[0];
  const rows = admin ? visible : data.rows,
    granted = rows.reduce((n, r) => n + sum(r.grants), 0),
    spent = rows.reduce((n, r) => n + sum(expenses(r)), 0);
  const ops = rows.flatMap((r) =>
    expenses(r).map((x) => ({ ...x, user: r.name })),
  );
  const filtered = ops.filter(
    (x) =>
      (!from || x.date >= from) &&
      (!to || x.date <= to) &&
      (!category || category === x.category),
  );
  const groups = new Map<string, number>(),
    times = new Map<string, number>();
  for (const op of filtered) {
    groups.set(op.category, (groups.get(op.category) ?? 0) + op.amount);
    let key = op.date;
    if (period === "month") key = key.slice(0, 7);
    if (period === "week") {
      const d = new Date(key + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
      key = d.toISOString().slice(0, 10);
    }
    times.set(key, (times.get(key) ?? 0) + op.amount);
  }
  const chat = data.messages.filter(
      (m) => (admin ? m.studentId : m.adminId) === peer,
    ),
    unread = data.messages.filter(
      (m) => !m.readAt && m.fromAdmin !== admin,
    ).length;
  const linked = admin ? !!person : !!person?.permissions.includes(peer);
  async function report(target: Row[]) {
    if (
      admin &&
      !(await send({
        action: "export",
        peer: target.length === 1 ? target[0].id : "",
        scope: target.map((r) => r.id),
      }))
    )
      return;
    exportCsv([
      ["Пайдаланушы", "Бөлінді (₸)", "Шығын (₸)", "Қалдық (₸)"],
      ...target.map((r) => {
        const g = sum(r.grants),
          s = sum(expenses(r));
        return [
          r.name,
          String(g / 100),
          String(s / 100),
          String((g - s) / 100),
        ];
      }),
    ]);
  }
  function bars(values: Map<string, number>) {
    const max = Math.max(1, ...values.values());
    return values.size ? (
      <dl className="space-y-3">
        {[...values]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>
                {money(value)}{" "}
                <progress
                  className="w-full accent-green-600"
                  max={max}
                  value={value}
                />
              </dd>
            </div>
          ))}
      </dl>
    ) : (
      <p>Таңдалған кезеңде шығын жоқ.</p>
    );
  }
  return (
    <div className="space-y-5">
      <PageHeading
        title={admin ? "Әкімші панелі" : "Менің оқу кабинетім"}
        description="Виртуалды қаражат және пайдаланушы енгізген оқу операциялары. Сомалар теңгемен есептеледі."
      />
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {unread > 0 && (
        <button
          className="button button-outline"
          onClick={() => {
            const m = data.messages.find(
              (m) => !m.readAt && m.fromAdmin !== admin,
            );
            if (m) {
              setSearch("");
              setActive(false);
              setSelected(admin ? m.studentId : m.adminId);
            }
            setPanel("Хабарламалар");
          }}
        >
          Жаңа хабарламалар: {unread}
        </button>
      )}
      <div className="grid gap-5 md:grid-cols-[12rem_minmax(0,1fr)]">
        <nav
          className="panel flex flex-wrap gap-2 md:flex-col md:self-start"
          aria-label="Кабинет бөлімдері"
        >
          {panels
            .filter((p) => admin || (p !== "Пайдаланушылар" && p !== "Қаржы профилі"))
            .map((p) => (
              <button
                key={p}
                className={
                  panel === p
                    ? "button button-primary"
                    : "button button-outline"
                }
                onClick={() => {
                  if (p === "Пайдаланушылар") setDirectoryScope("all");
                  setPanel(p);
                }}
              >
                {p}
              </button>
            ))}
        </nav>
        {learningView ? (
          <section className="min-w-0 space-y-4">
            <h2>{panel === "Тапсырмалар" ? "Тапсырмалар менеджері" : panel}</h2>
            <LearningWorkspace key={panel + directoryScope} admin={admin} view={panel === "Пайдаланушылар" ? "people" : "tasks"}
              consentIds={new Set(data.rows.map((row) => row.id))} initialScope={directoryScope} />
          </section>
        ) : <section className="panel space-y-4">
          <h2>{panel}</h2>
          {admin && panel !== "Шолу" && (
            <div className="form-stack">
              <label>
                Аты бойынша іздеу
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />{" "}
                Белсенді сессиясы барлар
              </label>
            </div>
          )}
          {(!admin ||
            ["Қаржы профилі", "Қаражат", "Хабарламалар", "Есептер"].includes(
              panel,
            )) && (
            <label className="form-stack">
              {admin ? "Пайдаланушы" : "Әкімші"}
              <select
                value={peer}
                onChange={(e) => setSelected(e.target.value)}
              >
                {!peers.length && <option value="">Тізім бос</option>}
                {peers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.username}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!admin && peer && panel === "Шолу" && (
            <div>
              <p>
                Рұқсат берген әкімші шот операцияларын, бюджет пен мақсаттарды
                көріп, виртуалды қаражат және хабарлама жібере алады.
              </p>
              <button
                className="button button-outline"
                disabled={busy}
                onClick={() =>
                  void send({ action: "permission", peer, active: !linked })
                }
              >
                {linked ? "Рұқсатты қайтарып алу" : "Осы әкімшіге рұқсат беру"}
              </button>
            </div>
          )}
          {admin && !rows.length && (
            <p>Сүзгіге сәйкес рұқсат берген пайдаланушылар жоқ.</p>
          )}
          {panel === "Шолу" && (
            <>
              {admin && <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" className="panel text-left hover:border-current" onClick={() => { setDirectoryScope("all"); setPanel("Пайдаланушылар"); }}>
                  <small>Тіркелген пайдаланушылар</small>
                  <h3>{data.registered}</h3>
                  <span className="text-link">Толық тізімді ашу</span>
                </button>
                <button type="button" className="panel text-left hover:border-current" onClick={() => { setDirectoryScope("consent"); setPanel("Пайдаланушылар"); }}>
                  <small>Бақылаудағы пайдаланушылар</small>
                  <h3>{data.rows.length}</h3>
                  <span className="text-link">Рұқсат бергендерді ашу</span>
                </button>
              </div>}
              <div className="grid gap-3 sm:grid-cols-2">
                {(admin
                  ? [
                      [
                        "Белсенді сессиясы барлар",
                        rows.filter((x) => x.active).length,
                      ],
                    ]
                  : []
                )
                  .concat([
                    ["Бөлінген виртуалды қаражат", money(granted)],
                    ["Енгізілген шығын", money(spent)],
                    ["Бөлінген қаражаттан қалғаны", money(granted - spent)],
                  ])
                  .map(([label, value]) => (
                    <div className="panel" key={label}>
                      <small>{label}</small>
                      <h3>{value}</h3>
                    </div>
                  ))}
              </div>
              {rows.map((r) => {
                const g = sum(r.grants),
                  s = sum(expenses(r)),
                  monthly = sum(
                    expenses(r).filter((x) =>
                      x.date.startsWith(today().slice(0, 7)),
                    ),
                  );
                return (
                  <div key={r.id}>
                    {r.budget !== null && monthly > r.budget && (
                      <p>
                        {r.name} · Айлық шығын жоспардан{" "}
                        {money(monthly - r.budget)} асты.
                      </p>
                    )}
                    {g > 0 && g - s <= g * 0.1 && (
                      <p>
                        {r.name} · Виртуалды қалдық бастапқы қаражаттың 10%-ына
                        немесе одан төмен түсті.
                      </p>
                    )}
                  </div>
                );
              })}
              <h3>Санаттар бойынша шығын</h3>
              {bars(groups)}
            </>
          )}
          {panel === "Қаржы профилі" && person && (
            <>
              <h3>{person.name}</h3>
              <p>
                Бөлінді: {money(sum(person.grants))} · Шығын:{" "}
                {money(sum(expenses(person)))} · Қалдық:{" "}
                {money(sum(person.grants) - sum(expenses(person)))}
              </p>
              <h3>Жинақ мақсаттары</h3>
              {person.goals.length ? (
                person.goals.map((g, i) => (
                  <p key={i}>
                    {g.name} · {Math.round((g.saved / g.target) * 100)}%
                  </p>
                ))
              ) : (
                <p>Мақсат жоқ.</p>
              )}
              <h3>Операциялар тарихы</h3>
              {person.operations.length ? (
                person.operations.map((x, i) => (
                  <p key={i}>
                    {x.date} · {x.description} ·{" "}
                    {x.type === "expense" ? "−" : "+"}
                    {(x.amount / 100).toLocaleString("kk-KZ")} {x.currency}
                  </p>
                ))
              ) : (
                <p>Операция жоқ.</p>
              )}
            </>
          )}
          {panel === "Қаражат" && person && (
            <>
              {admin && (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const signature = JSON.stringify([
                      peer,
                      amount,
                      date,
                      note,
                    ]);
                    if (retry.current.signature !== signature)
                      retry.current = { signature, key: createRecordId() };
                    if (
                      await send({
                        action: "grant",
                        peer,
                        amount,
                        date,
                        note,
                        key: retry.current.key,
                      })
                    ) {
                      retry.current.signature = "";
                      setAmount("");
                      setNote("");
                    }
                  }}
                >
                  <label>
                    Сома, ₸
                    <input
                      required
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                    />
                  </label>
                  <label>
                    Күн
                    <input
                      required
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </label>
                  <label>
                    Түсініктеме
                    <input
                      required
                      maxLength={2000}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  <button className="button button-primary" disabled={busy}>
                    Виртуалды қаражат бөлу
                  </button>
                </form>
              )}
              <h3>Бөлу тарихы</h3>
              {person.grants.length ? (
                person.grants.map((g, i) => (
                  <p key={i}>
                    {g.date} · {money(g.amount)} · {g.note}
                  </p>
                ))
              ) : (
                <p>Қаражат әлі бөлінбеген.</p>
              )}
            </>
          )}
          {panel === "Аналитика" && (
            <>
              <div className="form-stack">
                <label>
                  Басталуы
                  <input
                    type="date"
                    value={from}
                    max={to || undefined}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                </label>
                <label>
                  Аяқталуы
                  <input
                    type="date"
                    value={to}
                    min={from || undefined}
                    onChange={(e) => setTo(e.target.value)}
                  />
                </label>
                <label>
                  Санат
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">Барлығы</option>
                    {[...new Set(ops.map((x) => x.category))].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Кезең
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    <option value="day">Күн</option>
                    <option value="week">Апта</option>
                    <option value="month">Ай</option>
                  </select>
                </label>
              </div>
              <h3>Кезең бойынша</h3>
              {bars(times)}
              <h3>Санат бойынша</h3>
              {bars(groups)}
            </>
          )}
          {panel === "Хабарламалар" && (
            <>
              {chat.map((m) => (
                <article key={m.id} className="border-b py-2">
                  <small>
                    {m.fromAdmin ? "Әкімші" : "Пайдаланушы"} ·{" "}
                    {m.advice ? "Қаржылық кеңес · " : ""}
                    {m.readAt ? "Оқылды" : "Оқылмаған"}
                  </small>
                  <p className="whitespace-pre-wrap break-words">{m.body}</p>
                </article>
              ))}
              {!chat.length && <p>Хабарлама жоқ.</p>}
              {linked &&
                chat.some((m) => !m.readAt && m.fromAdmin !== admin) && (
                  <button
                    className="button button-outline"
                    disabled={busy}
                    onClick={() => void send({ action: "read", peer })}
                  >
                    Оқылды деп белгілеу
                  </button>
                )}
              {linked && (
                <form
                  className="form-stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (
                      await send({
                        action: "message",
                        peer,
                        note: message,
                        advice,
                      })
                    )
                      setMessage("");
                  }}
                >
                  <label>
                    Хабарлама
                    <textarea
                      required
                      maxLength={2000}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </label>
                  {admin && (
                    <label>
                      <input
                        type="checkbox"
                        checked={advice}
                        onChange={(e) => setAdvice(e.target.checked)}
                      />{" "}
                      Қаржылық кеңес
                    </label>
                  )}
                  <button
                    className="button button-primary"
                    disabled={busy || !message.trim()}
                  >
                    Жіберу
                  </button>
                </form>
              )}
            </>
          )}
          {panel === "Есептер" && (
            <div className="flex flex-wrap gap-2">
              <button
                className="button button-outline"
                disabled={!person}
                onClick={() => person && report([person])}
              >
                Жеке есеп · CSV
              </button>
              {admin && (
                <button
                  className="button button-outline"
                  onClick={() => report(rows)}
                >
                  Жалпы есеп · CSV
                </button>
              )}
            </div>
          )}
        </section>}
      </div>
    </div>
  );
}
