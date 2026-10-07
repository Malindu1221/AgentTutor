"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, responseError } from "../lib/api";
import { saveSessionStorageValue } from "../lib/session";
import AuthGuard from "../components/auth-guard";

export default function Home() {
  const [query, setQuery] = useState("");
  const [topicConfirmed, setTopicConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const confirmTopic = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!query.trim()) {
      setError("Enter a topic you want to learn.");
      return;
    }
    setTopicConfirmed(true);
    setError("");
  };

  const startSession = async (manualLevel?: "beginner" | "intermediate" | "advanced") => {
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
        body: JSON.stringify({
          query: topic,
          ...(manualLevel ? { manual_level: manualLevel } : {}),
        }),
      });
      if (!res.ok) throw new Error(await responseError(res));
      const data = await res.json();
      if (manualLevel) {
        saveSessionStorageValue("tutorRoadmap", JSON.stringify(data));
        router.push("/roadmap");
      } else {
        saveSessionStorageValue("tutorSession", JSON.stringify(data));
        router.push("/assessment");
      }
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
          <form onSubmit={confirmTopic} className="space-y-4">
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
                setTopicConfirmed(false);
                setError("");
              }}
            />
            {!topicConfirmed && (
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700"
              >
                Continue
              </button>
            )}
            {topicConfirmed && (
              <div className="space-y-5 pt-2 text-left">
                <fieldset className="space-y-3">
                  <legend className="font-semibold text-gray-900">How would you like to choose your level?</legend>
                  <button
                    type="button"
                    onClick={() => void startSession()}
                    disabled={loading}
                    className="w-full rounded-lg border border-blue-600 px-5 py-4 text-left font-semibold text-blue-800 hover:bg-blue-50 disabled:opacity-60"
                  >
                    {loading ? "Starting..." : "Take a quick quiz to find my level"}
                  </button>
                </fieldset>
                <fieldset className="space-y-3">
                  <legend className="font-semibold text-gray-900">I know my level</legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => void startSession(level)}
                        disabled={loading}
                        className="rounded-lg bg-gray-100 px-4 py-3 font-semibold capitalize text-gray-900 hover:bg-gray-200 disabled:opacity-60"
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </div>
            )}
            {error && <p role="alert" className="text-left text-red-700">{error}</p>}
          </form>
        </div>
      </main>
    </AuthGuard>
  );
}