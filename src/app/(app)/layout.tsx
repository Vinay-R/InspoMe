import Link from "next/link";
import { redirect } from "next/navigation";
import { Library, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("onboarding_completed, email")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.onboarding_completed) redirect("/onboarding");

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-3">
          <Link href="/library" className="flex items-center gap-2">
            <span className="inline-block size-6 rounded-md bg-brand" />
            <span className="font-semibold tracking-tight">InspoMe</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Link
              href="/settings"
              className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Settings"
            >
              <Settings className="size-5" />
            </Link>
            <form action="/auth/sign-out" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pb-24 pt-5 md:pb-10">
        {children}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 backdrop-blur md:hidden"
           style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}>
        <div className="mx-auto grid max-w-3xl grid-cols-1 px-5 pt-2">
          <Link
            href="/library"
            className="flex flex-col items-center justify-center gap-0.5 rounded-md py-1.5 text-foreground"
          >
            <Library className="size-6" />
            <span className="text-[11px] font-medium">Library</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
