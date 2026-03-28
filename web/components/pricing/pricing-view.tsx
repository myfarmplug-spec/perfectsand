"use client";

import { BadgeCheck, Clock, Coins, Lock, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const earnWays = [
  {
    icon: Lock,
    title: "Lock Today",
    detail: "Complete your daily mission and lock the day — earn +5 tokens.",
    color: "text-control-400",
    bg: "bg-control-500/14",
    border: "border-control-500/24",
  },
  {
    icon: ShieldCheck,
    title: "Resist an Urge",
    detail: "Finish Battle Mode in control. Every win builds your balance.",
    color: "text-[#8eb7ff]",
    bg: "bg-[#3b82f6]/12",
    border: "border-[#3b82f6]/20",
  },
  {
    icon: Sparkles,
    title: "Streak Bonuses",
    detail: "Hit 7, 14, and 30-day streaks for bonus token drops.",
    color: "text-sand-300",
    bg: "bg-sand-500/12",
    border: "border-sand-500/22",
  },
  {
    icon: Zap,
    title: "Daily Check-In",
    detail: "Open the app daily and stay consistent — it adds up.",
    color: "text-[#ffb089]",
    bg: "bg-[#ff8b69]/10",
    border: "border-[#ff8b69]/18",
  },
];

export function PricingView() {
  const { state } = useAppState();

  return (
    <div className="space-y-6">
      {/* Balance header */}
      <Card className="border-sand-500/16 bg-linear-to-br from-[#17141b] via-[#10161e] to-[#101a22]">
        <CardContent className="space-y-4 px-5 py-6">
          <Badge variant="default">Token balance</Badge>
          <h2 className="text-3xl font-semibold text-white">Keep the Fire Burning</h2>
          <p className="text-sm text-ink-100/72">
            Earn tokens by showing up. Every rep counts.
          </p>
          <div className="rounded-[26px] border border-sand-500/18 bg-sand-500/10 p-5">
            <p className="text-sm text-sand-100/80">Current Balance</p>
            <p className="mt-2 text-4xl font-semibold text-white">
              🪙 {state.profile.tokens} tokens
            </p>
            <p className="mt-2 text-sm text-ink-100/55">
              Each Osa reply costs 1 token. Earn them free through progress.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Earn ways */}
      <div>
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-ink-100/55">How to earn tokens</p>
        <div className="grid gap-3">
          {earnWays.map((way) => {
            const Icon = way.icon;
            return (
              <div
                key={way.title}
                className={`flex items-start gap-4 rounded-[24px] border ${way.border} bg-white/4 p-4`}
              >
                <div className={`rounded-full ${way.bg} p-3 ${way.color}`}>
                  <Icon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{way.title}</p>
                  <p className="mt-1 text-sm text-ink-100/65">{way.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Coming soon */}
      <Card className="overflow-hidden border-white/8 bg-white/4">
        <div className="flex items-center gap-2 bg-white/6 px-5 py-3 text-xs font-medium text-ink-100/60">
          <Clock className="size-3.5" />
          Coming soon
        </div>
        <CardContent className="space-y-3 px-5 py-5">
          <div className="flex items-center gap-2">
            <Coins className="size-5 text-sand-300" />
            <p className="font-semibold text-white">Buy Tokens</p>
          </div>
          <p className="text-sm text-ink-100/65">
            Direct token top-ups are on the way — fair NGN prices with no subscriptions.
            For now, earn everything through your daily discipline.
          </p>
          <div className="flex items-center gap-2 rounded-[16px] border border-[#00c853]/18 bg-[#00c853]/8 p-4">
            <BadgeCheck className="size-5 shrink-0 text-[#00c853]" />
            <p className="text-sm text-white">
              Join 2,847 Nigerians already earning tokens the hard way.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
