import { NextRequest, NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { convexServerClient, errorResponse, toClientValue } from "@/lib/convex-server";

const month = () => new Date().toISOString().slice(0, 7);
async function client() { const value = await convexServerClient(); await value.mutation(api.users.initialize, {}); return value; }

export async function GET() {
  try { const value = await client(); const data = await value.query(api.finance.overview, { month: month() }); return NextResponse.json({ categories: toClientValue(data.categories) }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: NextRequest) {
  try { const body = await request.json(); const value = await client(); const id = await value.mutation(api.finance.createCategory, { name: body.name, icon: body.icon, color: body.color, budgetStyle: body.budgetStyle === "RESERVE" ? "RESERVE" : "MONTHLY" }); const data = await value.query(api.finance.overview, { month: month() }); return NextResponse.json({ category: toClientValue(data.categories.find((item) => item._id === id)) }, { status: 201 }); }
  catch (error) { return errorResponse(error); }
}
export async function PATCH(request: NextRequest) {
  try { const body = await request.json(); const value = await client(); await value.mutation(api.finance.updateCategory, { id: body.id, ...(body.name === undefined ? {} : { name: body.name }), ...(body.icon === undefined ? {} : { icon: body.icon }), ...(body.color === undefined ? {} : { color: body.color }), ...(body.budgetStyle === undefined ? {} : { budgetStyle: body.budgetStyle }), ...(body.fundingAccountId === undefined ? {} : { fundingAccountId: body.fundingAccountId || null }) }); const data = await value.query(api.finance.overview, { month: month() }); return NextResponse.json({ category: toClientValue(data.categories.find((item) => item._id === body.id)) }); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Category id is required." }, { status: 400 });
    const value = await client();
    await value.mutation(api.finance.deleteCategory, { id: id as Id<"categories"> });
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
