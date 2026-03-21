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

  return (
    <div
      className="rounded-xl p-4"
      style={{ background: bgColor, border: `1px solid ${color}30` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-sm font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Storage Usage
        </span>
        <span className="text-xs font-medium" style={{ color }}>
          {formatBytes(data.original_bytes)} / 50 MB
        </span>
      </div>

      {/* Bar */}
      <div
        className="h-2 rounded-full overflow-hidden mb-3"
        style={{ background: "var(--border)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Documents
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {data.doc_count}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sources
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {data.source_count}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Text indexed
            </p>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--text-primary)" }}
            >
              {formatBytes(data.text_bytes)}
            </p>
          </div>
        </div>

        {/* Status badge */}
        {status !== "ok" && (
          <span
            className="text-xs font-medium px-2.5 py-1 rounded-full"
            style={{ background: color + "20", color }}
          >
            {status === "full" ? "⛔ Limit reached" : "⚠️ Approaching limit"}
          </span>
        )}
      </div>
    </div>
  );
}
