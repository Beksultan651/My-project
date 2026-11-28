"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, PageHeading } from "@/components/ui";

const types = {module:"Модульдер",lesson:"Сабақтар",quiz:"Тесттер",question:"Сұрақтар",category:"Ортақ санаттар",simulation:"Симуляция параметрлері"};
type Kind = keyof typeof types;
const parentKind: Partial<Record<Kind,Kind>> = {lesson:"module",quiz:"lesson",question:"quiz"};
type Draft = {id:string;kind:Kind;title:string;body:string;parentId:string|null};
type Item = Draft & {archived:boolean};
const blank = (kind:Kind): Draft => ({id:"",kind,title:"",body:"",parentId:null});

export default function AdminContent() {
  const [items,setItems]=useState<Item[]|null>(null);
  const [draft,setDraft]=useState(blank("module"));
  const [editor,setEditor]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const load=useCallback(async (signal?:AbortSignal)=>{
    const r=await fetch("/api/admin/content",{cache:"no-store",signal});
    if(!r.ok)throw Error(r.status===403?"Әкімші рұқсаты қажет.":"Контент жүктелмеді.");
    const result=await r.json();
    if(!signal?.aborted)setItems(result.items);
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    const timer = setTimeout(() => void load(controller.signal).catch(error => {
      if (!controller.signal.aborted) setError(error.message);
    }), 0);
    return () => { clearTimeout(timer); controller.abort(); };
  },[load]);
  async function save(body:object,id:string) {
    setBusy(true);setError("");setNotice("");
    try{
      const r=await fetch("/api/admin/content",{method:id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      if(!r.ok)throw Error("Сақтау мүмкін болмады. Өрістерді және жоғары бөлімді тексеріңіз.");
      await load();setDraft(blank(draft.kind));setEditor(false);setNotice("Өзгеріс сақталды.");
    }catch(cause){setError((cause as Error).message);}
    finally{setBusy(false);}
  }
  const parents=items?.filter(item=>!item.archived&&item.kind===parentKind[draft.kind])??[];
  return <div className="space-y-5"><PageHeading title="Оқу контентінің жобалары"/>
    <p>Жобалар әкімшілерге көрінеді. Қолданыстағы сабақтар, жеке санаттар мен симуляторлар өз дерек көздерін пайдаланады.</p>
    {error&&<p role="alert" className="form-error">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {!items?<p role="status">{error?"":"Жүктелуде…"}</p>:<section className="panel space-y-4">
      <div className="flex flex-wrap gap-3 items-end"><label className="form-stack">Бөлім<select value={draft.kind} onChange={event=>setDraft(blank(event.target.value as Kind))}>{Object.entries(types).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}</select></label>
        <button className="button button-primary" onClick={()=>{setDraft(blank(draft.kind));setEditor(true);}}>Жоба қосу</button></div>
      <Modal open={editor} title={draft.id?"Жобаны өңдеу":"Жаңа жоба"} onClose={()=>{if(!busy)setEditor(false);}}>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <form className="form-stack" onSubmit={event=>{event.preventDefault();void save(draft,draft.id);}}>
        <label>Бөлім<select value={draft.kind} onChange={event=>setDraft(blank(event.target.value as Kind))}>
          {Object.entries(types).map(([kind,label])=><option key={kind} value={kind}>{label}</option>)}
        </select></label>
        {parentKind[draft.kind]&&<label>Жоғары бөлім<select required value={draft.parentId??""} onChange={event=>setDraft({...draft,parentId:event.target.value||null})}>
          <option value="">Таңдаңыз</option>{parents.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label>}
        <label>Атауы<input required maxLength={150} value={draft.title} onChange={event=>setDraft({...draft,title:event.target.value})}/></label>
        <label>Мазмұны<textarea required maxLength={12000} rows={6} value={draft.body} onChange={event=>setDraft({...draft,body:event.target.value})}/></label>
        <button className="button button-primary" disabled={busy}>{draft.id?"Өзгерісті сақтау":"Жоба қосу"}</button>
        <button type="button" disabled={busy} className="button button-outline" onClick={()=>setEditor(false)}>Бас тарту</button>
      </form></Modal>
      {items.filter(item=>item.kind===draft.kind).map(item=><div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t py-3">
        <span>{item.title} · {item.archived?"Мұрағатта":"Жоба"}</span>
        <div className="flex flex-wrap gap-2">
          <button className="button button-outline" disabled={busy} onClick={()=>{setDraft(item);setEditor(true);}}>Өңдеу</button>
          <button className="button button-outline" disabled={busy} onClick={()=>{if(confirm(item.archived?"Жобаны қалпына келтіру керек пе?":"Жобаны мұрағаттау керек пе?"))void save({id:item.id,archived:!item.archived},item.id);}}>{item.archived?"Қалпына келтіру":"Мұрағаттау"}</button>
        </div>
      </div>)}
      {!items.some(item=>item.kind===draft.kind)&&<p>Бұл бөлімде жоба жоқ.</p>}
    </section>}
  </div>;
}
