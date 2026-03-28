"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Shield } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { triggerOptions } from "@/lib/constants";
import type { TriggerOption } from "@/lib/types";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -32 },
  transition: { duration: 0.28, ease: "easeOut" as const },
};

export function OnboardingFlow() {
  const router = useRouter();
  const { completeOnboarding } = useAppState();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerOption | "">("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");
  const [pending, setPending] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 25 }, (_, i) => currentYear - 18 - i);
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  function buildDob() {
    if (!month || !day || !year) return undefined;
    const m = String(MONTHS.indexOf(month) + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${year}-${m}-${d}`;
  }

  async function handleFinish() {
    if (!name.trim() || !trigger) return;
    setPending(true);
    await completeOnboarding({
      name: name.trim(),
      trigger: trigger as TriggerOption,
      dob: buildDob(),
    });
    router.replace("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(212,160,23,0.13),transparent_55%),linear-gradient(180deg,#0c0f18,#0f1117)] px-5 py-10">
      {/* Progress dots */}
      <div className="mb-8 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i <= step ? "w-8 bg-sand-400" : "w-3 bg-white/15"
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-sm">
        <AnimatePresence mode="wait">

          {/* ── Step 0: Welcome ─────────────────────── */}
          {step === 0 && (
            <motion.div key="welcome" {...slide} className="space-y-6 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-full border border-sand-500/24 bg-sand-500/12">
                <Shield className="size-9 text-sand-300" />
              </div>
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-[0.3em] text-sand-300/80">Perfect Sand</p>
                <h1 className="text-3xl font-semibold text-white">
                  Build unbreakable<br />discipline.
                </h1>
                <p className="text-base leading-relaxed text-ink-100/72">
                  One urge at a time. Osa is with you every step of the way.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-[18px] border border-sand-500/18 bg-sand-500/8 px-5 py-4">
                <span className="text-2xl">🪙</span>
                <div className="text-left">
                  <p className="font-semibold text-white">50 free tokens waiting</p>
                  <p className="text-sm text-sand-300/75">All non-AI features unlimited &amp; free</p>
                </div>
              </div>
              <Button size="lg" className="w-full" onClick={() => setStep(1)}>
                Start Building <ChevronRight className="size-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 1: Name ────────────────────────── */}
          {step === 1 && (
            <motion.div key="name" {...slide} className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.26em] text-sand-300/75">Step 1 of 3</p>
                <h2 className="text-2xl font-semibold text-white">What should Osa call you?</h2>
                <p className="text-sm text-ink-100/65">Your name is private. Only you and Osa see it.</p>
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name or nickname"
                autoFocus
                className="w-full rounded-[18px] border border-white/10 bg-[#111826] px-4 py-3.5 text-base text-white outline-none placeholder:text-ink-100/35 transition focus:border-sand-500/40 focus:ring-1 focus:ring-sand-500/20"
              />
              <Button size="lg" className="w-full" disabled={!name.trim()} onClick={() => setStep(2)}>
                Continue <ChevronRight className="size-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 2: Trigger ─────────────────────── */}
          {step === 2 && (
            <motion.div key="trigger" {...slide} className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.26em] text-sand-300/75">Step 2 of 3</p>
                <h2 className="text-2xl font-semibold text-white">What&apos;s your biggest trigger?</h2>
                <p className="text-sm text-ink-100/65">Osa uses this to personalize support. Be honest.</p>
              </div>
              <div className="space-y-2.5">
                {triggerOptions.map((option) => {
                  const Icon = option.icon;
                  const active = trigger === option.label;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => setTrigger(option.label)}
                      className={`w-full rounded-[20px] border p-4 text-left transition ${
                        active
                          ? "border-sand-500/40 bg-sand-500/12 shadow-[0_0_20px_rgba(212,160,23,0.10)]"
                          : "border-white/8 bg-white/4 hover:border-white/14 hover:bg-white/7"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`rounded-full p-2 ${active ? "bg-sand-500/20 text-sand-300" : "bg-white/8 text-ink-100/60"}`}>
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-medium ${active ? "text-white" : "text-ink-100/85"}`}>{option.label}</p>
                          <p className="mt-0.5 text-xs text-ink-100/55">{option.description}</p>
                        </div>
                        {active && (
                          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sand-500">
                            <svg className="size-3 text-ink-900" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <Button size="lg" className="w-full" disabled={!trigger} onClick={() => setStep(3)}>
                Continue <ChevronRight className="size-4" />
              </Button>
            </motion.div>
          )}

          {/* ── Step 3: DOB + Finish ─────────────────── */}
          {step === 3 && (
            <motion.div key="dob" {...slide} className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.26em] text-sand-300/75">Step 3 of 3</p>
                <h2 className="text-2xl font-semibold text-white">When were you born?</h2>
                <p className="text-sm text-ink-100/65">Optional. This stays private. Osa uses it to personalize.</p>
              </div>

              <Card className="border-white/8 bg-white/4">
                <CardContent className="space-y-4 px-5 py-5">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label: "Month", value: month, setter: setMonth,
                        options: MONTHS.map((m) => ({ value: m, label: m.slice(0, 3) })),
                      },
                      {
                        label: "Day", value: day, setter: setDay,
                        options: days.map((d) => ({ value: String(d), label: String(d) })),
                      },
                      {
                        label: "Year", value: year, setter: setYear,
                        options: years.map((y) => ({ value: String(y), label: String(y) })),
                      },
                    ].map(({ label, value, setter, options }) => (
                      <div key={label} className="space-y-1">
                        <label className="text-xs text-ink-100/55">{label}</label>
                        <select
                          value={value}
                          onChange={(e) => setter(e.target.value)}
                          className="w-full rounded-[14px] border border-white/10 bg-[#111826] px-3 py-2.5 text-sm text-white outline-none transition focus:border-sand-500/40"
                        >
                          <option value="">{label}</option>
                          {options.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  {month && day && year && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 rounded-[14px] border border-control-500/20 bg-control-500/8 px-4 py-2.5"
                    >
                      <span className="text-lg">🎂</span>
                      <p className="text-sm text-control-300">{currentYear - Number(year)} years old</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <div className="rounded-[20px] border border-sand-500/16 bg-sand-500/8 p-5">
                <p className="text-sm italic leading-relaxed text-sand-100/85">
                  &ldquo;Welcome, {name.split(" ")[0] || "warrior"}. Your first day starts now. You&apos;ve got this.&rdquo;
                </p>
                <p className="mt-2 text-xs text-sand-300/65">— Osa</p>
              </div>

              <div className="space-y-3">
                <Button size="lg" className="w-full" disabled={pending} onClick={handleFinish}>
                  {pending ? "Setting up your space…" : "Enter Perfect Sand 🏆"}
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={handleFinish}
                  className="w-full text-center text-sm text-ink-100/50 transition hover:text-ink-100/75"
                >
                  Skip DOB
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep((s) => s - 1)}
          className="mt-8 text-sm text-ink-100/45 transition hover:text-ink-100/70"
        >
          ← Back
        </button>
      )}
    </main>
  );
}
