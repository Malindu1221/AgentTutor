"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import AuthGuard from "../../components/auth-guard";
import { apiFetch, clearAccessToken, responseError } from "../../lib/api";

type PdfAnalysis = {
  session_id: string;
  pdf_filename: string;
  summary: string;
  key_topics: string[];
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  chunks: string[];
};

type PdfSessionSummary = {
  session_id: string;
  pdf_filename: string;
  created_at: string;
};

type ChatMessage = {
  message_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPdfAnalysis(value: unknown): value is PdfAnalysis {
  if (!isRecord(value)) return false;
  return (
    typeof value.session_id === "string" &&
    typeof value.pdf_filename === "string" &&
    typeof value.summary === "string" &&
    Array.isArray(value.key_topics) &&
    value.key_topics.every((topic: unknown) => typeof topic === "string") &&
    (value.difficulty === "Beginner" ||
      value.difficulty === "Intermediate" ||
      value.difficulty === "Advanced") &&
    Array.isArray(value.chunks) &&
    value.chunks.length > 0 &&
    value.chunks.every((chunk: unknown) => typeof chunk === "string")
  );
}

function parseSessionList(value: unknown): PdfSessionSummary[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PdfSessionSummary =>
    isRecord(item) &&
    typeof item.session_id === "string" &&
    typeof item.pdf_filename === "string" &&
    typeof item.created_at === "string"
  );
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ChatMessage =>
    isRecord(item) &&
    typeof item.message_id === "string" &&
    (item.role === "user" || item.role === "assistant") &&
    typeof item.content === "string" &&
    typeof item.created_at === "string"
  );
}

function normalizeMathDelimiters(markdown: string): string {
  return markdown
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, formula: string) => `$$\n${formula.trim()}\n$$`)
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, formula: string) => `$${formula.trim()}$`);
}

function MarkdownAnswer({ content }: { content: string }) {
  return (
    <div className="markdown-content leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeMathDelimiters(content)}
      </ReactMarkdown>
    </div>
  );
}

