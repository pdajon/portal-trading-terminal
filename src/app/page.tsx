const features = [
  "Advanced market and limit execution",
  "Order Zones and multi-order logic",
  "Trigger-based entries: touch and candle close",
  "Real-time position and protection management",
];

export const dynamic = "force-static";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(74,163,255,0.14),transparent_24%),radial-gradient(circle_at_right,rgba(232,161,92,0.16),transparent_28%),linear-gradient(180deg,#05070b_0%,#070b12_48%,#04060a_100%)] text-white">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-20" />
      <div className="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(88,166,255,0.18),transparent_60%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-sm font-semibold tracking-[0.28em] text-cyan-200">
              P
            </div>
            <div>
              <p className="text-sm font-medium tracking-[0.32em] text-white/90 uppercase">
                Portal
              </p>
              <p className="text-xs text-white/45">Built on Hyperliquid</p>
            </div>
          </div>
          <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
            Live product site
          </div>
        </header>

        <section className="flex flex-1 items-center py-16 sm:py-20">
          <div className="grid w-full gap-12 lg:grid-cols-[minmax(0,1.1fr)_420px] lg:items-center">
            <div className="max-w-3xl">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.28em] text-white/60">
                Execution-first terminal
              </div>
              <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
                Execution-first crypto trading.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/68 sm:text-xl">
                Portal is a next-generation trading interface built on
                Hyperliquid, focused on advanced execution, trigger-based
                trading, and trader-defined logic.
              </p>

              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {features.map((feature) => (
                  <article
                    key={feature}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_16px_40px_rgba(0,0,0,0.35)] backdrop-blur"
                  >
                    <div className="mb-4 h-px w-full bg-gradient-to-r from-cyan-300/70 via-cyan-300/10 to-transparent" />
                    <p className="text-base leading-7 text-white/88">{feature}</p>
                  </article>
                ))}
              </div>
            </div>

            <aside className="relative">
              <div className="absolute inset-6 rounded-full bg-cyan-400/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0f18]/90 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                      Portal Terminal
                    </p>
                    <p className="mt-2 text-lg font-medium text-white/92">
                      Real-time execution workspace
                    </p>
                  </div>
                  <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">
                    Online
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between text-sm text-white/58">
                      <span>Execution</span>
                      <span>Market / Limit</span>
                    </div>
                    <div className="mt-3 flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-semibold tracking-[-0.04em] text-white">
                          BTC
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          Hyperliquid perp routing
                        </p>
                      </div>
                      <p className="text-sm font-medium text-emerald-300">
                        Trigger armed
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                        Order Zones
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        03
                      </p>
                      <p className="mt-1 text-sm text-white/45">
                        Multi-order logic active
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-white/40">
                        Protection
                      </p>
                      <p className="mt-3 text-2xl font-semibold text-white">
                        Live
                      </p>
                      <p className="mt-1 text-sm text-white/45">
                        Position management synced
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-white/[0.05] to-transparent p-4">
                    <div className="mb-3 flex items-center justify-between text-sm text-white/58">
                      <span>Status</span>
                      <span className="text-emerald-300">Streaming</span>
                    </div>
                    <div className="flex h-28 items-end gap-2">
                      {[32, 48, 41, 64, 59, 76, 68, 86, 74, 95, 88, 104].map(
                        (height, index) => (
                          <div
                            key={height}
                            className="flex-1 rounded-t-full bg-gradient-to-t from-cyan-400/35 to-cyan-300/85"
                            style={{
                              height: `${height}%`,
                              opacity: 0.6 + index * 0.03,
                            }}
                          />
                        ),
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <footer className="border-t border-white/10 py-6 text-sm text-white/50">
          Currently in active development.
        </footer>
      </div>
    </main>
  );
}
