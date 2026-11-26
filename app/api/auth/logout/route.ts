import { getFinanceAccountDb } from "@/lib/finance-postgres";
import { getToken, json, sameOrigin, sessionCookie } from "@/lib/finance-http";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: "forbiddenOrigin" }, 403);
  try {
    await getFinanceAccountDb().logout(getToken(request));
    return json({ authenticated: false }, 200, sessionCookie(request));
  } catch {
    return json({ error: "authError" }, 500);
  }
}
