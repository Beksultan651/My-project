import { stat } from "node:fs/promises";
import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { allowAttempt, getToken, json, readJson, sameOrigin, verifyLegacyKey } from "@/lib/finance-http";
import { isFinanceData } from "@/lib/finance-storage";
import { readServerFinance, serverFinancePath } from "@/lib/server-finance";


export async function GET(request: Request) {
  if (request.headers.has("origin") && !sameOrigin(request)) return json({ error: "forbiddenOrigin" }, 403);
  try {
    const store = getFinanceAccountDb();
    const user = await store.session(getToken(request));
    if (!user) return json({ error: "unauthenticated" }, 401);
    const record = await store.read(user.id);
    if (record.version !== 0 && !isFinanceData(record.data)) return json({ error: "serverUnavailable" }, 500);
    const legacyAvailable = record.version === 0 && (process.env.FINANCE_API_KEY?.length ?? 0) >= 32 &&
      await stat(/*turbopackIgnore: true*/ serverFinancePath).then(file => file.isFile(), () => false);
    return json({ user, ...record, legacyAvailable });
  } catch {
    return json({ error: "serverUnavailable" }, 500);
  }
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return json({ error: "forbiddenOrigin" }, 403);
  try {
    const store = getFinanceAccountDb();
    const user = await store.session(getToken(request));
    if (!user) return json({ error: "unauthenticated" }, 401);
    const body = await readJson(request, 6 * 1024 * 1024);
    const version = body?.version;
    if (!body || typeof version !== "number" || !Number.isSafeInteger(version) || version < 0) {
      return json({ error: "formInvalid" }, 400);
    }
    if (body.userId !== user.id) return json({ error: "recordChanged" }, 409);

    if (body.source === "legacy") {
      if (!allowAttempt(`legacy:${user.id}`, 5)) return json({ error: "authRate" }, 429);
      if (version !== 0 || !verifyLegacyKey(body.password)) return json({ error: "authInvalid" }, 403);
      const data = await readServerFinance();
      if (!data) return json({ error: "storageInvalid" }, 400);
      if ((await store.session(getToken(request)))?.id !== user.id) return json({ error: "unauthenticated" }, 401);
      if (!await store.importLegacy(user.id, data)) return json({ error: "authAlreadyImported" }, 409);
      return json({ version: 1, data });
    }

    if (!isFinanceData(body.data)) return json({ error: "formInvalid" }, 400);
    if (!await store.save(user.id, version, body.data)) return json({ error: "recordChanged" }, 409);
    return json({ version: version + 1 });
  } catch {
    return json({ error: "storageSave" }, 500);
  }
}
