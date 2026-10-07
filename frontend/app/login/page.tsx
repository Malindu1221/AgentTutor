"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, responseError, saveAccessToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must be no longer than 72 UTF-8 bytes.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json();
      saveAccessToken(data.access_token);
      router.replace("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-gray-50 p-4 text-gray-900">
      <section className="relative hidden h-[calc(100vh-2rem)] w-full overflow-hidden rounded-3xl lg:block lg:w-1/2">
        <Image
          src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=2000&q=90"
          alt="A student exploring technology on a laptop"
          fill
          priority
          unoptimized
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-blue-950/60 to-indigo-900/40" />
        <div className="absolute inset-0 flex items-end p-12 text-white lg:p-16">
          <div className="max-w-xl">
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              Learn with confidence
            </p>
            <h2 className="text-4xl font-bold leading-tight lg:text-5xl">
              Unlock your learning path with AgentTutor.
            </h2>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-blue-50/90">
              Build a personalized learning plan and make progress one thoughtful step at a time.
            </p>
          </div>
        </div>
      </section>

      <section className="flex min-h-[calc(100vh-2rem)] w-full items-center justify-center rounded-2xl bg-white p-8 lg:w-1/2 lg:px-12">
        <div className="w-full max-w-xl px-6">
          <Link href="/" className="mb-12 inline-flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-indigo-700 text-xl font-bold text-white shadow-lg shadow-blue-700/20">
              A
            </span>
            <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent">
              AgentTutor
            </span>
          </Link>

          <div className="mb-10">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Welcome back</h1>
            <p className="mt-4 text-base text-gray-500 sm:text-lg">Sign in to continue your learning journey.</p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <label className="block space-y-2.5">
              <span className="text-base font-semibold text-gray-700">Email</span>
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-5 py-5 text-lg text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            <label className="block space-y-2.5">
              <span className="text-base font-semibold text-gray-700">Password</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                maxLength={72}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                className="w-full rounded-xl border border-gray-300 bg-gray-50 px-5 py-5 text-lg text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
              />
            </label>
            {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-slate-900 to-blue-950 px-5 py-4 text-lg font-semibold text-white shadow-lg shadow-slate-900/15 transition-transform duration-200 hover:scale-[1.02] hover:from-blue-950 hover:to-indigo-950 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-gray-600">
            Need an account?{" "}
            <Link className="font-semibold text-blue-700 hover:text-indigo-700" href="/register">
              Register
            </Link>
          </p>
          <Link className="mt-6 block text-center text-base text-gray-500 hover:text-gray-800" href="/">
            Back to learning
          </Link>
        </div>
      </section>
    </main>
  );
}
