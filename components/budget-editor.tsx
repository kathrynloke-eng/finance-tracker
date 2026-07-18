"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

type Category = {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
  isDefault?: boolean;
  budgetStyle?: "MONTHLY" | "RESERVE";
  allocationExpenseGroup?: "ESSENTIALS" | "LIFESTYLE" | "GIVING" | null;
};

type AllocationExpenseGroup = "" | "ESSENTIALS" | "LIFESTYLE" | "GIVING";

type BudgetEditorProps = {
  month: string;
  categories: Category[];
  initialBudgets: Record<string, number>;
  compact?: boolean;
};

const SYSTEM_NAMES = new Set(["Income", "Transfer", "Uncategorized"]);

const ICON_OPTIONS = [
  "📁",
  "🍽️",
  "🛒",
  "🚗",
  "💡",
  "🏠",
  "🎬",
  "🛍️",
  "🏥",
  "📱",
  "✈️",
  "🎓",
  "🐾",
  "💅",
];

const COLOR_OPTIONS = [
  "#f97316",
  "#22c55e",
  "#3b82f6",
  "#eab308",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#ef4444",
  "#6366f1",
  "#0ea5e9",
];

function budgetsToDrafts(budgets: Record<string, number>) {
  const drafts: Record<string, string> = {};
  for (const [id, amount] of Object.entries(budgets)) {
    drafts[id] = amount > 0 ? String(amount) : "";
  }
  return drafts;
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function AmountField({
  id,
  value,
  onChange,
  dirty = false,
}: {
  id: string;
  value: string;
  onChange: (id: string, value: string) => void;
  dirty?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-sm text-slate-400">$</span>
      <input
        type="text"
        inputMode="decimal"
        name={`budget-${id}`}
        value={value}
        placeholder="0"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "" || /^\d*\.?\d{0,2}$/.test(next)) {
            onChange(id, next);
          }
        }}
        className={`w-24 rounded-lg border bg-white px-2.5 py-1.5 text-right text-sm outline-none ring-emerald-500 focus:ring-2 ${
          dirty ? "border-amber-300" : "border-slate-200"
        }`}
      />
    </span>
  );
}

