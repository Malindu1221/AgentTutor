"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, responseError } from "../../lib/api";
import { useSessionStorageValue } from "../../lib/session";

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
      window.sessionStorage.setItem("tutorRoadmap", JSON.stringify(data));
      router.push("/roadmap");
    } catch (error) {
      console.error("Failed to submit answers:", error);
      setError(error instanceof Error ? error.message : "Could not submit answers.");
      setLoading(false);
    }
  };

  if (!sessionData) return null;

  return (
    <main className="min-h-screen p-10 md:p-24 bg-gray-50 text-black">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Diagnostic Assessment</h1>
        <p className="text-gray-600">Domain: {sessionData.domain}</p>
        
        {sessionData.mcqs.map((mcq) => (
          <div key={mcq.id} className="p-6 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-4">{mcq.question}</h3>
            <div className="space-y-2">
              {mcq.options.map((opt, idx) => (
                <label key={idx} className="flex items-center space-x-3 cursor-pointer p-2 hover:bg-gray-100 rounded">
                  <input
                    type="radio"
                    name={mcq.id}
                    value={idx}
                    onChange={() => setAnswers(prev => ({ ...prev, [mcq.id]: idx }))}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <button
          onClick={submitAnswers}
          disabled={loading || Object.keys(answers).length < sessionData.mcqs.length}
          className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg disabled:bg-gray-400"
        >
          {loading ? "Analyzing and Building Roadmap..." : "Submit Answers"}
        </button>
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </div>
    </main>
  );
}