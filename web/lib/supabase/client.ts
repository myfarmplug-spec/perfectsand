import { createBrowserClient } from "@supabase/ssr";

// Gracefully handle missing env vars during static prerendering.
// The client becomes functional at runtime in the browser.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
