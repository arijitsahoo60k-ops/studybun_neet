import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey || url.includes("YOUR-PROJECT-REF")) {
  // eslint-disable-next-line no-console
  console.warn(
    "[StudyBun] Supabase env vars are missing or still placeholders. " +
      "Copy .env.example to .env and fill in your project's URL and anon key."
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder");

export const isSupabaseConfigured = Boolean(url && anonKey && !url.includes("YOUR-PROJECT-REF"));
