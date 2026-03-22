import { useQuery } from "@tanstack/react-query";
import { getStorageUsage } from "../api/storage";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function StorageBar({ compact = false }) {
  const { data, isLoading } = useQuery({
    queryKey: ["storageUsage"],
    queryFn: getStorageUsage,
    refetchInterval: 30000,
  });

  if (isLoading || !data) return null;

  const pct = Math.min(data.percent_original, 100);
  const status = data.status;

  const color =
    status === "full"
      ? "var(--danger)"
      : status === "warning"
        ? "#EF9F27"
        : "var(--success)";

  const bgColor =
    status === "full"
      ? "var(--danger-light)"
      : status === "warning"
        ? "#faeeda"
        : "var(--success-light)";

  // ✅ Compact UI
  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex-1 h-1.5 rounded-full overflow-hidden"
          style={{ background: "var(--border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <span
          className="text-xs flex-shrink-0"
          style={{ color: "var(--text-muted)" }}
        >
          {formatBytes(data.original_bytes)} / 50 MB
        </span>
      </div>
    );
  }

  // ✅ Unlimited case
  if (status === "unlimited") {
    return (
      <div
        className="rounded-xl p-4"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              Storage Usage
            </p>
            <p
              className="text-xs mt-0.5"
              style={{ color: "var(--text-muted)" }}
            >
              Using {data.store_type} — no storage limit applies
            </p>
          </div>
          <span
            className="text-xs px-2.5 py-1 rounded-full"
            style={{
              background: "var(--success-light)",
              color: "var(--success)",
            }}
          >
            ∞ Unlimited
          </span>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {formatBytes(data.original_bytes)} used across {data.doc_count}{" "}
          documents
        </p>
      </div>
    );
  }

  // ✅ DEFAULT (missing earlier)
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: bgColor,
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Storage Usage
        </p>
        <span className="text-xs" style={{ color }}>
          {pct}%
        </span>
      </div>

      <div className="w-full h-2 rounded-full overflow-hidden bg-[var(--border)]">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
        {formatBytes(data.original_bytes)} / 50 MB used
      </p>
    </div>
  );
}
