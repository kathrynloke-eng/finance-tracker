import { revalidatePath } from "next/cache";

export function revalidateFinancePages() {
  revalidatePath("/");
  revalidatePath("/transactions");
  revalidatePath("/budgets");
  revalidatePath("/accounts");
}
