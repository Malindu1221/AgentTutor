"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const startSession = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/start_session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, user_id: "guest" }),
      });
      const data = await res.json();
      sessionStorage.setItem("tutorSession", JSON.stringify(data));
      router.push("/assessment");
    } catch (error) {
      console.error("Failed to start session:", error);
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="max-w-xl w-full space-y-8 p-10 bg-white rounded-xl shadow-md text-center">
        <h1 className="text-3xl font-bold text-gray-900">What do you want to learn?</h1>
        <input
          type="text"
          className="w-full p-4 border border-gray-300 rounded-lg text-black focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., learn python programming"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          onClick={startSession}
          disabled={loading}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg disabled:bg-blue-300"
        >
          {loading ? "Generating Assessment..." : "Start Learning Path"}
        </button>
      </div>
    </main>
  );
}