import { authorizeSessionAction, createSessionCookie, isAuthConfigured, verifyLoginPassword } from "@/lib/finance-api-security";

export async function POST(request: Request) {
  const authorization = authorizeSessionAction(request);
  if (!authorization.allowed) {
    return Response.json({ error: authorization.error }, { status: authorization.status });
  }
  if (!isAuthConfigured()) {
    return Response.json({ error: "authNotConfigured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalidJson" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("password" in body) ||
      typeof body.password !== "string" || body.password.length > 256) {
    return Response.json({ error: "invalidPassword" }, { status: 400 });
  }
  if (!verifyLoginPassword(body.password)) {
    return Response.json({ error: "invalidCredentials" }, { status: 401 });
  }

  const cookie = createSessionCookie(request);
  if (!cookie) return Response.json({ error: "authNotConfigured" }, { status: 503 });
  return Response.json({ authenticated: true }, {
    headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" },
  });
}
