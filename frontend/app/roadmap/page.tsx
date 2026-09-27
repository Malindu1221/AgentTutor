"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function RoadmapPage() {
  const router = useRouter();
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    const data = sessionStorage.getItem("tutorRoadmap");
    if (data) setResult(JSON.parse(data));
    else router.push("/");
  }, [router]);

  if (!result) return null;

  return (
    <main className="min-h-screen p-10 md:p-24 bg-gray-50 text-black">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="bg-white p-6 rounded-lg shadow text-center">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">Your Custom Learning Path</h1>
          <p className="text-lg">Difficulty Level: <span className="font-semibold uppercase">{result.evaluation.difficulty}</span></p>
          <p className="text-gray-500">Diagnostic Score: {result.evaluation.percentage}%</p>
        </header>

        <div className="space-y-4">
          {result.roadmap.map((step: any, index: number) => (
            <div key={step.id} className="p-6 bg-white border-l-4 border-blue-500 rounded-r-lg shadow">
              <h2 className="text-xl font-bold mb-2">Module {index + 1}: {step.title}</h2>
              <p className="text-gray-700 mb-3">{step.description}</p>
              <span className="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full mb-4">
                {step.estimated_time_hours} Hours
              </span>
              
              {/* New section to display YouTube tutorials */}
              {step.resources && step.resources.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3">Recommended Tutorials</h3>
                  <ul className="space-y-2">
                    {step.resources.map((res: any, i: number) => (
                      <li key={i}>
                        <a 
                          href={res.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-red-600 hover:text-red-800 hover:underline flex items-start"
                        >
                          <span className="mr-2 mt-1">▶</span>
                          <span>{res.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
            </div>
          ))}
        </div>

        <button 
          onClick={() => {
            sessionStorage.clear();
            router.push("/");
          }}
          className="w-full py-4 bg-gray-800 hover:bg-gray-900 text-white font-bold rounded-lg"
        >
          Start a New Topic
        </button>
      </div>
    </main>
  );
}