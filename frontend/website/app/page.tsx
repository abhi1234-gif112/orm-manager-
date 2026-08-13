export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">SAPTANGA Newsroom</h1>
      <p className="mt-4 text-neutral-600">
        This is the public archive for SAPTANGA Newsroom&apos;s published reporting. The Story
        Engine, editorial review pipeline, and canonical story pages (
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-sm">/stories/[slug]</code>,{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-sm">/categories/[category]</code>
        ) are being built per the phased roadmap in{" "}
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-sm">docs/ROADMAP.md</code> — no
        stories have been published yet.
      </p>
    </div>
  );
}
