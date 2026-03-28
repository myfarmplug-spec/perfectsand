"use client";

import { Download, WifiOff } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function InstallPrompt() {
  const { installReady, isOnline, requestInstall } = useAppState();

  if (!installReady && isOnline) {
    return null;
  }

  return (
    <Card className="mb-4 flex items-center justify-between gap-3 border-sand-500/20 bg-[#171d2b]/90 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-sand-500/15 p-2 text-sand-300">
          {isOnline ? <Download className="size-4" /> : <WifiOff className="size-4" />}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            {isOnline ? "Add to Home Screen" : "Offline mode is active"}
          </p>
          <p className="text-xs text-ink-100/75">
            {isOnline
              ? "Keep Perfect Sand one tap away on your phone."
              : "Local logging still works. We go sync when network returns."}
          </p>
        </div>
      </div>
      {installReady ? (
        <Button variant="secondary" size="sm" onClick={requestInstall}>
          Install
        </Button>
      ) : null}
    </Card>
  );
}
