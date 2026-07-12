import { createHash } from "crypto";
import { format } from "date-fns";

export type ParsedTransaction = {
  date: Date;
  description: string;
  amount: number;
};

const MONTH_NAME_TO_INDEX: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const FULL_DATE_PATTERNS = [
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
  /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(\d{2,4})/i,
];

const AMOUNT_TOKEN =
  /\(?-?\$?\d{1,3}(?:,\d{3})*\.\d{2}\)?(?:\s*(?:CR|DR|DEBIT|CREDIT))?/gi;

function parseMonthToken(token: string): number | null {
  const key = token.toLowerCase().replace(/\./g, "");
  return MONTH_NAME_TO_INDEX[key] ?? null;
}

function parseFullDate(match: RegExpMatchArray): Date | null {
  const createValidDate = (year: number, month: number, day: number) => {
    const date = new Date(year, month, day);
    return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
      ? date
      : null;
  };

  if (match[2] && Number.isNaN(Number(match[2]))) {
    const day = Number(match[1]);
    const month = parseMonthToken(match[2]);
    if (month === null) return null;
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return createValidDate(year, month, day);
  }

  const part1 = Number(match[1]);
  const part2 = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  if (match[1].length === 4) {
    return createValidDate(part1, part2 - 1, Number(match[3]));
  }

  if (part1 > 12) {
    return createValidDate(year, part2 - 1, part1);
  }

  if (part2 > 12) {
    return createValidDate(year, part1 - 1, part2);
  }

  return createValidDate(year, part1 - 1, part2);
}

function parseAmountToken(raw: string): number | null {
  const upper = raw.toUpperCase();
  const isCredit =
    upper.includes("CR") ||
    upper.includes("CREDIT") ||
    /^\(.*\)$/.test(raw.trim());
  const isDebit = upper.includes("DR") || upper.includes("DEBIT");

  const cleaned = raw.replace(/[$,()\s]/g, "").replace(/(CR|DR|DEBIT|CREDIT)/gi, "");
  const amount = Number.parseFloat(cleaned);
  if (Number.isNaN(amount) || amount === 0) return null;

  if (isCredit) return Math.abs(amount);
  if (isDebit) return -Math.abs(amount);
  return -Math.abs(amount);
}

