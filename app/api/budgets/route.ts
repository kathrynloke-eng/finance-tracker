import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { convexServerClient, errorResponse, toClientValue } from "@/lib/convex-server";

export async function GET(request: NextRequest) {
  try { const client = await convexServerClient(); await client.mutation(api.users.initialize, {}); const month = request.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7); const data = await client.query(api.finance.overview, { month }); return NextResponse.json({ month, budgets: toClientValue(data.budgets) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { const body = await request.json(); const client = await convexServerClient(); await client.mutation(api.users.initialize, {}); const id = await client.mutation(api.finance.setBudget, { categoryId: body.categoryId, month: body.month, targetAmount: Number(body.targetAmount) }); const data = await client.query(api.finance.overview, { month: body.month }); return NextResponse.json({ budget: toClientValue(data.budgets.find((item) => item._id === id)) }); }
  catch (error) { return errorResponse(error); }
}
