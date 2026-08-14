// Server side only: reads and sets a cookie, so it runs in route handlers only.
import { cookies } from "next/headers";

// Anonymous per-visitor identity. No accounts, no email, no login: the garage
// is scoped to a cookie so demo visitors never share a record. It is also the
// honest limit of the current trust story, since anyone holding the cookie
// holds the garage. Real ownership needs real accounts, and the README says so.
const COOKIE = "glovebox_client";

export async function getClientId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;

  const id = `cli_${crypto.randomUUID()}`;
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: "/",
  });
  return id;
}
