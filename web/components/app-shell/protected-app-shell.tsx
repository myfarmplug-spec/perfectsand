"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { useAppState } from "@/components/app-shell/app-provider";
import { WinModal } from "@/components/win/win-modal";

export function ProtectedAppShell({ children }: { children: ReactNode }) {
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
    }
  }, [hydrated, user, state.onboardingComplete, router]);

  if (!hydrated || !user || !state.onboardingComplete) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <>
      <AppShell>{children}</AppShell>
      <WinModal />
    </>
  );
}
