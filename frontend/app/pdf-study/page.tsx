"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import AuthGuard from "../../components/auth-guard";
import { apiFetch, clearAccessToken, responseError } from "../../lib/api";

type PdfAnalysis = {
  summary: string;
  key_topics: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  chunks: string[];
};

type ConversationItem = {
  question: string;
  answer: string;
};

function isPdfAnalysis(value: unknown): value is PdfAnalysis {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.summary === "string" &&
    Array.isArray(result.key_topics) &&
    result.key_topics.every((topic: unknown) => typeof topic === "string") &&
    (result.difficulty === "Beginner" ||
      result.difficulty === "Intermediate" ||
      result.difficulty === "Advanced") &&
    Array.isArray(result.chunks) &&
    result.chunks.length > 0 &&
    result.chunks.every((chunk: unknown) => typeof chunk === "string")
  );
}

function PdfStudyContent() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [conversation, setConversation] = useState<ConversationItem[]>([]);
  const [error, setError] = useState("");

  const uploadPdf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!file) {
      setError("Choose a PDF file to upload.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a valid PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("PDF files must be 10 MB or smaller.");
      return;
    }

    setUploading(true);
    setAnalysis(null);
    setConversation([]);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch("/api/pdf/upload", {
        method: "POST",
        body: formData,
      });
      if (response.status === 401) {
        clearAccessToken();
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      const result: unknown = await response.json();
      if (!isPdfAnalysis(result)) {
        throw new Error("The server returned an invalid PDF analysis. Please upload again.");
      }
      setAnalysis(result);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not analyze the PDF.");
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const currentAnalysis = analysis;
    const submittedQuestion = question.trim();
    if (!currentAnalysis || !submittedQuestion) {
      setError("Enter a question about the uploaded PDF.");
      return;
    }

    setAsking(true);
    setError("");
    try {
      const response = await apiFetch("/api/pdf/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chunks: currentAnalysis.chunks,
          question: submittedQuestion,
        }),
      });
      if (response.status === 401) {
        clearAccessToken();
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("answer" in result)
      ) {
        throw new Error("The server returned an invalid answer. Please try again.");
      }
      const answer = result.answer;
      if (typeof answer !== "string" || !answer.trim()) {
        throw new Error("The server returned an invalid answer. Please try again.");
      }
      setConversation((items) => [
        ...items,
        { question: submittedQuestion, answer },
      ]);
      setQuestion("");
    } catch (askError) {
      setError(askError instanceof Error ? askError.message : "Could not answer the question.");
    } finally {
      setAsking(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-5 py-8 text-gray-900 md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Groq-powered study tool
          </p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">PDF Study Assistant</h1>
          <p className="mt-2 text-gray-600">
            Upload a text-based PDF to get a summary, identify key topics, and ask questions
            grounded in the document.
          </p>
        </header>

        <form
          onSubmit={uploadPdf}
          className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200"
        >
          <label htmlFor="pdf-file" className="block font-semibold">
            Select a PDF (maximum 10 MB)
          </label>
          <input
            id="pdf-file"
            name="file"
            type="file"
            accept="application/pdf,.pdf"
            disabled={uploading}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setAnalysis(null);
              setConversation([]);
              setError("");
            }}
            className="block w-full rounded-lg border border-gray-300 p-3 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:font-semibold file:text-blue-800"
          />
          {file && <p className="text-sm text-gray-600">Selected: {file.name}</p>}
          <button
            type="submit"
            disabled={!file || uploading}
            className="rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white hover:bg-blue-800 disabled:cursor-wait disabled:bg-blue-300"
          >
            {uploading ? "Extracting and analyzing PDF..." : "Upload and analyze"}
          </button>
        </form>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
            {error}
          </p>
        )}

        {uploading && (
          <p role="status" className="text-center text-gray-600">
            Reading the PDF and generating your study notes...
          </p>
        )}

        {analysis && (
          <>
            <section aria-label="PDF analysis" className="grid gap-5 md:grid-cols-3">
              <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 md:col-span-2">
                <h2 className="text-xl font-bold">Summary</h2>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-gray-700">
                  {analysis.summary}
                </p>
              </article>
              <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
                <h2 className="text-xl font-bold">Difficulty</h2>
                <p className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
                  {analysis.difficulty}
                </p>
              </article>
              <article className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 md:col-span-3">
                <h2 className="text-xl font-bold">Key topics</h2>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {analysis.key_topics.map((topic, index) => (
                    <li
                      key={`${topic}-${index}`}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-900"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              </article>
            </section>

            <section className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
              <div>
                <h2 className="text-2xl font-bold">Ask about this PDF</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Answers are based on the extracted document content.
                </p>
              </div>

              {conversation.length > 0 && (
                <ol aria-label="Question and answer history" className="space-y-4">
                  {conversation.map((item, index) => (
                    <li key={`${index}-${item.question}`} className="space-y-3">
                      <div className="ml-6 rounded-xl bg-blue-50 p-4">
                        <p className="text-xs font-bold uppercase text-blue-800">You asked</p>
                        <p className="mt-1 whitespace-pre-wrap">{item.question}</p>
                      </div>
                      <div className="mr-6 rounded-xl bg-gray-100 p-4">
                        <p className="text-xs font-bold uppercase text-gray-700">Answer</p>
                        <p className="mt-1 whitespace-pre-wrap leading-relaxed">{item.answer}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              <form onSubmit={askQuestion} className="space-y-3">
                <label htmlFor="pdf-question" className="sr-only">
                  Ask a question about the PDF
                </label>
                <textarea
                  id="pdf-question"
                  name="question"
                  required
                  maxLength={2000}
                  rows={3}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="What are the main arguments in section two?"
                  disabled={asking}
                  className="w-full rounded-lg border border-gray-300 p-3 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  className="rounded-lg bg-gray-900 px-5 py-3 font-semibold text-white hover:bg-gray-700 disabled:cursor-wait disabled:bg-gray-400"
                >
                  {asking ? "Finding an answer..." : "Ask question"}
                </button>
              </form>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

export default function PdfStudyPage() {
  return (
    <AuthGuard>
      <PdfStudyContent />
    </AuthGuard>
  );
}
