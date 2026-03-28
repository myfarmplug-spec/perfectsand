"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2, ChevronDown, Circle, Loader2,
  MoonStar, Sunrise, Target, Timer,
} from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatTimer } from "@/lib/utils";

const FOCUS_DURATION = 90 * 60;

export function TodayView() {
  const { state, toggleMissionItem, completeFocusBlock, lockToday } = useAppState();
  const [openSection, setOpenSection] = useState<"morning" | "focus" | "night" | null>("morning");
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusSecondsLeft, setFocusSecondsLeft] = useState(FOCUS_DURATION);
  const [focusIntervalId, setFocusIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);
  const [locking, setLocking] = useState(false);

  function startFocusTimer() {
    if (focusRunning) return;
    setFocusRunning(true);
    const id = setInterval(() => {
      setFocusSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setFocusRunning(false);
          completeFocusBlock();
          return FOCUS_DURATION;
        }
        return prev - 1;
      });
    }, 1000);
    setFocusIntervalId(id);
  }

  function stopFocusTimer() {
    if (focusIntervalId) clearInterval(focusIntervalId);
    setFocusRunning(false);
    setFocusSecondsLeft(FOCUS_DURATION);
  }

  async function handleLockToday() {
    setLocking(true);
    await lockToday();
    setLocking(false);
  }

  const morningItems = state.mission.morning.items;
  const nightItems = state.mission.night.items;
  const morningDone = morningItems.filter((i) => i.completed).length;
  const nightDone = nightItems.filter((i) => i.completed).length;
  const focusDone = state.mission.focus.completed;
  const focusGoal = state.mission.focus.goal;

  const totalItems = morningItems.length + nightItems.length + focusGoal;
  const totalDone = morningDone + nightDone + Math.min(focusDone, focusGoal);
  const overallPct = Math.round((totalDone / Math.max(totalItems, 1)) * 100);

  const sections = [
    { id: "morning" as const, icon: Sunrise, label: "Morning Routine", emoji: "🌅", done: morningDone, total: morningItems.length },
    { id: "focus" as const, icon: Target, label: "Focus Blocks", emoji: "💼", done: Math.min(focusDone, focusGoal), total: focusGoal },
    { id: "night" as const, icon: MoonStar, label: "Night Shutdown", emoji: "🌙", done: nightDone, total: nightItems.length },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <Card className="border-white/8 bg-linear-to-br from-[#151b26] to-[#10141f]">
        <CardContent className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-sand-300/75">Today&apos;s Mission</p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                Complete these to build your sand strong.
              </h2>
            </div>
            {state.dayLocked && <Badge variant="control" className="shrink-0">Day Locked 🔒</Badge>}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-100/65">{totalDone} of {totalItems} complete</span>
              <span className="font-medium text-white">{overallPct}%</span>
            </div>
            <Progress value={overallPct} className="h-2.5" />
          </div>
        </CardContent>
      </Card>

      {/* Accordion sections */}
      <div className="space-y-3">
        {sections.map(({ id, icon: Icon, label, emoji, done, total }) => {
          const isOpen = openSection === id;
          const allDone = done === total;

          return (
            <Card key={id} className={`overflow-hidden border-white/8 ${allDone ? "bg-control-500/6" : "bg-white/4"}`}>
              <button
                type="button"
                onClick={() => setOpenSection(isOpen ? null : id)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/4"
              >
                <div className={`rounded-full p-2 ${allDone ? "bg-control-500/20 text-control-400" : "bg-white/8 text-ink-100/60"}`}>
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">{emoji} {label}</span>
                    {allDone && <Badge variant="control" className="text-xs">Done</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-100/55">{done}/{total} complete</p>
                </div>
                <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="size-4 text-ink-100/45" />
                </motion.div>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-white/6 px-5 pb-5 pt-4">

                      {/* Morning checklist */}
                      {id === "morning" && (
                        <>
                          <p className="text-xs text-ink-100/55">{state.mission.morning.subtitle}</p>
                          {morningItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleMissionItem("morning", item.id)}
                              className="flex w-full items-center gap-3 rounded-[16px] border border-white/6 bg-white/4 px-4 py-3 text-left transition hover:bg-white/7 active:scale-[0.99]"
                            >
                              <motion.div animate={{ scale: item.completed ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.25 }}>
                                {item.completed
                                  ? <CheckCircle2 className="size-5 text-control-400" />
                                  : <Circle className="size-5 text-ink-100/35" />}
                              </motion.div>
                              <span className={`text-sm ${item.completed ? "text-ink-100/55 line-through" : "text-white"}`}>
                                {item.label}
                              </span>
                            </button>
                          ))}
                        </>
                      )}

                      {/* Focus blocks */}
                      {id === "focus" && (
                        <div className="space-y-4">
                          <p className="text-xs text-ink-100/55">90-minute deep work sessions. No distractions.</p>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: focusGoal }).map((_, i) => (
                              <div
                                key={i}
                                className={`flex-1 rounded-full py-2 text-center text-sm font-medium ${
                                  i < focusDone ? "bg-control-500/20 text-control-300" : "bg-white/6 text-ink-100/45"
                                }`}
                              >
                                {i < focusDone ? "✓ Done" : `Block ${i + 1}`}
                              </div>
                            ))}
                          </div>

                          {focusRunning && (
                            <motion.div
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex flex-col items-center gap-2 rounded-[20px] border border-sand-500/20 bg-sand-500/8 py-6"
                            >
                              <Timer className="size-5 text-sand-300" />
                              <p className="text-4xl font-semibold tabular-nums text-white">
                                {formatTimer(focusSecondsLeft)}
                              </p>
                              <p className="text-xs text-ink-100/55">Stay focused. You can do this.</p>
                            </motion.div>
                          )}

                          {focusRunning ? (
                            <Button variant="secondary" className="w-full" onClick={stopFocusTimer}>
                              Stop Timer
                            </Button>
                          ) : (
                            <Button className="w-full" onClick={startFocusTimer} disabled={focusDone >= focusGoal}>
                              <Timer className="size-4" />
                              {focusDone >= focusGoal ? "All blocks done! 💼" : "Start 90-min Focus Block"}
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Night checklist */}
                      {id === "night" && (
                        <>
                          <p className="text-xs text-ink-100/55">{state.mission.night.subtitle}</p>
                          {nightItems.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => toggleMissionItem("night", item.id)}
                              className="flex w-full items-center gap-3 rounded-[16px] border border-white/6 bg-white/4 px-4 py-3 text-left transition hover:bg-white/7 active:scale-[0.99]"
                            >
                              <motion.div animate={{ scale: item.completed ? [1, 1.2, 1] : 1 }} transition={{ duration: 0.25 }}>
                                {item.completed
                                  ? <CheckCircle2 className="size-5 text-control-400" />
                                  : <Circle className="size-5 text-ink-100/35" />}
                              </motion.div>
                              <span className={`text-sm ${item.completed ? "text-ink-100/55 line-through" : "text-white"}`}>
                                {item.label}
                              </span>
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      {/* Lock Today CTA */}
      <Card className="border-[#00c853]/18 bg-linear-to-br from-[#0d1f16] to-[#0f1621]">
        <CardContent className="space-y-4 px-5 py-5">
          <div>
            <h3 className="font-semibold text-white">Mark Day Complete</h3>
            <p className="mt-1 text-sm text-ink-100/65">
              Lock in today&apos;s progress. Earn +5 tokens. Build your streak.
            </p>
          </div>

          {state.dayLocked ? (
            <div className="flex items-center gap-2 rounded-[16px] border border-[#00c853]/24 bg-[#00c853]/10 px-4 py-3">
              <CheckCircle2 className="size-5 text-[#00c853]" />
              <p className="text-sm text-[#4ade80]">You held body today! 🔥 Day is locked.</p>
            </div>
          ) : (
            <Button
              size="lg"
              className="w-full bg-[#00c853] text-black hover:bg-[#00e676] active:scale-[0.98]"
              disabled={locking}
              onClick={() => void handleLockToday()}
            >
              {locking ? (
                <><Loader2 className="size-4 animate-spin" />Locking today…</>
              ) : (
                "Lock Today — +5 tokens 🔒"
              )}
            </Button>
          )}

          <p className="text-center text-xs text-ink-100/40">
            Non-AI features are always free. Tokens only for Osa AI replies.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
