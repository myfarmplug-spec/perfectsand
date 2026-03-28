"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppState } from "@/components/app-shell/app-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Perfect Sand", subtitle: "Build discipline. One urge at a time." },
  "/today":     { title: "Today's Mission", subtitle: "Complete these to build your sand strong." },
  "/urge":      { title: "Urge Arena", subtitle: "Urges come. You stay in control." },
  "/osa":       { title: "Talking with Osa", subtitle: "Osa is here when the pressure hits." },
  "/me":        { title: "Me", subtitle: "Track the proof that you are getting stronger." },
  "/pricing":   { title: "Tokens", subtitle: "Earn through discipline." },
};

export function TopBar() {
  const pathname = usePathname();
  const { state } = useAppState();
  const heading = pageTitles[pathname] ?? pageTitles["/dashboard"];

  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[#0f1117]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold text-white sm:text-lg">
            {heading.title}
          </h1>
          <p className="hidden truncate text-xs text-ink-100/60 sm:block">{heading.subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {state.dayLocked && (
            <Badge variant="control" className="hidden sm:flex">Locked</Badge>
          )}
          <Link href="/pricing">
            <div className={cn(
              "rounded-full border border-sand-500/20 bg-sand-500/10 px-3 py-1.5 transition hover:bg-sand-500/14"
            )}>
              <p className="text-sm font-semibold text-sand-100">🪙 {state.profile.tokens}</p>
            </div>
          </Link>
          <Button asChild variant="secondary" size="icon" className="size-9 shrink-0">
            <Link href="/me" aria-label="Profile">
              <Avatar className="size-9 border-0 bg-transparent">
                <AvatarFallback className="text-xs">{state.profile.initials}</AvatarFallback>
              </Avatar>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
