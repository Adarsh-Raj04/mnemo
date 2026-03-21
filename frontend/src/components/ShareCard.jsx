import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeShare, updatePermission } from "../api/sharing";
import { InlineSpinner } from "./Spinner";

export default function ShareCard({ share }) {
  const queryClient = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const revokeMutation = useMutation({
    mutationFn: () => revokeShare(share.id),
    onSuccess: () => queryClient.invalidateQueries(["myShares"]),
  });

  const permMutation = useMutation({
    mutationFn: (perm) => updatePermission(share.id, perm),
    onSuccess: () => queryClient.invalidateQueries(["myShares"]),
  });

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-xl"
      style={{
        border: "1px solid var(--border)",
        background: "var(--bg-primary)",
      }}
    >
      {/* Avatar */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center
                   text-sm font-semibold flex-shrink-0"
        style={{ background: "var(--brand-light)", color: "var(--brand)" }}
      >
        {share.shared_with_email?.[0]?.toUpperCase() ?? "?"}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate"
          style={{ color: "var(--text-primary)" }}
        >
          {share.shared_with_email}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
          Since {share.created_at?.slice(0, 10)}
        </p>
      </div>

      {/* Permission toggle */}
      <select
        className="text-xs px-2 py-1 rounded-lg outline-none cursor-pointer"
        style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
        value={share.permission}
        onChange={(e) => permMutation.mutate(e.target.value)}
        disabled={permMutation.isPending}
      >
        <option value="viewer">Viewer</option>
        <option value="contributor">Contributor</option>
      </select>

      {/* Revoke */}
      {!confirm ? (
        <button
          className="text-xs px-2.5 py-1 rounded-lg transition-colors"
          style={{ background: "var(--danger-light)", color: "var(--danger)" }}
          onClick={() => setConfirm(true)}
        >
          Revoke
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
            onClick={() => revokeMutation.mutate()}
            disabled={revokeMutation.isPending}
          >
            {revokeMutation.isPending ? <InlineSpinner size={12} /> : "Yes"}
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
