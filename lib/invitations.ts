import { createHash, randomUUID, randomBytes } from "node:crypto";
import { derive } from "./finance-credentials.ts";
import { getPrisma } from "./prisma.ts";

export const invitationDigest = (code: string) => createHash("sha256").update(code).digest("hex");

export async function requestRegistration(username: string, password: string, input: Record<string, unknown>) {
  const code = typeof input.invitation === "string" ? input.invitation.trim() : "";
  const fullName = typeof input.fullName === "string" ? input.fullName.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!/^[A-Za-z0-9_-]{32}$/.test(code) || !fullName || fullName.length > 100 ||
    email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "authFields" as const;
  const salt = randomBytes(16).toString("hex");
  const hash = (await derive(password, salt)).toString("hex");
  const db = getPrisma();
  return db.$transaction(async tx => {
    const now = new Date();
    const invite = await tx.invitation.updateMany({
      where: { digest: invitationDigest(code), revokedAt: null, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (!invite.count) return "inviteInvalid" as const;
    await tx.user.create({ data: { id: randomUUID(), username, salt, hash, fullName, email, createdAt: now, status: "PENDING" } });
    return "registrationPending" as const;
  });
}
