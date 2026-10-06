"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  responseError,
} from "../../lib/api";

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

export default function RecommendationsPage() {
  const router = useRouter();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const initialLoadStarted = useRef(false);

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
    setGeneratedAt(result.generated_at);
  }, [router]);

  const generateRecommendations = useCallback(async () => {
    setGenerating(true);
    setError("");
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
      setGeneratedAt(result.generated_at);
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Could not generate recommendations.",
      );
    } finally {
      setGenerating(false);
    }
  }, [router]);

  useEffect(() => {
    if (initialLoadStarted.current) return;

    let active = true;
    if (!getAccessToken()) {
      router.replace("/login");
      return () => {
        active = false;
      };
    }

    const timeout = window.setTimeout(() => {
      if (!active || initialLoadStarted.current) return;
      initialLoadStarted.current = true;
      const shouldGenerate =
        new URLSearchParams(window.location.search).get("generate") === "1";
      if (shouldGenerate) {
        window.history.replaceState(null, "", window.location.pathname);
        void generateRecommendations()
          .catch((loadError: unknown) => {
            if (active) {
              setError(
                loadError instanceof Error
                  ? loadError.message
                  : "Could not generate recommendations.",
              );
            }
          })
          .finally(() => {
            if (active) setLoading(false);
          });
        return;
      }

      void loadRecommendations()
        .catch((loadError: unknown) => {
          if (active) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Could not load recommendations.",
            );
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [generateRecommendations, loadRecommendations, router]);

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-gray-900 md:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-4 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
              AgentTutor
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">
              Personalized recommendations
            </h1>
            <p className="mt-2 max-w-2xl text-gray-600">
              Learning resources selected using your education, skills, and projects.
            </p>
            {generatedAt && (
              <p className="mt-2 text-sm text-gray-500">
                Last generated: {new Date(generatedAt).toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/profile"
              className="rounded-lg border border-gray-300 px-4 py-3 font-medium hover:bg-gray-50"
            >
              Edit profile
            </Link>
            <button
              type="button"
              onClick={generateRecommendations}
              disabled={generating}
              className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-300"
            >
              {generating ? "Searching and ranking..." : "Generate New Recommendations"}
            </button>
          </div>
        </header>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            <p>{error}</p>
            {error.toLowerCase().includes("profile") && (
              <Link href="/profile" className="mt-2 inline-block font-semibold underline">
                Set up your learner profile
              </Link>
            )}
          </div>
        )}

        {loading ? (
          <p role="status" className="py-16 text-center text-gray-600">
            Loading your recommendations...
          </p>
        ) : recommendations.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">No recommendations yet</h2>
            <p className="mx-auto mt-2 max-w-xl text-gray-600">
              Save education, skills, or project interests in your profile, then generate
              recommendations tailored to those topics.
            </p>
            <Link
              href="/profile"
              className="mt-5 inline-flex rounded-lg border border-gray-300 px-4 py-2 font-medium hover:bg-gray-50"
            >
              Complete profile
            </Link>
          </section>
        ) : (
          <section
            aria-label="Recommended learning resources"
            className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
          >
            {recommendations.map((item) => (
              <article
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-200"
              >
                {item.type === "youtube" && item.thumbnail_url ? (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Watch ${item.title} on YouTube`}
                    className="relative block aspect-video bg-gray-100"
                  >
                    <Image
                      src={item.thumbnail_url}
                      alt=""
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex h-12 items-center border-b border-gray-100 px-5">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
                        item.type === "youtube"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {item.type === "youtube" ? "YouTube tutorial" : "Web article"}
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-lg font-bold leading-snug">{item.title}</h2>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${
                        item.type === "youtube"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {item.type === "youtube" ? "Video" : "Article"}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-gray-600">
                    {item.description || "Open this resource to view the learning material."}
                  </p>
                  <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                    <span className="truncate text-xs text-gray-500" title={item.topic}>
                      For: {item.topic}
                    </span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700"
                    >
                      {item.type === "youtube" ? "Watch tutorial" : "Read article"}
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
