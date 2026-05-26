# Chart Limit Price Armature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the chart instruction toast with a quiet chart-native `Select limit price` armature.

**Architecture:** Keep order/system toast cards intact. Add a focused chart-armature component owned by the chart area, then route chart-based limit placement instructions to that component instead of `PortalToastCard`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Next.js.

---

### Task 1: Chart Armature Renderer

**Files:**
- Create: `src/features/chart/components/chart-limit-price-armature.tsx`
- Modify: `src/features/chart/components/chart-area-placeholder.tsx`
- Modify: `src/components/layout/app-shell.tsx`

- [ ] Create a tiny client component that renders centered `Select limit price` text with horizontal guide segments.
- [ ] Replace the chart instruction `PortalToastCard` usage with the armature component.
- [ ] Change the chart instruction message copy to `Select limit price`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Restart dev server on `http://localhost:3002`.
- [ ] Verify `/terminal` and the Limit -> Click Chart path in browser.
