"use client";

import { motion } from "framer-motion";

type ControlLevelRingProps = {
  value: number;
  label: string;
};

export function ControlLevelRing({ value, label }: ControlLevelRingProps) {
  const radius = 104;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (value / 100) * circumference;

  return (
    <div className="relative mx-auto flex size-[280px] items-center justify-center sm:size-[320px]">
      <div className="absolute inset-4 rounded-full bg-linear-to-br from-sand-500/10 via-white/4 to-control-500/10 blur-2xl" />
      <svg
        viewBox="0 0 260 260"
        className="absolute inset-0 -rotate-90 drop-shadow-[0_20px_40px_rgba(0,0,0,0.35)]"
      >
        <defs>
          <linearGradient id="controlRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4a017" />
            <stop offset="55%" stopColor="#f6d775" />
            <stop offset="100%" stopColor="#00c853" />
          </linearGradient>
        </defs>
        <circle
          cx="130"
          cy="130"
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="18"
          fill="none"
        />
        <motion.circle
          cx="130"
          cy="130"
          r={radius}
          stroke="url(#controlRingGradient)"
          strokeWidth="18"
          strokeLinecap="round"
          fill="none"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: progress }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeDasharray={circumference}
        />
      </svg>

      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative flex size-[72%] flex-col items-center justify-center rounded-full border border-white/8 bg-[#111826]/90 text-center shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
      >
        <p className="text-xs uppercase tracking-[0.28em] text-sand-300/70">
          Control Level
        </p>
        <p className="mt-3 text-6xl font-semibold text-white sm:text-7xl">{value}%</p>
        <p className="mt-3 max-w-[14rem] text-sm text-ink-100/75">{label}</p>
      </motion.div>
    </div>
  );
}
