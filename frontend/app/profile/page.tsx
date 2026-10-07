"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../../components/auth-guard";
import AnalyticsDashboard from "../../components/analytics-dashboard";
import {
  apiFetch,
  clearAccessToken,
  responseError,
} from "../../lib/api";

type Profile = {
  education: string[];
  work_history: string[];
  projects: string[];
  skills: string[];
  bookmarks: { title: string; url: string }[];
};

const emptyProfile: Profile = {
  education: [],
  work_history: [],
  projects: [],
  skills: [],
  bookmarks: [],
};

function linesToList(value: string): string[] {
  return value.split("\n").map((line) => line.trim()).filter(Boolean);
}

function ProfileContent() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await apiFetch("/api/profile/me");
        if (response.status === 404) {
          setProfileExists(false);
          return;
        }
        if (response.status === 401) {
          clearAccessToken();
          router.replace("/login");
          return;
        }
        if (!response.ok) throw new Error(await responseError(response));
        const data = await response.json();
        setProfile({
          education: data.education ?? [],
          work_history: data.work_history ?? [],
          projects: data.projects ?? [],
          skills: data.skills ?? [],
          bookmarks: data.bookmarks ?? [],
        });
        setProfileExists(true);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load profile.");
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, [router]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const bookmarkLines = linesToList(String(form.get("bookmarks") ?? ""));
    const bookmarks: Profile["bookmarks"] = [];
    for (const line of bookmarkLines) {
      const separator = line.indexOf("|");
      if (separator < 1) {
        setError('Each bookmark must use the format "Title | https://example.com".');
        setSaving(false);
        return;
      }
      const title = line.slice(0, separator).trim();
      const url = line.slice(separator + 1).trim();
      try {
        const parsedUrl = new URL(url);
        if (!title || !["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        setError(`Invalid bookmark URL: ${url}`);
        setSaving(false);
        return;
      }
      bookmarks.push({ title, url });
    }

    const payload: Profile = {
      education: linesToList(String(form.get("education") ?? "")),
      work_history: linesToList(String(form.get("work_history") ?? "")),
      projects: linesToList(String(form.get("projects") ?? "")),
      skills: linesToList(String(form.get("skills") ?? "")),
      bookmarks,
    };

    try {
      const response = await apiFetch("/api/profile/me", {
        method: profileExists ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 401) {
        clearAccessToken();
        router.replace("/login");
        return;
      }
      if (!response.ok) throw new Error(await responseError(response));
      setProfile(payload);
      setProfileExists(true);
      setProfileSaved(true);
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  const listText = (values: string[]) => values.join("\n");
  const bookmarkText = profile.bookmarks.map((item) => `${item.title} | ${item.url}`).join("\n");

  return (
    <main className="min-h-screen bg-slate-200 px-4 py-8 text-slate-900 md:px-8 md:py-12">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-7 text-white shadow-xl shadow-slate-900/15 md:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-200">
            Personalize your learning
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
            Your learning profile
          </h1>
          <p className="mt-2 text-slate-300">Add a separate entry on each line.</p>
        </header>

        <p className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-relaxed text-blue-950 shadow-sm">
          Profile details help tailor your roadmap and resource recommendations. Relevant
          education, work, project, and skill details are included as context in AI requests.
        </p>

        <AnalyticsDashboard />

        <section aria-labelledby="profile-details-heading" className="space-y-5">
          <h2 id="profile-details-heading" className="text-2xl font-bold text-slate-900">
            Profile details
          </h2>
          {loading ? (
            <p className="rounded-2xl border border-gray-300 bg-white p-6 text-slate-600 shadow-xl" role="status">
              Loading your profile...
            </p>
          ) : (
            <form
              onSubmit={saveProfile}
              onChange={() => setProfileSaved(false)}
              className="space-y-5 rounded-2xl border border-gray-300 bg-white p-6 shadow-xl shadow-slate-900/10 md:p-8"
            >
              {[
                ["education", "Education", "Institution, qualification, subject, or learning goal"],
                ["work_history", "Work experience", "Role, organization, responsibilities, or experience"],
                ["projects", "Projects and interests", "Project descriptions or areas you want to explore"],
                ["skills", "Skills", "One skill per line"],
                ["bookmarks", "Learning bookmarks", "One per line: Title | https://example.com"],
              ].map(([name, label, placeholder]) => (
                <label key={name} className="block space-y-2">
                  <span className="font-semibold text-slate-800">{label}</span>
                  <textarea
                    name={name}
                    rows={name === "bookmarks" ? 3 : 4}
                    defaultValue={
                      name === "education" ? listText(profile.education)
                        : name === "work_history" ? listText(profile.work_history)
                          : name === "projects" ? listText(profile.projects)
                            : name === "skills" ? listText(profile.skills)
                              : bookmarkText
                    }
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-300 bg-slate-50 px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20"
                  />
                </label>
              ))}
              {error && <p role="alert" className="text-red-700">{error}</p>}
              {message && <p role="status" className="text-green-700">{message}</p>}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-slate-900 px-8 py-3.5 font-semibold text-white shadow-md transition-all hover:bg-slate-800 disabled:cursor-wait disabled:opacity-50 sm:w-auto"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
              {profileSaved && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-green-950">
                  <p role="status">
                    Profile saved. Regenerate recommendations to use these updates.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/recommendations?generate=1")}
                    className="mt-3 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-md transition-all hover:bg-slate-800"
                  >
                    Generate updated recommendations
                  </button>
                </div>
              )}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
