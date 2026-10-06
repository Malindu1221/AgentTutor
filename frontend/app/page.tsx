"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, responseError } from "../lib/api";
import { saveSessionStorageValue } from "../lib/session";
import AuthGuard from "../components/auth-guard";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const startSession = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const topic = query.trim();
    if (!topic) {
      setError("Enter a topic you want to learn.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/start_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: topic }),
      });
      if (!res.ok) throw new Error(await responseError(res));
      const data = await res.json();
      saveSessionStorageValue("tutorSession", JSON.stringify(data));
      router.push("/assessment");
    } catch (error) {
      console.error("Failed to start session:", error);
      setError(error instanceof Error ? error.message : "Could not start the learning session.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthGuard>
      <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
        <div className="max-w-xl w-full space-y-8 p-10 bg-white rounded-xl shadow-md text-center">
          <h1 className="text-3xl font-bold text-gray-900">What do you want to learn?</h1>
          <form onSubmit={startSession} className="space-y-4">
            <label htmlFor="learning-topic" className="sr-only">
              Topic you want to learn
            </label>
            <input
              id="learning-topic"
              name="query"
              type="text"
              required
              maxLength={500}
              className="w-full rounded-lg border border-gray-300 p-4 text-black focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., learn python programming"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setError("");
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
            >
              {loading ? "Generating Assessment..." : "Start Learning Path"}
            </button>
            {error && <p role="alert" className="text-left text-red-700">{error}</p>}
          </form>
        </div>
      </main>
    </AuthGuard>
  );
}