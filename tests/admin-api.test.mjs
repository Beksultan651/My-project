import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createPrisma } from "../lib/prisma.ts";
import { FinancePostgres } from "../lib/finance-postgres.ts";

test("invitation, registration, lifecycle, filtering and session revocation", async () => {
  const url = process.env.TEST_DATABASE_URL, origin = process.env.TEST_APP_ORIGIN;
  assert.ok(url && origin);
  assert.equal(new URL(url).hostname, "127.0.0.1");
  const db = createPrisma(url), store = new FinancePostgres(db);
  const password = randomUUID(), name = "qa-" + randomUUID();
  let admin;
  const contentIds = [];
  async function request(path, method, body, cookie) {
    const r = await fetch(origin + "/api/" + path, {
      method, headers: { origin, "content-type": "application/json", cookie: cookie ?? "" },
      body: body && JSON.stringify(body),
    });
    return [r.status, await r.json(), r.headers.get("set-cookie")?.split(";")[0]];
  }
  const api = "admin/accounts";
  try {
    admin = await store.register("qa-" + randomUUID(), password);
    await db.user.update({where:{id:admin.id},data:{isAdmin:true}});
    const [login,, adminCookie] = await request("auth/login","POST",{username:admin.username,password});
    assert.equal(login,200);
    const [created,{code}] = await request(api,"POST",{days:3},adminCookie);
    assert.equal(created,201);
    const profile = {username:name,password,fullName:"Тест қолданушы",email:name+"@example.test",invitation:code};
    const [registered,, pendingCookie] = await request("auth/register","POST",profile);
    assert.equal(registered,202);
    assert.equal(pendingCookie,undefined);
    assert.equal((await request("auth/register","POST",{...profile,username:name+"x"}))[0],400);
    assert.equal((await request("auth/login","POST",profile))[0],403);
    const [found,{items,total}] = await request(api+"?status=PENDING&role=user&sort=name&q="+name,"GET",null,adminCookie);
    assert.equal(found,200);
    assert.equal(total,1);
    const {id}=items[0];
    assert.equal((await request(api+"?page=2&q="+name,"GET",null,adminCookie))[1].items.length,0);
    assert.equal((await request(api,"PATCH",{id:admin.id,status:"BLOCKED"},adminCookie))[0],403);
    assert.equal((await request(api,"PATCH",{id,status:"ACTIVE"},adminCookie))[0],200);
    const [active,,cookie] = await request("auth/login","POST",profile);
    assert.equal(active,200);
    assert.equal((await request(api+"?view=overview","GET",null,adminCookie))[0],200);
    const content = "admin/content";
    assert.equal((await request(content,"GET",null,cookie))[0],403);
    let parentId = null;
    for(const kind of ["module","lesson","quiz","question"]){
      const [status,{item}] = await request(content,"POST",{kind,title:name,body:"Fixture",parentId},adminCookie);
      assert.equal(status,201);
      contentIds.unshift(item.id);
      parentId = item.id;
    }
    assert.equal((await request(content,"PATCH",{id:parentId,archived:true},adminCookie))[0],200);
    assert.ok((await request(content,"GET",null,adminCookie))[1].items.find(x=>x.id===parentId).archived);
    assert.equal((await request(api,"GET",null,cookie))[0],403);
    assert.equal((await request(api,"PATCH",{id,status:"BLOCKED"},adminCookie))[0],200);
    assert.equal((await request("finance","GET",null,cookie))[0],401);
    assert.equal(await db.session.count({where:{userId:id}}),0);
    assert.equal((await request(api,"PATCH",{id,status:"ARCHIVED"},adminCookie))[0],200);
    assert.equal((await request(api,"PATCH",{id,status:"BLOCKED"},adminCookie))[0],200);
    assert.equal((await request(api,"PATCH",{id,status:"ACTIVE"},adminCookie))[0],200);
    const [, , again] = await request("auth/login","POST",profile);
    assert.equal((await request("auth/logout","POST",null,again))[0],200);
    assert.equal((await request("finance","GET",null,again))[0],401);
    assert.equal((await request("auth/logout","POST",null,adminCookie))[0],200);
    assert.equal((await request(api,"GET",null,adminCookie))[0],401);
    assert.ok(await db.adminEvent.count({where:{actor:admin.id,action:"account.BLOCKED"}}));
  } finally {
    for(const id of contentIds)await db.adminContent.delete({where:{id}});
    if(admin){
      await db.adminEvent.deleteMany({where:{actor:admin.id}});
      await db.invitation.deleteMany({where:{creatorId:admin.id}});
      await db.user.deleteMany({where:{OR:[{id:admin.id},{username:name}]}});
    }
    await db.$disconnect();
  }
});
