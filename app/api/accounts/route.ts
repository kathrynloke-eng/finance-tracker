import { NextRequest, NextResponse } from "next/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { convexServerClient, errorResponse, toClientValue } from "@/lib/convex-server";

async function overview() {
  const client = await convexServerClient();
  await client.mutation(api.users.initialize, {});
  return { client, data: await client.query(api.finance.overview, { month: new Date().toISOString().slice(0, 7) }) };
}

export async function GET() {
  try { const { data } = await overview(); return NextResponse.json({ accounts: toClientValue(data.accounts) }); }
  catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const { client } = await overview();
    const id = await client.mutation(api.finance.createAccount, { name: body.name, type: body.type, currency: body.currency, isTransferSource: Boolean(body.isTransferSource) });
    const data = await client.query(api.finance.overview, { month: new Date().toISOString().slice(0, 7) });
    const account = data.accounts.find((item) => item._id === id);
    return NextResponse.json({ account: toClientValue(account) }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json(); const { client } = await overview();
    await client.mutation(api.finance.updateAccount, { id: body.id, ...(body.name === undefined ? {} : { name: body.name }), ...(body.type === undefined ? {} : { type: body.type }), ...(body.isTransferSource === undefined ? {} : { isTransferSource: body.isTransferSource }) });
    const data = await client.query(api.finance.overview, { month: new Date().toISOString().slice(0, 7) });
    return NextResponse.json({ account: toClientValue(data.accounts.find((item) => item._id === body.id)) });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Account id is required." }, { status: 400 });
    const { client } = await overview();
    const result = await client.mutation(api.finance.deleteAccount, { id: id as Id<"accounts"> });
    return NextResponse.json({ ok: true, newTransferSourceId: result.newTransferSourceId });
  } catch (error) { return errorResponse(error); }
}
