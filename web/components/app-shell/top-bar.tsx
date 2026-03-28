"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAppState } from "@/components/app-shell/app-provider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  "/dashboard": { title: "Perfect Sand", subtitle: "Build unbreakable discipline. One urge at a time." },
  "/today":     { title: "Today's Mission", subtitle: "Complete these to build your sand strong." },
  "/urge":      { title: "Urge Arena", subtitle: "Urges come. You stay in control." },
  "/osa":       { title: "Talking with Osa", subtitle: "Osa is here when the pressure hits." },
  "/me":        { title: "Me", subtitle: "Track the proof that you are getting stronger." },
  "/pricing":   { title: "Keep the Fire Burning", subtitle: "Fair pricing. Strong support. No stress." },
};

export function TopBar() {
  const pathname = usePathname();
  const { state } = useAppState();
  const heading = pageTitles[pathname] ?? pageTitles["/dashboard"];

  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-[#0f1117]/90 px-4 pb-4 pt-safe-top backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 pt-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.24em] text-sand-300/80">Voice of Osa</p>
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold text-white sm:text-2xl">
              {heading.title}
            </h1>
            {state.dayLocked && <Badge variant="control">Locked Today</Badge>}
          </div>
          <p className="truncate text-sm text-ink-100/70">{heading.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/pricing" className="min-w-0">
            <div className={cn(
              "rounded-full border border-sand-500/20 bg-sand-500/10 px-3 py-2 text-right transition hover:bg-sand-500/14"
            )}>
              <p className="text-sm font-semibold text-sand-100">🪙 {state.profile.tokens}</p>
              <p className="text-xs text-sand-300/80">Buy</p>
            </div>
          </Link>
          <Button asChild variant="secondary" size="icon" className="shrink-0">
            <Link href="/me" aria-label="Profile">
              <Avatar className="size-11 border-0 bg-transparent">
                <AvatarFallback>{state.profile.initials}</AvatarFallback>
              </Avatar>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
