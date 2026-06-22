// Renders one or more JSON-LD nodes into the server-rendered HTML <head>/body.
// Server component: the structured data is present in the initial HTML response
// (spec §1) — never injected later by client JS.
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  const nodes = Array.isArray(data) ? data : [data];
  return (
    <>
      {nodes.map((node, i) => (
        <script
          key={i}
          type="application/ld+json"
          // Content is built server-side from our own typed catalog data.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
        />
      ))}
    </>
  );
}