export function BudgetEditor({
  month,
  categories: initialCategories,
  initialBudgets,
  compact = false,
}: BudgetEditorProps) {
  const router = useRouter();

  const [categories, setCategories] = useState(() =>
    initialCategories.filter((category) => !SYSTEM_NAMES.has(category.name)),
  );
  const [savedBudgets, setSavedBudgets] = useState(initialBudgets);
  const [drafts, setDrafts] = useState(() => budgetsToDrafts(initialBudgets));

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📁");
  const [newColor, setNewColor] = useState(COLOR_OPTIONS[0]);
  const [newBudgetStyle, setNewBudgetStyle] = useState<"MONTHLY" | "RESERVE">(
    "MONTHLY",
  );
  const [newAllocationExpenseGroup, setNewAllocationExpenseGroup] = useState<AllocationExpenseGroup>("");
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIcon, setEditIcon] = useState("📁");
  const [editColor, setEditColor] = useState(COLOR_OPTIONS[0]);
  const [editBudgetStyle, setEditBudgetStyle] = useState<"MONTHLY" | "RESERVE">(
    "MONTHLY",
  );
  const [editAllocationExpenseGroup, setEditAllocationExpenseGroup] = useState<AllocationExpenseGroup>("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<Category | null>(null);

  const amounts = useMemo(() => {
    const parsed: Record<string, number> = {};
    for (const category of categories) {
      parsed[category.id] = parseAmount(drafts[category.id] ?? "");
    }
    return parsed;
  }, [categories, drafts]);

  const draftTotal = categories.reduce(
    (sum, category) => sum + (amounts[category.id] ?? 0),
    0,
  );

  const savedTotal = categories.reduce(
    (sum, category) => sum + (savedBudgets[category.id] ?? 0),
    0,
  );

  const dirtyIds = useMemo(
    () =>
      new Set(
        categories
          .filter(
            (category) =>
              (amounts[category.id] ?? 0) !== (savedBudgets[category.id] ?? 0),
          )
          .map((category) => category.id),
      ),
    [amounts, categories, savedBudgets],
  );

  const dirtyCount = dirtyIds.size;

  function updateDraft(id: string, value: string) {
    setDrafts((current) => ({ ...current, [id]: value }));
    setMessage("");
    setError("");
  }

  function discardTargetChanges() {
    setDrafts(budgetsToDrafts(savedBudgets));
    setMessage("Discarded unsaved target changes.");
    setError("");
  }

  async function saveAll() {
    if (dirtyCount === 0) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = categories
        .filter((category) => dirtyIds.has(category.id))
        .map((category) => ({
          categoryId: category.id,
          targetAmount: amounts[category.id] ?? 0,
        }));

      const responses = await Promise.all(
        payload.map((item) =>
          fetch("/api/budgets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categoryId: item.categoryId,
              month,
              targetAmount: item.targetAmount,
            }),
          }),
        ),
      );

      if (responses.some((response) => !response.ok)) {
        throw new Error("Some targets could not be saved.");
      }

      const nextSaved = { ...savedBudgets };
      for (const item of payload) {
        nextSaved[item.categoryId] = item.targetAmount;
      }
      setSavedBudgets(nextSaved);
      setDrafts(budgetsToDrafts(nextSaved));
      const nextTotal = categories.reduce(
        (sum, category) => sum + (nextSaved[category.id] ?? 0),
        0,
      );
      setMessage(
        `Saved ${payload.length} target change${payload.length === 1 ? "" : "s"} · ${formatCurrency(nextTotal)} total.`,
      );
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Save failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCategory(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = newName.trim();
    if (trimmed.length < 2) {
      setError("Enter a category name with at least 2 characters.");
      setMessage("");
      return;
    }

    setAdding(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          icon: newIcon,
          color: newColor,
          budgetStyle: newBudgetStyle,
          allocationExpenseGroup: newAllocationExpenseGroup || null,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not add category.",
        );
      }

      const category = data.category as Category;
      setCategories((current) =>
        [...current.filter((item) => item.id !== category.id), category].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      setDrafts((current) => ({ ...current, [category.id]: "" }));
      setSavedBudgets((current) => ({ ...current, [category.id]: 0 }));
      setNewName("");
      setNewIcon("📁");
      setNewColor(COLOR_OPTIONS[0]);
      setNewBudgetStyle("MONTHLY");
      setNewAllocationExpenseGroup("");
      setMessage(
        newBudgetStyle === "RESERVE"
          ? `Added reserve “${category.name}”. Set a monthly allocation, then save.`
          : `Added “${category.name}”. Enter a target, then save.`,
      );
      router.refresh();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Add failed.");
    } finally {
      setAdding(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditName(category.name);
    setEditIcon(category.icon ?? "📁");
    setEditColor(category.color ?? COLOR_OPTIONS[0]);
    setEditBudgetStyle(category.budgetStyle === "RESERVE" ? "RESERVE" : "MONTHLY");
    setEditAllocationExpenseGroup(category.allocationExpenseGroup ?? "");
    setMessage("");
    setError("");
  }

  async function saveEdit(categoryId: string) {
    setUpdatingId(categoryId);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: categoryId,
          name: editName,
          icon: editIcon,
          color: editColor,
          budgetStyle: editBudgetStyle,
          allocationExpenseGroup: editAllocationExpenseGroup || null,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not update category.",
        );
      }

      setCategories((current) =>
        current
          .map((category) =>
            category.id === categoryId ? data.category : category,
          )
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(null);
      setMessage(`Updated “${data.category.name}”.`);
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error ? updateError.message : "Update failed.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  function requestRemove(category: Category) {
    setPendingRemove(category);
    setEditingId(null);
    setMessage("");
    setError("");
  }

  async function confirmRemove() {
    if (!pendingRemove) return;
    const category = pendingRemove;
    setUpdatingId(category.id);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/categories?id=${category.id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 404) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not remove category.",
        );
      }

      setCategories((current) =>
        current.filter((item) => item.id !== category.id),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[category.id];
        return next;
      });
      setSavedBudgets((current) => {
        const next = { ...current };
        delete next[category.id];
        return next;
      });
      setPendingRemove(null);
      setMessage(`Removed “${category.name}”.`);
      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Remove failed.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-emerald-900">
            {dirtyCount > 0 ? "Draft monthly total" : "Saved monthly total"}
          </p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-emerald-950">
            {formatCurrency(dirtyCount > 0 ? draftTotal : savedTotal)}
          </p>
          {dirtyCount > 0 ? (
            <p className="mt-1 text-xs text-emerald-800/80">
              Saved total: {formatCurrency(savedTotal)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={discardTargetChanges}
            disabled={saving || dirtyCount === 0}
            className="rounded-xl border border-emerald-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-emerald-50/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={saveAll}
            disabled={saving || dirtyCount === 0}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : dirtyCount > 0
                ? `Save ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}`
                : "Save targets"}
          </button>
        </div>
      </div>

      {dirtyCount > 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have unsaved target changes. Dashboard and transfer plan still use
          the last saved totals until you click Save.
        </p>
      ) : null}

      {message ? (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleAddCategory}
        className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-4"
      >
        <p className="mb-3 text-sm font-medium text-slate-800">
          Add a custom category
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="new-category-name"
              className="mb-1 block text-xs font-medium text-slate-500"
            >
              Name
            </label>
            <input
              id="new-category-name"
              type="text"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="e.g. Pet care, Kids, Travel"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none ring-emerald-500 focus:ring-2"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            disabled={adding}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {adding ? "Adding..." : "Add category"}
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Icon</p>
            <div className="flex flex-wrap gap-1">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setNewIcon(icon)}
                  className={`rounded-lg px-2 py-1 text-base ${
                    newIcon === icon
                      ? "bg-emerald-600 text-white"
                      : "border border-slate-200 bg-white"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Color</p>
            <div className="flex flex-wrap gap-1.5">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className={`h-7 w-7 rounded-full border-2 ${
                    newColor === color ? "border-slate-900" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                  aria-label={`Color ${color}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <p className="mb-1 text-xs font-medium text-slate-500">Budget style</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setNewBudgetStyle("MONTHLY")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                newBudgetStyle === "MONTHLY"
                  ? "bg-emerald-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Monthly spend
            </button>
            <button
              type="button"
              onClick={() => setNewBudgetStyle("RESERVE")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                newBudgetStyle === "RESERVE"
                  ? "bg-sky-600 text-white"
                  : "border border-slate-200 bg-white text-slate-600"
              }`}
            >
              Reserve (draw when needed)
            </button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            Reserves allocate money each month and only draw down when you spend.
          </p>
        </div>
        <label className="mt-3 block text-xs font-medium text-slate-500">
          Link transaction spending to salary plan
          <select value={newAllocationExpenseGroup} onChange={(event) => setNewAllocationExpenseGroup(event.target.value as AllocationExpenseGroup)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 focus:ring-2">
            <option value="">Do not link</option>
            <option value="ESSENTIALS">Essential expenses</option>
            <option value="LIFESTYLE">Lifestyle expenses</option>
            <option value="GIVING">Giving expenses</option>
          </select>
        </label>
      </form>

      {pendingRemove ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-950">
            Remove “{pendingRemove.name}”?
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Transactions in this category will move to Uncategorized.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={confirmRemove}
              disabled={updatingId === pendingRemove.id}
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              {updatingId === pendingRemove.id ? "Removing..." : "Yes, remove"}
            </button>
            <button
              type="button"
              onClick={() => setPendingRemove(null)}
              className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div
        className={
          compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 md:grid-cols-2"
        }
      >
        {categories.map((category) => {
          const isEditing = editingId === category.id;
          const isDirty = dirtyIds.has(category.id);

          return (
            <div
              key={category.id}
              className={`rounded-xl border px-4 py-3 ${
                isDirty
                  ? "border-amber-200 bg-amber-50/40"
                  : "border-slate-200 bg-white"
              }`}
            >
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none ring-emerald-500 focus:ring-2"
                  />
                  <div className="flex flex-wrap gap-1">
                    {ICON_OPTIONS.map((icon) => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setEditIcon(icon)}
                        className={`rounded-lg px-2 py-1 text-sm ${
                          editIcon === icon
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-200 bg-slate-50"
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_OPTIONS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditColor(color)}
                        className={`h-6 w-6 rounded-full border-2 ${
                          editColor === color
                            ? "border-slate-900"
                            : "border-transparent"
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-slate-500">
                      Budget style
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setEditBudgetStyle("MONTHLY")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          editBudgetStyle === "MONTHLY"
                            ? "bg-emerald-600 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        Monthly spend
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditBudgetStyle("RESERVE")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          editBudgetStyle === "RESERVE"
                            ? "bg-sky-600 text-white"
                            : "border border-slate-200 bg-slate-50 text-slate-600"
                        }`}
                      >
                        Reserve
                      </button>
                    </div>
                  </div>
                  <label className="block text-xs font-medium text-slate-500">
                    Salary plan link
                    <select value={editAllocationExpenseGroup} onChange={(event) => setEditAllocationExpenseGroup(event.target.value as AllocationExpenseGroup)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none ring-emerald-500 focus:ring-2">
                      <option value="">Do not link</option>
                      <option value="ESSENTIALS">Essential expenses</option>
                      <option value="LIFESTYLE">Lifestyle expenses</option>
                      <option value="GIVING">Giving expenses</option>
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(category.id)}
                      disabled={updatingId === category.id}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {updatingId === category.id
                        ? "Saving..."
                        : "Save changes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => requestRemove(category)}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
                      style={{
                        backgroundColor: `${category.color ?? "#10b981"}22`,
                      }}
                    >
                      {category.icon ?? "📁"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {category.name}
                        </p>
                        {category.budgetStyle === "RESERVE" ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                            Reserve
                          </span>
                        ) : null}
                        {category.allocationExpenseGroup ? (
                          <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-lime-800">
                            {category.allocationExpenseGroup.toLowerCase()}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {isDirty
                          ? "Unsaved change"
                          : category.budgetStyle === "RESERVE"
                            ? "Monthly allocation"
                            : "Monthly spend target"}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(category)}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          Customize
                        </button>
                        <span className="text-xs text-slate-300">·</span>
                        <button
                          type="button"
                          onClick={() => requestRemove(category)}
                          className="text-xs font-medium text-rose-600 hover:text-rose-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                  <AmountField
                    id={category.id}
                    value={drafts[category.id] ?? ""}
                    onChange={updateDraft}
                    dirty={isDirty}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
