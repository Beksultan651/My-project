import { createHmac, timingSafeEqual } from "node:crypto";

type SecurityResult =
  | { allowed: true }
  | { allowed: false; status: 401 | 403 | 429; error: "unauthenticated" | "forbiddenOrigin" | "rateLimited" };
type RateAction = "read" | "write" | "login";
type RateEntry = { count: number; resetAt: number };

const sessionCookie = "qarjy_session";
const sessionSeconds = 24 * 60 * 60;
const rateEntries = new Map<string, RateEntry>();

export function getClientAddress(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown";
}

export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const protocol = forwardedProtocol ? `${forwardedProtocol.replace(/:$/, "")}:` : requestUrl.protocol;
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host");
    if (originUrl.protocol !== protocol) return false;
    if (!host) return origin === requestUrl.origin;

    const hostUrl = host.includes("://") ? new URL(host) : new URL(`${protocol}//${host}`);
    return originUrl.host === hostUrl.host;
  } catch {
    return false;
  }
}

export function isAuthConfigured(): boolean {
  return (process.env.FINANCE_API_KEY?.length ?? 0) >= 32;
}

export function verifyLoginPassword(password: string): boolean {
  const expected = process.env.FINANCE_API_KEY;
  if (!expected || expected.length < 32) return false;
  const suppliedBytes = Buffer.from(password);
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

function sessionSignature(expiresAt: number): Buffer | null {
  const secret = process.env.FINANCE_API_KEY;
  if (!secret || secret.length < 32) return null;
  return createHmac("sha256", secret).update(`qarjy-session:${expiresAt}`).digest();
}

export function createSessionCookie(request: Request, now = Date.now()): string | null {
  const expiresAt = Math.floor(now / 1000) + sessionSeconds;
  const signature = sessionSignature(expiresAt);
  if (!signature) return null;
  const secure = getRequestProtocol(request) === "https:";
  return `${sessionCookie}=${expiresAt}.${signature.toString("hex")}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${sessionSeconds}${secure ? "; Secure" : ""}`;
}

export function clearSessionCookie(request: Request): string {
  const secure = getRequestProtocol(request) === "https:";
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure ? "; Secure" : ""}`;
}

export function hasValidSession(request: Request, now = Date.now()): boolean {
  const token = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookie}=`))
    ?.slice(sessionCookie.length + 1);
  if (!token) return false;

  const match = /^(\d{10})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const expiresAt = Number(match[1]);
  if (expiresAt <= Math.floor(now / 1000)) return false;
  const expected = sessionSignature(expiresAt);
  if (!expected) return false;
  const supplied = Buffer.from(match[2], "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function getRequestProtocol(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return forwarded ? `${forwarded.replace(/:$/, "")}:` : new URL(request.url).protocol;
}

export function checkFinanceRateLimit(request: Request, action: RateAction): boolean {
  const key = `${getClientAddress(request)}:${action}`;
  const now = Date.now();
  const limit = action === "read" ? 60 : action === "write" ? 30 : 5;
  const existing = rateEntries.get(key);

  if (rateEntries.size >= 10_000) {
    for (const [entryKey, entry] of rateEntries) {
      if (entry.resetAt <= now) rateEntries.delete(entryKey);
    }
    if (rateEntries.size >= 10_000 && !existing) return false;
  }

  if (!existing || existing.resetAt <= now) {
    rateEntries.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}

export function authorizeSessionAction(request: Request): SecurityResult {
  if (!checkOrigin(request)) return { allowed: false, status: 403, error: "forbiddenOrigin" };
  if (!checkFinanceRateLimit(request, "login")) return { allowed: false, status: 429, error: "rateLimited" };
  return { allowed: true };
}

export function authorizeFinanceRequest(request: Request, mutating: boolean): SecurityResult {
  if (mutating && !checkOrigin(request)) {
    return { allowed: false, status: 403, error: "forbiddenOrigin" };
  }
  if (request.headers.has("origin") && !checkOrigin(request)) {
    return { allowed: false, status: 403, error: "forbiddenOrigin" };
  }
  if (!checkFinanceRateLimit(request, mutating ? "write" : "read")) {
    return { allowed: false, status: 429, error: "rateLimited" };
  }
  if (!hasValidSession(request)) {
    return { allowed: false, status: 401, error: "unauthenticated" };
  }
  return { allowed: true };
}
