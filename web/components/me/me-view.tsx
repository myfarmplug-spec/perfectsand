"use client";

import { Download, Flame, LogOut, Shield, TrendingUp } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Heatmap } from "@/components/me/heatmap";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatShortDate } from "@/lib/utils";

export function MeView() {
  const { state, signOut } = useAppState();
  const levelProgress = Math.min(100, (state.controlLevel / 100) * 100);

  function handleExport() {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "perfect-sand-progress.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card className="border-sand-500/16 bg-linear-to-br from-[#171821] to-[#101621]">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-ink-100/65">{state.profile.name}</p>
              <h2 className="text-2xl font-semibold text-white">
                {state.profile.levelName} Level {state.profile.level}
              </h2>
            </div>
            <Badge variant="default">Level up in progress</Badge>
          </div>
          <Progress value={levelProgress} className="h-3" />
          <p className="text-sm text-ink-100/72">
            Small daily wins become unbreakable discipline.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="bg-white/4">
          <CardContent className="space-y-2 px-5 py-5">
            <Flame className="size-5 text-[#ff9d3f]" />
            <p className="text-sm text-ink-100/70">Current Streak</p>
            <p className="text-3xl font-semibold text-white">
              {state.streak.current} days 🔥
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/4">
          <CardContent className="space-y-2 px-5 py-5">
            <TrendingUp className="size-5 text-control-400" />
            <p className="text-sm text-ink-100/70">Longest</p>
            <p className="text-3xl font-semibold text-white">{state.streak.longest} days</p>
          </CardContent>
        </Card>
        <Card className="bg-white/4">
          <CardContent className="space-y-2 px-5 py-5">
            <Shield className="size-5 text-sand-300" />
            <p className="text-sm text-ink-100/70">Total Urges Resisted</p>
            <p className="text-3xl font-semibold text-white">
              {state.urgeHistory.filter((entry) => entry.resisted).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/4">
        <CardHeader>
          <CardTitle>Patterns Heatmap</CardTitle>
          <p className="text-sm text-ink-100/70">
            Your strongest days: Tuesdays &amp; Thursdays
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.completedDays.length ? (
            <Heatmap completedDays={state.completedDays} />
          ) : (
            <p className="text-sm text-ink-100/70">
              Complete your first day to see your patterns.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white/4">
        <CardHeader>
          <CardTitle>Honest Journal</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {state.urgeHistory.length ? (
            state.urgeHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-[24px] border border-white/8 bg-[#121827] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-white">{entry.trigger}</p>
                  <Badge variant={entry.resisted ? "control" : "danger"}>
                    {entry.resisted ? "Resisted" : "Honest slip"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-ink-100/72">
                  {entry.emotion} • {formatShortDate(entry.createdAt)}
                </p>
                <p className="mt-2 text-sm text-ink-100/80">
                  Learned: {entry.learned ?? "Record it, learn, move on"}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink-100/70">
              No urges logged yet. First win starts with honesty.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-sand-500/16 bg-linear-to-r from-[#161d2b] to-[#10151e]">
        <CardHeader>
          <CardTitle>Osa&apos;s Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base text-white">{state.analysisSummary}</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleExport}>
              <Download className="size-4" />
              Export My Progress
            </Button>
            <Button
              variant="ghost"
              className="text-ink-100/55 hover:text-red-400"
              onClick={() => void signOut()}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
