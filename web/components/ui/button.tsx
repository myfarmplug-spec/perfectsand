"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-sand-300/70 active:scale-[0.98]",
  {
    variants: {
      variant: {
        default:
          "bg-sand-500 text-ink-900 shadow-glow hover:-translate-y-0.5 hover:bg-sand-300",
        secondary:
          "bg-white/7 text-white hover:bg-white/12 border border-white/10",
        control:
          "bg-control-500 text-[#021b0a] shadow-control hover:bg-control-400 hover:-translate-y-0.5",
        urge:
          "bg-linear-to-r from-urge-500 via-[#ff865c] to-[#ffb089] text-white shadow-urge hover:-translate-y-0.5",
        ghost: "text-ink-100 hover:bg-white/6",
        outline:
          "border border-white/12 bg-transparent text-white hover:bg-white/6",
      },
      size: {
        default: "h-12 px-5 py-3",
        sm: "h-10 px-4 text-sm",
        lg: "h-14 px-6 text-base",
        icon: "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
