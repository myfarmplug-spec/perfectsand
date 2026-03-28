import type { ReactNode } from "react";

import { ProtectedAppShell } from "@/components/app-shell/protected-app-shell";

export default function MainAppLayout({ children }: { children: ReactNode }) {
  return <ProtectedAppShell>{children}</ProtectedAppShell>;
}
