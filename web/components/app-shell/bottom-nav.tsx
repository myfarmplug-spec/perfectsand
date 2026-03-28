"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ListTodo, MessageCircle, Shield, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Home",
    icon: House,
  },
  {
    href: "/today",
    label: "Today",
    icon: ListTodo,
  },
  {
    href: "/urge",
    label: "Urge",
    icon: Shield,
  },
  {
    href: "/osa",
    label: "Osa",
    icon: MessageCircle,
  },
  {
    href: "/me",
    label: "Me",
    icon: UserRound,
  },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/6 bg-[#0f1117]/95 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-2xl">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
        {navItems.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-3 text-xs font-medium transition",
                active
                  ? "bg-sand-500/14 text-sand-100"
                  : "text-ink-100/60 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className={cn("size-5", active ? "text-sand-300" : "")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
