import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import { verifySessionToken } from "./token";

export { SESSION_COOKIE, verifySessionToken };

export async function getSessionUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
