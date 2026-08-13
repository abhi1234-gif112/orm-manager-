"use client";

import { useEffect, useState } from "react";

import { RequireAuth } from "@/components/RequireAuth";
import { apiFetch, ApiError } from "@/lib/api";
import type { IngestionMethod, Source, SourceCreateInput, SourceType } from "@/lib/types";

const SOURCE_TYPES: SourceType[] = [
  "rss",
  "atom",
  "web",
  "youtube",
  "official_release",
  "press_release",
];
const INGESTION_METHODS: IngestionMethod[] = ["rss_poll", "web_scrape", "api", "manual"];

function SourcesContent() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<SourceCreateInput>({
    name: "",
    url: "",
    source_type: "rss",
    ingestion_method: "rss_poll",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Source[]>("/sources");
      setSources(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load sources");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<Source>("/sources", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ name: "", url: "", source_type: "rss", ingestion_method: "rss_poll" });
      await loadSources();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `Could not create source (${err.status}): ${err.message}`
          : "Could not create source"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: string) => {
    try {
      await apiFetch<void>(`/sources/${id}`, { method: "DELETE" });
      await loadSources();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not deactivate source");
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Source Registry</h1>
      <p className="mt-2 text-neutral-600">
        Every ingestion source SAPTANGA reads from — registering one here does not start
        ingestion yet (Phase 2).
      </p>

      {error && (
        <p className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-6 grid grid-cols-1 gap-3 rounded border border-neutral-200 bg-white p-4 sm:grid-cols-2"
      >
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          required
          placeholder="URL"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        />
        <select
          value={form.source_type}
          onChange={(e) => setForm({ ...form, source_type: e.target.value as SourceType })}
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          {SOURCE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select
          value={form.ingestion_method}
          onChange={(e) =>
            setForm({ ...form, ingestion_method: e.target.value as IngestionMethod })
          }
          className="rounded border border-neutral-300 px-3 py-2 text-sm"
        >
          {INGESTION_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="sm:col-span-2 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add source"}
        </button>
      </form>

      <div className="mt-8">
        {loading ? (
          <p className="text-neutral-500">Loading sources…</p>
        ) : sources.length === 0 ? (
          <p className="text-neutral-500">No sources registered yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">
                    <div className="font-medium">{source.name}</div>
                    <div className="text-neutral-500">{source.url}</div>
                  </td>
                  <td className="py-2 pr-4">{source.source_type}</td>
                  <td className="py-2 pr-4">
                    {source.active ? (
                      <span className="text-green-700">active</span>
                    ) : (
                      <span className="text-neutral-400">inactive</span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {source.active && (
                      <button
                        onClick={() => handleDeactivate(source.id)}
                        className="text-red-600 hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function SourcesPage() {
  return (
    <RequireAuth>
      <SourcesContent />
    </RequireAuth>
  );
}
