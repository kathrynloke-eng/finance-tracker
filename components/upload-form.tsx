"use client";

import { useState } from "react";

type Account = {
  id: string;
  name: string;
  type: string;
};

type UploadFormProps = {
  accounts: Account[];
};

export function UploadForm({ accounts }: UploadFormProps) {
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!file || !accountId) {
      setStatus("error");
      setMessage("Choose an account and PDF statement first.");
      return;
    }

    setStatus("uploading");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);

    try {
      const response = await fetch("/api/statements/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      setStatus("success");
      setMessage(data.message);
      setFile(null);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Account
        </label>
        <select
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none ring-emerald-500 focus:ring-2"
        >
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name} ({account.type.replace("_", " ").toLowerCase()})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          PDF statement
        </label>
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/40 px-6 py-12 text-center transition hover:border-emerald-300 hover:bg-emerald-50">
          <span className="text-3xl">📄</span>
          <span className="mt-3 text-sm font-medium text-slate-800">
            {file ? file.name : "Drop a PDF statement or click to browse"}
          </span>
          <span className="mt-1 text-xs text-slate-500">
            Text-based bank or credit card statements work best
          </span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={status === "uploading"}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "uploading" ? "Parsing statement..." : "Upload & classify"}
      </button>

      {message ? (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            status === "error"
              ? "bg-rose-50 text-rose-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
