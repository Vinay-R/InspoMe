# Instagram OAuth setup (dev-mode)

This walks through wiring real Instagram analytics for **your own account**
(the founder/test-user path). For other users you'll need Meta App Review,
which is out of scope here.

## Prerequisites

- An Instagram account set to **Creator** or **Business** type
  (free toggle inside the IG app: Settings → Account type and tools).
  Personal accounts cannot expose Insights data.
- A Meta developer account at https://developers.facebook.com.

## 1. Create the Meta app

1. Go to https://developers.facebook.com/apps → **Create app**.
2. App type: **Business**.
3. Name it `InspoMe Dev` (or anything — won't be public until review).

## 2. Add the Instagram product

1. In the app dashboard, **Add product** → **Instagram**.
2. Pick **Instagram API setup with Instagram Login** (NOT the deprecated Basic Display).
3. Under "Generate access tokens" → add your Instagram account.

## 3. Configure OAuth

1. In the Instagram product settings → **Business login settings**.
2. Add an **OAuth redirect URI**. Add one entry for each environment you'll use:
   - Production: `https://inspo-me.vercel.app/api/auth/instagram/callback`
   - Local: `http://localhost:3000/api/auth/instagram/callback`
3. Permissions to request:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`

## 4. Add yourself as a test user

While the app is in development mode (which it is by default, no app review),
only **app roles** can authorize:

1. App dashboard → **App roles** → **Roles**.
2. Add your Meta account as **Tester**.
3. Accept the invite (notifications icon in your Meta account).

That's it — you can now authorize on your own Instagram account immediately.

## 5. Grab the credentials

In the Meta app's **App settings → Basic**:

- Copy **App ID** → `META_APP_ID`
- Click **Show** next to **App secret** → `META_APP_SECRET`

## 6. Generate a token encryption key

OAuth tokens get encrypted at rest before going to the database. Generate
a 32-byte hex key locally:

```bash
openssl rand -hex 32
```

Set as `TOKEN_ENCRYPTION_KEY` in your env. **Don't lose this** — losing it
means existing encrypted tokens can't be decrypted (every user has to
re-authorize).

## 7. Drop into Vercel + local `.env.local`

```bash
# Vercel production
vercel env add META_APP_ID production
vercel env add META_APP_SECRET production
vercel env add TOKEN_ENCRYPTION_KEY production
vercel env add NEXT_PUBLIC_APP_URL production  # https://inspo-me.vercel.app

# Local
cat >> .env.local <<EOF
META_APP_ID=<your app id>
META_APP_SECRET=<your app secret>
TOKEN_ENCRYPTION_KEY=<output of openssl rand -hex 32>
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

## 8. Try it

1. Sign in to InspoMe → Analytics tab → **Connect Instagram**.
2. Instagram authorize page loads → log in (must be the test-user account) → Allow.
3. Bounced back to `/analytics?ig_connected=1`. Initial sync runs in the
   background; the page polls and refreshes when done.

## Troubleshooting

| Error code (in `/analytics?ig_error=`) | What it means | Fix |
|---|---|---|
| `state_mismatch` | OAuth state cookie expired or you switched tabs | Re-try from the original tab |
| `token_exchange_failed` | App ID/secret wrong, or redirect URI doesn't match | Double-check `META_APP_ID`, `META_APP_SECRET`, and that the **exact** callback URL is registered in the Meta app |
| `long_lived_exchange_failed` | App secret wrong | Verify `META_APP_SECRET` |
| `provider_unavailable` | Env vars not set on this deployment | Add the env vars and redeploy |
| Empty sync (no posts) | Account isn't Creator/Business type, or it has no media | Switch the IG account type in the IG app's settings |

## Production rollout (later)

To let users other than test-users connect:

1. Meta app dashboard → **App review** → request:
   - `instagram_business_basic`
   - `instagram_business_manage_insights`
2. Provide a demo video showing the OAuth flow and what we do with the data.
3. Wait 1–4 weeks for approval.
4. Switch the Meta app from **Development** to **Live** mode.

Until then, only Roles-listed accounts can authorize.
