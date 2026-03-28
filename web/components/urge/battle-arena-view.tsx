"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Droplets, Footprints, ShieldAlert, Wind } from "lucide-react";
import { motion } from "framer-motion";

import { useAppState } from "@/components/app-shell/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { battleSteps } from "@/lib/constants";
import { formatTimer } from "@/lib/utils";

const stepIcons = {
  stand: ShieldAlert,
  walk: Footprints,
  water: Droplets,
  breathe: Wind,
  remember: ShieldAlert,
};

export function BattleArenaView() {
  const router = useRouter();
  const {
    state,
    startBattle,
    tickBattle,
    toggleBattleStep,
    finishBattle,
    sendOsaMessage,
  } = useAppState();
  const [osaMessage, setOsaMessage] = useState("Osa is stepping in now...");
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }

    initializedRef.current = true;

    const trigger = state.battle.active
      ? state.battle.trigger
      : (state.profile.primaryTrigger ?? "Porn / Sexual urges");
    const emotion = state.battle.active
      ? state.battle.emotion
      : "Tempted";

    if (!state.battle.active) {
      startBattle(trigger, emotion);
    }

    sendOsaMessage({
      prompt: "User is in Battle Mode right now. Give a short, grounding response.",
      trigger,
      emotion,
    }).then(setOsaMessage);
  }, [sendOsaMessage, startBattle, state.battle.active, state.battle.emotion, state.battle.trigger]);

  useEffect(() => {
    if (!state.battle.active) {
      return;
    }

    const interval = window.setInterval(() => tickBattle(), 1000);
    return () => window.clearInterval(interval);
  }, [state.battle.active, tickBattle]);

  const completed = state.battle.completedSteps.length;
  const finished = state.battle.secondsLeft === 0;

  return (
    <section className="relative -mx-4 min-h-[calc(100vh-96px)] overflow-hidden bg-linear-to-b from-[#2a120e] via-[#15101a] to-[#0f1117] px-4 pb-32 pt-6">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,115,51,0.24),transparent_32%),radial-gradient(circle_at_bottom,rgba(0,200,83,0.16),transparent_26%)]" />
      <div className="relative mx-auto max-w-md space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#ffb089]">
              Battle Mode
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Urge Detected. You’ve got this.
            </h2>
          </div>
          <Button variant="secondary" size="sm" onClick={() => router.push("/osa")}>
            Emergency
          </Button>
        </div>

        <Card className="overflow-hidden border-[#ff8b69]/20 bg-black/28">
          <CardContent className="px-5 py-6 text-center">
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
              className="mx-auto flex size-40 items-center justify-center rounded-full border border-[#ff8b69]/35 bg-white/4 shadow-urge"
            >
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[#ffb089]/80">
                  Time remaining
                </p>
                <p className="mt-2 text-5xl font-semibold text-white">
                  {formatTimer(state.battle.secondsLeft)}
                </p>
              </div>
            </motion.div>
            <p className="mt-5 text-sm text-white/80">
              {finished ? "You made it. Control won." : "Urge peaks and fades. Stay with the process."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-white/8 bg-black/24">
          <CardContent className="space-y-3 px-5 py-5">
            <p className="text-xs uppercase tracking-[0.22em] text-sand-300/72">Osa</p>
            <p className="text-lg leading-relaxed text-white">{osaMessage}</p>
          </CardContent>
        </Card>

        <div className="space-y-3">
          {battleSteps.map((step, index) => {
            const Icon = stepIcons[step.id];
            const active = state.battle.completedSteps.includes(step.id);

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => toggleBattleStep(step.id)}
                className={`w-full rounded-[26px] border p-4 text-left transition ${
                  active
                    ? "border-control-500/32 bg-control-500/12"
                    : "border-white/8 bg-white/5"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`rounded-full p-3 ${
                      active ? "bg-control-500/14 text-control-400" : "bg-white/7 text-[#ffb089]"
                    }`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {index + 1}. {step.title}
                    </p>
                    <p className="mt-1 text-sm text-ink-100/72">{step.detail}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Card className="border-white/8 bg-black/28">
          <CardContent className="space-y-4 px-5 py-5">
            <p className="text-sm text-ink-100/72">
              {completed}/5 steps complete. The more you move, the less the urge owns the moment.
            </p>
            <Button
              variant="control"
              size="lg"
              className="w-full"
              onClick={() => {
                finishBattle(true);
                router.push("/dashboard");
              }}
            >
              I Stayed in Control
            </Button>
            <button
              type="button"
              className="w-full text-center text-sm font-semibold text-[#ffb089]"
              onClick={() => {
                finishBattle(false);
                router.push("/dashboard");
              }}
            >
              I Slipped
            </button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
