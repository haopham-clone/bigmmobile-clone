/** App runtime mode flags */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DB === "true";
}

/** True when pointing at local Supabase stack (127.0.0.1:54321) */
export function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return url.includes("127.0.0.1") || url.includes("localhost");
}
