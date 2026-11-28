"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useI18n } from "./i18n-provider";

type Inbox = { isAdmin: boolean; complaints: { id: string; message: string; reviewed: boolean; createdAt: string; user: { username: string } }[] };
export function Complaints() {
  const { t, locale } = useI18n();
  const [box, setBox] = useState<Inbox | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/complaints", { cache: "no-store", signal });
      if (!res.ok) throw Error();
      setBox(await res.json());
      setError(false);
    } catch { if (!signal?.aborted) setError(true); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = setTimeout(() => void refresh(controller.signal), 0);
    return () => { clearTimeout(initialLoad); controller.abort(); };
  }, [refresh]);
  async function submit(id?: string) {
    setPending(true);
    try {
      const res = await fetch("/api/complaints", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { message }) });
      if (!res.ok) throw Error();
      if (!id) setMessage("");
      await refresh();
    } catch { setError(true); } finally { setPending(false); }
  }
  return <section className="panel space-y-4">
    {box?.isAdmin && <Link className="button button-outline" href="/admin/accounts">{t("adminAccounts")}</Link>}
    <h2>{t(box?.isAdmin ? "complaintsAdmin" : "complaintsMine")}</h2>
    <form className="form-stack" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label>{t("complaintMessage")}<textarea required maxLength={2000} rows={3} value={message} onChange={e => setMessage(e.target.value)}/></label>
      <button className="button button-primary" disabled={pending || !message.trim()}>{t("complaintSend")}</button>
    </form>
    {error && <p role="alert">{t("authError")}</p>}
    <button className="text-link" onClick={() => void refresh()}>{t("complaintRefresh")}</button>
    {!box && !error && <p>{t("loading")}</p>}
    {box?.complaints.length === 0 && <p>{t("complaintEmpty")}</p>}
    {box?.complaints.map(item => <article key={item.id} className="border-t py-3 space-y-2">
      <strong>{item.user.username}</strong> · <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleDateString(locale)}</time>
      <p className="whitespace-pre-wrap break-words">{item.message}</p>
      <span>{t(item.reviewed ? "complaintReviewed" : "complaintNew")}</span>
      {box.isAdmin && !item.reviewed && <button className="text-link ml-3" disabled={pending} onClick={() => void submit(item.id)}>{t("complaintMark")}</button>}
    </article>)}
  </section>;
}
