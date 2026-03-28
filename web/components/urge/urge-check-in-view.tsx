"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

import { useAppState } from "@/components/app-shell/app-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const triggerChoices = [
  "Late night alone",
  "Boredom / idle time",
  "Social media / reels",
  "Explicit content",
  "Stress / anxiety",
  "Someone I like",
  "Other",
];

const emotionChoices = [
  "Tempted",
  "Lonely",
  "Bored",
  "Stressed",
  "Foggy",
  "Anxious",
  "Restless",
];

export function UrgeCheckInView({ onStart }: { onStart: (trigger: string, emotion: string) => void }) {
  const { state } = useAppState();
  const [trigger, setTrigger] = useState<string | null>(null);
  const [emotion, setEmotion] = useState<string | null>(null);

  function handleStart() {
    onStart(
      trigger ?? state.profile.primaryTrigger ?? "Urge",
      emotion ?? "Tempted"
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-7 px-1 pb-10 pt-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[#ff5b2e]/15 p-2.5">
            <ShieldAlert className="size-5 text-[#ff8c6e]" />
          </div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#ffb089]">Battle Mode</p>
        </div>
        <h2 className="text-2xl font-semibold text-white">
          You dey feel the urge?<br />Let&apos;s handle am together.
        </h2>
        <p className="text-sm text-ink-100/65">
          Quick check-in so Osa can meet you exactly where you are.
        </p>
      </div>

      {/* Trigger */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-100/80">What triggered this?</p>
        <div className="flex flex-wrap gap-2">
          {triggerChoices.map((t) => (
            <motion.button
              key={t}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setTrigger(t)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                trigger === t
                  ? "border-[#ff8c6e]/50 bg-[#ff5b2e]/18 text-[#ffb089]"
                  : "border-white/10 bg-white/5 text-ink-100/70 hover:border-white/20 hover:text-white"
              )}
            >
              {t}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Emotion */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-ink-100/80">How are you feeling right now?</p>
        <div className="flex flex-wrap gap-2">
          {emotionChoices.map((e) => (
            <motion.button
              key={e}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={() => setEmotion(e)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition",
                emotion === e
                  ? "border-[#3b82f6]/40 bg-[#3b82f6]/15 text-[#9bc5ff]"
                  : "border-white/10 bg-white/5 text-ink-100/70 hover:border-white/20 hover:text-white"
              )}
            >
              {e}
            </motion.button>
          ))}
        </div>
      </div>

      {/* CTA */}
      <Button
        size="lg"
        className="w-full rounded-[28px] bg-gradient-to-r from-[#ff5b2e] via-[#ff7a3d] to-[#ffb470] py-6 text-base font-semibold text-white shadow-urge"
        onClick={handleStart}
      >
        <ShieldAlert className="size-5" />
        Enter Battle Mode
      </Button>

      {!trigger && !emotion && (
        <p className="text-center text-xs text-ink-100/40">
          You can skip the questions — just tap Enter Battle Mode.
        </p>
      )}
    </div>
  );
}
