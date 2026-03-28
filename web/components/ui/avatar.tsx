import * as AvatarPrimitive from "@radix-ui/react-avatar";

import { cn } from "@/lib/utils";

export function Avatar({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-11 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/8",
        className
      )}
      {...props}
    />
  );
}

export function AvatarFallback({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        "flex h-full w-full items-center justify-center bg-linear-to-br from-sand-500 via-[#f1bf53] to-[#8c6611] text-sm font-bold text-ink-900",
        className
      )}
      {...props}
    />
  );
}
