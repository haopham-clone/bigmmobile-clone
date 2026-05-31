/**
 * Creates a local dev auth user via Supabase Admin API.
 * Run after `supabase start`: npm run db:user
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const DEV_EMAIL = "demo@local.dev";
const DEV_PASSWORD = "demo123";

async function main() {
  if (!serviceKey) {
    console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: list } = await supabase.auth.admin.listUsers();
  const existing = list?.users?.find((u) => u.email === DEV_EMAIL);

  if (existing) {
    console.log(`Dev user already exists: ${DEV_EMAIL}`);
    return;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: DEV_EMAIL,
    password: DEV_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    console.error("Failed to create dev user:", error.message);
    process.exit(1);
  }

  console.log(`Created dev user: ${DEV_EMAIL} / ${DEV_PASSWORD}`);
  console.log(`User id: ${data.user?.id}`);
}

main();
