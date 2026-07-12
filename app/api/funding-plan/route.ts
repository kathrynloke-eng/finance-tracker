import { NextRequest, NextResponse } from "next/server";
import { getDefaultUser, ensureDefaultData } from "@/lib/user";
import { getFundingPlan } from "@/lib/funding";
import { getCurrentMonthKey } from "@/lib/budget";

export async function GET(request: NextRequest) {
  const user = await getDefaultUser();
  await ensureDefaultData(user.id);

  const month =
    request.nextUrl.searchParams.get("month") ?? getCurrentMonthKey();

  const plan = await getFundingPlan(user.id, month);
  return NextResponse.json({ plan });
}
