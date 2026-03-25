import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMyShares, getSharedWithMe, inviteUser } from "../api/sharing";
import ShareCard from "../components/ShareCard";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import { ProgressBar, InlineSpinner } from "../components/Spinner";

export default function Sharing() {
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState(null);
  const [form, setForm] = useState({ email: "", permission: "viewer" });
  const [msg, setMsg] = useState({ text: "", ok: true });

  const { data: myShares = [] } = useQuery({
    queryKey: ["myShares"],
    queryFn: getMyShares,
  });
  const { data: sharedToMe = [] } = useQuery({
    queryKey: ["sharedWithMe"],
    queryFn: getSharedWithMe,
  });

  const inviteMutation = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries(["myShares"]);
      setMsg({ text: `Invite sent to ${form.email}!`, ok: true });
      setForm({ email: "", permission: "viewer" });
    },
    onError: (err) => {
      setMsg({
        text: err.response?.data?.detail || "Failed to send invite",
        ok: false,
      });
    },
  });

  function handleInvite(e) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    if (!form.email) return;
    inviteMutation.mutate(form);
  }

  return (
    <div
      className="flex flex-col h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      <ProgressBar />
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSessionId={sessionId} onSessionSelect={setSessionId} />

        <main className="flex-1 overflow-y-auto px-8 py-8 max-w-3xl">
          <h1
            className="text-xl font-semibold mb-1"
            style={{ color: "var(--text-primary)" }}
          >
            Sharing
          </h1>
          <p
            className="text-sm mb-6"
            style={{ color: "var(--text-secondary)" }}
          >
            Invite others to access your knowledge base.
          </p>

          {/* Invite form */}
          <div className="card mb-8">
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: "var(--text-primary)" }}
            >
              Invite a user
            </h2>
            <form
              onSubmit={handleInvite}
              className="flex gap-3 items-end flex-wrap"
            >
              <div className="flex-1 min-w-48">
                <label className="label">Email address</label>
                <input
                  className="input"
                  type="email"
                  placeholder="colleague@example.com"
                  value={form.email}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, email: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">Permission</label>
                <select
                  className="input"
                  value={form.permission}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, permission: e.target.value }))
                  }
                >
                  <option value="viewer">Viewer - can chat</option>
                  <option value="contributor">
                    Contributor - can upload too
                  </option>
                </select>
              </div>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={inviteMutation.isPending}
              >
                {inviteMutation.isPending && <InlineSpinner size={14} />}
                Send Invite
              </button>
            </form>
            {msg.text && (
              <p
                className="text-xs mt-3 px-3 py-2 rounded-lg"
                style={{
                  background: msg.ok
                    ? "var(--success-light)"
                    : "var(--danger-light)",
                  color: msg.ok ? "var(--success)" : "var(--danger)",
                }}
              >
                {msg.text}
              </p>
            )}
          </div>

          {/* People I shared with */}
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--text-secondary)" }}
          >
            People with access to my knowledge base
          </h2>
          {myShares.length === 0 ? (
            <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
              You haven't shared with anyone yet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 mb-8">
              {myShares.map((s) => (
                <ShareCard key={s.id} share={s} />
              ))}
            </div>
          )}

          {/* Shared with me */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 24 }}>
            <h2
              className="text-sm font-semibold mb-3"
              style={{ color: "var(--text-secondary)" }}
            >
              Knowledge bases shared with me
            </h2>
            {sharedToMe.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                No one has shared their knowledge base with you yet.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {sharedToMe.map((s, i) => (
                  <div key={i} className="card flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center
                                      text-sm font-semibold flex-shrink-0"
                      style={{
                        background: "var(--brand-light)",
                        color: "var(--brand)",
                      }}
                    >
                      {s.owner_email?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p
                        className="text-sm font-medium"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {s.owner_email}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {s.permission} · since {s.created_at?.slice(0, 10)}
                      </p>
                    </div>
                    <span
                      className="badge text-xs px-2.5 py-0.5"
                      style={{
                        background: "var(--brand-light)",
                        color: "var(--brand)",
                      }}
                    >
                      {s.permission}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
