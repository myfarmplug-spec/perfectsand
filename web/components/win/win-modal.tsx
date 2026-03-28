"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Share2, Sparkles } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function WinModal() {
  const router = useRouter();
  const { state, closeWinModal } = useAppState();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streakDay = state.streak.current + 1;

  useEffect(() => {
    if (!state.showWinModal || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = 1080;
    canvas.height = 1350;

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, "#0f1117");
    gradient.addColorStop(0.5, "#1b2233");
    gradient.addColorStop(1, "#d4a017");

    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = "rgba(255,255,255,0.08)";
    context.beginPath();
    context.arc(860, 260, 180, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#f5d57d";
    context.font = "bold 88px Inter";
    context.fillText("Perfect Sand", 90, 160);

    context.fillStyle = "#ffffff";
    context.font = "bold 132px Inter";
    context.fillText(`Day ${streakDay} ✅`, 90, 360);

    context.font = "48px Inter";
    context.fillText("You Did Not Break Today 🔥", 90, 470);

    context.fillStyle = "rgba(255,255,255,0.84)";
    context.font = "40px Inter";
    context.fillText(
      `Urges resisted: ${state.winsToday.urgesResisted}`,
      90,
      650
    );
    context.fillText(
      `Routines completed: ${state.winsToday.routinesDone}/3`,
      90,
      730
    );
    context.fillText(`Control Level: ${state.controlLevel}%`, 90, 810);

    context.fillStyle = "#ffffff";
    context.font = "italic 54px Inter";
    context.fillText("Small daily wins become unbreakable discipline.", 90, 1050);
    context.fillText("Voice of Osa", 90, 1180);
  }, [state.controlLevel, state.showWinModal, state.winsToday, streakDay]);

  async function handleShare() {
    if (!canvasRef.current) {
      return;
    }

    const dataUrl = canvasRef.current.toDataURL("image/png");
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], "perfect-sand-win.png", { type: "image/png" });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Perfect Sand",
        text: `I just completed a ${streakDay}-day streak in Perfect Sand 🔥 Join me`,
      });
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = "perfect-sand-win.png";
    anchor.click();
  }

  return (
    <Dialog open={state.showWinModal} onOpenChange={(open) => (!open ? closeWinModal() : null)}>
      <DialogContent className="max-w-lg border-sand-500/18 bg-[#10141f]">
        <DialogHeader>
          <DialogTitle>You Did Not Break Today 🔥</DialogTitle>
          <DialogDescription>
            Small daily wins become unbreakable discipline.
          </DialogDescription>
        </DialogHeader>

        <Card className="overflow-hidden border-sand-500/16 bg-linear-to-br from-[#141a26] to-[#111520]">
          <CardContent className="space-y-4 px-5 py-5">
            <div className="flex items-center gap-2 rounded-full bg-sand-500/12 px-3 py-2 text-sm text-sand-100">
              <Sparkles className="size-4 text-sand-300" />
              Rising sun. Strong finish.
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-[20px] bg-white/5 p-3">
                <p className="text-xs text-ink-100/64">Urges resisted</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {state.winsToday.urgesResisted}
                </p>
              </div>
              <div className="rounded-[20px] bg-white/5 p-3">
                <p className="text-xs text-ink-100/64">Routines completed</p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {state.winsToday.routinesDone}
                </p>
              </div>
              <div className="rounded-[20px] bg-white/5 p-3">
                <p className="text-xs text-ink-100/64">Control Level ↑</p>
                <p className="mt-2 text-2xl font-semibold text-white">{state.controlLevel}%</p>
              </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="grid gap-3">
              <Button size="lg" onClick={handleShare}>
                <Share2 className="size-4" />
                Share My Win
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  closeWinModal();
                  router.push("/osa");
                }}
              >
                Talk to Osa
              </Button>
              <Button variant="ghost" size="lg" onClick={closeWinModal}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
