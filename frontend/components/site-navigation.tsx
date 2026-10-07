"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { clearAccessToken, useStoredAccessToken } from "../lib/api";

const navigationLinkClass =
  "inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function SiteNavigation() {
  const accessToken = useStoredAccessToken();
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const link = (href: string, label: string, icon: ReactNode) => (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={navigationLinkClass}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 shadow-sm backdrop-blur-md">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4 md:px-8"
      >
        <Link href="/" className="mr-4 rounded text-xl font-extrabold tracking-tight text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">AgentTutor</span>
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {link("/", "Home", (
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 10.5 8.25-7 8.25 7v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-4.5v6h-4.5a1.5 1.5 0 0 1-1.5-1.5v-9Z" />
            </svg>
          ))}
          {accessToken ? (
            <>
              {link("/pdf-study", "PDF Study Assistant", (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75h6.75L19.5 9v10.5A1.5 1.5 0 0 1 18 21H7.5A1.5 1.5 0 0 1 6 19.5v-14A1.5 1.5 0 0 1 7.5 4Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 3.75V9h5.25M9 13.5h7.5M9 17.25h7.5" />
                </svg>
              ))}
              {link("/profile", "Profile", (
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />
                </svg>
              ))}
              <button
                type="button"
                className={navigationLinkClass}
                onClick={() => {
                  clearAccessToken();
                  router.push("/");
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 7.5V5.25A1.5 1.5 0 0 1 12 3.75h6.75a1.5 1.5 0 0 1 1.5 1.5v13.5a1.5 1.5 0 0 1-1.5 1.5H12a1.5 1.5 0 0 1-1.5-1.5V16.5M15 12H3.75m0 0 3.75-3.75M3.75 12l3.75 3.75" />
                </svg>
                <span>Logout</span>
              </button>
            </>
          ) : (
            <>
              {link("/login", "Log in", null)}
              {link("/register", "Register", null)}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
