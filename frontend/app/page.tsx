"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, clearAccessToken, responseError } from "../lib/api";
import { saveSessionStorageValue } from "../lib/session";
import AuthGuard from "../components/auth-guard";

type Recommendation = {
  id: string;
  type: "youtube" | "web";
  title: string;
  description: string;
  url: string;
  thumbnail_url: string | null;
  published_at: string | null;
  topic: string;
  relevance_score: number;
};

type RecommendationResponse = {
  recommendations: Recommendation[];
  generated_at: string | null;
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [topicConfirmed, setTopicConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(true);
  const [recommendationsGenerating, setRecommendationsGenerating] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState("");
  const router = useRouter();

  const loadRecommendations = useCallback(async () => {
    const response = await apiFetch("/recommendations");
    if (response.status === 401) {
      clearAccessToken();
      router.replace("/login");
      return;
    }
    if (!response.ok) throw new Error(await responseError(response));
    const result: RecommendationResponse = await response.json();
    setRecommendations(result.recommendations);
  }, [router]);

  const generateRecommendations = async () => {
    setRecommendationsGenerating(true);
    setRecommendationsError("");
    try {
      const response = await apiFetch("/recommendations/generate", {
        method: "POST",
      });
      if (response.status === 401) {
        clearAccessToken();
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      const result: RecommendationResponse = await response.json();
      setRecommendations(result.recommendations);
    } catch (generateError) {
      setRecommendationsError(
        generateError instanceof Error
          ? generateError.message
          : "Could not generate recommendations.",
      );
    } finally {
      setRecommendationsGenerating(false);
    }
  };

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void loadRecommendations()
        .catch((loadError: unknown) => {
          if (active) {
            setRecommendationsError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load recommendations.",
            );
          }
        })
        .finally(() => {
          if (active) setRecommendationsLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [loadRecommendations]);

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
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-4 py-14 text-white shadow-xl md:py-20">
          <div className="mx-auto w-full max-w-5xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-blue-200">
              Your learning journey starts here
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              What do you want to learn?
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
              Tell us a subject and we’ll build a path that fits your goals and current level.
            </p>
            <form onSubmit={confirmTopic} className="mx-auto mt-8 max-w-4xl space-y-4">
              <label htmlFor="learning-topic" className="sr-only">
                Topic you want to learn
              </label>
              <input
                id="learning-topic"
                name="query"
                type="text"
                required
                maxLength={500}
                className="w-full rounded-2xl border border-white/70 bg-white px-5 py-5 text-base text-slate-900 shadow-xl shadow-black/20 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-400/30"
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
                  className="w-full rounded-xl bg-blue-500 px-6 py-4 font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:bg-blue-400 sm:w-auto sm:min-w-40"
                >
                  Continue
                </button>
              )}
              {topicConfirmed && (
                <div className="space-y-5 rounded-2xl border border-white/15 bg-white/10 p-5 text-left shadow-lg backdrop-blur-sm sm:p-6">
                  <fieldset className="space-y-3">
                    <legend className="font-semibold text-white">How would you like to choose your level?</legend>
                    <button
                      type="button"
                      onClick={() => void startSession()}
                      disabled={loading}
                      className="w-full rounded-xl border border-white/25 bg-white px-5 py-4 text-left font-semibold text-slate-900 transition hover:border-blue-300 hover:bg-blue-50 disabled:opacity-60"
                    >
                      {loading ? "Starting..." : "Take a quick quiz to find my level"}
                    </button>
                  </fieldset>
                  <fieldset className="space-y-3">
                    <legend className="font-semibold text-white">I know my level</legend>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => void startSession(level)}
                          disabled={loading}
                          className="rounded-xl border border-white/20 bg-slate-800/80 px-4 py-3 font-semibold capitalize text-white transition hover:bg-slate-700 disabled:opacity-60"
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </div>
              )}
              {error && <p role="alert" className="rounded-xl bg-red-100 px-4 py-3 text-left text-red-800">{error}</p>}
            </form>
          </div>
        </section>

        <div className="mx-auto w-full max-w-[90rem] px-4 py-10 md:px-8 md:py-12">
          <section className="space-y-6">
            <header className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-800">
                  Keep exploring
                </p>
                <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  Personalized Recommendations
                </h2>
                <p className="mt-2 text-slate-600">
                  Tutorials and articles picked to support your learning.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/profile"
                  className="rounded-xl border border-slate-300 px-4 py-3 font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Edit profile
                </Link>
                <button
                  type="button"
                  onClick={() => void generateRecommendations()}
                  disabled={recommendationsGenerating}
                  className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-md transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {recommendationsGenerating ? "Finding resources..." : "Refresh"}
                </button>
              </div>
            </header>

            {recommendationsError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
                {recommendationsError}
              </div>
            )}

            {recommendationsLoading ? (
              <p role="status" className="rounded-2xl bg-white py-12 text-center text-slate-600 shadow-sm">
                Loading your recommendations...
              </p>
            ) : recommendations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
                <h3 className="text-xl font-semibold">No recommendations yet</h3>
                <p className="mx-auto mt-2 max-w-xl text-slate-600">
                  Add your education, skills, or interests to your profile, then generate recommendations tailored to you.
                </p>
                <Link
                  href="/profile"
                  className="mt-5 inline-flex rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800"
                >
                  Complete profile
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((item) => (
                  <article
                    key={item.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5 transition duration-200 hover:-translate-y-1 hover:shadow-2xl"
                  >
                    {item.type === "youtube" && item.thumbnail_url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Watch ${item.title} on YouTube`}
                        className="relative block aspect-[16/8] bg-slate-100"
                      >
                        <Image
                          src={item.thumbnail_url}
                          alt=""
                          fill
                          unoptimized
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex h-14 items-center border-b border-slate-100 px-6">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-800">
                          {item.type === "youtube" ? "YouTube tutorial" : "Web article"}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-xl font-bold leading-snug text-slate-900">{item.title}</h3>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                          item.type === "youtube" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                        }`}>
                          {item.type === "youtube" ? "Video" : "Article"}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-4 text-base leading-relaxed text-slate-600">
                        {item.description || "Open this resource to view the learning material."}
                      </p>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                        <span className="truncate text-xs text-slate-500" title={item.topic}>
                          For: {item.topic}
                        </span>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          {item.type === "youtube" ? "Watch tutorial" : "Read article"}
                        </a>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </AuthGuard>
  );
}