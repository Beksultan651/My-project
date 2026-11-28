import { randomUUID } from "node:crypto";
import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { getToken, json, readJson, sameOrigin } from "@/lib/finance-http";
import { getPrisma } from "@/lib/prisma";

const parentKinds: Record<string, string | null> = {
  module: null, lesson: "module", quiz: "lesson", question: "quiz", category: null, simulation: null,
};

async function handle(request: Request) {
  try {
    if ((request.method !== "GET" || request.headers.has("origin")) && !sameOrigin(request)) return json({},403);
    const viewer = await getFinanceAccountDb().session(getToken(request));
    if (!viewer) return json({},401);
    const db = getPrisma();
    if (!await db.user.count({where:{id:viewer.id,isAdmin:true,status:"ACTIVE"}})) return json({},403);
    if (request.method==="GET") return json({items:await db.adminContent.findMany({orderBy:{title:"asc"},take:1000})});
    const input = await readJson(request, 32768);
    if (!input) return json({},400);
    const id = typeof input.id==="string"?input.id:"";
    const actor = viewer.id;
    return db.$transaction(async tx=>{
      const existing = id ? await tx.adminContent.findUnique({where:{id}}) : null;
      if ((request.method==="PATCH") !== !!existing) return json({},404);
      if (existing && typeof input.archived==="boolean") {
        await tx.adminContent.update({where:{id},data:{archived:input.archived}});
        await tx.adminEvent.create({data:{actor,student:"",action:input.archived?"content.archive":"content.restore",reference:id}});
        return json({});
      }
      const kind=existing?.kind??input.kind;
      const title=typeof input.title==="string"?input.title.trim():"";
      const body=typeof input.body==="string"?input.body.trim():"";
      const parentId=typeof input.parentId==="string"&&input.parentId?input.parentId:null;
      if(typeof kind!=="string"||!Object.prototype.hasOwnProperty.call(parentKinds,kind)||!title||title.length>150||!body||body.length>12000)return json({},400);
      const expected=parentKinds[kind];
      if(expected ? !parentId || !await tx.adminContent.count({where:{id:parentId,kind:expected,archived:false}}) : parentId!==null)return json({},400);
      const data={title,body,parentId};
      const item=existing ? await tx.adminContent.update({where:{id},data}) : await tx.adminContent.create({data:{id:randomUUID(),kind,...data}});
      await tx.adminEvent.create({data:{actor,student:"",action:existing?"content.edit":"content.create",reference:item.id}});
      return json({item},existing?200:201);
    });
  } catch { return json({},500); }
}
export {handle as GET,handle as POST,handle as PATCH};
