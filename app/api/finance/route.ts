import type { FinanceData } from "@/types/finance";
import { deleteServerFinance, readServerFinance, writeServerFinance } from "@/lib/server-finance";
import { authorizeFinanceRequest } from "@/lib/finance-api-security";

export async function GET(request: Request) {
  const authorization = authorizeFinanceRequest(request, false);
  if (!authorization.allowed) return securityResponse(authorization.status, authorization.error);
  const data = await readServerFinance();
  return data
    ? Response.json({ data })
    : Response.json({ data: null }, { status: 404 });
}

export async function PUT(request: Request) {
  const authorization = authorizeFinanceRequest(request, true);
  if (!authorization.allowed) return securityResponse(authorization.status, authorization.error);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalidJson" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("data" in body)) {
    return Response.json({ error: "invalidData" }, { status: 400 });
  }

  const data = (body as { data?: unknown }).data;
  try {
    const saved = await writeServerFinance(data as FinanceData);
    return saved
      ? Response.json({ data })
      : Response.json({ error: "invalidData" }, { status: 400 });
  } catch {
    return Response.json({ error: "serverSave" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authorization = authorizeFinanceRequest(request, true);
  if (!authorization.allowed) return securityResponse(authorization.status, authorization.error);
  return saveRequest(request);
}

export async function DELETE(request: Request) {
  const authorization = authorizeFinanceRequest(request, true);
  if (!authorization.allowed) return securityResponse(authorization.status, authorization.error);
  try {
    const deleted = await deleteServerFinance();
    return deleted
      ? Response.json({ deleted: true })
      : Response.json({ error: "serverDelete" }, { status: 500 });
  } catch {
    return Response.json({ error: "serverDelete" }, { status: 500 });
  }
}

async function saveRequest(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalidJson" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("data" in body)) {
    return Response.json({ error: "invalidData" }, { status: 400 });
  }

  const data = (body as { data?: unknown }).data;
  try {
    const saved = await writeServerFinance(data as FinanceData);
    return saved
      ? Response.json({ data }, { status: 201 })
      : Response.json({ error: "invalidData" }, { status: 400 });
  } catch {
    return Response.json({ error: "serverSave" }, { status: 500 });
  }
}

function securityResponse(status: 401 | 403 | 429, error: string) {
  return Response.json({ error }, { status });
}
