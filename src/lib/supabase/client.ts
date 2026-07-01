import { createBrowserClient } from "@supabase/ssr";

let client: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (client) return client;

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  return client;
}

export async function getUser() {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error && error.message.includes("stole it")) {
      return (await supabase.auth.getSession()).data;
    }
    return data;
  } catch {
    const { data } = await supabase.auth.getSession();
    return data;
  }
}
