import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { FinanceData } from "../types/finance";

import { derive, dummySalt, SESSION_SECONDS, tokenHash, type FinanceUser } from "./finance-credentials.ts";

export class FinanceAccountDb {
  private db: DatabaseSync;

  constructor(filename: string) {
    if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(filename);
    this.db.exec(`
      PRAGMA busy_timeout=5000;
      PRAGMA foreign_keys=ON;
      PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, hash TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS finances (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, version INTEGER NOT NULL, payload TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS legacy_claim (
        singleton INTEGER PRIMARY KEY CHECK(singleton=1), user_id TEXT NOT NULL REFERENCES users(id)
      );
    `);
  }

  close() { this.db.close(); }

  async register(username: string, password: string) {
    const salt = randomBytes(16).toString("hex");
    const digest = await derive(password, salt);
    const id = randomUUID();
    const result = this.db.prepare("INSERT INTO users VALUES (?,?,?,?) ON CONFLICT(username) DO NOTHING")
      .run(id, username, salt, digest.toString("hex"));
    return Number(result.changes) ? { id, username } : null;
  }

  async login(username: string, password: string): Promise<FinanceUser | null> {
    const row = this.db.prepare("SELECT id, username, salt, hash FROM users WHERE username=?").get(username);
    const digest = await derive(password, typeof row?.salt === "string" ? row.salt : dummySalt);
    const expected = typeof row?.hash === "string" ? Buffer.from(row.hash, "hex") : Buffer.alloc(64);
    return expected.length === digest.length && timingSafeEqual(digest, expected) && row
      ? { id: String(row.id), username: String(row.username) } : null;
  }

  createSession(userId: string) {
    const token = randomBytes(32).toString("base64url");
    const now = Date.now();
    this.db.prepare("DELETE FROM sessions WHERE expires<=?").run(now);
    this.db.prepare("INSERT INTO sessions VALUES (?,?,?)").run(tokenHash(token), userId, now + SESSION_SECONDS * 1000);
    return token;
  }

  session(token?: string): FinanceUser | null {
    if (!token || !/^[\w-]{43}$/.test(token)) return null;
    const row = this.db.prepare(`SELECT users.id, users.username FROM sessions
      JOIN users ON users.id = sessions.user_id WHERE token_hash=? AND expires>?`).get(tokenHash(token), Date.now());
    return row ? { id: String(row.id), username: String(row.username) } : null;
  }

  logout(token?: string) {
    if (token && /^[\w-]{43}$/.test(token)) this.db.prepare("DELETE FROM sessions WHERE token_hash=?").run(tokenHash(token));
  }

  read(userId: string): { version: number; data: unknown } {
    const row = this.db.prepare("SELECT version, payload FROM finances WHERE user_id=?").get(userId);
    return row ? { version: Number(row.version), data: JSON.parse(String(row.payload)) } : { version: 0, data: null };
  }

  save(userId: string, version: number, data: FinanceData): boolean {
    const payload = JSON.stringify(data);
    const result = version === 0
      ? this.db.prepare("INSERT INTO finances VALUES (?,1,?) ON CONFLICT(user_id) DO NOTHING").run(userId, payload)
      : this.db.prepare("UPDATE finances SET payload=?, version=version+1 WHERE user_id=? AND version=?").run(payload, userId, version);
    return Number(result.changes) === 1;
  }

  importLegacy(userId: string, data: FinanceData): boolean {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const claimed = this.db.prepare("INSERT INTO legacy_claim VALUES (1,?) ON CONFLICT DO NOTHING").run(userId);
      if (!Number(claimed.changes) || !this.save(userId, 0, data)) {
        this.db.exec("ROLLBACK");
        return false;
      }
      this.db.exec("COMMIT");
      return true;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }
}

