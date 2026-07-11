import { createHash } from "crypto";
import { format } from "date-fns";

export type ParsedTransaction = {
  date: Date;
  description: string;
  amount: number;
};

const DATE_PATTERNS = [
  /(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/,
  /(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/,
  /(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})/i,
];

const MONTH_MAP: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const AMOUNT_PATTERN =
  /(?:^|\s)(-?\$?\d{1,3}(?:,\d{3})*(?:\.\d{2})?|\d+\.\d{2})(?:\s*(CR|DR|DEBIT|CREDIT))?$/i;

function parseDateFromMatch(match: RegExpMatchArray): Date | null {
  if (match[2] && Number.isNaN(Number(match[2]))) {
    const day = Number(match[1]);
    const month = MONTH_MAP[match[2].toLowerCase().slice(0, 3)];
    let year = Number(match[3]);
    if (year < 100) year += 2000;
    return new Date(year, month, day);
  }

  const part1 = Number(match[1]);
  const part2 = Number(match[2]);
  let year = Number(match[3]);
  if (year < 100) year += 2000;

  if (match[1].length === 4) {
    return new Date(part1, part2 - 1, Number(match[3]));
  }

  if (part1 > 12) {
    return new Date(year, part2 - 1, part1);
  }

  if (part2 > 12) {
    return new Date(year, part1 - 1, part2);
  }

  return new Date(year, part1 - 1, part2);
}

function parseAmount(raw: string, suffix?: string): number {
  const cleaned = raw.replace(/[$,]/g, "");
  let amount = Number.parseFloat(cleaned);
  if (Number.isNaN(amount)) return 0;

  const normalizedSuffix = suffix?.toUpperCase();
  if (normalizedSuffix === "DR" || normalizedSuffix === "DEBIT") {
    amount = -Math.abs(amount);
  } else if (normalizedSuffix === "CR" || normalizedSuffix === "CREDIT") {
    amount = Math.abs(amount);
  } else if (amount > 0) {
    amount = -Math.abs(amount);
  }

  return amount;
}

export function extractTransactionsFromText(text: string): ParsedTransaction[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 8);

  const transactions: ParsedTransaction[] = [];

  for (const line of lines) {
    const amountMatch = line.match(AMOUNT_PATTERN);
    if (!amountMatch) continue;

    let date: Date | null = null;
    let dateMatchIndex = -1;

    for (const pattern of DATE_PATTERNS) {
      const match = line.match(pattern);
      if (match && match.index !== undefined) {
        date = parseDateFromMatch(match);
        dateMatchIndex = match.index;
        break;
      }
    }

    if (!date || Number.isNaN(date.getTime())) continue;

    const amount = parseAmount(amountMatch[1], amountMatch[2]);
    if (amount === 0) continue;

    const beforeAmount = line.slice(0, amountMatch.index).trim();
    const description = beforeAmount
      .slice(dateMatchIndex + (line.match(DATE_PATTERNS[0])?.[0]?.length ?? 0))
      .replace(/[^\w\s&\-#@]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (description.length < 2) continue;

    transactions.push({ date, description, amount });
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
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  await parser.destroy();
  return result.text;
}
