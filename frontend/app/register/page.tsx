"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, responseError, saveAccessToken } from "../../lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (new TextEncoder().encode(password).length > 72) {
      setError("Password must be no longer than 72 UTF-8 bytes.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiFetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const data = await response.json();
      saveAccessToken(data.access_token);
      router.replace("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-black">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold">Create your account</h1>
        <label className="block space-y-2">
          <span>Email</span>
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
            className="w-full rounded border p-3"
          />
        </label>
        <label className="block space-y-2">
          <span>Password (at least 8 characters)</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            className="w-full rounded border p-3"
          />
        </label>
        <label className="block space-y-2">
          <span>Confirm password</span>
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              setError("");
            }}
            className="w-full rounded border p-3"
          />
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:bg-blue-300"
        >
          {loading ? "Creating account..." : "Register"}
        </button>
        <p>
          Already registered? <Link className="text-blue-700 underline" href="/login">Log in</Link>
        </p>
      </form>
    </main>
  );
}
