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
  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },
  get tokenEncryptionKey(): string | null {
    return process.env.TOKEN_ENCRYPTION_KEY?.trim() || null;
  },
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
  get upstashRedisRestUrl(): string | null {
    return process.env.UPSTASH_REDIS_REST_URL?.trim() || null;
  },
  get upstashRedisRestToken(): string | null {
    return process.env.UPSTASH_REDIS_REST_TOKEN?.trim() || null;
  },
  // ── Instagram OAuth (Instagram API with Instagram Login) ──
  get metaAppId(): string | null {
    return process.env.META_APP_ID?.trim() || null;
  },
  get metaAppSecret(): string | null {
    return process.env.META_APP_SECRET?.trim() || null;
  },
  /**
   * Public origin of the app. Required when META_APP_ID is set so we can
   * build the redirect URI. Falls back to a Vercel-provided URL in prod or
   * localhost in dev.
   */
  get publicOrigin(): string {
    const v = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (v) return v.replace(/\/$/, "");
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (vercel) return `https://${vercel}`;
    const vercelAny = process.env.VERCEL_URL?.trim();
    if (vercelAny) return `https://${vercelAny}`;
    return "http://localhost:3000";
  },
  get instagramRedirectUri(): string {
    return `${serverEnv.publicOrigin}/api/auth/instagram/callback`;
  },
  // ── TikTok OAuth (deferred, currently stub-only) ──
  get tiktokClientKey(): string | null {
    return process.env.TIKTOK_CLIENT_KEY?.trim() || null;
  },
  get tiktokClientSecret(): string | null {
    return process.env.TIKTOK_CLIENT_SECRET?.trim() || null;
  },
  // While true, all analytics providers use synthetic data. Setting it to
  // false alone doesn't enable real providers — they also need their own
  // credentials. So the precedence is:
  //   ANALYTICS_MOCK_MODE=false AND META_* present → real Instagram
  //   ANALYTICS_MOCK_MODE=false AND TIKTOK_* present → real TikTok
  //   anything else → stub
  get analyticsMockMode(): boolean {
    const v = process.env.ANALYTICS_MOCK_MODE?.trim().toLowerCase();
    return v !== "false" && v !== "0";
  },
};
