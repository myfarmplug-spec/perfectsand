import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default: "border-sand-500/30 bg-sand-500/12 text-sand-100",
        control: "border-control-500/30 bg-control-500/12 text-control-400",
        danger: "border-urge-500/25 bg-urge-500/12 text-[#ffb089]",
        muted: "border-white/8 bg-white/6 text-ink-100/80",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
