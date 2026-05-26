import type { DisciplineRuleState } from "./discipline-server-state";

export type BlockedTimeWindowRule = {
  daysOfWeek?: number[];
  enabled: boolean;
  endTime: string;
  id: string;
  label?: string;
  source?: "manual" | "operator_diagnosis";
  sourceFindingId?: string;
  startTime: string;
  state?: DisciplineRuleState;
  timezone?: string;
};

export function isBlockedTimeWindowActive(rule: BlockedTimeWindowRule, now = new Date()) {
  if (!rule.enabled) {
    return false;
  }

  const startMinutes = parseTimeToMinutes(rule.startTime);
  const endMinutes = parseTimeToMinutes(rule.endTime);

  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) {
    return false;
  }

  const localParts = getLocalTimeParts(now, rule.timezone);

  if (
    rule.daysOfWeek &&
    rule.daysOfWeek.length > 0 &&
    !rule.daysOfWeek.includes(localParts.dayOfWeek)
  ) {
    return false;
  }

  if (startMinutes < endMinutes) {
    return localParts.minutesSinceMidnight >= startMinutes &&
      localParts.minutesSinceMidnight < endMinutes;
  }

  return localParts.minutesSinceMidnight >= startMinutes ||
    localParts.minutesSinceMidnight < endMinutes;
}

export function deriveBlockedTimeWindowRuleState(
  rule: BlockedTimeWindowRule,
  now = new Date(),
): DisciplineRuleState {
  if (rule.state === "overridden") {
    return "overridden";
  }

  if (!rule.enabled) {
    return "inactive";
  }

  return isBlockedTimeWindowActive(rule, now) ? "locked" : "active";
}

export function parseBlockedTimeWindowValue(
  value: Record<string, unknown>,
): Pick<BlockedTimeWindowRule, "daysOfWeek" | "endTime" | "label" | "startTime" | "timezone"> | null {
  const startTime = getString(value, "startTime") ?? getString(value, "start");
  const endTime = getString(value, "endTime") ?? getString(value, "end");

  if (isValidTime(startTime) && isValidTime(endTime)) {
    return {
      daysOfWeek: getDaysOfWeek(value.daysOfWeek),
      endTime,
      label: getString(value, "label") ?? undefined,
      startTime,
      timezone: getString(value, "timezone") ?? undefined,
    };
  }

  const windowValue = getString(value, "window") ?? getString(value, "label");
  const parsedWindow = windowValue ? parseWindowLabel(windowValue) : null;

  if (parsedWindow) {
    return {
      daysOfWeek: getDaysOfWeek(value.daysOfWeek),
      endTime: parsedWindow.endTime,
      label: getString(value, "label") ?? windowValue ?? undefined,
      startTime: parsedWindow.startTime,
      timezone: getString(value, "timezone") ?? undefined,
    };
  }

  const hour = value.hour;
  if (typeof hour === "number" && Number.isInteger(hour) && hour >= 0 && hour <= 23) {
    return {
      daysOfWeek: getDaysOfWeek(value.daysOfWeek),
      endTime: `${String((hour + 1) % 24).padStart(2, "0")}:00`,
      label: getString(value, "label") ?? undefined,
      startTime: `${String(hour).padStart(2, "0")}:00`,
      timezone: getString(value, "timezone") ?? undefined,
    };
  }

  return null;
}

function parseWindowLabel(value: string) {
  const match = value.match(/(\d{1,2}:\d{2})\s*[-–→]\s*(\d{1,2}:\d{2})/);

  if (!match) {
    return null;
  }

  const startTime = normalizeTime(match[1]);
  const endTime = normalizeTime(match[2]);

  return isValidTime(startTime) && isValidTime(endTime) ? { endTime, startTime } : null;
}

function parseTimeToMinutes(value: string) {
  if (!isValidTime(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function isValidTime(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  const match = value.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return false;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function normalizeTime(value: string) {
  const [hours, minutes] = value.split(":");
  return `${hours.padStart(2, "0")}:${minutes}`;
}

function getLocalTimeParts(now: Date, timezone?: string) {
  if (!timezone) {
    return {
      dayOfWeek: now.getDay(),
      minutesSinceMidnight: now.getHours() * 60 + now.getMinutes(),
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      timeZone: timezone,
      weekday: "short",
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? NaN);
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? NaN);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const dayOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday ?? "");

    if (Number.isFinite(hour) && Number.isFinite(minute) && dayOfWeek >= 0) {
      return {
        dayOfWeek,
        minutesSinceMidnight: hour * 60 + minute,
      };
    }
  } catch {
    // Fall back to process-local time when an unsupported timezone is provided.
  }

  return {
    dayOfWeek: now.getDay(),
    minutesSinceMidnight: now.getHours() * 60 + now.getMinutes(),
  };
}

function getString(value: Record<string, unknown>, key: string) {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0
    ? candidate.trim()
    : null;
}

function getDaysOfWeek(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const days = value
    .filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6);

  return days.length > 0 ? Array.from(new Set(days)) : undefined;
}