export function inferStatementPeriod(
  text: string,
  fileName?: string,
): { year: number; month: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();

  const headerMatch = text.match(
    /(?:statement\s+date|statement\s+period|period\s+(?:ending|ended)|as\s+of)\s*:?\s*(\d{1,2})?[,\s-]*(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[,\s-]+(\d{4})/i,
  );

  if (headerMatch) {
    const parsedMonth = parseMonthToken(headerMatch[2]);
    if (parsedMonth !== null) {
      month = parsedMonth;
      year = Number(headerMatch[3]);
      return { year, month };
    }
  }

  const monthYearMatch = text.match(
    /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i,
  );
  if (monthYearMatch) {
    const parsedMonth = parseMonthToken(monthYearMatch[1]);
    if (parsedMonth !== null) {
      return { year: Number(monthYearMatch[2]), month: parsedMonth };
    }
  }

  if (fileName) {
    const fileMonth = fileName.match(
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\b/i,
    );
    const fileYear = fileName.match(/\b(20\d{2})\b/);
    if (fileMonth) {
      const parsedMonth = parseMonthToken(fileMonth[1]);
      if (parsedMonth !== null) month = parsedMonth;
    }
    if (fileYear) year = Number(fileYear[1]);
  }

  return { year, month };
}

function cleanDescription(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/[^\w\s&\-#@*/().']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseDayFirstLine(
  line: string,
  period: { year: number; month: number },
  previousDay: number | null,
): ParsedTransaction | null {
  const match = line.match(/^(\d{1,2})\s+(.+)$/);
  if (!match) return null;

  const day = Number(match[1]);
  if (day < 1 || day > 31) return null;

  const rest = match[2].trim();
  const amountMatches = [...rest.matchAll(AMOUNT_TOKEN)];
  if (amountMatches.length === 0) return null;

  // Prefer the rightmost amount; ignore trailing balance-looking second amounts
  // when the line has exactly two plain amounts and no parentheses credit.
  let amountToken = amountMatches[amountMatches.length - 1][0];
  if (
    amountMatches.length >= 2 &&
    !/^\(.*\)$/.test(amountMatches[0][0].trim()) &&
    !/^\(.*\)$/.test(amountMatches[amountMatches.length - 1][0].trim())
  ) {
    amountToken = amountMatches[0][0];
  }

  // Credits often appear in parentheses.
  const creditToken = amountMatches.find((item) =>
    /^\(.*\)$/.test(item[0].trim()),
  );
  if (creditToken) {
    amountToken = creditToken[0];
  }

  const amount = parseAmountToken(amountToken);
  if (amount === null) return null;

  const description = cleanDescription(
    rest.replace(AMOUNT_TOKEN, " ").replace(/\s+/g, " ").trim(),
  );
  if (description.length < 2) return null;

  // Skip obvious non-transaction rows.
  const upper = description.toUpperCase();
  if (
    /^(ACCOUNT|STATEMENT|TOTAL|BALANCE|PAGE|PAYMENT DUE|CREDIT LIMIT|OVERLIMIT)/.test(
      upper,
    )
  ) {
    return null;
  }

  let year = period.year;
  let month = period.month;

  // Billing cycles can start in the previous month (e.g. 29 then 03).
  if (previousDay !== null && previousDay > 20 && day < 10) {
    // crossed into statement month already; keep current period month
  } else if (previousDay === null && day > 20) {
    // first transactions may belong to previous month
    month = period.month === 0 ? 11 : period.month - 1;
    year = period.month === 0 ? period.year - 1 : period.year;
  } else if (previousDay !== null && previousDay < 10 && day > 20) {
    // shouldn't normally happen mid-statement; keep period month
  }

  const date = new Date(year, month, day);
  if (date.getMonth() !== month || date.getDate() !== day) return null;

  return { date, description, amount };
}

function parseFullDateLine(line: string): ParsedTransaction | null {
  const amountMatches = [...line.matchAll(AMOUNT_TOKEN)];
  if (amountMatches.length === 0) return null;

  let date: Date | null = null;
  let dateMatch: RegExpMatchArray | null = null;

  for (const pattern of FULL_DATE_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      date = parseFullDate(match);
      dateMatch = match;
      break;
    }
  }

  if (!date || Number.isNaN(date.getTime()) || !dateMatch) return null;

  const amountToken = amountMatches[amountMatches.length - 1][0];
  const amount = parseAmountToken(amountToken);
  if (amount === null) return null;

  const description = cleanDescription(
    line
      .replace(dateMatch[0], " ")
      .replace(AMOUNT_TOKEN, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );

  if (description.length < 2) return null;

  return { date, description, amount };
}

export function extractTransactionsFromText(
  text: string,
  options?: { fileName?: string },
): ParsedTransaction[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 2);

  const period = inferStatementPeriod(normalized, options?.fileName);
  const transactions: ParsedTransaction[] = [];
  let previousDay: number | null = null;
  let crossedIntoStatementMonth = false;

  for (const line of lines) {
    let parsed =
      parseFullDateLine(line) ??
      parseDayFirstLine(line, period, previousDay);

    // Refine month crossing for day-first lines once we see the drop.
    if (!parseFullDateLine(line)) {
      const dayMatch = line.match(/^(\d{1,2})\s+/);
      if (dayMatch) {
        const day = Number(dayMatch[1]);
        if (previousDay !== null && previousDay > 20 && day < 15) {
          crossedIntoStatementMonth = true;
        }
        if (
          parsed &&
          !crossedIntoStatementMonth &&
          previousDay === null &&
          day > 20
        ) {
          const month = period.month === 0 ? 11 : period.month - 1;
          const year = period.month === 0 ? period.year - 1 : period.year;
          parsed = {
            ...parsed,
            date: new Date(year, month, day),
          };
        }
        if (day >= 1 && day <= 31) previousDay = day;
      }
    }

    if (parsed) transactions.push(parsed);
  }

  const unique = new Map<string, ParsedTransaction>();
  for (const transaction of transactions) {
    const key = `${format(transaction.date, "yyyy-MM-dd")}|${transaction.description}|${transaction.amount}`;
    unique.set(key, transaction);
  }

  return Array.from(unique.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  );
}

export function buildDedupeHash(
  accountId: string,
  date: Date,
  description: string,
  amount: number,
): string {
  const payload = `${accountId}|${format(date, "yyyy-MM-dd")}|${description.toLowerCase()}|${amount}`;
  return createHash("sha256").update(payload).digest("hex").slice(0, 32);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  // Keep page/line breaks — mergePages:true collapses the statement into one line.
  const { text } = await extractText(pdf, { mergePages: false });

  if (Array.isArray(text)) {
    return text.join("\n");
  }

  return text ?? "";
}
