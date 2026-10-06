"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  clearAccessToken,
  getAccessToken,
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

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [profileExists, setProfileExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }

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
      setMessage("Profile saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <main className="p-10 text-center text-black">Loading profile...</main>;
  }

  const listText = (values: string[]) => values.join("\n");
  const bookmarkText = profile.bookmarks.map((item) => `${item.title} | ${item.url}`).join("\n");

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-black md:p-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Your learning profile</h1>
            <p className="mt-1 text-gray-600">Add a separate entry on each line.</p>
          </div>
          <div className="flex gap-4">
            <Link href="/" className="text-blue-700 underline">Learning home</Link>
            <button
              type="button"
              onClick={() => {
                clearAccessToken();
                router.push("/");
              }}
              className="text-blue-700 underline"
            >
              Log out
            </button>
          </div>
        </header>

        <p className="rounded bg-blue-50 p-4 text-sm text-blue-900">
          Profile details help tailor your roadmap and resource recommendations. Relevant
          education, work, project, and skill details are included as context in AI requests.
        </p>

        <form onSubmit={saveProfile} className="space-y-5 rounded-xl bg-white p-6 shadow">
          {[
            ["education", "Education", "Institution, qualification, subject, or learning goal"],
            ["work_history", "Work experience", "Role, organization, responsibilities, or experience"],
            ["projects", "Projects and interests", "Project descriptions or areas you want to explore"],
            ["skills", "Skills", "One skill per line"],
            ["bookmarks", "Learning bookmarks", "One per line: Title | https://example.com"],
          ].map(([name, label, placeholder]) => (
            <label key={name} className="block space-y-2">
              <span className="font-semibold">{label}</span>
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
                className="w-full rounded border p-3"
              />
            </label>
          ))}
          {error && <p role="alert" className="text-red-700">{error}</p>}
          {message && <p role="status" className="text-green-700">{message}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded bg-blue-600 p-3 font-semibold text-white disabled:bg-blue-300"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>
    </main>
  );
}
