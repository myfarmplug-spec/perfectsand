"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flame, Shield } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";

export default function Home() {
  const router = useRouter();
  const { hydrated, user, state } = useAppState();

  useEffect(() => {
    if (!hydrated) return;

    if (!user) {
      router.replace("/login");
      return;
    }

    if (!state.onboardingComplete) {
      router.replace("/onboarding");
      return;
    }

    router.replace("/dashboard");
  }, [hydrated, user, state.onboardingComplete, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,rgba(212,160,23,0.18),transparent_34%),linear-gradient(180deg,#0f1117,#0c1017)] px-6">
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-sand-500/20 bg-sand-500/12">
          <Shield className="size-9 text-sand-300" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-sand-300/76">Perfect Sand</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Voice of Osa is loading</h1>
          <p className="mt-3 text-sm text-ink-100/70">Discipline first. Pressure second.</p>
        </div>
        <div className="mx-auto flex items-center justify-center gap-2 text-sand-300">
          <Flame className="size-4 animate-pulse" />
          <span className="text-sm">Setting your control space</span>
        </div>
      </div>
    </main>
  );
}
