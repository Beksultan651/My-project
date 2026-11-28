import { getToken, json, readJson, sameOrigin } from "@/lib/finance-http";
import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { getPrisma } from "@/lib/prisma";
import { createLearningDemo } from "@/lib/learning-demo";

const taskSelect = { id: true, assigneeId: true, body: true, completed: true, createdAt: true } as const;

async function handle(request: Request) {
  const method = request.method;
  if ((method !== "GET" || request.headers.has("origin")) && !sameOrigin(request)) {
    return json({}, 403);
  }

  const viewer = await getFinanceAccountDb().session(getToken(request));
  if (!viewer) return json({}, 401);
  const db = getPrisma();
  const actor = viewer.id;
  const isAdmin = !!await db.user.count({ where: { id: actor, isAdmin: true, status: "ACTIVE" } });

  if (method === "GET") {
    const taskQuery = db.learningTask.findMany({
      where: isAdmin ? { adminId: actor } : { assigneeId: actor },
      select: taskSelect,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    if (!isAdmin) return json({ tasks: await taskQuery });

    const [tasks, people, demo] = await Promise.all([
      taskQuery,
      db.user.findMany({
        where: { isAdmin: false },
        select: { id: true, username: true, fullName: true, status: true, createdAt: true },
        orderBy: { username: "asc" },
      }),
      db.learningDemoProfile.findUnique({ where: { adminId: actor }, select: { createdAt: true } }),
    ]);
    return json({ tasks, people, demo });
  }

  const body = await readJson(request, 8192);
  if (!body) return json({}, 400);
  const id = typeof body.id === "string" && body.id.length <= 100 ? body.id : "";
  if (!isAdmin) {
    if (method !== "PATCH" || body.action !== "complete") return json({}, 403);
    if (!id || typeof body.completed !== "boolean") return json({}, 400);
    const result = await db.learningTask.updateMany({
      where: { id, assigneeId: actor },
      data: { completed: body.completed },
    });
    return json({}, result.count ? 200 : 404);
  }

  if (method === "POST" && body.action === "demo") {
    return json({}, (await createLearningDemo(db, actor)) ? 201 : 200);
  }

  if (method !== "POST" && !id) return json({}, 400);
  if (method === "DELETE" || (method === "PATCH" && body.action === "complete")) {
    return db.$transaction(async (tx) => {
      const task = await tx.learningTask.findFirst({ where: { id, adminId: actor }, select: { assigneeId: true } });
      if (!task) return json({}, 404);
      if (method === "DELETE") {
        await tx.learningTask.delete({ where: { id, adminId: actor } });
      } else {
        if (typeof body.completed !== "boolean") return json({}, 400);
        await tx.learningTask.update({ where: { id, adminId: actor }, data: { completed: body.completed } });
      }
      await tx.adminEvent.create({
        data: { actor, student: task.assigneeId ?? "", action: method === "DELETE" ? "learning.task.delete" : "learning.task.complete", reference: id },
      });
      return json({});
    });
  }

  const title = typeof body.body === "string" ? body.body.trim() : "";
  const { assigneeId, completed } = body;
  if (!title || title.length > 1000 || typeof completed !== "boolean" ||
      (assigneeId !== null && (typeof assigneeId !== "string" || !assigneeId || assigneeId.length > 100))) {
    return json({}, 400);
  }

  return db.$transaction(async (tx) => {
    const allowed = assigneeId === null
      ? await tx.learningDemoProfile.count({ where: { adminId: actor } })
      : await tx.user.count({ where: { id: assigneeId, isAdmin: false } });
    if (!allowed) return json({}, 404);

    const fields = { body: title, assigneeId, completed };
    const task = method === "POST"
      ? await tx.learningTask.create({ data: { ...fields, adminId: actor }, select: { id: true } })
      : await tx.learningTask.update({ where: { id, adminId: actor }, data: fields, select: { id: true } });
    await tx.adminEvent.create({
      data: { actor, student: assigneeId ?? "", action: method === "POST" ? "learning.task.create" : "learning.task.edit", reference: task.id },
    });
    return json({ id: task.id }, method === "POST" ? 201 : 200);
  });
}

async function endpoint(request: Request) {
  try {
    return await handle(request);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return json({}, 404);
    return json({ error: "learningTasksUnavailable" }, 503);
  }
}

export { endpoint as GET, endpoint as POST, endpoint as PATCH, endpoint as DELETE };
