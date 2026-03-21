export function UserBubble({ message }) {
  return (
    <div className="flex justify-end mb-4">
      <div
        className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm text-sm leading-relaxed"
        style={{ background: "var(--brand)", color: "#fff" }}
      >
        {message}
      </div>
    </div>
  );
}

export function AIBubble({ message, sources }) {
  const parsed = (() => {
    if (!sources) return [];
    try {
      return typeof sources === "string" ? JSON.parse(sources) : sources;
    } catch {
      return [];
    }
  })();

  return (
    <div className="flex gap-3 mb-4 items-start">
      {/* Avatar */}
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center
                   text-xs font-semibold flex-shrink-0 mt-0.5"
        style={{ background: "var(--success-light)", color: "var(--success)" }}
      >
        AI
      </div>

      <div className="flex-1 min-w-0">
        <div
          className="px-4 py-3 rounded-2xl rounded-tl-sm text-sm leading-relaxed"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border)",
          }}
        >
          {message}
        </div>

        {/* Source pills */}
        {parsed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {parsed.map((s, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs"
                style={{
                  background: "var(--brand-light)",
                  color: "var(--brand)",
                }}
              >
                📄 {s.filename} · p{s.page}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
