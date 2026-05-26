import assert from "node:assert/strict";
import test from "node:test";
import {
  getOvernightWindowForLocalDate,
  getPortalTimeParts,
  isEpochInOvernightWindow,
  isTraderLocalWeekend,
  resolvePortalTimezone,
  tradeOverlapsOvernightWindow,
} from "@/features/time/portal-time";

const CHICAGO = { timezone: "America/Chicago" };

test("builds separate UTC and trader-local date keys", () => {
  const parts = getPortalTimeParts(Date.parse("2026-05-23T04:30:00.000Z"), CHICAGO);

  assert.equal(parts.epochMs, Date.parse("2026-05-23T04:30:00.000Z"));
  assert.equal(parts.utcDateKey, "2026-05-23");
  assert.equal(parts.traderLocalDateKey, "2026-05-22");
  assert.equal(parts.traderLocalHour, 23);
  assert.equal(parts.traderLocalMinute, 30);
  assert.equal(parts.traderLocalDayOfWeek, 5);
  assert.equal(parts.displayIso, "2026-05-22T23:30:00");
});

test("detects trader-local weekends in the requested timezone", () => {
  assert.equal(isTraderLocalWeekend(Date.parse("2026-05-24T04:30:00.000Z"), CHICAGO), true);
  assert.equal(isTraderLocalWeekend(Date.parse("2026-05-25T04:30:00.000Z"), CHICAGO), true);
  assert.equal(isTraderLocalWeekend(Date.parse("2026-05-25T05:30:00.000Z"), CHICAGO), false);
});

test("builds the default America/Chicago overnight window for a local date", () => {
  const window = getOvernightWindowForLocalDate("2026-05-22", CHICAGO);

  assert.equal(window.localDateKey, "2026-05-22");
  assert.equal(window.startTime, "20:00");
  assert.equal(window.endTime, "05:00");
  assert.equal(new Date(window.startEpochMs).toISOString(), "2026-05-23T01:00:00.000Z");
  assert.equal(new Date(window.endEpochMs).toISOString(), "2026-05-23T10:00:00.000Z");
});

test("classifies a trade opened before 8 PM and closed after 8 PM as overnight overlap", () => {
  assert.equal(
    tradeOverlapsOvernightWindow(
      {
        endEpochMs: Date.parse("2026-05-23T01:05:00.000Z"),
        startEpochMs: Date.parse("2026-05-23T00:30:00.000Z"),
      },
      CHICAGO,
    ),
    true,
  );
});

test("classifies an epoch opened during the overnight window", () => {
  assert.equal(isEpochInOvernightWindow(Date.parse("2026-05-23T03:00:00.000Z"), CHICAGO), true);
  assert.equal(isEpochInOvernightWindow(Date.parse("2026-05-23T00:59:59.999Z"), CHICAGO), false);
});

test("classifies a trade crossing midnight as overnight overlap", () => {
  assert.equal(
    tradeOverlapsOvernightWindow(
      {
        endEpochMs: Date.parse("2026-05-23T06:30:00.000Z"),
        startEpochMs: Date.parse("2026-05-23T04:30:00.000Z"),
      },
      CHICAGO,
    ),
    true,
  );
});

test("classifies a trade closing after 5 AM with any-overlap logic", () => {
  assert.equal(
    tradeOverlapsOvernightWindow(
      {
        endEpochMs: Date.parse("2026-05-23T11:00:00.000Z"),
        startEpochMs: Date.parse("2026-05-23T09:45:00.000Z"),
      },
      CHICAGO,
    ),
    true,
  );
  assert.equal(isEpochInOvernightWindow(Date.parse("2026-05-23T10:00:00.000Z"), CHICAGO), false);
});

test("keeps overnight windows DST-safe when local clocks spring forward", () => {
  const window = getOvernightWindowForLocalDate("2026-03-07", CHICAGO);

  assert.equal(new Date(window.startEpochMs).toISOString(), "2026-03-08T02:00:00.000Z");
  assert.equal(new Date(window.endEpochMs).toISOString(), "2026-03-08T10:00:00.000Z");
  assert.equal((window.endEpochMs - window.startEpochMs) / 60 / 60 / 1000, 8);
});

test("falls back to UTC for invalid timezones", () => {
  const context = { timezone: "Not/A_Real_Zone" };
  const parts = getPortalTimeParts(Date.parse("2026-05-23T04:30:00.000Z"), context);

  assert.equal(resolvePortalTimezone(context.timezone), "UTC");
  assert.equal(parts.traderLocalDateKey, "2026-05-23");
  assert.equal(parts.traderLocalHour, 4);
});
