"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useSessionStorageValue } from "../../lib/session";

type LearningResource = {
  title: string;
  url: string;
  description?: string;
  type?: string;
};

type RoadmapStep = {
  id: string;
  title: string;
  description: string;
  estimated_time_hours: number;
  prereq: string[];
  step_explanation?: string;
  resources: LearningResource[];
  web_resources: LearningResource[];
};

type RoadmapResult = {
  session_id: string;
  evaluation: {
    score: number;
    total: number;
    percentage: number;
    difficulty: string;
    manual: boolean;
  };
  roadmap: RoadmapStep[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseResources(value: unknown): LearningResource[] {
  if (!Array.isArray(value)) return [];
  const resources: LearningResource[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.title !== "string" ||
      typeof item.url !== "string" ||
      !(item.url.startsWith("https://") || item.url.startsWith("http://"))
    ) continue;
    resources.push({
      title: item.title,
      url: item.url,
      description: typeof item.description === "string" ? item.description : undefined,
      type: typeof item.type === "string" ? item.type : undefined,
    });
  }
  return resources;
}

function parseRoadmapResult(value: string | null): RoadmapResult | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !isRecord(parsed) ||
      typeof parsed.session_id !== "string" ||
      !isRecord(parsed.evaluation) ||
      !Array.isArray(parsed.roadmap)
    ) return null;

    const evaluation = parsed.evaluation;
    if (
      typeof evaluation.difficulty !== "string" ||
      typeof evaluation.score !== "number" ||
      typeof evaluation.total !== "number" ||
      typeof evaluation.percentage !== "number"
    ) return null;

    const roadmap: RoadmapStep[] = [];
    for (const candidate of parsed.roadmap) {
      if (
        !isRecord(candidate) ||
        typeof candidate.id !== "string" ||
        typeof candidate.title !== "string" ||
        typeof candidate.description !== "string" ||
        typeof candidate.estimated_time_hours !== "number"
      ) return null;
      roadmap.push({
        id: candidate.id,
        title: candidate.title,
        description: candidate.description,
        estimated_time_hours: candidate.estimated_time_hours,
        prereq: Array.isArray(candidate.prereq)
          ? candidate.prereq.filter((item): item is string => typeof item === "string")
          : [],
        step_explanation:
          typeof candidate.step_explanation === "string"
            ? candidate.step_explanation
            : undefined,
        resources: parseResources(candidate.resources),
        web_resources: parseResources(candidate.web_resources),
      });
    }

    if (roadmap.length === 0) return null;
    return {
      session_id: parsed.session_id,
      evaluation: {
        score: evaluation.score,
        total: evaluation.total,
        percentage: evaluation.percentage,
        difficulty: evaluation.difficulty,
        manual: evaluation.manual === true,
      },
      roadmap,
    };
  } catch {
    return null;
  }
}

function ResourceList({
  heading,
  resources,
  accent,
}: {
  heading: string;
  resources: LearningResource[];
  accent: "red" | "blue";
}) {
  if (resources.length === 0) return null;
  const linkColor = accent === "red" ? "text-red-700" : "text-blue-700";
  return (
    <section className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-800">
        {heading}
      </h3>
      <ul className="space-y-3">
        {resources.map((resource, index) => (
          <li key={`${resource.url}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <a
              href={resource.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`${linkColor} font-semibold transition hover:underline`}
            >
              {resource.title}
            </a>
            {resource.description && (
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{resource.description}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function RoadmapPage() {
  const router = useRouter();
  const roadmapValue = useSessionStorageValue("tutorRoadmap");
  const result = parseRoadmapResult(roadmapValue);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!parseRoadmapResult(roadmapValue)) router.replace("/");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [roadmapValue, router]);

  if (!result) return null;

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-900 md:px-8 md:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-7 text-center text-white shadow-2xl shadow-slate-900/15 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
            Personalized learning roadmap
          </p>
          <h1 className="mb-3 mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Your Custom Learning Path
          </h1>
          <p className="text-lg text-slate-200">
            Difficulty level:{" "}
            <span className="font-semibold uppercase text-white">{result.evaluation.difficulty}</span>
          </p>
          {result.evaluation.manual ? (
            <p className="mt-1 text-slate-300">Level selected by you</p>
          ) : (
            <p className="mt-1 text-slate-300">
              Diagnostic score: {result.evaluation.score}/{result.evaluation.total} (
              {result.evaluation.percentage.toFixed(0)}%)
            </p>
          )}
          <p className="mt-3 text-sm text-blue-200">
            {result.roadmap.length} learning steps ·{" "}
            {result.roadmap.reduce((total, step) => total + step.estimated_time_hours, 0)} estimated hours
          </p>
        </header>

        <ol className="space-y-5">
          {result.roadmap.map((step, index) => (
            <li
              key={step.id}
              className="rounded-2xl border border-gray-300 bg-white p-6 shadow-2xl shadow-slate-900/10 md:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wide text-blue-800">
                    Step {index + 1}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900 md:text-2xl">{step.title}</h2>
                </div>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-950">
                  {step.estimated_time_hours} hours
                </span>
              </div>
              <p className="mt-4 text-base leading-relaxed text-slate-700">{step.description}</p>

              {step.prereq.length > 0 && (
                <p className="mt-4 text-sm text-slate-600">
                  Prerequisites: {step.prereq.join(", ")}
                </p>
              )}

              {step.step_explanation && (
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
                  <span className="font-semibold">Why this step? </span>
                  {step.step_explanation}
                </div>
              )}

              <ResourceList
                heading="Recommended tutorials"
                resources={step.resources}
                accent="red"
              />
              <ResourceList
                heading="Web articles and documentation"
                resources={step.web_resources}
                accent="blue"
              />
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            onClick={() => {
              window.sessionStorage.removeItem("tutorSession");
              window.sessionStorage.removeItem("tutorRoadmap");
            }}
            className="flex-1 rounded-xl bg-slate-900 px-6 py-4 text-center font-semibold text-white shadow-lg shadow-slate-900/15 transition-all hover:-translate-y-0.5 hover:bg-slate-800"
          >
            Start a New Topic
          </Link>
        </div>
      </div>
    </main>
  );
}
