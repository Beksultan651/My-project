"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Modal } from "./ui";

type Person = {
  id: string;
  username: string;
  fullName: string | null;
  status: "ACTIVE" | "PENDING" | "REJECTED" | "BLOCKED" | "ARCHIVED" | "DEMO";
  createdAt: string | null;
};
type Task = { id: string; assigneeId: string | null; body: string; completed: boolean; createdAt: string };
type Data = { tasks: Task[]; people?: Person[]; demo?: { createdAt: string } | null };
type Draft = { id?: string; assigneeId: string | null; body: string; completed: boolean };
type TaskFilter = "all" | "done" | "todo";
type Sort = "new" | "old" | "name";
type Scope = "all" | "consent" | "demo";

const statuses: Record<Person["status"], string> = {
  ACTIVE: "Белсенді", PENDING: "Күтуде", REJECTED: "Қабылданбаған",
  BLOCKED: "Бұғатталған", ARCHIVED: "Мұрағатта", DEMO: "Сынақ профилі",
};
const named = (person: Person) => person.fullName || person.username;
const assigneeKey = (id: string | null) => id === null ? "demo" : "user:" + id;
const personKey = (person: Person) => assigneeKey(person.status === "DEMO" ? null : person.id);
const formatDate = (date: string | null) => date ? new Intl.DateTimeFormat("kk-KZ", { dateStyle: "medium" }).format(new Date(date)) : "—";
const freshDraft = (assigneeId: string | null): Draft => ({ assigneeId, body: "", completed: false });

function listTasks(tasks: Task[], status: TaskFilter, sort: Sort) {
  return tasks.filter((task) => status === "all" || task.completed === (status === "done")).sort((a, b) => {
    if (sort === "name") return a.body.localeCompare(b.body, "kk");
    return sort === "old" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt);
  });
}

function StatusFilters({ value, change }: { value: TaskFilter; change: (filter: TaskFilter) => void }) {
  return <div className="learning-tools" aria-label="Тапсырма мәртебесі">
    {([["all", "Барлығы"], ["done", "Орындалды"], ["todo", "Орындалмады"]] as const).map(([key, label]) =>
      <button key={key} type="button" aria-pressed={value === key} className={value === key ? "button button-primary" : "button button-outline"} onClick={() => change(key)}>{label}</button>)}
  </div>;
}

function SortSelect({ value, change }: { value: Sort; change: (sort: Sort) => void }) {
  return <label>Сұрыптау
    <select value={value} onChange={(event) => change(event.target.value as Sort)}>
      <option value="new">Жаңа тапсырмалар алдымен</option>
      <option value="old">Ескі тапсырмалар алдымен</option>
      <option value="name">Мәтін бойынша</option>
    </select>
  </label>;
}

