import { authenticate } from "@/lib/finance-http";

export function POST(request: Request) {
  return authenticate(request, false);
}
