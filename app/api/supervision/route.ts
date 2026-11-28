import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { getPrisma } from "@/lib/prisma";
import { getToken, json, readJson, sameOrigin } from "@/lib/finance-http";
import { parseMoney, validDate } from "@/lib/finance";

async function handle(req: Request) {
  if ((req.method !== "GET" || req.headers.has("origin")) && !sameOrigin(req))
    return json({}, 403);
  const viewer = await getFinanceAccountDb().session(getToken(req));
  if (!viewer) return json({}, 401);
  const db = getPrisma();
  const { isAdmin } = await db.user.findUniqueOrThrow({
    where: { id: viewer.id },
    select: { isAdmin: true },
  });
  const id = viewer.id;
  if (req.method === "GET") {
    const admins = isAdmin
      ? []
      : await db.user.findMany({
          where: { isAdmin: true },
          select: { id: true, username: true },
        });
    const users = await db.user.findMany({
      where: isAdmin
        ? {
            isAdmin: false,
            studentLinks: { some: { active: true, adminId: id } },
          }
        : { id },
      select: {
        id: true,
        username: true,
        sessions: {
          where: { expires: { gt: BigInt(Date.now()) } },
          take: 1,
          select: { userId: true },
        },
        ledger: {
          select: {
            accounts: { select: { id: true, currency: true } },
            categories: { select: { id: true, name: true } },
            transactions: {
              orderBy: { date: "desc" },
              select: {
                accountId: true,
                date: true,
                amount: true,
                description: true,
                type: true,
                categoryId: true,
              },
            },
            goals: {
              select: { name: true, targetAmount: true, savedAmount: true },
            },
            budget: {
              select: {
                housing: true,
                food: true,
                transport: true,
                other: true,
              },
            },
          },
        },
        studentLinks: {
          where: isAdmin ? { adminId: id, active: true } : undefined,
          select: {
            adminId: true,
            active: true,
            grants: {
              orderBy: { date: "desc" },
              select: { date: true, amount: true, note: true },
            },
          },
        },
      },
      orderBy: { username: "asc" },
    });
    const rows = users.map((u) => {
      const l = u.ledger;
      const accounts = new Map(l?.accounts.map((a) => [a.id, a.currency]));
      const categories = new Map(l?.categories.map((c) => [c.id, c.name]));
      const budget = l?.budget;
      return {
        id: u.id,
        name: u.username,
        active: !!u.sessions.length,
        permissions: isAdmin
          ? []
          : u.studentLinks.filter((x) => x.active).map((x) => x.adminId),
        grants: u.studentLinks.flatMap((x) =>
          x.grants.map((g) => ({ ...g, amount: Number(g.amount) })),
        ),
        operations: (l?.transactions ?? []).map((x) => ({
          date: x.date,
          amount: Number(x.amount),
          type: x.type,
          description: x.description,
          category: categories.get(x.categoryId) ?? x.categoryId,
          currency: accounts.get(x.accountId) ?? "",
        })),
        goals: (l?.goals ?? []).map((g) => ({
          name: g.name,
          saved: Number(g.savedAmount),
          target: Number(g.targetAmount),
        })),
        budget:
          budget &&
          [budget.food, budget.transport, budget.other, budget.housing].some(
            (v) => v !== null,
          )
            ? Number(
                (budget.food ?? BigInt(0)) +
                  (budget.housing ?? BigInt(0)) +
                  (budget.transport ?? BigInt(0)) +
                  (budget.other ?? BigInt(0)),
              )
            : null,
      };
    });
    const messages = await db.coachMessage.findMany({
      where: isAdmin
        ? { adminId: id, link: { active: true } }
        : { studentId: id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        studentId: true,
        adminId: true,
        fromAdmin: true,
        body: true,
        advice: true,
        createdAt: true,
        readAt: true,
      },
    });
    const registered = isAdmin
      ? await db.user.count({ where: { isAdmin: false } })
      : 0;
    return json({ registered, isAdmin, admins, rows, messages });
  }
  const b = await readJson(req, 12000);
  if (!b || typeof b.peer !== "string") return json({}, 400);
  const studentId = isAdmin ? b.peer : id,
    adminId = isAdmin ? id : b.peer;
  const pair = { studentId, adminId };
  const where = { studentId_adminId: pair };
  return db.$transaction(
    async (tx) => {
      if (b.action === "permission") {
        if (
          isAdmin ||
          typeof b.active !== "boolean" ||
          !(await tx.user.count({ where: { id: adminId, isAdmin: true } }))
        )
          return json({}, 403);
        await tx.supervision.upsert({
          where,
          create: { ...pair, active: b.active },
          update: { active: b.active },
        });
        await tx.adminEvent.create({
          data: {
            actor: id,
            student: studentId,
            action: b.active ? "allow" : "revoke",
            reference: adminId,
          },
        });
        return json({});
      }
      if (b.action === "export") {
        if (
          !isAdmin ||
          !Array.isArray(b.scope) ||
          !b.scope.every((x) => typeof x === "string")
        )
          return json({}, 403);
        const ids = [...new Set<string>(b.scope)];
        const count = await tx.supervision.count({
          where: { adminId: id, active: true, studentId: { in: ids } },
        });
        if (count !== ids.length) return json({}, 403);
        await tx.adminEvent.create({
          data: {
            actor: id,
            student: ids.length === 1 ? ids[0] : "",
            action: "export",
            reference: JSON.stringify(ids),
          },
        });
        return json({});
      }
      const locked = await tx.$queryRaw<
        { active: boolean }[]
      >`SELECT active FROM "Supervision" WHERE "studentId"=${studentId} AND "adminId"=${adminId} FOR UPDATE`;
      if (!locked[0]?.active) return json({}, 403);
      if (b.action === "read") {
        await tx.coachMessage.updateMany({
          where: { ...pair, fromAdmin: !isAdmin, readAt: null },
          data: { readAt: new Date() },
        });
        return json({});
      }
      const note = typeof b.note === "string" ? b.note.trim() : "";
      if (!note || note.length > 2000) return json({}, 400);
      if (b.action === "message") {
        const m = await tx.coachMessage.create({
          data: {
            ...pair,
            body: note,
            fromAdmin: isAdmin,
            advice: isAdmin && b.advice === true,
          },
        });
        if (isAdmin)
          await tx.adminEvent.create({
            data: {
              actor: id,
              student: studentId,
              action: "message",
              reference: m.id,
            },
          });
        return json({}, 201);
      }
      if (b.action !== "grant" || !isAdmin) return json({}, 403);
      const amount = typeof b.amount === "string" ? parseMoney(b.amount) : null;
      if (
        !amount ||
        typeof b.date !== "string" ||
        !validDate(b.date) ||
        typeof b.key !== "string" ||
        !/^[a-f0-9-]{36}$/i.test(b.key)
      )
        return json({}, 400);
      const existing = await tx.virtualGrant.findUnique({
        where: { id: b.key },
      });
      if (existing)
        return json(
          {},
          existing.adminId === id &&
            existing.studentId === studentId &&
            existing.amount === BigInt(amount) &&
            existing.date === b.date &&
            existing.note === note
            ? 200
            : 409,
        );
      await tx.virtualGrant.create({
        data: {
          ...pair,
          id: b.key,
          amount: BigInt(amount),
          date: b.date,
          note,
        },
      });
      await tx.adminEvent.create({
        data: {
          actor: id,
          student: studentId,
          action: "grant",
          reference: b.key,
        },
      });
      return json({}, 201);
    },
    { maxWait: 15000, timeout: 30000 },
  );
}
// A transient connection failure is safe to retry only for the read endpoint.
export async function GET(req: Request) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await handle(req);
    } catch (error) {
      if (!(error instanceof Error) || !/timeout exceeded when trying to connect/i.test(error.message)) throw error;
      if (attempt || req.signal.aborted) return json({ error: "serverUnavailable" }, 503);
    }
  }
}
export { handle as POST };
