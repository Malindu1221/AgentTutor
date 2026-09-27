"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AssessmentPage() {
  const router = useRouter();
  const [sessionData, setSessionData] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const data = sessionStorage.getItem("tutorSession");
    if (data) setSessionData(JSON.parse(data));
    else router.push("/");
  }, [router]);

  const submitAnswers = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://127.0.0.1:8000/submit_answers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionData.session_id, answers }),
      });
      const data = await res.json();
      sessionStorage.setItem("tutorRoadmap", JSON.stringify(data));
      router.push("/roadmap");
    } catch (error) {
      console.error("Failed to submit answers:", error);
      setLoading(false);
    }
  };

  if (!sessionData) return null;

  return (
    <main className="min-h-screen p-10 md:p-24 bg-gray-50 text-black">
      <div className="max-w-3xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold">Diagnostic Assessment</h1>
        <p className="text-gray-600">Domain: {sessionData.domain}</p>
        
        {sessionData.mcqs.map((mcq: any) => (
          <div key={mcq.id} className="p-6 bg-white rounded-lg shadow">
            <h3 className="font-semibold mb-4">{mcq.question}</h3>
            <div className="space-y-2">
              {mcq.options.map((opt: str, idx: number) => (
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
      </div>
    </main>
  );
}