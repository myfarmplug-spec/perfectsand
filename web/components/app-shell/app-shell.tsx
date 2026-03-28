import type { ReactNode } from "react";

import { BottomNav } from "@/components/app-shell/bottom-nav";
import { InstallPrompt } from "@/components/app-shell/install-prompt";
import { TopBar } from "@/components/app-shell/top-bar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <TopBar />
      <main className="mx-auto flex min-h-[calc(100vh-176px)] w-full max-w-lg flex-col px-4 pb-32 pt-4">
        <InstallPrompt />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
