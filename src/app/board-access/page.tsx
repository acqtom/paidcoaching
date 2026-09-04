"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/Logo";

export default function BoardAccessEntryPage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    router.push(`/board-access/${encodeURIComponent(normalized)}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 px-6">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-gray-900 mb-1 text-center">
          Enter your secret key
        </h1>
        <p className="text-sm text-gray-500 mb-6 text-center">
          Ask whoever shared their Sales Team Board with you for their team secret key.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Secret key"
            className="text-center font-mono text-lg tracking-[0.3em] uppercase border border-gray-300 rounded-lg px-3 py-3 outline-none focus:border-gray-500 bg-white"
          />
          <button
            type="submit"
            className="text-sm font-medium bg-gray-900 text-white rounded-lg px-4 py-3 hover:opacity-90"
          >
            Go
          </button>
        </form>
      </div>
    </div>
  );
}
