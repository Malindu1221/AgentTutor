"use client";

import { ReactNode, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
  responseError,
  TOKEN_CHANGE_EVENT,
} from "../lib/api";

type GuardState = "checking" | "authenticated" | "error";

export default function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GuardState>("checking");
  const [attempt, setAttempt] = useState(0);

  const verifySession = useCallback(
    async (signal: AbortSignal) => {
      const token = getAccessToken();
      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await apiFetch("/api/auth/me", { signal });
        if (response.status === 401) {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(await responseError(response));
        setState("authenticated");
      } catch {
        if (signal.aborted) return;
        setState("error");
      }
    },
    [router],
  );

  useEffect(() => {
    const controller = new AbortController();
    const verificationTimer = window.setTimeout(() => {
      void verifySession(controller.signal);
    }, 0);
    const recheck = () => {
      setState("checking");
      setAttempt((current) => current + 1);
    };
    window.addEventListener("storage", recheck);
    window.addEventListener(TOKEN_CHANGE_EVENT, recheck);
    return () => {
      window.clearTimeout(verificationTimer);
      controller.abort();
      window.removeEventListener("storage", recheck);
      window.removeEventListener(TOKEN_CHANGE_EVENT, recheck);
    };
  }, [attempt, verifySession]);

  if (state === "authenticated") return children;
  if (state === "error") {
    return (
      <main className="flex min-h-64 flex-col items-center justify-center gap-4 p-8 text-center">
        <p role="alert" className="text-red-700">
          Could not verify your sign-in with the server. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => {
            setState("checking");
            setAttempt((current) => current + 1);
          }}
          className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
        >
          Try again
        </button>
      </main>
    );
  }
  return (
    <main className="p-10 text-center text-gray-700" role="status">
      Verifying your sign-in...
    </main>
  );
}
