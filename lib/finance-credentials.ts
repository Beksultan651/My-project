import { createHash, randomBytes, scrypt } from "node:crypto";

export const SESSION_SECONDS = 24 * 3600;
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const dummySalt = randomBytes(16).toString("hex");

export function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolveKey, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => error ? reject(error) : resolveKey(key));
  });
}

export type FinanceUser = { id: string; username: string };