function PdfStudyContent() {
  const router = useRouter();
  const [sessions, setSessions] = useState<PdfSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeFilename, setActiveFilename] = useState("");
  const [analysis, setAnalysis] = useState<PdfAnalysis | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [streamingQuestion, setStreamingQuestion] = useState("");
  const [streamingAnswer, setStreamingAnswer] = useState("");
  const [conversation, setConversation] = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selectionRequestId = useRef(0);

  const handleUnauthorized = useCallback(() => {
    clearAccessToken();
    router.replace("/login");
  }, [router]);

  const refreshSessions = useCallback(async () => {
    const response = await apiFetch("/api/pdf/sessions");
    if (response.status === 401) {
      handleUnauthorized();
      return [];
    }
    if (!response.ok) throw new Error(await responseError(response));
    return parseSessionList(await response.json());
  }, [handleUnauthorized]);

  useEffect(() => {
    let cancelled = false;
    const loadSessions = async () => {
      try {
        const loadedSessions = await refreshSessions();
        if (cancelled) return;
        setSessions(loadedSessions);
        if (loadedSessions.length > 0) {
          setCreatingSession(false);
          await selectSession(loadedSessions[0].session_id);
        } else {
          setCreatingSession(true);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load PDF sessions.");
        }
      } finally {
        if (!cancelled) setLoadingSessions(false);
      }
    };
    void loadSessions();
    return () => {
      cancelled = true;
      selectionRequestId.current += 1;
    };
    // The initial fetch deliberately selects only the newest session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSessions]);

  const startNewSession = () => {
    selectionRequestId.current += 1;
    setActiveSessionId(null);
    setActiveFilename("");
    setAnalysis(null);
    setConversation([]);
    setFile(null);
    setQuestion("");
    setError("");
    setCreatingSession(true);
  };

  async function selectSession(sessionId: string) {
    const requestId = ++selectionRequestId.current;
    setLoadingSessionId(sessionId);
    setError("");
    try {
      const response = await apiFetch(`/api/pdf/sessions/${encodeURIComponent(sessionId)}`);
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      const result: unknown = await response.json();
      if (
        !isRecord(result) ||
        result.session_id !== sessionId ||
        typeof result.pdf_filename !== "string"
      ) {
        throw new Error("The server returned an invalid PDF session.");
      }
      if (requestId !== selectionRequestId.current) return;
      setActiveSessionId(sessionId);
      setActiveFilename(result.pdf_filename);
      setAnalysis(null);
      setConversation(parseMessages(result.messages));
      setQuestion("");
      setStreamingQuestion("");
      setStreamingAnswer("");
      setCreatingSession(false);
    } catch (loadError) {
      if (requestId === selectionRequestId.current) {
        setError(loadError instanceof Error ? loadError.message : "Could not load this PDF session.");
      }
    } finally {
      if (requestId === selectionRequestId.current) setLoadingSessionId(null);
    }
  }

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
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await apiFetch("/api/pdf/upload", {
        method: "POST",
        body: formData,
      });
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      const result: unknown = await response.json();
      if (!isPdfAnalysis(result)) {
        throw new Error("The server returned an invalid PDF analysis. Please upload again.");
      }

      setAnalysis(result);
      setActiveSessionId(result.session_id);
      setActiveFilename(result.pdf_filename);
      setConversation([]);
      setQuestion("");
      setCreatingSession(false);
      setFile(null);
      setSessions(await refreshSessions());
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not analyze the PDF.");
    } finally {
      setUploading(false);
    }
  };

  const askQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sessionId = activeSessionId;
    const submittedQuestion = question.trim();
    if (!sessionId || !submittedQuestion) {
      setError("Select a PDF session and enter a question.");
      return;
    }

    setAsking(true);
    setStreamingQuestion(submittedQuestion);
    setStreamingAnswer("");
    setError("");
    try {
      const response = await apiFetch(
        `/api/pdf/sessions/${encodeURIComponent(sessionId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: submittedQuestion }),
        },
      );
      if (response.status === 401) {
        handleUnauthorized();
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      if (!response.body) {
        throw new Error("The server did not provide an answer stream. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      const processEvent = (eventText: string) => {
        let eventName = "message";
        const dataLines: string[] = [];
        for (const line of eventText.split("\n")) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (dataLines.length === 0) return;

        let payload: unknown;
        try {
          payload = JSON.parse(dataLines.join("\n"));
        } catch {
          throw new Error("The server returned an invalid answer stream. Please try again.");
        }
        if (eventName === "error") {
          const detail =
            isRecord(payload) && typeof payload.detail === "string"
              ? payload.detail
              : "Could not finish the answer. Please try again.";
          throw new Error(detail);
        }
        if (eventName === "token" && typeof payload === "string") {
          answer += payload;
          setStreamingAnswer(answer);
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          buffer = (buffer + decoder.decode(value, { stream: !done })).replace(/\r\n/g, "\n");
          let eventBoundary = buffer.indexOf("\n\n");
          while (eventBoundary !== -1) {
            processEvent(buffer.slice(0, eventBoundary));
            buffer = buffer.slice(eventBoundary + 2);
            eventBoundary = buffer.indexOf("\n\n");
          }
          if (done) break;
        }
        if (buffer.trim()) processEvent(buffer);
      } finally {
        reader.releaseLock();
      }

      if (!answer.trim()) {
        throw new Error("The server returned an empty answer. Please try again.");
      }
      const now = new Date().toISOString();
      setConversation((messages) => [
        ...messages,
        {
          message_id: crypto.randomUUID(),
          role: "user",
          content: submittedQuestion,
          created_at: now,
        },
        {
          message_id: crypto.randomUUID(),
          role: "assistant",
          content: answer.trim(),
          created_at: now,
        },
      ]);
      setQuestion("");
    } catch (chatError) {
      setError(chatError instanceof Error ? chatError.message : "Could not answer the question.");
    } finally {
      setStreamingQuestion("");
      setStreamingAnswer("");
      setAsking(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-6 text-slate-900 md:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
        <aside className="w-full shrink-0 rounded-2xl border border-gray-300 bg-white p-5 shadow-xl shadow-slate-900/10 lg:w-80">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-bold text-slate-900">PDF notebooks</h1>
            <button
              type="button"
              onClick={startNewSession}
              disabled={uploading || asking || loadingSessionId !== null}
              className="rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              + New PDF
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">Your uploaded PDFs and chats</p>
          <nav aria-label="PDF chat history" className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
            {loadingSessions && <p className="p-3 text-sm text-slate-500">Loading sessions...</p>}
            {!loadingSessions && sessions.length === 0 && (
              <p className="p-3 text-sm text-slate-500">No PDF sessions yet.</p>
            )}
            {sessions.map((session) => (
              <button
                key={session.session_id}
                type="button"
                onClick={() => void selectSession(session.session_id)}
                disabled={loadingSessionId !== null || uploading || asking}
                aria-current={session.session_id === activeSessionId ? "page" : undefined}
                className={`w-full rounded-xl p-3 text-left transition ${
                  session.session_id === activeSessionId
                    ? "bg-blue-50 text-blue-950 ring-1 ring-blue-200"
                    : "text-slate-800 hover:bg-slate-100"
                }`}
              >
                <span className="block truncate font-semibold">{session.pdf_filename}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {new Date(session.created_at).toLocaleString()}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0 flex-1 space-y-6">
          <header className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-6 text-white shadow-xl shadow-slate-900/15 md:p-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-200">
              Groq-powered study tool
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">PDF Study Assistant</h2>
            <p className="mt-2 text-slate-300">
              {activeFilename
                ? `Current notebook: ${activeFilename}`
                : "Upload a PDF to create a notebook with its own saved chat history."}
            </p>
          </header>

          {error && (
            <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
              {error}
            </p>
          )}

          {(creatingSession || (!activeSessionId && !loadingSessions)) && (
            <form
              onSubmit={uploadPdf}
              className="space-y-4 rounded-2xl border border-gray-300 bg-white p-6 shadow-xl shadow-slate-900/10"
            >
              <h3 className="text-xl font-bold text-slate-900">Start a new PDF chat</h3>
              <label htmlFor="pdf-file" className="block font-semibold text-slate-800">
                Select a text-based PDF (maximum 10 MB)
              </label>
              <input
                id="pdf-file"
                name="file"
                type="file"
                accept="application/pdf,.pdf"
                disabled={uploading}
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError("");
                }}
                className="block w-full rounded-xl border border-gray-300 bg-slate-50 p-3 text-slate-800 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:font-semibold file:text-white"
              />
              {file && <p className="text-sm text-slate-600">Selected: {file.name}</p>}
              <button
                type="submit"
                disabled={!file || uploading}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
              >
                {uploading ? "Extracting and analyzing PDF..." : "Upload and create chat"}
              </button>
            </form>
          )}

          {analysis && activeSessionId === analysis.session_id && (
            <section aria-label="PDF analysis" className="grid gap-5 md:grid-cols-3">
              <article className="rounded-2xl border border-gray-300 bg-white p-6 shadow-xl shadow-slate-900/10 md:col-span-2">
                <h3 className="text-xl font-bold text-slate-900">Summary</h3>
                <p className="mt-3 whitespace-pre-wrap leading-relaxed text-slate-700">
                  {analysis.summary}
                </p>
              </article>
              <article className="rounded-2xl border border-gray-300 bg-white p-6 shadow-xl shadow-slate-900/10">
                <h3 className="text-xl font-bold text-slate-900">Difficulty</h3>
                <p className="mt-3 inline-flex rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">
                  {analysis.difficulty}
                </p>
              </article>
              <article className="rounded-2xl border border-gray-300 bg-white p-6 shadow-xl shadow-slate-900/10 md:col-span-3">
                <h3 className="text-xl font-bold text-slate-900">Key topics</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {analysis.key_topics.map((topic, index) => (
                    <li
                      key={`${topic}-${index}`}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-950"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              </article>
            </section>
          )}

          {activeSessionId && (
            <section className="space-y-5 rounded-2xl border border-gray-300 bg-white p-6 shadow-xl shadow-slate-900/10">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">Chat about this PDF</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Chat history is saved separately for each uploaded PDF.
                </p>
              </div>

              <ol aria-label="Question and answer history" className="space-y-4">
                {conversation.map((message) => (
                  <li
                    key={message.message_id}
                    className={`rounded-xl border p-4 ${
                      message.role === "user"
                        ? "ml-6 border-blue-200 bg-blue-50 text-blue-950"
                        : "mr-6 border-gray-200 bg-white text-gray-800 shadow-md"
                    }`}
                  >
                    <p className="text-xs font-bold uppercase text-slate-700">
                      {message.role === "user" ? "You" : "Assistant"}
                    </p>
                    {message.role === "assistant" ? (
                      <div className="mt-1">
                        <MarkdownAnswer content={message.content} />
                      </div>
                    ) : (
                      <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
                    )}
                  </li>
                ))}
                {asking && (
                  <>
                    <li className="ml-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950">
                      <p className="text-xs font-bold uppercase text-slate-700">You</p>
                      <p className="mt-1 whitespace-pre-wrap">{streamingQuestion}</p>
                    </li>
                    <li aria-live="polite" className="mr-6 rounded-xl border border-gray-200 bg-white p-4 text-gray-800 shadow-md">
                      <p className="text-xs font-bold uppercase text-slate-700">Assistant</p>
                      <div className="mt-1">
                        {streamingAnswer ? (
                          <MarkdownAnswer content={streamingAnswer} />
                        ) : (
                          <span className="text-sm text-slate-500">Generating answer...</span>
                        )}
                      </div>
                    </li>
                  </>
                )}
              </ol>

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
                  placeholder="Ask a question about this PDF..."
                  disabled={asking}
                  className="w-full rounded-xl border border-gray-300 bg-slate-50 p-4 text-slate-900 outline-none transition focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="submit"
                  disabled={asking || !question.trim()}
                  className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50"
                >
                  {asking ? "Answering..." : "Send"}
                </button>
              </form>
            </section>
          )}
        </section>
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
