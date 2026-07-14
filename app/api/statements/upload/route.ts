import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { convexServerClient, errorResponse } from "@/lib/convex-server";
import { extractTextFromPdf, extractTransactionsFromText } from "@/lib/pdf-parser";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData(); const file = form.get("file"); const accountId = form.get("accountId");
    if (!(file instanceof File) || typeof accountId !== "string") return NextResponse.json({ error: "Choose an account and PDF statement." }, { status: 400 });
    if (file.size > MAX_UPLOAD_BYTES || (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf"))) return NextResponse.json({ error: "Upload a PDF of 20 MB or less." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== "%PDF-") return NextResponse.json({ error: "The uploaded file is not a valid PDF." }, { status: 400 });
    // The original PDF and extracted text exist only in this request's memory.
    const parsed = extractTransactionsFromText(await extractTextFromPdf(buffer), { fileName: file.name });
    if (parsed.length === 0) return NextResponse.json({ error: "No transactions were detected. Use a text-based PDF export." }, { status: 422 });
    const client = await convexServerClient(); await client.mutation(api.users.initialize, {});
    const result = await client.mutation(api.finance.importParsedStatement, { accountId: accountId as Id<"accounts">, mimeType: "application/pdf", transactions: parsed.map((item) => ({ date: item.date.getTime(), description: item.description, amount: item.amount, dedupeHash: createHash("sha256").update(`${accountId}|${item.date.toISOString().slice(0, 10)}|${item.description.toLowerCase()}|${item.amount}`).digest("hex").slice(0, 32) })) });
    return NextResponse.json({ ...result, message: `Imported ${result.createdCount} transaction${result.createdCount === 1 ? "" : "s"}. The original PDF was discarded.` });
  } catch (error) { return errorResponse(error); }
}
