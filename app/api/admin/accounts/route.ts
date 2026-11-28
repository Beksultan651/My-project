import { randomBytes, randomUUID } from "node:crypto";
import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { getToken, json, readJson, sameOrigin } from "@/lib/finance-http";
import { getPrisma } from "@/lib/prisma";
import { invitationDigest } from "@/lib/invitations";
import { AccountStatus, type Prisma } from "@/lib/generated/prisma/client";

const select = { id: true, username: true, fullName: true, email: true, status: true,
  createdAt: true, isAdmin: true } as const;
const transitions: Record<AccountStatus, AccountStatus[]> = {
  PENDING: ["ACTIVE","REJECTED","ARCHIVED"], ACTIVE:["BLOCKED","ARCHIVED"],
  REJECTED:["PENDING","ARCHIVED"], BLOCKED:["ACTIVE","ARCHIVED"], ARCHIVED:["BLOCKED"],
};
const db = getPrisma;

async function handle(request: Request) {
  if ((request.method !== "GET" || request.headers.has("origin")) && !sameOrigin(request)) return json({},403);
  const viewer = await getFinanceAccountDb().session(getToken(request));
  if (!viewer) return json({},401);
  if (!await db().user.count({ where:{ id:viewer.id,isAdmin:true,status:"ACTIVE" } })) return json({},403);
  const actor = viewer.id;
  const params = new URL(request.url).searchParams;
  if (request.method === "GET") {
    const view = params.get("view");
    if (view === "overview") {
      const [counts, sessions, complaints, activities, lessons, grants, unread, registrations] = await Promise.all([
        db().user.groupBy({by:["status"],_count:true}), db().session.findMany({where:{expires:{gt:BigInt(Date.now())},user:{status:"ACTIVE"}},distinct:["userId"],select:{userId:true}}),
        db().complaint.count({where:{reviewed:false}}), db().adminEvent.findMany({where:{actor},orderBy:{createdAt:"desc"},take:30,select:{id:true,action:true,createdAt:true}}),
        db().ledger.count({where:{NOT:{completedLessons:{isEmpty:true}}}}), db().virtualGrant.count({where:{adminId:actor,link:{active:true}}}),
        db().coachMessage.count({where:{adminId:actor,fromAdmin:false,readAt:null,link:{active:true}}}),
        db().$queryRaw<{month:string;count:number}[]>`
          SELECT to_char("createdAt",'YYYY-MM') AS month, COUNT(*)::int AS count
          FROM users WHERE "createdAt" >= date_trunc('month', CURRENT_DATE) - interval '5 months'
          GROUP BY 1 ORDER BY 1`,
      ]);
      return json({counts,sessions:sessions.length,complaints,activities,lessons,grants,unread,registrations});
    }
    if (view === "invitations") return json({items:await db().invitation.findMany({where:{creatorId:actor},orderBy:{createdAt:"desc"},take:100,
      select:{id:true,createdAt:true,expiresAt:true,usedAt:true,revokedAt:true}}).then(items=>items.map(item=>({...item,expired:item.expiresAt.getTime()<=Date.now()})))});
    const id = params.get("id");
    if(id) {
      const item = await db().user.findUnique({where:{id},select:{...select,_count:{select:{sessions:{where:{expires:{gt:BigInt(Date.now())}}}}}}});
      return item ? json({item}) : json({},404);
    }
    const query = (params.get("q")??"").trim().slice(0,100), status = params.get("status") as AccountStatus;
    const page = Math.min(10000, Math.max(1, Number.parseInt(params.get("page")??"1",10)||1));
    const role = params.get("role");
    const date = (key: string) => {
      const raw = params.get(key);
      if(!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return undefined;
      const value = new Date(raw);
      return Number.isFinite(value.getTime()) && value.toISOString().slice(0,10)===raw ? value : undefined;
    };
    const from=date("from"),to=date("to");
    if(to)to.setUTCDate(to.getUTCDate()+1);
    const where: Prisma.UserWhereInput = {
      status: Object.prototype.hasOwnProperty.call(AccountStatus,status) ? status : undefined,
      isAdmin: role==="admin" ? true : role==="user" ? false : undefined,
      createdAt: from||to ? {gte:from,lt:to} : undefined,
      OR:query?["username","fullName","email"].map(field=>({[field]:{contains:query,mode:"insensitive"}})):undefined,
    };
    const order: Prisma.UserOrderByWithRelationInput = params.get("sort")==="name" ? {fullName:{sort:"asc",nulls:"last"}} : {createdAt:{sort:"desc",nulls:"last"}};
    const [items,total]=await db().$transaction([db().user.findMany({where,select,orderBy:[order,{username:"asc"}],skip:(page-1)*20,take:20}),db().user.count({where})]);
    return json({items,total,page});
  }
  const body=await readJson(request,4096);
  if(!body)return json({},400);
  if(request.method==="POST"){
    const days=body.days;
    if(typeof days!=="number" || !Number.isInteger(days) || days<1 || days>90)return json({},400);
    const code=randomBytes(24).toString("base64url"), id=randomUUID();
    await db().$transaction([
      db().invitation.create({data:{id,creatorId:actor,digest:invitationDigest(code),expiresAt:new Date(Date.now()+days*86400000)}}),
      db().adminEvent.create({data:{actor,student:"",action:"invitation.create",reference:id}}),
    ]);
    return json({code},201);
  }
  const id=typeof body.id==="string"?body.id:"";
  if(!id)return json({},400);
  return db().$transaction(async tx=>{
    if(body.action==="revoke"){
      const count=await tx.invitation.updateMany({where:{id,creatorId:actor,usedAt:null,revokedAt:null},data:{revokedAt:new Date()}});
      if(!count.count)return json({},409);
      await tx.adminEvent.create({data:{actor,student:"",action:"invitation.revoke",reference:id}});
      return json({});
    }
    const current=await tx.user.findUnique({where:{id},select:{status:true,isAdmin:true}});
    if(!current)return json({},404);
    if(current.isAdmin)return json({},403);
    if(body.action==="metadata"){
      if(typeof body.fullName!=="string" || body.fullName.trim().length>100)return json({},400);
      await tx.user.update({where:{id,isAdmin:false},data:{fullName:body.fullName.trim()||null}});
      await tx.adminEvent.create({data:{actor,student:id,action:"account.metadata",reference:id}});
      return json({});
    }
    const status=body.status as AccountStatus;
    if(!transitions[current.status].includes(status))return json({},409);
    const updated=await tx.user.updateMany({where:{id,status:current.status,isAdmin:false},data:{status}});
    if(!updated.count)return json({},409);
    if(status!=="ACTIVE")await tx.session.deleteMany({where:{userId:id}});
    await tx.adminEvent.create({data:{actor,student:id,action:"account."+status,reference:id}});
    return json({});
  });
}

async function endpoint(request: Request) {
  try { return await handle(request); } catch { return json({error:"adminUnavailable"},500); }
}
export {endpoint as GET,endpoint as POST,endpoint as PATCH};
