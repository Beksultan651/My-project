"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Modal, PageHeading } from "@/components/ui";

const statuses = {ACTIVE:"Белсенді",PENDING:"Күтуде",REJECTED:"Қабылданбаған",BLOCKED:"Бұғатталған",ARCHIVED:"Мұрағатта"};
type Status = keyof typeof statuses;
type Account = { id:string; username:string; fullName:string|null; email:string|null; status:Status; isAdmin:boolean; createdAt:string|null; _count?:{sessions:number} };
type Invitation = {id:string; expiresAt:string; usedAt:string|null; revokedAt:string|null;expired:boolean};
type Overview = {counts:{status:Status;_count:number}[]; sessions:number; complaints:number; lessons:number; grants:number; unread:number; registrations:{month:string;count:number}[]; activities:{id:string;action:string;createdAt:string}[]};
const actions: Record<Status, Status[]> = {ACTIVE:["BLOCKED","ARCHIVED"],PENDING:["ACTIVE","REJECTED","ARCHIVED"],REJECTED:["PENDING","ARCHIVED"],BLOCKED:["ACTIVE","ARCHIVED"],ARCHIVED:["BLOCKED"]};
const actionLabels = {ACTIVE:"Белсендіру",PENDING:"Қайта қарауға жіберу",REJECTED:"Қабылдамау",BLOCKED:"Бұғаттау",ARCHIVED:"Мұрағаттау"};
const sections = ["Шолу","Пайдаланушылар","Тіркелу өтінімдері","Шақырулар","Аудит"] as const;
type Section = typeof sections[number];

