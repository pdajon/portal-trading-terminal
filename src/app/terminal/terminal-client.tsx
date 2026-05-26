"use client";

import dynamic from "next/dynamic";

const AppShell = dynamic(
  () => import("@/components/layout/app-shell").then((module) => module.AppShell),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center bg-[#05070B] text-white">
        <div className="text-sm font-medium uppercase tracking-[0.18em] text-cyan-100/56">
          Loading Portal
        </div>
      </main>
    ),
  },
);

export function TerminalClient() {
  return <AppShell />;
}
