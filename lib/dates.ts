/** Parse a date-input value as a local calendar date (YYYY-MM-DD). */
export function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const dateOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]) - 1;
    const day = Number(dateOnly[3]);
    const date = new Date(year, month, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function startOfLocalDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date = new Date()) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    23,
    59,
    59,
    999,
  );
}

/** Return whether a value is a real `yyyy-MM` calendar month. */
export function isValidMonthKey(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(\d{4})-(\d{2})$/);
  return match !== null && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

/** Convert a `yyyy-MM` month key into an inclusive local calendar range. */
export function monthKeyToLocalRange(monthKey: string) {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!isValidMonthKey(monthKey) || !match) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endOfLocalDay(
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    );
    return { start, end };
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const start = new Date(year, monthIndex, 1);
  const end = endOfLocalDay(new Date(year, monthIndex + 1, 0));
  return { start, end };
}