export default function AdminAccounts() {
  const [section,setSection]=useState<Section>("Шолу");
  const [accounts,setAccounts]=useState<Account[]>([]);
  const [invitations,setInvitations]=useState<Invitation[]>([]);
  const [overview,setOverview]=useState<Overview|null>(null);
  const [detail,setDetail]=useState<Account|null>(null);
  const [name,setName]=useState("");
  const [filters,setFilters]=useState({q:"",status:"",role:"",from:"",to:"",sort:""});
  const [page,setPage]=useState(1), [total,setTotal]=useState(0);
  const [code,setCode]=useState(""), [days,setDays]=useState(7);
  const [loading,setLoading]=useState(true), [busy,setBusy]=useState(false);
  const [error,setError]=useState(""), [notice,setNotice]=useState("");
  const refresh=useCallback(async(signal?:AbortSignal)=>{
    const params=new URLSearchParams({...filters,page:String(page)});
    if(section==="Шолу"||section==="Аудит")params.set("view","overview");
    if(section==="Шақырулар")params.set("view","invitations");
    if(section==="Тіркелу өтінімдері")params.set("status","PENDING");
    try{
      const response=await fetch("/api/admin/accounts?"+params,{signal,cache:"no-store"});
      if(!response.ok)throw new Error(response.status===403?"Әкімші рұқсаты қажет.":"Деректерді жүктеу мүмкін болмады.");
      const result=await response.json();
      if(signal?.aborted)return;
      if(params.get("view")==="overview")setOverview(result);
      else if(params.get("view")==="invitations")setInvitations(result.items);
      else {setAccounts(result.items);setTotal(result.total);}
      setError("");
    }catch(cause){if(!signal?.aborted)setError((cause as Error).message);}
    finally{if(!signal?.aborted)setLoading(false);}
  },[filters,page,section]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer=setTimeout(()=>void refresh(controller.signal),200);
    return ()=>{controller.abort();clearTimeout(timer);};
  },[refresh]);
  function filter(key:keyof typeof filters,value:string){
    setLoading(true);setPage(1);setFilters(prev=>({...prev,[key]:value}));
  }
  async function inspect(id:string){
    try{
      const response=await fetch("/api/admin/accounts?id="+encodeURIComponent(id),{cache:"no-store"});
      if(!response.ok)throw Error();
      const {item}=await response.json();setDetail(item);setName(item.fullName??"");
    }catch{setError("Пайдаланушы туралы деректі ашу мүмкін болмады.");}
  }
  async function change(method:"POST"|"PATCH",body:object){
    setBusy(true);setNotice("");setError("");setCode("");
    try{
      const response=await fetch("/api/admin/accounts",{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!response.ok)throw Error(response.status===409?"Мәртебе өзгеріп кеткен. Тізімді жаңартыңыз.":"Әрекет орындалмады.");
      const result=await response.json();
      if(result.code)setCode(result.code);
      setNotice("Өзгеріс сақталды.");await refresh();
      if(detail)await inspect(detail.id);
    }catch(cause){setError((cause as Error).message);}
    finally{setBusy(false);}
  }

  return <div className="space-y-5">
    <PageHeading title="Әкімші панелі"/>
    <div className="flex flex-wrap gap-2">
      {sections.map(item=><button key={item} className={item===section?"button button-primary":"button button-outline"} aria-pressed={item===section}
        onClick={()=>{if(item!==section){setSection(item);setPage(1);setDetail(null);setFilters({q:"",status:"",role:"",from:"",to:"",sort:""});setLoading(true);}}}>{item}</button>)}
      <Link className="button button-outline" href="/admin/content">Оқу контенті</Link>
      <Link className="button button-outline" href="/supervision">Қаржы және хабарламалар</Link>
      <Link className="button button-outline" href="/profile">Шағымдар және шығу</Link>
    </div>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {loading?<p role="status">Жүктелуде…</p>:<>
      {section==="Шолу"&&overview&&<section className="panel grid gap-4 sm:grid-cols-2">
        <p>Барлық аккаунт · {overview.counts.reduce((total,row)=>total+row._count,0)}</p>
        {Object.entries(statuses).map(([status,label])=><p key={status}>{label} · {overview.counts.find(row=>row.status===status)?._count??0}</p>)}
        <p>Белсенді сессиясы бар · {overview.sessions}</p><p>Ашық шағым · {overview.complaints}</p>
        <p>Сабақ аяқтаған · {overview.lessons}</p><p>Оқылмаған хабарлама · {overview.unread}</p><p>Рұқсат аясындағы қаражат бөлу · {overview.grants}</p>
        <div><h2>Соңғы алты айда тіркелгендер</h2>{overview.registrations.length ?
          overview.registrations.map(item=><p key={item.month}>{item.month} · {item.count}</p>) : <p>Тіркелу күні бар жазба жоқ.</p>}</div>
      </section>}
      {section==="Аудит"&&overview&&<section className="panel space-y-2">
        <h2>Өзімнің соңғы әрекеттерім</h2>{!overview.activities.length&&<p>Журнал бос.</p>}
        {overview.activities.map(item=><p key={item.id}>{new Date(item.createdAt).toLocaleString("kk-KZ")} · {item.action}</p>)}
      </section>}
      {section==="Шақырулар"&&<section className="panel space-y-4">
        <form className="form-stack" onSubmit={event=>{event.preventDefault();void change("POST",{days});}}>
          <label>Жарамдылық мерзімі (күн)<input type="number" min={1} max={90} required value={days} onChange={event=>setDays(event.target.valueAsNumber)}/></label>
          <button className="button button-primary" disabled={busy}>Бір реттік шақыру жасау</button>
        </form>
        {code&&<label className="form-stack">Код бір рет көрсетіледі<input readOnly value={code} onFocus={event=>event.currentTarget.select()}/></label>}
        {!invitations.length&&<p>Шақыру жоқ.</p>}
        {invitations.map(item=><div className="flex flex-wrap justify-between gap-2 border-t py-3" key={item.id}>
          <span>{new Date(item.expiresAt).toLocaleString("kk-KZ")} · {item.usedAt?"Қолданылған":item.revokedAt?"Қайтарылған":item.expired?"Мерзімі өткен":"Жарамды"}</span>
          {!item.usedAt&&!item.revokedAt&&!item.expired&&<button disabled={busy} className="button button-outline"
            onClick={()=>{if(confirm("Шақыруды қайтару керек пе?"))void change("PATCH",{action:"revoke",id:item.id});}}>Қайтарып алу</button>}
        </div>)}
      </section>}
      {(section==="Пайдаланушылар"||section==="Тіркелу өтінімдері")&&<section className="panel space-y-4">
        <div className="form-stack grid gap-3 sm:grid-cols-2">
          <label>Аты немесе email<input value={filters.q} onChange={event=>filter("q",event.target.value)}/></label>
          {section==="Пайдаланушылар"&&<label>Мәртебе<select value={filters.status} onChange={event=>filter("status",event.target.value)}><option value="">Барлығы</option>{Object.entries(statuses).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>}
          <label>Рөл<select value={filters.role} onChange={event=>filter("role",event.target.value)}><option value="">Барлығы</option><option value="admin">Әкімші</option><option value="user">Пайдаланушы</option></select></label>
          <label>Сұрыптау<select value={filters.sort} onChange={event=>filter("sort",event.target.value)}><option value="">Жаңа тіркелгендер</option><option value="name">Аты-жөні</option></select></label>
          <label>Тіркелген күні, бастап<input type="date" value={filters.from} onChange={event=>filter("from",event.target.value)}/></label>
          <label>Тіркелген күні, дейін<input type="date" value={filters.to} onChange={event=>filter("to",event.target.value)}/></label>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Аты</th><th>Email</th><th>Мәртебе</th><th>Рөл</th><th>Тіркелген күні</th></tr></thead>
          <tbody>{accounts.map(item=><tr key={item.id} className="border-t"><td><button className="text-link py-2" onClick={()=>void inspect(item.id)}>{item.fullName||item.username}</button></td><td>{item.email??"—"}</td><td>{statuses[item.status]}</td><td>{item.isAdmin?"Әкімші":"Пайдаланушы"}</td><td>{item.createdAt?.slice(0,10)??"—"}</td></tr>)}</tbody></table></div>
        {!accounts.length&&<p>Сүзгіге сай аккаунт жоқ.</p>}
        <div className="flex gap-3 items-center">
          <button className="button button-outline" disabled={page===1} onClick={()=>{setLoading(true);setPage(page-1);}}>Алдыңғы</button>
          <span>{page} / {Math.max(1,Math.ceil(total/20))}</span>
          <button className="button button-outline" disabled={page*20>=total} onClick={()=>{setLoading(true);setPage(page+1);}}>Келесі</button>
        </div>
        {detail&&<Modal open title={detail.fullName || detail.username} onClose={()=>{if(!busy)setDetail(null);}}><div className="space-y-4">{error&&<p role="alert" className="form-error">{error}</p>}<h3>@{detail.username}</h3><p>{detail.email??"—"} · {statuses[detail.status]} · Белсенді сессиялар {detail._count?.sessions??0}</p>
          {!detail.isAdmin&&<>
            <form className="form-stack" onSubmit={event=>{event.preventDefault();void change("PATCH",{action:"metadata",id:detail.id,fullName:name});}}>
              <label>Аты-жөні<input value={name} maxLength={100} onChange={event=>setName(event.target.value)}/></label><button className="button button-outline" disabled={busy}>Сақтау</button>
            </form>
            <div className="flex flex-wrap gap-2">{actions[detail.status].map(status=><button key={status} className="button button-outline" disabled={busy} onClick={()=>{
              if(confirm(detail.username+" · "+actionLabels[status]+"?"))void change("PATCH",{id:detail.id,status});
            }}>{actionLabels[status]}</button>)}</div>
          </>}
        </div></Modal>}
      </section>}
    </>}
  </div>;
}
