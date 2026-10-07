"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, responseError } from "../../lib/api";
import { saveSessionStorageValue, useSessionStorageValue } from "../../lib/session";

type DiagnosticQuestion = {
  id: string;
  question: string;
  options: string[];
};

type TutorSession = {
  session_id: string;
  domain: string;
  mcqs: DiagnosticQuestion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTutorSession(value: string | null): TutorSession | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    const candidate = parsed;
    if (
      typeof candidate.session_id !== "string" ||
      typeof candidate.domain !== "string" ||
      !Array.isArray(candidate.mcqs)
    ) return null;

    const mcqs: DiagnosticQuestion[] = [];
    const rawQuestions: unknown[] = candidate.mcqs;
    for (const question of rawQuestions) {
      if (
        !isRecord(question) ||
        typeof question.id !== "string" ||
        typeof question.question !== "string" ||
        !Array.isArray(question.options) ||
        !question.options.every((option: unknown) => typeof option === "string")
      ) return null;
      const rawOptions: unknown[] = question.options;
      mcqs.push({
        id: question.id,
        question: question.question,
        options: rawOptions.filter((option): option is string => typeof option === "string"),
      });
    }
    return { session_id: candidate.session_id, domain: candidate.domain, mcqs };
  } catch {
    return null;
  }
}

export default function AssessmentPage() {
  const router = useRouter();
  const sessionValue = useSessionStorageValue("tutorSession");
  const sessionData = parseTutorSession(sessionValue);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (!parseTutorSession(sessionValue)) router.replace("/");
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [router, sessionValue]);

  const submitAnswers = async () => {
    const session = sessionData;
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch("/submit_answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: session.session_id, answers }),
      });
      if (!res.ok) throw new Error(await responseError(res));
      const data = await res.json();
      saveSessionStorageValue("tutorRoadmap", JSON.stringify(data));
      router.push("/roadmap");
    } catch (error) {
      console.error("Failed to submit answers:", error);
      setError(error instanceof Error ? error.message : "Could not submit answers.");
      setLoading(false);
    }
  };

  if (!sessionData) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 md:px-8 md:py-12">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-900/5 md:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-800">
            Personalized learning path
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            Diagnostic Assessment
          </h1>
          <p className="mt-3 text-slate-600">
            Answer a few questions so we can tailor your roadmap to your current level.
          </p>
          <p className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            Domain: {sessionData.domain}
          </p>
        </header>

        {sessionData.mcqs.map((mcq) => (
          <section
            key={mcq.id}
            className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg shadow-slate-900/5 md:p-8"
          >
            <h2 className="mb-5 text-lg font-semibold leading-relaxed text-gray-800">
              {mcq.question}
            </h2>
            <div className="space-y-2">
              {mcq.options.map((opt, idx) => (
                <label
                  key={idx}
                  className="flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-colors hover:bg-gray-50 has-[:checked]:bg-blue-50"
                >
                  <input
                    type="radio"
                    name={mcq.id}
                    value={idx}
                    onChange={() => setAnswers(prev => ({ ...prev, [mcq.id]: idx }))}
                    className="h-5 w-5 shrink-0 accent-slate-900 focus:ring-2 focus:ring-blue-500/20"
                  />
                  <span className="text-base leading-relaxed text-slate-700">{opt}</span>
                </label>
              ))}
            </div>
          </section>
        ))}

        <div className="flex flex-col items-stretch gap-4 pt-2 md:flex-row md:items-center">
          <button
            onClick={submitAnswers}
            disabled={loading || Object.keys(answers).length < sessionData.mcqs.length}
            className="w-full rounded-xl bg-slate-900 px-8 py-4 font-semibold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
          >
            {loading ? "Analyzing and Building Roadmap..." : "Submit Answers"}
          </button>
          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </main>
  );
}