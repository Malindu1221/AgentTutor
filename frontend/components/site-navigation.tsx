"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { clearAccessToken, useStoredAccessToken } from "../lib/api";

const navigationLinkClass =
  "rounded-md px-3 py-2 text-sm font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700";

export default function SiteNavigation() {
  const accessToken = useStoredAccessToken();
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/login" || pathname === "/register") {
    return null;
  }

  const link = (href: string, label: string) => (
    <Link
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={navigationLinkClass}
    >
      {label}
    </Link>
  );

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav
        aria-label="Main navigation"
        className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-3 md:px-10"
      >
        <Link href="/" className="mr-4 rounded font-bold text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
          AgentTutor
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {link("/", "Home")}
          {accessToken ? (
            <>
              {link("/profile", "Profile")}
              {link("/recommendations", "Recommendations")}
              {link("/pdf-study", "PDF Study Assistant")}
              <button
                type="button"
                className={navigationLinkClass}
                onClick={() => {
                  clearAccessToken();
                  router.push("/");
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              {link("/login", "Log in")}
              {link("/register", "Register")}
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
