import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(212,160,23,0.14),transparent_50%),radial-gradient(ellipse_at_bottom,rgba(0,200,83,0.06),transparent_50%),linear-gradient(180deg,#0c0f18,#0f1117)] px-4 py-12">
      {children}
    </main>
  );
}
