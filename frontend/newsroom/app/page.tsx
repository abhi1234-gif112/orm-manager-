import Link from "next/link";

export default function DashboardHome() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">SAPTANGA Editor Desk</h1>
      <p className="mt-3 text-neutral-600">
        Foundation build. The full dashboard (incoming stories, editorial queue, drafts,
        analytics — see docs/ROADMAP.md Phases 3–7) is not built yet.
      </p>
      <Link
        href="/sources"
        className="mt-6 inline-block rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
      >
        Go to Source Registry
      </Link>
    </div>
  );
}
