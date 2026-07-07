import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign in — InspoMe",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(params.redirect ?? "/");
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-sm flex flex-col gap-7">
        <div className="flex flex-col items-center gap-3.5 text-center">
          <span className="size-[52px] rounded-[14px] bg-brand" />
          <div>
            <h1 className="h-page text-2xl">Welcome to InspoMe</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Save the content you admire. Understand why it works.
            </p>
          </div>
        </div>

        <LoginForm
          redirectTo={params.redirect}
          initialError={params.error}
          initialSent={params.sent === "1"}
        />

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link
            href="/terms"
            className="underline underline-offset-4 hover:text-foreground"
          >
            terms
          </Link>{" "}
          and acknowledge our{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-4 hover:text-foreground"
          >
            privacy practices
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
