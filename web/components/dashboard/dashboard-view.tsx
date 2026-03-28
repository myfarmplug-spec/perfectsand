"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Flame,
  Lock,
  MessageCircle,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

import { useAppState } from "@/components/app-shell/app-provider";
import { ControlLevelRing } from "@/components/dashboard/control-level-ring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { missionIcons, motivationalTruths } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const router = useRouter();
  const { state, lockToday } = useAppState();
  const heroLabel = state.controlLevel >= 65 ? "You’re building momentum" : "Strong today 🔥";
  const missionProgress = [
    {
      key: "morning" as const,
      label: "Morning",
      done: state.mission.morning.items.some((item) => item.completed),
    },
    {
      key: "focus" as const,
      label: "Work Blocks",
      done: state.mission.focus.completed > 0,
    },
    {
      key: "night" as const,
      label: "Night Shutdown",
      done: state.mission.night.items.some((item) => item.completed),
    },
  ];

  function handleUrgePress() {
    router.push("/urge");
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-sand-500/14 bg-linear-to-br from-[#17131d] via-[#101520] to-[#0f151d]">
        <CardContent className="px-5 pb-6 pt-8">
          <div className="mb-6 flex items-center justify-between">
            <Badge variant="default">Join 2,847 Nigerians building discipline</Badge>
            <Badge variant="muted">Day starter</Badge>
          </div>
          <ControlLevelRing value={state.controlLevel} label={heroLabel} />

          <div className="mt-6 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2 rounded-full bg-white/6 px-4 py-2 text-white">
              <Flame className="size-5 animate-pulse text-[#ff9d3f]" />
              <span className="text-lg font-semibold">{state.streak.current} Day Streak 🔥</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-white/6 bg-white/4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today&apos;s Wins</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3 overflow-x-auto pb-5">
            <div className="min-w-[160px] rounded-[22px] border border-white/6 bg-[#121827] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-ink-100/60">
                Urges Resisted
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {state.winsToday.urgesResisted}
              </p>
            </div>
            <div className="min-w-[160px] rounded-[22px] border border-white/6 bg-[#121827] p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-ink-100/60">
                Routines Done
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {state.winsToday.routinesDone}/3
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/6 bg-white/4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today&apos;s Mission progress</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 pb-5">
            {missionProgress.map((item) => {
              const Icon = missionIcons[item.key];
              return (
                <div
                  key={item.key}
                  className="flex flex-col items-center gap-3 rounded-[22px] border border-white/6 bg-[#121827] p-4 text-center"
                >
                  <div
                    className={cn(
                      "flex size-14 items-center justify-center rounded-full border",
                      item.done
                        ? "border-control-500/40 bg-control-500/16 text-control-400"
                        : "border-white/8 bg-white/4 text-ink-100/70"
                    )}
                  >
                    <Icon className="size-5" />
                  </div>
                  <p className="text-xs font-medium text-ink-100/80">{item.label}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4">
        <motion.button
          whileTap={{ scale: 0.985 }}
          onClick={handleUrgePress}
          className="group relative overflow-hidden rounded-[30px] border border-[#ff8c6e]/24 bg-linear-to-r from-[#ff5b2e] via-[#ff7a3d] to-[#ffb470] p-5 text-left shadow-urge"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_36%)]" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-white/75">Quick action</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">I Feel an Urge</h2>
              <p className="mt-2 max-w-xs text-sm text-white/80">
                Battle Mode comes on immediately and Osa starts talking to you.
              </p>
            </div>
            <ShieldAlert className="mt-1 size-8 text-white" />
          </div>
        </motion.button>

        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            variant="secondary"
            className="h-auto justify-between rounded-[28px] border border-[#3b82f6]/18 bg-linear-to-br from-[#102038] to-[#0f1521] px-5 py-5"
            onClick={() => router.push("/osa")}
          >
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.22em] text-[#9bc5ff]">
                Osa support
              </p>
              <p className="mt-2 text-xl text-white">Speak to Osa</p>
            </div>
            <MessageCircle className="size-6 text-[#8eb7ff]" />
          </Button>

          <Button
            variant="control"
            className="h-auto justify-between rounded-[28px] px-5 py-5"
            onClick={lockToday}
          >
            <div className="text-left">
              <p className="text-xs uppercase tracking-[0.22em] text-[#064718]">
                Daily win
              </p>
              <p className="mt-2 text-xl">Lock Today ✓</p>
            </div>
            <Lock className="size-6" />
          </Button>
        </div>
      </div>

      <Card className="border-sand-500/12 bg-linear-to-r from-[#151b26] to-[#101621]">
        <CardContent className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm italic text-sand-100">{motivationalTruths[2]}</p>
            <p className="mt-2 text-xs text-ink-100/70">
              Small daily wins become unbreakable discipline.
            </p>
          </div>
          <Button asChild variant="ghost" className="justify-start sm:justify-center">
            <Link href="/today">
              Today&apos;s Mission
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="border-white/6 bg-white/4">
        <CardContent className="flex items-center justify-between gap-4 px-5 py-5">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-white">Shareable wins are ready</p>
            <p className="text-sm text-ink-100/72">
              Turn today&apos;s streak into something you can post.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/6 px-3 py-2 text-sm text-white">
            <Sparkles className="size-4 text-sand-300" />
            Viral-ready
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
