"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-sm", className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-24px)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-[32px] border border-white/10 bg-[#10141f] p-6 text-white shadow-2xl outline-none",
          className
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-2 text-ink-100/70 transition hover:bg-white/6 hover:text-white">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export const DialogHeader = ({
  className,
  ...props
}: React.ComponentProps<"div">) => (
  <div className={cn("flex flex-col gap-2", className)} {...props} />
);

export const DialogTitle = ({
  className,
  ...props
}: React.ComponentProps<"h2">) => (
  <h2 className={cn("text-2xl font-semibold text-white", className)} {...props} />
);

export const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<"p">) => (
  <p className={cn("text-sm text-ink-100/80", className)} {...props} />
);
