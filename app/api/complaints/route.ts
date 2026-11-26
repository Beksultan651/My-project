import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { getPrisma } from "@/lib/prisma";
import { allowAttempt, getToken, json, readJson, sameOrigin } from "@/lib/finance-http";

async function handle(request: Request) {
  if ((request.method !== "GET" || request.headers.has("origin")) && !sameOrigin(request)) return json({}, 403);
  const viewer = await getFinanceAccountDb().session(getToken(request));
  if (!viewer) return json({}, 401);
  const db = getPrisma();
  const { isAdmin } = await db.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { isAdmin: true } });
  if (request.method === "GET") {
    const complaints = await db.complaint.findMany({
      where: isAdmin ? {} : { userId: viewer.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, message: true, reviewed: true, createdAt: true, user: { select: { username: true } } },
    });
    return json({ isAdmin, complaints });
  }
  if (request.method === "PATCH" && !isAdmin) return json({}, 403);
  const input = await readJson(request, 10000);
  if (request.method === "PATCH") {
    if (typeof input?.id !== "string") return json({}, 400);
    const { count } = await db.complaint.updateMany({ where: { id: input.id }, data: { reviewed: true } });
    return json({}, count ? 200 : 404);
  }
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (!message || message.length > 2000) return json({}, 400);
  if (!allowAttempt("complaint:" + viewer.id, 5)) return json({}, 429);
  await db.complaint.create({ data: { message, userId: viewer.id } });
  return json({}, 201);
}
export { handle as GET, handle as POST, handle as PATCH };
