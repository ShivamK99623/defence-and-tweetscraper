"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DashboardLayout } from "./DashboardLayout";

const AUTH_PATHS = ["/login", "/signup"];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.includes(pathname);

  if (isAuthPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
        {children}
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
