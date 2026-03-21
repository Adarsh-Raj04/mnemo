import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteDocument } from "../api/documents";
import { InlineSpinner } from "./Spinner";

export default function DocCard({ doc }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteDocument(doc.filename),
    onSuccess: () => queryClient.invalidateQueries(["documents"]),
  });

  const size = doc.file_size
    ? doc.file_size < 1024 * 1024
      ? `${(doc.file_size / 1024).toFixed(1)} KB`
      : `${(doc.file_size / 1024 / 1024).toFixed(1)} MB`
    : "—";

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl transition-colors"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}
    >
      {/* Icon */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
        style={{ background: "var(--brand-light)" }}
      >
        {doc.filename.endsWith(".pdf") ? "📄" : "📝"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {doc.filename}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          {doc.chunk_count} chunks · {doc.total_pages} pages · {size}
        </p>
      </div>

      {/* Delete */}
      {!confirm ? (
        <button
          className="p-2 rounded-lg transition-colors opacity-40 hover:opacity-100"
          style={{ color: "var(--danger)" }}
          onClick={() => setConfirm(true)}
          title="Delete"
        >
          🗑️
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            Sure?
          </span>
          <button
            className="text-xs px-2 py-1 rounded-lg"
            style={{
              background: "var(--danger-light)",
              color: "var(--danger)",
            }}
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? <InlineSpinner size={12} /> : "Yes"}
          </button>
          <button
            className="text-xs px-2 py-1 rounded-lg"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--text-secondary)",
            }}
            onClick={() => setConfirm(false)}
          >
            No
          </button>
        </div>
      )}
    </div>
  );
}
