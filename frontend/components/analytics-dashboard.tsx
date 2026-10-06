"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch, clearAccessToken, responseError } from "../lib/api";

type AssessmentScore = {
  session_id: string;
  date: string | null;
  score: number;
  total: number;
  percentage: number;
};

type Analytics = {
  timezone: string;
  total_sessions: number;
  total_roadmaps: number;
  completed_sessions: number;
  average_score: number | null;
  recent_scores: AssessmentScore[];
  current_streak_days: number;
  longest_streak_days: number;
  active_days: number;
};

function isAnalytics(value: unknown): value is Analytics {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.timezone === "string" &&
    typeof data.total_sessions === "number" &&
    typeof data.total_roadmaps === "number" &&
    typeof data.completed_sessions === "number" &&
    (typeof data.average_score === "number" || data.average_score === null) &&
    typeof data.current_streak_days === "number" &&
    typeof data.longest_streak_days === "number" &&
    typeof data.active_days === "number" &&
    Array.isArray(data.recent_scores) &&
    data.recent_scores.every(
      (item: unknown) =>
        typeof item === "object" &&
        item !== null &&
        "session_id" in item &&
        typeof item.session_id === "string" &&
        "score" in item &&
        typeof item.score === "number" &&
        "total" in item &&
        typeof item.total === "number" &&
        "percentage" in item &&
        typeof item.percentage === "number",
    )
  );
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void (async () => {
        try {
          const response = await apiFetch("/api/analytics", {
            signal: controller.signal,
          });
          if (response.status === 401) {
            clearAccessToken();
            router.replace("/login");
            return;
          }
          if (!response.ok) throw new Error(await responseError(response));
          const result: unknown = await response.json();
          if (!isAnalytics(result)) {
            throw new Error("The analytics service returned unexpected data.");
          }
          if (active) {
            setAnalytics(result);
            setError("");
          }
        } catch (fetchError) {
          if (active && !controller.signal.aborted) {
            setError(
              fetchError instanceof Error
                ? fetchError.message
                : "Could not load your learning analytics.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [retry, router]);

  const metrics = analytics
    ? [
        {
          label: "Completed roadmaps",
          value: analytics.total_roadmaps,
          detail: `${analytics.total_sessions} learning sessions started`,
          accent: "border-blue-500",
        },
        {
          label: "Average assessment score",
          value: analytics.average_score === null ? "—" : `${analytics.average_score}%`,
          detail: `${analytics.completed_sessions} completed assessments`,
          accent: "border-violet-500",
        },
        {
          label: "Current study streak",
          value: `${analytics.current_streak_days} ${analytics.current_streak_days === 1 ? "day" : "days"}`,
          detail: `${analytics.longest_streak_days}-day longest streak`,
          accent: "border-amber-500",
        },
        {
          label: "Active days",
          value: analytics.active_days,
          detail: `Activity dates measured in ${analytics.timezone}`,
          accent: "border-emerald-500",
        },
      ]
    : [];

  return (
    <section aria-labelledby="analytics-heading" className="space-y-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
          Your learning activity
        </p>
        <h2 id="analytics-heading" className="mt-1 text-2xl font-bold">
          Progress &amp; Analytics
        </h2>
      </header>

      {loading ? (
        <p className="rounded-xl bg-white p-6 text-gray-600 shadow-sm" role="status">
          Loading your learning analytics...
        </p>
      ) : error || !analytics ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          <p role="alert">{error || "Analytics are unavailable."}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setRetry((current) => current + 1);
            }}
            className="mt-3 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article
                key={metric.label}
                className={`rounded-2xl border-l-4 ${metric.accent} bg-white p-5 shadow-sm`}
              >
                <p className="text-sm font-semibold text-gray-600">{metric.label}</p>
                <p className="mt-3 text-3xl font-bold">{metric.value}</p>
                <p className="mt-2 text-sm text-gray-500">{metric.detail}</p>
              </article>
            ))}
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-xl font-bold">Recent assessment scores</h3>
                <p className="mt-1 text-sm text-gray-600">
                  Most recent completed roadmap assessments.
                </p>
              </div>
              {analytics.recent_scores.length > 0 && (
                <p className="text-sm font-medium text-gray-600">
                  Average: {analytics.average_score}%
                </p>
              )}
            </div>

            {analytics.recent_scores.length === 0 ? (
              <p className="mt-6 rounded-lg bg-gray-50 p-5 text-gray-600">
                Complete a learning-path assessment to see your score history here.
              </p>
            ) : (
              <div className="mt-6 space-y-4">
                {analytics.recent_scores.map((assessment, index) => (
                  <div
                    key={assessment.session_id}
                    className="grid grid-cols-[5rem_1fr_4rem] items-center gap-3"
                  >
                    <span className="text-sm text-gray-600">
                      {assessment.date
                        ? new Date(assessment.date).toLocaleDateString()
                        : `Attempt ${index + 1}`}
                    </span>
                    <div
                      className="h-3 overflow-hidden rounded-full bg-gray-100"
                      role="img"
                      aria-label={`Assessment score ${assessment.percentage}%`}
                    >
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{
                          width: `${Math.max(0, Math.min(100, assessment.percentage))}%`,
                        }}
                      />
                    </div>
                    <span className="text-right text-sm font-semibold">
                      {assessment.score}/{assessment.total}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
