import { authorizeSessionAction, clearSessionCookie } from "@/lib/finance-api-security";

export async function POST(request: Request) {
  const authorization = authorizeSessionAction(request);
  if (!authorization.allowed) {
    return Response.json({ error: authorization.error }, { status: authorization.status });
  }
  return Response.json({ authenticated: false }, {
    headers: { "Set-Cookie": clearSessionCookie(request), "Cache-Control": "no-store" },
  });
}
