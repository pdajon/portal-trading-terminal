export type PortalTimeContext = {
  timezone: string;
};

export type PortalTimeParts = {
  displayIso: string;
  epochMs: number;
  traderLocalDateKey: string;
  traderLocalDayOfWeek: number;
  traderLocalHour: number;
  traderLocalMinute: number;
  utcDateKey: string;
};

export type PortalLocalDisplayParts = {
  day: string;
  hour: string;
  minute: string;
  month: string;
  second: string;
  year: string;
};

export type OvernightWindow = {
  endEpochMs: number;
  endTime: string;
  localDateKey: string;
  startEpochMs: number;
  startTime: string;
  timezone: string;
};

const UTC_TIMEZONE = "UTC";
const DEFAULT_OVERNIGHT_START_TIME = "20:00";
const DEFAULT_OVERNIGHT_END_TIME = "05:00";
const WEEKDAY_INDEX: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 0,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

type LocalParts = {
  day: number;
  hour: number;
  minute: number;
  month: number;
  second: number;
  weekday: number;
  year: number;
};

function isValidTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function resolvePortalTimezone(timezone: string | null | undefined, fallback = UTC_TIMEZONE) {
  const candidate = typeof timezone === "string" ? timezone.trim() : "";

  if (candidate && isValidTimezone(candidate)) {
    return candidate;
  }

  return isValidTimezone(fallback) ? fallback : UTC_TIMEZONE;
}

export function getBrowserResolvedTimezone(fallback = UTC_TIMEZONE) {
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : null;

  return resolvePortalTimezone(timezone, fallback);
}

function getFormatter(timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
  });
}

function getLocalParts(epochMs: number, context: PortalTimeContext): LocalParts {
  const timezone = resolvePortalTimezone(context.timezone);
  const parts = getFormatter(timezone).formatToParts(new Date(epochMs));
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const weekday = WEEKDAY_INDEX[values.get("weekday") ?? ""] ?? 0;

  return {
    day: Number(values.get("day")),
    hour: Number(values.get("hour")),
    minute: Number(values.get("minute")),
    month: Number(values.get("month")),
    second: Number(values.get("second")),
    weekday,
    year: Number(values.get("year")),
  };
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(parts: Pick<LocalParts, "day" | "month" | "year">) {
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

export function getPortalLocalDisplayParts(
  epochMs: number,
  context: PortalTimeContext,
): PortalLocalDisplayParts {
  const parts = getLocalParts(epochMs, context);

  return {
    day: pad2(parts.day),
    hour: pad2(parts.hour),
    minute: pad2(parts.minute),
    month: pad2(parts.month),
    second: pad2(parts.second),
    year: String(parts.year),
  };
}

export function getPortalTimeParts(epochMs: number, context: PortalTimeContext): PortalTimeParts {
  const local = getLocalParts(epochMs, context);
  const traderLocalDateKey = localDateKey(local);

  return {
    displayIso: `${traderLocalDateKey}T${pad2(local.hour)}:${pad2(local.minute)}:${pad2(local.second)}`,
    epochMs,
    traderLocalDateKey,
    traderLocalDayOfWeek: local.weekday,
    traderLocalHour: local.hour,
    traderLocalMinute: local.minute,
    utcDateKey: new Date(epochMs).toISOString().slice(0, 10),
  };
}

export function isTraderLocalWeekend(epochMs: number, context: PortalTimeContext) {
  const dayOfWeek = getPortalTimeParts(epochMs, context).traderLocalDayOfWeek;
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function parseDateKey(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!match) {
    throw new Error("Invalid local date key.");
  }

  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function parseTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    throw new Error("Invalid local time.");
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour > 23 || minute > 59) {
    throw new Error("Invalid local time.");
  }

  return {
    hour,
    minute,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

function addLocalDays(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  return new Date(Date.UTC(date.year, date.month - 1, date.day + days))
    .toISOString()
    .slice(0, 10);
}

function zonedLocalTimeToEpochMs(input: {
  dateKey: string;
  hour: number;
  minute: number;
  timezone: string;
}) {
  const date = parseDateKey(input.dateKey);
  const desiredUtcLike = Date.UTC(date.year, date.month - 1, date.day, input.hour, input.minute, 0, 0);
  let epochMs = desiredUtcLike;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = getLocalParts(epochMs, { timezone: input.timezone });
    const actualUtcLike = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
      0,
    );
    const diff = actualUtcLike - desiredUtcLike;

    if (diff === 0) {
      return epochMs;
    }

    epochMs -= diff;
  }

  return epochMs;
}

export function getOvernightWindowForLocalDate(
  localDate: string,
  context: PortalTimeContext,
  options?: { endTime?: string; startTime?: string },
): OvernightWindow {
  const timezone = resolvePortalTimezone(context.timezone);
  const startTime = options?.startTime ?? DEFAULT_OVERNIGHT_START_TIME;
  const endTime = options?.endTime ?? DEFAULT_OVERNIGHT_END_TIME;
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  const endDateKey =
    end.minutesSinceMidnight <= start.minutesSinceMidnight
      ? addLocalDays(localDate, 1)
      : localDate;

  return {
    endEpochMs: zonedLocalTimeToEpochMs({
      dateKey: endDateKey,
      hour: end.hour,
      minute: end.minute,
      timezone,
    }),
    endTime,
    localDateKey: localDate,
    startEpochMs: zonedLocalTimeToEpochMs({
      dateKey: localDate,
      hour: start.hour,
      minute: start.minute,
      timezone,
    }),
    startTime,
    timezone,
  };
}

export function isEpochInOvernightWindow(
  epochMs: number,
  context: PortalTimeContext,
  options?: { endTime?: string; startTime?: string },
) {
  const parts = getPortalTimeParts(epochMs, context);
  const start = parseTime(options?.startTime ?? DEFAULT_OVERNIGHT_START_TIME);
  const end = parseTime(options?.endTime ?? DEFAULT_OVERNIGHT_END_TIME);
  const minutes = parts.traderLocalHour * 60 + parts.traderLocalMinute;

  if (minutes >= start.minutesSinceMidnight) {
    const window = getOvernightWindowForLocalDate(parts.traderLocalDateKey, context, options);
    return epochMs >= window.startEpochMs && epochMs < window.endEpochMs;
  }

  if (minutes < end.minutesSinceMidnight) {
    const window = getOvernightWindowForLocalDate(addLocalDays(parts.traderLocalDateKey, -1), context, options);
    return epochMs >= window.startEpochMs && epochMs < window.endEpochMs;
  }

  return false;
}

export function tradeOverlapsOvernightWindow(
  trade: { endEpochMs: number | null; startEpochMs: number },
  context: PortalTimeContext,
  options?: { endTime?: string; startTime?: string },
) {
  const startEpochMs = trade.startEpochMs;
  const endEpochMs = Math.max(trade.endEpochMs ?? startEpochMs + 1, startEpochMs + 1);
  const dateKeys = new Set<string>();

  [startEpochMs, endEpochMs].forEach((epochMs) => {
    const localDate = getPortalTimeParts(epochMs, context).traderLocalDateKey;
    dateKeys.add(addLocalDays(localDate, -1));
    dateKeys.add(localDate);
    dateKeys.add(addLocalDays(localDate, 1));
  });

  return Array.from(dateKeys).some((dateKey) => {
    const window = getOvernightWindowForLocalDate(dateKey, context, options);
    return startEpochMs < window.endEpochMs && endEpochMs > window.startEpochMs;
  });
}
