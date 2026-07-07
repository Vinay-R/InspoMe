"use client";

import * as React from "react";
import { Mail, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  redirectTo?: string;
  initialError?: string;
  initialSent?: boolean;
}

export function LoginForm({ redirectTo, initialError, initialSent }: Props) {
  const [email, setEmail] = React.useState("");
  const [pending, setPending] = React.useState<"none" | "magic" | "google">("none");
  const [error, setError] = React.useState<string | null>(initialError ?? null);
  const [sent, setSent] = React.useState<boolean>(!!initialSent);

  const supabase = React.useMemo(() => createClient(), []);

  const callbackUrl = React.useMemo(() => {
    if (typeof window === "undefined") return undefined;
    const url = new URL("/auth/callback", window.location.origin);
    if (redirectTo) url.searchParams.set("redirect", redirectTo);
    return url.toString();
  }, [redirectTo]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return;
    setPending("magic");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl },
    });
    setPending("none");
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  async function signInWithGoogle() {
    setError(null);
    setPending("google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      setError(error.message);
      setPending("none");
    }
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3 text-center">
        <div className="mx-auto inline-flex size-10 items-center justify-center rounded-full bg-brand/15 text-brand">
          <Mail className="size-5" />
        </div>
        <div>
          <p className="font-medium">Check your email</p>
          <p className="text-sm text-muted-foreground mt-1">
            We sent a sign-in link to <span className="font-medium text-foreground">{email}</span>.
            It expires in 60 minutes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSent(false)}
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={signInWithGoogle}
        loading={pending === "google"}
        className="w-full"
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={sendMagicLink} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <Button
          type="submit"
          variant="brand"
          size="lg"
          loading={pending === "magic"}
          disabled={!email.trim()}
          className="w-full"
        >
          Send magic link
          <ArrowRight className="size-4" />
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.7h5.2c-.2 1.4-1.6 4.1-5.2 4.1-3.1 0-5.7-2.6-5.7-5.7s2.5-5.7 5.7-5.7c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.7 4.2 14.6 3.2 12 3.2 7.2 3.2 3.3 7.1 3.3 12s3.9 8.8 8.7 8.8c5 0 8.4-3.5 8.4-8.5 0-.6-.1-1-.1-1.5H12z"
      />
    </svg>
  );
}
