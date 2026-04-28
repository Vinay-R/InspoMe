// Lazy env access. Public values are read with literal property access so
// Next.js can statically inline them into the client bundle. Dynamic lookups
// (`process.env[name]`) are NOT inlined and silently fail in the browser.

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in .env.local (see .env.example).`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return requireEnv(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey(): string {
    return requireEnv(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
};

export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return requireEnv(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  get geminiApiKey(): string | null {
    return process.env.GEMINI_API_KEY ?? null;
  },
  get cobaltApiUrl(): string | null {
    return process.env.COBALT_API_URL ?? null;
  },
  get cobaltApiKey(): string | null {
    return process.env.COBALT_API_KEY ?? null;
  },
  get apifyApiToken(): string | null {
    return process.env.APIFY_API_TOKEN?.trim() || null;
  },
  get apifyTikTokActor(): string {
    // Default to clockworks/tiktok-scraper. Override via env to swap in an
    // alternate actor. Format: "username/actor-name".
    return process.env.APIFY_TIKTOK_ACTOR?.trim() || "clockworks/tiktok-scraper";
  },
};
