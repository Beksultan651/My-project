import { timingSafeEqual } from "node:crypto";
import { SESSION_SECONDS } from "./finance-credentials.ts";

const cookieName = "qarjy_account";
const attempts = new Map<string, { count: number; until: number }>();

export function json(body: object, status = 200, cookie?: string) {
  const headers = new Headers({ "Cache-Control": "private, no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return Response.json(body, { status, headers });
}

function siteOrigin(request: Request) {
  if (process.env.QARJY_ORIGIN) return new URL(process.env.QARJY_ORIGIN).origin;
  const requestUrl = new URL(request.url);
  const host = request.headers.get("host") ?? requestUrl.host;
  return new URL(`${requestUrl.protocol}//${host}`).origin;
}

export function sameOrigin(request: Request): boolean {
  try {
    const origin = request.headers.get("origin");
    const configured = new URL(siteOrigin(request));
    if (origin === configured.origin) return true;
    if (!origin || configured.protocol !== "http:") return false;
    const local = new Set(["localhost", "127.0.0.1"]);
    const incoming = new URL(origin);
    return local.has(configured.hostname) && local.has(incoming.hostname)
      && incoming.protocol === configured.protocol && incoming.port === configured.port
      && incoming.host === request.headers.get("host") && incoming.origin === origin;
  } catch {
    return false;
  }
}

export function allowAttempt(bucket: string, max: number) {
  const now = Date.now();
  if (attempts.size >= 1000) {
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    if (attempts.size >= 1000 && !attempts.has(bucket)) return false;
  }
  const entry = attempts.get(bucket);
  if (!entry || entry.until <= now) {
    attempts.set(bucket, { count: 1, until: now + 60_000 });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}

export function getToken(request: Request) {
  return request.headers.get("cookie")?.split(";").map(value => value.trim())
    .find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

export function sessionCookie(request: Request, token = "") {
  const secure = siteOrigin(request).startsWith("https:") ? "; Secure" : "";
  return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${token ? SESSION_SECONDS : 0}${secure}`;
}

export async function readJson(request: Request, limit: number): Promise<Record<string, unknown> | null> {
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > limit || !request.body) return null;
  const reader = request.body.getReader();
  try {
    let total = 0;
    const blocks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); return null; }
      blocks.push(value);
    }
    const input: unknown = JSON.parse(Buffer.concat(blocks).toString("utf8"));
    return typeof input === "object" && input !== null && !Array.isArray(input) ? input as Record<string, unknown> : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

export function verifyLegacyKey(value: unknown) {
  const expected = process.env.FINANCE_API_KEY;
  if (typeof value !== "string" || !expected || expected.length < 32) return false;
  const supplied = Buffer.from(value);
  const secret = Buffer.from(expected);
  return supplied.length === secret.length && timingSafeEqual(supplied, secret);
}

export async function authenticate(request: Request, register: boolean) {
  if (!sameOrigin(request)) return json({ error: "forbiddenOrigin" }, 403);
  if (!allowAttempt("auth", 35)) return json({ error: "authRate" }, 429);
  const input = await readJson(request, 4096);
  const username = typeof input?.username === "string" ? input.username.trim().toLowerCase() : "";
  const password = input?.password;
  if (!/^[a-z0-9_.-]{3,40}$/.test(username) ||
      typeof password !== "string" || password.length < 12 || password.length > 128) {
    return json({ error: "authFields" }, 400);
  }
  if (!allowAttempt(`auth:${username}`, 8)) return json({ error: "authRate" }, 429);
  try {
    const { getFinanceAccountDb } = await import("./finance-postgres.ts");
    const store = getFinanceAccountDb();
    const user = await (register ? store.register(username, password) : store.login(username, password));
    if (!user) return json({ error: register ? "authTaken" : "authInvalid" }, register ? 409 : 401);
    const token = await store.createSession(user.id);
    await store.logout(getToken(request));
    return json({ user }, register ? 201 : 200, sessionCookie(request, token));
  } catch {
    return json({ error: "authError" }, 500);
  }
}
