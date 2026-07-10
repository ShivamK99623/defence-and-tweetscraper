"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shield,
  Swords,
  Anchor,
  Plane,
  LifeBuoy,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/constants";
import { useState } from "react";

const iconMap = {
  LayoutDashboard,
  Shield,
  Swords,
  Anchor,
  Plane,
  LifeBuoy,
  MapPin,
};

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        "lg:relative lg:z-auto lg:translate-x-0 lg:transition-[width]",
        collapsed ? "lg:w-16" : "lg:w-64"
      )}
    >
      <div className="flex h-16 items-center border-b border-slate-200 px-4">
        {(!collapsed || mobileOpen) && (
          <div className="min-w-0 flex-1 lg:block">
            <p className="text-sm font-medium uppercase tracking-wider text-saffron">
              Ministry of Defence
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          aria-label="Close navigation menu"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:block",
            collapsed ? "mx-auto" : "ml-auto"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap];
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "border-l-2 border-defence-green bg-defence-green/10 text-defence-green"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
              title={item.label}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("border-t border-slate-200 p-4", collapsed && "lg:hidden")}>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/auth/login", { method: "DELETE" });
            window.location.href = "/login";
          }}
          className="mb-3 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
        <p className="text-xs text-slate-500">Defence Media Intelligence Platform</p>
        <p className="mt-1 text-xs text-slate-400">v1.0.0 · Classified</p>
      </div>
    </aside>
  );
}
