"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Info, ShieldAlert, Sparkles } from "lucide-react";

import { useAppState } from "@/components/app-shell/app-provider";
import { Button } from "@/components/ui/button";

const icons = {
  success: Sparkles,
  warning: ShieldAlert,
  info: Info,
};

export function ToastStack() {
  const { notifications, dismissNotification } = useAppState();

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[70] flex flex-col items-center gap-3 px-4">
      <AnimatePresence>
        {notifications.map((notification) => {
          const Icon = icons[notification.variant];

          return (
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-full border border-white/10 bg-[#121826]/95 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-xl"
            >
              <div className="rounded-full bg-white/8 p-2">
                <Icon className="size-4 text-sand-300" />
              </div>
              <p className="flex-1 text-sm text-ink-50">{notification.message}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => dismissNotification(notification.id)}
              >
                Close
              </Button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
