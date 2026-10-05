import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/server/db";

const COOKIE_NAME = "educai_session";
const SESSION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    path: "/",
    expires,
  };
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * DAY_MS);
  await db.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(COOKIE_NAME, token, cookieOptions(expiresAt));
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(COOKIE_NAME);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "STUDENT" | "TEACHER";
}

/** Usuario de la sesión actual (memoizado por request). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.deleteMany({ where: { id: session.id } });
    return null;
  }
  return session.user;
});
