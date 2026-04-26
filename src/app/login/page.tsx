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
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <Link
            href="/"
            className="self-center inline-flex items-center gap-2 font-semibold tracking-tight text-lg"
          >
            <span className="inline-block size-7 rounded-md bg-brand" />
            InspoMe
          </Link>
          <p className="text-sm text-muted-foreground">
            Save inspiration. Understand why it works.
          </p>
        </div>

        <LoginForm
          redirectTo={params.redirect}
          initialError={params.error}
          initialSent={params.sent === "1"}
        />

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our terms and acknowledge our privacy practices.
        </p>
      </div>
    </main>
  );
}
