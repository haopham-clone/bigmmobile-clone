import { cookies } from "next/headers";
import { isMockMode } from "@/lib/config";
import { createClient } from "@/utils/supabase/server";

export const MOCK_AUTH_COOKIE = "mock-auth-session";

export interface SessionUser {
  id: string;
  email: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isMockMode()) {
    const cookieStore = await cookies();
    const session = cookieStore.get(MOCK_AUTH_COOKIE);
    if (!session?.value) return null;
    try {
      return JSON.parse(session.value) as SessionUser;
    } catch {
      return null;
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;
  return { id: user.id, email: user.email ?? "" };
}

export async function setMockSession(email: string): Promise<void> {
  const cookieStore = await cookies();
  const user: SessionUser = {
    id: "00000000-0000-4000-8000-000000000001",
    email,
  };
  cookieStore.set(MOCK_AUTH_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
  });
}

export async function clearMockSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MOCK_AUTH_COOKIE);
}

export function isMockSessionCookie(request: { cookies: { get: (name: string) => { value: string } | undefined } }): boolean {
  return Boolean(request.cookies.get(MOCK_AUTH_COOKIE)?.value);
}
