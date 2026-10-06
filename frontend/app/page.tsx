"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, responseError, useStoredAccessToken } from "../lib/api";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const accessToken = useStoredAccessToken();
  const router = useRouter();

  const startSession = async () => {
    if (!query) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/start_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, user_id: "guest" }),
      });
      if (!res.ok) throw new Error(await responseError(res));
      const data = await res.json();
      window.sessionStorage.setItem("tutorSession", JSON.stringify(data));
      router.push("/assessment");
    } catch (error) {
      console.error("Failed to start session:", error);
      setError(error instanceof Error ? error.message : "Could not start the learning session.");
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="max-w-xl w-full space-y-8 p-10 bg-white rounded-xl shadow-md text-center">
        <nav className="flex justify-end gap-4 text-sm">
          {accessToken ? (
            <>
              <Link className="text-blue-700 underline" href="/profile">Profile</Link>
            </>
          ) : (
            <>
              <Link className="text-blue-700 underline" href="/login">Log in</Link>
              <Link className="text-blue-700 underline" href="/register">Register</Link>
            </>
          )}
        </nav>
        <h1 className="text-3xl font-bold text-gray-900">What do you want to learn?</h1>
        <input
          type="text"
          suppressHydrationWarning
          className="w-full p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., learn python programming"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={startSession}
          disabled={loading}
          suppressHydrationWarning
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:bg-blue-300"
        >
          {loading ? "Generating Assessment..." : "Start Learning Path"}
        </button>
        {error && <p role="alert" className="text-left text-red-700">{error}</p>}
      </div>
    </main>
  );
}