import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import {
  buildDedupeHash,
  extractTextFromPdf,
  extractTransactionsFromText,
} from "@/lib/pdf-parser";
import { categorizeTransaction } from "@/lib/categorizer";
import { syncBudgetAlerts, getCurrentMonthKey } from "@/lib/budget";
import { generateTransferSuggestions } from "@/lib/transfers";
import { revalidateFinancePages } from "@/lib/revalidate";
import { format } from "date-fns";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const user = await getDefaultUser();
    await ensureDefaultData(user.id);

    const formData = await request.formData();
    const file = formData.get("file");
    const accountId = formData.get("accountId");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required." }, { status: 400 });
    }

    if (!accountId || typeof accountId !== "string") {
      return NextResponse.json({ error: "Account is required." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF statements are supported." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "PDF statements must be 20 MB or smaller." },
        { status: 413 },
      );
    }

    const account = await prisma.account.findFirst({
      where: { id: accountId, userId: user.id },
    });

    if (!account) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }

    const uploadsDir = path.join(
      /*turbopackIgnore: true*/ process.cwd(),
      "uploads",
      user.id,
    );
    await mkdir(uploadsDir, { recursive: true });

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== "%PDF-") {
      return NextResponse.json(
        { error: "The uploaded file is not a valid PDF." },
        { status: 400 },
      );
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storedName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadsDir, storedName);
    await writeFile(filePath, buffer);

    const statement = await prisma.statement.create({
      data: {
        fileName: file.name,
        filePath,
        mimeType: file.type || "application/pdf",
        status: "PROCESSING",
        accountId: account.id,
        userId: user.id,
      },
    });

    const rawText = await extractTextFromPdf(buffer);
    const parsedTransactions = extractTransactionsFromText(rawText, {
      fileName: file.name,
    });

    if (parsedTransactions.length === 0) {
      await prisma.statement.update({
        where: { id: statement.id },
        data: {
          status: "FAILED",
          rawText: rawText.slice(0, 50000),
          errorMessage:
            "No transactions detected. The PDF may be scanned or use an unsupported layout.",
        },
      });

      return NextResponse.json(
        {
          error:
            "Could not detect transactions in this PDF. Try a text-based statement export.",
          statementId: statement.id,
        },
        { status: 422 },
      );
    }

    const dates = parsedTransactions.map((transaction) => transaction.date);
    const periodStart = new Date(Math.min(...dates.map((date) => date.getTime())));
    const periodEnd = new Date(Math.max(...dates.map((date) => date.getTime())));

    const candidates: Array<{
      date: Date;
      description: string;
      amount: number;
      dedupeHash: string;
      categoryId: string | undefined;
      confidence: number | undefined;
      status: "CONFIRMED" | "PENDING_REVIEW";
    }> = [];

    for (const parsed of parsedTransactions) {
      const dedupeHash = buildDedupeHash(
        account.id,
        parsed.date,
        parsed.description,
        parsed.amount,
      );

      const existing = await prisma.transaction.findUnique({
        where: { userId_dedupeHash: { userId: user.id, dedupeHash } },
      });

      if (existing) continue;

      const match = await categorizeTransaction(user.id, parsed.description);
      candidates.push({
        date: parsed.date,
        description: parsed.description,
        amount: parsed.amount,
        dedupeHash,
        categoryId: match?.categoryId,
        confidence: match?.confidence,
        status: match && match.confidence >= 0.8 ? "CONFIRMED" : "PENDING_REVIEW",
      });
    }

    // Keep statement status and transaction inserts consistent: an unexpected
    // database failure cannot leave a half-imported statement behind.
    await prisma.$transaction(async (tx) => {
      for (const candidate of candidates) {
        await tx.transaction.create({
          data: {
            ...candidate,
            accountId: account.id,
            statementId: statement.id,
            userId: user.id,
          },
        });
      }

      await tx.statement.update({
        where: { id: statement.id },
        data: {
          status: "PARSED",
          rawText: rawText.slice(0, 50000),
          periodStart,
          periodEnd,
        },
      });
    });
    const createdCount = candidates.length;

    const months = new Set(
      parsedTransactions.map((transaction) =>
        getCurrentMonthKey(transaction.date),
      ),
    );
    for (const month of months) {
      await syncBudgetAlerts(user.id, month);
      await generateTransferSuggestions(user.id, month);
    }
    revalidateFinancePages();

    return NextResponse.json({
      statementId: statement.id,
      createdCount,
      period: {
        start: format(periodStart, "yyyy-MM-dd"),
        end: format(periodEnd, "yyyy-MM-dd"),
      },
      message: `Imported ${createdCount} transaction${createdCount === 1 ? "" : "s"} from ${file.name}.`,
    });
  } catch (error) {
    console.error("Statement upload failed:", error);
    return NextResponse.json(
      { error: "Failed to process PDF statement." },
      { status: 500 },
    );
  }
}