export function LearningWorkspace({ admin, view, consentIds, initialScope }: {
  admin: boolean;
  view: "people" | "tasks";
  consentIds: Set<string>;
  initialScope: Scope;
}) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [personQuery, setPersonQuery] = useState("");
  const [scope, setScope] = useState<Scope>(initialScope);
  const [search, setSearch] = useState("");
  const [assignee, setAssignee] = useState("");
  const [sort, setSort] = useState<Sort>("new");
  const [status, setStatus] = useState<TaskFilter>("all");
  const [detail, setDetail] = useState("");
  const [detailStatus, setDetailStatus] = useState<TaskFilter>("all");
  const [detailSort, setDetailSort] = useState<Sort>("new");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [remove, setRemove] = useState<Task | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/learning-tasks", { cache: "no-store", signal });
      if (!response.ok) throw new Error();
      const result: Data = await response.json();
      if (signal?.aborted) return;
      setData(result);
      setError("");
    } catch {
      if (!signal?.aborted) setError("Деректерді жүктеу мүмкін болмады.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const task = setTimeout(() => void refresh(controller.signal), 0);
    return () => { clearTimeout(task); controller.abort(); };
  }, [refresh]);

  async function change(method: string, body: object, message: string) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/learning-tasks", {
        method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(response.status === 404 ? "Жазба табылмады. Тізімді жаңартыңыз." : "Өзгерісті сақтау мүмкін болмады.");
      setNotice(message);
      await refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Өзгерісті сақтау мүмкін болмады.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const people = [...(data?.people ?? [])];
  if (data?.demo) people.push({ id: "demo", fullName: "Айша Демо", username: "demo-qarjy", status: "DEMO", createdAt: data.demo.createdAt });
  const tasks = data?.tasks ?? [];
  const peopleById = new Map(people.map((person) => [personKey(person), person]));
  const profile = peopleById.get(detail);
  const completed = tasks.filter((task) => task.completed).length;
  const shown = listTasks(tasks.filter((task) =>
    task.body.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) &&
    (!assignee || assigneeKey(task.assigneeId) === assignee)), status, sort);
  const profileTasks = tasks.filter((task) => assigneeKey(task.assigneeId) === detail);
  const found = people.filter((person) =>
    (named(person) + " " + person.username).toLocaleLowerCase().includes(personQuery.trim().toLocaleLowerCase()) &&
    (scope === "all" || (scope === "demo" ? person.status === "DEMO" : consentIds.has(person.id))));

  function openProfile(person: Person) {
    setDetail(personKey(person));
    setDetailStatus("all");
    setDetailSort("new");
  }

  async function save(event: FormEvent, entry: Draft) {
    event.preventDefault();
    if (await change(entry.id ? "PATCH" : "POST", entry, "Тапсырма сақталды.")) setDraft(null);
  }

  function taskRows(items: Task[], showPerson: boolean) {
    if (!items.length) return <p className="learning-muted">Тапсырма табылмады.</p>;
    return <ul className="learning-task-list">
      {items.map((task) => {
        const person = peopleById.get(assigneeKey(task.assigneeId));
        return <li key={task.id} className="learning-task-row">
          <label className="learning-check">
            <input type="checkbox" checked={task.completed} disabled={busy}
              onChange={(event) => void change("PATCH", { action: "complete", id: task.id, completed: event.target.checked }, "Мәртебе сақталды.")}
              aria-label={task.body + " · орындалды"} />
          </label>
          <div className="learning-task-body">
            <p className={task.completed ? "learning-task-done" : ""}>{task.body}</p>
            <div className="learning-tools">
              <span className={task.completed ? "learning-pill learning-done" : "learning-pill learning-pending"}>{task.completed ? "Орындалды" : "Орындалмады"}</span>
              {showPerson && person && <button className="learning-person-link" type="button" onClick={() => openProfile(person)}>@{person.username}</button>}
            </div>
          </div>
          {admin && <div className="learning-tools">
            <button className="button button-outline" type="button" disabled={busy} onClick={() => { setError(""); setDraft(task); }}>Өңдеу</button>
            <button className="button learning-delete" type="button" disabled={busy} onClick={() => { setError(""); setRemove(task); }}>Жою</button>
          </div>}
        </li>;
      })}
    </ul>;
  }

  return <div className="learning-workspace">
    {admin && <section className="panel learning-source">
      <div>
        <h3>{view === "people" ? "Пайдаланушы деректері" : "Тапсырма деректері"}</h3>
        <p className="learning-muted">Дереккөзі · Qarjy API</p>
      </div>
      <div className="learning-tools">
        {data && !data.demo && <button type="button" className="button button-outline" disabled={busy} onClick={() => void change("POST", { action: "demo" }, "Айша Демо профилі мен үш тапсырма қосылды.")}>Сынақ пайдаланушысын қосу</button>}
        <button type="button" className="button button-primary" disabled={loading || busy}
          onClick={() => { setLoading(true); void refresh(); }}>Деректерді жаңарту</button>
      </div>
    </section>}
    {error && !draft && !remove && <p role="alert" className="form-error">{error}</p>}
    {notice && <p role="status" className="learning-muted">{notice}</p>}
    {loading && <p role="status" className="learning-muted">Жүктелуде…</p>}
    {!loading && !data && !admin && <button type="button" className="button button-outline" onClick={() => { setLoading(true); void refresh(); }}>Қайталау</button>}
    {data && (view === "people" ? <section className="panel learning-list-panel">
      <header className="learning-section-head">
        <h3>Барлық пайдаланушылар</h3><span className="learning-pill">{data.people?.length ?? 0} тіркелген</span>
        {data.demo && <span className="learning-pill">1 сынақ профилі</span>}
      </header>
      <div className="form-stack learning-filters">
        <label>Аты бойынша іздеу<input value={personQuery} placeholder="Аты немесе логині" onChange={(event) => setPersonQuery(event.target.value)} /></label>
        <label>Көрсету<select value={scope} onChange={(event) => setScope(event.target.value as Scope)}>
          <option value="all">Барлығы</option><option value="consent">Рұқсат бергендер</option><option value="demo">Сынақ профилі</option>
        </select></label>
      </div>
      <p className="learning-muted">Көрсетілді {found.length} / {people.length}. Профильді ашу үшін пайдаланушының атын басыңыз.</p>
      {!found.length ? <p className="learning-muted">Пайдаланушы табылмады.</p> : <div className="learning-table-wrap">
        <table className="learning-table">
          <thead><tr><th scope="col">Пайдаланушы</th><th scope="col">Мәртебе</th><th scope="col">Қаржылық рұқсат</th><th scope="col">Тапсырмалар</th></tr></thead>
          <tbody>{found.map((person) => <tr key={personKey(person)}>
            <td><button className="learning-person-link" type="button" onClick={() => openProfile(person)}>{named(person)}</button><small>@{person.username}</small></td>
            <td>{statuses[person.status]}</td>
            <td>{person.status === "DEMO" ? "—" : consentIds.has(person.id) ? "Берілген" : "Берілмеген"}</td>
            <td>{tasks.filter((task) => assigneeKey(task.assigneeId) === personKey(person)).length}</td>
          </tr>)}</tbody>
        </table>
      </div>}
    </section> : <>
      <div className="learning-stats">
        <div className="panel">Барлығы<strong>{tasks.length}</strong></div>
        <div className="panel">Орындалды<strong className="learning-positive">{completed}</strong></div>
        <div className="panel">Орындалмады<strong className="learning-negative">{tasks.length - completed}</strong></div>
      </div>
      <section className="panel learning-list-panel">
        <header className="learning-section-head"><h3>{admin ? "Барлық тапсырмалар" : "Менің тапсырмаларым"}</h3><span className="learning-pill">{shown.length} / {tasks.length}</span></header>
        <div className="form-stack learning-filters">
          <label>Мәтін бойынша іздеу<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Тапсырма мәтінін енгізіңіз" /></label>
          {admin && <button className="button button-primary learning-add" type="button" disabled={!people.length || busy}
            onClick={() => { setError(""); setDraft(freshDraft(data.demo ? null : people[0].id)); }}>+ Тапсырма қосу</button>}
          <SortSelect value={sort} change={setSort} />
          {admin && <label>Пайдаланушы<select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
            <option value="">Барлық пайдаланушылар</option>
            {people.map((person) => <option key={personKey(person)} value={personKey(person)}>{named(person)} (@{person.username})</option>)}
          </select></label>}
        </div>
        <button className="button button-outline learning-reset" type="button" onClick={() => {
          setSearch(""); setAssignee(""); setStatus("all"); setSort("new");
        }}>Сүзгілерді тазарту</button>
        <StatusFilters value={status} change={setStatus} />
        {taskRows(shown, admin)}
      </section>
    </>)}

    {profile && <Modal open wide title={named(profile)} onClose={() => { if (!busy) setDetail(""); }}>
      <div className="learning-profile">
        <section>
          <div className="learning-identity">
            <span className="learning-avatar" aria-hidden="true">{named(profile).split(/\s+/).slice(0, 2).map((word) => word[0]).join("").toUpperCase()}</span>
            <div><h3>{named(profile)}</h3><p className="learning-muted">@{profile.username}</p></div>
          </div>
          <dl className="learning-profile-fields">
            <div><dt>Мәртебе</dt><dd>{statuses[profile.status]}</dd></div>
            <div><dt>Тіркелген күні</dt><dd>{formatDate(profile.createdAt)}</dd></div>
            <div><dt>Қаржылық рұқсат</dt><dd>{profile.status === "DEMO" ? "—" : consentIds.has(profile.id) ? "Берілген" : "Берілмеген"}</dd></div>
          </dl>
        </section>
        <section className="learning-list-panel">
          <header className="learning-section-head">
            <h3>Пайдаланушы тапсырмалары</h3>
            <button className="button button-primary" type="button" disabled={busy}
              onClick={() => { setError(""); setDraft(freshDraft(profile.status === "DEMO" ? null : profile.id)); }}>+ Тапсырма қосу</button>
          </header>
          <div className="form-stack"><SortSelect value={detailSort} change={setDetailSort} /></div>
          <StatusFilters value={detailStatus} change={setDetailStatus} />
          {taskRows(listTasks(profileTasks, detailStatus, detailSort), false)}
        </section>
      </div>
    </Modal>}

    {draft && <Modal open title={draft.id ? "Тапсырманы өңдеу" : "Жаңа тапсырма"} onClose={() => { if (!busy) { setDraft(null); setError(""); } }}>
      <form className="form-stack learning-form" onSubmit={(event) => void save(event, draft)}>
        <label>Тапсырма мәтіні
          <textarea required rows={4} maxLength={1000} placeholder="Не істеу керек?" value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
        </label>
        <label>Пайдаланушы<select value={assigneeKey(draft.assigneeId)} onChange={(event) => {
          const person = peopleById.get(event.target.value);
          if (person) setDraft({ ...draft, assigneeId: person.status === "DEMO" ? null : person.id });
        }}>{people.map((person) => <option value={personKey(person)} key={personKey(person)}>{named(person)} (@{person.username})</option>)}</select></label>
        <label>Мәртебе<select value={String(draft.completed)} onChange={(event) => setDraft({ ...draft, completed: event.target.value === "true" })}>
          <option value="false">Орындалмады</option><option value="true">Орындалды</option>
        </select></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="button button-primary" disabled={busy || !draft.body.trim()}>{draft.id ? "Сақтау" : "Қосу"}</button>
          <button type="button" className="button button-outline" disabled={busy} onClick={() => setDraft(null)}>Бас тарту</button>
        </div>
      </form>
    </Modal>}
    {remove && <Modal open title="Тапсырманы жою" onClose={() => { if (!busy) { setRemove(null); setError(""); } }}>
      <p className="delete-description">{remove.body}</p>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="button learning-delete" disabled={busy} onClick={async () => {
          if (await change("DELETE", { id: remove.id }, "Тапсырма жойылды.")) setRemove(null);
        }}>Жою</button>
        <button type="button" className="button button-outline" disabled={busy} onClick={() => setRemove(null)}>Бас тарту</button>
      </div>
    </Modal>}
  </div>;
}
